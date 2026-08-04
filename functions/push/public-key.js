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

export async function onRequestGet(context) {
  if (!validUserSession(context.data?.session)) {
    return jsonResponse({ error: "Compte utilisateur requis." }, 403);
  }
  const publicKey = String(context.env.VAPID_PUBLIC_KEY || "").trim();
  if (!publicKey) return jsonResponse({ error: "Clé VAPID publique absente." }, 500);
  return jsonResponse({ publicKey });
}
