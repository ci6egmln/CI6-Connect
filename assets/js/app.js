const grid = document.getElementById("cardsGrid"), searchInput = document.getElementById("searchInput"), homeView = document.getElementById("homeView"), detailView = document.getElementById("detailView"), detailContent = document.getElementById("detailContent"), backBtn = document.getElementById("backBtn");

let currentParent = null;

/*
 * Informations sur la session connectée.
 * Un administrateur bénéficie aussi de l'affichage cadre.
 */
let currentSession = {
  authenticated: false,
  username: null,
  role: null,
  type: null,
  roleLabel: ""
};

function isCadreMode() {
  return (
    currentSession.type === "user" &&
    (
      currentSession.role === "cadre" ||
      currentSession.role === "admin"
    )
  );
}

function canAccessRoles(allowedRoles) {
  if (
    !Array.isArray(allowedRoles) ||
    allowedRoles.length === 0
  ) {
    return true;
  }

  if (
    allowedRoles.includes("cadre") &&
    isCadreMode()
  ) {
    return true;
  }

  return allowedRoles.includes(
    currentSession.role
  );
}

function isItemVisible(item) {
  return canAccessRoles(
    item.effectiveAccess || item.access
  );
}


let activeConsultationId = null;
let activeConsultationPath = null;

function createConsultationId() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}

async function sendConsultationEvent(
  payload,
  keepalive = false
) {
  try {
    const response = await fetch(
      "/api/fiche-consultation",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "Accept":
            "application/json"
        },
        credentials: "same-origin",
        cache: "no-store",
        keepalive,
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      console.warn(
        "Journalisation non enregistrée.",
        await response.text()
      );
    }

    return response.ok;

  } catch (error) {
    console.warn(
      "Impossible de journaliser la consultation.",
      error
    );

    return false;
  }
}

async function openFicheConsultation({
  path,
  title,
  ficheId,
  version
}) {
  /*
   * Ferme d’abord une éventuelle fiche
   * déjà ouverte dans l’application.
   */
  await closeActiveConsultation();

  const consultationId =
    createConsultationId();

  activeConsultationId =
    consultationId;

  activeConsultationPath =
    path;

  const success =
    await sendConsultationEvent({
      action: "open",
      consultationId,
      ficheId,
      ficheTitle: title,
      fichePath: path,
      ficheVersion: version || "1",
      promotion: ""
    });

  /*
   * En cas d’échec technique, on ne garde
   * pas une fausse consultation active.
   */
  if (!success) {
    activeConsultationId = null;
    activeConsultationPath = null;
  }
}

async function closeActiveConsultation(
  keepalive = false
) {
  if (!activeConsultationId) {
    return;
  }

  const consultationId =
    activeConsultationId;

  /*
   * On vide immédiatement les variables
   * pour éviter deux fermetures simultanées.
   */
  activeConsultationId = null;
  activeConsultationPath = null;

  await sendConsultationEvent(
    {
      action: "close",
      consultationId
    },
    keepalive
  );
}

