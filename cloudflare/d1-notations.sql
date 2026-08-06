CREATE TABLE IF NOT EXISTS notation_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promotion TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL,
  sexe TEXT NOT NULL DEFAULT 'M',
  peloton TEXT NOT NULL,
  moyenne REAL,
  classement INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(promotion, peloton, nom, prenom)
);

CREATE TABLE IF NOT EXISTS notation_records (
  student_id INTEGER PRIMARY KEY,
  integration_level INTEGER NOT NULL DEFAULT 3,
  robustness_level INTEGER NOT NULL DEFAULT 3,
  setback_recovery_level INTEGER NOT NULL DEFAULT 3,
  mission_adaptation_level INTEGER NOT NULL DEFAULT 3,
  work_level INTEGER NOT NULL DEFAULT 3,
  results_level INTEGER NOT NULL DEFAULT 3,
  future_level INTEGER NOT NULL DEFAULT 3,
  physical_preparation TEXT NOT NULL DEFAULT '',
  responsibility TEXT NOT NULL DEFAULT '',
  responsibility_label TEXT NOT NULL DEFAULT '',
  responsibility_level INTEGER NOT NULL DEFAULT 3,
  overall_nuance TEXT NOT NULL DEFAULT '',
  particular_note TEXT NOT NULL DEFAULT '',
  literal TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  platoon_validated_by TEXT,
  platoon_validated_at TEXT,
  company_finalized_by TEXT,
  company_finalized_at TEXT,
  returned_by TEXT,
  returned_at TEXT,
  return_note TEXT NOT NULL DEFAULT '',
  exported_at TEXT,
  FOREIGN KEY(student_id) REFERENCES notation_students(id)
);

CREATE TABLE IF NOT EXISTS notation_access (
  username TEXT PRIMARY KEY,
  peloton TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notation_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  action TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  previous_data TEXT,
  new_data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notation_students_scope
  ON notation_students(active, promotion, peloton, classement);

CREATE INDEX IF NOT EXISTS idx_notation_records_status
  ON notation_records(status);
