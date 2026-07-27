function refuseAccess() {
  return new Response(
    "Accès réservé aux personnels autorisés.",
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="CI6 Connect", charset="UTF-8"',
        "Cache-Control": "no-store"
      }
    }
  );
}
export async function onRequest(context) {
  const authorization =
    context.request.headers.get("Authorization");
  if (!authorization?.startsWith("Basic ")) {
    return refuseAccess();
  }
  let credentials;
  try {
    credentials = atob(authorization.slice(6));
  } catch {
    return refuseAccess();
  }
  const separator = credentials.indexOf(":");
  if (separator === -1) {
    return refuseAccess();
  }
  const username = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  if (
    username !== context.env.SITE_USERNAME ||
    password !== context.env.SITE_PASSWORD
  ) {
    return refuseAccess();
  }
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