function normalizeText(value) {
    return (value || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getSearchText(item) {
  const keywords = Array.isArray(item.keywords)
    ? item.keywords.join(" ")
    : "";

  return normalizeText(`
    ${item.id || ""}
    ${item.slug || ""}
    ${item.title || ""}
    ${item.description || ""}
    ${keywords}
  `);
}

function itemMatchesSearch(item, query) {
  const normalizedQuery = normalizeText(query).trim();

  if (!normalizedQuery) {
    return true;
  }

  const searchedWords = normalizedQuery
    .split(/\s+/)
    .filter(Boolean);

  const searchText = getSearchText(item);

  return searchedWords.every(word =>
    searchText.includes(word)
  );
}

function getRubriques() {
    return Array.isArray(window.CI6_RUBRIQUES) ? window.CI6_RUBRIQUES : [];
}

function flattenItems(
  items = getRubriques(),
  inheritedAccess = null
) {
  return items.flatMap(item => {
    const effectiveAccess =
      Array.isArray(item.access)
        ? item.access
        : inheritedAccess;

    const decoratedItem = {
      ...item,
      effectiveAccess
    };

    return [
      decoratedItem,
      ...(
        Array.isArray(item.children)
          ? flattenItems(
              item.children,
              effectiveAccess
            )
          : []
      )
    ];
  });
}

function findItemBySlug(slug) {
    return flattenItems().find(item => item.slug === slug && isItemVisible(item));
}

function findItemByContent(path) {
    return flattenItems().find(item => item.content === path && isItemVisible(item));
}

function setHomeView() {
  closeActiveConsultation();

  currentParent = null;
  detailView.hidden = true;
  homeView.hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function setDetailView() {
    homeView.hidden = !0, detailView.hidden = !1, window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function renderCards(filter = "") {
    const query = normalizeText(filter).trim();

    const rubriques = query
        ? flattenItems()
            .filter(isItemVisible)
            .filter(item => {
            const keywords = Array.isArray(item.keywords)
                ? item.keywords.join(" ")
                : "";

            const searchableText = normalizeText(`
                ${item.id || ""}
                ${item.slug || ""}
                ${item.title || ""}
                ${item.description || ""}
                ${keywords}
            `);

            const searchedWords = query
                .split(/\s+/)
                .filter(Boolean);

            return searchedWords.every(word =>
                searchableText.includes(word)
            );
        })
        : getRubriques().filter(isItemVisible);

    grid.innerHTML = rubriques.map(item => `
        <button
            class="tile"
            data-slug="${item.slug}"
            aria-label="${item.title}"
        >
            <img
                class="tile-bg"
                src="${item.card}"
                alt=""
                loading="lazy"
            >

            <span class="tile-text">
                <strong>${item.title}</strong>
                <em>${item.description || ""}</em>
            </span>
        </button>
    `).join("");

    document
        .querySelectorAll("#cardsGrid .tile")
        .forEach(tile => {
            tile.addEventListener("click", () => {
                const item = findItemBySlug(
                    tile.dataset.slug
                );

                if (!item) {
                    return;
                }

                if (
                    Array.isArray(item.children) &&
                    item.children.length > 0
                ) {
                    renderChildren(item, true);
                    return;
                }

                if (item.content) {
                    openContent(item.content, true);
                }
            });
        });
}

function renderChildren(parent, addHistory = !0) {
  currentParent = parent;

  const inheritedAccess =
    parent.effectiveAccess || parent.access || null;

  const visibleChildren =
    (parent.children || [])
      .map(child => ({
        ...child,
        effectiveAccess:
          Array.isArray(child.access)
            ? child.access
            : inheritedAccess
      }))
      .filter(isItemVisible);

  detailContent.innerHTML = `
    <section class="subpage-header">
      <p class="subpage-kicker">Sous-rubriques</p>
      <h1>${parent.title}</h1>
      <p>${parent.description || ""}</p>
    </section>

    ${
      visibleChildren.length > 0
        ? `
          <section
            class="children-grid"
            aria-label="Sous-rubriques ${parent.title}"
          >
            ${visibleChildren.map(child => `
              <button
                class="child-nav-tile"
                data-slug="${child.slug}"
                aria-label="${child.title}"
              >
                <img
                  class="child-nav-img"
                  src="${child.card}"
                  alt=""
                  loading="lazy"
                >
                <span class="child-nav-title">
                  ${child.title}
                </span>
              </button>
            `).join("")}
          </section>
        `
        : `
          <article class="fiche">
            <section class="fiche-content">
              <h2>Espace en préparation</h2>
              <p>
                Les sous-domaines réservés aux cadres
                seront ajoutés prochainement.
              </p>
            </section>
          </article>
        `
    }
  `;

  setDetailView();

  document
    .querySelectorAll(".child-nav-tile")
    .forEach(tile => {
      tile.addEventListener("click", () => {
        const child =
          findItemBySlug(tile.dataset.slug);

        if (!child) {
          return;
        }

        if (Array.isArray(child.children)) {
          renderChildren(child, true);
        } else if (child.content) {
          openContent(child.content, true);
        }
      });
    });

  if (addHistory) {
    history.pushState(
      {
        type: "children",
        slug: parent.slug
      },
      "",
      "#" + parent.slug
    );
  }
}

function escapeHtml(value) {
    return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatInline(text) {
    return escapeHtml(text)

        /* Images Markdown */
        .replace(
            /!\[([^\]]*)\]\(([^)]+)\)/g,
            '<a class="fiche-inline-image-link" href="$2" target="_blank" rel="noopener noreferrer"><img class="fiche-inline-image" src="$2" alt="$1" loading="lazy"></a>'
        )

        /* Code */
        .replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        )

        /* Texte en gras */
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        )

        /* Texte en italique */
        .replace(
            /\*(.*?)\*/g,
            "<em>$1</em>"
        )

        /* Liens */
        .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );
}

