
/* ==========================================================
   POSITION DE DÉFILEMENT ENTRE LES PAGES
   ========================================================== */
(() => {
  const PREFIX = "ci6-scroll-position:";
  let currentKey =
    location.pathname +
    location.search +
    location.hash;

  let normalHashNavigation = false;
  let restoreRequested = false;

  try {
    history.scrollRestoration = "manual";
  } catch {
    /* Certains navigateurs anciens ne proposent pas cette option. */
  }

  function pageKey() {
    return (
      location.pathname +
      location.search +
      location.hash
    );
  }

  function storageKey(key = pageKey()) {
    return PREFIX + key;
  }

  function savePosition(key = currentKey) {
    try {
      sessionStorage.setItem(
        storageKey(key),
        JSON.stringify({
          x: window.scrollX || 0,
          y: window.scrollY || 0,
          savedAt: Date.now()
        })
      );
    } catch {
      /* La navigation reste fonctionnelle sans sessionStorage. */
    }
  }

  function readPosition(key = pageKey()) {
    try {
      const raw =
        sessionStorage.getItem(
          storageKey(key)
        );

      if (!raw) {
        return null;
      }

      const value = JSON.parse(raw);

      if (
        !value ||
        Date.now() - Number(value.savedAt || 0) >
          24 * 60 * 60 * 1000
      ) {
        return null;
      }

      return {
        x: Number(value.x || 0),
        y: Number(value.y || 0)
      };
    } catch {
      return null;
    }
  }

  function applyPosition(position) {
    const target =
      position || { x: 0, y: 0 };

    const restore = () => {
      window.scrollTo({
        left: target.x,
        top: target.y,
        behavior: "auto"
      });
    };

    /*
     * Plusieurs passages permettent d’attendre le rendu
     * des fiches et des éléments chargés dynamiquement.
     */
    requestAnimationFrame(restore);
    window.setTimeout(restore, 60);
    window.setTimeout(restore, 180);
    window.setTimeout(restore, 420);
    window.setTimeout(restore, 800);
  }

  function restoreCurrentPage() {
    applyPosition(
      readPosition(pageKey())
    );
  }

  function placeCurrentPageAtTop() {
    applyPosition({ x: 0, y: 0 });
  }

  const navigationEntry =
    performance
      .getEntriesByType?.("navigation")?.[0];

  const initialBackForward =
    navigationEntry?.type === "back_forward";

  window.addEventListener(
    "pagehide",
    () => savePosition()
  );

  window.addEventListener(
    "beforeunload",
    () => savePosition()
  );

  document.addEventListener(
    "click",
    event => {
      const link =
        event.target.closest?.("a[href]");

      if (!link) {
        return;
      }

      let url;

      try {
        url = new URL(
          link.href,
          location.href
        );
      } catch {
        return;
      }

      if (url.origin !== location.origin) {
        return;
      }

      savePosition(currentKey);

      const targetKey =
        url.pathname +
        url.search +
        url.hash;

      /*
       * Un clic normal ouvre la nouvelle page en haut.
       * La position existante de cette destination ne doit
       * servir que lors d’un véritable retour arrière.
       */
      if (targetKey !== currentKey) {
        normalHashNavigation = true;
      }
    },
    true
  );

  window.addEventListener(
    "popstate",
    () => {
      savePosition(currentKey);
      restoreRequested = true;
    }
  );

  window.addEventListener(
    "hashchange",
    () => {
      currentKey = pageKey();

      window.setTimeout(() => {
        if (restoreRequested) {
          restoreRequested = false;
          normalHashNavigation = false;
          restoreCurrentPage();
          return;
        }

        if (normalHashNavigation) {
          normalHashNavigation = false;
          placeCurrentPageAtTop();
          return;
        }

        placeCurrentPageAtTop();
      }, 0);
    }
  );

  window.addEventListener(
    "pageshow",
    event => {
      currentKey = pageKey();

      if (
        event.persisted ||
        initialBackForward
      ) {
        restoreCurrentPage();
      } else {
        placeCurrentPageAtTop();
      }
    }
  );
})();


const grid = document.getElementById("cardsGrid"), pelotonsSection = document.getElementById("pelotonsSection"), pelotonsGrid = document.getElementById("pelotonsGrid"), searchInput = document.getElementById("searchInput"), homeView = document.getElementById("homeView"), detailView = document.getElementById("detailView"), detailContent = document.getElementById("detailContent"), backBtn = document.getElementById("backBtn");

let currentParent = null;

/*
 * Configuration d’affichage des rubriques principales.
 * Une rubrique absente de la table reste visible par défaut.
 */
let homepageTileSettings = {};

function isVisitorMode() {
  return (
    currentSession.type === "user" &&
    currentSession.role === "visiteur"
  );
}

function findItemVisibilityState(
  slug,
  items = getRubriques(),
  parentHidden = false
) {
  for (const item of items) {
    const hidden =
      parentHidden ||
      homepageTileSettings[item.slug] === false;

    if (item.slug === slug) {
      return hidden;
    }

    if (Array.isArray(item.children)) {
      const childState =
        findItemVisibilityState(
          slug,
          item.children,
          hidden
        );

      if (childState !== null) {
        return childState;
      }
    }
  }

  return null;
}

function isItemHiddenForStudents(item) {
  return (
    findItemVisibilityState(item.slug) === true
  );
}

function isHomepageTileVisible(item) {
  /*
   * Les cadres, administrateurs et visiteurs voient
   * toujours toutes les tuiles, y compris celles
   * masquées aux élèves.
   */
  if (isCadreMode()) {
    return true;
  }

  return !isItemHiddenForStudents(item);
}

function isHomepageTileHiddenForStudents(item) {
  return isItemHiddenForStudents(item);
}

function hasHiddenDescendantForStudents(item) {
  if (
    homepageTileSettings[item.slug] === false ||
    !Array.isArray(item.children) ||
    item.children.length === 0
  ) {
    return false;
  }

  return item.children.some(child =>
    homepageTileSettings[child.slug] === false ||
    hasHiddenDescendantForStudents(child)
  );
}

function isItemAvailableToCurrentUser(item) {
  return (
    isItemVisible(item) &&
    (
      isCadreMode() ||
      !isItemHiddenForStudents(item)
    )
  );
}

function getVisibleHomepageRubriques() {
  return getRubriques()
    .filter(isHomepageTileVisible);
}

async function loadHomepageTileSettings() {
  try {
    const response = await fetch(
      "/api/homepage-tiles",
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        cache: "no-store",
        credentials: "same-origin"
      }
    );

    if (!response.ok) {
      throw new Error(
        "Configuration des tuiles indisponible."
      );
    }

    const data = await response.json();

    homepageTileSettings =
      data.tiles &&
      typeof data.tiles === "object" &&
      !Array.isArray(data.tiles)
        ? data.tiles
        : {};

  } catch (error) {
    /*
     * En cas d’indisponibilité temporaire,
     * toutes les rubriques restent visibles.
     */
    homepageTileSettings = {};

    console.warn(
      "Impossible de charger l’affichage des tuiles.",
      error
    );
  }
}

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
      currentSession.role === "admin" ||
      currentSession.role === "visiteur"
    )
  );
}

