export const SERVICE_TYPES = [
  { code: "P", label: "Permanence", color: "#f5a9b8", textColor: "#241014", countsPermanence: true },
  { code: "PTPH", label: "Permanence téléphonique", color: "#81d4c7", textColor: "#08231f", countsPermanence: true },
  { code: "SOP", label: "Sous-officier de permanence", color: "#5b8f63", textColor: "#ffffff", countsSop: true },
  { code: "OP", label: "Officier de permanence", color: "#5b8f63", textColor: "#ffffff" },
  { code: "ASD", label: "Adjoint au service de permanence", color: "#5b8f63", textColor: "#ffffff" },
  { code: "R", label: "Repos", color: "#43a854", textColor: "#071b0b" },
  { code: "RR", label: "Repos récupérateur", color: "#43a854", textColor: "#173d1e", recoveryDebit: 0.5 },
  { code: "RPJ", label: "Repos post-journée", color: "#02913d", textColor: "#ffcc6a" },
  { code: "RPC", label: "Repos post-cérémonie", color: "#02913d", textColor: "#ffd533", recoveryDebit: 0.5 },
  { code: "PERM_POSEE", label: "Permission posée", color: "#ad10d7", textColor: "#ffffff" },
  { code: "PERM_VALIDEE", label: "Permission validée", color: "#00561b", textColor: "#ffffff" },
  { code: "M", label: "Maladie", color: "#ff37b8", textColor: "#1f0618" },
  { code: "D", label: "Détachement / divers", color: "#ffffff", textColor: "#111111" },
  { code: "PREV", label: "Prévision", color: "#bca3a4", textColor: "#211819" },
  { code: "OCCUPE", label: "Occupé", color: "#ffffff", textColor: "#d10000" }
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
  if (!session || session.type !== "user" || !["cadre", "admin"].includes(session.role)) return null;
  return {
    username: session.username,
    role: session.role,
    isAdmin: session.role === "admin"
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
      entry_id INTEGER,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(person_id) REFERENCES service_people(id),
      FOREIGN KEY(entry_id) REFERENCES service_entries(id) ON DELETE SET NULL
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
    )`)
  ]);

  await db.prepare(`
    INSERT OR IGNORE INTO service_people (username, display_name, sort_order, active, sop_eligible)
    SELECT username, nom, 100, active, 1
    FROM users
    WHERE role IN ('cadre','admin') AND nom IS NOT NULL AND TRIM(nom) <> ''
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
