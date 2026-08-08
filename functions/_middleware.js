import { sendPushNotifications } from "./_shared/push.js";

const COOKIE_NAME = "ci6_session";
const DEVICE_COOKIE_NAME = "ci6_device";
const SESSION_DURATION = 7 * 24 * 60 * 60;
const DEVICE_COOKIE_DURATION = 365 * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 100000;
const encoder = new TextEncoder();

/* ---------- Session unique des comptes élèves ---------- */

function randomIdentifier() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(24))
  );
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(String(value || ""))
  );

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function deviceInformation(request) {
  const userAgent =
    String(request.headers.get("User-Agent") || "")
      .slice(0, 500);

  let deviceType = "Appareil non identifié";

  if (/iPhone|iPod/i.test(userAgent)) {
    deviceType = "iPhone";
  } else if (/iPad/i.test(userAgent)) {
    deviceType = "iPad";
  } else if (/Android/i.test(userAgent)) {
    deviceType = /Mobile/i.test(userAgent)
      ? "Téléphone Android"
      : "Tablette Android";
  } else if (/Windows/i.test(userAgent)) {
    deviceType = "PC Windows";
  } else if (/CrOS/i.test(userAgent)) {
    deviceType = "Chromebook";
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    deviceType = "Mac";
  } else if (/Linux/i.test(userAgent)) {
    deviceType = "PC Linux";
  }

  let browser = "Navigateur non identifié";

  if (/EdgA?\//i.test(userAgent)) {
    browser = "Microsoft Edge";
  } else if (/OPR\/|Opera/i.test(userAgent)) {
    browser = "Opera";
  } else if (/FxiOS\/|Firefox\//i.test(userAgent)) {
    browser = "Firefox";
  } else if (/CriOS\/|Chrome\//i.test(userAgent)) {
    browser = "Chrome";
  } else if (/Safari\//i.test(userAgent)) {
    browser = "Safari";
  }

  return {
    deviceType,
    browser,
    userAgent
  };
}

