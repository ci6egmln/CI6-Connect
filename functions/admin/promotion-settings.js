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

function cleanText(value, maximumLength) {
  return String(value || "")
    .trim()
    .slice(0, maximumLength);
}

async function readSetting(database, key) {
  const row = await database
    .prepare(`
      SELECT value
      FROM settings
      WHERE key = ?
      LIMIT 1
    `)
    .bind(key)
    .first();

  return row ? String(row.value || "") : "";
}

export async function onRequestGet(context) {
  try {
    const [
      promotionNumber,
      incorporationDate
    ] = await Promise.all([
      readSetting(
        context.env.DB,
        "promotion_number"
      ),
      readSetting(
        context.env.DB,
        "incorporation_date"
      )
    ]);

    return jsonResponse({
      success: true,
      promotionNumber,
      incorporationDate
    });

  } catch (error) {
    console.error(
      "Lecture des paramètres de promotion :",
      error
    );

    return jsonResponse(
      {
        error:
          "Impossible de lire les paramètres de la promotion."
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse(
      {
        error: "Requête invalide."
      },
      400
    );
  }

  const promotionNumber =
    cleanText(body.promotionNumber, 80);

  const incorporationDate =
    cleanText(body.incorporationDate, 10);

  if (!promotionNumber) {
    return jsonResponse(
      {
        error:
          "Le numéro de promotion est obligatoire."
      },
      400
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      incorporationDate
    )
  ) {
    return jsonResponse(
      {
        error:
          "La date d’incorporation est invalide."
      },
      400
    );
  }

  try {
    await context.env.DB.batch([
      context.env.DB
        .prepare(`
          INSERT INTO settings (
            key,
            value,
            updated_at
          )
          VALUES (
            'promotion_number',
            ?,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT(key)
          DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(promotionNumber),

      context.env.DB
        .prepare(`
          INSERT INTO settings (
            key,
            value,
            updated_at
          )
          VALUES (
            'incorporation_date',
            ?,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT(key)
          DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(incorporationDate)
    ]);

    return jsonResponse({
      success: true,
      promotionNumber,
      incorporationDate,
      message:
        "Les paramètres de la promotion ont été enregistrés."
    });

  } catch (error) {
    console.error(
      "Enregistrement des paramètres de promotion :",
      error
    );

    return jsonResponse(
      {
        error:
          "Impossible d’enregistrer les paramètres de la promotion."
      },
      500
    );
  }
}
