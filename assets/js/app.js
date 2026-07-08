const grid = document.getElementById("cardsGrid");
const searchInput = document.getElementById("searchInput");
const homeView = document.getElementById("homeView");
const detailView = document.getElementById("detailView");
const detailContent = document.getElementById("detailContent");
const backBtn = document.getElementById("backBtn");

function normalizeText(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function renderCards(filter = "") {
  const query = normalizeText(filter);
  const rubriques = window.CI6_RUBRIQUES.filter(item =>
    normalizeText(`${item.id} ${item.title} ${item.description}`).includes(query)
  );

  grid.innerHTML = rubriques.map(item => `
    <button class="tile" data-content="${item.content}" aria-label="${item.title}">
      <img class="tile-bg" src="${item.card}" alt="" loading="lazy">
      <span class="tile-number">${item.id}</span>
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

function markdownToHtml(markdown) {
  let html = markdown
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^\- (.*$)/gim, "<li>$1</li>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");

  html = html.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/gim, "");

  return html.split(/\n{2,}/).map(block => {
    const b = block.trim();
    if (!b) return "";
    if (b.startsWith("<h") || b.startsWith("<ul")) return b;
    return `<p>${b.replace(/\n/g, "<br>")}</p>`;
  }).join("\\n");
}

async function openContent(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    const markdown = await response.text();
    detailContent.innerHTML = markdownToHtml(markdown);
  } catch (error) {
    detailContent.innerHTML = "<h1>Fiche indisponible</h1><p>Le contenu de cette fiche n’a pas pu être chargé.</p>";
    history.pushState(...)
  }

  homeView.hidden = true;
  detailView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

backBtn.addEventListener("click", () => {
  detailView.hidden = true;
  homeView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

searchInput.addEventListener("input", event => renderCards(event.target.value));

renderCards();
window.addEventListener("popstate", ...)
