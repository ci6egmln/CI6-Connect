function jsonResponse(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"private, no-store"
    }
  });
}

async function readSetting(database,key){
  const row=await database.prepare(`
    SELECT value
    FROM settings
    WHERE key = ?
    LIMIT 1
  `).bind(key).first();

  return row?String(row.value||""):"";
}

export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const username=String(url.searchParams.get("username")||"").trim();
  const mode=String(url.searchParams.get("mode")||"screen").trim();
  const wholeCompany=username==="******";

  if(!wholeCompany&&!/^\d{6}$/.test(username)){
    return jsonResponse({
      error:"Le NIGEND doit contenir six chiffres ou ******."
    },400);
  }

  if(mode!=="screen"&&mode!=="export"){
    return jsonResponse({
      error:"Mode de consultation invalide."
    },400);
  }

  try{
    const incorporationDate=
      await readSetting(
        context.env.DB,
        "incorporation_date"
      );

    if(!/^\d{4}-\d{2}-\d{2}$/.test(incorporationDate)){
      return jsonResponse({
        error:
          "La date d’incorporation n’est pas encore renseignée dans les paramètres de la promotion."
      },400);
    }

    const limitClause=
      mode==="screen"
        ?"LIMIT 10"
        :"";

    const query=wholeCompany
      ? `
          SELECT id,username,role,fiche_id,fiche_title,fiche_path,
                 fiche_version,promotion,opened_at,closed_at
          FROM fiche_consultations
          WHERE role = 'eleve'
            AND opened_at >= ?
          ORDER BY opened_at DESC
          ${limitClause}
        `
      : `
          SELECT id,username,role,fiche_id,fiche_title,fiche_path,
                 fiche_version,promotion,opened_at,closed_at
          FROM fiche_consultations
          WHERE username = ?
            AND role = 'eleve'
            AND opened_at >= ?
          ORDER BY opened_at DESC
          ${limitClause}
        `;

    const statement=
      context.env.DB.prepare(query);

    const result=wholeCompany
      ? await statement
          .bind(`${incorporationDate} 00:00:00`)
          .all()
      : await statement
          .bind(
            username,
            `${incorporationDate} 00:00:00`
          )
          .all();

    const consultations=
      (result.results||[]).map(row=>({
        id:row.id,
        username:row.username,
        role:row.role,
        nom:row.nom || "",
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
      studentsOnly:true,
      incorporationDate,
      count:consultations.length,
      consultations
    });

  }catch(error){
    console.error(
      "Erreur consultations",
      error
    );

    return jsonResponse({
      error:
        "Impossible de lire les consultations."
    },500);
  }
}
