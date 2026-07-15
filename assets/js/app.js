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

/* =========================
   ACCUEIL
========================= */

function renderCards(filter = "") {
  const query = normalizeText(filter);

  const rubriques = getRubriques().filter(item =>
    normalizeText(`${item.id || ""} ${item.title || ""} ${item.description || ""}`).includes(query)
  );

  grid.innerHTML = rubriques.map(item => `
    <button class="tile" data-slug="${item.slug}" aria-label="${item.title}">
      <img class="tile-bg" src="${item.card}" alt="" loading="lazy">
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

/* =========================
   SOUS-RUBRIQUES
========================= */

function renderChildren(parent, addHistory = true) {
  currentParent = parent;

  detailContent.innerHTML = `
    <section class="subpage-header">
      <p class="subpage-kicker">Sous-rubriques</p>
      <h1>${parent.title}</h1>
      <p>${parent.description || ""}</p>
    </section>

    <section class="children-grid" aria-label="Sous-rubriques ${parent.title}">
      ${(parent.children || []).map(child => `
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

/* =========================
   OUTILS MARKDOWN
========================= */

function escapeHtml(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);

  if (!match) {
    return {
      meta: {},
      body: markdown
    };
  }

  const meta = {};

  match[1].split("\n").forEach(line => {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    value = value.replace(/^["']|["']$/g, "");
    meta[key] = value;
  });

  return {
    meta,
    body: markdown.slice(match[0].length)
  };
}

function basicMarkdownToHtml(markdown) {
  const htmlBlocks = [];

  markdown = markdown.replace(/<section[\s\S]*?<\/section>/gim, match => {
    const token = `@@HTML_BLOCK_${htmlBlocks.length}@@`;
    htmlBlocks.push(match);
    return `\n\n${token}\n\n`;
  });

  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  const html = blocks.map(block => {
    const htmlTokenMatch = block.match(/^@@HTML_BLOCK_(\d+)@@$/);
    if (htmlTokenMatch) {
      return htmlBlocks[Number(htmlTokenMatch[1])] || "";
    }

    if (/^###\s+/.test(block)) {
      return `<h3>${formatInline(block.replace(/^###\s+/, ""))}</h3>`;
    }

    if (/^##\s+/.test(block)) {
      return `<h2>${formatInline(block.replace(/^##\s+/, ""))}</h2>`;
    }

    if (/^#\s+/.test(block)) {
      return `<h1>${formatInline(block.replace(/^#\s+/, ""))}</h1>`;
    }

    if (/^[-*]\s+/.test(block)) {
      const items = block
        .split("\n")
        .map(line => line.trim())
        .filter(line => /^[-*]\s+/.test(line))
        .map(line => `<li>${formatInline(line.replace(/^[-*]\s+/, ""))}</li>`)
        .join("");

      return `<ul>${items}</ul>`;
    }

    return `<p>${formatInline(block).replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return html;
}

/* =========================
   BLOCS PREMIUM
========================= */

function getDownloadIcon(path) {
  const lower = (path || "").toLowerCase();

  if (lower.endsWith(".pdf")) return "📄";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "📝";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "📊";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "📽️";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")) return "🖼️";
  if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm")) return "🎥";
  if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z")) return "🗂️";
  if (lower.startsWith("http")) return "🌐";

  return "📎";
}

function renderDownloadBlock(content) {
  const items = content
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("-"))
    .map(line => line.replace(/^-/, "").trim());

  return `
    <section class="fiche-card fiche-card-download">
      <div class="fiche-card-head">
        <span class="fiche-card-icon">⬇️</span>
        <strong>Documents à télécharger</strong>
      </div>

      <div class="download-list">
        ${items.map(item => {
          const [label, url] = item.split("|").map(part => part.trim());
          const icon = getDownloadIcon(url || "");

          return `
            <a class="download-item" href="${url}" target="_blank" rel="noopener noreferrer">
              <span>${icon}</span>
              <strong>${label}</strong>
              <em>Ouvrir</em>
            </a>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderCustomBlocks(markdown) {
   const blockTypes = {
    directives: {
      className: "fiche-card-directives",
      icon: "📘",
      title: "Directives"
    },

    autorise: {
      className: "fiche-card-autorise",
      icon: "✅",
      title: "Autorisé"
    },

    interdit: {
      className: "fiche-card-interdit",
      icon: "⛔",
      title: "Interdit"
    },

    conseil: {
      className: "fiche-card-conseil",
      icon: "💬",
      title: "Conseil du cadre"
    },

    attention: {
      className: "fiche-card-attention",
      icon: "⚠️",
      title: "Point de vigilance"
    }
  };

  /* Bloc téléchargements */
  markdown = markdown.replace(
    /:::telechargements\s*\n([\s\S]*?)\n:::/gim,
    (_, content) => renderDownloadBlock(content)
  );

  /* Blocs génériques informatifs :
     :::bloc Horaires
     contenu
     :::
  */
  markdown = markdown.replace(
    /:::bloc\s+([^\n]+)\n([\s\S]*?)\n:::/gim,
    (_, title, content) => {
      return `
        <section class="fiche-card fiche-card-bloc">
          <div class="fiche-card-head">
            <span class="fiche-card-icon">◆</span>
            <strong>${formatInline(title.trim())}</strong>
          </div>

          <div class="fiche-card-body">
            ${basicMarkdownToHtml(content.trim())}
          </div>
        </section>
      `;
    }
  );

  /* Blocs fixes des fiches consignes */
  Object.keys(blockTypes).forEach(type => {
    const config = blockTypes[type];
    const regex = new RegExp(
      `:::${type}\\s*\\n([\\s\\S]*?)\\n:::`,
      "gim"
    );

    markdown = markdown.replace(regex, (_, content) => {
      return `
        <section class="fiche-card ${config.className}">
          <div class="fiche-card-head">
            <span class="fiche-card-icon">${config.icon}</span>
            <strong>${config.title}</strong>
          </div>

          <div class="fiche-card-body">
            ${basicMarkdownToHtml(content.trim())}
          </div>
        </section>
      `;
    });
  });

  return markdown;
}
function markdownToHtml(markdown) {
  const parsed = parseFrontMatter(markdown);
  const bodyWithBlocks = renderCustomBlocks(parsed.body);
  const content = basicMarkdownToHtml(bodyWithBlocks);

  const title = parsed.meta.title || "";
  const icon = parsed.meta.icon || "";
  const quote = parsed.meta.quote || "";

  return `
    <article class="fiche">
      ${title ? `
        <section class="fiche-hero">
          ${icon ? `<img class="fiche-hero-img" src="${icon}" alt="">` : ""}
          <h1>${formatInline(title)}</h1>
          ${quote ? `<p class="fiche-quote">« ${formatInline(quote)} »</p>` : ""}
        </section>
      ` : ""}

      <section class="fiche-content">
        ${content}
      </section>
    </article>
  `;
}

/* =========================
   OUVERTURE DES FICHES
========================= */

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
    console.error(error);

    detailContent.innerHTML = `
      <article class="fiche">
        <section class="fiche-content">
          <h1>Fiche indisponible</h1>
          <p>Le contenu de cette fiche n’a pas pu être chargé.</p>
        </section>
      </article>
    `;
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

/* =========================
   ROUTAGE
========================= */

function openFromHash() {
  const hash = location.hash.replace("#", "");

  if (!hash) {
    setHomeView();
    return;
  }

  const item = findItemBySlug(hash);

  if (!item) {
    detailContent.innerHTML = `
      <article class="fiche">
        <section class="fiche-content">
          <h1>Fiche introuvable</h1>
          <p>Cette rubrique n’existe pas ou son lien est incorrect.</p>
        </section>
      </article>
    `;

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

/* =========================
   RETOUR
========================= */

backBtn.addEventListener("click", () => {
  const hash = location.hash.replace("#", "");
  const item = findItemBySlug(hash);

  if (!item) {
    history.pushState({ type: "home" }, "", location.pathname);
    setHomeView();
    return;
  }

  const parent = flattenItems().find(possibleParent =>
    Array.isArray(possibleParent.children) &&
    possibleParent.children.some(child => child.slug === item.slug)
  );

  if (parent) {
    renderChildren(parent, false);
    history.pushState({ type: "children", slug: parent.slug }, "", "#" + parent.slug);
    return;
  }

  history.pushState({ type: "home" }, "", location.pathname);
  setHomeView();
});

/* =========================
   INITIALISATION
========================= */

if (searchInput) {
  searchInput.addEventListener("input", event => renderCards(event.target.value));
}

window.addEventListener("popstate", openFromHash);

renderCards();
openFromHash();