function canAccessRoles(allowedRoles) {
  if (isVisitorMode()) {
    return true;
  }

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

function findVisibleItemBySlug(slug) {
    return flattenItems(
      getVisibleHomepageRubriques()
    ).find(
      item =>
        item.slug === slug &&
        isItemAvailableToCurrentUser(item)
    );
}

function findVisibleItemByContent(path) {
    return flattenItems(
      getVisibleHomepageRubriques()
    ).find(
      item =>
        item.content === path &&
        isItemAvailableToCurrentUser(item)
    );
}

/*
 * Ces noms sont conservés pour le reste de l’application.
 * Ils respectent désormais le masquage des tuiles d’accueil.
 */
function findItemBySlug(slug) {
    return findVisibleItemBySlug(slug);
}

function findItemByContent(path) {
    return findVisibleItemByContent(path);
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


function injectHiddenHomepageTileStyles() {
  if (
    document.getElementById(
      "ci6-hidden-homepage-tile-styles"
    )
  ) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ci6-hidden-homepage-tile-styles";

  style.textContent = `
    .tile.tile-hidden-for-students {
      box-shadow:
        0 0 0 3px rgba(210,55,55,.95),
        0 18px 42px rgba(0,0,0,.45) !important;
    }

    .tile.tile-hidden-for-students::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 3;
      display: block;
      border: 3px solid rgba(210,55,55,.95);
      border-radius: inherit;
      pointer-events: none;
    }


    .tile-partial-hidden-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      left: 10px;
      z-index: 5;
      padding: 7px 9px;
      border: 1px solid rgba(175,215,255,.82);
      border-radius: 7px;
      background: rgba(24,76,132,.94);
      color: #eef7ff;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.2;
      letter-spacing: .035em;
      text-align: center;
      text-transform: uppercase;
      text-shadow: 0 1px 3px #000;
      pointer-events: none;
    }

    .tile-hidden-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      left: 10px;
      z-index: 5;
      padding: 7px 9px;
      border: 1px solid rgba(255,190,190,.78);
      border-radius: 7px;
      background: rgba(135,18,18,.92);
      color: #fff;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.2;
      letter-spacing: .045em;
      text-align: center;
      text-transform: uppercase;
      text-shadow: 0 1px 3px #000;
      pointer-events: none;
    }


    .child-nav-tile.child-nav-tile-hidden-for-students {
      box-shadow:
        0 0 0 3px rgba(210,55,55,.95),
        0 14px 30px rgba(0,0,0,.38) !important;
    }

    .child-nav-tile.child-nav-tile-hidden-for-students::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 4;
      border: 3px solid rgba(210,55,55,.95);
      border-radius: inherit;
      pointer-events: none;
    }

    .child-hidden-badge {
      position: absolute;
      right: 8px;
      bottom: 8px;
      left: 8px;
      z-index: 6;
      padding: 6px 8px;
      border: 1px solid rgba(255,190,190,.78);
      border-radius: 7px;
      background: rgba(135,18,18,.94);
      color: #fff;
      font-size: 10px;
      font-weight: 900;
      line-height: 1.2;
      letter-spacing: .04em;
      text-align: center;
      text-transform: uppercase;
      text-shadow: 0 1px 3px #000;
      pointer-events: none;
    }

    .peloton-tile .tile-partial-hidden-badge {
      top: 6px;
      right: 6px;
      left: 6px;
      padding: 5px 4px;
      font-size: 9px;
      letter-spacing: .015em;
    }

    .peloton-tile .tile-hidden-badge {
      top: 6px;
      right: 6px;
      left: 6px;
      padding: 5px 4px;
      font-size: 9px;
      letter-spacing: .02em;
    }

    @media (max-width: 760px) {
      .tile.tile-hidden-for-students {
        box-shadow:
          0 0 0 2px rgba(210,55,55,.95),
          0 14px 30px rgba(0,0,0,.42) !important;
      }

      .tile.tile-hidden-for-students::after {
        border-width: 2px;
      }

      .tile-partial-hidden-badge {
        top: 6px;
        right: 6px;
        left: 6px;
        padding: 5px 6px;
        font-size: 9px;
      }

      .tile-hidden-badge {
        top: 6px;
        right: 6px;
        left: 6px;
        padding: 5px 6px;
        font-size: 9px;
      }
    }
  `;

  document.head.appendChild(style);
}

function renderTileMarkup(item, compact = false) {
    const hiddenForStudents =
        isCadreMode() &&
        isHomepageTileHiddenForStudents(item);

    const partiallyHiddenForStudents =
        isCadreMode() &&
        !hiddenForStudents &&
        hasHiddenDescendantForStudents(item);

    return `
        <button
            class="tile${compact ? " peloton-tile" : ""}${hiddenForStudents ? " tile-hidden-for-students" : ""}${partiallyHiddenForStudents ? " tile-partially-hidden-for-students" : ""}"
            data-slug="${item.slug}"
            aria-label="${item.title}${hiddenForStudents ? " — tuile masquée aux élèves" : partiallyHiddenForStudents ? " — rubrique partiellement masquée aux élèves" : ""}"
        >
            <img
                class="tile-bg"
                src="${item.card}"
                alt=""
                loading="lazy"
            >

            ${hiddenForStudents
              ? `
                <span class="tile-hidden-badge">
                  Tuile masquée aux élèves
                </span>
              `
              : partiallyHiddenForStudents
                ? `
                  <span class="tile-partial-hidden-badge">
                    Rubrique partiellement masquée
                  </span>
                `
                : ""}

            <span class="tile-text">
                <strong>${item.title}</strong>
                <em>${item.description || ""}</em>
            </span>
        </button>
    `;
}

function bindHomepageTileClicks(container) {
    if (!container) {
        return;
    }

    container
        .querySelectorAll(".tile")
        .forEach(tile => {
            tile.addEventListener("click", () => {
                const item = findVisibleItemBySlug(
                    tile.dataset.slug
                );

                if (!item) {
                    return;
                }

                if (
                    Array.isArray(item.children) &&
                    (
                        item.children.length > 0 ||
                        item.homeGroup === "pelotons"
                    )
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

function renderCards(filter = "") {
    const query = normalizeText(filter).trim();

    /*
     * Une rubrique principale masquée ainsi que toutes
     * ses sous-rubriques sont exclues de l’accueil
     * et des résultats de recherche.
     */
    const visibleHomepageRubriques =
        getVisibleHomepageRubriques();

    if (query) {
        const rubriques = flattenItems(
            visibleHomepageRubriques
        )
            .filter(isItemAvailableToCurrentUser)
            .filter(item =>
                itemMatchesSearch(item, query)
            );

        grid.innerHTML = rubriques
            .map(item => renderTileMarkup(item))
            .join("");

        if (pelotonsSection) {
            pelotonsSection.hidden = true;
        }

        if (pelotonsGrid) {
            pelotonsGrid.innerHTML = "";
        }

        bindHomepageTileClicks(grid);
        return;
    }

    const mainRubriques =
        visibleHomepageRubriques
            .filter(isItemAvailableToCurrentUser)
            .filter(item =>
                item.homeGroup !== "pelotons"
            );

    const pelotonRubriques =
        visibleHomepageRubriques
            .filter(isItemAvailableToCurrentUser)
            .filter(item =>
                item.homeGroup === "pelotons"
            );

    grid.innerHTML = mainRubriques
        .map(item => renderTileMarkup(item))
        .join("");

    if (pelotonsGrid) {
        pelotonsGrid.innerHTML = pelotonRubriques
            .map(item =>
                renderTileMarkup(item, true)
            )
            .join("");
    }

    if (pelotonsSection) {
        pelotonsSection.hidden =
            pelotonRubriques.length === 0;
    }

    bindHomepageTileClicks(grid);
    bindHomepageTileClicks(pelotonsGrid);
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
      .filter(isItemAvailableToCurrentUser);

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
            ${visibleChildren.map(child => {
              const hiddenForStudents =
                isCadreMode() &&
                isItemHiddenForStudents(child);

              return `
                <button
                  class="child-nav-tile${hiddenForStudents ? " child-nav-tile-hidden-for-students" : ""}"
                  data-slug="${child.slug}"
                  aria-label="${child.title}${hiddenForStudents ? " — sous-domaine masqué aux élèves" : ""}"
                >
                  <img
                    class="child-nav-img"
                    src="${child.card}"
                    alt=""
                    loading="lazy"
                  >

                  ${hiddenForStudents
                    ? `
                      <span class="child-hidden-badge">
                        Masquée aux élèves
                      </span>
                    `
                    : ""}

                  <span class="child-nav-title">
                    ${child.title}
                  </span>
                </button>
              `;
            }).join("")}
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
            '<a class="fiche-inline-image-link" href="$2"><img class="fiche-inline-image" src="$2" alt="$1" loading="lazy"></a>'
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
            '<a href="$2">$1</a>'
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
        return `\n            <a class="download-item" href="${url}">\n              <span>${getDownloadIcon(url || "")}</span>\n              <strong>${label}</strong>\n              <em>Ouvrir</em>\n            </a>\n          `;
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


const GALLERY_RETURN_STORAGE_KEY =
  "ci6-gallery-return-position";

function saveGalleryReturnPosition(link) {
  const gallery = link.closest(".media-gallery-card");
  const fiche = link.closest(".fiche");

  if (!gallery || !fiche) return;

  const galleries = Array.from(
    fiche.querySelectorAll(".media-gallery-card")
  );

  sessionStorage.setItem(
    GALLERY_RETURN_STORAGE_KEY,
    JSON.stringify({
      hash: window.location.hash,
      galleryIndex: galleries.indexOf(gallery),
      scrollY: window.scrollY,
      savedAt: Date.now()
    })
  );
}

function restoreGalleryReturnPosition() {
  const raw = sessionStorage.getItem(
    GALLERY_RETURN_STORAGE_KEY
  );

  if (!raw) return;

  let state;

  try {
    state = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(
      GALLERY_RETURN_STORAGE_KEY
    );
    return;
  }

  if (
    !state ||
    state.hash !== window.location.hash ||
    Date.now() - Number(state.savedAt || 0) >
      30 * 60 * 1000
  ) {
    return;
  }

  sessionStorage.removeItem(
    GALLERY_RETURN_STORAGE_KEY
  );

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const galleries =
        document.querySelectorAll(
          ".fiche .media-gallery-card"
        );

      const gallery =
        galleries[Number(state.galleryIndex || 0)];

      if (gallery) {
        gallery.scrollIntoView({
          block: "start",
          behavior: "auto"
        });

        window.scrollBy({
          top: -18,
          left: 0,
          behavior: "auto"
        });

        return;
      }

      window.scrollTo({
        top: Number(state.scrollY || 0),
        left: 0,
        behavior: "auto"
      });
    });
  });
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

    .fiche-non-lus-button {
      min-height: 42px;
      padding: 10px 16px;
      border: 1px solid rgba(126,163,201,.72);
      border-radius: 9px;
      color: #d9e9f8;
      background: rgba(22,48,72,.9);
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .fiche-non-lus-button:hover,
    .fiche-non-lus-button:focus-visible {
      background: rgba(34,72,106,.98);
      outline: 3px solid rgba(126,163,201,.2);
      outline-offset: 2px;
    }

    .fiche-non-lus-overlay {
      position: fixed;
      inset: 0;
      z-index: 10050;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(0,0,0,.78);
    }

    .fiche-non-lus-dialog {
      width: min(760px,100%);
      max-height: calc(100dvh - 36px);
      overflow: auto;
      padding: 22px;
      border: 1px solid rgba(126,163,201,.7);
      border-radius: 14px;
      background: #0b1015;
      box-shadow: 0 24px 70px rgba(0,0,0,.62);
    }

    .fiche-non-lus-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }

    .fiche-non-lus-head h2 {
      margin: 0;
      color: #9bc3e8;
    }

    .fiche-non-lus-close {
      min-width: 40px;
      min-height: 40px;
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 50%;
      color: #fff;
      background: #171b20;
      font-size: 22px;
      cursor: pointer;
    }

    .fiche-non-lus-summary {
      margin: 0 0 14px;
      color: #dfe7ef;
    }

    .fiche-non-lus-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .fiche-non-lus-list li {
      display: grid;
      grid-template-columns: 110px minmax(0,1fr);
      gap: 12px;
      padding: 11px 13px;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 8px;
      background: rgba(255,255,255,.035);
    }

    @media (max-width: 820px) {
      .fiche-edit-toolbar {
        flex-wrap: wrap;
        gap: 12px;
      }

      .fiche-non-lus-button {
        width: 100%;
      }

      .fiche-non-lus-list li {
        grid-template-columns: 1fr;
        gap: 3px;
      }
    }

    .fiche-edit-toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 14px;
      margin: 0 0 18px;
    }

    .fiche-edit-button,
    .fiche-editor-button {
      min-height: 42px;
      padding: 10px 16px;
      border: 1px solid #f4d77a !important;
      border-radius: 9px;
      color: #090a0b !important;
      background:
        linear-gradient(
          135deg,
          #f4d77a,
          #b88318
        ) !important;
      -webkit-appearance: none;
      appearance: none;
      font: inherit;
      font-weight: 800;
      line-height: 1.2;
      text-shadow: none !important;
      opacity: 1 !important;
      cursor: pointer;
    }

    .fiche-edit-button:hover,
    .fiche-edit-button:focus-visible {
      color: #050607 !important;
      background:
        linear-gradient(
          135deg,
          #ffe99d,
          #d19a29
        ) !important;
      outline: 3px solid rgba(244,215,122,.25);
      outline-offset: 2px;
    }

    .fiche-edit-button:disabled {
      color: #090a0b !important;
      background:
        linear-gradient(
          135deg,
          #e5ca76,
          #a97618
        ) !important;
      opacity: .65 !important;
    }

    .fiche-editor-button.secondary {
      color: #f5f5f5;
      background: #15191d;
      border-color: rgba(223,227,232,.4);
    }

    #cancelEditorBlockButton {
      min-height: 38px;
      padding: 7px 14px;
      color: #c8c2b7 !important;
      border-color: rgba(200,194,183,.32) !important;
      background: rgba(20,22,25,.82) !important;
      font-weight: 700;
    }

    #cancelEditorBlockButton:hover,
    #cancelEditorBlockButton:focus-visible {
      color: #ffffff !important;
      border-color: rgba(244,215,122,.55) !important;
      background: #24272b !important;
    }

    #saveFicheButton {
      width: 100%;
      min-height: 52px;
      font-size: 17px;
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
      width: min(1440px,calc(100vw - 40px));
      max-height: calc(100dvh - 36px);
      overflow: auto;
      padding: clamp(16px,2vw,28px);
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


    .ci6-gallery-lightbox {
      position: fixed;
      inset: 0;
      z-index: 12000;
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) 64px;
      grid-template-rows: 56px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: rgba(0,0,0,.94);
      touch-action: pan-y;
    }

    .ci6-gallery-lightbox[hidden] {
      display: none !important;
    }

    .ci6-gallery-lightbox-close {
      grid-column: 3;
      grid-row: 1;
      justify-self: end;
      width: 46px;
      height: 46px;
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 50%;
      background: rgba(20,20,20,.82);
      color: #fff;
      font-size: 30px;
      cursor: pointer;
    }

    .ci6-gallery-lightbox-image-wrap {
      grid-column: 2;
      grid-row: 2;
      display: grid;
      place-items: center;
      min-width: 0;
      min-height: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .ci6-gallery-lightbox-image {
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: none;
    }

    .ci6-gallery-lightbox-nav {
      grid-row: 2;
      align-self: center;
      width: 52px;
      height: 68px;
      border: 1px solid rgba(255,255,255,.28);
      border-radius: 10px;
      background: rgba(20,20,20,.72);
      color: #fff;
      font-size: 38px;
      cursor: pointer;
    }

    .ci6-gallery-lightbox-prev {
      grid-column: 1;
    }

    .ci6-gallery-lightbox-next {
      grid-column: 3;
    }

    .ci6-gallery-lightbox-caption {
      grid-column: 1 / -1;
      grid-row: 3;
      margin: 0;
      padding: 10px 16px 14px;
      color: #f1f1f1;
      font-size: 15px;
      line-height: 1.45;
      text-align: center;
    }

    .ci6-gallery-lightbox-counter {
      position: absolute;
      top: 18px;
      left: 18px;
      color: #d7d7d7;
      font-size: 14px;
      font-weight: 700;
    }

    @media (max-width: 760px) {
      .ci6-gallery-lightbox {
        grid-template-columns: 48px minmax(0, 1fr) 48px;
        grid-template-rows: 50px minmax(0, 1fr) auto;
        gap: 4px;
        padding: 4px;
      }

      .ci6-gallery-lightbox-nav {
        width: 44px;
        height: 58px;
        font-size: 32px;
      }

      .ci6-gallery-lightbox-caption {
        font-size: 13px;
        padding: 8px 10px 12px;
      }
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

    .fiche-editor-header-panel textarea {
      width: 100%;
      min-height: 78px;
      resize: vertical;
      line-height: 1.45;
    }

    .fiche-editor-dialog input,
    .fiche-editor-dialog select,
    .fiche-editor-dialog textarea,
    .fiche-editor-dialog button {
      max-width: 100%;
    }

    .fiche-editor-color-help {
      margin-top: 8px;
      padding: 10px 12px;
      border-left: 3px solid rgba(214,173,58,.7);
      border-radius: 6px;
      background: rgba(214,173,58,.055);
      color: #d8d1c4;
      font-size: 13px;
      line-height: 1.45;
    }

    .fiche-editor-color-help strong {
      color: #f4d77a;
    }



    .fiche-editor-notification-box {
      display: grid;
      gap: 12px;
      margin: 18px 0 4px;
      padding: 14px;
      border: 1px solid rgba(72,145,218,.62);
      border-radius: 10px;
      background: rgba(20,63,108,.22);
    }

    .fiche-editor-notification-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #eaf5ff;
      font-weight: 800;
    }

    .fiche-editor-notification-toggle input {
      width: 20px;
      height: 20px;
      accent-color: #347fc4;
    }

    .fiche-editor-notification-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .fiche-editor-notification-options .wide {
      grid-column: 1 / -1;
    }

    @media (max-width: 650px) {
      .fiche-editor-notification-options { grid-template-columns: 1fr; }
      .fiche-editor-notification-options .wide { grid-column: auto; }
    }

    .fiche-editor-cover-box {
      display: grid;
      gap: 12px;
      padding: 14px;
      border: 1px solid rgba(80,145,220,.55);
      border-radius: 10px;
      background: rgba(25,65,110,.18);
    }

    .fiche-editor-cover-preview {
      position: relative;
      overflow: hidden;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 9px;
      background:
        linear-gradient(
          135deg,
          rgba(255,255,255,.04),
          rgba(0,0,0,.28)
        );
    }

    .fiche-editor-cover-preview img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .fiche-editor-cover-empty {
      display: grid;
      place-items: center;
      height: 100%;
      padding: 18px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
      text-align: center;
    }

    .fiche-editor-cover-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .fiche-editor-cover-actions .fiche-editor-button {
      flex: 1 1 210px;
    }

    .fiche-editor-cover-remove {
      color: #ffdada !important;
      border-color: rgba(230,80,80,.62) !important;
      background: rgba(110,20,20,.35) !important;
    }

    .fiche-editor-upload-box {
      margin-top: 10px;
      padding: 14px;
      border: 1px dashed rgba(214,173,58,.5);
      border-radius: 9px;
      background: rgba(214,173,58,.045);
    }

    .fiche-editor-section-title {
      margin: 0;
      font-weight: 800;
      line-height: 1.25;
      letter-spacing: .01em;
    }

    /*
     * Zone « Ajouter un bloc » :
     * anthracite bleuté, titre bleu clair.
     */
    #ficheEditorBlockForm {
      border-color: rgba(76,112,146,.72);
      background:
        linear-gradient(
          145deg,
          rgba(20,31,43,.98),
          rgba(10,15,20,.98)
        );
      box-shadow:
        inset 0 0 0 1px rgba(130,170,210,.08);
    }

    #ficheEditorBlockForm .fiche-editor-section-title.block {
      color: #89b9e8;
      text-shadow: 0 1px 0 rgba(0,0,0,.55);
    }

    #ficheEditorBlockForm > .fiche-editor-form-title {
      padding: 2px 2px 12px;
      border-bottom: 1px solid rgba(93,137,178,.28);
    }

    #ficheEditorBlockForm .fiche-editor-field > label,
    #ficheEditorBlockForm .fiche-editor-legend {
      color: #d7e4f0;
    }

    .fiche-editor-upload-title {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.25;
      letter-spacing: .01em;
    }

    /*
     * Zone photo :
     * fond aubergine très sombre, titre mauve clair.
     */
    #editorImageUploadBox {
      border-color: rgba(132,84,142,.78);
      background:
        linear-gradient(
          145deg,
          rgba(42,25,47,.98),
          rgba(18,12,21,.98)
        );
      box-shadow:
        inset 0 0 0 1px rgba(176,125,190,.08);
    }

    .fiche-editor-upload-title.photo {
      color: #c79add;
      text-shadow: 0 1px 0 rgba(0,0,0,.55);
    }

    #editorImageUploadBox .fiche-editor-field > label {
      color: #eadff0;
    }

    /*
     * Zone documents :
     * fond bordeaux très sombre, titre rose bordeaux clair.
     */
    #editorDocumentsBox {
      border-color: rgba(145,69,88,.8);
      background:
        linear-gradient(
          145deg,
          rgba(49,24,31,.98),
          rgba(21,11,14,.98)
        );
      box-shadow:
        inset 0 0 0 1px rgba(190,102,124,.08);
    }

    .fiche-editor-upload-title.document {
      color: #d994a7;
      text-shadow: 0 1px 0 rgba(0,0,0,.55);
    }

    #editorDocumentsBox .fiche-editor-field > label {
      color: #f0dce2;
    }

    #editorDocumentsBox .fiche-editor-upload-status.success {
      color: #a9d7ac;
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
      margin: 16px 0 4px;
      padding: 12px 14px;
      border-radius: 8px;
      color: #dcecff;
      background: rgba(25,65,110,.28);
      border: 1px solid rgba(80,145,220,.55);
    }

    .fiche-editor-visitor-banner {
      margin: 0 0 16px;
      padding: 13px 15px;
      color: #dcecff;
      font-weight: 700;
      line-height: 1.5;
      border: 1px solid rgba(80, 145, 220, 0.68);
      border-radius: 9px;
      background: rgba(25, 65, 110, 0.3);
    }

    .fiche-editor-button:disabled {
      cursor: not-allowed;
      opacity: 0.48;
      transform: none;
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

    .fiche-editor-preview {
      display: grid;
      gap: 14px;
    }

    .fiche-editor-block-shell {
      position: relative;
      padding-top: 48px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 11px;
      background: rgba(255,255,255,.018);
      overflow: hidden;
    }

    .fiche-editor-block-toolbar {
      position: absolute;
      inset: 0 0 auto 0;
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 7px;
      min-height: 42px;
      padding: 7px 9px;
      border-bottom: 1px solid rgba(255,255,255,.1);
      background: #111418;
      z-index: 2;
    }

    .fiche-editor-mini-button {
      min-height: 30px;
      padding: 5px 9px;
      border: 1px solid rgba(214,173,58,.48);
      border-radius: 7px;
      color: #f5f5f5;
      background: #20252a;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .fiche-editor-mini-button.danger {
      border-color: rgba(255,105,105,.55);
      background: #6d2020;
    }

    .fiche-editor-block-content {
      padding: 12px;
    }

    .fiche-editor-empty {
      padding: 28px 18px;
      text-align: center;
      color: #c9c2b4;
      border: 1px dashed rgba(214,173,58,.5);
      border-radius: 10px;
    }

    .fiche-editor-header-panel {
      margin-bottom: 18px;
    }

    .fiche-editor-block-form[hidden] {
      display: none;
    }

    .fiche-editor-form-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .fiche-editor-form-title h3 {
      margin: 0;
    }

    .fiche-editor-add-zone {
      display: flex;
      justify-content: center;
      margin-top: 16px;
    }

    @media (min-width: 1280px) {
      .fiche-editor-dialog {
        width: min(1500px,calc(100vw - 56px));
      }

      .fiche-editor-preview {
        padding: 20px;
      }
    }

    @media (max-width: 820px) {
      .fiche-edit-toolbar {
        justify-content: stretch;
      }

      .fiche-edit-button {
        width: 100%;
        min-height: 48px;
        font-size: 16px;
        text-align: center;
      }

      .fiche-editor-overlay {
        display: block;
        padding: 0;
        background: #080a0c;
      }

      .fiche-editor-dialog {
        width: 100%;
        min-height: 100dvh;
        max-height: 100dvh;
        padding: 14px;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .fiche-editor-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .fiche-editor-panel {
        padding: 12px;
      }

      .fiche-editor-head {
        position: sticky;
        top: -14px;
        z-index: 20;
        margin: -14px -14px 14px;
        padding: 12px 14px;
        background: rgba(8,10,12,.96);
        border-bottom: 1px solid rgba(214,173,58,.35);
        backdrop-filter: blur(8px);
      }

      .fiche-editor-head h2 {
        font-size: 19px;
      }

      .fiche-editor-head p {
        font-size: 11px;
        overflow-wrap: anywhere;
      }

      .fiche-editor-close {
        flex: 0 0 auto;
        width: 38px;
        height: 38px;
      }

      .fiche-editor-radio-grid {
        grid-template-columns: repeat(4,minmax(42px,1fr));
      }

      .fiche-editor-block-toolbar {
        position: static;
        justify-content: flex-start;
      }

      .fiche-editor-block-shell {
        padding-top: 0;
      }

      .fiche-editor-block-content {
        padding: 8px;
      }

      .fiche-editor-actions {
        align-items: stretch;
      }

      .fiche-editor-actions .fiche-editor-button {
        width: 100%;
      }

      #ficheEditorBlockForm .fiche-editor-actions {
        display: grid;
        grid-template-columns: minmax(0,1fr) auto;
        align-items: center;
      }

      #ficheEditorBlockForm #cancelEditorBlockButton {
        width: auto;
        min-height: 44px;
      }

      .fiche-editor-mini-button {
        flex: 1 1 auto;
      }
    }

    @media (max-width: 430px) {
      .fiche-editor-dialog {
        padding: 10px;
      }

      .fiche-editor-head {
        top: -10px;
        margin: -10px -10px 12px;
        padding: 10px;
      }

      .fiche-editor-panel {
        padding: 10px;
      }

      .fiche-editor-radio-grid {
        grid-template-columns: repeat(3,minmax(42px,1fr));
      }

      .fiche-editor-preview {
        padding: 8px;
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

function documentsMarkdownList(documents = []) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return "";
  }

  return [
    "",
    "**Documents à télécharger**",
    ...documents.map(document =>
      `- [${document.label}](${document.url})`
    )
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
  galleryImages = [],
  documents = []
}) {
  if (type === "texte") {
    if (!text.trim()) {
      throw new Error("Renseignez le texte du bloc.");
    }

    return [
      `:::bloc ${color || "gris"} | ${title || "Information"} | ${icon || "ℹ️"}`,
      text.trim() + documentsMarkdownList(documents),
      ":::"
    ].join("\n");
  }

  if (type === "texte-image") {
    if (!text.trim()) {
      throw new Error(
        "Bloc non enregistré : aucune modification n’a été apportée."
      );
    }

    if (!mediaUrl) {
      return [
        `:::bloc ${color || "gris"} | ${title || "Information"} | ${icon || "ℹ️"}`,
        text.trim() + documentsMarkdownList(documents),
        ":::"
      ].join("\n");
    }

    return [
      `:::image-texte ${color || "gris"} | ${title || "Illustration"} | ${icon || "🖼️"}`,
      `${mediaUrl}${caption ? ` | ${caption}` : ""}`,
      "",
      text.trim() + documentsMarkdownList(documents),
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

  if (type === "documents") {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error(
        "Ajoutez au moins un document à télécharger."
      );
    }

    return [
      ":::telechargements",
      ...documents.map(document =>
        `- ${document.label} | ${document.url}`
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

async function openUnreadStudentsDialog(path, item) {
  const overlay = document.createElement("div");
  overlay.className = "fiche-non-lus-overlay";
  overlay.innerHTML = `
    <section class="fiche-non-lus-dialog" role="dialog" aria-modal="true">
      <div class="fiche-non-lus-head">
        <div>
          <h2>Élèves n’ayant pas lu la fiche</h2>
          <p>${escapeHtml(item?.title || path)}</p>
        </div>
        <button type="button" class="fiche-non-lus-close" aria-label="Fermer">×</button>
      </div>
      <p class="fiche-non-lus-summary">Chargement…</p>
      <ul class="fiche-non-lus-list"></ul>
    </section>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector(".fiche-non-lus-close").addEventListener("click", close);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });

  try {
    const params = new URLSearchParams({
      fichePath: path,
      ficheId: item?.slug || "",
      ficheTitle: item?.title || ""
    });

    const response = await fetch(
      `/admin/fiche-non-lue?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin"
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger la liste.");
    }

    const students = Array.isArray(data.students) ? data.students : [];
    overlay.querySelector(".fiche-non-lus-summary").textContent =
      `${students.length} élève${students.length > 1 ? "s" : ""} n’${students.length > 1 ? "ont" : "a"} pas encore consulté cette fiche.`;

    const list = overlay.querySelector(".fiche-non-lus-list");
    list.innerHTML = students.length
      ? students.map(student => `
          <li>
            <strong>${escapeHtml(student.username)}</strong>
            <span>${escapeHtml(student.nom || "Nom non renseigné")}</span>
          </li>
        `).join("")
      : "<li><span>Tous les élèves actifs ont consulté cette fiche.</span></li>";
  } catch (error) {
    overlay.querySelector(".fiche-non-lus-summary").textContent =
      error.message;
  }
}

function renderFicheEditButton(path, markdown, item) {
  if (!isCadreMode()) {
    return;
  }

  /*
   * Les styles doivent être chargés dès l'affichage de la fiche,
   * et non seulement après l'ouverture de l'éditeur.
   */
  injectFicheEditorStyles();

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
    ${
      currentSession.role === "admin"
        ? `
          <button
            type="button"
            class="fiche-non-lus-button"
            id="unreadCurrentFicheButton"
          >
            👁️ Élèves n’ayant pas lu
          </button>
        `
        : ""
    }

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

  toolbar
    .querySelector("#unreadCurrentFicheButton")
    ?.addEventListener(
      "click",
      () => openUnreadStudentsDialog(path, item)
    );
}


function parseEditorBlocks(markdownBody) {
  const source = String(markdownBody || "").trim();

  if (!source) {
    return [];
  }

  const lines = source.split(/\r?\n/);
  const blocks = [];
  let plainLines = [];

  function extractEmbeddedDocuments(value) {
    const sourceText = String(value || "");

    const marker = /\n?\*\*Documents à télécharger\*\*\s*\n((?:- \[[^\]]+\]\([^)]+\)\s*\n?)*)\s*$/i;
    const match = sourceText.match(marker);

    if (!match) {
      return {
        text: sourceText.trim(),
        documents: []
      };
    }

    const documents = match[1]
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const documentMatch = line.match(
          /^- \[([^\]]+)\]\(([^)]+)\)$/
        );

        return documentMatch
          ? {
              label: documentMatch[1].trim(),
              url: documentMatch[2].trim()
            }
          : null;
      })
      .filter(Boolean);

    return {
      text: sourceText.slice(0, match.index).trim(),
      documents
    };
  }

  function flushPlain() {
    const text = plainLines.join("\n").trim();

    if (text) {
      blocks.push({
        type: "contenu",
        title: "Contenu",
        color: "gris",
        icon: "📄",
        text
      });
    }

    plainLines = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const opening = line.match(
      /^\s*:::(bloc|image-texte|galerie|video-lien|image|telechargements)\b(?:\s+(.*))?\s*$/
    );

    if (!opening) {
      plainLines.push(line);
      continue;
    }

    flushPlain();

    const kind = opening[1];
    const header = (opening[2] || "").trim();
    const contentLines = [];

    index += 1;

    while (
      index < lines.length &&
      !/^\s*:::\s*$/.test(lines[index])
    ) {
      contentLines.push(lines[index]);
      index += 1;
    }

    const content = contentLines.join("\n").trim();

    if (kind === "bloc") {
      const [color, title, icon] =
        header.split("|").map(part => part.trim());

      const extracted =
        extractEmbeddedDocuments(content);

      blocks.push({
        type: "texte",
        color: color || "gris",
        title: title || "Information",
        icon: icon || "ℹ️",
        text: extracted.text,
        documents: extracted.documents
      });

      continue;
    }

    if (kind === "image-texte") {
      const [color, title, icon] =
        header.split("|").map(part => part.trim());

      const contentParts = content.split(/\r?\n/);
      const mediaLine =
        contentParts.shift()?.trim() || "";

      const [mediaUrl, caption] =
        mediaLine.split("|").map(part => part.trim());

      const extracted =
        extractEmbeddedDocuments(
          contentParts.join("\n").trim()
        );

      blocks.push({
        type: "texte-image",
        color: color || "gris",
        title: title || "Illustration",
        icon: icon || "🖼️",
        text: extracted.text,
        mediaUrl: mediaUrl || "",
        caption: caption || "",
        documents: extracted.documents
      });

      continue;
    }

    if (kind === "galerie") {
      const galleryImages =
        content
          .split(/\r?\n/)
          .map(lineValue => lineValue.trim())
          .filter(Boolean)
          .map(lineValue => {
            const [path, caption] =
              lineValue.split("|").map(part => part.trim());

            return {
              path,
              caption: caption || ""
            };
          });

      blocks.push({
        type: "galerie",
        title: header || "Galerie",
        galleryImages
      });

      continue;
    }

    if (kind === "video-lien") {
      const firstLine =
        content
          .split(/\r?\n/)
          .map(lineValue => lineValue.trim())
          .find(Boolean) || "";

      const [mediaUrl, caption] =
        firstLine.split("|").map(part => part.trim());

      blocks.push({
        type: "video",
        title: header || "Vidéo",
        mediaUrl: mediaUrl || "",
        caption: caption || ""
      });

      continue;
    }

    if (kind === "telechargements") {
      const documents =
        content
          .split(/\r?\n/)
          .map(lineValue => lineValue.trim())
          .filter(lineValue => lineValue.startsWith("-"))
          .map(lineValue => {
            const [label, url] =
              lineValue
                .replace(/^-\s*/, "")
                .split("|")
                .map(part => part.trim());

            return {
              label: label || "Document",
              url: url || ""
            };
          })
          .filter(document => document.url);

      blocks.push({
        type: "documents",
        title: "Documents à télécharger",
        documents
      });

      continue;
    }

    if (kind === "image") {
      const firstLine =
        content
          .split(/\r?\n/)
          .map(lineValue => lineValue.trim())
          .find(Boolean) || "";

      const [mediaUrl, caption] =
        firstLine.split("|").map(part => part.trim());

      blocks.push({
        type: "texte-image",
        color: "gris",
        title: header || "Illustration",
        icon: "🖼️",
        text: caption || "",
        mediaUrl: mediaUrl || "",
        caption: caption || ""
      });
    }
  }

  flushPlain();
  return blocks;
}

