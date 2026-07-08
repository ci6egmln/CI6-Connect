
const cardsEl = document.getElementById('cards');
const searchInput = document.getElementById('searchInput');
const detail = document.getElementById('detail');
const detailIcon = document.getElementById('detailIcon');
const detailNum = document.getElementById('detailNum');
const detailTitle = document.getElementById('detailTitle');
const detailContent = document.getElementById('detailContent');
const backBtn = document.getElementById('backBtn');

function renderCards(list = RUBRIQUES){
  cardsEl.innerHTML = list.map(item => `
    <button class="card" type="button" data-id="${item.id}" style="--bgimg:url('${item.background}')">
      <span class="card-num">${item.num}</span>
      <span class="card-content">
        <img src="${item.icon}" alt="" loading="lazy" />
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
      </span>
    </button>
  `).join('');
}

function mdToHtml(md){
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/(?:^|\n)(- .*(?:\n- .*)*)/g, block => {
    const items = block.trim().split('\n').map(line => '<li>'+line.replace(/^- /,'')+'</li>').join('');
    return '<ul>'+items+'</ul>';
  });
  return html.split(/\n{2,}/).map(part => {
    const t = part.trim();
    if(!t) return '';
    if(t.startsWith('<h') || t.startsWith('<ul')) return t;
    return '<p>'+t.replace(/\n/g,'<br>')+'</p>';
  }).join('\n');
}

async function openRubrique(id){
  const item = RUBRIQUES.find(r => r.id === id);
  if(!item) return;
  const res = await fetch(item.content);
  const md = await res.text();
  detailIcon.src = item.icon;
  detailNum.textContent = `FICHE ${item.num}`;
  detailTitle.textContent = item.title;
  detailContent.innerHTML = mdToHtml(md);
  cardsEl.classList.add('hidden');
  document.querySelector('.search-zone').classList.add('hidden');
  detail.classList.remove('hidden');
  window.scrollTo({top:0, behavior:'smooth'});
}

cardsEl.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if(card) openRubrique(card.dataset.id);
});
backBtn.addEventListener('click', () => {
  detail.classList.add('hidden');
  cardsEl.classList.remove('hidden');
  document.querySelector('.search-zone').classList.remove('hidden');
  history.replaceState(null, '', 'index.html');
  window.scrollTo({top:0, behavior:'smooth'});
});
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filtered = RUBRIQUES.filter(item => (item.num+' '+item.title+' '+item.desc).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
  renderCards(filtered);
});
renderCards();
