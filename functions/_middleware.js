const COOKIE_NAME = "ci6_session";
const SESSION_DURATION = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
// Base utilisateur pour contrôle d'accès liée sous le nom DB sur le site CloudFLare //
// compte administrateur créé //
function bytesToBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
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

  const binary = atob(padded);

  return Uint8Array.from(
    binary,
    character => character.charCodeAt(0)
  );
}

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

async function getPasswordVersion(password) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(password)
  );

  return bytesToBase64Url(
    new Uint8Array(digest)
  ).slice(0, 16);
}

async function createSessionToken(environment) {
  const expiresAt =
    Math.floor(Date.now() / 1000) + SESSION_DURATION;

  const passwordVersion =
    await getPasswordVersion(environment.SITE_PASSWORD);

  const payload = `${expiresAt}.${passwordVersion}`;

  const key =
    await createHmacKey(environment.SESSION_SECRET);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  return `${payload}.${bytesToBase64Url(
    new Uint8Array(signature)
  )}`;
}

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

async function hasValidSession(request, environment) {
  const token = readCookie(request, COOKIE_NAME);

  if (!token) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [
    expiresAtText,
    passwordVersion,
    signatureText
  ] = parts;

  const expiresAt = Number(expiresAtText);

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  const currentPasswordVersion =
    await getPasswordVersion(environment.SITE_PASSWORD);

  if (passwordVersion !== currentPasswordVersion) {
    return false;
  }

  try {
    const key =
      await createHmacKey(environment.SESSION_SECRET);

    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signatureText),
      encoder.encode(
        `${expiresAtText}.${passwordVersion}`
      )
    );
  } catch {
    return false;
  }
}

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

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const path = url.pathname;

  if (
    !context.env.SITE_USERNAME ||
    !context.env.SITE_PASSWORD ||
    !context.env.SESSION_SECRET
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
   * La page de connexion doit rester accessible
   * avant l’authentification.
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
   * Traitement du formulaire de connexion.
   */
  if (
    path === "/login" &&
    request.method === "POST"
  ) {
    const formData = await request.formData();

    const username =
      String(formData.get("username") || "");

    const password =
      String(formData.get("password") || "");

    const destination = safeDestination(
      String(formData.get("next") || "/")
    );

    if (
      username !== context.env.SITE_USERNAME ||
      password !== context.env.SITE_PASSWORD
    ) {
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

    const token =
      await createSessionToken(context.env);

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
   * Déconnexion volontaire.
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
   * Contrôle de la session avant de servir
   * toute autre page, fiche, image ou document.
   */
  const authenticated =
    await hasValidSession(request, context.env);

  if (!authenticated) {
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
