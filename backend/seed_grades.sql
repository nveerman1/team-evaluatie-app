-- seed_grades.sql
-- Pas aan naar je evaluatie:
\set EVAL_ID 2

-- 1) Evaluatie + scope
WITH ev AS (
  SELECT id, school_id, cluster
  FROM evaluations
  WHERE id = :EVAL_ID
),

-- 2) Demo-studenten in juiste cluster (alleen als ze nog niet bestaan)
ins_students AS (
  INSERT INTO users (school_id, email, name, role, archived, class_name, cluster, team_number)
  SELECT
    ev.school_id,
    v.email,
    v.name,
    'student',
    false,
    'V2A',
    ev.cluster,
    v.team_number
  FROM ev
  CROSS JOIN (
    VALUES
      ('anna.demo@example.com','Anna Jansen',1),
      ('bram.demo@example.com','Bram de Boer',2),
      ('celine.demo@example.com','Céline van Dijk',3)
  ) AS v(email, name, team_number)
  WHERE NOT EXISTS (
    SELECT 1
    FROM users u2
    WHERE u2.school_id = ev.school_id
      AND u2.email = v.email
  )
  RETURNING id
),

-- 3) Pak 3 studenten uit de cluster
stu AS (
  SELECT u.id, u.team_number, u.class_name
  FROM users u
  JOIN ev ON u.school_id = ev.school_id
  WHERE u.cluster = ev.cluster
    AND u.role = 'student'
    AND COALESCE(u.archived, false) = false
  ORDER BY u.id
  LIMIT 3
),

-- 4) Upsert grades voor deze evaluatie (let op: GEEN 'grade'-kolom gebruiken)
upsert AS (
  INSERT INTO grades (
    school_id, evaluation_id, user_id,
    meta, gcf, spr, suggested_grade, published_grade, override_reason, published_at
  )
  SELECT
    ev.school_id,
    ev.id,
    s.id,
    jsonb_build_object(
      'team_number', s.team_number,
      'class_name',  s.class_name,
      'gcf', 1.0,
      'spr', 0.85 + rn * 0.1
    )::jsonb AS meta,
    1.0                         AS gcf,
    (0.85 + rn * 0.1)           AS spr,
    (7.0 + rn)                  AS suggested_grade,
    (7.5 + rn)                  AS published_grade,
    'seeded'                    AS override_reason,      -- zodat jouw UI 'saved' toont
    now()                       AS published_at
  FROM ev
  JOIN (
    SELECT s.id, s.team_number, s.class_name, row_number() OVER () AS rn
    FROM stu s
  ) s ON TRUE
  ON CONFLICT (evaluation_id, user_id) DO UPDATE
    SET meta            = EXCLUDED.meta,
        gcf             = EXCLUDED.gcf,
        spr             = EXCLUDED.spr,
        suggested_grade = EXCLUDED.suggested_grade,
        published_grade = EXCLUDED.published_grade,
        override_reason = EXCLUDED.override_reason,
        published_at    = now()
  RETURNING user_id
)

-- 5) Resultaat
SELECT
  '✅ Grades seeded for evaluation ' || (SELECT id FROM ev)
  || ' (cluster=' || (SELECT cluster FROM ev) || '): '
  || count(*) || ' rows' AS result
FROM upsert;
