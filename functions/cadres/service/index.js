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
const ACTIVITY_COLORS = new Set(["#f2c230", "#2489c5", "#78864b", "#c63f4d", "#36a45c", "#ffffff", "#a145e8", "#ff8a1f"]);

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanText(value, max) {
  return String(value || "").trim().slice(0, max);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addIsoDays(value, amount) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function mondayIso(value) {
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 1 - day);
  return date.toISOString().slice(0, 10);
}

async function getServiceCompletedThrough(db) {
  const setting = await db.prepare(`
    SELECT setting_value FROM service_settings WHERE setting_key='service_completed_through' LIMIT 1
  `).first();
  return validDate(setting?.setting_value || "") ? setting.setting_value : "";
}

async function removeAutoWeeklyRestCreditsAfter(db, permission, completedThrough) {
  const result = await db.prepare(`
    SELECT id, person_id, movement_date, period_end, amount, movement_group, comment
    FROM service_recovery_ledger
    WHERE movement_group LIKE 'auto-weekly-rest:%'
  `).all();
  let removed = 0;
  for (const row of result.results || []) {
    const match = String(row.movement_group || '').match(/^auto-weekly-rest:(\d{4}-\d{2}-\d{2}):/);
    if (!match) continue;
    const weekEnd = addIsoDays(match[1], 6);
    if (weekEnd <= completedThrough) continue;
    await db.prepare(`DELETE FROM service_recovery_ledger WHERE id=?`).bind(row.id).run();
    await auditService(db, 'weekly-rest-auto-credit-cutoff-remove', null, "SYSTEME", row, {
      completedThrough,
      reason: "La date de service établi a été reculée avant cette semaine.",
      triggeredBy: permission.username
    });
    removed += 1;
  }
  return removed;
}

async function syncMissingWeeklyRestCredits(db, permission, start, end) {
  const completedThrough = await getServiceCompletedThrough(db);
  if (!completedThrough) return { created: 0, updated: 0, removed: 0 };

  let weekStart = mondayIso(start);
  const lastWeekStart = mondayIso(end < completedThrough ? end : completedThrough);
  const peopleResult = await db.prepare(`SELECT id FROM service_people WHERE active=1 ORDER BY id`).all();
  const people = (peopleResult.results || []).map(row => Number(row.id)).filter(Number.isInteger);
  if (!people.length) return { created: 0, updated: 0, removed: 0 };

  let created = 0;
  let updated = 0;
  let removed = 0;
  while (weekStart <= lastWeekStart) {
    const saturday = addIsoDays(weekStart, 5);
    const sunday = addIsoDays(weekStart, 6);
    const weekEnd = sunday;
    // Une semaine n'est régularisée que lorsque le CDU a indiqué que le service
    // est établi au moins jusqu'au dimanche de cette semaine.
    if (weekEnd <= completedThrough) {
      const restsResult = await db.prepare(`
        SELECT CAST(target_key AS INTEGER) AS person_id, service_date
        FROM service_entries
        WHERE target_type='person'
          AND service_code IN ('R','PERM_POSEE','PERM_VALIDEE')
          AND service_date BETWEEN ? AND ?
        GROUP BY target_key, service_date
      `).bind(weekStart, weekEnd).all();
      const restDatesByPerson = new Map();
      for (const row of restsResult.results || []) {
        const personId = Number(row.person_id);
        if (!restDatesByPerson.has(personId)) restDatesByPerson.set(personId, new Set());
        restDatesByPerson.get(personId).add(row.service_date);
      }

      const autoResult = await db.prepare(`
        SELECT id, person_id, movement_date, period_end, amount, movement_group, comment
        FROM service_recovery_ledger
        WHERE movement_group LIKE ?
      `).bind(`auto-weekly-rest:${weekStart}:%`).all();
      const autoByPerson = new Map((autoResult.results || []).map(row => [Number(row.person_id), row]));

      for (const personId of people) {
        const restDates = restDatesByPerson.get(personId) || new Set();
        const restDays = Math.min(2, restDates.size);
        const missingDays = 2 - restDays;
        const existing = autoByPerson.get(personId);
        const movementGroup = `auto-weekly-rest:${weekStart}:${personId}`;

        let movementDate = saturday;
        let periodEnd = sunday;
        if (missingDays === 1) {
          // Si samedi est déjà en repos, le jour manquant est dimanche.
          // Si dimanche est déjà en repos, le jour manquant est samedi.
          // Si l'unique repos a été pris du lundi au vendredi, par principe
          // le repos manquant est positionné au dimanche.
          movementDate = restDates.has(saturday) && !restDates.has(sunday) ? sunday
            : restDates.has(sunday) && !restDates.has(saturday) ? saturday
            : sunday;
          periodEnd = movementDate;
        }
        const comment = missingDays === 2
          ? `Crédit automatique : 2 jours de repos manquants pour la semaine du ${weekStart} au ${weekEnd}. Repos manquants positionnés samedi et dimanche.`
          : `Crédit automatique : 1 jour de repos manquant pour la semaine du ${weekStart} au ${weekEnd}. Jour manquant positionné le ${movementDate}.`;

        if (missingDays > 0 && !existing) {
          const result = await db.prepare(`
            INSERT INTO service_recovery_ledger
              (person_id, movement_date, period_end, amount, movement_type, reason, comment, movement_group, created_by)
            VALUES (?, ?, ?, ?, 'credit', 'Repos hebdomadaires manquants', ?, ?, ?)
          `).bind(personId, movementDate, periodEnd, missingDays, comment, movementGroup, "SYSTEME").run();
          await auditService(db, 'weekly-rest-auto-credit', null, "SYSTEME", null, {
            id: result.meta?.last_row_id, personId, weekStart, weekEnd, movementDate, periodEnd,
            amount: missingDays, restDays, completedThrough, triggeredBy: permission.username
          });
          created += 1;
        } else if (missingDays > 0 && existing && (
          Number(existing.amount) !== missingDays || existing.movement_date !== movementDate || existing.period_end !== periodEnd
        )) {
          const before = { ...existing };
          await db.prepare(`
            UPDATE service_recovery_ledger
            SET movement_date=?, period_end=?, amount=?, movement_type='credit', reason='Repos hebdomadaires manquants', comment=?
            WHERE id=?
          `).bind(movementDate, periodEnd, missingDays, comment, existing.id).run();
          await auditService(db, 'weekly-rest-auto-credit-update', null, "SYSTEME", before, {
            ...before, movement_date: movementDate, period_end: periodEnd, amount: missingDays,
            comment, restDays, completedThrough, triggeredBy: permission.username
          });
          updated += 1;
        } else if (missingDays === 0 && existing) {
          await db.prepare(`DELETE FROM service_recovery_ledger WHERE id=?`).bind(existing.id).run();
          await auditService(db, 'weekly-rest-auto-credit-remove', null, "SYSTEME", existing, {
            personId, weekStart, weekEnd,
            reason: 'Deux jours de repos R/permission sont désormais présents dans la semaine.',
            completedThrough, triggeredBy: permission.username
          });
          removed += 1;
        }
      }
    }
    weekStart = addIsoDays(weekStart, 7);
  }
  return { created, updated, removed };
}

