function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}

function normalizeLetters(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function cadrePrefix(displayName) {
  const firstPart = String(displayName || "")
    .trim()
    .split(/\s+/)[0] || "";
  return (normalizeLetters(firstPart) + "XXX").slice(0, 3);
}

function secureDigit() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % 10;
}

function secureLetter() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return letters[value[0] % letters.length];
}

function studentCandidate() {
  return `${secureLetter()}${secureLetter()}${secureLetter()}${secureDigit()}${secureDigit()}${secureDigit()}`;
}

function cadreCandidate(name) {
  return `${cadrePrefix(name)}${secureDigit()}${secureDigit()}${secureDigit()}`;
}

async function uniqueIdentifier(db, role, name, reserved) {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const candidate = ["cadre", "admin"].includes(role)
      ? cadreCandidate(name)
      : studentCandidate();

    if (reserved.has(candidate)) continue;

    const exists = await db
      .prepare("SELECT 1 FROM users WHERE username = ? LIMIT 1")
      .bind(candidate)
      .first();

    if (!exists) {
      reserved.add(candidate);
      return candidate;
    }
  }

  throw new Error("Impossible de générer un identifiant unique.");
}

async function tableExists(db, tableName) {
  const row = await db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1")
    .bind(tableName)
    .first();
  return Boolean(row);
}

async function columnExists(db, tableName, columnName) {
  if (!(await tableExists(db, tableName))) return false;
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  return (result.results || []).some(row => row.name === columnName);
}

