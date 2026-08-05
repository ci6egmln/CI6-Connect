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

  const requestedActive = body.active;

  if (!/^(?:[A-Z]{3}\d{3}|\d{6})$/.test(username.toUpperCase())) {
    return jsonResponse(
      {
        error:
          "L’identifiant doit contenir trois lettres suivies de trois chiffres."
      },
      400
    );
  }

  if (typeof requestedActive !== "boolean") {
    return jsonResponse(
      { error: "État du compte invalide." },
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

    /*
     * Protection contre la désactivation
     * d’un compte administrateur.
     */
    if (
      requestedActive === false &&
      user.role === "admin"
    ) {
      return jsonResponse(
        {
          error:
            "Un compte administrateur ne peut pas être désactivé depuis cette page."
        },
        403
      );
    }

    await context.env.DB
      .prepare(`
        UPDATE users
        SET
          active = ?,
          session_version = session_version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE username = ?
      `)
      .bind(
        requestedActive ? 1 : 0,
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
        requestedActive
          ? "Le compte a été activé."
          : "Le compte a été désactivé et ses sessions ont été révoquées.",
      user: {
        username: updatedUser.username,
        active: Number(updatedUser.active) === 1,
        role: updatedUser.role,
        mustChangePassword:
          Number(updatedUser.must_change_password) === 1,
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
          "La modification du compte a échoué.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}
