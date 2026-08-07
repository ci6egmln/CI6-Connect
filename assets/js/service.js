const $ = id => document.getElementById(id);
const DAY_MS = 86400000;
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const state = {
  data: null,
  start: null,
  end: null,
  mode: "default",
  months: 0,
  offsetWeeks: 0,
  selected: new Set(),
  lastSelected: "",
  entries: new Map(),
  activeRecoveryPerson: null,
  studentExport: null
};

function utcDate(value = new Date()) {
  if (typeof value === "string") return new Date(`${value}T12:00:00Z`);
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12));
}
function iso(date) { return date.toISOString().slice(0, 10); }
function addDays(date, amount) { return new Date(date.getTime() + amount * DAY_MS); }
function monday(date) { const day = date.getUTCDay() || 7; return addDays(date, 1 - day); }
function endOfWeek(date) { return addDays(monday(date), 6); }
function addMonths(date, amount) { const copy = new Date(date); copy.setUTCMonth(copy.getUTCMonth() + amount); return copy; }
function daysBetween(start, end) { const result = []; for (let date = start; date <= end; date = addDays(date, 1)) result.push(date); return result; }
function frDate(value, options = { day: "2-digit", month: "short", year: "numeric" }) { return utcDate(value).toLocaleDateString("fr-FR", { ...options, timeZone: "UTC" }); }
function number(value) { return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 }); }
const holidayCache = new Map();
function easterSunday(year) {
  const a = year % 19; const b = Math.floor(year / 100); const c = year % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}
function holidaysFor(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const fixed = {
    "01-01": "Jour de l’An", "05-01": "Fête du Travail", "05-08": "Victoire de 1945",
    "07-14": "Fête nationale", "08-15": "Assomption", "11-01": "Toussaint",
    "11-11": "Armistice", "12-25": "Noël"
  };
  const days = new Map(Object.entries(fixed).map(([date, label]) => [`${year}-${date}`, label]));
  const easter = easterSunday(year);
  days.set(iso(addDays(easter, 1)), "Lundi de Pâques");
  days.set(iso(addDays(easter, 39)), "Ascension");
  days.set(iso(addDays(easter, 50)), "Lundi de Pentecôte");
  holidayCache.set(year, days);
  return days;
}
function holidayFor(date) { return holidaysFor(date.getUTCFullYear()).get(iso(date)) || ""; }
const ZONE_A_VACATIONS = [
  { start: "2026-07-04", end: "2026-09-01", label: "Vacances d’été" },
  { start: "2026-10-17", end: "2026-11-02", label: "Vacances de la Toussaint" },
  { start: "2026-12-19", end: "2027-01-04", label: "Vacances de Noël" },
  { start: "2027-02-13", end: "2027-03-01", label: "Vacances d’hiver — zone A" },
  { start: "2027-04-10", end: "2027-04-26", label: "Vacances de printemps — zone A" },
  { start: "2027-05-07", end: "2027-05-08", label: "Journée sans classe" },
  { start: "2027-07-03", end: "2027-09-02", label: "Vacances d’été" },
  { start: "2027-10-23", end: "2027-11-08", label: "Vacances de la Toussaint" },
  { start: "2027-12-18", end: "2028-01-03", label: "Vacances de Noël" },
  { start: "2028-02-19", end: "2028-03-06", label: "Vacances d’hiver — zone A" },
  { start: "2028-04-22", end: "2028-05-09", label: "Vacances de printemps — zone A" },
  { start: "2028-05-26", end: "2028-05-28", label: "Journées sans classe" },
  { start: "2028-07-04", end: "2028-09-04", label: "Vacances d’été" }
];
function schoolVacationFor(date) {
  const value = iso(date);
  return ZONE_A_VACATIONS.find(period => value >= period.start && value < period.end)?.label || "";
}
function entryKey(targetType, targetKey, date, slot) { return `${targetType}|${targetKey}|${date}|${slot}`; }
function parseKey(key) { const [target_type, target_key, service_date, slot] = key.split("|"); return { target_type, target_key, service_date, slot }; }
function typeFor(code) { return state.data?.serviceTypes.find(type => type.code === code); }
function contrastText(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(color || ""));
  if (!match) return "#ffffff";
  const value = Number.parseInt(match[1], 16);
  const red = value >> 16; const green = value >> 8 & 255; const blue = value & 255;
  return (red * 299 + green * 587 + blue * 114) / 1000 >= 155 ? "#111111" : "#ffffff";
}
function message(target, text, type = "info") { const element = $(target); element.className = `message ${type}`; element.textContent = text; }

