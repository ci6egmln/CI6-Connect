const grid = document.getElementById("cardsGrid"), searchInput = document.getElementById("searchInput"), homeView = document.getElementById("homeView"), detailView = document.getElementById("detailView"), detailContent = document.getElementById("detailContent"), backBtn = document.getElementById("backBtn");

let currentParent = null;

function normalizeText(value) {
    return (value || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getRubriques() {
    return Array.isArray(window.CI6_RUBRIQUES) ? window.CI6_RUBRIQUES : [];
}

function flattenItems(items = getRubriques()) {
    return items.flatMap(item => [ item, ...Array.isArray(item.children) ? flattenItems(item.children) : [] ]);
}

function findItemBySlug(slug) {
    return flattenItems().find(item => item.slug === slug);
}

function findItemByContent(path) {
    return flattenItems().find(item => item.content === path);
}

function setHomeView() {
    currentParent = null, detailView.hidden = !0, homeView.hidden = !1, window.scrollTo({
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
    const query = normalizeText(filter), rubriques = getRubriques().filter(item => normalizeText(`${item.id || ""} ${item.title || ""} ${item.description || ""}`).includes(query));
    grid.innerHTML = rubriques.map(item => `\n    <button class="tile" data-slug="${item.slug}" aria-label="${item.title}">\n      <img class="tile-bg" src="${item.card}" alt="" loading="lazy">\n      <span class="tile-text">\n        <strong>${item.title}</strong>\n        <em>${item.description || ""}</em>\n      </span>\n    </button>\n  `).join(""), 
    document.querySelectorAll("#cardsGrid .tile").forEach(tile => {
        tile.addEventListener("click", () => {
            const item = findItemBySlug(tile.dataset.slug);
            item && (Array.isArray(item.children) && item.children.length > 0 ? renderChildren(item, !0) : item.content && openContent(item.content, !0));
        });
    });
}

function renderChildren(parent, addHistory = !0) {
    currentParent = parent, detailContent.innerHTML = `\n    <section class="subpage-header">\n      <p class="subpage-kicker">Sous-rubriques</p>\n      <h1>${parent.title}</h1>\n      <p>${parent.description || ""}</p>\n    </section>\n\n    <section class="children-grid" aria-label="Sous-rubriques ${parent.title}">\n      ${(parent.children || []).map(child => `\n        <button class="child-nav-tile" data-slug="${child.slug}" aria-label="${child.title}">\n          <img class="child-nav-img" src="${child.card}" alt="" loading="lazy">\n          <span class="child-nav-title">${child.title}</span>\n        </button>\n      `).join("")}\n    </section>\n  `, 
    setDetailView(), document.querySelectorAll(".child-nav-tile").forEach(tile => {
        tile.addEventListener("click", () => {
            const child = findItemBySlug(tile.dataset.slug);
            child && (Array.isArray(child.children) && child.children.length > 0 ? renderChildren(child, !0) : child.content && openContent(child.content, !0));
        });
    }), addHistory && history.pushState({
        type: "children",
        slug: parent.slug
    }, "", "#" + parent.slug);
}

function escapeHtml(value) {
    return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatInline(text) {
    return escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
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
    return markdown = (markdown = markdown.replace(/:::telechargements\s*\n([\s\S]*?)\n:::/gim, (_, content) => renderDownloadBlock(content))).replace(/:::bloc\s+([^\n]+)\n([\s\S]*?)\n:::/gim, (_, title, content) => `\n        <section class="fiche-card fiche-card-bloc">\n          <div class="fiche-card-head">\n            <span class="fiche-card-icon">◆</span>\n            <strong>${formatInline(title.trim())}</strong>\n          </div>\n\n          <div class="fiche-card-body">\n            ${basicMarkdownToHtml(content.trim())}\n          </div>\n        </section>\n      `), 
    Object.keys(blockTypes).forEach(type => {
        const config = blockTypes[type], regex = new RegExp(`:::${type}\\s*\\n([\\s\\S]*?)\\n:::`, "gim");
        markdown = markdown.replace(regex, (_, content) => `\n        <section class="fiche-card ${config.className}">\n          <div class="fiche-card-head">\n            <span class="fiche-card-icon">${config.icon}</span>\n            <strong>${config.title}</strong>\n          </div>\n\n          <div class="fiche-card-body">\n            ${basicMarkdownToHtml(content.trim())}\n          </div>\n        </section>\n      `);
    }), markdown;
}

function markdownToHtml(markdown) {
    const parsed = parseFrontMatter(markdown), content = basicMarkdownToHtml(renderCustomBlocks(parsed.body)), title = parsed.meta.title || "", icon = parsed.meta.icon || "", quote = parsed.meta.quote || "";
    return `\n    <article class="fiche">\n      ${title ? `\n        <section class="fiche-hero">\n          ${icon ? `<img class="fiche-hero-img" src="${icon}" alt="">` : ""}\n          <h1>${formatInline(title)}</h1>\n          ${quote ? `<p class="fiche-quote">« ${formatInline(quote)} »</p>` : ""}\n        </section>\n      ` : ""}\n\n      <section class="fiche-content">\n        ${content}\n      </section>\n    </article>\n  `;
}

async function openContent(path, addHistory = !0) {
    currentParent = null;
    try {
        const response = await fetch(path, {
            cache: "no-store"
        });
        if (!response.ok) throw new Error("Fiche introuvable : " + path);
        const markdown = await response.text();
        detailContent.innerHTML = markdownToHtml(markdown);
    } catch (error) {
        console.error(error), detailContent.innerHTML = '\n      <article class="fiche">\n        <section class="fiche-content">\n          <h1>Fiche indisponible</h1>\n          <p>Le contenu de cette fiche n’a pas pu être chargé.</p>\n        </section>\n      </article>\n    ';
    }
    if (setDetailView(), addHistory) {
        const item = findItemByContent(path), hash = item ? item.slug : path.replace("content/", "").replace(".md", "");
        history.pushState({
            type: "content",
            path: path
        }, "", "#" + hash);
    }
}

function openFromHash() {
    const hash = location.hash.replace("#", "");
    if (!hash) return void setHomeView();
    const item = findItemBySlug(hash);
    if (!item) return detailContent.innerHTML = '\n      <article class="fiche">\n        <section class="fiche-content">\n          <h1>Fiche introuvable</h1>\n          <p>Cette rubrique n’existe pas ou son lien est incorrect.</p>\n        </section>\n      </article>\n    ', 
    void setDetailView();
    Array.isArray(item.children) && item.children.length > 0 ? renderChildren(item, !1) : item.content && openContent(item.content, !1);
}

backBtn.addEventListener("click", () => {
    const item = findItemBySlug(location.hash.replace("#", ""));
    if (!item) return history.pushState({
        type: "home"
    }, "", location.pathname), void setHomeView();
    const parent = flattenItems().find(possibleParent => Array.isArray(possibleParent.children) && possibleParent.children.some(child => child.slug === item.slug));
    if (parent) return renderChildren(parent, !1), void history.pushState({
        type: "children",
        slug: parent.slug
    }, "", "#" + parent.slug);
    history.pushState({
        type: "home"
    }, "", location.pathname), setHomeView();
}), searchInput && searchInput.addEventListener("input", event => renderCards(event.target.value)), 
window.addEventListener("popstate", openFromHash), renderCards(), openFromHash();