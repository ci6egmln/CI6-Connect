function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store"
      }
    }
  );
}

function adminSession(context) {
  const session = context.data && context.data.session;

  if (
    !session ||
    session.type !== "user" ||
    session.role !== "admin"
  ) {
    return null;
  }

  return session;
}

export async function onRequestGet(context) {
  if (!adminSession(context)) {
    return jsonResponse(
      { error: "Accès administrateur requis." },
      403
    );
  }

  try {
    const result = await context.env.DB
      .prepare(`
        SELECT
          slug,
          is_visible
        FROM homepage_tiles
        ORDER BY slug
      `)
      .all();

    const tiles = {};

    for (const row of result.results || []) {
      tiles[row.slug] =
        Number(row.is_visible) === 1;
    }

    return jsonResponse({ tiles });

  } catch (error) {
    console.error(
      "Lecture homepage_tiles impossible :",
      error
    );

    return jsonResponse(
      {
        error:
          "Impossible de charger l’affichage des tuiles."
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  const session = adminSession(context);

  if (!session) {
    return jsonResponse(
      { error: "Accès administrateur requis." },
      403
    );
  }

  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse(
      { error: "Données JSON invalides." },
      400
    );
  }

  if (
    !body ||
    typeof body.tiles !== "object" ||
    body.tiles === null ||
    Array.isArray(body.tiles)
  ) {
    return jsonResponse(
      {
        error:
          "La liste des tuiles est absente ou invalide."
      },
      400
    );
  }

  const entries = Object.entries(body.tiles);

  if (entries.length > 250) {
    return jsonResponse(
      { error: "Trop de tuiles transmises." },
      400
    );
  }

  for (const [slug, isVisible] of entries) {
    if (
      !/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)
    ) {
      return jsonResponse(
        {
          error:
            `Identifiant de tuile invalide : ${slug}`
        },
        400
      );
    }

    if (typeof isVisible !== "boolean") {
      return jsonResponse(
        {
          error:
            `État invalide pour la tuile ${slug}.`
        },
        400
      );
    }
  }

  try {
    if (entries.length) {
      const statements = entries.map(
        ([slug, isVisible]) =>
          context.env.DB
            .prepare(`
              INSERT INTO homepage_tiles (
                slug,
                is_visible,
                updated_at
              )
              VALUES (?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(slug)
              DO UPDATE SET
                is_visible = excluded.is_visible,
                updated_at = CURRENT_TIMESTAMP
            `)
            .bind(
              slug,
              isVisible ? 1 : 0
            )
      );

      await context.env.DB.batch(statements);
    }

    const result = await context.env.DB
      .prepare(`
        SELECT
          slug,
          is_visible
        FROM homepage_tiles
        ORDER BY slug
      `)
      .all();

    const tiles = {};

    for (const row of result.results || []) {
      tiles[row.slug] =
        Number(row.is_visible) === 1;
    }

    return jsonResponse({
      success: true,
      tiles,
      message:
        "Affichage des tuiles enregistré."
    });

  } catch (error) {
    console.error(
      "Enregistrement homepage_tiles impossible :",
      error
    );

    return jsonResponse(
      {
        error:
          "Impossible d’enregistrer l’affichage des tuiles."
      },
      500
    );
  }
}