function calculatePeriod() {
  const currentMonday = monday(utcDate());
  if (state.mode === "future") {
    const start = currentMonday;
    return { start, end: endOfWeek(addMonths(start, state.months)) };
  }
  const anchor = addDays(currentMonday, state.offsetWeeks * 7);
  return { start: addDays(anchor, -7), end: addDays(anchor, 41) };
}

async function api(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json", ...(options.headers || {}) }, ...options });
  let data = {};
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || "Le serveur n’a pas pu traiter la demande.");
  return data;
}

async function loadPlanning({ preserveScroll = false } = {}) {
  const viewport = $("planningViewport");
  const scroll = preserveScroll ? { left: viewport.scrollLeft, top: viewport.scrollTop } : null;
  const period = calculatePeriod();
  state.start = period.start;
  state.end = period.end;
  state.selected.clear();
  state.lastSelected = "";
  updateSelectionBar();
  viewport.innerHTML = '<div class="loading">Chargement du planning…</div>';
  try {
    const data = await api(`/cadres/service?action=bootstrap&start=${iso(period.start)}&end=${iso(period.end)}`);
    state.data = data;
    state.entries = new Map(data.entries.map(entry => [entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry]));
    const managePeopleButton = $("managePeople");
    if (managePeopleButton) {
      if (data.permission.isAdmin) managePeopleButton.hidden = false;
      else managePeopleButton.remove();
    }
    renderPalette();
    renderPlanning();
    renderSop();
    renderRecovery();
    updatePeriodLabel();
    if (scroll) { viewport.scrollLeft = scroll.left; viewport.scrollTop = scroll.top; }
    message("planningMessage", "", "info");
  } catch (error) {
    viewport.innerHTML = `<div class="loading">${esc(error.message)}</div>`;
    message("planningMessage", error.message, "error");
  }
}

function updatePeriodLabel() {
  $("periodLabel").textContent = `${frDate(state.start)} — ${frDate(state.end)}`;
  document.querySelectorAll(".range-button").forEach(button => button.classList.toggle("active", state.mode === "future" && Number(button.dataset.months) === state.months));
}

function renderPalette() {
  $("servicePalette").innerHTML = state.data.serviceTypes.map(type => `
    <button class="palette-button" type="button" data-code="${type.code}" style="--palette-color:${type.color};--palette-text:${type.textColor}" title="${esc(type.label)}">
      ${esc(type.code)}
    </button>`).join("");
  $("servicePalette").querySelectorAll("[data-code]").forEach(button => button.onclick = () => applyService(
    button.dataset.code,
    { merge: state.selected.size > 1 }
  ));
}

function planningRows() {
  const pelotons = state.data.pelotons.map(key => ({ targetType: "peloton", targetKey: key, name: key, peloton: true }));
  const people = state.data.people.map(person => ({ targetType: "person", targetKey: String(person.id), name: person.display_name, grade: person.grade, pelotonName: person.peloton, person }));
  return [...pelotons, { vacation: true, name: "Vacances scolaires — zone A" }, ...people];
}

function planningSurname(person) {
  let name = String(person.display_name || "").trim();
  const grade = String(person.grade || "").trim();
  if (grade && name.toLocaleUpperCase("fr-FR").startsWith(`${grade.toLocaleUpperCase("fr-FR")} `)) name = name.slice(grade.length).trim();
  if (name.includes(",")) return name.split(",")[0].trim();
  const tokens = name.split(/\s+/).filter(Boolean);
  const uppercaseTokens = tokens.filter(token => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(token) && token === token.toLocaleUpperCase("fr-FR"));
  return (uppercaseTokens.length ? uppercaseTokens.join(" ") : tokens[0]) || name;
}

function monthGroups(days) {
  const groups = [];
  for (const day of days) {
    const key = `${day.getUTCFullYear()}-${day.getUTCMonth()}`;
    const last = groups.at(-1);
    if (last?.key === key) last.count += 1;
    else groups.push({ key, count: 1, label: day.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }) });
  }
  return groups;
}

function counterFor(row) {
  if (row.vacation) return { permanence: "", recovery: "" };
  if (row.peloton) return { permanence: "—", recovery: "—" };
  const id = Number(row.targetKey);
  const permanence = state.data.permanence.find(item => Number(item.person_id) === id)?.total || 0;
  const recovery = state.data.recovery.find(item => Number(item.person_id) === id)?.balance || 0;
  return { permanence: number(permanence), recovery: number(recovery) };
}

function nameColumnWidth(rows) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return 130;
  let longest = 0;
  rows.filter(row => !row.vacation).forEach(row => {
    const surname = row.person ? planningSurname(row.person) : row.name;
    context.font = "800 12px Arial";
    let width = context.measureText(surname).width;
    if (row.grade) {
      context.font = "700 10px Arial";
      width += context.measureText(row.grade).width + 6;
    }
    longest = Math.max(longest, width);
  });
  return Math.ceil(Math.max(72, longest + 16));
}

