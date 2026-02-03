#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any, Iterable, Iterator, List, Optional, Tuple

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


# ---------------------------
# Config
# ---------------------------

@dataclass
class Config:
    dsn: str
    dump_path: str
    school_id: int = 1
    dry_run: bool = False
    source: str = "import"


# ---------------------------
# MySQL dump parsing (INSERT INTO `table` VALUES (...),(...);)
# ---------------------------

INSERT_RE = re.compile(r"^INSERT INTO `(?P<table>[^`]+)` VALUES\s*(?P<values>.+);$", re.IGNORECASE)

def iter_insert_rows(dump_path: str, table: str) -> Iterator[List[Any]]:
    """
    Stream-parse MySQL dump. Yields each row (list of python values) for a given table.
    Handles multi-line INSERT statements.
    """
    buf: List[str] = []
    capturing = False

    with open(dump_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")

            if not capturing:
                if line.startswith(f"INSERT INTO `{table}` VALUES"):
                    capturing = True
                    buf = [line]
                    # if it ends with ;, we can parse immediately
                    if line.endswith(";"):
                        stmt = " ".join(buf)
                        yield from _parse_insert_stmt(stmt, table)
                        capturing = False
                        buf = []
                continue

            # capturing
            buf.append(line)
            if line.endswith(";"):
                stmt = " ".join(buf)
                yield from _parse_insert_stmt(stmt, table)
                capturing = False
                buf = []

def _parse_insert_stmt(stmt: str, expected_table: str) -> Iterator[List[Any]]:
    m = INSERT_RE.match(stmt.strip())
    if not m:
        return
    table = m.group("table")
    if table != expected_table:
        return
    values_blob = m.group("values").strip()
    # values_blob looks like: (..),(..),(..)
    for tup in _split_mysql_tuples(values_blob):
        yield _parse_mysql_tuple(tup)

def _split_mysql_tuples(values_blob: str) -> Iterator[str]:
    """
    Splits "(a,b),(c,d)" into ["(a,b)", "(c,d)"] safely (quotes-aware).
    """
    s = values_blob.strip()
    i = 0
    n = len(s)
    depth = 0
    in_str = False
    esc = False
    start = None

    while i < n:
        ch = s[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == "'":
                in_str = False
        else:
            if ch == "'":
                in_str = True
            elif ch == "(":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0 and start is not None:
                    yield s[start : i + 1]
                    start = None
        i += 1

def _parse_mysql_tuple(tup: str) -> List[Any]:
    """
    Parse a single tuple string like: "(1,'Nick',NULL,'2026-01-01 12:00:00')"
    into python values.
    """
    assert tup[0] == "(" and tup[-1] == ")"
    inner = tup[1:-1]

    out: List[Any] = []
    cur: List[str] = []
    in_str = False
    esc = False

    def flush_token(token: str) -> None:
        token = token.strip()
        if token.upper() == "NULL" or token == "":
            out.append(None)
            return
        # numeric?
        if re.fullmatch(r"-?\d+", token):
            out.append(int(token))
            return
        if re.fullmatch(r"-?\d+\.\d+", token):
            out.append(float(token))
            return
        # fallback as string
        out.append(token)

    i = 0
    n = len(inner)
    while i < n:
        ch = inner[i]
        if in_str:
            if esc:
                # basic unescape: \', \\, \n, \r, \t
                if ch == "n":
                    cur.append("\n")
                elif ch == "r":
                    cur.append("\r")
                elif ch == "t":
                    cur.append("\t")
                else:
                    cur.append(ch)
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == "'":
                in_str = False
            else:
                cur.append(ch)
        else:
            if ch == "'":
                in_str = True
            elif ch == ",":
                token = "".join(cur)
                flush_token(token)
                cur = []
            else:
                cur.append(ch)
        i += 1

    # last token
    token = "".join(cur)
    flush_token(token)

    return out


# ---------------------------
# Helpers
# ---------------------------

from typing import Any

def norm(s: Any) -> str:
    if s is None:
        return ""
    return str(s).strip()


def key_name_class(name: str, class_name: str) -> tuple[str, str]:
    # normalize aggressively to match reliably
    return (norm(name).casefold(), norm(class_name).casefold())

def placeholder_email(name: str, class_name: str, school_id: int) -> str:
    """
    Deterministic placeholder so reruns are idempotent-ish.
    """
    base = f"{school_id}|{norm(name)}|{norm(class_name)}"
    h = hashlib.sha1(base.encode("utf-8")).hexdigest()[:12]
    return f"import+{h}@example.invalid"

def parse_dt_utc(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    # old dump uses "YYYY-MM-DD HH:MM:SS"
    dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    return dt.replace(tzinfo=timezone.utc)

def ensure_check_order(ci: datetime, co: Optional[datetime]) -> tuple[datetime, Optional[datetime]]:
    if co is None:
        return ci, None
    if co <= ci:
        # satisfy check constraint check_out > check_in
        return ci, ci + timedelta(seconds=1)
    return ci, co


# ---------------------------
# Import logic
# ---------------------------

def get_engine(dsn: str) -> Engine:
    return create_engine(dsn, future=True, pool_pre_ping=True)

def load_existing_users(engine: Engine, school_id: int) -> dict[tuple[str, str], int]:
    """
    Map (name,class) -> user_id for existing student users.
    """
    mapping: dict[tuple[str, str], int] = {}
    with engine.begin() as conn:
        rows = conn.execute(
            text("""
                SELECT id, name, class_name
                FROM users
                WHERE school_id = :sid AND role = 'student'
            """),
            {"sid": school_id},
        ).mappings().all()

    for r in rows:
        k = key_name_class(r["name"], r["class_name"] or "")
        mapping[k] = int(r["id"])
    return mapping

def upsert_user_and_rfid(
    conn,
    school_id: int,
    name: str,
    class_name: str,
    rfid_uid: Optional[str],
) -> int:
    """
    Create user if missing. Always set class_name (best-effort).
    Create RFIDCard if uid present.
    Returns user_id.
    """
    email = placeholder_email(name, class_name, school_id)

    # Create / fetch user by (school_id, email) uniqueness
    user_id = conn.execute(
        text("""
            INSERT INTO users (school_id, email, name, role, auth_provider, password_hash, archived, class_name)
            VALUES (:sid, :email, :name, 'student', 'import', NULL, false, :class_name)
            ON CONFLICT (school_id, email)
            DO UPDATE SET
                name = EXCLUDED.name,
                class_name = COALESCE(EXCLUDED.class_name, users.class_name)
            RETURNING id
        """),
        {"sid": school_id, "email": email, "name": name, "class_name": class_name or None},
    ).scalar_one()

    if rfid_uid:
        # RFIDCard.uid is unique
        conn.execute(
            text("""
                INSERT INTO rfid_cards (user_id, uid, label, is_active, created_by, created_at, updated_at)
                VALUES (:uid_user, :rfid, NULL, true, NULL, NOW(), NOW())
                ON CONFLICT (uid)
                DO UPDATE SET user_id = EXCLUDED.user_id, is_active = true, updated_at = NOW()
            """),
            {"uid_user": int(user_id), "rfid": rfid_uid},
        )

    return int(user_id)

def insert_attendance_event(
    conn,
    user_id: int,
    check_in: datetime,
    check_out: Optional[datetime],
    *,
    is_external: bool,
    location: Optional[str],
    description: Optional[str],
    approval_status: Optional[str],
    approved_at: Optional[datetime],
    source: str,
):
    # External constraints: if is_external => location not null AND approval_status not null
    if is_external:
        location = norm(location) or "Onbekend"
        approval_status = (approval_status or "pending").lower()
        if approval_status not in {"pending", "approved", "rejected"}:
            approval_status = "pending"

    check_in, check_out = ensure_check_order(check_in, check_out)

    conn.execute(
        text("""
            INSERT INTO attendance_events
                (user_id, project_id, check_in, check_out, is_external, location, description,
                 approval_status, approved_by, approved_at, source, created_at, updated_at, created_by)
            VALUES
                (:user_id, NULL, :check_in, :check_out, :is_external, :location, :description,
                 :approval_status, NULL, :approved_at, :source, NOW(), NOW(), NULL)
            ON CONFLICT DO NOTHING
        """),
        {
            "user_id": user_id,
            "check_in": check_in,
            "check_out": check_out,
            "is_external": bool(is_external),
            "location": location,
            "description": description,
            "approval_status": approval_status,
            "approved_at": approved_at,
            "source": source,
        },
    )

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dsn", default=None, help="Postgres DSN (or set DATABASE_URL)")
    p.add_argument("--dump", required=True, help="Path to old MySQL .sql dump")
    p.add_argument("--school-id", type=int, default=1)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    dsn = args.dsn or __import__("os").getenv("DATABASE_URL")
    if not dsn:
        raise SystemExit("Missing --dsn or DATABASE_URL")

    cfg = Config(dsn=dsn, dump_path=args.dump, school_id=args.school_id, dry_run=args.dry_run)

    engine = get_engine(cfg.dsn)

    # ---- Step A: read students from dump, build index by old student uid
    # old students table columns (from your dump):
    # (uid, name, class, username, balance, total_time, blocks, total_external, total_blocks, email)
    students_by_uid: dict[str, dict[str, Any]] = {}
    students_by_nameclass: dict[tuple[str, str], str] = {}  # (name,class) -> uid

    for row in iter_insert_rows(cfg.dump_path, "students"):
        # old students:
        # (id, uid, name, total_time, class, username, password_hash, email, class_id, class_name, role)
        if len(row) < 11:
            continue

        old_uid = norm(row[1])     # RFID uid
        name = norm(row[2])
        class_name = norm(row[4])  # <-- HIER zit de klas (bv. 'V6')

        if not old_uid or not name:
            continue

        students_by_uid[old_uid] = {
            "uid": old_uid,
            "name": name,
            "class_name": class_name,
        }
        students_by_nameclass[key_name_class(name, class_name)] = old_uid

    print(f"Found {len(students_by_uid)} students in dump.")
    
    if cfg.dry_run:
        # we can also count logs/external quickly
        logs_count = sum(1 for _ in iter_insert_rows(cfg.dump_path, "logs"))
        ext_count = sum(1 for _ in iter_insert_rows(cfg.dump_path, "external_work"))
        print(f"[DRY RUN] logs rows: {logs_count}, external_work rows: {ext_count}")
        return

    # ---- Step B: insert users + rfid_cards (match on name+class by deterministic placeholder email)
    existing_map = load_existing_users(engine, cfg.school_id)

    # Map (name,class) -> new user_id
    nameclass_to_userid: dict[tuple[str, str], int] = dict(existing_map)

    with engine.begin() as conn:
        created = 0
        for st in students_by_uid.values():
            k = key_name_class(st["name"], st["class_name"])
            if k in nameclass_to_userid:
                # still ensure RFIDCard exists
                uid = st["uid"]
                conn.execute(
                    text("""
                        INSERT INTO rfid_cards (user_id, uid, label, is_active, created_by, created_at, updated_at)
                        VALUES (:user_id, :rfid, NULL, true, NULL, NOW(), NOW())
                        ON CONFLICT (uid) DO UPDATE SET user_id = EXCLUDED.user_id, is_active = true, updated_at = NOW()
                    """),
                    {"user_id": nameclass_to_userid[k], "rfid": uid},
                )
                continue

            user_id = upsert_user_and_rfid(
                conn,
                cfg.school_id,
                st["name"],
                st["class_name"],
                st["uid"],
            )
            nameclass_to_userid[k] = user_id
            created += 1

        print(f"Users created (new): {created} (existing reused: {len(existing_map)}).")

    # ---- Step C: import school attendance logs -> attendance_events
    # old logs columns (from your dump): (id, uid, check_in, check_out, duration)
    imported_logs = 0
    skipped_logs = 0

    with engine.begin() as conn:
        for row in iter_insert_rows(cfg.dump_path, "logs"):
            if len(row) < 4:
                continue
            old_uid = str(row[1])
            check_in = parse_dt_utc(row[2])
            check_out = parse_dt_utc(row[3])

            st = students_by_uid.get(old_uid)
            if not st or not check_in:
                skipped_logs += 1
                continue

            k = key_name_class(st["name"], st["class_name"])
            user_id = nameclass_to_userid.get(k)
            if not user_id:
                skipped_logs += 1
                continue

            insert_attendance_event(
                conn,
                user_id=user_id,
                check_in=check_in,
                check_out=check_out,
                is_external=False,
                location=None,
                description=None,
                approval_status=None,
                approved_at=None,
                source=cfg.source,
            )
            imported_logs += 1

    print(f"Imported logs -> attendance_events: {imported_logs}, skipped: {skipped_logs}")

    # ---- Step D: import external_work -> attendance_events (is_external=true)
    # old external_work columns (from your dump):
    # (id, student_uid, location, description, start_time, end_time, status, submitted_at, reviewed_at, reviewed_by, review_comment)
    imported_ext = 0
    skipped_ext = 0

    with engine.begin() as conn:
        for row in iter_insert_rows(cfg.dump_path, "external_work"):
            # old external_work:
            # (id, uid, name, class, location, description, start_time, end_time, submitted_at, status)
            if len(row) < 10:
                continue

            old_uid = norm(row[1])
            location = row[4]
            description = row[5]
            start_time = parse_dt_utc(row[6])
            end_time = parse_dt_utc(row[7])
            submitted_at = parse_dt_utc(row[8])  # optional
            status = row[9]  # approved/pending/rejected
            reviewed_at = None


            st = students_by_uid.get(old_uid)
            if not st or not start_time:
                skipped_ext += 1
                continue

            k = key_name_class(st["name"], st["class_name"])
            user_id = nameclass_to_userid.get(k)
            if not user_id:
                skipped_ext += 1
                continue

            insert_attendance_event(
                conn,
                user_id=user_id,
                check_in=start_time,
                check_out=end_time,
                is_external=True,
                location=str(location) if location is not None else None,
                description=str(description) if description is not None else None,
                approval_status=str(status) if status is not None else "pending",
                approved_at=reviewed_at,
                source=cfg.source,
            )
            imported_ext += 1

    print(f"Imported external_work -> attendance_events: {imported_ext}, skipped: {skipped_ext}")
    print("Done.")


if __name__ == "__main__":
    main()