function serializeEditorBlock(block) {
  if (block.type === "contenu") {
    return String(block.text || "").trim();
  }

  return editorBlockMarkdown({
    type: block.type,
    color: block.color,
    title: block.title,
    icon: block.icon,
    text: block.text || "",
    mediaUrl: block.mediaUrl || "",
    caption: block.caption || "",
    galleryImages: block.galleryImages || [],
    documents: block.documents || []
  });
}

function serializeEditorBlocks(blocks) {
  return blocks
    .map(serializeEditorBlock)
    .filter(Boolean)
    .join("\n\n");
}

function renderSingleEditorBlock(block) {
  const markdown = serializeEditorBlock(block);

  if (!markdown) {
    return "";
  }

  return renderCustomBlocks(markdown);
}


function isHeicImageFile(file) {
  const type =
    String(file?.type || "").toLowerCase();

  const name =
    String(file?.name || "").toLowerCase();

  return (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function isConvertibleImageFile(file) {
  const type =
    String(file?.type || "").toLowerCase();

  const name =
    String(file?.name || "").toLowerCase();

  return (
    [
      "image/jpeg",
      "image/png",
      "image/webp"
    ].includes(type) ||
    /\.(jpe?g|png|webp)$/i.test(name)
  );
}

function loadImageFileForConversion(file) {
  return new Promise((resolve, reject) => {
    const objectUrl =
      URL.createObjectURL(file);

    const image =
      new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      reject(
        new Error(
          "Cette image ne peut pas être lue par le navigateur."
        )
      );
    };

    image.src = objectUrl;
  });
}

async function convertPhotoToWebp(file) {
  if (isHeicImageFile(file)) {
    throw new Error(
      "Les photos HEIC/HEIF ne sont pas encore prises en charge. " +
      "Veuillez les enregistrer ou les partager au format JPEG ou PNG, puis recommencer."
    );
  }

  if (!isConvertibleImageFile(file)) {
    throw new Error(
      "Format non pris en charge. Utilisez une image JPEG, PNG ou WebP."
    );
  }

  const image =
    await loadImageFileForConversion(file);

  const maximumWidth = 2000;
  const maximumHeight = 2000;

  const reductionRatio =
    Math.min(
      1,
      maximumWidth / image.naturalWidth,
      maximumHeight / image.naturalHeight
    );

  const width =
    Math.max(
      1,
      Math.round(
        image.naturalWidth *
        reductionRatio
      )
    );

  const height =
    Math.max(
      1,
      Math.round(
        image.naturalHeight *
        reductionRatio
      )
    );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "La conversion de l’image est impossible sur cet appareil."
    );
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  const blob =
    await new Promise((resolve, reject) => {
      canvas.toBlob(
        result => {
          if (
            result &&
            result.type === "image/webp"
          ) {
            resolve(result);
          } else {
            reject(
              new Error(
                "Ce navigateur ne permet pas la conversion automatique en WebP."
              )
            );
          }
        },
        "image/webp",
        0.84
      );
    });

  const originalName =
    String(file.name || "photo")
      .replace(/\.[^.]+$/, "");

  return new File(
    [blob],
    `${originalName}.webp`,
    {
      type: "image/webp",
      lastModified: Date.now()
    }
  );
}

