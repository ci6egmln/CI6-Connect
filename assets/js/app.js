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


function getOnlineVideoEmbedUrl(url) {
  try {
    const parsed = new URL(url);

    if (
      parsed.hostname.includes("youtube.com")
    ) {
      const id = parsed.searchParams.get("v");
      return id
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : "";
    }

    if (parsed.hostname === "youtu.be") {
      const id =
        parsed.pathname.replace(/^\/+/, "");
      return id
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : "";
    }

    if (
      parsed.hostname.includes("vimeo.com")
    ) {
      const id =
        parsed.pathname
          .split("/")
          .filter(Boolean)
          .pop();

      return id
        ? `https://player.vimeo.com/video/${id}`
        : "";
    }

  } catch {
    return "";
  }

  return "";
}

function renderOnlineVideoBlock(title, content) {
  const firstLine =
    content
      .split("\n")
      .map(line => line.trim())
      .find(Boolean) || "";

  const [url, captionFromLine] =
    firstLine
      .split("|")
      .map(part => part.trim());

  if (!url) {
    return "";
  }

  const caption =
    captionFromLine || title || "";

  const embedUrl =
    getOnlineVideoEmbedUrl(url);

  if (!embedUrl) {
    return `
      <section class="fiche-card fiche-card-bleu">
        <div class="fiche-card-head">
          <span class="fiche-card-icon">🎥</span>
          <strong>${formatInline(title || "Vidéo")}</strong>
        </div>
        <div class="fiche-card-body">
          <p>
            <a
              href="${escapeHtml(url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir la vidéo en ligne
            </a>
          </p>
          ${caption ? `<p>${formatInline(caption)}</p>` : ""}
        </div>
      </section>
    `;
  }

  return `
    <section class="media-card media-video-card">
      ${title ? `
        <div class="media-card-title">
          <span>🎥</span>
          <strong>${formatInline(title)}</strong>
        </div>
      ` : ""}

      <div
        style="
          position:relative;
          width:100%;
          padding-top:56.25%;
          overflow:hidden;
          border-radius:10px;
          background:#000;
        "
      >
        <iframe
          src="${escapeHtml(embedUrl)}"
          title="${escapeHtml(title || "Vidéo")}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          style="
            position:absolute;
            inset:0;
            width:100%;
            height:100%;
            border:0;
          "
        ></iframe>
      </div>

      ${caption && caption !== title ? `
        <p class="media-caption">
          ${formatInline(caption)}
        </p>
      ` : ""}
    </section>
  `;
}



function renderImageTextBlock(header, content) {
  const parts =
    String(header || "")
      .split("|")
      .map(part => part.trim());

  const color = parts[0] || "gris";
  const title = parts[1] || "Illustration";
  const icon = parts[2] || "🖼️";

  const lines =
    String(content || "")
      .split("\n");

  const mediaLineIndex =
    lines.findIndex(line => line.trim());

  if (mediaLineIndex < 0) {
    return "";
  }

  const mediaLine =
    lines[mediaLineIndex].trim();

  const [src, caption] =
    mediaLine
      .split("|")
      .map(part => part.trim());

  const text =
    lines
      .slice(mediaLineIndex + 1)
      .join("\n")
      .trim();

  return `
    <section class="fiche-card fiche-card-${escapeHtml(color)}">
      <div class="fiche-card-head">
        <span class="fiche-card-icon">${escapeHtml(icon)}</span>
        <strong>${formatInline(title)}</strong>
      </div>

      <div class="fiche-card-body">
        <figure class="media-card">
          <img
            src="${escapeHtml(src)}"
            alt="${escapeHtml(caption || title)}"
            loading="lazy"
          >
          ${caption ? `
            <figcaption class="media-caption">
              ${formatInline(caption)}
            </figcaption>
          ` : ""}
        </figure>

        ${text ? basicMarkdownToHtml(text) : ""}
      </div>
    </section>
  `;
}

