import {
  auditNotation,
  ensureNotationSchema,
  notationJson,
  notationLevels,
  notationPermission
} from "../../_shared/notations.js";

const RESPONSIBILITIES = new Set(["", "tam", "popotier", "magasinier", "president", "tresorier", "secretaire"]);

async function currentPromotion(db) {
  try {
    const row = await db.prepare(`SELECT value FROM settings WHERE key='notation_current_promotion' LIMIT 1`).first();
    return row?.value || "";
  } catch {
    return "";
  }
}

async function totalEg(db) {
  try {
    const row = await db.prepare(`SELECT value FROM settings WHERE key='notation_total_eg' LIMIT 1`).first();
    return Number(row?.value || 0);
  } catch {
    return 0;
  }
}

async function incorporationDate(db) {
  try {
    const row = await db.prepare(`SELECT value FROM settings WHERE key='incorporation_date' LIMIT 1`).first();
    return row?.value || "";
  } catch {
    return "";
  }
}

async function studentForPermission(db, id, permission) {
  const student = await db.prepare(`
    SELECT * FROM notation_students
    WHERE id=? AND active=1
      AND promotion=(
        SELECT value FROM settings
        WHERE key='notation_current_promotion'
        LIMIT 1
      )
    LIMIT 1
  `).bind(id).first();

  if (!student) return null;
  if (!permission.isAdmin && student.peloton !== permission.scope) return null;
  return student;
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) return notationJson({ error: "Liaison D1 indisponible." }, 500);
  await ensureNotationSchema(db);

  const permission = await notationPermission(context);
  if (!permission) return notationJson({ error: "Accès cadre requis." }, 403);
  if (!permission.isAdmin && !permission.scope) {
    return notationJson({ error: "Aucun peloton de notation n’est attribué à votre compte." }, 403);
  }

  const url = new URL(context.request.url);
  const action = url.searchParams.get("action") || "bootstrap";

  try {
    if (action === "bootstrap") {
      const promotion = await currentPromotion(db);
      const count = await totalEg(db);
      const bindings = [promotion];
      let scopeSql = "";

      if (!permission.isAdmin) {
        scopeSql = " AND s.peloton=?";
        bindings.push(permission.scope);
      }

      const result = await db.prepare(`
        SELECT
          s.id, s.promotion, s.nom, s.prenom, s.grade, s.sexe,
          s.peloton, s.moyenne, s.classement,
          COALESCE(r.status, 'todo') AS status,
          COALESCE(LENGTH(r.literal), 0) AS literal_length,
          r.updated_by, r.updated_at,
          r.platoon_validated_by, r.platoon_validated_at,
          r.company_finalized_by, r.company_finalized_at
        FROM notation_students s
        LEFT JOIN notation_records r ON r.student_id=s.id
        WHERE s.active=1 AND s.promotion=?${scopeSql}
        ORDER BY s.peloton, s.classement, s.nom, s.prenom
      `).bind(...bindings).all();

      return notationJson({
        success: true,
        permission,
        promotion,
        incorporationDate: await incorporationDate(db),
        totalEg: count,
        students: result.results || []
      });
    }

    if (action === "student") {
      const id = Number(url.searchParams.get("id"));
      if (!Number.isInteger(id)) return notationJson({ error: "Élève invalide." }, 400);
      const student = await studentForPermission(db, id, permission);
      if (!student) return notationJson({ error: "Élève introuvable dans votre périmètre." }, 404);
      const record = await db.prepare(`SELECT * FROM notation_records WHERE student_id=? LIMIT 1`).bind(id).first();
      return notationJson({
        success: true,
        student,
        record: record || {
          student_id: id,
          integration_level: 3,
          robustness_level: 3,
          work_level: 3,
          results_level: 3,
          future_level: 3,
          responsibility: "",
          responsibility_level: 3,
          literal: "",
          status: "todo"
        },
        permission,
        totalEg: await totalEg(db)
      });
    }

    return notationJson({ error: "Action inconnue." }, 400);
  } catch (error) {
    return notationJson({
      error: "Impossible de charger les notations.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  if (!db) return notationJson({ error: "Liaison D1 indisponible." }, 500);
  await ensureNotationSchema(db);

  const permission = await notationPermission(context);
  if (!permission) return notationJson({ error: "Accès cadre requis." }, 403);
  if (!permission.isAdmin && !permission.scope) {
    return notationJson({ error: "Aucun peloton de notation n’est attribué à votre compte." }, 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return notationJson({ error: "Requête JSON invalide." }, 400);
  }

  const action = String(body.action || "save");
  if (!["save", "validate-platoon", "finalize-company"].includes(action)) {
    return notationJson({ error: "Action de notation inconnue." }, 400);
  }
  const studentId = Number(body.student_id);
  const student = await studentForPermission(db, studentId, permission);
  if (!student) return notationJson({ error: "Élève introuvable dans votre périmètre." }, 404);

  const levels = notationLevels(body);
  if (!levels) return notationJson({ error: "Les cinq niveaux doivent être compris entre 1 et 5." }, 400);
  const responsibility = String(body.responsibility || "").trim().toLowerCase();
  const responsibilityLevel = Number(body.responsibility_level || 3);
  if (!RESPONSIBILITIES.has(responsibility)) {
    return notationJson({ error: "La responsabilité sélectionnée est invalide." }, 400);
  }
  if (responsibility && (!Number.isInteger(responsibilityLevel) || responsibilityLevel < 1 || responsibilityLevel > 5)) {
    return notationJson({ error: "Le degré d’implication doit être compris entre 1 et 5." }, 400);
  }

  const literal = String(body.literal || "").trim();
  if (literal.length > 2000) return notationJson({ error: "Le littéral dépasse 2 000 caractères." }, 400);
  if (["validate-platoon", "finalize-company"].includes(action) && !literal) {
    return notationJson({ error: "Le littéral ne peut pas être vide lors de la validation." }, 400);
  }

  const previous = await db.prepare(`SELECT * FROM notation_records WHERE student_id=? LIMIT 1`).bind(studentId).first();
  const previousStatus = previous?.status || "todo";

  if (!permission.isAdmin && !["todo", "draft"].includes(previousStatus)) {
    return notationJson({ error: "Cette notation a déjà été transmise au commandant de compagnie." }, 409);
  }

  if (action === "finalize-company" && !permission.isAdmin) {
    return notationJson({ error: "Finalisation réservée aux administrateurs." }, 403);
  }

  let status = "draft";
  if (action === "validate-platoon") status = "platoon_validated";
  if (action === "finalize-company") status = "company_finalized";
  if (permission.isAdmin && action === "save" && ["platoon_validated", "company_finalized", "exported"].includes(previousStatus)) {
    status = previousStatus === "exported" ? "company_finalized" : previousStatus;
  }

  try {
    await db.prepare(`
      INSERT INTO notation_records (
        student_id, integration_level, robustness_level, work_level,
        results_level, future_level, responsibility, responsibility_level,
        literal, status,
        created_by, updated_by, updated_at,
        platoon_validated_by, platoon_validated_at,
        company_finalized_by, company_finalized_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
        CASE WHEN ?='platoon_validated' THEN ? ELSE NULL END,
        CASE WHEN ?='platoon_validated' THEN CURRENT_TIMESTAMP ELSE NULL END,
        CASE WHEN ?='company_finalized' THEN ? ELSE NULL END,
        CASE WHEN ?='company_finalized' THEN CURRENT_TIMESTAMP ELSE NULL END
      )
      ON CONFLICT(student_id) DO UPDATE SET
        integration_level=excluded.integration_level,
        robustness_level=excluded.robustness_level,
        work_level=excluded.work_level,
        results_level=excluded.results_level,
        future_level=excluded.future_level,
        responsibility=excluded.responsibility,
        responsibility_level=excluded.responsibility_level,
        literal=excluded.literal,
        status=excluded.status,
        updated_by=excluded.updated_by,
        updated_at=CURRENT_TIMESTAMP,
        platoon_validated_by=CASE
          WHEN excluded.status='platoon_validated' THEN excluded.platoon_validated_by
          ELSE notation_records.platoon_validated_by END,
        platoon_validated_at=CASE
          WHEN excluded.status='platoon_validated' THEN CURRENT_TIMESTAMP
          ELSE notation_records.platoon_validated_at END,
        company_finalized_by=CASE
          WHEN excluded.status='company_finalized' THEN excluded.company_finalized_by
          ELSE notation_records.company_finalized_by END,
        company_finalized_at=CASE
          WHEN excluded.status='company_finalized' THEN CURRENT_TIMESTAMP
          ELSE notation_records.company_finalized_at END
    `).bind(
      studentId,
      levels.integration,
      levels.robustness,
      levels.work,
      levels.results,
      levels.future,
      responsibility,
      responsibility ? responsibilityLevel : 3,
      literal,
      status,
      permission.username,
      permission.username,
      status,
      permission.username,
      status,
      status,
      permission.username,
      status
    ).run();

    const next = await db.prepare(`SELECT * FROM notation_records WHERE student_id=? LIMIT 1`).bind(studentId).first();
    await auditNotation(db, studentId, action, permission.username, previous, next);
    return notationJson({ success: true, record: next });
  } catch (error) {
    return notationJson({
      error: "La notation n’a pas pu être enregistrée.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