function renderPlanning() {
  const days = daysBetween(state.start, state.end);
  const rows = planningRows();
  const today = iso(utcDate());
  const groups = monthGroups(days);
  const nameWidth = nameColumnWidth(rows);
  let html = `<div class="planning-grid" style="--slots:${days.length * 2};--name-width:${nameWidth}px">`;
  html += '<div class="grid-corner" style="grid-column:1;grid-row:1/3">Cadres</div><div class="counter-head permanence" style="grid-column:2;grid-row:1/3" title="Permanences">P</div><div class="counter-head recovery" style="grid-column:3;grid-row:1/3" title="Solde de repos récupérateurs">RR</div>';
  let monthColumn = 4;
  groups.forEach((group, index) => { html += `<div class="month-head${index % 2 ? " alt" : ""}" style="grid-column:${monthColumn}/span ${group.count * 2};grid-row:1">${esc(group.label)}</div>`; monthColumn += group.count * 2; });
  days.forEach((day, index) => {
    const date = iso(day); const holiday = holidayFor(day); const nonWorkingDay = [0, 6].includes(day.getUTCDay()) || Boolean(holiday);
    html += `<div class="day-head${nonWorkingDay ? " weekend" : ""}${date === today ? " today" : ""}" style="grid-column:${index * 2 + 4}/span 2;grid-row:2"${holiday ? ` title="${esc(holiday)}"` : ""}><strong>${day.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" })}</strong><br>${String(day.getUTCDate()).padStart(2, "0")}<div>M&nbsp;&nbsp;N</div></div>`;
  });
  const todayIndex = days.findIndex(day => iso(day) === today);
  if (todayIndex >= 0) html += `<div class="today-column-marker" style="grid-column:${todayIndex * 2 + 4}/span 2;grid-row:3/${rows.length + 3}" aria-hidden="true"></div>`;
  rows.forEach((row, rowIndex) => {
    const gridRow = rowIndex + 3;
    const identity = row.vacation
      ? esc(row.name)
      : row.person
        ? `<span class="row-identity">${row.grade ? `<span class="row-grade">${esc(row.grade)}</span>` : ""}<span>${esc(planningSurname(row.person))}</span></span>`
        : esc(row.name);
    html += `<div class="row-name${row.peloton ? " peloton" : ""}${row.vacation ? " vacation" : ""}" style="grid-column:1;grid-row:${gridRow}"><div>${identity}</div></div>`;
    const counters = counterFor(row);
    html += `<div class="row-counter permanence${row.peloton ? " peloton" : ""}${row.vacation ? " vacation" : ""}" style="grid-column:2;grid-row:${gridRow}" title="Permanences">${counters.permanence}</div>`;
    html += `<div class="row-counter recovery${row.peloton ? " peloton" : ""}${row.vacation ? " vacation" : ""}" style="grid-column:3;grid-row:${gridRow}" title="Solde RR">${counters.recovery}</div>`;
    if (row.vacation) {
      days.forEach((day, dayIndex) => {
        const vacation = schoolVacationFor(day);
        html += `<div class="vacation-day${vacation ? " active" : ""}${iso(day) === today ? " today" : ""}" style="grid-column:${dayIndex * 2 + 4}/span 2;grid-row:${gridRow}"${vacation ? ` title="${esc(vacation)}"` : ""}></div>`;
      });
      return;
    }
    const slots = days.flatMap(day => ["M", "N"].map(slot => {
      const date = iso(day);
      const key = entryKey(row.targetType, row.targetKey, date, slot);
      return { key, date, day, slot, entry: state.entries.get(key) };
    }));
    for (let slotIndex = 0; slotIndex < slots.length;) {
      const item = slots[slotIndex];
      const groupId = item.entry?.group_id || "";
      let span = 1;
      if (groupId) while (slotIndex + span < slots.length && slots[slotIndex + span].entry?.group_id === groupId) span += 1;
      const grouped = span > 1 || Boolean(groupId);
      const groupedItems = slots.slice(slotIndex, slotIndex + span);
      const entry = item.entry;
      const type = entry ? typeFor(entry.service_code) : null;
      const label = entry?.custom_label || entry?.service_code || "";
      const title = entry ? `${type?.label || entry.service_code}${entry.custom_label ? ` — ${entry.custom_label}` : ""}${entry.notes ? `\n${entry.notes}` : ""}\nModifié par ${entry.updated_by}` : `${row.name} — ${frDate(item.date)} ${item.slot === "M" ? "matin" : "nuit"}`;
      const nonWorkingDay = [0, 6].includes(item.day.getUTCDay()) || Boolean(holidayFor(item.day));
      const keys = groupedItems.map(slot => slot.key).join(",");
      const color = entry?.custom_color || type?.color || "#fff";
      const textColor = entry?.custom_color ? contrastText(entry.custom_color) : type?.textColor || "#111";
      const startsDay = item.slot === "M";
      const endsDay = groupedItems.at(-1)?.slot === "N";
      html += `<button class="slot-cell${row.peloton ? " peloton" : ""}${nonWorkingDay ? " weekend" : ""}${startsDay ? " day-start" : ""}${endsDay ? " day-end" : ""}${entry ? " has-entry" : ""}${grouped ? " merged-activity" : ""}" data-keys="${keys}" type="button" style="grid-column:${slotIndex + 4}/span ${span};grid-row:${gridRow}${entry ? `;--entry-color:${color};--entry-text:${textColor}` : ""}" title="${esc(title)}"><span class="slot-code">${esc(label)}</span></button>`;
      slotIndex += span;
    }
  });
  html += "</div>";
  $("planningViewport").innerHTML = html;
  $("planningViewport").querySelectorAll(".slot-cell").forEach(cell => cell.onclick = event => selectCells(
    cell.dataset.keys.split(","),
    { extend: event.shiftKey, additive: event.ctrlKey || event.metaKey }
  ));
}

