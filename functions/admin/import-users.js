const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;
const MAX_USERS_PER_BATCH = 10;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" } });
}
function bytesToBase64(bytes) { let binary=""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
async function hashPassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), {name:"PBKDF2"}, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt, iterations:PBKDF2_ITERATIONS}, keyMaterial, 256);
  return bytesToBase64(new Uint8Array(bits));
}
function secureRandomIndex(length) { const v=new Uint32Array(1); crypto.getRandomValues(v); return v[0]%length; }
function randomItem(items){ return items[secureRandomIndex(items.length)]; }
function randomNumber(min,max){ const v=new Uint32Array(1); crypto.getRandomValues(v); return min+(v[0]%(max-min+1)); }
function createTemporaryPassword(){
 const a=["Dragon","Rempart","Fanion","Cobalt","Rivage","Sentinelle","Bastion","Orage","Saphir","Lynx","Aigle","Horizon"];
 const b=["Vaillant","Solide","Rapide","Argente","Dore","Robuste","Calme","Fidele","Brave","Victoire","Etoile","Altitude"];
 return `${randomItem(a)}-${randomItem(b)}-${randomNumber(10,99)}`;
}
function normalizeRole(v){ const r=String(v||"").trim().toLowerCase(); return r==="élève"?"eleve":r; }
function candidateIdentifier(){
 const letters="ABCDEFGHJKLMNPQRSTUVWXYZ";
 let id="";
 for(let i=0;i<3;i++) id+=letters[secureRandomIndex(letters.length)];
 for(let i=0;i<3;i++) id+=String(secureRandomIndex(10));
 return id;
}
async function generateUniqueIdentifier(db,reserved){
 for(let attempt=0;attempt<100;attempt++){
  const candidate=candidateIdentifier();
  if(reserved.has(candidate)) continue;
  const row=await db.prepare(`SELECT 1 FROM users WHERE username=? LIMIT 1`).bind(candidate).first();
  if(!row){ reserved.add(candidate); return candidate; }
 }
 throw new Error("Impossible de générer un identifiant unique.");
}
async function ensureDisciplineSchema(db){
 await db.batch([
  db.prepare(`CREATE TABLE IF NOT EXISTS discipline_students (nigend TEXT PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT, peloton TEXT NOT NULL DEFAULT '', promotion TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
  db.prepare(`CREATE TABLE IF NOT EXISTS discipline_sanctions (id INTEGER PRIMARY KEY AUTOINCREMENT, student_nigend TEXT NOT NULL, sanction_type TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, reason_code TEXT, reason_free TEXT, observations TEXT, sanction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT, updated_at TEXT, deleted_at TEXT, deleted_by TEXT, FOREIGN KEY(student_nigend) REFERENCES discipline_students(nigend))`),
  db.prepare(`CREATE TABLE IF NOT EXISTS discipline_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, sanction_id INTEGER, action TEXT NOT NULL, actor_username TEXT NOT NULL, previous_data TEXT, new_data TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
 ]);
}
export async function onRequestPost(context){
 if(!context.env.DB) return jsonResponse({error:"Liaison D1 indisponible."},500);
 let body; try{ body=await context.request.json(); }catch{return jsonResponse({error:"Requête JSON invalide."},400);}
 if(!Array.isArray(body.users)) return jsonResponse({error:"La liste des comptes est absente."},400);
 if(body.users.length===0||body.users.length>MAX_USERS_PER_BATCH) return jsonResponse({error:`Chaque lot doit contenir entre 1 et ${MAX_USERS_PER_BATCH} comptes.`},400);
 const users=[],errors=[];
 body.users.forEach((raw,index)=>{
  const nom=String(raw.nom||"").trim(), prenom=String(raw.prenom||"").trim(), peloton=String(raw.peloton||"").trim(), promotion=String(raw.promotion||"").trim(), role=normalizeRole(raw.role), lineNumber=Number(raw.lineNumber||index+1);
  if(!nom||nom.length>120) errors.push({lineNumber,error:"Le nom est obligatoire et limité à 120 caractères."});
  else if(prenom.length>120) errors.push({lineNumber,error:"Le prénom est limité à 120 caractères."});
  else if(!["eleve","cadre"].includes(role)) errors.push({lineNumber,error:"Le rôle doit être eleve ou cadre."});
  else if(role==="eleve"&&!peloton) errors.push({lineNumber,error:"Le peloton est obligatoire pour un élève."});
  else users.push({nom,prenom,peloton,promotion,role,lineNumber});
 });
 if(errors.length) return jsonResponse({error:"Le lot contient des données invalides.",errors},400);
 try{
  await ensureDisciplineSchema(context.env.DB);
  const reserved=new Set(), created=[];
  for(const u of users){
   const username=await generateUniqueIdentifier(context.env.DB,reserved);
   const temporaryPassword=createTemporaryPassword();
   const salt=crypto.getRandomValues(new Uint8Array(16));
   const passwordHash=await hashPassword(temporaryPassword,salt);
   created.push({...u,username,temporaryPassword,passwordHash,passwordSalt:bytesToBase64(salt)});
  }
  const statements=[];
  for(const u of created){
   statements.push(context.env.DB.prepare(`INSERT INTO users (username,nom,password_hash,password_salt,active,role,must_change_password,session_version) VALUES (?,?,?,?,1,?,1,1)`).bind(u.username,[u.nom,u.prenom].filter(Boolean).join(" "),u.passwordHash,u.passwordSalt,u.role));
   if(u.role==="eleve") statements.push(context.env.DB.prepare(`INSERT INTO discipline_students (nigend,nom,prenom,peloton,promotion,active,updated_at) VALUES (?,?,?,?,?,1,CURRENT_TIMESTAMP)`).bind(u.username,u.nom,u.prenom,u.peloton,u.promotion));
  }
  if(statements.length) await context.env.DB.batch(statements);
  return jsonResponse({success:true,created:created.map(u=>({username:u.username,nom:u.nom,prenom:u.prenom,peloton:u.peloton,promotion:u.promotion,displayName:[u.nom,u.prenom].filter(Boolean).join(" "),role:u.role,temporaryPassword:u.temporaryPassword,lineNumber:u.lineNumber,status:"created"})),existing:[],summary:{requested:users.length,created:created.length,existing:0,students:users.filter(u=>u.role==="eleve").length}});
 }catch(error){ return jsonResponse({error:"L’import du lot a échoué.",details:error instanceof Error?error.message:String(error)},500); }
}
