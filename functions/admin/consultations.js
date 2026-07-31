function jsonResponse(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"private, no-store"
    }
  });
}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const username=String(url.searchParams.get("username")||"").trim();
  const startDate=String(url.searchParams.get("startDate")||"").trim();
  const mode=String(url.searchParams.get("mode")||"screen").trim();
  const wholeCompany=username==="******";

  if(!wholeCompany&&!/^\d{6}$/.test(username)){
    return jsonResponse({error:"Le NIGEND doit contenir six chiffres ou ******."},400);
  }

  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)){
    return jsonResponse({error:"La date d’incorporation est invalide."},400);
  }

  if(mode!=="screen"&&mode!=="export"){
    return jsonResponse({error:"Mode de consultation invalide."},400);
  }

  const limitClause=mode==="screen"?"LIMIT 10":"";

  const query=wholeCompany
    ? `
        SELECT id,username,role,fiche_id,fiche_title,fiche_path,
               fiche_version,promotion,opened_at,closed_at
        FROM fiche_consultations
        WHERE opened_at >= ?
        ORDER BY opened_at DESC
        ${limitClause}
      `
    : `
        SELECT id,username,role,fiche_id,fiche_title,fiche_path,
               fiche_version,promotion,opened_at,closed_at
        FROM fiche_consultations
        WHERE username = ?
          AND opened_at >= ?
        ORDER BY opened_at DESC
        ${limitClause}
      `;

  try{
    const statement=context.env.DB.prepare(query);
    const result=wholeCompany
      ? await statement.bind(`${startDate} 00:00:00`).all()
      : await statement.bind(username,`${startDate} 00:00:00`).all();

    const consultations=(result.results||[]).map(row=>({
      id:row.id,
      username:row.username,
      role:row.role,
      ficheId:row.fiche_id,
      ficheTitle:row.fiche_title,
      fichePath:row.fiche_path,
      ficheVersion:row.fiche_version,
      promotion:row.promotion,
      openedAt:row.opened_at,
      closedAt:row.closed_at
    }));

    return jsonResponse({
      success:true,
      mode,
      wholeCompany,
      count:consultations.length,
      consultations
    });
  }catch(error){
    console.error("Erreur consultations",error);
    return jsonResponse({error:"Impossible de lire les consultations."},500);
  }
}
