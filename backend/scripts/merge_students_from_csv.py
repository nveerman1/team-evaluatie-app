#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import os
from dataclasses import dataclass
from typing import Any, Tuple

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


@dataclass
class Config:
    dsn: str
    csv_path: str
    school_id: int = 1
    dry_run: bool = False


def norm(s: Any) -> str:
    if s is None:
        return ""
    return str(s).strip()


def key_name_class(name: str, class_name: str) -> Tuple[str, str]:
    return (norm(name).casefold(), norm(class_name).casefold())


def get_engine(dsn: str) -> Engine:
    return create_engine(dsn, future=True, pool_pre_ping=True)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--dsn", default=os.getenv("DATABASE_URL"))
    p.add_argument("--csv", required=True)
    p.add_argument("--school-id", type=int, default=1)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    if not args.dsn:
        raise SystemExit("Missing --dsn or DATABASE_URL")

    cfg = Config(
        dsn=args.dsn, csv_path=args.csv, school_id=args.school_id, dry_run=args.dry_run
    )
    engine = get_engine(cfg.dsn)

    with engine.begin() as conn:
        users = (
            conn.execute(
                text("""
                SELECT id, email, name, class_name, archived
                FROM users
                WHERE school_id = :sid AND role = 'student'
            """),
                {"sid": cfg.school_id},
            )
            .mappings()
            .all()
        )

    by_email = {u["email"].casefold(): dict(u) for u in users if u["email"]}
    by_nameclass = {
        key_name_class(u["name"], u["class_name"] or ""): dict(u) for u in users
    }

    actions = {
        "email_match_update": 0,
        "nameclass_promote": 0,
        "create_new": 0,
        "merge_move": 0,
        "skipped": 0,
    }

    def log(msg: str) -> None:
        print(msg)

    with open(cfg.csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")
        required = {"name", "class", "email"}
        if not required.issubset(set(reader.fieldnames or [])):
            raise SystemExit(
                f"CSV must have columns: {sorted(required)}. Found: {reader.fieldnames}"
            )
        rows = list(reader)

    with engine.begin() as conn:
        for r in rows:
            name = norm(r["name"])
            class_name = norm(r["class"])
            email = norm(r["email"]).lower()

            if not name or not class_name or not email:
                actions["skipped"] += 1
                continue

            k = key_name_class(name, class_name)
            email_k = email.casefold()

            existing_email_user = by_email.get(email_k)
            existing_nameclass_user = by_nameclass.get(k)

            # Case 1: email already exists
            if existing_email_user:
                uid = int(existing_email_user["id"])
                updates = {}
                if not norm(existing_email_user.get("class_name")):
                    updates["class_name"] = class_name
                if name and norm(existing_email_user.get("name")) != name:
                    updates["name"] = name

                if updates:
                    log(f"[EMAIL MATCH] user_id={uid} email={email} updates={updates}")
                    actions["email_match_update"] += 1
                    if not cfg.dry_run:
                        conn.execute(
                            text("""
                                UPDATE users
                                SET name = COALESCE(:name, name),
                                    class_name = COALESCE(:class_name, class_name)
                                WHERE id = :id
                            """),
                            {
                                "id": uid,
                                "name": updates.get("name"),
                                "class_name": updates.get("class_name"),
                            },
                        )

                # Merge placeholder with same name+class into this email user
                if (
                    existing_nameclass_user
                    and int(existing_nameclass_user["id"]) != uid
                ):
                    placeholder_id = int(existing_nameclass_user["id"])
                    log(
                        f"[MERGE] Move data from placeholder user_id={placeholder_id} -> real user_id={uid} (name+class match)"
                    )
                    actions["merge_move"] += 1
                    if not cfg.dry_run:
                        conn.execute(
                            text(
                                "UPDATE attendance_events SET user_id=:to_id WHERE user_id=:from_id"
                            ),
                            {"to_id": uid, "from_id": placeholder_id},
                        )
                        conn.execute(
                            text(
                                "UPDATE rfid_cards SET user_id=:to_id WHERE user_id=:from_id"
                            ),
                            {"to_id": uid, "from_id": placeholder_id},
                        )
                        conn.execute(
                            text("UPDATE users SET archived=true WHERE id=:id"),
                            {"id": placeholder_id},
                        )
                continue

            # Case 2: promote placeholder based on name+class
            if existing_nameclass_user:
                uid = int(existing_nameclass_user["id"])
                old_email = existing_nameclass_user.get("email")
                log(
                    f"[PROMOTE] user_id={uid} {name} ({class_name}) email: {old_email} -> {email}"
                )
                actions["nameclass_promote"] += 1
                if not cfg.dry_run:
                    conn.execute(
                        text("UPDATE users SET email=:email WHERE id=:id"),
                        {"id": uid, "email": email},
                    )
                continue

            # Case 3: create new
            log(f"[CREATE] {name} ({class_name}) email={email}")
            actions["create_new"] += 1
            if not cfg.dry_run:
                conn.execute(
                    text("""
                        INSERT INTO users (school_id, email, name, role, auth_provider, password_hash, archived, class_name)
                        VALUES (:sid, :email, :name, 'student', 'import', NULL, false, :class_name)
                    """),
                    {
                        "sid": cfg.school_id,
                        "email": email,
                        "name": name,
                        "class_name": class_name,
                    },
                )

    print("\nSummary:", actions)


if __name__ == "__main__":
    main()
