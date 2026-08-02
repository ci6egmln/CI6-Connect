function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}

function isAdminSession(session) {
  return Boolean(
    session &&
    session.type === "user" &&
    session.role === "admin"
  );
}

async function readSetting(database, key) {
  const row = await database.prepare(`
    SELECT value
    FROM settings
    WHERE key = ?
    LIMIT 1
  `).bind(key).first();

  return row ? String(row.value || "") : "";
}

export async function onRequestGet(context) {
  if (!isAdminSession(context.data?.session)) {
    return jsonResponse(
      { error: "Cette consultation est réservée aux administrateurs." },
      403
    );
  }

  const url = new URL(context.request.url);
  const fichePath = String(url.searchParams.get("fichePath") || "").trim();
  const ficheId = String(url.searchParams.get("ficheId") || "").trim();
  const ficheTitle = String(url.searchParams.get("ficheTitle") || "").trim();

  if (!fichePath && !ficheId) {
    return jsonResponse(
      { error: "La fiche à contrôler n’est pas renseignée." },
      400
    );
  }

  try {
    const incorporationDate =
      await readSetting(context.env.DB, "incorporation_date");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(incorporationDate)) {
      return jsonResponse(
        {
          error:
            "La date d’incorporation doit être renseignée dans les paramètres de la promotion."
        },
        400
      );
    }

    const result = await context.env.DB.prepare(`
      SELECT
        u.username,
        COALESCE(u.nom, '') AS nom
      FROM users u
      WHERE u.role = 'eleve'
        AND u.active = 1
        AND NOT EXISTS (
          SELECT 1
          FROM fiche_consultations fc
          WHERE fc.username = u.username
            AND fc.role = 'eleve'
            AND fc.opened_at >= ?
            AND (
              fc.fiche_path = ?
              OR (? <> '' AND fc.fiche_id = ?)
            )
        )
      ORDER BY
        CASE WHEN COALESCE(u.nom,'') = '' THEN 1 ELSE 0 END,
        u.nom COLLATE NOCASE,
        u.username
    `).bind(
      `${incorporationDate} 00:00:00`,
      fichePath,
      ficheId,
      ficheId
    ).all();

    const students = (result.results || []).map(row => ({
      username: row.username,
      nom: row.nom || ""
    }));

    return jsonResponse({
      success: true,
      fichePath,
      ficheId,
      ficheTitle,
      count: students.length,
      students
    });
  } catch (error) {
    console.error("Liste des élèves n’ayant pas lu :", error);

    return jsonResponse(
      { error: "Impossible de calculer la liste des élèves." },
      500
    );
  }
}
