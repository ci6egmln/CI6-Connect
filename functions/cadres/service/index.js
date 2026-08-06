import {
  SERVICE_TYPES,
  auditService,
  ensureServiceSchema,
  serviceJson,
  servicePermission
} from "../../_shared/service.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TARGET_PATTERN = /^(?:\d+|P[123])$/;
const VALID_CODES = new Set(SERVICE_TYPES.map(item => item.code));

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanText(value, max) {
  return String(value || "").trim().slice(0, max);
}

async function bootstrap(db, permission, start, end) {
  const peopleResult = await db.prepare(`
    SELECT id, username, grade, display_name, peloton, sort_order, active, sop_eligible
    FROM service_people
    WHERE active=1
    ORDER BY sort_order, display_name
  `).all();

  const entriesResult = await db.prepare(`
    SELECT id, target_type, target_key, service_date, slot, service_code,
           custom_label, notes, created_by, created_at, updated_by, updated_at
    FROM service_entries
    WHERE service_date BETWEEN ? AND ?
    ORDER BY service_date, target_type, target_key, slot
  `).bind(start, end).all();

  const peopleAdminResult = permission.isAdmin
    ? await db.prepare(`
        SELECT id, username, grade, display_name, peloton, sort_order, active, sop_eligible
        FROM service_people
        ORDER BY active DESC, sort_order, display_name
      `).all()
    : { results: [] };

  const recoveryResult = await db.prepare(`
    SELECT p.id AS person_id,
      ROUND(COALESCE(SUM(CASE WHEN l.amount > 0 THEN l.amount ELSE 0 END), 0), 2) AS credited,
      ROUND(ABS(COALESCE(SUM(CASE WHEN l.amount < 0 THEN l.amount ELSE 0 END), 0)), 2) AS taken,
      ROUND(COALESCE(SUM(l.amount), 0), 2) AS balance
    FROM service_people p
    LEFT JOIN service_recovery_ledger l ON l.person_id=p.id
    WHERE p.active=1
    GROUP BY p.id
  `).all();

  const sopResult = await db.prepare(`
    SELECT p.id AS person_id,
      SUM(CASE WHEN e.service_date < date('now') THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN e.service_date >= date('now') THEN 1 ELSE 0 END) AS planned,
      MAX(CASE WHEN e.service_date < date('now') THEN e.service_date ELSE NULL END) AS last_sop
    FROM service_people p
    LEFT JOIN service_entries e
      ON e.target_type='person' AND e.target_key=CAST(p.id AS TEXT) AND e.service_code='SOP'
    WHERE p.active=1
    GROUP BY p.id
  `).all();

  const permanenceResult = await db.prepare(`
    SELECT p.id AS person_id, COUNT(e.id) AS total
    FROM service_people p
    LEFT JOIN service_entries e
      ON e.target_type='person' AND e.target_key=CAST(p.id AS TEXT)
      AND e.service_code IN ('P','PTPH')
    WHERE p.active=1
    GROUP BY p.id
  `).all();

  return serviceJson({
    success: true,
    permission,
    period: { start, end },
    serviceTypes: SERVICE_TYPES,
    pelotons: ["P1", "P2", "P3"],
    people: peopleResult.results || [],
    peopleAdmin: peopleAdminResult.results || [],
    entries: entriesResult.results || [],
    recovery: recoveryResult.results || [],
    sop: sopResult.results || [],
    permanence: permanenceResult.results || []
  });
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  const permission = servicePermission(context);
  if (!db) return serviceJson({ error: "Liaison D1 indisponible." }, 500);
  if (!permission) return serviceJson({ error: "Accès cadre requis." }, 403);
  await ensureServiceSchema(db);

  const url = new URL(context.request.url);
  const action = url.searchParams.get("action") || "bootstrap";

  try {
    if (action === "bootstrap") {
      const start = url.searchParams.get("start") || "";
      const end = url.searchParams.get("end") || "";
      if (!validDate(start) || !validDate(end) || start > end) {
        return serviceJson({ error: "Période de planning invalide." }, 400);
      }
      const days = Math.round((new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) / 86400000);
      if (days > 570) return serviceJson({ error: "La période ne peut pas dépasser 18 mois." }, 400);
      return bootstrap(db, permission, start, end);
    }

    if (action === "recovery") {
      const personId = Number(url.searchParams.get("person_id"));
      if (!Number.isInteger(personId)) return serviceJson({ error: "Cadre invalide." }, 400);
      const person = await db.prepare(`SELECT id, grade, display_name FROM service_people WHERE id=? AND active=1`).bind(personId).first();
      if (!person) return serviceJson({ error: "Cadre introuvable." }, 404);
      const result = await db.prepare(`
        SELECT id, movement_date, amount, movement_type, reason, entry_id, created_by, created_at
        FROM service_recovery_ledger
        WHERE person_id=?
        ORDER BY movement_date DESC, id DESC
        LIMIT 500
      `).bind(personId).all();
      return serviceJson({ success: true, person, movements: result.results || [] });
    }

    return serviceJson({ error: "Action inconnue." }, 400);
  } catch (error) {
    return serviceJson({ error: "Impossible de charger le module Service.", details: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const permission = servicePermission(context);
  if (!db) return serviceJson({ error: "Liaison D1 indisponible." }, 500);
  if (!permission) return serviceJson({ error: "Accès cadre requis." }, 403);
  await ensureServiceSchema(db);

  let body;
  try { body = await context.request.json(); }
  catch { return serviceJson({ error: "Requête JSON invalide." }, 400); }
  const action = String(body.action || "");

  try {
    if (action === "set-entries") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length || items.length > 200) return serviceJson({ error: "Sélection vide ou trop importante." }, 400);
      const code = String(body.service_code || "").toUpperCase();
      if (!VALID_CODES.has(code)) return serviceJson({ error: "Type de service invalide." }, 400);
      const customLabel = cleanText(body.custom_label, 80);
      const notes = cleanText(body.notes, 500);
      const saved = [];

      for (const raw of items) {
        const targetType = raw.target_type === "peloton" ? "peloton" : "person";
        const targetKey = String(raw.target_key || "");
        const date = String(raw.service_date || "");
        const slot = raw.slot === "N" ? "N" : "M";
        if (!TARGET_PATTERN.test(targetKey) || !validDate(date)) return serviceJson({ error: "Une case sélectionnée est invalide." }, 400);
        if (targetType === "peloton" && !["P1", "P2", "P3"].includes(targetKey)) return serviceJson({ error: "Peloton invalide." }, 400);
        if (targetType === "person") {
          const person = await db.prepare(`SELECT id FROM service_people WHERE id=? AND active=1`).bind(Number(targetKey)).first();
          if (!person) return serviceJson({ error: "Un cadre sélectionné est introuvable." }, 404);
        }

        const previous = await db.prepare(`
          SELECT * FROM service_entries
          WHERE target_type=? AND target_key=? AND service_date=? AND slot=?
          LIMIT 1
        `).bind(targetType, targetKey, date, slot).first();

        if ((raw.expected_empty === true && previous) || (raw.expected_updated_at && previous?.updated_at !== raw.expected_updated_at)) {
          return serviceJson({ error: `La case du ${date} a été modifiée par un autre cadre. Le planning va être actualisé.` }, 409);
        }

        const result = await db.prepare(`
          INSERT INTO service_entries
            (target_type, target_key, service_date, slot, service_code, custom_label, notes, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(target_type, target_key, service_date, slot) DO UPDATE SET
            service_code=excluded.service_code,
            custom_label=excluded.custom_label,
            notes=excluded.notes,
            updated_by=excluded.updated_by,
            updated_at=CURRENT_TIMESTAMP
        `).bind(targetType, targetKey, date, slot, code, customLabel, notes, permission.username, permission.username).run();

        const current = await db.prepare(`
          SELECT * FROM service_entries
          WHERE target_type=? AND target_key=? AND service_date=? AND slot=? LIMIT 1
        `).bind(targetType, targetKey, date, slot).first();
        await auditService(db, previous ? "update" : "create", current?.id || result.meta?.last_row_id, permission.username, previous, current);
        saved.push(current);
      }
      return serviceJson({ success: true, entries: saved });
    }

    if (action === "recovery-from-entries") {
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))];
      if (!ids.length || ids.length > 200) return serviceJson({ error: "Cases de repos invalides." }, 400);
      let created = 0;
      for (const id of ids) {
        const entry = await db.prepare(`
          SELECT id, target_key, service_date, slot, service_code
          FROM service_entries
          WHERE id=? AND target_type='person' AND service_code IN ('RR','RPC')
          LIMIT 1
        `).bind(id).first();
        if (!entry) continue;
        const existing = await db.prepare(`SELECT id FROM service_recovery_ledger WHERE entry_id=? LIMIT 1`).bind(id).first();
        if (existing) continue;
        const type = entry.service_code === "RR" ? "Repos récupérateur" : "Repos post-cérémonie";
        await db.prepare(`
          INSERT INTO service_recovery_ledger
            (person_id, movement_date, amount, movement_type, reason, entry_id, created_by)
          VALUES (?, ?, -0.5, 'debit', ?, ?, ?)
        `).bind(Number(entry.target_key), entry.service_date, `${type} — ${entry.slot === "M" ? "matin" : "nuit"}`, id, permission.username).run();
        created += 1;
      }
      return serviceJson({ success: true, created });
    }

    if (action === "delete-entries") {
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))];
      if (!ids.length || ids.length > 200) return serviceJson({ error: "Sélection à supprimer invalide." }, 400);
      for (const id of ids) {
        const previous = await db.prepare(`SELECT * FROM service_entries WHERE id=? LIMIT 1`).bind(id).first();
        if (!previous) continue;
        await db.prepare(`DELETE FROM service_entries WHERE id=?`).bind(id).run();
        await auditService(db, "delete", id, permission.username, previous, null);
      }
      return serviceJson({ success: true });
    }

    if (action === "recovery-movement") {
      const personId = Number(body.person_id);
      const movementType = ["credit", "debit", "adjustment"].includes(body.movement_type) ? body.movement_type : "";
      const rawAmount = Math.abs(Number(body.amount));
      const date = String(body.movement_date || "");
      const reason = cleanText(body.reason, 250);
      if (!Number.isInteger(personId) || !movementType || !validDate(date) || !reason || !Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 100) {
        return serviceJson({ error: "Mouvement de repos incomplet ou invalide." }, 400);
      }
      const person = await db.prepare(`SELECT id FROM service_people WHERE id=? AND active=1`).bind(personId).first();
      if (!person) return serviceJson({ error: "Cadre introuvable." }, 404);
      const amount = movementType === "debit" ? -rawAmount : rawAmount;
      const result = await db.prepare(`
        INSERT INTO service_recovery_ledger
          (person_id, movement_date, amount, movement_type, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(personId, date, amount, movementType, reason, permission.username).run();
      await auditService(db, "recovery-movement", null, permission.username, null, { id: result.meta?.last_row_id, personId, date, amount, movementType, reason });
      return serviceJson({ success: true, id: result.meta?.last_row_id });
    }

    if (action === "save-person") {
      if (!permission.isAdmin) return serviceJson({ error: "Paramétrage réservé aux administrateurs." }, 403);
      const id = Number(body.id || 0);
      const grade = cleanText(body.grade, 30);
      const displayName = cleanText(body.display_name, 120);
      const peloton = cleanText(body.peloton, 10).toUpperCase();
      const sortOrder = Math.max(0, Math.min(9999, Number(body.sort_order || 100)));
      const active = body.active === false ? 0 : 1;
      const sopEligible = body.sop_eligible === false ? 0 : 1;
      if (!displayName) return serviceJson({ error: "Le nom du cadre est obligatoire." }, 400);
      if (peloton && !["P1", "P2", "P3"].includes(peloton)) return serviceJson({ error: "Peloton invalide." }, 400);
      if (id) {
        await db.prepare(`
          UPDATE service_people SET grade=?, display_name=?, peloton=?, sort_order=?, active=?, sop_eligible=?, updated_at=CURRENT_TIMESTAMP
          WHERE id=?
        `).bind(grade, displayName, peloton, sortOrder, active, sopEligible, id).run();
        return serviceJson({ success: true, id });
      }
      const result = await db.prepare(`
        INSERT INTO service_people (grade, display_name, peloton, sort_order, active, sop_eligible)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(grade, displayName, peloton, sortOrder, active, sopEligible).run();
      return serviceJson({ success: true, id: result.meta?.last_row_id }, 201);
    }

    return serviceJson({ error: "Action inconnue." }, 400);
  } catch (error) {
    return serviceJson({ error: "La modification n’a pas pu être enregistrée.", details: error.message }, 500);
  }
}