function openFicheEditor() {
  injectFicheEditorStyles();

  const meta =
    getEditorMeta(currentEditableFiche.markdown);

  let blocks =
    parseEditorBlocks(
      getEditorBody(currentEditableFiche.markdown)
    );

  let editingIndex = null;
  let galleryImages = [];
  let blockDocuments = [];

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

      ${isVisitorMode() ? `
        <div class="fiche-editor-visitor-banner">
          Mode visiteur — démonstration uniquement. Vous pouvez parcourir
          l’éditeur et modifier temporairement son contenu, mais aucune
          photo ni aucune fiche ne peut être publiée.
        </div>
      ` : ""}

      <section class="fiche-editor-panel fiche-editor-header-panel">
        <h3>En-tête de la fiche</h3>

        <div class="fiche-editor-grid">
          <div class="fiche-editor-field">
            <label for="editorFicheTitle">
              Titre de la fiche
            </label>
            <input
              id="editorFicheTitle"
              type="text"
              value="${escapeHtml(
                meta.title ||
                currentEditableFiche.item?.title ||
                ""
              )}"
            >
          </div>

          <div class="fiche-editor-field">
            <label for="editorFicheQuote">
              Citation ou sous-titre
            </label>
            <textarea
              id="editorFicheQuote"
              rows="3"
              placeholder="Saisissez une citation ou un sous-titre sur une ou plusieurs lignes…"
            >${escapeHtml(meta.quote || "")}</textarea>
          </div>

          <div class="fiche-editor-field">
            <label for="editorFicheIcon">
              Chemin de l’icône
            </label>
            <input
              id="editorFicheIcon"
              type="text"
              value="${escapeHtml(meta.icon || "")}"
              placeholder="assets/icons/icone.svg"
            >
          </div>

          <div class="fiche-editor-field">
            <label>
              Photo de couverture
            </label>

            <div class="fiche-editor-cover-box">
              <div
                id="editorCoverPreview"
                class="fiche-editor-cover-preview"
              >
                ${meta.cover
                  ? `
                    <img
                      src="${escapeHtml(meta.cover)}"
                      alt="Aperçu de la photo de couverture"
                    >
                  `
                  : `
                    <div class="fiche-editor-cover-empty">
                      Aucune photo de couverture
                    </div>
                  `}
              </div>

              <div class="fiche-editor-cover-path">
                <label for="editorFicheCover">
                  Ou utiliser une image déjà présente dans le dépôt
                </label>

                <input
                  id="editorFicheCover"
                  type="text"
                  value="${escapeHtml(meta.cover || "")}"
                  placeholder="assets/photos/nom-de-la-photo.webp"
                  autocomplete="off"
                  spellcheck="false"
                  ${isVisitorMode() ? "disabled" : ""}
                >

                <p class="fiche-editor-cover-help">
                  Indiquez le chemin relatif depuis la racine du site,
                  par exemple :
                  <code>assets/photos/nom-de-la-photo.webp</code>
                </p>
              </div>

              <input
                id="editorCoverFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                hidden
              >

              <div class="fiche-editor-cover-actions">
                <button
                  type="button"
                  id="chooseEditorCoverButton"
                  class="fiche-editor-button secondary"
                  ${isVisitorMode() ? "disabled" : ""}
                >
                  ${meta.cover
                    ? "Remplacer la photo de couverture"
                    : "Joindre une photo de couverture"}
                </button>

                <button
                  type="button"
                  id="applyEditorCoverPathButton"
                  class="fiche-editor-button secondary"
                  ${isVisitorMode() ? "disabled" : ""}
                >
                  Utiliser ce chemin
                </button>

                <button
                  type="button"
                  id="removeEditorCoverButton"
                  class="fiche-editor-button secondary fiche-editor-cover-remove"
                  ${meta.cover && !isVisitorMode() ? "" : "disabled"}
                >
                  Retirer la couverture
                </button>
              </div>

              <div
                id="editorCoverUploadStatus"
                class="fiche-editor-upload-status"
              ></div>
            </div>
          </div>
        </div>
      </section>

      <section class="fiche-editor-panel">
        <h3>Aperçu de la fiche</h3>

        <div
          id="ficheEditorPreview"
          class="fiche-editor-preview"
        ></div>

        <div class="fiche-editor-add-zone">
          <button
            type="button"
            id="newEditorBlockButton"
            class="fiche-editor-button"
          >
            Ajouter un bloc
          </button>
        </div>
      </section>

      <section
        id="ficheEditorBlockForm"
        class="fiche-editor-panel fiche-editor-block-form"
        hidden
      >
        <div class="fiche-editor-form-title">
          <h3
            id="ficheEditorBlockFormTitle"
            class="fiche-editor-section-title block"
          >
            Ajouter un bloc
          </h3>

          <button
            type="button"
            id="closeEditorBlockFormButton"
            class="fiche-editor-mini-button"
          >
            Fermer
          </button>
        </div>

        <div class="fiche-editor-grid">
          <div>
            <div class="fiche-editor-field">
              <label for="editorBlockType">
                Type de bloc
              </label>
              <select id="editorBlockType">
                <option value="texte-image">
                  Bloc texte, image et documents
                </option>
                <option value="galerie">
                  Galerie d’images
                </option>
                <option value="video">
                  Vidéo en ligne
                </option>
                <option value="documents">
                  Documents à télécharger
                </option>
              </select>
            </div>

            <div
              id="editorBlockColorField"
              class="fiche-editor-field"
            >
              <label for="editorBlockColor">
                Couleur
              </label>
              <select id="editorBlockColor">
                <option value="bleu">
                  🔵 Bleu — Information, directives, organisation…
                </option>
                <option value="vert">
                  🟢 Vert — Ce qu’il faut faire, bonne pratique…
                </option>
                <option value="rouge">
                  🔴 Rouge — Interdit, danger, attention…
                </option>
                <option value="orange">
                  🟠 Orange — Vigilance, risques, point sensible…
                </option>
                <option value="jaune">
                  🟡 Jaune — À retenir, conseil, astuce…
                </option>
                <option value="gris">
                  ⚪ Gris — Définition, précision, contexte…
                </option>
              </select>

              <div
                id="editorBlockColorHelp"
                class="fiche-editor-color-help"
              ></div>
            </div>

            <div class="fiche-editor-field">
              <label for="editorBlockTitle">
                Titre du bloc
              </label>
              <input
                id="editorBlockTitle"
                type="text"
              >
            </div>

            <fieldset
              id="editorBlockIconField"
              class="fiche-editor-field"
            >
              <legend class="fiche-editor-legend">
                Icône
              </legend>

              <div
                id="editorBlockIconGrid"
                class="fiche-editor-radio-grid"
              ></div>
            </fieldset>

            <div
              id="editorBlockTextField"
              class="fiche-editor-field"
            >
              <label for="editorBlockText">
                Texte
              </label>

              <div
                class="fiche-editor-format-toolbar"
                role="toolbar"
                aria-label="Mise en forme du texte"
              >
                <button
                  type="button"
                  class="fiche-editor-format-button"
                  data-editor-format="bold"
                  title="Mettre la sélection en gras"
                  aria-label="Gras"
                >
                  <strong>B</strong>
                </button>

                <button
                  type="button"
                  class="fiche-editor-format-button"
                  data-editor-format="italic"
                  title="Mettre la sélection en italique"
                  aria-label="Italique"
                >
                  <em>I</em>
                </button>

                <button
                  type="button"
                  class="fiche-editor-format-button"
                  data-editor-format="underline"
                  title="Souligner la sélection"
                  aria-label="Souligné"
                >
                  <u>U</u>
                </button>
              </div>

              <textarea
                id="editorBlockText"
                placeholder="Saisissez le contenu du bloc…"
              ></textarea>
            </div>
          </div>

          <div>
            <div
              id="editorImageUploadBox"
              class="fiche-editor-upload-box"
              hidden
            >
              <div class="fiche-editor-upload-title photo">
                Insérer une photo
              </div>

              <div class="fiche-editor-field">
                <label for="editorImageFile">
                  Choisir le fichier
                </label>
                <input
                  id="editorImageFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
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

            <div
              id="editorMediaCaptionField"
              class="fiche-editor-field"
            >
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
                id="uploadEditorImageButton"
                class="fiche-editor-button secondary"
                ${isVisitorMode() ? "disabled" : ""}
              >
                ${isVisitorMode()
                  ? "Envoi indisponible en mode visiteur"
                  : "Envoyer la photo"}
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

            <div
              id="editorDocumentsBox"
              class="fiche-editor-upload-box"
            >
              <div class="fiche-editor-upload-title document">
                Document à télécharger
              </div>

              <div class="fiche-editor-field">
                <label for="editorDocumentLabel">
                  Nom du document
                </label>
                <input
                  id="editorDocumentLabel"
                  type="text"
                  placeholder="Ex. Règlement intérieur"
                >
              </div>

              <div class="fiche-editor-field">
                <label for="editorDocumentFile">
                  Choisir le fichier
                </label>
                <input
                  id="editorDocumentFile"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ods,.odt,.ppt,.pptx,.csv,.txt,.zip"
                >
              </div>

              <div
                id="editorDocumentSelectedFile"
                class="fiche-editor-upload-status"
              ></div>

              <button
                type="button"
                id="uploadEditorDocumentButton"
                class="fiche-editor-button secondary"
                ${isVisitorMode() ? "disabled" : ""}
              >
                ${isVisitorMode()
                  ? "Envoi indisponible en mode visiteur"
                  : "Envoyer le document"}
              </button>

              <div
                id="editorDocumentUploadStatus"
                class="fiche-editor-upload-status"
              ></div>

              <div
                id="editorDocumentsList"
                class="fiche-editor-upload-status success"
              ></div>
            </div>
          </div>
        </div>

        <div class="fiche-editor-actions">
          <button
            type="button"
            id="validateEditorBlockButton"
            class="fiche-editor-button"
          >
            Enregistrer le bloc
          </button>

          <button
            type="button"
            id="cancelEditorBlockButton"
            class="fiche-editor-button secondary"
          >
            Annuler
          </button>
        </div>
      </section>

      <div
        id="ficheEditorMessage"
        hidden
      ></div>

      <section class="fiche-editor-notification-box">
        <label class="fiche-editor-notification-toggle">
          <input
            type="checkbox"
            id="editorNotifyUsers"
            ${
          currentEditableFiche.path === "content/news.md" ||
          currentEditableFiche.path.startsWith("content/faq-")
            ? "checked"
            : ""
        }
            ${isVisitorMode() ? "disabled" : ""}
          >
          Envoyer une notification lors de la publication
        </label>

        <div id="editorNotificationOptions" class="fiche-editor-notification-options">
          <div class="fiche-editor-field">
            <label for="editorNotificationAudience">Destinataires</label>
            <select id="editorNotificationAudience">
              <option value="all">Tous les utilisateurs</option>
              <option value="eleves">Élèves uniquement</option>
              <option value="cadres">Cadres uniquement</option>
            </select>
          </div>

          <div class="fiche-editor-field">
            <label for="editorNotificationTitle">Titre de la notification</label>
            <input
              id="editorNotificationTitle"
              type="text"
              maxlength="100"
              value="CI6 Connect — ${escapeHtml(meta.title || currentEditableFiche.item?.title || "Nouvelle information")}"
            >
          </div>

          <div class="fiche-editor-field wide">
            <label for="editorNotificationBody">Message</label>
            <textarea
              id="editorNotificationBody"
              maxlength="240"
              rows="2"
              placeholder="Une nouvelle information est disponible."
            >La fiche « ${escapeHtml(meta.title || currentEditableFiche.item?.title || "Nouvelle information")} » a été mise à jour.</textarea>
          </div>

          <label class="fiche-editor-notification-toggle wide">
            <input type="checkbox" id="editorNotificationUrgent">
            Notification importante (reste affichée plus longtemps)
          </label>
        </div>
      </section>

      <div class="fiche-editor-actions">
        <button
          type="button"
          id="saveFicheButton"
          class="fiche-editor-button"
          ${isVisitorMode() ? "disabled" : ""}
        >
          ${isVisitorMode()
            ? "Publication indisponible en mode visiteur"
            : "Valider et publier la fiche"}
        </button>
      </div>
    </section>
  `;

  document.body.appendChild(overlay);

  const preview =
    overlay.querySelector("#ficheEditorPreview");

  const blockForm =
    overlay.querySelector("#ficheEditorBlockForm");

  const blockFormTitle =
    overlay.querySelector("#ficheEditorBlockFormTitle");

  const blockType =
    overlay.querySelector("#editorBlockType");

  const blockColor =
    overlay.querySelector("#editorBlockColor");

  const blockColorHelp =
    overlay.querySelector("#editorBlockColorHelp");

  const blockIconGrid =
    overlay.querySelector("#editorBlockIconGrid");

  const blockTitle =
    overlay.querySelector("#editorBlockTitle");

  const blockText =
    overlay.querySelector("#editorBlockText");

  const formatButtons =
    overlay.querySelectorAll(
      "[data-editor-format]"
    );

  function applyTextFormatting(textarea, format) {
    if (!textarea) {
      return;
    }

    const wrappers = {
      bold: ["**", "**"],
      italic: ["*", "*"],
      underline: ["<u>", "</u>"]
    };

    const wrapper = wrappers[format];

    if (!wrapper) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const selectedText =
      textarea.value.slice(start, end);
    const placeholder =
      selectedText || "texte";
    const replacement =
      wrapper[0] + placeholder + wrapper[1];

    textarea.setRangeText(
      replacement,
      start,
      end,
      "end"
    );

    const selectionStart =
      start + wrapper[0].length;
    const selectionEnd =
      selectionStart + placeholder.length;

    textarea.focus();
    textarea.setSelectionRange(
      selectionStart,
      selectionEnd
    );

    textarea.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  }

  formatButtons.forEach(button => {
    button.addEventListener("click", () => {
      applyTextFormatting(
        blockText,
        button.dataset.editorFormat
      );
    });
  });

  const blockColorField =
    overlay.querySelector("#editorBlockColorField");

  const blockIconField =
    overlay.querySelector("#editorBlockIconField");

  const blockTextField =
    overlay.querySelector("#editorBlockTextField");

  const imageUploadBox =
    overlay.querySelector("#editorImageUploadBox");

  const onlineMediaBox =
    overlay.querySelector("#editorOnlineMediaBox");

  const mediaCaptionField =
    overlay.querySelector("#editorMediaCaptionField");

  const mediaUrl =
    overlay.querySelector("#editorMediaUrl");

  const mediaCaption =
    overlay.querySelector("#editorMediaCaption");

  const documentsBox =
    overlay.querySelector("#editorDocumentsBox");

  const documentLabel =
    overlay.querySelector("#editorDocumentLabel");

  const documentFileInput =
    overlay.querySelector("#editorDocumentFile");

  const documentSelectedFile =
    overlay.querySelector("#editorDocumentSelectedFile");

  const uploadDocumentButton =
    overlay.querySelector("#uploadEditorDocumentButton");

  const documentUploadStatus =
    overlay.querySelector("#editorDocumentUploadStatus");

  const documentsList =
    overlay.querySelector("#editorDocumentsList");

  const coverPathInput =
    overlay.querySelector("#editorFicheCover");

  const coverFileInput =
    overlay.querySelector("#editorCoverFile");

  const chooseCoverButton =
    overlay.querySelector("#chooseEditorCoverButton");

  const applyCoverPathButton =
    overlay.querySelector("#applyEditorCoverPathButton");

  const removeCoverButton =
    overlay.querySelector("#removeEditorCoverButton");

  const coverPreview =
    overlay.querySelector("#editorCoverPreview");

  const coverUploadStatus =
    overlay.querySelector("#editorCoverUploadStatus");

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

  const uploadImageButton =
    overlay.querySelector("#uploadEditorImageButton");

  const message =
    overlay.querySelector("#ficheEditorMessage");


  const notifyUsersInput =
    overlay.querySelector("#editorNotifyUsers");

  const notificationOptions =
    overlay.querySelector("#editorNotificationOptions");

  function refreshNotificationOptions() {
    const enabled = Boolean(notifyUsersInput?.checked);
    notificationOptions.hidden = !enabled;
    notificationOptions
      .querySelectorAll("input, select, textarea")
      .forEach(field => {
        field.disabled = !enabled || isVisitorMode();
      });
  }

  notifyUsersInput?.addEventListener(
    "change",
    refreshNotificationOptions
  );

  refreshNotificationOptions();

  function buildCompleteMarkdown() {
    const body =
      serializeEditorBlocks(blocks);

    return (
      buildFrontMatter({
        title:
          overlay
            .querySelector("#editorFicheTitle")
            .value
            .trim(),
        quote:
          overlay
            .querySelector("#editorFicheQuote")
            .value
            .trim(),
        icon:
          overlay
            .querySelector("#editorFicheIcon")
            .value
            .trim(),
        cover:
          overlay
            .querySelector("#editorFicheCover")
            .value
            .trim()
      }) +
      body +
      (body ? "\n" : "")
    );
  }

  function renderPreview() {
    if (blocks.length === 0) {
      preview.innerHTML = `
        <div class="fiche-editor-empty">
          Cette fiche ne contient encore aucun bloc.
        </div>
      `;

      return;
    }

    preview.innerHTML =
      blocks
        .map((block, index) => `
          <section
            class="fiche-editor-block-shell"
            data-editor-index="${index}"
          >
            <div class="fiche-editor-block-toolbar">
              <button
                type="button"
                class="fiche-editor-mini-button"
                data-action="edit"
                data-index="${index}"
              >
                Modifier
              </button>

              <button
                type="button"
                class="fiche-editor-mini-button"
                data-action="up"
                data-index="${index}"
                ${index === 0 ? "disabled" : ""}
              >
                Monter
              </button>

              <button
                type="button"
                class="fiche-editor-mini-button"
                data-action="down"
                data-index="${index}"
                ${index === blocks.length - 1 ? "disabled" : ""}
              >
                Descendre
              </button>

              <button
                type="button"
                class="fiche-editor-mini-button danger"
                data-action="delete"
                data-index="${index}"
              >
                Supprimer
              </button>
            </div>

            <div class="fiche-editor-block-content">
              ${renderSingleEditorBlock(block)}
            </div>
          </section>
        `)
        .join("");

    preview
      .querySelectorAll("[data-action]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const index =
              Number(button.dataset.index);

            const action =
              button.dataset.action;

            if (action === "edit") {
              openBlockForm(index);
              return;
            }

            if (action === "up" && index > 0) {
              [
                blocks[index - 1],
                blocks[index]
              ] = [
                blocks[index],
                blocks[index - 1]
              ];

              renderPreview();
              return;
            }

            if (
              action === "down" &&
              index < blocks.length - 1
            ) {
              [
                blocks[index + 1],
                blocks[index]
              ] = [
                blocks[index],
                blocks[index + 1]
              ];

              renderPreview();
              return;
            }

            if (action === "delete") {
              const confirmed =
                window.confirm(
                  "Êtes-vous sûr de vouloir supprimer ce bloc ?"
                );

              if (!confirmed) {
                return;
              }

              blocks.splice(index, 1);
              closeBlockForm();
              renderPreview();
            }
          }
        );
      });
  }

  const colorGuidance = {
    bleu: {
      description:
        "Information, directives, organisation…",
      titlePlaceholder:
        "Ex. Information, directives, organisation",
      defaultTitle:
        "Information",
      icons:
        ["📘", "📋", "📖", "📝", "📌", "ℹ️", "📢", "🔎"]
    },
    vert: {
      description:
        "Ce qu’il faut faire, bonne pratique…",
      titlePlaceholder:
        "Ex. Ce qu’il faut faire, bonne pratique",
      defaultTitle:
        "Ce qu’il faut faire",
      icons:
        ["✅", "✔️", "👍", "🤝", "🛡️", "🎯", "🌱"]
    },
    rouge: {
      description:
        "Interdit, danger, attention…",
      titlePlaceholder:
        "Ex. Interdit, danger, attention",
      defaultTitle:
        "Interdit",
      icons:
        ["⛔", "❌", "🚫", "🛑", "☠️", "🚷"]
    },
    orange: {
      description:
        "Vigilance, risques, point sensible…",
      titlePlaceholder:
        "Ex. Vigilance, risques, point sensible",
      defaultTitle:
        "Vigilance",
      icons:
        ["⚠️", "🚨", "🔥", "🔔", "👁️", "🔍", "⏳"]
    },
    jaune: {
      description:
        "À retenir, conseil, astuce…",
      titlePlaceholder:
        "Ex. À retenir, conseil, astuce",
      defaultTitle:
        "À retenir",
      icons:
        ["💡", "🧠", "⭐", "💬", "🗝️", "📍"]
    },
    gris: {
      description:
        "Définition, précision, contexte…",
      titlePlaceholder:
        "Ex. Définition, précision, contexte",
      defaultTitle:
        "Précision",
      icons:
        ["ℹ️", "📖", "📑", "📄", "🗂️"]
    }
  };

  function selectedIcon() {
    return (
      overlay.querySelector(
        'input[name="editorBlockIcon"]:checked'
      )?.value ||
      colorGuidance[blockColor.value]?.icons?.[0] ||
      "ℹ️"
    );
  }

  function renderIconsForColor(
    requestedIcon = ""
  ) {
    const guidance =
      colorGuidance[blockColor.value] ||
      colorGuidance.gris;

    const selected =
      guidance.icons.includes(requestedIcon)
        ? requestedIcon
        : guidance.icons[0];

    blockIconGrid.innerHTML =
      guidance.icons
        .map(icon => `
          <label title="${icon}">
            <input
              type="radio"
              name="editorBlockIcon"
              value="${icon}"
              ${icon === selected ? "checked" : ""}
            >
            <span>${icon}</span>
          </label>
        `)
        .join("");
  }

  function updateColorGuidance(
    requestedIcon = ""
  ) {
    const guidance =
      colorGuidance[blockColor.value] ||
      colorGuidance.gris;

    blockColorHelp.innerHTML = `
      <strong>Usage conseillé :</strong>
      ${escapeHtml(guidance.description)}
    `;

    blockTitle.placeholder =
      guidance.titlePlaceholder;

    renderIconsForColor(requestedIcon);
  }

  function setSelectedIcon(icon) {
    renderIconsForColor(icon);
  }

  function refreshDocumentsList() {
    if (blockDocuments.length === 0) {
      documentsList.textContent =
        "Aucun document ajouté.";
      return;
    }

    documentsList.innerHTML =
      blockDocuments
        .map((document, index) => `
          <div>
            <strong>${escapeHtml(document.label)}</strong><br>
            <span>${escapeHtml(document.url)}</span>
            <button
              type="button"
              class="fiche-editor-mini-button danger"
              data-document-remove="${index}"
            >
              Retirer
            </button>
          </div>
        `)
        .join("<br>");

    documentsList
      .querySelectorAll("[data-document-remove]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            blockDocuments.splice(
              Number(button.dataset.documentRemove),
              1
            );

            refreshDocumentsList();
          }
        );
      });
  }

  function refreshGalleryList() {
    if (galleryImages.length === 0) {
      galleryList.textContent = "";
      return;
    }

    galleryList.innerHTML = `
      <strong>
        ${galleryImages.length}
        photo${galleryImages.length > 1 ? "s" : ""}
      </strong>
      <br>
      ${galleryImages
        .map((image, index) => `
          ${index + 1}. ${escapeHtml(image.path)}
          <button
            type="button"
            class="fiche-editor-mini-button danger"
            data-gallery-remove="${index}"
          >
            Retirer
          </button>
        `)
        .join("<br>")}
    `;

    galleryList
      .querySelectorAll("[data-gallery-remove]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            galleryImages.splice(
              Number(button.dataset.galleryRemove),
              1
            );

            refreshGalleryList();
          }
        );
      });
  }

  function updateBlockFields() {
    const type =
      blockType.value;

    const needsImage =
      type === "texte-image" ||
      type === "galerie";

    imageUploadBox.hidden =
      !needsImage;

    onlineMediaBox.hidden =
      type !== "video";

    if (type === "video") {
      onlineMediaBox.appendChild(
        mediaCaptionField
      );
    } else if (needsImage) {
      imageUploadBox.insertBefore(
        mediaCaptionField,
        uploadImageButton
      );
    }

    blockColorField.hidden =
      type === "galerie" ||
      type === "video" ||
      type === "documents";

    blockIconField.hidden =
      type === "galerie" ||
      type === "video" ||
      type === "documents";

    blockTextField.hidden =
      type === "galerie" ||
      type === "video" ||
      type === "documents";

    mediaCaptionField.hidden =
      type === "documents";

    blockTitle.parentElement.hidden =
      type === "documents";

    documentsBox.hidden =
      ![
        "texte-image",
        "documents"
      ].includes(type);

    uploadImageButton.textContent =
      type === "galerie"
        ? "Ajouter cette photo à la galerie"
        : "Envoyer la photo";
  }

  function resetBlockForm() {
    blockType.value = "texte-image";
    blockColor.value = "bleu";
    blockTitle.value = "";
    blockText.value = "";
    mediaUrl.value = "";
    mediaCaption.value = "";
    imageFileInput.value = "";
    imageNameInput.value = "";
    selectedFileName.textContent = "";
    uploadStatus.textContent = "";
    galleryImages = [];
    blockDocuments = [];
    documentLabel.value = "";
    documentFileInput.value = "";
    documentSelectedFile.textContent = "";
    documentUploadStatus.textContent = "";
    updateColorGuidance();
    refreshGalleryList();
    refreshDocumentsList();
    updateBlockFields();
  }

  function openBlockForm(index = null) {
    editingIndex =
      Number.isInteger(index)
        ? index
        : null;

    resetBlockForm();

    if (editingIndex !== null) {
      const block =
        blocks[editingIndex];

      blockFormTitle.textContent =
        "Modifier le bloc";

      blockType.value =
        [
          "texte",
          "texte-image",
          "contenu"
        ].includes(block.type)
          ? "texte-image"
          : block.type || "texte-image";

      blockColor.value =
        block.color || "bleu";

      blockTitle.value =
        block.title || "";

      blockText.value =
        block.text || "";

      mediaUrl.value =
        block.mediaUrl || "";

      mediaCaption.value =
        block.caption || "";

      galleryImages =
        Array.isArray(block.galleryImages)
          ? block.galleryImages.map(image => ({
              ...image
            }))
          : [];

      blockDocuments =
        Array.isArray(block.documents)
          ? block.documents.map(document => ({
              ...document
            }))
          : [];

      updateColorGuidance(
        block.icon || ""
      );

      refreshGalleryList();
      refreshDocumentsList();
    } else {
      blockFormTitle.textContent =
        "Ajouter un bloc";
    }

    updateBlockFields();
    blockForm.hidden = false;

    blockForm.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeBlockForm() {
    blockForm.hidden = true;
    editingIndex = null;
    resetBlockForm();
  }

  function buildBlockFromForm() {
    const type =
      blockType.value;

    const block = {
      type,
      color:
        blockColor.value,
      title:
        blockTitle.value.trim() ||
        colorGuidance[blockColor.value]?.defaultTitle ||
        "Information",
      icon:
        selectedIcon(),
      text:
        blockText.value.trim(),
      mediaUrl:
        mediaUrl.value.trim(),
      caption:
        mediaCaption.value.trim(),
      galleryImages:
        galleryImages.map(image => ({
          ...image
        })),
      documents:
        blockDocuments.map(document => ({
          ...document
        }))
    };

    serializeEditorBlock(block);
    return block;
  }

  function closeEditor() {
    overlay.remove();
  }

  overlay
    .querySelector(".fiche-editor-close")
    .addEventListener(
      "click",
      closeEditor
    );

  overlay
    .querySelector(".fiche-editor-cancel")
    ?.addEventListener(
      "click",
      closeEditor
    );

  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay) {
        closeEditor();
      }
    }
  );

  overlay
    .querySelector("#newEditorBlockButton")
    .addEventListener(
      "click",
      () => openBlockForm(null)
    );

  overlay
    .querySelector("#closeEditorBlockFormButton")
    .addEventListener(
      "click",
      closeBlockForm
    );

  overlay
    .querySelector("#cancelEditorBlockButton")
    .addEventListener(
      "click",
      closeBlockForm
    );

  blockType.addEventListener(
    "change",
    updateBlockFields
  );

  documentFileInput.addEventListener(
    "change",
    () => {
      const file = documentFileInput.files?.[0];

      documentSelectedFile.textContent =
        file
          ? `Fichier sélectionné : ${file.name}`
          : "";

      if (file && !documentLabel.value.trim()) {
        documentLabel.value =
          file.name.replace(/\.[^.]+$/, "");
      }

      documentUploadStatus.textContent = "";
      documentUploadStatus.className =
        "fiche-editor-upload-status";
    }
  );

  uploadDocumentButton.addEventListener(
    "click",
    async () => {
      const file =
        documentFileInput.files?.[0];

      const label =
        documentLabel.value.trim();

      if (!file) {
        window.alert("Choisissez d’abord un document.");
        return;
      }

      if (!label) {
        window.alert("Renseignez le nom du document.");
        return;
      }

      uploadDocumentButton.disabled = true;
      documentUploadStatus.className =
        "fiche-editor-upload-status";
      documentUploadStatus.textContent =
        "Envoi du document en cours…";

      try {
        const formData = new FormData();
        formData.append("document", file);
        formData.append("documentName", label);
        formData.append(
          "fichePath",
          currentEditableFiche?.path || ""
        );
        formData.append(
          "ficheTitle",
          ficheTitle.value.trim() ||
          currentEditableFiche?.item?.title ||
          ""
        );

        const response = await fetch(
          "/cadres/document-upload",
          {
            method: "POST",
            body: formData,
            credentials: "same-origin"
          }
        );

        const responseText =
          await response.text();

        let data = {};

        try {
          data = responseText
            ? JSON.parse(responseText)
            : {};
        } catch {
          throw new Error(
            response.ok
              ? "Le serveur a renvoyé une réponse invalide."
              : `Erreur serveur ${response.status}. Vérifiez le déploiement de functions/cadres/document-upload.js.`
          );
        }

        if (!response.ok) {
          throw new Error(
            data.error ||
            `L’envoi du document a échoué (erreur ${response.status}).`
          );
        }

        blockDocuments.push({
          label,
          url: data.path
        });

        documentFileInput.value = "";
        documentSelectedFile.textContent = "";
        documentLabel.value = "";
        documentUploadStatus.className =
          "fiche-editor-upload-status success";
        documentUploadStatus.textContent =
          "Document envoyé et ajouté au bloc.";

        refreshDocumentsList();
      } catch (error) {
        documentUploadStatus.className =
          "fiche-editor-upload-status error";
        documentUploadStatus.textContent =
          error.message;
      } finally {
        uploadDocumentButton.disabled =
          isVisitorMode();
      }
    }
  );

  blockColor.addEventListener(
    "change",
    () => {
      updateColorGuidance();

      if (!blockTitle.value.trim()) {
        blockTitle.value = "";
      }
    }
  );


  function renderCoverPreview(path = "") {
    coverPreview.innerHTML = "";

    if (!path) {
      const empty =
        document.createElement("div");

      empty.className =
        "fiche-editor-cover-empty";

      empty.textContent =
        "Aucune photo de couverture";

      coverPreview.appendChild(empty);
      chooseCoverButton.textContent =
        "Joindre une photo de couverture";
      removeCoverButton.disabled = true;
      return;
    }

    const image =
      document.createElement("img");

    image.src = path;
    image.alt =
      "Aperçu de la photo de couverture";

    image.addEventListener(
      "error",
      () => {
        coverPreview.innerHTML = `
          <div class="fiche-editor-cover-empty">
            La photo de couverture ne peut pas être affichée.
          </div>
        `;
      },
      { once: true }
    );

    coverPreview.appendChild(image);
    chooseCoverButton.textContent =
      "Remplacer la photo de couverture";

    removeCoverButton.disabled =
      isVisitorMode();
  }

  function normalizeRepositoryImagePath(value = "") {
    return String(value)
      .trim()
      .replace(/^\.\//, "")
      .replace(/^\/+/, "");
  }

  function applyCoverPath() {
    if (isVisitorMode()) {
      return;
    }

    const path =
      normalizeRepositoryImagePath(
        coverPathInput.value
      );

    coverPathInput.value = path;

    if (!path) {
      coverUploadStatus.textContent =
        "Renseignez le chemin d’une image déjà présente dans le dépôt.";
      coverUploadStatus.className =
        "fiche-editor-upload-status error";
      renderCoverPreview("");
      return;
    }

    renderCoverPreview(path);

    coverUploadStatus.textContent =
      "Chemin de couverture pris en compte. " +
      "Publiez maintenant la fiche pour l’appliquer.";

    coverUploadStatus.className =
      "fiche-editor-upload-status success";
  }

  applyCoverPathButton.addEventListener(
    "click",
    applyCoverPath
  );

  coverPathInput.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyCoverPath();
      }
    }
  );

  coverPathInput.addEventListener(
    "input",
    () => {
      coverUploadStatus.textContent = "";
      coverUploadStatus.className =
        "fiche-editor-upload-status";
    }
  );

  chooseCoverButton.addEventListener(
    "click",
    () => {
      if (!isVisitorMode()) {
        coverFileInput.click();
      }
    }
  );

  removeCoverButton.addEventListener(
    "click",
    () => {
      if (isVisitorMode()) {
        return;
      }

      coverPathInput.value = "";
      coverFileInput.value = "";
      coverUploadStatus.textContent =
        "La couverture sera retirée lors de la publication de la fiche.";
      coverUploadStatus.className =
        "fiche-editor-upload-status success";

      renderCoverPreview("");
    }
  );

  coverFileInput.addEventListener(
    "change",
    async () => {
      const file =
        coverFileInput.files?.[0];

      if (!file) {
        return;
      }

      if (isHeicImageFile(file)) {
        coverUploadStatus.textContent =
          "Format HEIC/HEIF détecté. " +
          "Veuillez convertir ou partager la photo en JPEG ou PNG avant de l’ajouter.";
        coverUploadStatus.className =
          "fiche-editor-upload-status error";
        coverFileInput.value = "";
        return;
      }

      if (!isConvertibleImageFile(file)) {
        coverUploadStatus.textContent =
          "Format non pris en charge. " +
          "Choisissez une image JPEG, PNG ou WebP.";
        coverUploadStatus.className =
          "fiche-editor-upload-status error";
        coverFileInput.value = "";
        return;
      }

      chooseCoverButton.disabled = true;
      applyCoverPathButton.disabled = true;
      removeCoverButton.disabled = true;
      coverUploadStatus.textContent =
        "Conversion de la couverture en WebP…";
      coverUploadStatus.className =
        "fiche-editor-upload-status";

      const temporaryUrl =
        URL.createObjectURL(file);

      renderCoverPreview(temporaryUrl);

      try {
        const webpFile =
          await convertPhotoToWebp(file);

        coverUploadStatus.textContent =
          "Envoi de la couverture dans GitHub…";

        const formData =
          new FormData();

        formData.append("photo", webpFile);
        formData.append("photoName", "couverture");
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

        const response =
          await fetch(
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
            "L’envoi de la couverture a échoué."
          );
        }

        if (!data.path) {
          throw new Error(
            "Le serveur n’a pas renvoyé le chemin de la couverture."
          );
        }

        coverPathInput.value = data.path;
        renderCoverPreview(data.path);

        coverUploadStatus.textContent =
          "Photo de couverture enregistrée. " +
          "Publiez maintenant la fiche pour l’appliquer.";

        coverUploadStatus.className =
          "fiche-editor-upload-status success";

      } catch (error) {
        renderCoverPreview(
          coverPathInput.value
        );

        coverUploadStatus.textContent =
          error.message;

        coverUploadStatus.className =
          "fiche-editor-upload-status error";

      } finally {
        URL.revokeObjectURL(temporaryUrl);
        coverFileInput.value = "";
        chooseCoverButton.disabled =
          isVisitorMode();

        applyCoverPathButton.disabled =
          isVisitorMode();

        removeCoverButton.disabled =
          isVisitorMode() ||
          !coverPathInput.value;
      }
    }
  );

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

      if (!file) {
        return;
      }

      if (isHeicImageFile(file)) {
        uploadStatus.textContent =
          "Format HEIC/HEIF détecté. " +
          "Veuillez convertir ou partager la photo en JPEG ou PNG avant de l’ajouter.";

        uploadStatus.className =
          "fiche-editor-upload-status error";

        imageFileInput.value = "";
        selectedFileName.textContent = "";
        return;
      }

      if (!isConvertibleImageFile(file)) {
        uploadStatus.textContent =
          "Format non pris en charge. " +
          "Choisissez une image JPEG, PNG ou WebP.";

        uploadStatus.className =
          "fiche-editor-upload-status error";

        imageFileInput.value = "";
        selectedFileName.textContent = "";
      }
    }
  );

  uploadImageButton.addEventListener(
    "click",
    async () => {
      if (isVisitorMode()) {
        uploadStatus.textContent =
          "Le mode visiteur ne permet pas d’envoyer une photo.";
        uploadStatus.className =
          "fiche-editor-upload-status error";
        return;
      }

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
        "Conversion de la photo en WebP…";

      uploadStatus.className =
        "fiche-editor-upload-status";

      try {
        const webpFile =
          await convertPhotoToWebp(file);

        uploadStatus.textContent =
          "Envoi de la photo WebP dans GitHub…";

        const formData =
          new FormData();

        formData.append("photo", webpFile);
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

        const response =
          await fetch(
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

        if (
          blockType.value === "galerie"
        ) {
          galleryImages.push({
            path: data.path,
            caption:
              mediaCaption.value.trim()
          });

          refreshGalleryList();

          uploadStatus.textContent =
            `Photo ajoutée : ${data.fileName}`;

          imageFileInput.value = "";
          imageNameInput.value = "";
          selectedFileName.textContent = "";
          mediaCaption.value = "";

          const addAnother =
            window.confirm(
              "La photo a été ajoutée à la galerie.\n\n" +
              "Voulez-vous ajouter une autre photo ?"
            );

          if (addAnother) {
            imageFileInput.click();
          }
        } else {
          mediaUrl.value =
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

  overlay
    .querySelector("#validateEditorBlockButton")
    .addEventListener(
      "click",
      () => {
        try {
          const block =
            buildBlockFromForm();

          const wasAdding =
            editingIndex === null;

          if (wasAdding) {
            blocks.push(block);
          } else {
            blocks[editingIndex] = block;
          }

          closeBlockForm();
          renderPreview();

          message.hidden = false;
          message.className =
            "fiche-editor-message";

          message.textContent =
            wasAdding
              ? "Bloc ajouté."
              : "Bloc modifié.";

        } catch (error) {
          message.hidden = false;
          message.className =
            "fiche-editor-message error";

          message.textContent =
            error.message;
        }
      }
    );

  overlay
    .querySelector("#saveFicheButton")
    .addEventListener(
      "click",
      async event => {
        if (isVisitorMode()) {
          message.hidden = false;
          message.className =
            "fiche-editor-message error";
          message.textContent =
            "La publication est désactivée en mode visiteur.";
          return;
        }

        const confirmed =
          window.confirm(
            "Êtes-vous sûr de vouloir publier cette nouvelle version de la fiche ?\n\n" +
            "La modification sera enregistrée directement dans GitHub."
          );

        if (!confirmed) {
          return;
        }

        const button =
          event.currentTarget;

        button.disabled = true;

        message.hidden = false;
        message.className =
          "fiche-editor-message";

        message.textContent =
          "Publication dans GitHub en cours…";

        try {
          const markdown =
            buildCompleteMarkdown();

          const response =
            await fetch(
              "/cadres/fiche-save",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  "Accept":
                    "application/json"
                },
                credentials:
                  "same-origin",
                body: JSON.stringify({
                  path:
                    currentEditableFiche.path,
                  markdown,
                  title:
                    overlay
                      .querySelector("#editorFicheTitle")
                      .value
                      .trim(),
                  notify:
                    Boolean(
                      overlay
                        .querySelector("#editorNotifyUsers")
                        ?.checked
                    ),
                  notificationAudience:
                    overlay
                      .querySelector("#editorNotificationAudience")
                      ?.value || "all",
                  notificationTitle:
                    overlay
                      .querySelector("#editorNotificationTitle")
                      ?.value
                      .trim() || "",
                  notificationBody:
                    overlay
                      .querySelector("#editorNotificationBody")
                      ?.value
                      .trim() || "",
                  notificationUrgent:
                    Boolean(
                      overlay
                        .querySelector("#editorNotificationUrgent")
                        ?.checked
                    ),
                  notificationUrl:
                    currentEditableFiche.item?.slug
                      ? `/#${currentEditableFiche.item.slug}`
                      : "/"
                })
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.error ||
              "La publication a échoué."
            );
          }

          currentEditableFiche.markdown =
            markdown;

          overlay.remove();

          await closeActiveConsultation();

          currentParent = null;
          searchInput && (searchInput.value = "");
          setHomeView();
          renderCards();

          history.pushState(
            {
              type: "home"
            },
            "",
            window.location.pathname
          );

        } catch (error) {
          message.className =
            "fiche-editor-message error";

          message.textContent =
            error.message;

        } finally {
          button.disabled = false;
        }
      }
    );

  [
    "#editorFicheTitle",
    "#editorFicheQuote",
    "#editorFicheIcon",
    "#editorFicheCover"
  ].forEach(selector => {
    overlay
      .querySelector(selector)
      .addEventListener(
        "input",
        renderPreview
      );
  });

  renderPreview();
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


