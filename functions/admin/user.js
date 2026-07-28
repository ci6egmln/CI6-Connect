function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function onRequestGet(context) {
  /*
   * Le middleware ajoutera l’identité de l’administrateur
   * dans cette requête.
   */
  const adminUsername =
    context.request.headers.get("X-CI6-Admin-Username");

  if (!adminUsername) {
    return jsonResponse(
      { error: "Accès administrateur requis." },
      403
    );
  }

  const url = new URL(context.request.url);
  const username =
    String(url.searchParams.get("username") || "").trim();

  if (!/^\d{6}$/.test(username)) {
    return jsonResponse(
      {
        error:
          "L’identifiant doit contenir exactement 6 chiffres."
      },
      400
    );
  }

  try {
    const user = await context.env.DB
      .prepare(`
        SELECT
          username,
          active,
          role,
          must_change_password,
          session_version,
          created_at,
          updated_at
        FROM users
        WHERE username = ?
        LIMIT 1
      `)
      .bind(username)
      .first();

    if (!user) {
      return jsonResponse(
        { error: "Aucun compte trouvé." },
        404
      );
    }

    return jsonResponse({
      success: true,
      user: {
        username: user.username,
        active: Number(user.active) === 1,
        role: user.role,
        mustChangePassword:
          Number(user.must_change_password) === 1,
        sessionVersion:
          Number(user.session_version),
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    return jsonResponse(
      {
        error: "Impossible de consulter le compte.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}
