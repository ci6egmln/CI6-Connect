function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" } });
}
function validType(v){ return ["rappel_verbal","compte_rendu_ecrit","lettre_observation","tours_consigne","jours_arret"].includes(v); }
export async function onRequestPut(context){
  const db=context.env.DB, actor=context.data.session?.username, id=Number(context.params.id);
  if(!db||!actor||!Number.isInteger(id)) return json({error:"Requête invalide."},400);
  const old=await db.prepare(`SELECT * FROM discipline_sanctions WHERE id=? AND deleted_at IS NULL`).bind(id).first();
  if(!old) return json({error:"Sanction introuvable."},404);
  let b; try{b=await context.request.json();}catch{return json({error:"Requête JSON invalide."},400);}
  const type=String(b.sanction_type||"").trim(), quantity=Math.max(1,Math.min(365,Number(b.quantity||1))), reasonCode=String(b.reason_code||"").trim(), reasonFree=String(b.reason_free||"").trim(), observations=String(b.observations||"").trim(), date=String(b.sanction_date||"").trim();
  if(!validType(type)||(!reasonCode&&!reasonFree)||!date) return json({error:"Données incomplètes."},400);
  const next={sanction_type:type,quantity,reason_code:reasonCode,reason_free:reasonFree,observations,sanction_date:date};
  await db.batch([
    db.prepare(`UPDATE discipline_sanctions SET sanction_type=?,quantity=?,reason_code=?,reason_free=?,observations=?,sanction_date=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(type,quantity,reasonCode,reasonFree,observations,date,actor,id),
    db.prepare(`INSERT INTO discipline_audit_log (sanction_id,action,actor_username,previous_data,new_data) VALUES (?,'update',?,?,?)`).bind(id,actor,JSON.stringify(old),JSON.stringify(next))
  ]);
  return json({success:true});
}
export async function onRequestDelete(context){
  const db=context.env.DB, session=context.data.session, id=Number(context.params.id);
  if(!db||!session?.username||!Number.isInteger(id)) return json({error:"Requête invalide."},400);
  if(session.role!=="admin") return json({error:"Suppression réservée aux administrateurs."},403);
  const old=await db.prepare(`SELECT * FROM discipline_sanctions WHERE id=? AND deleted_at IS NULL`).bind(id).first();
  if(!old) return json({error:"Sanction introuvable."},404);
  await db.batch([
    db.prepare(`UPDATE discipline_sanctions SET deleted_at=CURRENT_TIMESTAMP,deleted_by=? WHERE id=?`).bind(session.username,id),
    db.prepare(`INSERT INTO discipline_audit_log (sanction_id,action,actor_username,previous_data) VALUES (?,'delete',?,?)`).bind(id,session.username,JSON.stringify(old))
  ]);
  return json({success:true});
}