function createVisitorDemoMarkdown(item) {
  return [
    "---",
    `title: "${String(item?.title || "Fiche de démonstration").replace(/"/g, '\\"')}"`,
    'quote: "Aperçu de l’organisation d’une fiche CI6 Connect"',
    "---",
    "",
    ":::bloc bleu | Contenu de démonstration | ℹ️",
    "Le contenu réel de cette fiche est masqué en mode visiteur.",
    ":::",
    "",
    ":::bloc gris | Fonctionnement de l’éditeur | ✏️",
    "Vous pouvez tester l’ajout, la modification, le déplacement ou la suppression de blocs. Aucune modification ne pourra être publiée.",
    ":::"
  ].join("\n");
}

function renderVisitorDemoFiche(
  path,
  item,
  addHistory = true
) {
  const markdown =
    createVisitorDemoMarkdown(item);

  detailContent.innerHTML =
    markdownToHtml(markdown);

  setDetailView();

  renderFicheEditButton(
    path,
    markdown,
    item
  );

  if (addHistory) {
    const hash =
      item?.slug ||
      path
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
}

async function openContent(
  path,
  addHistory = true
) {
  currentParent = null;

  const visitorItem =
    findItemByContent(path);

  /*
   * En mode visiteur, le vrai fichier Markdown
   * et ses photos ne sont jamais chargés.
   * Une fiche fictive sert uniquement de démonstration.
   */
  if (isVisitorMode()) {
    await closeActiveConsultation();

    renderVisitorDemoFiche(
      path,
      visitorItem,
      addHistory
    );

    return;
  }

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

    restoreGalleryReturnPosition();

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


function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, character => character.charCodeAt(0));
}