function selectCells(keys, { extend = false, additive = false } = {}) {
  const key = keys.at(-1);
  if (extend && state.lastSelected) {
    const previous = parseKey(state.lastSelected); const current = parseKey(key);
    if (previous.target_type === current.target_type && previous.target_key === current.target_key) {
      const ordered = daysBetween(state.start, state.end).flatMap(day => ["M", "N"].map(slot => entryKey(current.target_type, current.target_key, iso(day), slot)));
      const a = ordered.indexOf(state.lastSelected); const b = ordered.indexOf(key);
      if (!additive) state.selected.clear();
      if (a >= 0 && b >= 0) for (let index = Math.min(a, b); index <= Math.max(a, b); index += 1) state.selected.add(ordered[index]);
    } else {
      if (!additive) state.selected.clear();
      keys.forEach(selectedKey => state.selected.add(selectedKey));
    }
  } else if (additive) {
    if (keys.every(selectedKey => state.selected.has(selectedKey))) keys.forEach(selectedKey => state.selected.delete(selectedKey));
    else keys.forEach(selectedKey => state.selected.add(selectedKey));
  } else {
    const onlyThisSelection = state.selected.size === keys.length && keys.every(selectedKey => state.selected.has(selectedKey));
    state.selected.clear();
    if (!onlyThisSelection) keys.forEach(selectedKey => state.selected.add(selectedKey));
  }
  state.lastSelected = key;
  refreshSelectionClasses();
  updateSelectionBar();
}

function refreshSelectionClasses() { document.querySelectorAll(".slot-cell[data-keys]").forEach(cell => cell.classList.toggle("selected", cell.dataset.keys.split(",").some(key => state.selected.has(key)))); }
function updateSelectionBar() {
  const count = state.selected.size;
  $("selectionCount").textContent = count ? `${count} case${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}` : "Aucune case sélectionnée";
  $("deleteSelection").disabled = ![...state.selected].some(key => state.entries.has(key));
}

function clearSelection() { state.selected.clear(); state.lastSelected = ""; refreshSelectionClasses(); updateSelectionBar(); }

async function applyService(code, { merge = false, customColor = "", activity = false } = {}) {
  if (!state.selected.size) return message("planningMessage", "Sélectionnez d’abord une ou plusieurs cases.", "error");
  const items = [...state.selected].map(key => ({
    ...parseKey(key),
    expected_empty: !state.entries.has(key),
    expected_updated_at: state.entries.get(key)?.updated_at || null
  }));
  message("planningMessage", "Enregistrement en cours…", "info");
  try {
    const data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-entries", items, service_code: code, custom_label: $("customLabel").value, custom_color: customColor, notes: $("entryNotes").value, merge, activity }) });
    data.entries.forEach(entry => state.entries.set(entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry));
    if (["RR", "RPC"].includes(code)) {
      const personEntries = data.entries.filter(entry => entry.target_type === "person");
      if (personEntries.length && confirm(`Déduire automatiquement ${number(personEntries.length * 0.5)} jour(s) des compteurs de repos concernés ?`)) {
        await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-from-entries", ids: personEntries.map(entry => entry.id) }) });
      }
    }
    if (activity) {
      $("entryDetails").hidden = true;
      $("customLabel").value = "";
      $("entryNotes").value = "";
    }
    message("planningMessage", `${data.entries.length} case${data.entries.length > 1 ? "s" : ""} enregistrée${data.entries.length > 1 ? "s" : ""}.`, "ok");
    renderPlanning(); clearSelection();
    await refreshCounters();
  } catch (error) { message("planningMessage", error.message, "error"); if (/modifiée par un autre cadre/i.test(error.message)) await loadPlanning({ preserveScroll: true }); }
}

