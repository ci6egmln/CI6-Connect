function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
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

export async function onRequestGet(context) {
  if (!context.env.DB) {
    return jsonResponse(
      {
        error:
          "Liaison D1 indisponible."
      },
      500
    );
  }

  try {
    const setting = await context.env.DB
      .prepare(`
        SELECT
          value,
          updated_at
        FROM settings
        WHERE key = 'collective_access_enabled'
        LIMIT 1
      `)
      .first();

    const enabled =
      setting
        ? String(setting.value) === "1"
        : false;

    return jsonResponse({
      success: true,
      enabled,
      updatedAt:
        setting?.updated_at || null
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "Impossible de lire l’état de l’accès collectif.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  if (!context.env.DB) {
    return jsonResponse(
      {
        error:
          "Liaison D1 indisponible."
      },
      500
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
          "Requête invalide."
      },
      400
    );
  }

  if (typeof body.enabled !== "boolean") {
    return jsonResponse(
      {
        error:
          "L’état demandé est invalide."
      },
      400
    );
  }

  try {
    await context.env.DB
      .prepare(`
        INSERT INTO settings (
          key,
          value,
          updated_at
        )
        VALUES (
          'collective_access_enabled',
          ?,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(key)
        DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        body.enabled ? "1" : "0"
      )
      .run();

    return jsonResponse({
      success: true,
      enabled: body.enabled,
      message:
        body.enabled
          ? "L’accès collectif est maintenant activé."
          : "L’accès collectif est maintenant désactivé. Les sessions collectives ouvertes seront révoquées."
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "La modification de l’accès collectif a échoué.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}