async function getPushRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Ce navigateur ne prend pas en charge les notifications du site.");
  }
  await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function savePushSubscription(subscription) {
  const response = await fetch("/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer les notifications.");
}

async function removePushSubscription(subscription) {
  const response = await fetch("/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Impossible de désactiver les notifications.");
  await subscription.unsubscribe();
}

async function configurePushButton(container, sessionData) {
  if (
    sessionData.type !== "user" ||
    !["eleve", "cadre", "admin"].includes(sessionData.role)
  ) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "connected-user-notifications";
  button.textContent = "Activer les notifications";
  container.appendChild(button);

  if (!("Notification" in window) || !("PushManager" in window)) {
    button.textContent = "Notifications indisponibles";
    button.disabled = true;
    return;
  }

  let registration;
  let subscription;

  async function refresh() {
    try {
      registration = await getPushRegistration();
      subscription = await registration.pushManager.getSubscription();
      button.textContent = subscription
        ? "Notifications activées"
        : Notification.permission === "denied"
          ? "Notifications bloquées"
          : "Activer les notifications";
      button.classList.toggle("active", Boolean(subscription));
      button.disabled = false;
    } catch (error) {
      button.textContent = "Notifications indisponibles";
      button.disabled = true;
      console.error(error);
    }
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      registration ||= await getPushRegistration();
      subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const confirmed = window.confirm("Désactiver les notifications CI6 Connect sur cet appareil ?");
        if (confirmed) await removePushSubscription(subscription);
        await refresh();
        return;
      }

      if (Notification.permission === "denied") {
        throw new Error("Les notifications sont bloquées dans les réglages du navigateur. Autorisez-les pour ce site.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("L’autorisation de notification n’a pas été accordée.");
      }

      const keyResponse = await fetch("/push/public-key", {
        headers: { "Accept": "application/json" },
        credentials: "same-origin",
        cache: "no-store"
      });
      const keyData = await keyResponse.json();
      if (!keyResponse.ok) throw new Error(keyData.error || "Clé de notification indisponible.");

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
      await savePushSubscription(subscription);
      await refresh();
      window.alert("Les notifications CI6 Connect sont activées sur cet appareil.");
    } catch (error) {
      window.alert(error.message);
      await refresh();
    }
  });

  await refresh();
}

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
            : data.role === "visiteur"
              ? "Vous êtes connecté en mode visiteur (démonstration)."
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
    if (
      data.role === "admin" ||
      data.role === "visiteur"
    ) {
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
    
    await configurePushButton(
      connectedActions,
      data
    );

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
      main.appendChild(connectedBox);
    } else {
      document.body.appendChild(connectedBox);
    }

  } catch (error) {
    console.error(
      "Impossible d’afficher le statut de connexion.",
      error
    );
  }
}


