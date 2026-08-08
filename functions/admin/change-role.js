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

export async function onRequestPost(context) {
  if (!context.env.DB) {
    return jsonResponse(
      { error: "Liaison D1 indisponible." },
      500
    );
  }

  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse(
      { error: "Requête invalide." },
      400
    );
  }

  const username =
    String(body.username || "").trim();

  const requestedRole =
    String(body.role || "").trim();

  if (!/^[A-Z]{3}\d{3}$/.test(username.toUpperCase())) {
    return jsonResponse(
      {
        error:
          "L’identifiant doit contenir trois lettres suivies de trois chiffres."
      },
      400
    );
  }

  if (
    requestedRole !== "cadre" &&
    requestedRole !== "cdu" &&
    requestedRole !== "admin"
  ) {
    return jsonResponse(
      { error: "Rôle demandé invalide." },
      400
    );
  }

  try {
    const user = await context.env.DB
      .prepare(`
        SELECT
          username,
          active,
          role
        FROM users
        WHERE username = ?
        LIMIT 1
      `)
      .bind(username)
      .first();

    if (!user) {
      return jsonResponse(
        { error: "Compte introuvable." },
        404
      );
    }

    if (
      user.role !== "cadre" &&
      user.role !== "cdu" &&
      user.role !== "admin"
    ) {
      return jsonResponse(
        {
          error:
            "Seuls les comptes cadres peuvent recevoir les profils CDU ou administrateur."
        },
        403
      );
    }

    if (user.role === requestedRole) {
      return jsonResponse(
        {
          error:
            "Ce compte possède déjà ce rôle."
        },
        409
      );
    }

    /*
     * Interdire la rétrogradation du dernier
     * administrateur actif.
     */
    if (
      user.role === "admin" &&
      requestedRole !== "admin"
    ) {
      const result = await context.env.DB
        .prepare(`
          SELECT COUNT(*) AS total
          FROM users
          WHERE role = 'admin'
            AND active = 1
        `)
        .first();

      const activeAdministrators =
        Number(result?.total || 0);

      if (activeAdministrators <= 1) {
        return jsonResponse(
          {
            error:
              "Impossible de retirer les droits du dernier administrateur actif."
          },
          403
        );
      }
    }

    await context.env.DB
      .prepare(`
        UPDATE users
        SET
          role = ?,
          session_version = session_version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE username = ?
      `)
      .bind(
        requestedRole,
        username
      )
      .run();

    const updatedUser = await context.env.DB
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

    return jsonResponse({
      success: true,
      message:
        requestedRole === "admin"
          ? "Le cadre possède désormais les droits administrateur."
          : requestedRole === "cdu"
            ? "Le cadre possède désormais le profil CDU."
            : "Le compte possède désormais le profil cadre.",
      user: {
        username: updatedUser.username,
        active:
          Number(updatedUser.active) === 1,
        role: updatedUser.role,
        mustChangePassword:
          Number(
            updatedUser.must_change_password
          ) === 1,
        sessionVersion:
          Number(updatedUser.session_version),
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "La modification du rôle a échoué.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}
