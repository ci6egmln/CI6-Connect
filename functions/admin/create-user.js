import {
  IDENTIFIER_PATTERN,
  generateUniqueIdentifier
} from "../_shared/identifiers.js";

const encoder = new TextEncoder();
const ITERATIONS = 100000;

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function hashPassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    keyMaterial, 256
  );
  return bytesToBase64(new Uint8Array(derivedBits));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function ensureDisciplineSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS discipline_students (
      nigend TEXT PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT,
      peloton TEXT NOT NULL DEFAULT '', promotion TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS discipline_sanctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_nigend TEXT NOT NULL, sanction_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1, reason_code TEXT,
      reason_free TEXT, observations TEXT,
      sanction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT, updated_at TEXT, deleted_at TEXT, deleted_by TEXT,
      FOREIGN KEY(student_nigend) REFERENCES discipline_students(nigend)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS discipline_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sanction_id INTEGER,
      action TEXT NOT NULL, actor_username TEXT NOT NULL,
      previous_data TEXT, new_data TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);
}

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) return jsonResponse({ error: "Liaison D1 DB absente." }, 500);
    const body = await context.request.json();
    const nom = String(body.nom || "").trim();
    const prenom = String(body.prenom || "").trim();
    const peloton = String(body.peloton || "").trim();
    const promotion = String(body.promotion || "").trim();
    const password = String(body.password || "");
    const requestedRole = String(body.role || "").trim();
    const role = ["eleve", "cadre", "cdu", "visiteur"].includes(requestedRole) ? requestedRole : "eleve";

    if (!nom || nom.length > 120) return jsonResponse({ error: "Le nom est obligatoire et limité à 120 caractères." }, 400);
    if (prenom.length > 120) return jsonResponse({ error: "Le prénom est limité à 120 caractères." }, 400);
    if (role === "eleve" && !peloton) return jsonResponse({ error: "Le peloton est obligatoire pour un élève." }, 400);
    if (password.length < 12) return jsonResponse({ error: "Le mot de passe doit contenir au moins 12 caractères." }, 400);

    await ensureDisciplineSchema(context.env.DB);
    const displayName = [nom, prenom].filter(Boolean).join(" ");
    const username = await generateUniqueIdentifier(
      context.env.DB,
      role,
      nom
    );
    if (!IDENTIFIER_PATTERN.test(username)) throw new Error("Identifiant généré invalide.");

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await hashPassword(password, salt);
    const statements = [
      context.env.DB.prepare(`
        INSERT INTO users (
          username, nom, password_hash, password_salt,
          active, role, must_change_password, session_version
        ) VALUES (?, ?, ?, ?, 1, ?, 1, 1)
      `).bind(username, displayName, passwordHash, bytesToBase64(salt), role)
    ];

    if (role === "eleve") {
      statements.push(context.env.DB.prepare(`
        INSERT INTO discipline_students
          (nigend, nom, prenom, peloton, promotion, active, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(nigend) DO UPDATE SET
          nom=excluded.nom, prenom=excluded.prenom,
          peloton=excluded.peloton, promotion=excluded.promotion,
          active=1, updated_at=CURRENT_TIMESTAMP
      `).bind(username, nom, prenom, peloton, promotion));
    }

    await context.env.DB.batch(statements);
    return jsonResponse({
      success: true, username, nom, prenom, peloton, promotion,
      displayName, role, must_change_password: true
    }, 201);
  } catch (error) {
    return jsonResponse({
      error: "Erreur interne lors de la création.",
      details: error && error.message ? error.message : String(error)
    }, 500);
  }
}
