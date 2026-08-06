const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function hashPassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS
    },
    keyMaterial,
    256
  );

  return bytesToBase64(
    new Uint8Array(derivedBits)
  );
}

function randomItem(items) {
  const randomValue =
    crypto.getRandomValues(new Uint32Array(1))[0];

  return items[randomValue % items.length];
}

function randomNumber(minimum, maximum) {
  const randomValue =
    crypto.getRandomValues(new Uint32Array(1))[0];

  return minimum +
    (randomValue % (maximum - minimum + 1));
}

function createTemporaryPassword() {
  const firstWords = [
    "Dragon",
    "Rempart",
    "Fanion",
    "Cobalt",
    "Rivage",
    "Sentinelle",
    "Montagne",
    "Bastion",
    "Orage",
    "Saphir",
    "Lynx",
    "Aigle"
  ];

  const secondWords = [
    "Vaillant",
    "Solide",
    "Rapide",
    "Argente",
    "Dore",
    "Robuste",
    "Calme",
    "Fidele",
    "Brave",
    "Horizon",
    "Victoire",
    "Etoile"
  ];

  return (
    randomItem(firstWords) +
    "-" +
    randomItem(secondWords) +
    "-" +
    randomNumber(10, 99)
  );
}

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
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

  if (!/^[A-Z]{3}\d{3}$/.test(username.toUpperCase())) {
    return jsonResponse(
      {
        error:
          "L’identifiant doit contenir trois lettres suivies de trois chiffres."
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

    const temporaryPassword =
      createTemporaryPassword();

    const salt =
      crypto.getRandomValues(
        new Uint8Array(16)
      );

    const passwordHash =
      await hashPassword(
        temporaryPassword,
        salt
      );

    await context.env.DB
      .prepare(`
        UPDATE users
        SET
          password_hash = ?,
          password_salt = ?,
          must_change_password = 1,
          session_version = session_version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE username = ?
      `)
      .bind(
        passwordHash,
        bytesToBase64(salt),
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
        "Le mot de passe a été réinitialisé.",
      temporaryPassword,
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
          "La réinitialisation a échoué.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}