let ci6GalleryLightbox = null;
let ci6GalleryItems = [];
let ci6GalleryIndex = 0;
let ci6GalleryTouchStartX = null;
let ci6GalleryTouchStartY = null;

function ensureGalleryLightbox() {
  if (ci6GalleryLightbox) return ci6GalleryLightbox;

  const overlay = document.createElement("div");
  overlay.className = "ci6-gallery-lightbox";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Visionneuse de la galerie");

  overlay.innerHTML = `
    <div class="ci6-gallery-lightbox-counter"></div>

    <button type="button" class="ci6-gallery-lightbox-close" aria-label="Fermer la photo">×</button>

    <button type="button" class="ci6-gallery-lightbox-nav ci6-gallery-lightbox-prev" aria-label="Photo précédente">‹</button>

    <div class="ci6-gallery-lightbox-image-wrap">
      <img class="ci6-gallery-lightbox-image" alt="">
    </div>

    <button type="button" class="ci6-gallery-lightbox-nav ci6-gallery-lightbox-next" aria-label="Photo suivante">›</button>

    <p class="ci6-gallery-lightbox-caption"></p>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".ci6-gallery-lightbox-close")
    .addEventListener("click", closeGalleryLightbox);

  overlay.querySelector(".ci6-gallery-lightbox-prev")
    .addEventListener("click", () => showGalleryImage(ci6GalleryIndex - 1));

  overlay.querySelector(".ci6-gallery-lightbox-next")
    .addEventListener("click", () => showGalleryImage(ci6GalleryIndex + 1));

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeGalleryLightbox();
  });

  overlay.addEventListener("touchstart", event => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    ci6GalleryTouchStartX = touch.clientX;
    ci6GalleryTouchStartY = touch.clientY;
  }, { passive: true });

  overlay.addEventListener("touchend", event => {
    const touch = event.changedTouches?.[0];

    if (
      !touch ||
      ci6GalleryTouchStartX === null ||
      ci6GalleryTouchStartY === null
    ) return;

    const deltaX = touch.clientX - ci6GalleryTouchStartX;
    const deltaY = touch.clientY - ci6GalleryTouchStartY;

    ci6GalleryTouchStartX = null;
    ci6GalleryTouchStartY = null;

    if (
      Math.abs(deltaX) < 45 ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) return;

    showGalleryImage(
      deltaX < 0
        ? ci6GalleryIndex + 1
        : ci6GalleryIndex - 1
    );
  }, { passive: true });

  ci6GalleryLightbox = overlay;
  return overlay;
}

function showGalleryImage(index) {
  if (!ci6GalleryItems.length) return;

  ci6GalleryIndex =
    (index % ci6GalleryItems.length + ci6GalleryItems.length)
    % ci6GalleryItems.length;

  const current = ci6GalleryItems[ci6GalleryIndex];
  const overlay = ensureGalleryLightbox();

  const image = overlay.querySelector(".ci6-gallery-lightbox-image");
  const caption = overlay.querySelector(".ci6-gallery-lightbox-caption");
  const counter = overlay.querySelector(".ci6-gallery-lightbox-counter");

  image.src = current.href;
  image.alt = current.caption || "Photo de la galerie";
  caption.textContent = current.caption || "";
  caption.hidden = !current.caption;
  counter.textContent =
    `${ci6GalleryIndex + 1} / ${ci6GalleryItems.length}`;
}

function openGalleryLightbox(link) {
  const gallery = link.closest(".media-gallery");
  if (!gallery) return;

  const links = Array.from(
    gallery.querySelectorAll("a.media-gallery-item")
  );

  ci6GalleryItems = links.map(item => {
    const image = item.querySelector("img");
    const caption =
      item.querySelector("span")?.textContent?.trim() ||
      image?.alt?.trim() ||
      "";

    return {
      href: item.href,
      caption
    };
  });

  ci6GalleryIndex = Math.max(0, links.indexOf(link));

  const overlay = ensureGalleryLightbox();
  overlay.hidden = false;
  document.body.style.overflow = "hidden";

  showGalleryImage(ci6GalleryIndex);

  overlay.querySelector(".ci6-gallery-lightbox-close").focus();
}

function closeGalleryLightbox() {
  if (!ci6GalleryLightbox) return;

  ci6GalleryLightbox.hidden = true;
  document.body.style.overflow = "";
}

document.addEventListener("keydown", event => {
  if (!ci6GalleryLightbox || ci6GalleryLightbox.hidden) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    showGalleryImage(ci6GalleryIndex - 1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    showGalleryImage(ci6GalleryIndex + 1);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeGalleryLightbox();
  }
});

document.addEventListener("click", event => {
  const link = event.target.closest("a.media-gallery-item");
  if (!link) return;

  event.preventDefault();
  event.stopPropagation();
  openGalleryLightbox(link);
});


document.addEventListener(
  "click",
  event => {
    const link =
      event.target.closest(
        "a.media-gallery-item"
      );

    if (!link) return;

    saveGalleryReturnPosition(link);
  },
  true
);

async function initializeApplication() {
  await displayConnectedUser();
  await loadHomepageTileSettings();
  injectHiddenHomepageTileStyles();
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