async function ensureSessionSecurityTables(database) {
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS active_user_sessions (
      username TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      session_version INTEGER NOT NULL,
      device_hash TEXT NOT NULL,
      device_type TEXT NOT NULL,
      browser TEXT NOT NULL,
      user_agent TEXT,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at INTEGER NOT NULL
    )
  `).run();

  await database.prepare(`
    CREATE INDEX IF NOT EXISTS idx_active_user_sessions_expires
    ON active_user_sessions(expires_at)
  `).run();

  await database.prepare(`
    CREATE TABLE IF NOT EXISTS administration_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function activeStudentSession(database, username) {
  try {
    return await database.prepare(`
      SELECT
        username,
        session_id,
        session_version,
        device_hash,
        device_type,
        browser,
        started_at,
        last_seen_at,
        expires_at
      FROM active_user_sessions
      WHERE username = ?
      LIMIT 1
    `).bind(username).first();
  } catch (error) {
    if (/no such table/i.test(String(error?.message || error))) {
      return null;
    }

    throw error;
  }
}

async function recordSimultaneousLogin(
  database,
  username,
  previousSession,
  newDevice
) {
  await database.prepare(`
    INSERT INTO administration_audit_log (
      action,
      actor_username,
      details
    ) VALUES ('simultaneous_login', ?, ?)
  `).bind(
    username,
    JSON.stringify({
      username,
      previousDeviceType: previousSession.device_type,
      previousBrowser: previousSession.browser,
      previousStartedAt: previousSession.started_at,
      previousLastSeenAt: previousSession.last_seen_at,
      newDeviceType: newDevice.deviceType,
      newBrowser: newDevice.browser
    })
  ).run();
}

function notifyAdministratorsOfSimultaneousLogin(
  context,
  user,
  previousSession,
  newDevice
) {
  const displayName =
    String(user.nom || "").trim();

  const identity = displayName
    ? `${user.username} – ${displayName}`
    : user.username;

  const notificationPromise = sendPushNotifications(
    context.env,
    {
      audience: "admins",
      notification: {
        title: "Connexion sur un second appareil",
        body:
          `${identity} : ${newDevice.deviceType} / ${newDevice.browser}. ` +
          `Ancienne session révoquée (${previousSession.device_type} / ${previousSession.browser}).`,
        url: "/administration#sessionSecurityPanel",
        tag: `session-security-${user.username}`,
        renotify: true,
        urgent: true
      }
    }
  ).catch(error => {
    console.error("Alerte de session simultanée :", error);
  });

  if (typeof context.waitUntil === "function") {
    context.waitUntil(notificationPromise);
  }
}

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

function passwordDifference(firstValue, secondValue) {
  const first = Array.from(String(firstValue || ""));
  const second = Array.from(String(secondValue || ""));
  const previous = Array.from(
    { length: second.length + 1 },
    (_, index) => index
  );

  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const current = [firstIndex + 1];

    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      current.push(Math.min(
        current[secondIndex] + 1,
        previous[secondIndex + 1] + 1,
        previous[secondIndex] +
          (first[firstIndex] === second[secondIndex] ? 0 : 1)
      ));
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[second.length];
}

function passwordIsSufficientlyDifferent(currentPassword, newPassword) {
  const referenceLength = Math.max(
    Array.from(currentPassword).length,
    Array.from(newPassword).length
  );

  return passwordDifference(currentPassword, newPassword) >=
    Math.ceil(referenceLength / 2);
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

    if (user.role === "eleve") {
      /*
       * Les cookies créés avant l’activation de la session unique
       * ne comportent pas d’identifiant de session. Les élèves sont
       * donc invités une seule fois à se reconnecter après le déploiement.
       */
      if (!session.sid) {
        return null;
      }

      const activeSession =
        await activeStudentSession(
          environment.DB,
          user.username
        );

      if (
        !activeSession ||
        (
          activeSession.session_id !== session.sid ||
          Number(activeSession.session_version) !==
            Number(session.session_version) ||
          Number(activeSession.expires_at) <=
            Math.floor(Date.now() / 1000)
        )
      ) {
        return null;
      }

      const lastSeen = Date.parse(
        `${String(activeSession.last_seen_at)
          .replace(" ", "T")}Z`
      );

      if (
        !Number.isFinite(lastSeen) ||
        Date.now() - lastSeen > 5 * 60 * 1000
      ) {
        await environment.DB.prepare(`
          UPDATE active_user_sessions
          SET last_seen_at = CURRENT_TIMESTAMP
          WHERE username = ?
            AND session_id = ?
        `).bind(user.username, session.sid).run();
      }
    }

    return {
      type: "user",
      username: user.username,
      role: user.role,
      sessionVersion: Number(user.session_version),
      sessionId: session.sid || null,
      mustChangePassword:
        Number(user.must_change_password) === 1
    };
  }

  if (session.type === "collective") {
    const collectiveSetting =
      await environment.DB
        .prepare(`
          SELECT value
          FROM settings
          WHERE key = 'collective_access_enabled'
          LIMIT 1
        `)
        .first();

    const collectiveAccessEnabled =
      collectiveSetting &&
      String(collectiveSetting.value) === "1";

    if (!collectiveAccessEnabled) {
      return null;
    }

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

    const enteredUsername =
      String(formData.get("username") || "").trim();

    const individualUsername =
      /^[A-Za-z]{3}\d{3}$/.test(enteredUsername)
        ? enteredUsername.toUpperCase()
        : "";

    const password =
      String(formData.get("password") || "");

    const destination = safeDestination(
      String(formData.get("next") || "/")
    );

    let sessionData = null;
    let authenticatedUser = null;
    let previousConflictingSession = null;
    let currentDevice = null;
    let deviceCookieValue =
      readCookie(request, DEVICE_COOKIE_NAME) || "";

    if (individualUsername) {
      const user = await context.env.DB
        .prepare(`
          SELECT
            username,
            nom,
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
        .bind(individualUsername)
        .first();

      if (
        user &&
        Number(user.active) === 1 &&
        await verifyPassword(password, user)
      ) {
        authenticatedUser = user;

        if (user.role === "eleve") {
          await ensureSessionSecurityTables(
            context.env.DB
          );

          const currentTimestamp =
            Math.floor(Date.now() / 1000);

          await context.env.DB.prepare(`
            DELETE FROM active_user_sessions
            WHERE expires_at <= ?
          `).bind(currentTimestamp).run();

          if (!deviceCookieValue) {
            deviceCookieValue = randomIdentifier();
          }

          currentDevice = deviceInformation(request);

          const deviceHash =
            await sha256Hex(deviceCookieValue);

          const previousSession =
            await activeStudentSession(
              context.env.DB,
              user.username
            );

          if (
            previousSession &&
            Number(previousSession.expires_at) >
              currentTimestamp &&
            Number(previousSession.session_version) ===
              Number(user.session_version) &&
            previousSession.device_hash !== deviceHash
          ) {
            previousConflictingSession = previousSession;
          }

          const sessionId = randomIdentifier();

          await context.env.DB.prepare(`
            UPDATE users
            SET
              session_version = session_version + 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE username = ?
              AND active = 1
          `).bind(user.username).run();

          const updatedUser = await context.env.DB
            .prepare(`
              SELECT session_version
              FROM users
              WHERE username = ?
                AND active = 1
              LIMIT 1
            `)
            .bind(user.username)
            .first();

          if (!updatedUser) {
            throw new Error(
              "Le compte n’a pas pu être associé à la nouvelle session."
            );
          }

          await context.env.DB.prepare(`
            INSERT INTO active_user_sessions (
              username,
              session_id,
              session_version,
              device_hash,
              device_type,
              browser,
              user_agent,
              started_at,
              last_seen_at,
              expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(username)
            DO UPDATE SET
              session_id = excluded.session_id,
              session_version = excluded.session_version,
              device_hash = excluded.device_hash,
              device_type = excluded.device_type,
              browser = excluded.browser,
              user_agent = excluded.user_agent,
              started_at = CURRENT_TIMESTAMP,
              last_seen_at = CURRENT_TIMESTAMP,
              expires_at = excluded.expires_at
          `).bind(
            user.username,
            sessionId,
            Number(updatedUser.session_version),
            deviceHash,
            currentDevice.deviceType,
            currentDevice.browser,
            currentDevice.userAgent,
            currentTimestamp + SESSION_DURATION
          ).run();

          sessionData = {
            type: "user",
            username: user.username,
            role: user.role,
            session_version:
              Number(updatedUser.session_version),
            sid: sessionId
          };

          if (previousConflictingSession) {
            await recordSimultaneousLogin(
              context.env.DB,
              user.username,
              previousConflictingSession,
              currentDevice
            );
          }
        } else {
          sessionData = {
            type: "user",
            username: user.username,
            role: user.role,
            session_version:
              Number(user.session_version)
          };
        }
      }
    }

      if (
        !sessionData &&
        context.env.SITE_USERNAME &&
        context.env.SITE_PASSWORD &&
        enteredUsername === context.env.SITE_USERNAME &&
        password === context.env.SITE_PASSWORD
      ) {
        const collectiveSetting =
          await context.env.DB
            .prepare(`
              SELECT value
              FROM settings
              WHERE key = 'collective_access_enabled'
              LIMIT 1
            `)
            .first();
      
        const collectiveAccessEnabled =
          collectiveSetting &&
          String(collectiveSetting.value) === "1";
      
        if (collectiveAccessEnabled) {
          sessionData = {
            type: "collective",
            version:
              await collectivePasswordVersion(
                context.env.SITE_PASSWORD
              )
          };
        }
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

    if (
      previousConflictingSession &&
      authenticatedUser &&
      currentDevice
    ) {
      notifyAdministratorsOfSimultaneousLogin(
        context,
        authenticatedUser,
        previousConflictingSession,
        currentDevice
      );
    }

    const loginResponse = redirectResponse(
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

    if (
      sessionData.type === "user" &&
      sessionData.role === "eleve" &&
      deviceCookieValue
    ) {
      loginResponse.headers.append(
        "Set-Cookie",
        `${DEVICE_COOKIE_NAME}=${deviceCookieValue}; ` +
          `Path=/; ` +
          `Max-Age=${DEVICE_COOKIE_DURATION}; ` +
          "HttpOnly; Secure; SameSite=Lax"
      );
    }

    return loginResponse;
  }

  if (
    path === "/change-password" &&
    request.method === "POST"
  ) {
   
    const session = await readValidSession(
      request,
      context.env
    );

    if (!session || session.type !== "user") {
      return redirectResponse(
        request,
        "/login?error=1",
        303,
        {
          "Set-Cookie":
            `${COOKIE_NAME}=; ` +
            "Path=/; Max-Age=0; " +
            "HttpOnly; Secure; SameSite=Lax"
        }
      );
    }

    let formData;

    try {
      formData = await request.formData();
    } catch {
      return redirectResponse(
        request,
        "/change-password?error=update"
      );
    }

    const currentPassword =
      String(formData.get("currentPassword") || "");

    const newPassword =
      String(formData.get("newPassword") || "");

    const confirmation =
      String(formData.get("confirmation") || "");

    if (newPassword.length < 12) {
      return redirectResponse(
        request,
        "/change-password?error=length"
      );
    }

    if (newPassword !== confirmation) {
      return redirectResponse(
        request,
        "/change-password?error=mismatch"
      );
    }

    try {
      const currentUser = await context.env.DB
        .prepare(`
          SELECT password_hash, password_salt
          FROM users
          WHERE username = ?
            AND active = 1
          LIMIT 1
        `)
        .bind(session.username)
        .first();

      if (
        !currentUser ||
        !await verifyPassword(currentPassword, currentUser)
      ) {
        return redirectResponse(
          request,
          "/change-password?error=current"
        );
      }

      if (!passwordIsSufficientlyDifferent(currentPassword, newPassword)) {
        return redirectResponse(
          request,
          "/change-password?error=similarity"
        );
      }

      const salt =
        crypto.getRandomValues(new Uint8Array(16));

      const passwordHash =
        await hashPassword(newPassword, salt);

      await context.env.DB
        .prepare(`
          UPDATE users
          SET
            password_hash = ?,
            password_salt = ?,
            must_change_password = 0,
            session_version = session_version + 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE username = ?
            AND active = 1
        `)
        .bind(
          passwordHash,
          bytesToBase64(salt),
          session.username
        )
        .run();

      const updatedUser = await context.env.DB
        .prepare(`
          SELECT
            username,
            role,
            active,
            session_version
          FROM users
          WHERE username = ?
          LIMIT 1
        `)
        .bind(session.username)
        .first();

      if (
        !updatedUser ||
        Number(updatedUser.active) !== 1
      ) {
        return redirectResponse(
          request,
          "/login?error=1"
        );
      }

      if (
        updatedUser.role === "eleve" &&
        session.sessionId
      ) {
        await context.env.DB.prepare(`
          UPDATE active_user_sessions
          SET
            session_version = ?,
            last_seen_at = CURRENT_TIMESTAMP,
            expires_at = ?
          WHERE username = ?
            AND session_id = ?
        `).bind(
          Number(updatedUser.session_version),
          Math.floor(Date.now() / 1000) +
            SESSION_DURATION,
          updatedUser.username,
          session.sessionId
        ).run();
      }

      const token = await createSessionToken(
        context.env,
        {
          type: "user",
          username: updatedUser.username,
          role: updatedUser.role,
          session_version:
            Number(updatedUser.session_version),
          ...(session.sessionId
            ? { sid: session.sessionId }
            : {})
        }
      );

      return redirectResponse(
        request,
        "/",
        303,
        {
          "Set-Cookie":
            `${COOKIE_NAME}=${token}; ` +
            `Path=/; ` +
            `Max-Age=${SESSION_DURATION}; ` +
            "HttpOnly; Secure; SameSite=Lax"
        }
      );
    } catch {
      return redirectResponse(
        request,
        "/change-password?error=update"
      );
    }
  }

  if (path === "/logout") {
    const session = await readValidSession(
      request,
      context.env
    );

    if (
      session?.role === "eleve" &&
      session.sessionId
    ) {
      try {
        await context.env.DB.prepare(`
          DELETE FROM active_user_sessions
          WHERE username = ?
            AND session_id = ?
        `).bind(
          session.username,
          session.sessionId
        ).run();
      } catch (error) {
        console.error(
          "Fermeture de la session élève :",
          error
        );
      }
    }

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

  const session = await readValidSession(
    request,
    context.env
  );

  if (!session) {
    const hadSessionCookie =
      Boolean(readCookie(request, COOKIE_NAME));

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

    if (hadSessionCookie) {
      loginUrl.searchParams.set(
        "error",
        "session"
      );
    }

    const invalidSessionResponse = redirectResponse(
      request,
      `${loginUrl.pathname}${loginUrl.search}`,
      302
    );

    if (hadSessionCookie) {
      invalidSessionResponse.headers.append(
        "Set-Cookie",
        `${COOKIE_NAME}=; ` +
          "Path=/; Max-Age=0; " +
          "HttpOnly; Secure; SameSite=Lax"
      );
    }

    return invalidSessionResponse;
  }

  /*
   * Rend la session validée accessible
   * aux Functions exécutées après le middleware.
   */
  context.data.session = session;

  /*
   * Aucun espace fonctionnel ni aucune API métier n'est accessible
   * tant que le mot de passe provisoire n'a pas été remplacé.
   */
  if (
    session.type === "user" &&
    session.mustChangePassword
  ) {
    if (
      path === "/change-password" &&
      request.method === "GET"
    ) {
      const response = await context.next();
      return noStoreResponse(response);
    }

    return redirectResponse(
      request,
      "/change-password",
      302
    );
  }

  /*
   * Le visiteur peut parcourir la structure du site,
   * mais ne reçoit jamais les véritables fiches Markdown
   * ni les photographies internes.
   */
  if (
    session.type === "user" &&
    session.role === "visiteur" &&
    (
      path.startsWith("/content/") ||
      path.startsWith("/assets/photos/")
    )
  ) {
    return new Response(
      "Contenu masqué en mode visiteur.",
      {
        status: 403,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store"
        }
      }
    );
  }

  if (
    (path === "/me" || path === "/me/") &&
    request.method === "GET"
  ) {
    let roleLabel = "utilisateur";

    if (session.type === "collective") {
      roleLabel = "accès collectif";
    } else if (session.role === "admin") {
      roleLabel = "administrateur";
    } else if (session.role === "cdu") {
      roleLabel = "CDU";
    } else if (session.role === "cadre") {
      roleLabel = "cadre";
    } else if (session.role === "eleve") {
      roleLabel = "élève";
    } else if (session.role === "visiteur") {
      roleLabel = "visiteur";
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        username: session.username || null,
        role: session.role || null,
        type: session.type || null,
        roleLabel
      }),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
          "Cache-Control": "private, no-store"
        }
      }
    );
  }

  if (
    path.startsWith("/cadres/") ||
    path === "/service" ||
    path === "/service/" ||
    path === "/service.html" ||
    path === "/sanctions" ||
    path === "/notations" ||
    path === "/notations/" ||
    path === "/notations.html"
  ) {
    if (
      session.type !== "user" ||
      !["cadre", "cdu", "admin"].includes(session.role)
    ) {
      const isApi = path.startsWith("/cadres/");
      return new Response(
        isApi
          ? JSON.stringify({ error: "Accès cadre requis." })
          : "Accès réservé aux cadres.",
        {
          status: 403,
          headers: {
            "Content-Type": isApi
              ? "application/json; charset=utf-8"
              : "text/plain; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }

    const response = await context.next();
    return noStoreResponse(response);
  }

  if (path.startsWith("/admin/")) {
    if (
      session.type !== "user" ||
      session.role !== "admin"
    ) {
      return new Response(
        JSON.stringify({
          error: "Accès administrateur requis."
        }),
        {
          status: 403,
          headers: {
            "Content-Type":
              "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }

    const response = await context.next();
    return noStoreResponse(response);
  }

  if (
    path === "/change-password" &&
    request.method === "GET"
  ) {
    return redirectResponse(
      request,
      "/",
      302
    );
  }

  if (
    path === "/administration" &&
    request.method === "GET"
  ) {
    if (
      session.type !== "user" ||
      !["admin", "visiteur"].includes(session.role)
    ) {
      return new Response(
        "Accès réservé aux administrateurs et aux visiteurs autorisés.",
        {
          status: 403,
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }

    const response = await context.next();
    return noStoreResponse(response);
  }

  const response = await context.next();
  return noStoreResponse(response);
}
