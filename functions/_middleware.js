const COOKIE_NAME = "ci6_session";
const SESSION_DURATION = 7 * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 100000;
const encoder = new TextEncoder();

/* ---------- Encodage ---------- */

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);

  return Uint8Array.from(
    binary,
    character => character.charCodeAt(0)
  );
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded =
    base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  return base64ToBytes(padded);
}

function stringToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToString(value) {
  return new TextDecoder().decode(
    base64UrlToBytes(value)
  );
}

/* ---------- Vérification des mots de passe D1 ---------- */

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

function constantTimeEqual(firstValue, secondValue) {
  if (
    typeof firstValue !== "string" ||
    typeof secondValue !== "string" ||
    firstValue.length !== secondValue.length
  ) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < firstValue.length; index++) {
    difference |=
      firstValue.charCodeAt(index) ^
      secondValue.charCodeAt(index);
  }

  return difference === 0;
}

async function verifyPassword(password, user) {
  try {
    const salt = base64ToBytes(user.password_salt);

    const calculatedHash =
      await hashPassword(password, salt);

    return constantTimeEqual(
      calculatedHash,
      user.password_hash
    );
  } catch {
    return false;
  }
}

/* ---------- Signature des sessions ---------- */

async function createHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payload, secret) {
  const key = await createHmacKey(secret);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  return bytesToBase64Url(
    new Uint8Array(signature)
  );
}

async function verifySignature(
  payload,
  signature,
  secret
) {
  try {
    const key = await createHmacKey(secret);

    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      encoder.encode(payload)
    );
  } catch {
    return false;
  }
}

async function collectivePasswordVersion(password) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(password)
  );

  return bytesToBase64Url(
    new Uint8Array(digest)
  ).slice(0, 16);
}

async function createSessionToken(
  environment,
  sessionData
) {
  const payloadObject = {
    ...sessionData,
    exp:
      Math.floor(Date.now() / 1000) +
      SESSION_DURATION
  };

  const payload = stringToBase64Url(
    JSON.stringify(payloadObject)
  );

  const signature = await signPayload(
    payload,
    environment.SESSION_SECRET
  );

  return `${payload}.${signature}`;
}

/* ---------- Cookies ---------- */

function readCookie(request, cookieName) {
  const cookieHeader =
    request.headers.get("Cookie") || "";

  for (const cookiePart of cookieHeader.split(";")) {
    const [name, ...valueParts] =
      cookiePart.trim().split("=");

    if (name === cookieName) {
      return valueParts.join("=");
    }
  }

  return null;
}

async function readValidSession(request, environment) {
  const token = readCookie(request, COOKIE_NAME);

  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;

  const signatureIsValid = await verifySignature(
    payload,
    signature,
    environment.SESSION_SECRET
  );

  if (!signatureIsValid) {
    return null;
  }

  let session;

  try {
    session = JSON.parse(
      base64UrlToString(payload)
    );
  } catch {
    return null;
  }

  if (
    !session.exp ||
    session.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  /*
   * Session individuelle :
   * vérification du compte et de sa version de session.
   */
  if (session.type === "user") {
    const user = await environment.DB
      .prepare(`
        SELECT
          username,
          active,
          role,
          must_change_password,
          session_version
        FROM users
        WHERE username = ?
        LIMIT 1
      `)
      .bind(session.username)
      .first();

    if (
      !user ||
      Number(user.active) !== 1 ||
      Number(user.session_version) !==
        Number(session.session_version)
    ) {
      return null;
    }

    return {
      type: "user",
      username: user.username,
      role: user.role,
      mustChangePassword:
        Number(user.must_change_password) === 1
    };
  }

  /*
   * Accès collectif provisoire.
   */
  if (session.type === "collective") {
    const currentVersion =
      await collectivePasswordVersion(
        environment.SITE_PASSWORD
      );

    if (session.version !== currentVersion) {
      return null;
    }

    return {
      type: "collective",
      username: environment.SITE_USERNAME,
      role: "collective",
      mustChangePassword: false
    };
  }

  return null;
}

/* ---------- Réponses ---------- */

function safeDestination(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/login") ||
    value.startsWith("/logout")
  ) {
    return "/";
  }

  return value;
}

