function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}

function validUserSession(session) {
  return Boolean(
    session &&
    session.type === "user" &&
    ["eleve", "cadre", "admin"].includes(session.role)
  );
}

function validEndpoint(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
}

export async function onRequestPost(context) {
  const session = context.data?.session;
  if (!validUserSession(session)) {
    return jsonResponse({ error: "Compte utilisateur requis." }, 403);
  }

  let body;
  try { body = await context.request.json(); }
  catch { return jsonResponse({ error: "Requête invalide." }, 400); }

  const subscription = body?.subscription || body;
  const endpoint = validEndpoint(subscription?.endpoint);
  const p256dh = String(subscription?.keys?.p256dh || "").trim();
  const auth = String(subscription?.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth) {
    return jsonResponse({ error: "Abonnement Push incomplet." }, 400);
  }
  if (endpoint.length > 2000 || p256dh.length > 300 || auth.length > 300) {
    return jsonResponse({ error: "Abonnement Push trop volumineux." }, 413);
  }

  await context.env.DB.prepare(`
    INSERT INTO push_subscriptions (
      username, role, endpoint, p256dh, auth, user_agent, created_at, updated_at, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT(endpoint) DO UPDATE SET
      username = excluded.username,
      role = excluded.role,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      updated_at = CURRENT_TIMESTAMP,
      last_error = NULL
  `).bind(
    session.username,
    session.role,
    endpoint,
    p256dh,
    auth,
    String(context.request.headers.get("User-Agent") || "").slice(0, 500)
  ).run();

  return jsonResponse({ success: true });
}
