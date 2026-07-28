const encoder = new TextEncoder();
const ITERATIONS = 100000;

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
      iterations: ITERATIONS
    },
    keyMaterial,
    256
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost(context) {
  try {
    if (!context.env.ADMIN_SECRET) {
      return jsonResponse(
        { error: "ADMIN_SECRET absent." },
        500
      );
    }

    if (!context.env.DB) {
      return jsonResponse(
        { error: "Liaison D1 DB absente." },
        500
      );
    }

    const suppliedSecret =
      context.request.headers.get("X-Admin-Secret");

    if (suppliedSecret !== context.env.ADMIN_SECRET) {
      return jsonResponse(
        { error: "Secret administrateur incorrect." },
        403
      );
    }

    const body = await context.request.json();

    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const role = body.role === "cadre" ? "cadre" : "eleve";

    if (!/^\d{6}$/.test(username)) {
      return jsonResponse(
        {
          error:
            "L’identifiant doit contenir exactement 6 chiffres."
        },
        400
      );
    }

    if (password.length < 12) {
      return jsonResponse(
        {
          error:
            "Le mot de passe doit contenir au moins 12 caractères."
        },
        400
      );
    }

    const existingUser = await context.env.DB
      .prepare(
        "SELECT id FROM users WHERE username = ? LIMIT 1"
      )
      .bind(username)
      .first();

    if (existingUser) {
      return jsonResponse(
        { error: "Cet identifiant existe déjà." },
        409
      );
    }

    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const passwordHash =
      await hashPassword(password, salt);

    await context.env.DB
      .prepare(`
        INSERT INTO users (
          username,
          password_hash,
          password_salt,
          active,
          role,
          must_change_password,
          session_version
        )
        VALUES (?, ?, ?, 1, ?, 1, 1)
      `)
      .bind(
        username,
        passwordHash,
        bytesToBase64(salt),
        role
      )
      .run();

    return jsonResponse(
      {
        success: true,
        username,
        role,
        must_change_password: true
      },
      201
    );

  } catch (error) {
    return jsonResponse(
      {
        error: "Erreur interne lors de la création.",
        details:
          error && error.message
            ? error.message
            : String(error)
      },
      500
    );
  }
}
