const ALLOWED_TABLES = [
  "users",
  "settings",
  "homepage_tiles",
  "fiche_consultations",
  "discipline_students",
  "discipline_sanctions",
  "discipline_audit_log",
  "push_subscriptions",
  "administration_audit_log"
];

const INSERT_ORDER = [
  "users",
  "settings",
  "homepage_tiles",
  "fiche_consultations",
  "discipline_students",
  "discipline_sanctions",
  "discipline_audit_log",
  "push_subscriptions",
  "administration_audit_log"
];

const DELETE_ORDER = [
  "administration_audit_log",
  "discipline_audit_log",
  "discipline_sanctions",
  "discipline_students",
  "push_subscriptions",
  "fiche_consultations",
  "homepage_tiles",
  "settings",
  "users"
];

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "private, no-store",
        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}

function adminSession(context) {
  const session =
    context.data &&
    context.data.session;

  if (
    !session ||
    session.type !== "user" ||
    session.role !== "admin"
  ) {
    return null;
  }

  return session;
}

function compactTimestamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "_");
}

function safeIdentifier(value) {
  if (
    !/^[a-z_][a-z0-9_]*$/i.test(value)
  ) {
    throw new Error(
      `Identifiant SQL invalide : ${value}`
    );
  }

  return `"${value}"`;
}

async function tableExists(database, tableName) {
  const row =
    await database
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        LIMIT 1
      `)
      .bind(tableName)
      .first();

  return Boolean(row);
}

async function tableInformation(
  database,
  tableName
) {
  if (
    !(await tableExists(
      database,
      tableName
    ))
  ) {
    return null;
  }

  const result =
    await database
      .prepare(
        `PRAGMA table_info(${safeIdentifier(tableName)})`
      )
      .all();

  const columns =
    result.results || [];

  return {
    columns,
    columnNames:
      columns.map(column => column.name),
    primaryKeys:
      columns
        .filter(
          column =>
            Number(column.pk || 0) > 0
        )
        .sort(
          (first, second) =>
            Number(first.pk) -
            Number(second.pk)
        )
        .map(column => column.name)
  };
}

async function ensureAdministrationAuditLog(
  database
) {
  await database
    .prepare(`
      CREATE TABLE IF NOT EXISTS administration_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        actor_username TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    .run();
}

async function exportTable(
  database,
  tableName
) {
  const information =
    await tableInformation(
      database,
      tableName
    );

  if (!information) {
    return {
      exists: false,
      columns: [],
      rows: []
    };
  }

  const rowsResult =
    await database
      .prepare(
        `SELECT * FROM ${safeIdentifier(tableName)}`
      )
      .all();

  return {
    exists: true,
    columns:
      information.columns.map(column => ({
        name: column.name,
        type: column.type,
        notNull:
          Number(column.notnull) === 1,
        defaultValue:
          column.dflt_value,
        primaryKey:
          Number(column.pk) > 0
      })),
    rows:
      rowsResult.results || []
  };
}

async function createSafetyBackup(
  database,
  actor
) {
  const tables = {};

  for (const tableName of ALLOWED_TABLES) {
    tables[tableName] =
      await exportTable(
        database,
        tableName
      );
  }

  const now =
    new Date();

  return {
    fileName:
      `ci6-connect-avant-restauration-${compactTimestamp(now)}.json`,
    backup: {
      format:
        "ci6-connect-d1-backup",
      formatVersion: 1,
      exportedAt:
        now.toISOString(),
      exportedBy:
        actor,
      reason:
        "Sauvegarde automatique créée avant restauration.",
      warning:
        "Ce fichier contient des données sensibles. Conserver dans un emplacement sécurisé.",
      tables
    }
  };
}

function validateBackup(backup) {
  if (
    !backup ||
    backup.format !==
      "ci6-connect-d1-backup" ||
    Number(backup.formatVersion) !== 1 ||
    !backup.tables ||
    typeof backup.tables !== "object"
  ) {
    throw new Error(
      "Le fichier de sauvegarde est invalide."
    );
  }
}

function selectedTablesFromBody(body) {
  if (!Array.isArray(body.tables)) {
    throw new Error(
      "La liste des tables à restaurer est absente."
    );
  }

  const selected =
    [...new Set(
      body.tables.map(
        value =>
          String(value || "").trim()
      )
    )].filter(
      tableName =>
        ALLOWED_TABLES.includes(tableName)
    );

  if (!selected.length) {
    throw new Error(
      "Aucune table valide n’a été sélectionnée."
    );
  }

  return selected;
}

function prepareRows(
  backupTable,
  information
) {
  if (
    !backupTable ||
    backupTable.exists === false ||
    !Array.isArray(backupTable.rows)
  ) {
    return [];
  }

  const allowedColumns =
    new Set(
      information.columnNames
    );

  return backupTable.rows.map(row => {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row)
    ) {
      throw new Error(
        "Une ligne de la sauvegarde est invalide."
      );
    }

    const values = {};

    for (
      const [columnName, value]
      of Object.entries(row)
    ) {
      if (allowedColumns.has(columnName)) {
        values[columnName] = value;
      }
    }

    return values;
  });
}

