export function notationJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function ensureNotationSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS notation_students (
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
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS notation_records (
      student_id INTEGER PRIMARY KEY,
      integration_level INTEGER NOT NULL DEFAULT 3,
      robustness_level INTEGER NOT NULL DEFAULT 3,
      work_level INTEGER NOT NULL DEFAULT 3,
      results_level INTEGER NOT NULL DEFAULT 3,
      future_level INTEGER NOT NULL DEFAULT 3,
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
      exported_at TEXT,
      FOREIGN KEY(student_id) REFERENCES notation_students(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS notation_access (
      username TEXT PRIMARY KEY,
      peloton TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS notation_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      action TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      previous_data TEXT,
      new_data TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_notation_students_scope
      ON notation_students(active, promotion, peloton, classement)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_notation_records_status
      ON notation_records(status)`)
  ]);
}

export function validPeloton(value) {
  return ["P1", "P2", "P3"].includes(String(value || "").trim().toUpperCase());
}

export async function notationPermission(context) {
  const session = context.data?.session;

  if (!session || session.type !== "user") {
    return null;
  }

  if (session.role === "admin") {
    return {
      username: session.username,
      role: "admin",
      isAdmin: true,
      scope: "ALL"
    };
  }

  if (session.role !== "cadre") {
    return null;
  }

  await ensureNotationSchema(context.env.DB);

  const row = await context.env.DB.prepare(`
    SELECT peloton
    FROM notation_access
    WHERE username = ?
    LIMIT 1
  `).bind(session.username).first();

  if (!row || !validPeloton(row.peloton)) {
    return {
      username: session.username,
      role: "cadre",
      isAdmin: false,
      scope: null
    };
  }

  return {
    username: session.username,
    role: "cadre",
    isAdmin: false,
    scope: String(row.peloton).toUpperCase()
  };
}

export function notationLevels(body) {
  const values = {
    integration: Number(body.integration_level),
    robustness: Number(body.robustness_level),
    work: Number(body.work_level),
    results: Number(body.results_level),
    future: Number(body.future_level)
  };

  if (Object.values(values).some(value => !Number.isInteger(value) || value < 1 || value > 5)) {
    return null;
  }

  return values;
}

export async function auditNotation(db, studentId, action, actor, previousData, newData) {
  await db.prepare(`
    INSERT INTO notation_audit_log (
      student_id, action, actor_username, previous_data, new_data
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(
    studentId || null,
    action,
    actor,
    previousData ? JSON.stringify(previousData) : null,
    newData ? JSON.stringify(newData) : null
  ).run();
}