async function deleteSelection() {
  const ids = [...new Set([...state.selected].map(key => state.entries.get(key)?.id).filter(Boolean))];
  if (!ids.length) return;
  if (!confirm(`Supprimer le contenu de ${ids.length} case${ids.length > 1 ? "s" : ""} ?`)) return;
  try {
    await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-entries", ids }) });
    [...state.selected].forEach(key => state.entries.delete(key));
    renderPlanning(); clearSelection(); await refreshCounters();
    message("planningMessage", "Contenu supprimé.", "ok");
  } catch (error) { message("planningMessage", error.message, "error"); }
}

async function refreshCounters() {
  const scroll = { left: $("planningViewport").scrollLeft, top: $("planningViewport").scrollTop };
  const data = await api(`/cadres/service?action=bootstrap&start=${iso(state.start)}&end=${iso(state.end)}`);
  state.data = data; state.entries = new Map(data.entries.map(entry => [entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry]));
  renderPlanning(); renderSop(); renderRecovery();
  $("planningViewport").scrollLeft = scroll.left; $("planningViewport").scrollTop = scroll.top;
}

function renderSop() {
  const eligibleIds = new Set(state.data.people.filter(person => Number(person.sop_eligible) === 1).map(person => Number(person.id)));
  const rows = state.data.sop.filter(item => eligibleIds.has(Number(item.person_id))).map(item => {
    const person = state.data.people.find(candidate => Number(candidate.id) === Number(item.person_id));
    return { ...item, person, completed: Number(item.completed || 0), planned: Number(item.planned || 0), total: Number(item.completed || 0) + Number(item.planned || 0) };
  });
  const average = rows.length ? rows.reduce((sum, row) => sum + row.total, 0) / rows.length : 0;
  const totals = rows.map(row => row.total); const gap = totals.length ? Math.max(...totals) - Math.min(...totals) : 0;
  $("sopAverage").textContent = number(average); $("sopGap").textContent = number(gap); $("sopPlanned").textContent = number(rows.reduce((sum, row) => sum + row.planned, 0));
  $("sopBody").innerHTML = rows.sort((a, b) => a.total - b.total || String(a.last_sop || "").localeCompare(String(b.last_sop || ""))).map(row => {
    const difference = row.total - average; const className = difference < -0.4 ? "fair-low" : difference > 0.4 ? "fair-high" : "";
    return `<tr><td><strong>${esc([row.person?.grade, row.person?.display_name].filter(Boolean).join(" "))}</strong></td><td>${esc(row.person?.peloton || "—")}</td><td>${number(row.completed)}</td><td>${number(row.planned)}</td><td><strong>${number(row.total)}</strong></td><td>${row.last_sop ? frDate(row.last_sop) : "Jamais"}</td><td class="${className}">${difference > 0 ? "+" : ""}${number(difference)}</td></tr>`;
  }).join("") || '<tr><td colspan="7" class="empty-state">Aucun cadre éligible aux SOP.</td></tr>';
}

function renderRecovery() {
  $("recoveryCards").innerHTML = state.data.people.map(person => {
    const totals = state.data.recovery.find(item => Number(item.person_id) === Number(person.id)) || {};
    const balance = Number(totals.balance || 0);
    return `<button class="recovery-card" type="button" data-person="${person.id}"><h3>${esc([person.grade, person.display_name].filter(Boolean).join(" "))}</h3><div class="recovery-numbers"><div><span>Crédités</span><strong>${number(totals.credited)}</strong></div><div><span>Pris</span><strong>${number(totals.taken)}</strong></div><div><span>Solde</span><strong class="${balance < 0 ? "balance-negative" : ""}">${number(balance)}</strong></div></div></button>`;
  }).join("") || '<div class="empty-state">Aucun cadre dans le planning.</div>';
  $("recoveryCards").querySelectorAll("[data-person]").forEach(button => button.onclick = () => loadRecoveryDetail(Number(button.dataset.person)));
}