function redirectResponse(
  request,
  destination,
  status = 303,
  additionalHeaders = {}
) {
  const headers = new Headers(additionalHeaders);

  headers.set(
    "Location",
    new URL(destination, request.url).toString()
  );

  headers.set("Cache-Control", "no-store");

  return new Response(null, {
    status,
    headers
  });
}

function noStoreResponse(response) {
  const headers = new Headers(response.headers);

  headers.set("Cache-Control", "private, no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/* ---------- Middleware principal ---------- */

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const path = url.pathname;

  if (
    !context.env.SESSION_SECRET ||
    !context.env.DB
  ) {
    return new Response(
      "Configuration du contrôle d’accès incomplète.",
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  /*
   * La page de connexion et ses images
   * doivent rester accessibles avant connexion.
   */
  if (
    (
      path === "/login" ||
      path.startsWith("/assets/img/")
    ) &&
    request.method === "GET"
  ) {
    const response = await context.next();
    return noStoreResponse(response);
  }

  /*
   * Route administrative de création des comptes.
   * La fonction reste protégée par ADMIN_SECRET.
   */
  if (
    path === "/admin/create-user" &&
    request.method === "POST"
  ) {
    const response = await context.next();
    return noStoreResponse(response);
  }

  /*
   * Traitement du formulaire de connexion.
   */
  if (
    path === "/login" &&
    request.method === "POST"
  ) {
    let formData;

    try {
      formData = await request.formData();
    } catch {
      return redirectResponse(
        request,
        "/login?error=1"
      );
    }

    const username =
      String(formData.get("username") || "").trim();

    const password =
      String(formData.get("password") || "");

    const destination = safeDestination(
      String(formData.get("next") || "/")
    );

    let sessionData = null;

    /*
     * 1. Recherche d’un compte individuel dans D1.
     */
    if (/^\d{6}$/.test(username)) {
      const user = await context.env.DB
        .prepare(`
          SELECT
            username,
            password_hash,
            password_salt,
            active,
            role,
            must_change_password,
            session_version
          FROM users
          WHERE username = ?
          LIMIT 1
        `)
        .bind(username)
        .first();

      if (
        user &&
        Number(user.active) === 1 &&
        await verifyPassword(password, user)
      ) {
        sessionData = {
          type: "user",
          username: user.username,
          role: user.role,
          session_version:
            Number(user.session_version)
        };
      }
    }

    /*
     * 2. Accès collectif conservé temporairement.
     */
    if (
      !sessionData &&
      context.env.SITE_USERNAME &&
      context.env.SITE_PASSWORD &&
      username === context.env.SITE_USERNAME &&
      password === context.env.SITE_PASSWORD
    ) {
      sessionData = {
        type: "collective",
        version:
          await collectivePasswordVersion(
            context.env.SITE_PASSWORD
          )
      };
    }

    if (!sessionData) {
      const loginUrl = new URL(
        "/login",
        request.url
      );

      loginUrl.searchParams.set("error", "1");
      loginUrl.searchParams.set(
        "next",
        destination
      );

      return redirectResponse(
        request,
        `${loginUrl.pathname}${loginUrl.search}`
      );
    }

    const token = await createSessionToken(
      context.env,
      sessionData
    );

    return redirectResponse(
      request,
      destination,
      303,
      {
        "Set-Cookie":
          `${COOKIE_NAME}=${token}; ` +
          `Path=/; ` +
          `Max-Age=${SESSION_DURATION}; ` +
          "HttpOnly; Secure; SameSite=Lax"
      }
    );
  }

  /*
   * Déconnexion.
   */
  if (path === "/logout") {
    return redirectResponse(
      request,
      "/login",
      303,
      {
        "Set-Cookie":
          `${COOKIE_NAME}=; ` +
          "Path=/; Max-Age=0; " +
          "HttpOnly; Secure; SameSite=Lax"
      }
    );
  }

  /*
   * Vérification de la session avant tout autre accès.
   */
  const session = await readValidSession(
    request,
    context.env
  );

  if (!session) {
    const destination = safeDestination(
      `${url.pathname}${url.search}`
    );

    const loginUrl = new URL(
      "/login",
      request.url
    );

    loginUrl.searchParams.set(
      "next",
      destination
    );

    return redirectResponse(
      request,
      `${loginUrl.pathname}${loginUrl.search}`,
      302
    );
  }

  const response = await context.next();

  return noStoreResponse(response);
}