async function ensureAuditTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS administration_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    DELETE FROM administration_audit_log
    WHERE created_at < datetime('now', '-3 months')
  `).run();
}

async function writeAudit(db, actor, details) {
  await db.prepare(`
    INSERT INTO administration_audit_log (
      action,
      actor_username,
      details
    ) VALUES ('identifier_migration', ?, ?)
  `).bind(
    actor,
    JSON.stringify(details || {})
  ).run();
}

async function listEligibleUsers(db) {
  const result = await db.prepare(`
    SELECT username, nom, role, active
    FROM users
    WHERE role IN ('eleve', 'cadre', 'admin')
    ORDER BY
      CASE role WHEN 'admin' THEN 0 WHEN 'cadre' THEN 1 ELSE 2 END,
      nom COLLATE NOCASE,
      username
  `).all();

  return (result.results || []).filter(user => {
    const username = String(user.username || "").toUpperCase();
    if (!/^[A-Z]{3}\d{3}$/.test(username)) return true;
    if (["cadre", "admin"].includes(user.role)) {
      return !username.startsWith(cadrePrefix(user.nom));
    }
    return false;
  });
}

export async function onRequestGet(context) {
  if (!context.env.DB) {
    return jsonResponse({ error: "Liaison D1 indisponible." }, 500);
  }

  try {
    const users = await listEligibleUsers(context.env.DB);
    const reserved = new Set();
    const preparedUsers = [];

    for (const user of users) {
      preparedUsers.push({
        ...user,
        suggestedUsername: await uniqueIdentifier(
          context.env.DB,
          user.role,
          user.nom,
          reserved
        )
      });
    }

    return jsonResponse({
      success: true,
      users: preparedUsers
    });
  } catch (error) {
    return jsonResponse({
      error: "Impossible de préparer la migration.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

export async function onRequestPost(context) {
  if (!context.env.DB) {
    return jsonResponse({ error: "Liaison D1 indisponible." }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: "Requête JSON invalide." }, 400);
  }

  const requestedMigrations = Array.isArray(body.migrations)
    ? body.migrations
        .map(item => ({
          oldUsername: String(item?.oldUsername || "").trim(),
          requestedUsername: String(item?.newUsername || "")
            .trim()
            .toUpperCase()
        }))
        .filter(item => item.oldUsername)
    : [];

  const seenOldUsernames = new Set();
  const migrations = requestedMigrations.filter(item => {
    if (seenOldUsernames.has(item.oldUsername)) return false;
    seenOldUsernames.add(item.oldUsername);
    return true;
  });

  if (!migrations.length) {
    return jsonResponse({ error: "Aucun compte n’a été sélectionné." }, 400);
  }

  for (const migration of migrations) {
    if (
      migration.requestedUsername &&
      !/^[A-Z]{3}\d{3}$/.test(migration.requestedUsername)
    ) {
      return jsonResponse({
        error:
          `L’identifiant ${migration.requestedUsername} est invalide. ` +
          "Utilisez trois lettres suivies de trois chiffres."
      }, 400);
    }
  }

  const selected = migrations.map(item => item.oldUsername);
  const requestedByOldUsername = new Map(
    migrations.map(item => [
      item.oldUsername,
      item.requestedUsername
    ])
  );

  const db = context.env.DB;
  const actor = String(context.data.session?.username || "administrateur");

  try {
    await ensureAuditTable(db);

    const placeholders = selected.map(() => "?").join(",");
    const found = await db.prepare(`
      SELECT username, nom, role, active
      FROM users
      WHERE username IN (${placeholders})
        AND role IN ('eleve', 'cadre', 'admin')
      ORDER BY username
    `).bind(...selected).all();

    const users = found.results || [];
    if (!users.length) {
      return jsonResponse({ error: "Aucun compte compatible n’a été trouvé." }, 404);
    }

    const tableColumns = {
      fiche_consultations: ["username"],
      push_subscriptions: ["username"],
      discipline_audit_log: ["actor_username"],
      administration_audit_log: ["actor_username"],
      discipline_sanctions: ["created_by", "updated_by", "deleted_by"]
    };

    const availableUpdates = [];
    for (const [table, columns] of Object.entries(tableColumns)) {
      for (const column of columns) {
        if (await columnExists(db, table, column)) {
          availableUpdates.push({ table, column });
        }
      }
    }

    const hasDisciplineStudents = await tableExists(db, "discipline_students");
    const hasDisciplineSanctions = await tableExists(db, "discipline_sanctions");
    const reserved = new Set();
    const migrated = [];

    for (const user of users) {
      const oldUsername = String(user.username);
      const requestedUsername =
        requestedByOldUsername.get(oldUsername) || "";

      if (!requestedUsername) continue;

      if (reserved.has(requestedUsername)) {
        return jsonResponse({
          error:
            `L’identifiant ${requestedUsername} est utilisé plusieurs fois dans la sélection.`
        }, 409);
      }

      const collision = await db.prepare(`
        SELECT username
        FROM users
        WHERE username = ?
          AND username <> ?
        LIMIT 1
      `).bind(requestedUsername, oldUsername).first();

      if (collision) {
        return jsonResponse({
          error:
            `L’identifiant ${requestedUsername} est déjà attribué à un autre compte.`
        }, 409);
      }

      reserved.add(requestedUsername);
    }

    for (const user of users) {
      const oldUsername = String(user.username);
      const requestedUsername =
        requestedByOldUsername.get(oldUsername) || "";

      const newUsername = requestedUsername || await uniqueIdentifier(
        db,
        user.role,
        user.nom,
        reserved
      );
      const statements = [];

      if (hasDisciplineStudents) {
        statements.push(db.prepare(`
          INSERT OR IGNORE INTO discipline_students (
            nigend, nom, prenom, peloton, promotion, active, created_at, updated_at
          )
          SELECT ?, nom, prenom, peloton, promotion, active, created_at, CURRENT_TIMESTAMP
          FROM discipline_students
          WHERE nigend = ?
        `).bind(newUsername, oldUsername));

        if (hasDisciplineSanctions) {
          statements.push(db.prepare(`
            UPDATE discipline_sanctions
            SET student_nigend = ?
            WHERE student_nigend = ?
          `).bind(newUsername, oldUsername));
        }

        statements.push(db.prepare(`
          DELETE FROM discipline_students
          WHERE nigend = ?
        `).bind(oldUsername));
      }

      for (const update of availableUpdates) {
        statements.push(db.prepare(`
          UPDATE ${update.table}
          SET ${update.column} = ?
          WHERE ${update.column} = ?
        `).bind(newUsername, oldUsername));
      }

      statements.push(db.prepare(`
        UPDATE users
        SET username = ?,
            session_version = COALESCE(session_version, 1) + 1
        WHERE username = ?
      `).bind(newUsername, oldUsername));
      await db.batch(statements);

      await writeAudit(db, actor, {
        targetType: "user",
        targetIdentifier: newUsername,
        oldUsername,
        newUsername,
        displayName: user.nom,
        role: user.role,
        passwordUnchanged: true
      });

      migrated.push({
        oldUsername,
        newUsername,
        displayName: user.nom,
        role: user.role,
        active: Boolean(user.active),
        passwordUnchanged: true
      });
    }

    return jsonResponse({
      success: true,
      migrated,
      currentAccountMigrated: migrated.some(item => item.oldUsername === actor),
      message: `${migrated.length} identifiant(s) modifié(s). Les mots de passe sont inchangés.`
    });
  } catch (error) {
    return jsonResponse({
      error: "La migration n’a pas pu être terminée.",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