async function loadRecoveryDetail(personId) {
  try {
    const data = await api(`/cadres/service?action=recovery&person_id=${personId}`);
    state.activeRecoveryPerson = personId;
    const totals = state.data.recovery.find(item => Number(item.person_id) === personId) || {};
    $("recoveryPerson").textContent = [data.person.grade, data.person.display_name].filter(Boolean).join(" ");
    $("recoveryBalance").textContent = `Solde actuel : ${number(totals.balance)} jour(s)`;
    $("recoveryBody").innerHTML = data.movements.map(movement => `<tr><td>${frDate(movement.movement_date)}</td><td>${movement.movement_type === "credit" ? "Crédit" : movement.movement_type === "debit" ? "Repos pris" : "Ajustement"}</td><td class="${Number(movement.amount) < 0 ? "fair-high" : "fair-low"}">${Number(movement.amount) > 0 ? "+" : ""}${number(movement.amount)}</td><td>${esc(movement.reason)}</td><td>${esc(movement.created_by)}</td></tr>`).join("") || '<tr><td colspan="5" class="empty-state">Aucun mouvement enregistré.</td></tr>';
    $("recoveryDetail").hidden = false; $("recoveryDetail").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { message("recoveryMessage", error.message, "error"); }
}

function populateMovementPeople(selectedIds = []) {
  const selected = new Set(selectedIds.map(Number));
  $("movementPeople").innerHTML = state.data.people.map(person => `<label class="movement-person"><input type="checkbox" value="${person.id}"${selected.has(Number(person.id)) ? " checked" : ""}><span>${esc([person.grade, person.display_name].filter(Boolean).join(" "))}</span></label>`).join("");
}

function openMovementDialog() {
  if (!state.activeRecoveryPerson) return;
  populateMovementPeople([state.activeRecoveryPerson]);
  $("movementDialog").showModal();
}

async function saveMovement(event) {
  event.preventDefault();
  const personIds = [...$("movementPeople").querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value));
  if (!personIds.length) return message("recoveryMessage", "Sélectionnez au moins un cadre.", "error");
  try {
    const data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-movement", person_ids: personIds, movement_type: $("movementType").value, amount: Number($("movementAmount").value), movement_date: $("movementDate").value, reason: $("movementReason").value }) });
    $("movementDialog").close(); $("movementReason").value = "";
    await refreshCounters();
    if (state.activeRecoveryPerson) await loadRecoveryDetail(state.activeRecoveryPerson);
    message("recoveryMessage", `Mouvement enregistré pour ${data.created} cadre${data.created > 1 ? "s" : ""}.`, "ok");
  } catch (error) { message("recoveryMessage", error.message, "error"); }
}

function personEditorRow(person = {}, rowKey = "new") {
  return `<div class="person-row" data-person-row="${person.id || rowKey}"><input data-field="grade" value="${esc(person.grade || "")}" placeholder="Grade" aria-label="Grade"><input data-field="display_name" value="${esc(person.display_name || "")}" placeholder="Nom du cadre" aria-label="Nom"><select data-field="peloton" aria-label="Peloton"><option value="">—</option>${["P1", "P2", "P3"].map(value => `<option value="${value}"${person.peloton === value ? " selected" : ""}>${value}</option>`).join("")}</select><input data-field="sort_order" type="number" min="0" max="9999" value="${Number(person.sort_order || 100)}" aria-label="Ordre"><label class="check-line"><input data-field="sop_eligible" type="checkbox"${Number(person.sop_eligible ?? 1) ? " checked" : ""}> SOP</label><label class="check-line"><input data-field="active" type="checkbox"${Number(person.active ?? 1) ? " checked" : ""}> Actif</label></div>`;
}

function renderPeopleEditor() {
  $("peopleEditor").innerHTML = (state.data.peopleAdmin || state.data.people).map(person => personEditorRow(person)).join("");
  message("peopleMessage", "", "info");
}

function addPersonEditorRow() {
  const key = `new-${Date.now()}`;
  $("peopleEditor").insertAdjacentHTML("beforeend", personEditorRow({}, key));
  const row = $("peopleEditor").querySelector(`[data-person-row="${key}"]`);
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  row.querySelector('[data-field="display_name"]').focus();
}

async function saveAllPeople() {
  const people = [...$("peopleEditor").querySelectorAll("[data-person-row]")].map(row => {
    const field = name => row.querySelector(`[data-field="${name}"]`);
    return {
      id: /^\d+$/.test(row.dataset.personRow) ? Number(row.dataset.personRow) : 0,
      grade: field("grade").value,
      display_name: field("display_name").value.trim(),
      peloton: field("peloton").value,
      sort_order: Number(field("sort_order").value),
      sop_eligible: field("sop_eligible").checked,
      active: field("active").checked
    };
  }).filter(person => person.id || person.display_name);
  if (!people.length) return message("peopleMessage", "Aucun cadre à enregistrer.", "error");
  $("saveAllPeople").disabled = true;
  message("peopleMessage", "Enregistrement de l’ensemble des cadres…", "info");
  try {
    const data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-people", people }) });
    await loadPlanning({ preserveScroll: true });
    renderPeopleEditor();
    message("peopleMessage", `${data.saved} cadre${data.saved > 1 ? "s" : ""} enregistré${data.saved > 1 ? "s" : ""}.`, "ok");
  } catch (error) { message("peopleMessage", error.message, "error"); }
  finally { $("saveAllPeople").disabled = false; }
}

