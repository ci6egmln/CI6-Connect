-- CI6 Connect — module Service
-- Les mêmes tables sont créées automatiquement au premier accès au module.

CREATE TABLE IF NOT EXISTS service_people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  grade TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  peloton TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  sop_eligible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK(target_type IN ('person','peloton')),
  target_key TEXT NOT NULL,
  service_date TEXT NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('M','N')),
  service_code TEXT NOT NULL,
  custom_label TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_type, target_key, service_date, slot)
);

CREATE INDEX IF NOT EXISTS idx_service_entries_period
  ON service_entries(service_date, target_type, target_key);
CREATE INDEX IF NOT EXISTS idx_service_entries_target
  ON service_entries(target_type, target_key, service_date);

CREATE TABLE IF NOT EXISTS service_recovery_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  movement_date TEXT NOT NULL,
  amount REAL NOT NULL,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('credit','debit','adjustment')),
  reason TEXT NOT NULL,
  entry_id INTEGER,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(person_id) REFERENCES service_people(id),
  FOREIGN KEY(entry_id) REFERENCES service_entries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_recovery_person_date
  ON service_recovery_ledger(person_id, movement_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_recovery_entry
  ON service_recovery_ledger(entry_id) WHERE entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS service_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entry_id INTEGER,
  actor_username TEXT NOT NULL,
  previous_data TEXT,
  new_data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
