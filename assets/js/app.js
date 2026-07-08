const grid = document.getElementById("cardsGrid");
const searchInput = document.getElementById("searchInput");
const homeView = document.getElementById("homeView");
const detailView = document.getElementById("detailView");
const detailContent = document.getElementById("detailContent");
const backBtn = document.getElementById("backBtn");

function normalizeText(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function renderCards(filter = "") {
  const q = normalizeText(filter);
  const rubriques = window.CI6_RUBRIQUES.filter(item => {
    return normalizeText(item.title + " " + item.description).includes(q);
  });

  grid.innerHTML = rubriques.map(item => `
    <button class="tile" data-content="${item.content}" aria-label="${item.title}">
      <img class="tile-bg" src="${item.card}" alt="">
      <span class="tile-number">${item.id}</span>
      <span class="tile-shine"></span>
      <span class="tile-text">
        <strong>${item.title}</strong>
        <em>${item.description}</em>
      </span>
    </button>
  `).join("");

  document.querySelectorAll(".tile").forEach(tile => {
    tile.addEventListener("click", () => openContent(tile.dataset.content));
  });
}

function parseFrontMatter(markdown) {
  if (!markdown.startsWith("---")) return { body: markdown, meta: {} };
  const end = markdown.indexOf("---", 3);
  if (end === -1) return { body: markdown, meta: {} };
  const raw = markdown.slice(3, end).trim();
  const body = markdown.slice(end + 3).trim();
  const meta = {};
  raw.split("\n").forEach(line => {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) return;
    meta[key.trim()] = rest.join(":").trim().replace(/^"|"$/g, "");
  });
  return { body, meta };
}

function markdownToHtml(md) {
  let html = md
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^\- (.*$)/gim, "<li>$1</li>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");

  html = html.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/gim, "");
  html = html.split(/\n{2,}/).map(block => {
    const b = block.trim();
    if (!b) return "";
    if (b.startsWith("<h") || b.startsWith("<ul")) return b;
    return `<p>${b.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
  return html;
}

async function openContent(path) {
  try {
    const response = await fetch(path);
    const markdown = await response.text();
    const parsed = parseFrontMatter(markdown);
    detailContent.innerHTML = markdownToHtml(parsed.body);
    homeView.hidden = true;
    detailView.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    detailContent.innerHTML = "<h1>Erreur</h1><p>Impossible de charger cette fiche.</p>";
    homeView.hidden = true;
    detailView.hidden = false;
  }
}

backBtn.addEventListener("click", () => {
  detailView.hidden = true;
  homeView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

searchInput.addEventListener("input", e => renderCards(e.target.value));

renderCards();
