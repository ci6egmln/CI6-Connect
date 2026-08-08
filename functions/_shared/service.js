export const SERVICE_TYPES = [
  { code: "P", label: "Permanence", color: "#f2ad2f", textColor: "#241707", countsPermanence: true },
  { code: "SOP", label: "Sous-officier de permanence", color: "#6f42a8", textColor: "#ffffff", countsSop: true },
  { code: "OP", label: "Officier de permanence", color: "#6f42a8", textColor: "#ffffff" },
  { code: "ASD", label: "Adjoint au service de permanence", color: "#6f42a8", textColor: "#ffffff" },
  { code: "R", label: "Repos", color: "#48a95a", textColor: "#071b0b" },
  { code: "RR", label: "Repos récupérateur", color: "#62b96d", textColor: "#0c2711", recoveryDebit: 0.5 },
  { code: "PTPH", label: "Permanence téléphonique", color: "#7bc989", textColor: "#0b2812", countsPermanence: true },
  { code: "RPJ", label: "Repos post-journée", color: "#02913d", textColor: "#ffcc6a" },
  { code: "RPC", label: "Repos post-cérémonie", color: "#02913d", textColor: "#ffd533", recoveryDebit: 0.5 },
  { code: "M", label: "Maladie", color: "#3b171d", textColor: "#ffffff" },
  { code: "D", label: "Détachement / divers", color: "#ffffff", textColor: "#111111" },
  { code: "OCCUPE", label: "Occupé", color: "#586b79", textColor: "#ffffff" },
  { code: "PREV", label: "Prévision", color: "#9eabb4", textColor: "#172027" },
  { code: "PERM_POSEE", label: "Permission posée Agorha", color: "#812a39", textColor: "#ffffff" },
  { code: "PERM_VALIDEE", label: "Permission validée", color: "#00561b", textColor: "#ffffff" },
];

export function serviceJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function servicePermission(context) {
  const session = context.data?.session;
  if (!session || session.type !== "user" || !["cadre", "cdu", "admin"].includes(session.role)) return null;
  return {
    username: session.username,
    role: session.role,
    isAdmin: session.role === "admin",
    isCdu: session.role === "cdu" || session.role === "admin"
  };
}

export async function ensureServiceSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS service_people (
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
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS service_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL CHECK(target_type IN ('person','peloton')),
      target_key TEXT NOT NULL,
      service_date TEXT NOT NULL,
      slot TEXT NOT NULL CHECK(slot IN ('M','N')),
      service_code TEXT NOT NULL,
      custom_label TEXT NOT NULL DEFAULT '',
      custom_color TEXT NOT NULL DEFAULT '',
      group_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(target_type, target_key, service_date, slot)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_service_entries_period
      ON service_entries(service_date, target_type, target_key)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_service_entries_target
      ON service_entries(target_type, target_key, service_date)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS service_recovery_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      movement_date TEXT NOT NULL,
      amount REAL NOT NULL,
      movement_type TEXT NOT NULL CHECK(movement_type IN ('credit','debit','adjustment')),
      reason TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      period_end TEXT,
      movement_group TEXT NOT NULL DEFAULT '',
      reversal_of INTEGER,
      entry_id INTEGER,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(person_id) REFERENCES service_people(id),
      FOREIGN KEY(entry_id) REFERENCES service_entries(id) ON DELETE SET NULL,
      FOREIGN KEY(reversal_of) REFERENCES service_recovery_ledger(id) ON DELETE SET NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_service_recovery_person_date
      ON service_recovery_ledger(person_id, movement_date)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_service_recovery_entry
      ON service_recovery_ledger(entry_id) WHERE entry_id IS NOT NULL`),
    db.prepare(`CREATE TABLE IF NOT EXISTS service_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entry_id INTEGER,
      actor_username TEXT NOT NULL,
      previous_data TEXT,
      new_data TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS service_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);

  const entryColumns = await db.prepare(`PRAGMA table_info(service_entries)`).all();
  const entryColumnNames = new Set((entryColumns.results || []).map(column => column.name));
  if (!entryColumnNames.has("custom_color")) {
    await db.prepare(`ALTER TABLE service_entries ADD COLUMN custom_color TEXT NOT NULL DEFAULT ''`).run();
  }
  if (!entryColumnNames.has("group_id")) {
    await db.prepare(`ALTER TABLE service_entries ADD COLUMN group_id TEXT NOT NULL DEFAULT ''`).run();
  }
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_service_entries_group ON service_entries(group_id)`).run();

  const ledgerColumns = await db.prepare(`PRAGMA table_info(service_recovery_ledger)`).all();
  const ledgerColumnNames = new Set((ledgerColumns.results || []).map(column => column.name));
  if (!ledgerColumnNames.has("comment")) {
    await db.prepare(`ALTER TABLE service_recovery_ledger ADD COLUMN comment TEXT NOT NULL DEFAULT ''`).run();
  }
  if (!ledgerColumnNames.has("period_end")) {
    await db.prepare(`ALTER TABLE service_recovery_ledger ADD COLUMN period_end TEXT`).run();
  }
  if (!ledgerColumnNames.has("movement_group")) {
    await db.prepare(`ALTER TABLE service_recovery_ledger ADD COLUMN movement_group TEXT NOT NULL DEFAULT ''`).run();
  }
  if (!ledgerColumnNames.has("reversal_of")) {
    await db.prepare(`ALTER TABLE service_recovery_ledger ADD COLUMN reversal_of INTEGER`).run();
  }
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_service_recovery_group ON service_recovery_ledger(movement_group)`).run();

  await db.prepare(`
    INSERT OR IGNORE INTO service_people (username, display_name, sort_order, active, sop_eligible)
    SELECT username, nom, 100, active, 1
    FROM users
    WHERE role IN ('cadre','cdu','admin') AND nom IS NOT NULL AND TRIM(nom) <> ''
  `).run();
}

export async function auditService(db, action, entryId, actor, previousData, newData) {
  await db.prepare(`
    INSERT INTO service_audit_log
      (action, entry_id, actor_username, previous_data, new_data)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    action,
    entryId || null,
    actor,
    previousData ? JSON.stringify(previousData) : null,
    newData ? JSON.stringify(newData) : null
  ).run();
}
