function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function formatUser(user) {
  return {
    username: user.username,
    nom: user.nom || "",
    active: Number(user.active) === 1,
    role: user.role,
    mustChangePassword: Number(user.must_change_password) === 1,
    sessionVersion: Number(user.session_version),
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const query = String(
    url.searchParams.get("q") || url.searchParams.get("username") || ""
  ).trim();

  if (!query) {
    return jsonResponse({ error: "Saisissez un NIGEND ou un nom." }, 400);
  }

  try {
    const columns = `
      username, nom, active, role, must_change_password,
      session_version, created_at, updated_at
    `;

    if (/^\d{6}$/.test(query)) {
      const user = await context.env.DB
        .prepare(`SELECT ${columns} FROM users WHERE username = ? LIMIT 1`)
        .bind(query)
        .first();

      if (!user) return jsonResponse({ error: "Aucun compte trouvé." }, 404);
      return jsonResponse({ success: true, user: formatUser(user) });
    }

    if (query.length < 2) {
      return jsonResponse(
        { error: "Saisissez au moins 2 caractères pour rechercher un nom." },
        400
      );
    }

    const result = await context.env.DB
      .prepare(`
        SELECT ${columns}
        FROM users
        WHERE LOWER(COALESCE(nom, '')) LIKE LOWER(?)
        ORDER BY nom COLLATE NOCASE, username
        LIMIT 30
      `)
      .bind(`%${query}%`)
      .all();

    const users = (result.results || []).map(formatUser);
    if (!users.length) return jsonResponse({ error: "Aucun compte trouvé." }, 404);

    return jsonResponse({ success: true, users });
  } catch (error) {
    return jsonResponse(
      {
        error: "Impossible de consulter les comptes.",
        details: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
}
