function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function formatUser(user) {
  const studentName = user.student_nom || "";
  const studentFirstName = user.student_prenom || "";
  return {
    username: user.username,
    nom: studentName || user.nom || "",
    prenom: studentName ? studentFirstName : "",
    peloton: user.student_peloton || "",
    promotion: user.student_promotion || "",
    displayName: studentName ? [studentName, studentFirstName].filter(Boolean).join(" ") : (user.nom || ""),
    active: Number(user.active) === 1,
    role: user.role,
    mustChangePassword: Number(user.must_change_password) === 1,
    sessionVersion: Number(user.session_version),
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const query = String(url.searchParams.get("q") || url.searchParams.get("username") || "").trim();
  if (!query) return jsonResponse({ error: "Saisissez un identifiant, un nom, un prénom ou un peloton." }, 400);
  if (query.length < 2 && !/^[A-Za-z]{3}\d{3}$/.test(query)) return jsonResponse({ error: "Saisissez au moins 2 caractères." }, 400);
  try {
    const normalized=query.toUpperCase();
    const result = await context.env.DB.prepare(`
      SELECT u.username,u.nom,u.active,u.role,u.must_change_password,
             u.session_version,u.created_at,u.updated_at,
             d.nom AS student_nom,d.prenom AS student_prenom,
             d.peloton AS student_peloton,d.promotion AS student_promotion
      FROM users u
      LEFT JOIN discipline_students d ON d.nigend=u.username
      WHERE UPPER(u.username)=?
         OR LOWER(COALESCE(u.nom,'')) LIKE LOWER(?)
         OR LOWER(COALESCE(d.nom,'')) LIKE LOWER(?)
         OR LOWER(COALESCE(d.prenom,'')) LIKE LOWER(?)
         OR LOWER(COALESCE(d.peloton,'')) LIKE LOWER(?)
      ORDER BY COALESCE(d.nom,u.nom) COLLATE NOCASE, COALESCE(d.prenom,''), u.username
      LIMIT 30
    `).bind(normalized,`%${query}%`,`%${query}%`,`%${query}%`,`%${query}%`).all();
    const users=(result.results||[]).map(formatUser);
    if(!users.length) return jsonResponse({error:"Aucun compte trouvé."},404);
    if(users.length===1) return jsonResponse({success:true,user:users[0]});
    return jsonResponse({success:true,users});
  } catch(error){
    return jsonResponse({error:"Impossible de consulter les comptes.",details:error instanceof Error?error.message:String(error)},500);
  }
}
