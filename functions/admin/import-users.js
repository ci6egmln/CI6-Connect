const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;
const MAX_USERS_PER_BATCH = 10;

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control": "private, no-store"
      }
    }
  );
}

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function hashPassword(password, salt) {
  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

  const derivedBits =
    await crypto.subtle.deriveBits(
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

function secureRandomIndex(length) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return values[0] % length;
}

function randomItem(items) {
  return items[secureRandomIndex(items.length)];
}

function randomNumber(minimum, maximum) {
  const range = maximum - minimum + 1;
  const values = new Uint32Array(1);

  crypto.getRandomValues(values);

  return minimum + (values[0] % range);
}

function createTemporaryPassword() {
  const firstWords = [
    "Dragon",
    "Rempart",
    "Fanion",
    "Cobalt",
    "Rivage",
    "Sentinelle",
    "Bastion",
    "Orage",
    "Saphir",
    "Lynx",
    "Aigle",
    "Horizon"
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
    "Victoire",
    "Etoile",
    "Altitude"
  ];

  return (
    randomItem(firstWords) +
    "-" +
    randomItem(secondWords) +
    "-" +
    randomNumber(10, 99)
  );
}

function normalizeRole(value) {
  const role = String(value || "")
    .trim()
    .toLowerCase();

  if (role === "élève") {
    return "eleve";
  }

  return role;
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
      { error: "Requête JSON invalide." },
      400
    );
  }

  if (!Array.isArray(body.users)) {
    return jsonResponse(
      { error: "La liste des comptes est absente." },
      400
    );
  }

  if (
    body.users.length === 0 ||
    body.users.length > MAX_USERS_PER_BATCH
  ) {
    return jsonResponse(
      {
        error:
          `Chaque lot doit contenir entre 1 et ${MAX_USERS_PER_BATCH} comptes.`
      },
      400
    );
  }

  const validatedUsers = [];
  const validationErrors = [];
  const usernamesInBatch = new Set();

  body.users.forEach((rawUser, index) => {
    const username =
      String(rawUser.username || "").trim();

    const nom =
      String(rawUser.nom || "").trim();

    const role =
      normalizeRole(rawUser.role);

    const lineNumber =
      Number(rawUser.lineNumber || index + 1);

    if (!nom || nom.length > 120) {
      validationErrors.push({
        lineNumber,
        username,
        error: "Le nom est obligatoire et limité à 120 caractères."
      });

      return;
    }

    if (!/^\d{6}$/.test(username)) {
      validationErrors.push({
        lineNumber,
        username,
        error:
          "Le NIGEND doit contenir exactement 6 chiffres."
      });

      return;
    }

    if (
      role !== "eleve" &&
      role !== "cadre"
    ) {
      validationErrors.push({
        lineNumber,
        username,
        error:
          "Le rôle doit être eleve ou cadre."
      });

      return;
    }

    if (usernamesInBatch.has(username)) {
      validationErrors.push({
        lineNumber,
        username,
        error:
          "Ce NIGEND apparaît plusieurs fois dans le même lot."
      });

      return;
    }

    usernamesInBatch.add(username);

    validatedUsers.push({
      username,
      nom,
      role,
      lineNumber
    });
  });

  if (validationErrors.length > 0) {
    return jsonResponse(
      {
        error:
          "Le lot contient des données invalides.",
        errors: validationErrors
      },
      400
    );
  }

  try {
    /*
     * Recherche des comptes déjà présents.
     */
    const existenceStatements =
      validatedUsers.map(user =>
        context.env.DB
          .prepare(`
            SELECT username
            FROM users
            WHERE username = ?
            LIMIT 1
          `)
          .bind(user.username)
      );

    const existenceResults =
      await context.env.DB.batch(
        existenceStatements
      );

    const existingUsers = [];
    const newUsers = [];

    validatedUsers.forEach((user, index) => {
      const result = existenceResults[index];

      if (
        Array.isArray(result?.results) &&
        result.results.length > 0
      ) {
        existingUsers.push({
          username: user.username,
          nom: user.nom,
          role: user.role,
          lineNumber: user.lineNumber,
          status: "existing"
        });
      } else {
        newUsers.push(user);
      }
    });

    const accountsToCreate = [];

    /*
     * Création des mots de passe et empreintes.
     */
    for (const user of newUsers) {
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

      accountsToCreate.push({
        ...user,
        temporaryPassword,
        passwordHash,
        passwordSalt:
          bytesToBase64(salt)
      });
    }

    /*
     * Insertion transactionnelle du lot.
     */
    if (accountsToCreate.length > 0) {
      const insertStatements =
        accountsToCreate.map(user =>
          context.env.DB
            .prepare(`
              INSERT INTO users (
                username,
                nom,
                password_hash,
                password_salt,
                active,
                role,
                must_change_password,
                session_version
              )
              VALUES (?, ?, ?, ?, 1, ?, 1, 1)
            `)
            .bind(
              user.username,
              user.nom,
              user.passwordHash,
              user.passwordSalt,
              user.role
            )
        );

      await context.env.DB.batch(
        insertStatements
      );
    }

    return jsonResponse({
      success: true,
      created: accountsToCreate.map(user => ({
        username: user.username,
        nom: user.nom,
        role: user.role,
        temporaryPassword:
          user.temporaryPassword,
        lineNumber: user.lineNumber,
        status: "created"
      })),
      existing: existingUsers,
      summary: {
        requested: validatedUsers.length,
        created: accountsToCreate.length,
        existing: existingUsers.length
      }
    });

  } catch (error) {
    return jsonResponse(
      {
        error:
          "L’import du lot a échoué.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
}
