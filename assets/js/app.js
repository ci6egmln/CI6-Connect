function slugPage(r){return `pages/${r.id}.html`}
function renderNav(active){
 const el=document.getElementById('nav-rubriques'); if(!el) return;
 el.innerHTML=RUBRIQUES.map(r=>`<a class="${active===r.id?'active':''}" href="${active?'../':''}${active? r.id+'.html':slugPage(r)}"><span class="badge">${r.n}</span><span>${r.title}</span></a>`).join('');
}
function renderCards(){
 const el=document.getElementById('cards'); if(!el) return;
 el.innerHTML=RUBRIQUES.map(r=>`<a class="card" href="${slugPage(r)}"><span class="card-number">${r.n}</span><div class="card-icon">${r.icon}</div><h3>${r.title}</h3><p>${r.short}</p><span class="btn">Voir plus</span></a>`).join('');
}
function renderPage(){
 const id=document.body.dataset.page; if(!id) return;
 const r=RUBRIQUES.find(x=>x.id===id), d=DETAILS[id];
 document.title=`${r.title} — CI6 Connect`;
 document.getElementById('page-title').textContent=r.title;
 document.getElementById('page-number').textContent=String(r.n).padStart(2,'0');
 document.getElementById('page-icon').textContent=r.icon;
 document.getElementById('objectif').textContent=d.objectif;
 for(const key of ['retenir','consignes','vigilance']){
   const ul=document.getElementById(key);
   ul.innerHTML=d[key].map(x=>`<li>${x}</li>`).join('');
 }
}
function initSearch(){
 const input=document.getElementById('search'); if(!input) return;
 input.addEventListener('input',()=>{
  const q=input.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  document.querySelectorAll('.card').forEach((card,i)=>{
    const r=RUBRIQUES[i]; const txt=(r.title+' '+r.short).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    card.classList.toggle('hidden', q && !txt.includes(q));
  });
 });
}
document.addEventListener('DOMContentLoaded',()=>{renderNav(document.body.dataset.page); renderCards(); renderPage(); initSearch();});