function insertStatement(
  database,
  tableName,
  row,
  mode,
  primaryKeys
) {
  const columns =
    Object.keys(row);

  if (!columns.length) {
    return null;
  }

  const quotedColumns =
    columns
      .map(safeIdentifier)
      .join(", ");

  const placeholders =
    columns
      .map(() => "?")
      .join(", ");

  let sql =
    `INSERT INTO ${safeIdentifier(tableName)} ` +
    `(${quotedColumns}) VALUES (${placeholders})`;

  if (
    mode === "merge" &&
    primaryKeys.length &&
    primaryKeys.every(
      key => columns.includes(key)
    )
  ) {
    const updateColumns =
      columns.filter(
        column =>
          !primaryKeys.includes(column)
      );

    const conflictColumns =
      primaryKeys
        .map(safeIdentifier)
        .join(", ");

    if (updateColumns.length) {
      const updates =
        updateColumns
          .map(
            column =>
              `${safeIdentifier(column)} = excluded.${safeIdentifier(column)}`
          )
          .join(", ");

      sql +=
        ` ON CONFLICT (${conflictColumns}) ` +
        `DO UPDATE SET ${updates}`;
    } else {
      sql +=
        ` ON CONFLICT (${conflictColumns}) DO NOTHING`;
    }
  } else if (mode === "merge") {
    sql =
      `INSERT OR REPLACE INTO ${safeIdentifier(tableName)} ` +
      `(${quotedColumns}) VALUES (${placeholders})`;
  }

  return database
    .prepare(sql)
    .bind(
      ...columns.map(
        column => row[column]
      )
    );
}

async function runStatementsInChunks(
  database,
  statements,
  chunkSize = 75
) {
  for (
    let index = 0;
    index < statements.length;
    index += chunkSize
  ) {
    const chunk =
      statements.slice(
        index,
        index + chunkSize
      );

    if (chunk.length) {
      await database.batch(chunk);
    }
  }
}

export async function onRequestPost(context) {
  const session =
    adminSession(context);

  if (!session) {
    return jsonResponse(
      {
        error:
          "Accès administrateur requis."
      },
      403
    );
  }

  if (!context.env.DB) {
    return jsonResponse(
      {
        error:
          "Liaison D1 indisponible."
      },
      500
    );
  }

  const contentLength =
    Number(
      context.request.headers.get(
        "Content-Length"
      ) || 0
    );

  if (
    contentLength >
    16 * 1024 * 1024
  ) {
    return jsonResponse(
      {
        error:
          "La sauvegarde dépasse la taille maximale autorisée."
      },
      413
    );
  }

  let body;

  try {
    body =
      await context.request.json();
  } catch {
    return jsonResponse(
      {
        error:
          "La requête JSON est invalide."
      },
      400
    );
  }

  try {
    validateBackup(body.backup);

    const selectedTables =
      selectedTablesFromBody(body);

    const mode =
      body.mode === "replace"
        ? "replace"
        : "merge";

    if (
      mode === "replace" &&
      String(body.confirmation || "")
        .trim()
        .toUpperCase() !==
        "RESTAURER"
    ) {
      return jsonResponse(
        {
          error:
            "La confirmation RESTAURER est obligatoire."
        },
        400
      );
    }

    await ensureAdministrationAuditLog(
      context.env.DB
    );

    const safety =
      await createSafetyBackup(
        context.env.DB,
        session.username || ""
      );

    const informationByTable = {};

    for (const tableName of selectedTables) {
      const information =
        await tableInformation(
          context.env.DB,
          tableName
        );

      if (!information) {
        throw new Error(
          `La table ${tableName} n’existe pas dans la base actuelle.`
        );
      }

      informationByTable[tableName] =
        information;
    }

    if (mode === "replace") {
      const deleteStatements =
        DELETE_ORDER
          .filter(
            tableName =>
              selectedTables.includes(
                tableName
              )
          )
          .map(
            tableName =>
              context.env.DB.prepare(
                `DELETE FROM ${safeIdentifier(tableName)}`
              )
          );

      await runStatementsInChunks(
        context.env.DB,
        deleteStatements
      );
    }

    const restored = {};

    for (const tableName of INSERT_ORDER) {
      if (
        !selectedTables.includes(tableName)
      ) {
        continue;
      }

      const information =
        informationByTable[tableName];

      const rows =
        prepareRows(
          body.backup.tables[tableName],
          information
        );

      const statements =
        rows
          .map(
            row =>
              insertStatement(
                context.env.DB,
                tableName,
                row,
                mode,
                information.primaryKeys
              )
          )
          .filter(Boolean);

      await runStatementsInChunks(
        context.env.DB,
        statements
      );

      restored[tableName] =
        statements.length;
    }

    const auditDetails = {
      mode,
      selectedTables,
      restored,
      sourceExportedAt:
        body.backup.exportedAt || null,
      sourceExportedBy:
        body.backup.exportedBy || null
    };

    await context.env.DB
      .prepare(`
        INSERT INTO administration_audit_log
        (
          action,
          actor_username,
          details
        )
        VALUES
        (
          'database_restore',
          ?,
          ?
        )
      `)
      .bind(
        session.username || "",
        JSON.stringify(auditDetails)
      )
      .run();

    return jsonResponse({
      success: true,
      mode,
      restored,
      safetyBackup:
        safety.backup,
      safetyBackupFileName:
        safety.fileName
    });

  } catch (error) {
    console.error(
      "Restauration impossible :",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "La restauration a échoué."
      },
      500
    );
  }
}
