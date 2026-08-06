function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}

async function ensureSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS discipline_students (
      nigend TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT,
      peloton TEXT NOT NULL DEFAULT '',
      promotion TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS discipline_sanctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_nigend TEXT NOT NULL,
      sanction_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      reason_code TEXT,
      reason_free TEXT,
      observations TEXT,
      sanction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      deleted_by TEXT,
      FOREIGN KEY(student_nigend) REFERENCES discipline_students(nigend)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS discipline_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sanction_id INTEGER,
      action TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      previous_data TEXT,
      new_data TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);
}

function validType(value) {
  return ["rappel_verbal", "compte_rendu_ecrit", "lettre_observation", "tours_consigne", "jours_arret"].includes(value);
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) return json({ error: "Liaison D1 indisponible." }, 500);
  await ensureSchema(db);
  const url = new URL(context.request.url);
  const action = url.searchParams.get("action") || "search";

  try {
    if (action === "search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (q.length < 1) return json({ students: [] });
      const like = `%${q}%`;
      const result = await db.prepare(`
        SELECT nigend, nom, prenom, peloton, promotion, active
        FROM discipline_students
        WHERE active = 1 AND (nigend LIKE ? OR nom LIKE ? OR prenom LIKE ? OR peloton LIKE ?)
        ORDER BY nom, prenom
        LIMIT 30
      `).bind(like, like, like, like).all();
      return json({ students: result.results || [] });
    }

    if (action === "student") {
      const nigend = (url.searchParams.get("nigend") || "").trim();
      const student = await db.prepare(`SELECT * FROM discipline_students WHERE nigend = ? LIMIT 1`).bind(nigend).first();
      if (!student) return json({ error: "Élève introuvable." }, 404);
      const sanctions = await db.prepare(`
        SELECT id, student_nigend, sanction_type, quantity, reason_code, reason_free,
               observations, sanction_date, created_by, created_at, updated_by, updated_at
        FROM discipline_sanctions
        WHERE student_nigend = ? AND deleted_at IS NULL
        ORDER BY datetime(sanction_date) DESC, id DESC
      `).bind(nigend).all();
      const counts = await db.prepare(`
        SELECT sanction_type, COUNT(*) AS entries, SUM(quantity) AS quantity
        FROM discipline_sanctions
        WHERE student_nigend = ? AND deleted_at IS NULL
        GROUP BY sanction_type
      `).bind(nigend).all();
      return json({ student, sanctions: sanctions.results || [], counts: counts.results || [] });
    }

    if (action === "company") {
      const result = await db.prepare(`
        SELECT s.id, s.student_nigend AS nigend, e.nom, e.prenom, e.peloton, e.promotion,
               s.sanction_type, s.quantity, s.reason_code, s.reason_free,
               s.observations, s.sanction_date, s.created_by, s.created_at,
               s.updated_by, s.updated_at
        FROM discipline_sanctions s
        JOIN discipline_students e ON e.nigend = s.student_nigend
        WHERE s.deleted_at IS NULL
        ORDER BY e.peloton, e.nom, e.prenom, datetime(s.sanction_date) DESC
      `).all();
      return json({ rows: result.results || [] });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (error) {
    return json({ error: "Impossible de charger le suivi disciplinaire.", details: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const actor = context.data.session?.username;
  if (!db || !actor) return json({ error: "Session ou base indisponible." }, 500);
  await ensureSchema(db);
  let body;
  try { body = await context.request.json(); } catch { return json({ error: "Requête invalide." }, 400); }

  const studentNigend = String(body.student_nigend || "").trim();
  const sanctionType = String(body.sanction_type || "").trim();
  const quantity = Math.max(1, Math.min(365, Number(body.quantity || 1)));
  const reasonCode = String(body.reason_code || "").trim();
  const reasonFree = String(body.reason_free || "").trim();
  const observations = String(body.observations || "").trim();
  const sanctionDate = String(body.sanction_date || "").trim() || new Date().toISOString();

  if (!/^[A-Z]{3}\d{3}$/.test(studentNigend.toUpperCase())) return json({ error: "Identifiant invalide." }, 400);
  if (!validType(sanctionType)) return json({ error: "Type de sanction invalide." }, 400);
  if (!reasonCode && !reasonFree) return json({ error: "Le motif est obligatoire." }, 400);

  const student = await db.prepare(`SELECT nigend FROM discipline_students WHERE nigend=? AND active=1`).bind(studentNigend).first();
  if (!student) return json({ error: "Élève introuvable ou inactif." }, 404);

  try {
    const result = await db.prepare(`
      INSERT INTO discipline_sanctions
      (student_nigend, sanction_type, quantity, reason_code, reason_free, observations, sanction_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(studentNigend, sanctionType, quantity, reasonCode, reasonFree, observations, sanctionDate, actor).run();
    const id = result.meta?.last_row_id;
    await db.prepare(`INSERT INTO discipline_audit_log (sanction_id, action, actor_username, new_data) VALUES (?, 'create', ?, ?)`)
      .bind(id, actor, JSON.stringify({ studentNigend, sanctionType, quantity, reasonCode, reasonFree, observations, sanctionDate })).run();
    return json({ success: true, id }, 201);
  } catch (error) {
    return json({ error: "La sanction n’a pas pu être enregistrée.", details: error.message }, 500);
  }
}
