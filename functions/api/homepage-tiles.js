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
  /*
   * Le middleware général a déjà vérifié
   * que la personne est connectée.
   */
  if (!context.data || !context.data.session) {
    return jsonResponse(
      { error: "Authentification requise." },
      401
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
      "Lecture publique homepage_tiles impossible :",
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
