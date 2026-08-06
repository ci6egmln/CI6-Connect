function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "private, no-store"
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

async function exportTable(database, tableName) {
  if (
    !/^[a-z_][a-z0-9_]*$/i.test(tableName)
  ) {
    throw new Error(
      `Nom de table invalide : ${tableName}`
    );
  }

  if (
    !(await tableExists(database, tableName))
  ) {
    return {
      exists: false,
      columns: [],
      rows: []
    };
  }

  const columnsResult =
    await database
      .prepare(
        `PRAGMA table_info(${tableName})`
      )
      .all();

  const rowsResult =
    await database
      .prepare(
        `SELECT * FROM ${tableName}`
      )
      .all();

  return {
    exists: true,
    columns:
      (columnsResult.results || [])
        .map(column => ({
          name: column.name,
          type: column.type,
          notNull:
            Number(column.notnull) === 1,
          defaultValue:
            column.dflt_value,
          primaryKey:
            Number(column.pk) === 1
        })),
    rows:
      rowsResult.results || []
  };
}

export async function onRequestGet(context) {
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

  const tables = [
    "users",
    "settings",
    "homepage_tiles",
    "fiche_consultations",
    "discipline_students",
    "discipline_sanctions",
    "discipline_audit_log",
    "notation_students",
    "notation_records",
    "notation_access",
    "notation_audit_log",
    "push_subscriptions",
    "administration_audit_log"
  ];

  try {
    const exportedTables = {};

    for (const tableName of tables) {
      exportedTables[tableName] =
        await exportTable(
          context.env.DB,
          tableName
        );
    }

    const now =
      new Date();

    const backup = {
      format:
        "ci6-connect-d1-backup",
      formatVersion: 1,
      exportedAt:
        now.toISOString(),
      exportedBy:
        session.username || "",
      warning:
        "Ce fichier contient des données sensibles. Conserver dans un emplacement sécurisé.",
      tables:
        exportedTables
    };

    const fileName =
      `ci6-connect-sauvegarde-${compactTimestamp(now)}.json`;

    return new Response(
      JSON.stringify(backup, null, 2),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
          "Content-Disposition":
            `attachment; filename="${fileName}"`,
          "Cache-Control":
            "private, no-store",
          "X-Content-Type-Options":
            "nosniff"
        }
      }
    );

  } catch (error) {
    console.error(
      "Export de sauvegarde impossible :",
      error
    );

    return jsonResponse(
      {
        error:
          "Impossible de créer la sauvegarde de la base."
      },
      500
    );
  }
}
