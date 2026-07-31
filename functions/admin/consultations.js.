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
  const requested=Number(url.searchParams.get("limit")||200);
  const limit=Math.min(200,Math.max(1,Number.isFinite(requested)?Math.floor(requested):200));

  if(!/^\d{6}$/.test(username)){
    return jsonResponse({
      error:"Le NIGEND doit contenir exactement six chiffres."
    },400);
  }

  try{
    const result=await context.env.DB.prepare(`
      SELECT
        id,
        username,
        role,
        fiche_id,
        fiche_title,
        fiche_path,
        fiche_version,
        promotion,
        opened_at,
        closed_at
      FROM fiche_consultations
      WHERE username = ?
      ORDER BY opened_at DESC
      LIMIT ?
    `).bind(username,limit).all();

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
      count:consultations.length,
      consultations
    });
  }catch(error){
    console.error("Erreur consultations",error);
    return jsonResponse({
      error:"Impossible de lire les consultations."
    },500);
  }
}