function exportPlanning() {
  const people = new Map(state.data.people.map(person => [String(person.id), [person.grade, person.display_name].filter(Boolean).join(" ")]));
  const rows = [...state.entries.values()].sort((a, b) => `${a.service_date}${a.slot}`.localeCompare(`${b.service_date}${b.slot}`));
  const csv = [["date", "creneau", "type_ligne", "cadre_ou_peloton", "service", "libelle", "couleur", "groupe", "note", "modifie_par"], ...rows.map(entry => [entry.service_date, entry.slot === "M" ? "Matin" : "Nuit", entry.target_type, entry.target_type === "person" ? people.get(entry.target_key) : entry.target_key, entry.service_code, entry.custom_label, entry.custom_color, entry.group_id, entry.notes, entry.updated_by])].map(columns => columns.map(value => { const text = String(value ?? ""); return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }).join(";")).join("\r\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); link.download = `planning-service-${iso(state.start)}-${iso(state.end)}.csv`; link.click(); URL.revokeObjectURL(link.href);
}

function studentPersonName(person) {
  if (!person) return "";
  const surname = planningSurname(person);
  return [String(person.grade || "").trim(), surname].filter(Boolean).join(" ");
}

function studentServiceSettings() {
  const rawStart = $("studentServiceStart").value;
  const weeks = Number($("studentServiceWeeks").value);
  if (!rawStart || !Number.isInteger(weeks) || weeks < 1 || weeks > 8) throw new Error("Choisissez une période valide.");
  const start = monday(utcDate(rawStart));
  const end = addDays(start, weeks * 7 - 1);
  $("studentServiceStart").value = iso(start);
  return { start, end, weeks };
}

function studentServiceRows(data, start, end) {
  const people = new Map(data.people.map(person => [String(person.id), person]));
  const order = new Map(data.people.map((person, index) => [String(person.id), index]));
  const entries = data.entries.filter(entry => entry.target_type === "person" && entry.service_code === "P");
  const namesFor = (date, slot) => entries
    .filter(entry => entry.service_date === date && entry.slot === slot)
    .sort((a, b) => (order.get(a.target_key) ?? 9999) - (order.get(b.target_key) ?? 9999))
    .map(entry => studentPersonName(people.get(entry.target_key)))
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index);
  return daysBetween(start, end).map(day => {
    const date = iso(day);
    const morning = namesFor(date, "M");
    const night = namesFor(date, "N");
    const fullDay = morning.length > 0 && morning.length === night.length && morning.every((name, index) => name === night[index]);
    return { date, day, morning, night, fullDay };
  });
}