async function linkedLedger(db, entryId) {
  return db.prepare(`
    SELECT id, person_id, movement_date, period_end, amount, movement_type, reason, comment, movement_group
    FROM service_recovery_ledger
    WHERE entry_id=?
    LIMIT 1
  `).bind(entryId).first();
}

async function reverseLinkedMovement(db, entry, permission, comment = "", reversalGroup = crypto.randomUUID()) {
  const linked = await linkedLedger(db, entry.id);
  if (!linked || Number(linked.amount) === 0) return false;
  const amount = -Number(linked.amount);
  const movementType = amount > 0 ? "credit" : "debit";
  const label = entry.service_code === "RR" ? "repos"
    : entry.service_code === "RPC" ? "RPC"
    : entry.service_code === "P" ? "permanence"
    : "mouvement";
  await db.prepare(`
    INSERT INTO service_recovery_ledger
      (person_id, movement_date, period_end, amount, movement_type, reason, comment, movement_group, reversal_of, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    Number(linked.person_id), linked.movement_date, linked.period_end || linked.movement_date, amount, movementType,
    `Annulation ${label}`, cleanText(comment, 500), reversalGroup, linked.id, permission.username
  ).run();
  // Détache l'ancien mouvement de la case : si la même case reçoit plus tard
  // un nouveau RR/P, elle pourra créer un nouveau mouvement lié sans heurter l'index UNIQUE.
  await db.prepare(`UPDATE service_recovery_ledger SET entry_id=NULL WHERE id=?`).bind(linked.id).run();
  return true;
}

async function permanenceCreditCandidate(db, entry) {
  if (!entry || entry.target_type !== "person" || entry.service_code !== "P") return false;

  // Une permanence couvrant matin + nuit le même jour est une permanence « journée ».
  // Elle n'ouvre droit à aucun crédit de repos : à ce stade de la formation,
  // le cadre n'est plus maintenu sur place à la compagnie pendant toute la journée.
  const oppositeSlot = entry.slot === "M" ? "N" : "M";
  const fullDayPermanence = await db.prepare(`
    SELECT id FROM service_entries
    WHERE target_type='person' AND target_key=? AND service_date=? AND slot=? AND service_code='P'
    LIMIT 1
  `).bind(entry.target_key, entry.service_date, oppositeSlot).first();
  if (fullDayPermanence) return false;

  const existing = await linkedLedger(db, entry.id);
  if (existing) return false;
  if (entry.slot === "M") {
    const rpj = await db.prepare(`
      SELECT id FROM service_entries
      WHERE target_type='person' AND target_key=? AND service_date=? AND slot='N' AND service_code='RPJ'
      LIMIT 1
    `).bind(entry.target_key, entry.service_date).first();
    return !rpj;
  }
  const nextDate = addIsoDays(entry.service_date, 1);
  const rpj = await db.prepare(`
    SELECT id FROM service_entries
    WHERE target_type='person' AND target_key=? AND service_date=? AND slot='M' AND service_code='RPJ'
    LIMIT 1
  `).bind(entry.target_key, nextDate).first();
  return !rpj;
}

async function affectedPermanenceForRpj(db, entry) {
  if (!entry || entry.target_type !== "person" || entry.service_code !== "RPJ") return [];
  const result = [];
  if (entry.slot === "N") {
    const sameDayMorning = await db.prepare(`
      SELECT * FROM service_entries
      WHERE target_type='person' AND target_key=? AND service_date=? AND slot='M' AND service_code='P' LIMIT 1
    `).bind(entry.target_key, entry.service_date).first();
    if (sameDayMorning) result.push(sameDayMorning);
  }
  if (entry.slot === "M") {
    const previousDate = addIsoDays(entry.service_date, -1);
    const previousNight = await db.prepare(`
      SELECT * FROM service_entries
      WHERE target_type='person' AND target_key=? AND service_date=? AND slot='N' AND service_code='P' LIMIT 1
    `).bind(entry.target_key, previousDate).first();
    if (previousNight) result.push(previousNight);
  }
  return result;
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
           custom_label, custom_color, group_id, notes,
           created_by, created_at, updated_by, updated_at
    FROM service_entries
    WHERE service_date BETWEEN ? AND ?
    ORDER BY service_date, target_type, target_key, slot
  `).bind(start, end).all();

  const peopleAdminResult = permission.isCdu
    ? await db.prepare(`
        SELECT id, username, grade, display_name, peloton, sort_order, active, sop_eligible
        FROM service_people
        ORDER BY active DESC, sort_order, display_name
      `).all()
    : { results: [] };

  // Les repos hebdomadaires manquants ne sont régularisés que jusqu'à la date
  // de service arrêté par le CDU. Sans cette date, aucun crédit automatique.
  await syncMissingWeeklyRestCredits(db, permission, start, end);

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

  // Équité SOP : les années visibles sont choisies manuellement par l'administrateur.
  // À la première utilisation, on initialise simplement année précédente / année courante / année suivante.
  const currentYear = new Date().getUTCFullYear();
  const defaultSopYears = [currentYear - 1, currentYear, currentYear + 1];
  const sopSetting = await db.prepare(`
    SELECT setting_value FROM service_settings WHERE setting_key='sop_years' LIMIT 1
  `).first();
  let sopYears = defaultSopYears;
  if (sopSetting?.setting_value) {
    try {
      const parsed = JSON.parse(sopSetting.setting_value);
      if (Array.isArray(parsed)) {
        const valid = [...new Set(parsed.map(Number).filter(year => Number.isInteger(year) && year >= 2000 && year <= 2100))].sort((a, b) => a - b);
        if (valid.length) sopYears = valid.slice(0, 8);
      }
    } catch {}
  } else {
    await db.prepare(`
      INSERT OR IGNORE INTO service_settings (setting_key, setting_value, updated_by) VALUES ('sop_years', ?, ?)
    `).bind(JSON.stringify(defaultSopYears), permission.username).run();
  }

  const sopResult = await db.prepare(`
    SELECT p.id AS person_id
    FROM service_people p
    WHERE p.active=1
    ORDER BY p.sort_order, p.display_name
  `).all();

  const sopStart = `${Math.min(...sopYears)}-01-01`;
  const sopEnd = `${Math.max(...sopYears)}-12-31`;
  const sopDatesResult = await db.prepare(`
    SELECT CAST(target_key AS INTEGER) AS person_id, service_date, slot
    FROM service_entries
    WHERE target_type='person'
      AND service_code='SOP'
      AND service_date BETWEEN ? AND ?
    ORDER BY service_date, slot
  `).bind(sopStart, sopEnd).all();

  const sopDatesByPerson = new Map();
  for (const item of sopDatesResult.results || []) {
    const personId = Number(item.person_id);
    if (!sopDatesByPerson.has(personId)) sopDatesByPerson.set(personId, { completed_dates: [] });
    sopDatesByPerson.get(personId).completed_dates.push({ date: item.service_date, slot: item.slot });
  }

  const sopRows = (sopResult.results || []).map(item => ({
    ...item,
    ...(sopDatesByPerson.get(Number(item.person_id)) || { completed_dates: [] })
  }));

  const serviceCompletedThrough = await getServiceCompletedThrough(db);

  // Le compteur P peut être remis à zéro à chaque nouvelle promotion sans supprimer l'historique.
  const permanenceStartSetting = await db.prepare(`
    SELECT setting_value FROM service_settings WHERE setting_key='permanence_count_start' LIMIT 1
  `).first();
  const permanenceCountStart = validDate(permanenceStartSetting?.setting_value || "")
    ? permanenceStartSetting.setting_value
    : "";
  const permanenceQueryStart = permanenceCountStart || "1900-01-01";

  const permanenceResult = await db.prepare(`
    SELECT p.id AS person_id, COUNT(e.id) AS total
    FROM service_people p
    LEFT JOIN service_entries e
      ON e.target_type='person' AND e.target_key=CAST(p.id AS TEXT)
      AND e.service_code IN ('P','PTPH')
      AND e.service_date >= ?
    WHERE p.active=1
    GROUP BY p.id
  `).bind(permanenceQueryStart).all();

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
    sop: sopRows,
    sopYears,
    serviceCompletedThrough,
    permanenceCountStart,
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
        SELECT l.id, l.movement_date, l.period_end, l.amount, l.movement_type, l.reason, l.comment,
               l.movement_group, l.reversal_of, l.entry_id, l.created_by, l.created_at,
               COALESCE(src.movement_date, l.movement_date) AS effective_start,
               COALESCE(src.period_end, src.movement_date, l.period_end, l.movement_date) AS effective_end,
               CASE
                 WHEN l.reversal_of IS NOT NULL THEN 'reversal:' || COALESCE(NULLIF(src.movement_group, ''), CAST(l.reversal_of AS TEXT))
                 ELSE 'movement:' || COALESCE(NULLIF(l.movement_group, ''), CAST(l.id AS TEXT))
               END AS display_group
        FROM service_recovery_ledger l
        LEFT JOIN service_recovery_ledger src ON src.id=l.reversal_of
        WHERE l.person_id=?
        ORDER BY l.created_at DESC, l.id DESC
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

    if (action === "save-service-completed-through") {
      if (!permission.isCdu) return serviceJson({ error: "Seul le CDU peut modifier la date jusqu'à laquelle le service est considéré comme établi." }, 403);
      const completedThrough = String(body.completed_through || "");
      if (!validDate(completedThrough)) return serviceJson({ error: "Date de service établi invalide." }, 400);
      const previous = await db.prepare(`SELECT setting_value FROM service_settings WHERE setting_key='service_completed_through' LIMIT 1`).first();
      await db.prepare(`
        INSERT INTO service_settings (setting_key, setting_value, updated_by, updated_at)
        VALUES ('service_completed_through', ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value=excluded.setting_value, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP
      `).bind(completedThrough, permission.username).run();
      await auditService(db, "service-completed-through", null, permission.username,
        previous ? { completed_through: previous.setting_value } : null, { completed_through: completedThrough });

      const removedAfterCutoff = await removeAutoWeeklyRestCreditsAfter(db, permission, completedThrough);
      const permanenceStart = await db.prepare(`SELECT setting_value FROM service_settings WHERE setting_key='permanence_count_start' LIMIT 1`).first();
      const earliest = await db.prepare(`SELECT MIN(service_date) AS min_date FROM service_entries WHERE target_type='person'`).first();
      const syncStart = validDate(permanenceStart?.setting_value || "")
        ? permanenceStart.setting_value
        : (validDate(earliest?.min_date || "") ? earliest.min_date : "");
      const sync = syncStart ? await syncMissingWeeklyRestCredits(db, permission, syncStart, completedThrough) : { created: 0, updated: 0, removed: 0 };
      return serviceJson({ success: true, completed_through: completedThrough, sync: { ...sync, removed_after_cutoff: removedAfterCutoff } });
    }

    if (action === "save-permanence-count-start") {
      if (!permission.isCdu) return serviceJson({ error: "Seul le CDU peut modifier la date de comptage des permanences." }, 403);
      const startDate = String(body.start_date || "");
      if (!validDate(startDate)) return serviceJson({ error: "Date de début de comptage invalide." }, 400);
      const previous = await db.prepare(`SELECT setting_value FROM service_settings WHERE setting_key='permanence_count_start' LIMIT 1`).first();
      await db.prepare(`
        INSERT INTO service_settings (setting_key, setting_value, updated_by, updated_at)
        VALUES ('permanence_count_start', ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value=excluded.setting_value, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP
      `).bind(startDate, permission.username).run();
      await auditService(db, "permanence-count-start", null, permission.username,
        previous ? { start_date: previous.setting_value } : null, { start_date: startDate });
      return serviceJson({ success: true, start_date: startDate });
    }

    if (action === "save-sop-years") {
      if (!permission.isCdu) return serviceJson({ error: "Seul le CDU peut modifier les années de l'équité SOP." }, 403);
      const years = [...new Set((Array.isArray(body.years) ? body.years : []).map(Number)
        .filter(year => Number.isInteger(year) && year >= 2000 && year <= 2100))]
        .sort((a, b) => a - b);
      if (!years.length) return serviceJson({ error: "Conservez au moins une année." }, 400);
      if (years.length > 8) return serviceJson({ error: "Huit années maximum peuvent être affichées." }, 400);
      const previous = await db.prepare(`SELECT setting_value FROM service_settings WHERE setting_key='sop_years' LIMIT 1`).first();
      await db.prepare(`
        INSERT INTO service_settings (setting_key, setting_value, updated_by, updated_at)
        VALUES ('sop_years', ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value=excluded.setting_value, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP
      `).bind(JSON.stringify(years), permission.username).run();
      await auditService(db, "sop-years", null, permission.username, previous ? { years: previous.setting_value } : null, { years });
      return serviceJson({ success: true, years });
    }

    if (action === "update-entry-details") {
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(Number).filter(Number.isInteger))] : [];
      if (!ids.length || ids.length > 200) return serviceJson({ error: "Sélection vide ou trop importante." }, 400);
      const customLabel = cleanText(body.custom_label, 80);
      const notes = cleanText(body.notes, 500);
      const requestedColor = body.custom_color == null ? null : String(body.custom_color || "").toLowerCase();
      if (requestedColor !== null && requestedColor !== "" && !ACTIVITY_COLORS.has(requestedColor)) {
        return serviceJson({ error: "Couleur personnalisée invalide." }, 400);
      }
      const saved = [];
      for (const id of ids) {
        const previous = await db.prepare(`SELECT * FROM service_entries WHERE id=? LIMIT 1`).bind(id).first();
        if (!previous) return serviceJson({ error: "Une case sélectionnée est introuvable." }, 404);
        if (previous.service_date < todayIso() && !permission.isCdu) {
          return serviceJson({ error: "Seul le CDU peut modifier le planning d’un jour passé." }, 403);
        }
        if (requestedColor === null) {
          await db.prepare(`
            UPDATE service_entries
            SET custom_label=?, notes=?, updated_by=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
          `).bind(customLabel, notes, permission.username, id).run();
        } else {
          await db.prepare(`
            UPDATE service_entries
            SET custom_label=?, notes=?, custom_color=?, updated_by=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
          `).bind(customLabel, notes, requestedColor, permission.username, id).run();
        }
        const current = await db.prepare(`SELECT * FROM service_entries WHERE id=? LIMIT 1`).bind(id).first();
        await auditService(db, "update-details", id, permission.username, previous, current);
        saved.push(current);
      }
      return serviceJson({ success: true, entries: saved });
    }

    if (action === "set-entries") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length || items.length > 200) return serviceJson({ error: "Sélection vide ou trop importante." }, 400);
      if (!permission.isCdu && items.some(item => validDate(String(item.service_date || "")) && String(item.service_date) < todayIso())) {
        return serviceJson({ error: "Seul le CDU peut modifier le planning d’un jour passé." }, 403);
      }
      const code = String(body.service_code || "").toUpperCase();
      if (!VALID_CODES.has(code)) return serviceJson({ error: "Type de service invalide." }, 400);
      const customLabel = cleanText(body.custom_label, 80);
      const notes = cleanText(body.notes, 500);
      const merge = body.merge === true;
      const customColor = ACTIVITY_COLORS.has(String(body.custom_color || "").toLowerCase())
        ? String(body.custom_color).toLowerCase()
        : "";
      const customActivity = body.activity === true || Boolean(customColor);
      if (customActivity && !customLabel) return serviceJson({ error: "Le libellé de l’activité est obligatoire." }, 400);
      if (customActivity && !customColor) return serviceJson({ error: "Choisissez une couleur pour l’activité." }, 400);
      const groupId = merge ? crypto.randomUUID() : "";
      const removalReason = cleanText(body.removal_reason, 500);
      const saved = [];
      const permanenceCreditCandidates = [];
      const reversalGroup = crypto.randomUUID();

      for (const raw of items) {
        const targetType = raw.target_type === "peloton" ? "peloton" : "person";
        const targetKey = String(raw.target_key || "");
        const date = String(raw.service_date || "");
        const slot = raw.slot === "N" ? "N" : "M";
        if (!TARGET_PATTERN.test(targetKey) || !validDate(date)) return serviceJson({ error: "Une case sélectionnée est invalide." }, 400);
        if (date < todayIso() && !permission.isCdu) {
          return serviceJson({ error: "Seul le CDU peut modifier le planning d’un jour passé." }, 403);
        }
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

        if (previous && previous.service_code !== code) {
          if (["RR", "RPC"].includes(previous.service_code) && !removalReason) {
            return serviceJson({ error: "Indiquez le motif du retrait du repos avant de remplacer cette case." }, 400);
          }
          await reverseLinkedMovement(db, previous, permission, removalReason, reversalGroup);
        }

        const result = await db.prepare(`
          INSERT INTO service_entries
            (target_type, target_key, service_date, slot, service_code, custom_label, custom_color, group_id, notes, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(target_type, target_key, service_date, slot) DO UPDATE SET
            service_code=excluded.service_code,
            custom_label=excluded.custom_label,
            custom_color=excluded.custom_color,
            group_id=excluded.group_id,
            notes=excluded.notes,
            updated_by=excluded.updated_by,
            updated_at=CURRENT_TIMESTAMP
        `).bind(targetType, targetKey, date, slot, code, customLabel, customColor, groupId, notes, permission.username, permission.username).run();

        const current = await db.prepare(`
          SELECT * FROM service_entries
          WHERE target_type=? AND target_key=? AND service_date=? AND slot=? LIMIT 1
        `).bind(targetType, targetKey, date, slot).first();
        await auditService(db, previous ? "update" : "create", current?.id || result.meta?.last_row_id, permission.username, previous, current);
        saved.push(current);

        if (current?.service_code === "RPJ") {
          const permanences = await affectedPermanenceForRpj(db, current);
          for (const permanence of permanences) {
            const linked = await linkedLedger(db, permanence.id);
            if (linked && Number(linked.amount) > 0) {
              await reverseLinkedMovement(db, permanence, permission, "RPJ accordé après la permanence");
            }
          }
        }

        // Si l'ajout de ce P transforme une demi-journée en permanence journée,
        // annuler tout +0,5 qui aurait été accordé auparavant à l'une des deux cases.
        if (current?.target_type === "person" && current?.service_code === "P") {
          const oppositeSlot = current.slot === "M" ? "N" : "M";
          const oppositeP = await db.prepare(`
            SELECT * FROM service_entries
            WHERE target_type='person' AND target_key=? AND service_date=? AND slot=? AND service_code='P'
            LIMIT 1
          `).bind(current.target_key, current.service_date, oppositeSlot).first();
          if (oppositeP) {
            for (const permanence of [current, oppositeP]) {
              const linked = await linkedLedger(db, permanence.id);
              if (linked && Number(linked.amount) > 0) {
                await reverseLinkedMovement(db, permanence, permission, "Permanence journée : aucun repos à créditer");
              }
            }
          }
        }

        if (await permanenceCreditCandidate(db, current)) permanenceCreditCandidates.push(current);
      }

      // Revalider après toutes les écritures : lorsqu'un P matin et un P nuit sont
      // posés ensemble, la première case ne doit pas rester proposée comme +0,5.
      const validatedCandidates = [];
      for (const candidate of permanenceCreditCandidates) {
        const fresh = await db.prepare(`SELECT * FROM service_entries WHERE id=? LIMIT 1`).bind(candidate.id).first();
        if (fresh && await permanenceCreditCandidate(db, fresh)) validatedCandidates.push(fresh);
      }
      if (saved.length) {
        const dates = saved.map(entry => entry.service_date).sort();
        await syncMissingWeeklyRestCredits(db, permission, dates[0], dates.at(-1));
      }
      return serviceJson({ success: true, entries: saved, permanence_credit_candidates: validatedCandidates });
    }

    if (action === "recovery-from-entries") {
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))];
      if (!ids.length || ids.length > 200) return serviceJson({ error: "Cases de repos invalides." }, 400);
      let created = 0;
      const entries = [];
      for (const id of ids) {
        const entry = await db.prepare(`
          SELECT id, target_key, service_date, slot, service_code
          FROM service_entries
          WHERE id=? AND target_type='person' AND service_code IN ('RR','RPC')
          LIMIT 1
        `).bind(id).first();
        if (entry) entries.push(entry);
      }
      entries.sort((a, b) => Number(a.target_key) - Number(b.target_key) || a.service_date.localeCompare(b.service_date) || a.slot.localeCompare(b.slot));
      const runState = new Map();
      const ordinal = entry => Math.floor(new Date(`${entry.service_date}T12:00:00Z`).getTime() / 86400000) * 2 + (entry.slot === "N" ? 1 : 0);
      for (const entry of entries) {
        const existing = await db.prepare(`SELECT id FROM service_recovery_ledger WHERE entry_id=? LIMIT 1`).bind(entry.id).first();
        if (existing) continue;
        const runKey = `${entry.target_key}|${entry.service_code}`;
        const currentOrdinal = ordinal(entry);
        const previousRun = runState.get(runKey);
        const movementGroup = previousRun && currentOrdinal === previousRun.ordinal + 1 ? previousRun.group : crypto.randomUUID();
        runState.set(runKey, { ordinal: currentOrdinal, group: movementGroup });
        const type = entry.service_code === "RR" ? "Repos récupérateur" : "RPC";
        await db.prepare(`
          INSERT INTO service_recovery_ledger
            (person_id, movement_date, period_end, amount, movement_type, reason, comment, movement_group, entry_id, created_by)
          VALUES (?, ?, ?, -0.5, 'debit', ?, '', ?, ?, ?)
        `).bind(Number(entry.target_key), entry.service_date, entry.service_date, type, movementGroup, entry.id, permission.username).run();
        created += 1;
      }
      return serviceJson({ success: true, created });
    }

    if (action === "recovery-from-permanence") {
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))];
      if (!ids.length || ids.length > 200) return serviceJson({ error: "Permanences invalides." }, 400);
      let created = 0;
      const movementGroup = crypto.randomUUID();
      for (const id of ids) {
        const entry = await db.prepare(`SELECT * FROM service_entries WHERE id=? AND target_type='person' AND service_code='P' LIMIT 1`).bind(id).first();
        if (!entry || !(await permanenceCreditCandidate(db, entry))) continue;
        const reason = entry.slot === "M" ? "Permanence matin sans récup" : "Permanence soir sans récup";
        await db.prepare(`
          INSERT INTO service_recovery_ledger
            (person_id, movement_date, period_end, amount, movement_type, reason, comment, movement_group, entry_id, created_by)
          VALUES (?, ?, ?, 0.5, 'credit', ?, '', ?, ?, ?)
        `).bind(Number(entry.target_key), entry.service_date, entry.service_date, reason, movementGroup, id, permission.username).run();
        created += 1;
      }
      return serviceJson({ success: true, created });
    }

    if (action === "delete-entries") {
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))];
      const deletionReason = cleanText(body.deletion_reason, 500);
      if (!ids.length || ids.length > 200) return serviceJson({ error: "Sélection à supprimer invalide." }, 400);
      if (!permission.isCdu) {
        for (const id of ids) {
          const row = await db.prepare(`SELECT service_date FROM service_entries WHERE id=? LIMIT 1`).bind(id).first();
          if (row?.service_date < todayIso()) {
            return serviceJson({ error: "Seul le CDU peut modifier le planning d’un jour passé." }, 403);
          }
        }
      }
      const permanenceCreditCandidates = [];
      const reversalGroup = crypto.randomUUID();
      const affectedDates = [];
      for (const id of ids) {
        const previous = await db.prepare(`SELECT * FROM service_entries WHERE id=? LIMIT 1`).bind(id).first();
        if (!previous) continue;
        affectedDates.push(previous.service_date);
        if (previous.service_date < todayIso() && !permission.isCdu) {
          return serviceJson({ error: "Seul le CDU peut modifier le planning d’un jour passé." }, 403);
        }
        if (["RR", "RPC"].includes(previous.service_code) && !deletionReason) {
          return serviceJson({ error: "Le motif du retrait du repos est obligatoire." }, 400);
        }
        const affectedPermanences = await affectedPermanenceForRpj(db, previous);
        await reverseLinkedMovement(db, previous, permission, deletionReason, reversalGroup);
        await db.prepare(`DELETE FROM service_entries WHERE id=?`).bind(id).run();
        await auditService(db, "delete", id, permission.username, previous, { deletion_reason: deletionReason });
        for (const permanence of affectedPermanences) {
          if (await permanenceCreditCandidate(db, permanence)) permanenceCreditCandidates.push(permanence);
        }
      }
      if (affectedDates.length) {
        affectedDates.sort();
        await syncMissingWeeklyRestCredits(db, permission, affectedDates[0], affectedDates.at(-1));
      }
      return serviceJson({ success: true, permanence_credit_candidates: permanenceCreditCandidates });
    }

    if (action === "recovery-movement") {
      const personIds = [...new Set((Array.isArray(body.person_ids) ? body.person_ids : [body.person_id]).map(Number).filter(Number.isInteger))];
      const movementType = ["credit", "debit"].includes(body.movement_type) ? body.movement_type : "";
      const rawAmount = Math.abs(Number(body.amount));
      const date = String(body.movement_date || "");
      const periodEnd = String(body.period_end || date);
      const reason = cleanText(body.reason, 250);
      const comment = cleanText(body.comment, 500);
      const creditReasons = new Set(["Activité rupture de rythme", "Activité tradition", "Jour férié travaillé", "Samedi travaillé", "Dimanche travaillé", "Week-end travaillé", "Permanence soir sans récup", "Permanence matin sans récup"]);
      const debitReasons = new Set(["RPC", "Repos récupérateur"]);
      const reasonAllowed = movementType === "credit" ? creditReasons.has(reason) : debitReasons.has(reason);
      if (!personIds.length || personIds.length > 200 || !movementType || !validDate(date) || !validDate(periodEnd) || periodEnd < date || !reasonAllowed || !Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 100) {
        return serviceJson({ error: "Mouvement de repos incomplet ou invalide." }, 400);
      }
      const amount = movementType === "debit" ? -rawAmount : rawAmount;
      const ids = [];
      const movementGroup = crypto.randomUUID();
      for (const personId of personIds) {
        const person = await db.prepare(`SELECT id FROM service_people WHERE id=? AND active=1`).bind(personId).first();
        if (!person) return serviceJson({ error: "Un des cadres sélectionnés est introuvable." }, 404);
      }
      for (const personId of personIds) {
        const result = await db.prepare(`
          INSERT INTO service_recovery_ledger
            (person_id, movement_date, period_end, amount, movement_type, reason, comment, movement_group, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(personId, date, periodEnd, amount, movementType, reason, comment, movementGroup, permission.username).run();
        const id = result.meta?.last_row_id;
        ids.push(id);
        await auditService(db, "recovery-movement", null, permission.username, null, { id, personId, date, periodEnd, amount, movementType, reason, comment });
      }
      return serviceJson({ success: true, created: ids.length, ids });
    }


    if (action === "update-recovery-movement") {
      if (!permission.isCdu) return serviceJson({ error: "Modification réservée au CDU." }, 403);
      const id = Number(body.id);
      if (!Number.isInteger(id)) return serviceJson({ error: "Mouvement invalide." }, 400);
      const previous = await db.prepare(`SELECT * FROM service_recovery_ledger WHERE id=? LIMIT 1`).bind(id).first();
      if (!previous) return serviceJson({ error: "Mouvement introuvable." }, 404);
      const movementType = ["credit", "debit"].includes(body.movement_type) ? body.movement_type : previous.movement_type;
      const rawAmount = Math.abs(Number(body.amount));
      const date = String(body.movement_date || previous.movement_date || "");
      const periodEnd = String(body.period_end || date);
      const reason = cleanText(body.reason, 250);
      const comment = cleanText(body.comment, 500);
      if (!validDate(date) || !validDate(periodEnd) || periodEnd < date || !reason || !Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 100) {
        return serviceJson({ error: "Mouvement de repos incomplet ou invalide." }, 400);
      }
      const amount = movementType === "debit" ? -rawAmount : rawAmount;
      await db.prepare(`
        UPDATE service_recovery_ledger
        SET movement_date=?, period_end=?, amount=?, movement_type=?, reason=?, comment=?
        WHERE id=?
      `).bind(date, periodEnd, amount, movementType, reason, comment, id).run();
      const current = await db.prepare(`SELECT * FROM service_recovery_ledger WHERE id=? LIMIT 1`).bind(id).first();
      await auditService(db, "recovery-update-cdu", null, permission.username, previous, current);
      return serviceJson({ success: true, movement: current });
    }

    if (action === "delete-recovery-movements") {
      if (!permission.isCdu) return serviceJson({ error: "Suppression réservée au CDU." }, 403);
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(Number).filter(Number.isInteger))] : [];
      if (!ids.length || ids.length > 100) return serviceJson({ error: "Mouvements invalides." }, 400);
      let deleted = 0;
      for (const id of ids) {
        const previous = await db.prepare(`SELECT * FROM service_recovery_ledger WHERE id=? LIMIT 1`).bind(id).first();
        if (!previous) continue;
        await db.prepare(`UPDATE service_recovery_ledger SET reversal_of=NULL WHERE reversal_of=?`).bind(id).run();
        await db.prepare(`DELETE FROM service_recovery_ledger WHERE id=?`).bind(id).run();
        await auditService(db, "recovery-delete-cdu", null, permission.username, previous, null);
        deleted += 1;
      }
      return serviceJson({ success: true, deleted });
    }

    if (action === "purge-period") {
      if (!permission.isCdu) return serviceJson({ error: "La purge du service et des repos est réservée au CDU." }, 403);
      const start = String(body.start || "");
      const end = String(body.end || "");
      const reason = cleanText(body.reason, 200);
      const purgeService = body.purge_service !== false;
      // Une reprise totale du service doit aussi remettre à zéro les repos pris/crédités
      // sur la même période. Cette règle est imposée côté serveur, pas seulement dans l’UI.
      const purgeRecovery = purgeService ? true : body.purge_recovery === true;
      if (!validDate(start) || !validDate(end) || start > end) return serviceJson({ error: "Période de purge invalide." }, 400);
      if (!purgeService && !purgeRecovery) return serviceJson({ error: "Aucun élément à purger n’a été sélectionné." }, 400);
      if (!reason) return serviceJson({ error: "Le motif de la purge est obligatoire." }, 400);
      const days = Math.round((new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) / 86400000) + 1;
      if (days > 366) return serviceJson({ error: "Une purge ne peut pas dépasser 366 jours en une seule opération." }, 400);

      let deleted = 0;
      let reversed = 0;
      let recoveryDeleted = 0;

      if (purgeService) {
        const result = await db.prepare(`
          SELECT * FROM service_entries
          WHERE service_date BETWEEN ? AND ?
          ORDER BY service_date, target_type, target_key, slot
        `).bind(start, end).all();
        const entries = result.results || [];
        if (entries.length > 5000) return serviceJson({ error: "La période contient trop de cases pour une purge unique." }, 400);
        const reversalGroup = crypto.randomUUID();
        for (const entry of entries) {
          if (!purgeRecovery && entry.target_type === "person" && ["RR", "RPC", "P"].includes(entry.service_code)) {
            if (await reverseLinkedMovement(db, entry, permission, `Purge du service : ${reason}`, reversalGroup)) reversed += 1;
          }
        }
        for (const entry of entries) {
          await db.prepare(`DELETE FROM service_entries WHERE id=?`).bind(entry.id).run();
          await auditService(db, "purge-delete", entry.id, permission.username, entry, { start, end, reason });
        }
        deleted = entries.length;
      }

      if (purgeRecovery) {
        const ledgerResult = await db.prepare(`
          SELECT id FROM service_recovery_ledger
          WHERE movement_date <= ?
            AND COALESCE(NULLIF(period_end, ''), movement_date) >= ?
          ORDER BY id
        `).bind(end, start).all();
        const ledgerIds = (ledgerResult.results || []).map(row => Number(row.id)).filter(Number.isInteger);
        if (ledgerIds.length > 5000) return serviceJson({ error: "La période contient trop de mouvements de repos pour une purge unique." }, 400);
        for (const id of ledgerIds) {
          // Évite de laisser un lien d'annulation vers un mouvement supprimé.
          await db.prepare(`UPDATE service_recovery_ledger SET reversal_of=NULL WHERE reversal_of=?`).bind(id).run();
          await db.prepare(`DELETE FROM service_recovery_ledger WHERE id=?`).bind(id).run();
        }
        recoveryDeleted = ledgerIds.length;
      }

      await auditService(db, "purge-period", null, permission.username, null, {
        start, end, reason, purgeService, purgeRecovery, deleted, reversed, recoveryDeleted
      });
      return serviceJson({ success: true, deleted, reversed, recovery_deleted: recoveryDeleted });
    }

    if (action === "save-people") {
      if (!permission.isCdu) return serviceJson({ error: "Gestion des cadres réservée au CDU." }, 403);
      const people = Array.isArray(body.people) ? body.people : [];
      if (!people.length || people.length > 200) return serviceJson({ error: "Liste de cadres invalide." }, 400);
      const normalized = people.map(raw => ({
        id: Number(raw.id || 0),
        grade: cleanText(raw.grade, 30),
        displayName: cleanText(raw.display_name, 120),
        peloton: cleanText(raw.peloton, 10).toUpperCase(),
        sortOrder: Math.max(0, Math.min(9999, Number(raw.sort_order || 100))),
        active: raw.active === false ? 0 : 1,
        sopEligible: raw.sop_eligible === false ? 0 : 1
      }));
      if (normalized.some(person => !person.displayName || (person.id && !Number.isInteger(person.id)) || (person.peloton && !["P1", "P2", "P3"].includes(person.peloton)))) {
        return serviceJson({ error: "Un cadre contient un nom, un identifiant ou un peloton invalide." }, 400);
      }
      const statements = normalized.map(person => person.id
        ? db.prepare(`UPDATE service_people SET grade=?, display_name=?, peloton=?, sort_order=?, active=?, sop_eligible=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .bind(person.grade, person.displayName, person.peloton, person.sortOrder, person.active, person.sopEligible, person.id)
        : db.prepare(`INSERT INTO service_people (grade, display_name, peloton, sort_order, active, sop_eligible) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(person.grade, person.displayName, person.peloton, person.sortOrder, person.active, person.sopEligible));
      await db.batch(statements);
      return serviceJson({ success: true, saved: normalized.length });
    }

    if (action === "save-person") {
      if (!permission.isCdu) return serviceJson({ error: "Gestion des cadres réservée au CDU." }, 403);
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
