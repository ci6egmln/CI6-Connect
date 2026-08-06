import {
  auditNotation,
  ensureNotationSchema,
  notationJson,
  validPeloton
} from "../_shared/notations.js";

function admin(context) {
  const session = context.data?.session;
  return session?.type === "user" && session.role === "admin"
    ? session
    : null;
}

function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

async function setting(db, key) {
  try {
    const row = await db.prepare(`SELECT value FROM settings WHERE key=? LIMIT 1`).bind(key).first();
    return row?.value || "";
  } catch {
    return "";
  }
}

async function saveSetting(db, key, value) {
  await db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
  `).bind(key, value).run();
}

export async function onRequestGet(context) {
  const session = admin(context);
  if (!session) return notationJson({ error: "Accès administrateur requis." }, 403);

  try {
    await ensureNotationSchema(context.env.DB);

    const [cadresResult, summaryResult, promotion, totalEg] = await Promise.all([
      context.env.DB.prepare(`
        SELECT u.username, u.nom, u.active, a.peloton
        FROM users u
        LEFT JOIN notation_access a ON a.username=u.username
        WHERE u.role='cadre'
        ORDER BY u.nom COLLATE NOCASE, u.username
      `).all(),
      context.env.DB.prepare(`
        SELECT peloton, COUNT(*) AS total
        FROM notation_students
        WHERE active=1
        GROUP BY peloton
        ORDER BY peloton
      `).all(),
      setting(context.env.DB, "notation_current_promotion"),
      setting(context.env.DB, "notation_total_eg")
    ]);

    return notationJson({
      success: true,
      promotion,
      totalEg: Number(totalEg || 0),
      cadres: (cadresResult.results || []).map(row => ({
        username: row.username,
        nom: row.nom || "",
        active: Number(row.active) === 1,
        peloton: row.peloton || ""
      })),
      summary: Object.fromEntries(
        (summaryResult.results || []).map(row => [row.peloton, Number(row.total || 0)])
      )
    });
  } catch (error) {
    return notationJson({
      error: "Impossible de charger le paramétrage SimpliNote.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

export async function onRequestPost(context) {
  const session = admin(context);
  if (!session) return notationJson({ error: "Accès administrateur requis." }, 403);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return notationJson({ error: "Requête JSON invalide." }, 400);
  }

  const action = clean(body.action, 40);

  try {
    await ensureNotationSchema(context.env.DB);

    if (action === "assign") {
      const username = clean(body.username, 20).toUpperCase();
      const peloton = clean(body.peloton, 10).toUpperCase();
      const cadre = await context.env.DB.prepare(`
        SELECT username, nom FROM users
        WHERE username=? AND role='cadre' AND active=1
        LIMIT 1
      `).bind(username).first();

      if (!cadre) return notationJson({ error: "Compte cadre actif introuvable." }, 404);

      if (!peloton) {
        await context.env.DB.prepare(`DELETE FROM notation_access WHERE username=?`).bind(username).run();
      } else {
        if (!validPeloton(peloton)) return notationJson({ error: "Le peloton doit être P1, P2 ou P3." }, 400);
        await context.env.DB.prepare(`
          INSERT INTO notation_access (username, peloton, updated_by, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(username) DO UPDATE SET
            peloton=excluded.peloton,
            updated_by=excluded.updated_by,
            updated_at=CURRENT_TIMESTAMP
        `).bind(username, peloton, session.username).run();
      }

      await auditNotation(context.env.DB, null, "assign_scope", session.username, null, { username, peloton });
      return notationJson({ success: true, username, peloton });
    }

    if (action === "import") {
      const promotion = clean(body.promotion, 80);
      const totalEg = Number(body.totalEg);
      const students = Array.isArray(body.students) ? body.students : [];

      if (!promotion) return notationJson({ error: "La promotion est obligatoire." }, 400);
      if (!Number.isInteger(totalEg) || totalEg < 1 || totalEg > 500) {
        return notationJson({ error: "Le nombre d’EG au classement final est invalide." }, 400);
      }
      if (!students.length || students.length > 250) {
        return notationJson({ error: "Le fichier doit contenir entre 1 et 250 élèves." }, 400);
      }

      const normalized = [];
      const errors = [];
      const identities = new Set();

      students.forEach((raw, index) => {
        const line = Number(raw.lineNumber || index + 2);
        const nom = clean(raw.nom).toUpperCase();
        const prenom = clean(raw.prenom);
        const grade = clean(raw.grade, 10).toUpperCase();
        const sexe = /^F/i.test(clean(raw.sexe, 10)) ? "F" : "M";
        const peloton = clean(raw.peloton, 10).toUpperCase();
        const moyenne = Number(String(raw.moyenne ?? "").replace(",", "."));
        const classement = Number(raw.classement);

        const identity = `${peloton}|${nom}|${prenom.toLocaleUpperCase("fr-FR")}`;

        if (!nom) errors.push(`Ligne ${line} : nom absent.`);
        else if (!["EG", "EGAV"].includes(grade)) errors.push(`Ligne ${line} : grade EG ou EGAV attendu.`);
        else if (!validPeloton(peloton)) errors.push(`Ligne ${line} : peloton P1, P2 ou P3 attendu.`);
        else if (!Number.isFinite(moyenne) || moyenne < 0 || moyenne > 20) errors.push(`Ligne ${line} : moyenne invalide.`);
        else if (!Number.isInteger(classement) || classement < 1 || classement > 500) errors.push(`Ligne ${line} : classement invalide.`);
        else if (identities.has(identity)) errors.push(`Ligne ${line} : élève en doublon dans ${peloton}.`);
        else {
          identities.add(identity);
          normalized.push({ nom, prenom, grade, sexe, peloton, moyenne, classement });
        }
      });

      if (errors.length) {
        return notationJson({ error: "Le CSV contient des erreurs.", errors: errors.slice(0, 30) }, 400);
      }

      await context.env.DB.prepare(`UPDATE notation_students SET active=0, updated_at=CURRENT_TIMESTAMP WHERE active=1`).run();

      const statements = normalized.map(student => context.env.DB.prepare(`
        INSERT INTO notation_students (
          promotion, nom, prenom, grade, sexe, peloton, moyenne, classement, active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(promotion, peloton, nom, prenom) DO UPDATE SET
          grade=excluded.grade,
          sexe=excluded.sexe,
          moyenne=excluded.moyenne,
          classement=excluded.classement,
          active=1,
          updated_at=CURRENT_TIMESTAMP
      `).bind(
        promotion,
        student.nom,
        student.prenom,
        student.grade,
        student.sexe,
        student.peloton,
        student.moyenne,
        student.classement
      ));

      for (let index = 0; index < statements.length; index += 40) {
        await context.env.DB.batch(statements.slice(index, index + 40));
      }

      await saveSetting(context.env.DB, "notation_current_promotion", promotion);
      await saveSetting(context.env.DB, "notation_total_eg", String(totalEg));
      await auditNotation(context.env.DB, null, "import_students", session.username, null, {
        promotion,
        totalEg,
        count: normalized.length,
        byPeloton: Object.fromEntries(["P1", "P2", "P3"].map(p => [p, normalized.filter(s => s.peloton === p).length]))
      });

      return notationJson({
        success: true,
        promotion,
        totalEg,
        imported: normalized.length,
        summary: Object.fromEntries(["P1", "P2", "P3"].map(p => [p, normalized.filter(s => s.peloton === p).length]))
      });
    }

    return notationJson({ error: "Action inconnue." }, 400);
  } catch (error) {
    return notationJson({
      error: "L’opération SimpliNote a échoué.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