function renderCustomBlocks(markdown) {

    /*
     * BLOC TEXTE AVEC IMAGE
     *
     * :::image-texte couleur | Titre | Icône
     * assets/photos/photo.jpg | Légende
     *
     * Texte du bloc
     * :::
     */
    markdown = markdown.replace(
        /^[ \t]*:::image-texte(?:[ \t]+([^\r\n]+))?[ \t]*\r?\n([\s\S]*?)^[ \t]*:::[ \t]*$/gim,
        (_, header, content) =>
          renderImageTextBlock(
            header ? header.trim() : "",
            content.trim()
          )
    );


    /*
     * VIDÉO EN LIGNE
     *
     * :::video-lien Titre facultatif
     * https://... | Légende facultative
     * :::
     */
    markdown = markdown.replace(
        /^[ \t]*:::video-lien(?:[ \t]+([^\r\n]+))?[ \t]*\r?\n([\s\S]*?)^[ \t]*:::[ \t]*$/gim,
        (_, title, content) => renderOnlineVideoBlock(
            title ? title.trim() : "",
            content.trim()
        )
    );


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


/* ==========================================================
   ÉDITEUR DE FICHES — CADRES ET ADMINISTRATEURS
   ========================================================== */

let currentEditableFiche = {
  path: "",
  markdown: "",
  item: null
};

function injectFicheEditorStyles() {
  if (document.getElementById("ci6FicheEditorStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ci6FicheEditorStyles";
  style.textContent = `
    .fiche-edit-toolbar {
      display: flex;
      justify-content: flex-end;
      margin: 0 0 18px;
    }

    .fiche-edit-button,
    .fiche-editor-button {
      min-height: 42px;
      padding: 10px 16px;
      border: 1px solid rgba(214,173,58,.75);
      border-radius: 9px;
      color: #fff;
      background: linear-gradient(135deg,#5d3b08,#b88318);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .fiche-editor-button.secondary {
      color: #f5f5f5;
      background: #15191d;
      border-color: rgba(223,227,232,.4);
    }

    .fiche-editor-button.danger {
      background: #6d2020;
      border-color: rgba(255,120,120,.65);
    }

    .fiche-editor-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(0,0,0,.78);
      backdrop-filter: blur(5px);
    }

    .fiche-editor-dialog {
      width: min(1040px,100%);
      max-height: 94vh;
      overflow: auto;
      padding: 22px;
      border: 1px solid rgba(214,173,58,.65);
      border-radius: 14px;
      background: #080a0c;
      box-shadow: 0 24px 70px rgba(0,0,0,.7);
    }

    .fiche-editor-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .fiche-editor-head h2 {
      margin: 0 0 5px;
      color: #f4d77a;
    }

    .fiche-editor-head p {
      margin: 0;
      color: #c9c2b4;
    }

    .fiche-editor-close {
      width: 42px;
      height: 42px;
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 50%;
      color: #fff;
      background: #15191d;
      font-size: 22px;
      cursor: pointer;
    }

    .fiche-editor-grid {
      display: grid;
      grid-template-columns: minmax(0,1fr) minmax(0,1fr);
      gap: 18px;
    }

    .fiche-editor-panel {
      padding: 16px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 11px;
      background: rgba(255,255,255,.025);
    }

    .fiche-editor-panel h3 {
      margin: 0 0 14px;
      color: #dfe3e8;
    }

    .fiche-editor-field {
      margin-bottom: 14px;
    }

    .fiche-editor-field label,
    .fiche-editor-legend {
      display: block;
      margin-bottom: 7px;
      color: #dfe3e8;
      font-size: 13px;
      font-weight: 700;
    }

    .fiche-editor-field input,
    .fiche-editor-field select,
    .fiche-editor-field textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid rgba(214,173,58,.55);
      border-radius: 8px;
      color: #f5f5f5;
      background: #030405;
      font: inherit;
    }

    .fiche-editor-field textarea {
      min-height: 150px;
      resize: vertical;
      line-height: 1.5;
    }

    .fiche-editor-upload-box {
      margin-top: 10px;
      padding: 14px;
      border: 1px dashed rgba(214,173,58,.5);
      border-radius: 9px;
      background: rgba(214,173,58,.045);
    }

    .fiche-editor-upload-box[hidden] {
      display: none;
    }

    .fiche-editor-upload-status {
      margin-top: 10px;
      color: #c9c2b4;
      font-size: 13px;
      line-height: 1.45;
    }

    .fiche-editor-upload-status.success {
      color: #bdf2c5;
    }

    .fiche-editor-upload-status.error {
      color: #ffb7b7;
    }

    .fiche-editor-file-name {
      margin-top: 7px;
      color: #f4d77a;
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    .fiche-editor-source {
      min-height: 360px !important;
      font-family: ui-monospace,SFMono-Regular,Consolas,monospace !important;
      font-size: 13px !important;
    }

    .fiche-editor-radio-grid {
      display: grid;
      grid-template-columns: repeat(6,minmax(42px,1fr));
      gap: 8px;
    }

    .fiche-editor-radio-grid label {
      display: grid;
      place-items: center;
      min-height: 44px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      background: #111418;
      cursor: pointer;
      font-size: 20px;
    }

    .fiche-editor-radio-grid input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .fiche-editor-radio-grid label:has(input:checked) {
      border-color: #f4d77a;
      box-shadow: 0 0 0 2px rgba(244,215,122,.18);
    }

    .fiche-editor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .fiche-editor-message {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 8px;
      color: #dcecff;
      background: rgba(25,65,110,.28);
      border: 1px solid rgba(80,145,220,.55);
    }

    .fiche-editor-message.error {
      color: #ffdada;
      background: rgba(110,20,20,.3);
      border-color: rgba(255,90,90,.55);
    }

    .fiche-editor-preview {
      margin-top: 18px;
      padding: 16px;
      border: 1px dashed rgba(214,173,58,.55);
      border-radius: 10px;
      background: #050607;
    }

    @media (max-width: 820px) {
      .fiche-editor-grid {
        grid-template-columns: 1fr;
      }

      .fiche-editor-radio-grid {
        grid-template-columns: repeat(4,minmax(42px,1fr));
      }
    }
  `;

  document.head.appendChild(style);
}

function getEditorBody(markdown) {
  return parseFrontMatter(markdown).body.trim();
}

function getEditorMeta(markdown) {
  return parseFrontMatter(markdown).meta;
}

function buildFrontMatter(meta) {
  const lines = ["---"];

  if (meta.title) {
    lines.push(`title: "${String(meta.title).replace(/"/g, '\\"')}"`);
  }

  if (meta.icon) {
    lines.push(`icon: "${String(meta.icon).replace(/"/g, '\\"')}"`);
  }

  if (meta.cover) {
    lines.push(`cover: "${String(meta.cover).replace(/"/g, '\\"')}"`);
  }

  if (meta.quote) {
    lines.push(`quote: "${String(meta.quote).replace(/"/g, '\\"')}"`);
  }

  lines.push("---", "");
  return lines.join("\n");
}

function onlineVideoMarkdown(title, url, caption) {
  return [
    `:::video-lien ${title || "Vidéo"}`,
    `${url}${caption ? ` | ${caption}` : ""}`,
    ":::"
  ].join("\n");
}

function editorBlockMarkdown({
  type,
  color,
  title,
  icon,
  text,
  mediaUrl,
  caption,
  galleryImages = []
}) {
  if (type === "texte") {
    if (!text.trim()) {
      throw new Error("Renseignez le texte du bloc.");
    }

    return [
      `:::bloc ${color || "gris"} | ${title || "Information"} | ${icon || "ℹ️"}`,
      text.trim(),
      ":::"
    ].join("\n");
  }

  if (type === "texte-image") {
    if (!mediaUrl) {
      throw new Error(
        "Ajoutez d’abord une photo pour ce bloc."
      );
    }

    if (!text.trim()) {
      throw new Error(
        "Renseignez le texte qui accompagne la photo."
      );
    }

    return [
      `:::image-texte ${color || "gris"} | ${title || "Illustration"} | ${icon || "🖼️"}`,
      `${mediaUrl}${caption ? ` | ${caption}` : ""}`,
      "",
      text.trim(),
      ":::"
    ].join("\n");
  }

  if (type === "galerie") {
    if (!Array.isArray(galleryImages) || galleryImages.length === 0) {
      throw new Error(
        "Ajoutez au moins une photo à la galerie."
      );
    }

    return [
      `:::galerie ${title || "Galerie"}`,
      ...galleryImages.map(image =>
        `${image.path}${image.caption ? ` | ${image.caption}` : ""}`
      ),
      ":::"
    ].join("\n");
  }

  if (type === "video") {
    if (!mediaUrl) {
      throw new Error(
        "Renseignez le lien de la vidéo en ligne."
      );
    }

    return onlineVideoMarkdown(
      title,
      mediaUrl,
      caption
    );
  }

  throw new Error("Type de bloc inconnu.");
}

function renderFicheEditButton(path, markdown, item) {
  if (!isCadreMode()) {
    return;
  }

  currentEditableFiche = {
    path,
    markdown,
    item
  };

  const fiche = detailContent.querySelector(".fiche");

  if (!fiche || fiche.querySelector(".fiche-edit-toolbar")) {
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "fiche-edit-toolbar";
  toolbar.innerHTML = `
    <button
      type="button"
      class="fiche-edit-button"
      id="editCurrentFicheButton"
    >
      ✏️ Modifier la fiche
    </button>
  `;

  fiche.insertBefore(toolbar, fiche.firstChild);

  toolbar
    .querySelector("#editCurrentFicheButton")
    .addEventListener("click", openFicheEditor);
}

function openFicheEditor() {
  injectFicheEditorStyles();

  const meta =
    getEditorMeta(currentEditableFiche.markdown);

  const body =
    getEditorBody(currentEditableFiche.markdown);

  const overlay = document.createElement("div");
  overlay.className = "fiche-editor-overlay";

  overlay.innerHTML = `
    <section
      class="fiche-editor-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficheEditorTitle"
    >
      <div class="fiche-editor-head">
        <div>
          <h2 id="ficheEditorTitle">
            Modifier la fiche
          </h2>
          <p>
            ${escapeHtml(currentEditableFiche.path)}
          </p>
        </div>

        <button
          type="button"
          class="fiche-editor-close"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>

      <div class="fiche-editor-grid">
        <section class="fiche-editor-panel">
          <h3>Fiche actuelle</h3>

          <div class="fiche-editor-field">
            <label for="editorFicheTitle">
              Titre de la fiche
            </label>
            <input
              id="editorFicheTitle"
              type="text"
              value="${escapeHtml(meta.title || currentEditableFiche.item?.title || "")}"
            >
          </div>

          <div class="fiche-editor-field">
            <label for="editorFicheQuote">
              Citation ou sous-titre
            </label>
            <input
              id="editorFicheQuote"
              type="text"
              value="${escapeHtml(meta.quote || "")}"
            >
          </div>

          <div class="fiche-editor-field">
            <label for="editorFicheIcon">
              Chemin de l’icône de la fiche
            </label>
            <input
              id="editorFicheIcon"
              type="text"
              value="${escapeHtml(meta.icon || "")}"
              placeholder="assets/icons/icone.svg"
            >
          </div>

          <div class="fiche-editor-field">
            <label for="editorFicheCover">
              Image de couverture facultative
            </label>
            <input
              id="editorFicheCover"
              type="text"
              value="${escapeHtml(meta.cover || "")}"
              placeholder="assets/photos/couverture.webp"
            >
          </div>

          <div class="fiche-editor-field">
            <label for="editorSource">
              Contenu actuel
            </label>
            <textarea
              id="editorSource"
              class="fiche-editor-source"
            >${escapeHtml(body)}</textarea>
          </div>
        </section>

        <section class="fiche-editor-panel">
          <h3>Ajouter un bloc</h3>

          <div class="fiche-editor-field">
            <label for="editorBlockType">
              Type de bloc
            </label>
            <select id="editorBlockType">
              <option value="texte">Bloc texte</option>
              <option value="texte-image">Bloc texte avec image</option>
              <option value="galerie">Galerie d’images</option>
              <option value="video">Vidéo en ligne</option>
            </select>
          </div>

          <div class="fiche-editor-field">
            <label for="editorBlockColor">
              Couleur
            </label>
            <select id="editorBlockColor">
              <option value="bleu">Bleu</option>
              <option value="vert">Vert</option>
              <option value="rouge">Rouge</option>
              <option value="orange">Orange</option>
              <option value="jaune">Jaune</option>
              <option value="gris">Gris</option>
            </select>
          </div>

          <div class="fiche-editor-field">
            <label for="editorBlockTitle">
              Titre du bloc
            </label>
            <input
              id="editorBlockTitle"
              type="text"
              placeholder="Ex. À retenir"
            >
          </div>

          <fieldset class="fiche-editor-field">
            <legend class="fiche-editor-legend">
              Icône
            </legend>

            <div class="fiche-editor-radio-grid">
              ${["ℹ️","✅","⚠️","⛔","💡","📌","📄","🛡️","🎯","📅","🖼️","🎥"]
                .map((icon, index) => `
                  <label title="${icon}">
                    <input
                      type="radio"
                      name="editorBlockIcon"
                      value="${icon}"
                      ${index === 0 ? "checked" : ""}
                    >
                    <span>${icon}</span>
                  </label>
                `).join("")}
            </div>
          </fieldset>

          <div class="fiche-editor-field">
            <label for="editorBlockText">
              Texte
            </label>
            <textarea
              id="editorBlockText"
              placeholder="Saisissez le contenu du bloc…"
            ></textarea>
          </div>

          <div
            id="editorImageUploadBox"
            class="fiche-editor-upload-box"
            hidden
          >
            <div class="fiche-editor-field">
              <label for="editorImageFile">
                Choisir une photo
              </label>
              <input
                id="editorImageFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
              >
              <div
                id="editorSelectedFileName"
                class="fiche-editor-file-name"
              ></div>
            </div>

            <div class="fiche-editor-field">
              <label for="editorImageName">
                Nom de la photo
              </label>
              <input
                id="editorImageName"
                type="text"
                maxlength="100"
                placeholder="Ex. présentation tenue cérémonie"
              >
            </div>

            <button
              type="button"
              id="uploadEditorImageButton"
              class="fiche-editor-button secondary"
            >
              Envoyer la photo dans GitHub
            </button>

            <div
              id="editorImageUploadStatus"
              class="fiche-editor-upload-status"
            ></div>

            <div
              id="editorGalleryList"
              class="fiche-editor-upload-status success"
            ></div>
          </div>

          <div
            id="editorOnlineMediaBox"
            class="fiche-editor-field"
            hidden
          >
            <label for="editorMediaUrl">
              Lien de la vidéo en ligne
            </label>
            <input
              id="editorMediaUrl"
              type="url"
              placeholder="https://…"
            >
          </div>

          <div class="fiche-editor-field">
            <label for="editorMediaCaption">
              Légende facultative
            </label>
            <input
              id="editorMediaCaption"
              type="text"
            >
          </div>

          <button
            type="button"
            id="addEditorBlockButton"
            class="fiche-editor-button"
          >
            Ajouter ce bloc
          </button>
        </section>
      </div>

      <div class="fiche-editor-actions">
        <button
          type="button"
          id="previewFicheButton"
          class="fiche-editor-button secondary"
        >
          Prévisualiser
        </button>

        <button
          type="button"
          id="saveFicheButton"
          class="fiche-editor-button"
        >
          Valider et publier
        </button>

        <button
          type="button"
          class="fiche-editor-button secondary fiche-editor-cancel"
        >
          Annuler
        </button>
      </div>

      <div
        id="ficheEditorMessage"
        hidden
      ></div>

      <div
        id="ficheEditorPreview"
        class="fiche-editor-preview"
        hidden
      ></div>
    </section>
  `;

  document.body.appendChild(overlay);

  const closeEditor = () => overlay.remove();

  overlay
    .querySelector(".fiche-editor-close")
    .addEventListener("click", closeEditor);

  overlay
    .querySelector(".fiche-editor-cancel")
    .addEventListener("click", closeEditor);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeEditor();
    }
  });

  const message =
    overlay.querySelector("#ficheEditorMessage");

  const source =
    overlay.querySelector("#editorSource");

  const blockTypeSelect =
    overlay.querySelector("#editorBlockType");

  const colorField =
    overlay
      .querySelector("#editorBlockColor")
      .closest(".fiche-editor-field");

  const iconField =
    overlay
      .querySelector(
        'input[name="editorBlockIcon"]'
      )
      .closest("fieldset");

  const textField =
    overlay
      .querySelector("#editorBlockText")
      .closest(".fiche-editor-field");

  const imageUploadBox =
    overlay.querySelector("#editorImageUploadBox");

  const onlineMediaBox =
    overlay.querySelector("#editorOnlineMediaBox");

  const imageFileInput =
    overlay.querySelector("#editorImageFile");

  const imageNameInput =
    overlay.querySelector("#editorImageName");

  const selectedFileName =
    overlay.querySelector("#editorSelectedFileName");

  const uploadStatus =
    overlay.querySelector("#editorImageUploadStatus");

  const galleryList =
    overlay.querySelector("#editorGalleryList");

  const mediaUrlInput =
    overlay.querySelector("#editorMediaUrl");

  const uploadImageButton =
    overlay.querySelector("#uploadEditorImageButton");

  let galleryImages = [];

  function refreshGalleryList() {
    if (galleryImages.length === 0) {
      galleryList.textContent = "";
      return;
    }

    galleryList.innerHTML = `
      <strong>
        ${galleryImages.length}
        photo${galleryImages.length > 1 ? "s" : ""}
        dans la galerie :
      </strong>
      <br>
      ${galleryImages
        .map((image, index) =>
          `${index + 1}. ${escapeHtml(image.path)}`
        )
        .join("<br>")}
    `;
  }

  function updateMediaFields() {
    const type = blockTypeSelect.value;

    const needsImage =
      type === "texte-image" ||
      type === "galerie";

    imageUploadBox.hidden = !needsImage;
    onlineMediaBox.hidden = type !== "video";

    colorField.hidden =
      type === "galerie" ||
      type === "video";

    iconField.hidden =
      type === "galerie" ||
      type === "video";

    textField.hidden =
      type === "galerie" ||
      type === "video";

    uploadImageButton.textContent =
      type === "galerie"
        ? "Ajouter cette photo à la galerie"
        : "Envoyer la photo dans GitHub";

    if (type !== "galerie") {
      galleryImages = [];
      refreshGalleryList();
    }
  }

  blockTypeSelect.addEventListener(
    "change",
    updateMediaFields
  );

  updateMediaFields();

  imageFileInput.addEventListener(
    "change",
    () => {
      const file =
        imageFileInput.files?.[0];

      selectedFileName.textContent =
        file
          ? `Fichier sélectionné : ${file.name}`
          : "";

      uploadStatus.textContent = "";
      uploadStatus.className =
        "fiche-editor-upload-status";
    }
  );

  uploadImageButton.addEventListener(
    "click",
    async () => {
      const file =
        imageFileInput.files?.[0];

      const requestedName =
        imageNameInput.value.trim();

      if (!file) {
        uploadStatus.textContent =
          "Choisissez d’abord une photo.";
        uploadStatus.className =
          "fiche-editor-upload-status error";
        return;
      }

      if (!requestedName) {
        uploadStatus.textContent =
          "Renseignez le nom de la photo.";
        uploadStatus.className =
          "fiche-editor-upload-status error";
        return;
      }

      uploadImageButton.disabled = true;
      uploadStatus.textContent =
        "Envoi de la photo dans GitHub…";
      uploadStatus.className =
        "fiche-editor-upload-status";

      try {
        const formData =
          new FormData();

        formData.append("photo", file);
        formData.append("photoName", requestedName);
        formData.append(
          "fichePath",
          currentEditableFiche.path
        );
        formData.append(
          "ficheTitle",
          overlay
            .querySelector("#editorFicheTitle")
            .value
            .trim()
        );

        const response = await fetch(
          "/cadres/photo-upload",
          {
            method: "POST",
            credentials: "same-origin",
            body: formData
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "L’envoi de la photo a échoué."
          );
        }

        if (blockTypeSelect.value === "galerie") {
          const caption =
            overlay
              .querySelector("#editorMediaCaption")
              .value
              .trim();

          galleryImages.push({
            path: data.path,
            caption
          });

          refreshGalleryList();

          uploadStatus.textContent =
            `Photo ajoutée à la galerie : ${data.fileName}`;

          const addAnother =
            window.confirm(
              "La photo a été ajoutée à la galerie.\n\n" +
              "Voulez-vous ajouter une autre photo ?"
            );

          imageFileInput.value = "";
          imageNameInput.value = "";
          selectedFileName.textContent = "";
          overlay
            .querySelector("#editorMediaCaption")
            .value = "";

          if (addAnother) {
            imageFileInput.click();
          }
        } else {
          mediaUrlInput.value =
            data.path;

          uploadStatus.textContent =
            `Photo enregistrée : ${data.path}`;
        }

        uploadStatus.className =
          "fiche-editor-upload-status success";

      } catch (error) {
        uploadStatus.textContent =
          error.message;

        uploadStatus.className =
          "fiche-editor-upload-status error";

      } finally {
        uploadImageButton.disabled = false;
      }
    }
  );

  function buildCompleteMarkdown() {
    return (
      buildFrontMatter({
        title:
          overlay.querySelector("#editorFicheTitle").value.trim(),
        quote:
          overlay.querySelector("#editorFicheQuote").value.trim(),
        icon:
          overlay.querySelector("#editorFicheIcon").value.trim(),
        cover:
          overlay.querySelector("#editorFicheCover").value.trim()
      }) +
      source.value.trim() +
      "\n"
    );
  }

  overlay
    .querySelector("#addEditorBlockButton")
    .addEventListener("click", () => {
      try {
        const selectedIcon =
          overlay.querySelector(
            'input[name="editorBlockIcon"]:checked'
          )?.value || "ℹ️";

        const block =
          editorBlockMarkdown({
            type:
              blockTypeSelect.value,
            color:
              overlay.querySelector("#editorBlockColor").value,
            title:
              overlay.querySelector("#editorBlockTitle").value.trim(),
            icon:
              selectedIcon,
            text:
              overlay.querySelector("#editorBlockText").value,
            mediaUrl:
              blockTypeSelect.value === "texte-image"
                ? mediaUrlInput.value.trim()
                : overlay.querySelector("#editorMediaUrl").value.trim(),
            caption:
              overlay.querySelector("#editorMediaCaption").value.trim(),
            galleryImages
          });

        source.value =
          [
            source.value.trim(),
            block
          ]
            .filter(Boolean)
            .join("\n\n");

        overlay.querySelector("#editorBlockText").value = "";
        overlay.querySelector("#editorMediaUrl").value = "";
        overlay.querySelector("#editorMediaCaption").value = "";

        imageFileInput.value = "";
        imageNameInput.value = "";
        selectedFileName.textContent = "";
        uploadStatus.textContent = "";
        uploadStatus.className =
          "fiche-editor-upload-status";
        galleryImages = [];
        refreshGalleryList();

        message.hidden = false;
        message.className = "fiche-editor-message";
        message.textContent =
          "Bloc ajouté. Vous pouvez en ajouter un autre ou publier la fiche.";

      } catch (error) {
        message.hidden = false;
        message.className =
          "fiche-editor-message error";
        message.textContent = error.message;
      }
    });

  overlay
    .querySelector("#previewFicheButton")
    .addEventListener("click", () => {
      const preview =
        overlay.querySelector("#ficheEditorPreview");

      preview.innerHTML =
        markdownToHtml(buildCompleteMarkdown());

      preview.hidden = false;
      preview.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

  overlay
    .querySelector("#saveFicheButton")
    .addEventListener("click", async event => {
      const confirmed = window.confirm(
        "Êtes-vous sûr de vouloir publier cette nouvelle version de la fiche ?\n\n" +
        "La modification sera enregistrée directement dans GitHub et déclenchera un nouveau déploiement."
      );

      if (!confirmed) {
        return;
      }

      const button = event.currentTarget;
      button.disabled = true;

      message.hidden = false;
      message.className = "fiche-editor-message";
      message.textContent =
        "Publication dans GitHub en cours…";

      try {
        const markdown =
          buildCompleteMarkdown();

        const response = await fetch(
          "/cadres/fiche-save",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "Accept":
                "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
              path:
                currentEditableFiche.path,
              markdown,
              title:
                overlay.querySelector("#editorFicheTitle").value.trim()
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "La publication a échoué."
          );
        }

        currentEditableFiche.markdown =
          markdown;

        message.className =
          "fiche-editor-message";

        message.textContent =
          "La fiche a été enregistrée dans GitHub. Le site sera actualisé après le déploiement Cloudflare.";

      } catch (error) {
        message.className =
          "fiche-editor-message error";
        message.textContent = error.message;

      } finally {
        button.disabled = false;
      }
    });
}

function createEmptyFicheMarkdown(item) {
  return buildFrontMatter({
    title: item?.title || "Nouvelle fiche",
    icon: "",
    cover: "",
    quote: ""
  });
}

function renderEmptyFicheForCadre(path, item) {
  const markdown =
    createEmptyFicheMarkdown(item);

  detailContent.innerHTML =
    markdownToHtml(markdown);

  setDetailView();

  renderFicheEditButton(
    path,
    markdown,
    item
  );

  const content =
    detailContent.querySelector(".fiche-content");

  if (content) {
    content.innerHTML = `
      <section class="fiche-card fiche-card-gris">
        <div class="fiche-card-head">
          <span class="fiche-card-icon">✏️</span>
          <strong>Fiche vide</strong>
        </div>
        <div class="fiche-card-body">
          <p>
            Cette fiche n’existe pas encore.
            Utilisez le bouton « Modifier la fiche »
            pour créer son contenu.
          </p>
        </div>
      </section>
    `;
  }
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

    renderFicheEditButton(
      path,
      markdown,
      item
    );

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

    const item =
      findItemByContent(path);

    if (isCadreMode() && item) {
      renderEmptyFicheForCadre(
        path,
        item
      );

      if (addHistory) {
        history.pushState(
          {
            type: "content",
            path
          },
          "",
          "#" + item.slug
        );
      }

      return;
    }

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
