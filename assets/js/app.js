const grid = document.getElementById("cardsGrid");
const searchInput = document.getElementById("searchInput");
const homeView = document.getElementById("homeView");
const detailView = document.getElementById("detailView");
const detailContent = document.getElementById("detailContent");
const backBtn = document.getElementById("backBtn");

let currentParent = null;

function normalizeText(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getRubriques() {
  return Array.isArray(window.CI6_RUBRIQUES) ? window.CI6_RUBRIQUES : [];
}

function flattenItems(items = getRubriques()) {
  return items.flatMap(item => [
    item,
    ...(Array.isArray(item.children) ? flattenItems(item.children) : [])
  ]);
}

function findItemBySlug(slug) {
  return flattenItems().find(item => item.slug === slug);
}

function findItemByContent(path) {
  return flattenItems().find(item => item.content === path);
}

function setHomeView() {
  currentParent = null;
  detailView.hidden = true;
  homeView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setDetailView() {
  homeView.hidden = true;
  detailView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCards(filter = "") {
  const query = normalizeText(filter);

  const rubriques = getRubriques().filter(item =>
    normalizeText(`${item.id} ${item.title} ${item.description}`).includes(query)
  );

  grid.innerHTML = rubriques.map(item => `
    <button class="tile" data-slug="${item.slug}" aria-label="${item.title}">
      <img class="tile-bg" src="${item.card}" alt="" loading="lazy">
      <span class="tile-number">${item.id}</span>
      <span class="tile-text">
        <strong>${item.title}</strong>
        <em>${item.description || ""}</em>
      </span>
    </button>
  `).join("");

  document.querySelectorAll("#cardsGrid .tile").forEach(tile => {
    tile.addEventListener("click", () => {
      const item = findItemBySlug(tile.dataset.slug);
      if (!item) return;

      if (Array.isArray(item.children) && item.children.length > 0) {
        renderChildren(item, true);
      } else if (item.content) {
        openContent(item.content, true);
      }
    });
  });
}

function renderChildren(parent, addHistory = true) {
  currentParent = parent;

  detailContent.innerHTML = `
    <section class="subpage-header">
      <p class="subpage-kicker">Sous-rubriques</p>
      <h1>${parent.title}</h1>
      <p>${parent.description || ""}</p>
    </section>

    <section class="children-grid" aria-label="Sous-rubriques ${parent.title}">
      ${parent.children.map(child => `
        <button class="child-nav-tile" data-slug="${child.slug}" aria-label="${child.title}">
          <img class="child-nav-img" src="${child.card}" alt="" loading="lazy">
          <span class="child-nav-title">${child.title}</span>
        </button>
      `).join("")}
    </section>
  `;

  setDetailView();

  document.querySelectorAll(".child-nav-tile").forEach(tile => {
    tile.addEventListener("click", () => {
      const child = findItemBySlug(tile.dataset.slug);
      if (!child) return;

      if (Array.isArray(child.children) && child.children.length > 0) {
        renderChildren(child, true);
      } else if (child.content) {
        openContent(child.content, true);
      }
    });
  });

  if (addHistory) {
    history.pushState({ type: "children", slug: parent.slug }, "", "#" + parent.slug);
  }
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
  }).join("\n");
}

async function openContent(path, addHistory = true) {
  currentParent = null;

  try {
    const response = await fetch(path, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Fiche introuvable : " + path);
    }

    const markdown = await response.text();
    detailContent.innerHTML = markdownToHtml(markdown);
  } catch (error) {
    detailContent.innerHTML =
      "<h1>Fiche indisponible</h1><p>Le contenu de cette fiche n’a pas pu être chargé.</p>";
  }

  setDetailView();

  if (addHistory) {
    const item = findItemByContent(path);
    const hash = item ? item.slug : path.replace("content/", "").replace(".md", "");

    history.pushState(
      { type: "content", path },
      "",
      "#" + hash
    );
  }
}

function openFromHash() {
  const hash = location.hash.replace("#", "");

  if (!hash) {
    setHomeView();
    return;
  }

  const item = findItemBySlug(hash);

  if (!item) {
    detailContent.innerHTML =
      "<h1>Fiche introuvable</h1><p>Cette rubrique n’existe pas ou son lien est incorrect.</p>";
    setDetailView();
    return;
  }

  if (Array.isArray(item.children) && item.children.length > 0) {
    renderChildren(item, false);
    return;
  }

  if (item.content) {
    openContent(item.content, false);
  }
}

backBtn.addEventListener("click", () => {
  const hash = location.hash.replace("#", "");
  const item = findItemBySlug(hash);

  const parent = getRubriques().find(r =>
    Array.isArray(r.children) && r.children.some(child => child.slug === hash)
  );

  if (parent) {
    renderChildren(parent, false);
    history.pushState({ type: "children", slug: parent.slug }, "", "#" + parent.slug);
    return;
  }

  history.pushState({ type: "home" }, "", location.pathname);
  setHomeView();
});

if (searchInput) {
  searchInput.addEventListener("input", event => renderCards(event.target.value));
}

window.addEventListener("popstate", openFromHash);

renderCards();
openFromHash();
