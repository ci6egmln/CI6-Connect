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

export async function onRequestPost(context) {
  const session = context.data?.session;
  if (!validUserSession(session)) {
    return jsonResponse({ error: "Compte utilisateur requis." }, 403);
  }
  let body;
  try { body = await context.request.json(); }
  catch { return jsonResponse({ error: "Requête invalide." }, 400); }
  const endpoint = String(body?.endpoint || "").trim();
  if (!endpoint) return jsonResponse({ error: "Endpoint manquant." }, 400);
  await context.env.DB.prepare(`
    DELETE FROM push_subscriptions
    WHERE endpoint = ? AND username = ?
  `).bind(endpoint, session.username).run();
  return jsonResponse({ success: true });
}