function parseFrontMatter(markdown) {
    const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!match) return {
        meta: {},
        body: markdown
    };
    const meta = {};
    return match[1].split("\n").forEach(line => {
        const separatorIndex = line.indexOf(":");
        if (-1 === separatorIndex) return;
        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();
        value = value.replace(/^["']|["']$/g, ""), meta[key] = value;
    }), {
        meta: meta,
        body: markdown.slice(match[0].length)
    };
}

function basicMarkdownToHtml(markdown) {
    const htmlBlocks = [];
    return (markdown = markdown.replace(/<section[\s\S]*?<\/section>/gim, match => {
        const token = `@@HTML_BLOCK_${htmlBlocks.length}@@`;
        return htmlBlocks.push(match), `\n\n${token}\n\n`;
    })).replace(/\r\n/g, "\n").split(/\n{2,}/).map(block => block.trim()).filter(Boolean).map(block => {
        const htmlTokenMatch = block.match(/^@@HTML_BLOCK_(\d+)@@$/);
        if (htmlTokenMatch) return htmlBlocks[Number(htmlTokenMatch[1])] || "";
        if (/^###\s+/.test(block)) return `<h3>${formatInline(block.replace(/^###\s+/, ""))}</h3>`;
        if (/^##\s+/.test(block)) return `<h2>${formatInline(block.replace(/^##\s+/, ""))}</h2>`;
        if (/^#\s+/.test(block)) return `<h1>${formatInline(block.replace(/^#\s+/, ""))}</h1>`;
        if (/^[-*]\s+/.test(block)) {
            return `<ul>${block.split("\n").map(line => line.trim()).filter(line => /^[-*]\s+/.test(line)).map(line => `<li>${formatInline(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
        }
        return `<p>${formatInline(block).replace(/\n/g, "<br>")}</p>`;
    }).join("\n");
}

function getDownloadIcon(path) {
    const lower = (path || "").toLowerCase();
    return lower.endsWith(".pdf") ? "📄" : lower.endsWith(".doc") || lower.endsWith(".docx") ? "📝" : lower.endsWith(".xls") || lower.endsWith(".xlsx") ? "📊" : lower.endsWith(".ppt") || lower.endsWith(".pptx") ? "📽️" : lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") ? "🖼️" : lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm") ? "🎥" : lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z") ? "🗂️" : lower.startsWith("http") ? "🌐" : "📎";
}

function renderDownloadBlock(content) {
    return `\n    <section class="fiche-card fiche-card-download">\n      <div class="fiche-card-head">\n        <span class="fiche-card-icon">⬇️</span>\n        <strong>Documents à télécharger</strong>\n      </div>\n\n      <div class="download-list">\n        ${content.split("\n").map(line => line.trim()).filter(line => line.startsWith("-")).map(line => line.replace(/^-/, "").trim()).map(item => {
        const [label, url] = item.split("|").map(part => part.trim());
        return `\n            <a class="download-item" href="${url}" target="_blank" rel="noopener noreferrer">\n              <span>${getDownloadIcon(url || "")}</span>\n              <strong>${label}</strong>\n              <em>Ouvrir</em>\n            </a>\n          `;
    }).join("")}\n      </div>\n    </section>\n  `;
}
function renderImageBlock(title, content) {
  const firstLine = content
    .split("\n")
    .map(line => line.trim())
    .find(Boolean) || "";

  const [path, captionFromLine] = firstLine
    .split("|")
    .map(part => part.trim());

  if (!path) return "";

  const caption = captionFromLine || title || "";
  const safePath = escapeHtml(path);
  const safeCaption = escapeHtml(caption);

  return `
    <section class="media-card media-card-image">
      <a
        class="media-image-link"
        href="${safePath}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Agrandir l’image ${safeCaption}"
      >
        <img
          class="media-image"
          src="${safePath}"
          alt="${safeCaption}"
          loading="lazy"
        >
      </a>

      ${caption ? `
        <p class="media-caption">${formatInline(caption)}</p>
      ` : ""}
    </section>
  `;
}

function renderGalleryBlock(title, content) {
  const images = content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [path, caption = ""] = line
        .replace(/^-\s*/, "")
        .split("|")
        .map(part => part.trim());

      return { path, caption };
    })
    .filter(item => item.path);

  if (!images.length) return "";

  return `
    <section class="media-card media-gallery-card">
      ${title ? `
        <div class="media-card-title">
          <span>🖼️</span>
          <strong>${formatInline(title)}</strong>
        </div>
      ` : ""}

      <div class="media-gallery">
        ${images.map(image => {
          const safePath = escapeHtml(image.path);
          const safeCaption = escapeHtml(image.caption);

          return `
            <a
              class="media-gallery-item"
              href="${safePath}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Agrandir l’image ${safeCaption}"
            >
              <img
                src="${safePath}"
                alt="${safeCaption}"
                loading="lazy"
              >

              ${image.caption ? `
                <span>${formatInline(image.caption)}</span>
              ` : ""}
            </a>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderVideoBlock(title, content) {
  const firstLine = content
    .split("\n")
    .map(line => line.trim())
    .find(Boolean) || "";

  const [path, captionFromLine] = firstLine
    .split("|")
    .map(part => part.trim());

  if (!path) return "";

  const caption = captionFromLine || title || "";
  const safePath = escapeHtml(path);

  return `
    <section class="media-card media-video-card">
      ${title ? `
        <div class="media-card-title">
          <span>🎥</span>
          <strong>${formatInline(title)}</strong>
        </div>
      ` : ""}

      <video
        class="media-video"
        controls
        preload="metadata"
        playsinline
      >
        <source src="${safePath}">
        Votre navigateur ne peut pas lire cette vidéo.
      </video>

      ${caption && caption !== title ? `
        <p class="media-caption">${formatInline(caption)}</p>
      ` : ""}
    </section>
  `;
}

function renderCustomBlocks(markdown) {

    /*
     * IMAGE UNIQUE
     *
     * :::image Titre facultatif
     * assets/photos/photo.jpg | Légende facultative
     * :::
     */
    markdown = markdown.replace(
        /^[ \t]*:::image(?:[ \t]+([^\r\n]+))?[ \t]*\r?\n([\s\S]*?)^[ \t]*:::[ \t]*$/gim,
        (_, title, content) => renderImageBlock(
            title ? title.trim() : "",
            content.trim()
        )
    );


    /*
     * GALERIE DE PHOTOS
     *
     * :::galerie Titre facultatif
     * assets/photos/photo1.jpg | Légende 1
     * assets/photos/photo2.jpg | Légende 2
     * :::
     */
    markdown = markdown.replace(
        /^[ \t]*:::galerie(?:[ \t]+([^\r\n]+))?[ \t]*\r?\n([\s\S]*?)^[ \t]*:::[ \t]*$/gim,
        (_, title, content) => renderGalleryBlock(
            title ? title.trim() : "",
            content.trim()
        )
    );


    /*
     * VIDÉO LOCALE
     *
     * :::video Titre facultatif
     * assets/videos/video.mp4 | Légende facultative
     * :::
     */
    markdown = markdown.replace(
        /^[ \t]*:::video(?:[ \t]+([^\r\n]+))?[ \t]*\r?\n([\s\S]*?)^[ \t]*:::[ \t]*$/gim,
        (_, title, content) => renderVideoBlock(
            title ? title.trim() : "",
            content.trim()
        )
    );


    /*
     * DOCUMENTS À TÉLÉCHARGER
     *
     * :::telechargements
     * - Nom du document | assets/documents/document.pdf
     * :::
     */
    markdown = markdown.replace(
        /^[ \t]*:::telechargements[ \t]*\r?\n([\s\S]*?)^[ \t]*:::[ \t]*$/gim,
        (_, content) => renderDownloadBlock(content.trim())
    );


    /*
     * BLOC PERSONNALISABLE
     *
     * :::bloc couleur | Titre | Icône
     * Contenu du bloc
     * :::
     */
    markdown = markdown.replace(
        /^[ \t]*:::bloc(?:[ \t]+([^\r\n]+))?[ \t]*\r?\n([\s\S]*?)^[ \t]*:::[ \t]*$/gim,
        (_, options, content) => {

            const parts = (options || "")
                .split("|")
                .map(part => part.trim());

            const requestedColor = normalizeText(parts[0] || "gris");
            const title = parts[1] || "Information";
            const icon = parts[2] || "ℹ️";

            const allowedColors = [
                "bleu",
                "vert",
                "rouge",
                "orange",
                "jaune",
                "gris"
            ];

            const color = allowedColors.includes(requestedColor)
                ? requestedColor
                : "gris";

            return `
                <section class="fiche-card fiche-card-${color}">
                    <div class="fiche-card-head">
                        <span class="fiche-card-icon">${formatInline(icon)}</span>
                        <strong>${formatInline(title)}</strong>
                    </div>

                    <div class="fiche-card-body">
                        ${basicMarkdownToHtml(content.trim())}
                    </div>
                </section>
            `;
        }
    );

    return markdown;
}    

function markdownToHtml(markdown) {

    // Supprime les commentaires HTML : <!-- ... -->
    markdown = markdown.replace(
        /<!--[\s\S]*?-->/g,
        ""
    );

    const parsed = parseFrontMatter(markdown);

    const content = basicMarkdownToHtml(
        renderCustomBlocks(parsed.body)
    );

    const title = parsed.meta.title || "";
    const icon = parsed.meta.icon || "";
    const cover = parsed.meta.cover || "";
    const quote = parsed.meta.quote || "";
    
    const coverUrl = cover
        ? new URL(cover, document.baseURI).href
        : "";
    
    return `
        <article class="fiche">

            ${title ? `
                <section
                    class="fiche-hero ${coverUrl ? "fiche-hero-cover" : ""}"
                    ${coverUrl
                        ? `style="--fiche-cover:url('${coverUrl}');"`
                        : ""
                    }
                >
                    <div class="fiche-hero-content">

                        ${icon && !coverUrl ? `
                            <img
                                class="fiche-hero-img"
                                src="${icon}"
                                alt=""
                            >
                        ` : ""}

                        <h1>${formatInline(title)}</h1>

                        ${quote ? `
                            <p class="fiche-quote">
                                « ${formatInline(quote)} »
                            </p>
                        ` : ""}

                    </div>
                </section>
            ` : ""}

            <section class="fiche-content">
                ${content}
            </section>

        </article>
    `;
}

async function openContent(
  path,
  addHistory = true
) {
  currentParent = null;

  /*
   * Si une autre fiche est ouverte,
   * elle est fermée avant le chargement.
   */
  if (
    activeConsultationId &&
    activeConsultationPath !== path
  ) {
    await closeActiveConsultation();
  }

  try {
    const response = await fetch(
      path,
      {
        cache: "no-store",
        credentials: "same-origin"
      }
    );

    if (!response.ok) {
      throw new Error(
        "Fiche introuvable : " + path
      );
    }

    const markdown =
      await response.text();

    const parsed =
      parseFrontMatter(markdown);

    const item =
      findItemByContent(path);

    const ficheTitle =
      parsed.meta.title ||
      item?.title ||
      path;

    const ficheVersion =
      parsed.meta.version ||
      parsed.meta.updated ||
      "1";

    const ficheId =
      item?.slug ||
      path
        .replace(/^content\//, "")
        .replace(/\.md$/i, "")
        .replace(/[^a-zA-Z0-9_-]/g, "-");

    detailContent.innerHTML =
      markdownToHtml(markdown);

    setDetailView();

    /*
     * Une ouverture n’est enregistrée
     * qu’après le chargement réussi.
     */
    await openFicheConsultation({
      path,
      title: ficheTitle,
      ficheId,
      version: ficheVersion
    });

    if (addHistory) {
      const hash =
        item
          ? item.slug
          : path
              .replace("content/", "")
              .replace(".md", "");

      history.pushState(
        {
          type: "content",
          path
        },
        "",
        "#" + hash
      );
    }

  } catch (error) {
    console.error(error);

    await closeActiveConsultation();

    detailContent.innerHTML = `
      <article class="fiche">
        <section class="fiche-content">
          <h1>Fiche indisponible</h1>
          <p>
            Le contenu de cette fiche
            n’a pas pu être chargé.
          </p>
        </section>
      </article>
    `;

    setDetailView();
  }
}

function openFromHash() {
    const hash = location.hash.replace("#", "");
    if (!hash) return void setHomeView();
    const item = findItemBySlug(hash);
    if (!item) return detailContent.innerHTML = '\n      <article class="fiche">\n        <section class="fiche-content">\n          <h1>Fiche introuvable</h1>\n          <p>Cette rubrique n’existe pas ou son lien est incorrect.</p>\n        </section>\n      </article>\n    ', 
    void setDetailView();
    Array.isArray(item.children) ? renderChildren(item, !1) : item.content && openContent(item.content, !1);
}

backBtn.addEventListener("click", () => {
    const item = findItemBySlug(location.hash.replace("#", ""));
    if (!item) return history.pushState({
        type: "home"
    }, "", location.pathname), void setHomeView();
    const parent = flattenItems().find(
      possibleParent =>
        isItemVisible(possibleParent) &&
        Array.isArray(possibleParent.children) &&
        possibleParent.children.some(
          child => child.slug === item.slug
        )
    );
    if (parent) return renderChildren(parent, !1), void history.pushState({
        type: "children",
        slug: parent.slug
    }, "", "#" + parent.slug);
    history.pushState({
        type: "home"
    }, "", location.pathname), setHomeView();
});

searchInput && searchInput.addEventListener(
  "input",
  event => renderCards(event.target.value)
);

window.addEventListener(
  "popstate",
  openFromHash
);

async function displayConnectedUser() {
  if (document.querySelector(".connected-user")) {
    return;
  }

  try {
    const response = await fetch("/me", {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store",
      credentials: "same-origin"
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    if (!data.authenticated) {
      return;
    }

    currentSession = {
      authenticated: true,
      username: data.username || null,
      role: data.role || null,
      type: data.type || null,
      roleLabel: data.roleLabel || ""
    };

    const connectedBox =
      document.createElement("div");

    connectedBox.className =
      "connected-user";

    const identity =
      document.createElement("div");

        identity.className =
          "connected-user-identity";

    const sentence =
      document.createElement("span");

        sentence.className =
          "connected-user-role";
    
        sentence.textContent =
          data.role === "admin"
            ? "Vous êtes connecté en tant que cadre administrateur."
            : `Vous êtes connecté en tant que ${data.roleLabel}.`;
    
        identity.appendChild(sentence);

    if (
      data.username &&
      data.type !== "collective"
    ) {
      const identifier =
        document.createElement("span");

      identifier.className =
        "connected-user-identifier";

      identifier.textContent =
        `Compte : ${data.username}`;

      identity.appendChild(identifier);
    }

    connectedBox.appendChild(identity);
const connectedActions =
  document.createElement("div");

connectedActions.className =
  "connected-user-actions";
      
    /*
     * Bouton Administration
     * uniquement pour un administrateur.
     */
    if (data.role === "admin") {
      const administrationLink =
        document.createElement("a");
    
      administrationLink.href =
        "/administration";
    
      administrationLink.className =
        "connected-user-admin";
    
      administrationLink.textContent =
        "Administration";
    
      connectedActions.appendChild(
        administrationLink
      );
    }
    
    /*
     * Bouton Déconnexion
     * visible pour tous les comptes.
     */
    const logoutLink =
          document.createElement("a");
        
        logoutLink.href = "/logout";
        
        logoutLink.className =
          "connected-user-logout";
        
        logoutLink.textContent =
          "Déconnexion";
        
        connectedActions.appendChild(
          logoutLink
    );
    
    connectedBox.appendChild(
      connectedActions
    );
  
    const main =
      document.querySelector("main");

    if (main) {
      main.prepend(connectedBox);
    } else {
      document.body.prepend(connectedBox);
    }

  } catch (error) {
    console.error(
      "Impossible d’afficher le statut de connexion.",
      error
    );
  }
}

async function initializeApplication() {
  await displayConnectedUser();
  renderCards();
  openFromHash();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApplication,
    { once: true }
  );
} else {
  initializeApplication();
}

window.addEventListener(
  "pagehide",
  () => {
    closeActiveConsultation(true);
  }
);