function studentServiceTable(exportData, { print = false } = {}) {
  const rows = exportData.rows.map((row, index) => {
    const weekend = [0, 6].includes(row.day.getUTCDay()) || Boolean(holidayFor(row.day));
    const classes = [index % 7 === 0 ? "week-start" : "", weekend ? "non-working" : ""].filter(Boolean).join(" ");
    const dateLabel = row.day.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
    const morning = row.morning.join(" / ") || "À désigner";
    const night = row.night.join(" / ") || "À désigner";
    return row.fullDay
      ? `<tr class="${classes}"><th scope="row">${esc(dateLabel)}</th><td class="full-day" colspan="2"><span>Journée</span>${esc(morning)}</td></tr>`
      : `<tr class="${classes}"><th scope="row">${esc(dateLabel)}</th><td class="${row.morning.length ? "" : "missing"}">${esc(morning)}</td><td class="${row.night.length ? "" : "missing"}">${esc(night)}</td></tr>`;
  }).join("");
  const title = `Service des cadres de permanence — ${frDate(exportData.start)} au ${frDate(exportData.end)}`;
  return `${print ? `<header><h1>6<sup>e</sup> compagnie d’instruction</h1><p>${esc(title)}</p></header>` : `<h3>${esc(title)}</h3>`}<table class="student-duty-table"><thead><tr><th>Date</th><th>Matin</th><th>Nuit</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function refreshStudentService() {
  let settings;
  try { settings = studentServiceSettings(); }
  catch (error) { message("studentServiceMessage", error.message, "error"); return null; }
  $("studentServicePreview").innerHTML = '<div class="loading">Préparation de l’aperçu…</div>';
  message("studentServiceMessage", "", "info");
  try {
    const data = await api(`/cadres/service?action=bootstrap&start=${iso(settings.start)}&end=${iso(settings.end)}`);
    state.studentExport = { ...settings, rows: studentServiceRows(data, settings.start, settings.end) };
    $("studentServicePreview").innerHTML = studentServiceTable(state.studentExport);
    return state.studentExport;
  } catch (error) {
    state.studentExport = null;
    $("studentServicePreview").innerHTML = "";
    message("studentServiceMessage", error.message, "error");
    return null;
  }
}

async function openStudentService() {
  $("studentServiceStart").value = iso(monday(utcDate()));
  $("studentServiceWeeks").value = "4";
  $("studentServiceDialog").showModal();
  await refreshStudentService();
}

async function ensureStudentServiceCurrent() {
  const settings = studentServiceSettings();
  if (!state.studentExport || iso(state.studentExport.start) !== iso(settings.start) || state.studentExport.weeks !== settings.weeks) return refreshStudentService();
  return state.studentExport;
}

async function exportStudentService() {
  const exportData = await ensureStudentServiceCurrent();
  if (!exportData) return;
  const csvRows = [["date", "jour", "creneau", "cadre_de_permanence"]];
  exportData.rows.forEach(row => {
    const dayLabel = row.day.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" });
    if (row.fullDay) csvRows.push([row.date, dayLabel, "Journée", row.morning.join(" / ")]);
    else {
      csvRows.push([row.date, dayLabel, "Matin", row.morning.join(" / ")]);
      csvRows.push([row.date, dayLabel, "Nuit", row.night.join(" / ")]);
    }
  });
  const csv = csvRows.map(columns => columns.map(value => {
    const text = String(value ?? "");
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `service-eleves-${iso(exportData.start)}-${iso(exportData.end)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function printStudentService() {
  const exportData = await ensureStudentServiceCurrent();
  if (!exportData) return;
  const sheet = $("studentPrintSheet");
  sheet.innerHTML = studentServiceTable(exportData, { print: true });
  document.body.classList.add("printing-student-service");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-student-service"), 500);
}

document.querySelectorAll(".module-tab").forEach(button => button.onclick = () => {
  document.querySelectorAll(".module-tab").forEach(tab => tab.classList.toggle("active", tab === button));
  ["planning", "sop", "recovery"].forEach(tab => $(`${tab}Tab`).hidden = button.dataset.tab !== tab);
});
document.querySelectorAll(".range-button").forEach(button => button.onclick = () => { state.mode = "future"; state.months = Number(button.dataset.months); state.offsetWeeks = 0; loadPlanning(); });
$("previousPeriod").onclick = () => { state.mode = "default"; state.offsetWeeks -= 1; loadPlanning(); };
$("nextPeriod").onclick = () => { state.mode = "default"; state.offsetWeeks += 1; loadPlanning(); };
$("today").onclick = () => { state.mode = "default"; state.offsetWeeks = 0; loadPlanning(); };
$("refreshPlanning").onclick = () => loadPlanning({ preserveScroll: true });
$("clearSelection").onclick = clearSelection;
$("deleteSelection").onclick = deleteSelection;
$("toggleDetails").onclick = () => { $("entryDetails").hidden = !$("entryDetails").hidden; };
$("addActivity").onclick = () => {
  const label = $("customLabel").value.trim();
  if (!label) {
    message("planningMessage", "Saisissez le libellé de l’activité.", "error");
    $("customLabel").focus();
    return;
  }
  const color = document.querySelector('input[name="activityColor"]:checked')?.value || "";
  applyService("D", { merge: true, customColor: color, activity: true });
};
$("exportPlanning").onclick = exportPlanning;
$("studentService").onclick = openStudentService;
$("previewStudentService").onclick = refreshStudentService;
$("studentServiceStart").onchange = refreshStudentService;
$("studentServiceWeeks").onchange = refreshStudentService;
$("exportStudentService").onclick = exportStudentService;
$("printStudentService").onclick = printStudentService;
$("closeStudentService").onclick = () => $("studentServiceDialog").close();
$("cancelStudentService").onclick = () => $("studentServiceDialog").close();
$("movementDate").value = iso(utcDate());
$("newMovement").onclick = openMovementDialog;
$("movementForm").addEventListener("submit", saveMovement);
$("cancelMovement").onclick = () => $("movementDialog").close();
$("closeMovementDialog").onclick = () => $("movementDialog").close();
$("closeRecovery").onclick = () => { $("recoveryDetail").hidden = true; state.activeRecoveryPerson = null; };
$("managePeople").onclick = () => { renderPeopleEditor(); $("peopleDialog").showModal(); };
$("addPerson").onclick = addPersonEditorRow;
$("saveAllPeople").onclick = saveAllPeople;

loadPlanning();
