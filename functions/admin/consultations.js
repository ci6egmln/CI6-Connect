function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store"}});}
async function readSetting(database,key){const row=await database.prepare(`SELECT value FROM settings WHERE key=? LIMIT 1`).bind(key).first();return row?String(row.value||""):"";}
export async function onRequestGet(context){
 const url=new URL(context.request.url), search=String(url.searchParams.get("username")||"").trim(), mode=String(url.searchParams.get("mode")||"screen").trim(), wholeCompany=search==="******";
 if(!search) return jsonResponse({error:"Saisissez un identifiant, un nom, un prénom, un peloton ou ******."},400);
 if(mode!=="screen"&&mode!=="export") return jsonResponse({error:"Mode de consultation invalide."},400);
 try{
  const incorporationDate=await readSetting(context.env.DB,"incorporation_date");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(incorporationDate)) return jsonResponse({error:"La date d’incorporation n’est pas encore renseignée dans les paramètres de la promotion."},400);
  let resolvedUsername=null;
  if(!wholeCompany){
   const matches=await context.env.DB.prepare(`
    SELECT u.username,d.nom,d.prenom,d.peloton
    FROM users u JOIN discipline_students d ON d.nigend=u.username
    WHERE u.role='eleve' AND u.active=1 AND (
      UPPER(u.username)=UPPER(?) OR LOWER(d.nom) LIKE LOWER(?) OR
      LOWER(COALESCE(d.prenom,'')) LIKE LOWER(?) OR LOWER(COALESCE(d.peloton,'')) LIKE LOWER(?)
    ) ORDER BY d.nom COLLATE NOCASE,d.prenom LIMIT 20
   `).bind(search,`%${search}%`,`%${search}%`,`%${search}%`).all();
   const rows=matches.results||[];
   if(!rows.length) return jsonResponse({error:"Aucun élève trouvé."},404);
   const exact=rows.find(r=>String(r.username).toUpperCase()===search.toUpperCase());
   if(exact) resolvedUsername=exact.username;
   else if(rows.length===1) resolvedUsername=rows[0].username;
   else return jsonResponse({error:"Plusieurs élèves correspondent. Précisez le nom, le prénom, le peloton ou utilisez l’identifiant.",matches:rows},409);
  }
  const limitClause=mode==="screen"?"LIMIT 10":"";
  const base=`SELECT c.id,c.username,c.role,c.fiche_id,c.fiche_title,c.fiche_path,c.fiche_version,c.promotion,c.opened_at,c.closed_at,d.nom,d.prenom,d.peloton FROM fiche_consultations c LEFT JOIN discipline_students d ON d.nigend=c.username`;
  const result=wholeCompany
   ? await context.env.DB.prepare(`${base} WHERE c.role='eleve' AND c.opened_at>=? ORDER BY c.opened_at DESC ${limitClause}`).bind(`${incorporationDate} 00:00:00`).all()
   : await context.env.DB.prepare(`${base} WHERE c.username=? AND c.role='eleve' AND c.opened_at>=? ORDER BY c.opened_at DESC ${limitClause}`).bind(resolvedUsername,`${incorporationDate} 00:00:00`).all();
  const consultations=(result.results||[]).map(row=>({id:row.id,username:row.username,role:row.role,nom:[row.nom,row.prenom].filter(Boolean).join(" "),peloton:row.peloton||"",ficheId:row.fiche_id,ficheTitle:row.fiche_title,fichePath:row.fiche_path,ficheVersion:row.fiche_version,promotion:row.promotion,openedAt:row.opened_at,closedAt:row.closed_at}));
  return jsonResponse({success:true,mode,wholeCompany,studentsOnly:true,incorporationDate,count:consultations.length,consultations});
 }catch(error){console.error("Erreur consultations",error);return jsonResponse({error:"Impossible de lire les consultations.",details:error instanceof Error?error.message:String(error)},500);}
}
