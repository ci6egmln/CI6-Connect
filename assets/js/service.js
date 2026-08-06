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
  activeRecoveryPerson: null
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
function entryKey(targetType, targetKey, date, slot) { return `${targetType}|${targetKey}|${date}|${slot}`; }
function parseKey(key) { const [target_type, target_key, service_date, slot] = key.split("|"); return { target_type, target_key, service_date, slot }; }
function typeFor(code) { return state.data?.serviceTypes.find(type => type.code === code); }
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
    $("managePeople").hidden = !data.permission.isAdmin;
    renderPalette();
    renderPlanning();
    renderSop();
    renderRecovery();
    populatePeopleSelect();
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
  $("servicePalette").querySelectorAll("[data-code]").forEach(button => button.onclick = () => applyService(button.dataset.code));
}

function planningRows() {
  const pelotons = state.data.pelotons.map(key => ({ targetType: "peloton", targetKey: key, name: key, grade: "Activité collective", peloton: true }));
  const people = state.data.people.map(person => ({ targetType: "person", targetKey: String(person.id), name: person.display_name, grade: person.grade, pelotonName: person.peloton, person }));
  return [...pelotons, ...people];
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
  if (row.peloton) return "—";
  const id = Number(row.targetKey);
  const permanence = state.data.permanence.find(item => Number(item.person_id) === id)?.total || 0;
  const recovery = state.data.recovery.find(item => Number(item.person_id) === id)?.balance || 0;
  return `<span title="Permanences / solde de repos">P ${number(permanence)}<br>RR ${number(recovery)}</span>`;
}

function renderPlanning() {
  const days = daysBetween(state.start, state.end);
  const rows = planningRows();
  const today = iso(utcDate());
  const groups = monthGroups(days);
  let html = `<div class="planning-grid" style="--days:${days.length}">`;
  html += '<div class="grid-corner" style="grid-column:1;grid-row:1/3">Cadres et pelotons</div><div class="counter-head" style="grid-column:2;grid-row:1/3">P / RR</div>';
  let monthColumn = 3;
  groups.forEach((group, index) => { html += `<div class="month-head${index % 2 ? " alt" : ""}" style="grid-column:${monthColumn}/span ${group.count};grid-row:1">${esc(group.label)}</div>`; monthColumn += group.count; });
  days.forEach((day, index) => {
    const date = iso(day); const holiday = holidayFor(day); const nonWorkingDay = [0, 6].includes(day.getUTCDay()) || Boolean(holiday);
    html += `<div class="day-head${nonWorkingDay ? " weekend" : ""}${date === today ? " today" : ""}" style="grid-column:${index + 3};grid-row:2"${holiday ? ` title="${esc(holiday)}"` : ""}><strong>${day.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" })}</strong><br>${String(day.getUTCDate()).padStart(2, "0")}<div>M&nbsp;&nbsp;N</div></div>`;
  });
  rows.forEach((row, rowIndex) => {
    const gridRow = rowIndex + 3;
    html += `<div class="row-name${row.peloton ? " peloton" : ""}" style="grid-column:1;grid-row:${gridRow}"><div>${row.grade ? `<small>${esc(row.grade)}</small>` : ""}${esc(row.name)}${row.pelotonName ? `<small>${esc(row.pelotonName)}</small>` : ""}</div></div>`;
    html += `<div class="row-counter" style="grid-column:2;grid-row:${gridRow}">${counterFor(row)}</div>`;
    days.forEach((day, dayIndex) => {
      const date = iso(day); const nonWorkingDay = [0, 6].includes(day.getUTCDay()) || Boolean(holidayFor(day));
      html += `<div class="day-cell${nonWorkingDay ? " weekend" : ""}${date === today ? " today" : ""}" style="grid-column:${dayIndex + 3};grid-row:${gridRow}">`;
      for (const slot of ["M", "N"]) {
        const key = entryKey(row.targetType, row.targetKey, date, slot);
        const entry = state.entries.get(key); const type = entry ? typeFor(entry.service_code) : null;
        const label = entry?.custom_label || entry?.service_code || "";
        const title = entry ? `${type?.label || entry.service_code}${entry.custom_label ? ` — ${entry.custom_label}` : ""}${entry.notes ? `\n${entry.notes}` : ""}\nModifié par ${entry.updated_by}` : `${row.name} — ${frDate(date)} ${slot === "M" ? "matin" : "nuit"}`;
        html += `<button class="slot-cell${entry ? " has-entry" : ""}" data-key="${key}" type="button" title="${esc(title)}"${entry ? ` style="--entry-color:${type?.color || "#fff"};--entry-text:${type?.textColor || "#111"}"` : ""}><span class="slot-code">${esc(label)}</span></button>`;
      }
      html += "</div>";
    });
  });
  html += "</div>";
  $("planningViewport").innerHTML = html;
  $("planningViewport").querySelectorAll(".slot-cell").forEach(cell => cell.onclick = event => selectCell(cell.dataset.key, event.shiftKey));
}

function selectCell(key, extend) {
  if (extend && state.lastSelected) {
    const previous = parseKey(state.lastSelected); const current = parseKey(key);
    if (previous.target_type === current.target_type && previous.target_key === current.target_key) {
      const ordered = daysBetween(state.start, state.end).flatMap(day => ["M", "N"].map(slot => entryKey(current.target_type, current.target_key, iso(day), slot)));
      const a = ordered.indexOf(state.lastSelected); const b = ordered.indexOf(key);
      if (a >= 0 && b >= 0) for (let index = Math.min(a, b); index <= Math.max(a, b); index += 1) state.selected.add(ordered[index]);
    } else state.selected.add(key);
  } else if (state.selected.has(key)) state.selected.delete(key);
  else state.selected.add(key);
  state.lastSelected = key;
  refreshSelectionClasses();
  updateSelectionBar();
}

function refreshSelectionClasses() { document.querySelectorAll(".slot-cell[data-key]").forEach(cell => cell.classList.toggle("selected", state.selected.has(cell.dataset.key))); }
function updateSelectionBar() {
  const count = state.selected.size;
  $("selectionCount").textContent = count ? `${count} case${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}` : "Aucune case sélectionnée";
  $("deleteSelection").disabled = ![...state.selected].some(key => state.entries.has(key));
}

function clearSelection() { state.selected.clear(); state.lastSelected = ""; refreshSelectionClasses(); updateSelectionBar(); }

async function applyService(code) {
  if (!state.selected.size) return message("planningMessage", "Sélectionnez d’abord une ou plusieurs cases.", "error");
  const items = [...state.selected].map(key => ({
    ...parseKey(key),
    expected_empty: !state.entries.has(key),
    expected_updated_at: state.entries.get(key)?.updated_at || null
  }));
  message("planningMessage", "Enregistrement en cours…", "info");
  try {
    const data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-entries", items, service_code: code, custom_label: $("customLabel").value, notes: $("entryNotes").value }) });
    data.entries.forEach(entry => state.entries.set(entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry));
    if (["RR", "RPC"].includes(code)) {
      const personEntries = data.entries.filter(entry => entry.target_type === "person");
      if (personEntries.length && confirm(`Déduire automatiquement ${number(personEntries.length * 0.5)} jour(s) des compteurs de repos concernés ?`)) {
        await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-from-entries", ids: personEntries.map(entry => entry.id) }) });
      }
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

function populatePeopleSelect() { $("movementPerson").innerHTML = state.data.people.map(person => `<option value="${person.id}">${esc([person.grade, person.display_name].filter(Boolean).join(" "))}</option>`).join(""); }

async function saveMovement(event) {
  event.preventDefault();
  try {
    await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-movement", person_id: Number($("movementPerson").value), movement_type: $("movementType").value, amount: Number($("movementAmount").value), movement_date: $("movementDate").value, reason: $("movementReason").value }) });
    $("movementDialog").close(); $("movementReason").value = "";
    await refreshCounters();
    if (state.activeRecoveryPerson) await loadRecoveryDetail(state.activeRecoveryPerson);
    message("recoveryMessage", "Mouvement enregistré.", "ok");
  } catch (error) { message("recoveryMessage", error.message, "error"); }
}

function renderPeopleEditor() {
  const rows = [...(state.data.peopleAdmin || state.data.people), { id: "", grade: "", display_name: "", peloton: "", sort_order: 100, active: 1, sop_eligible: 1, isNew: true }];
  $("peopleEditor").innerHTML = rows.map(person => `<div class="person-row" data-person-row="${person.id || "new"}"><input data-field="grade" value="${esc(person.grade)}" placeholder="Grade" aria-label="Grade"><input data-field="display_name" value="${esc(person.display_name)}" placeholder="Nom du cadre" aria-label="Nom"><select data-field="peloton" aria-label="Peloton"><option value="">—</option>${["P1", "P2", "P3"].map(value => `<option value="${value}"${person.peloton === value ? " selected" : ""}>${value}</option>`).join("")}</select><input data-field="sort_order" type="number" min="0" max="9999" value="${Number(person.sort_order || 100)}" aria-label="Ordre"><label class="check-line"><input data-field="sop_eligible" type="checkbox"${Number(person.sop_eligible) ? " checked" : ""}> SOP</label><label class="check-line"><input data-field="active" type="checkbox"${Number(person.active) ? " checked" : ""}> Actif</label><button class="button compact person-save" type="button" data-save-person="${person.id || "new"}">${person.isNew ? "Ajouter" : "Enregistrer"}</button></div>`).join("");
  $("peopleEditor").querySelectorAll("[data-save-person]").forEach(button => button.onclick = () => savePerson(button));
}

async function savePerson(button) {
  const row = button.closest("[data-person-row]"); const id = row.dataset.personRow === "new" ? 0 : Number(row.dataset.personRow);
  const field = name => row.querySelector(`[data-field="${name}"]`);
  try {
    await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-person", id, grade: field("grade").value, display_name: field("display_name").value, peloton: field("peloton").value, sort_order: Number(field("sort_order").value), sop_eligible: field("sop_eligible").checked, active: field("active").checked }) });
    await loadPlanning({ preserveScroll: true }); renderPeopleEditor();
  } catch (error) { alert(error.message); }
}

function exportPlanning() {
  const people = new Map(state.data.people.map(person => [String(person.id), [person.grade, person.display_name].filter(Boolean).join(" ")]));
  const rows = [...state.entries.values()].sort((a, b) => `${a.service_date}${a.slot}`.localeCompare(`${b.service_date}${b.slot}`));
  const csv = [["date", "creneau", "type_ligne", "cadre_ou_peloton", "service", "libelle", "note", "modifie_par"], ...rows.map(entry => [entry.service_date, entry.slot === "M" ? "Matin" : "Nuit", entry.target_type, entry.target_type === "person" ? people.get(entry.target_key) : entry.target_key, entry.service_code, entry.custom_label, entry.notes, entry.updated_by])].map(columns => columns.map(value => { const text = String(value ?? ""); return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }).join(";")).join("\r\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); link.download = `planning-service-${iso(state.start)}-${iso(state.end)}.csv`; link.click(); URL.revokeObjectURL(link.href);
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
$("exportPlanning").onclick = exportPlanning;
$("movementDate").value = iso(utcDate());
$("newMovement").onclick = () => $("movementDialog").showModal();
$("movementForm").addEventListener("submit", saveMovement);
$("cancelMovement").onclick = () => $("movementDialog").close();
$("closeMovementDialog").onclick = () => $("movementDialog").close();
$("closeRecovery").onclick = () => { $("recoveryDetail").hidden = true; state.activeRecoveryPerson = null; };
$("managePeople").onclick = () => { renderPeopleEditor(); $("peopleDialog").showModal(); };
$("addPerson").onclick = () => { const last = $("peopleEditor").querySelector('[data-person-row="new"]'); last?.scrollIntoView({ behavior: "smooth" }); last?.querySelector('[data-field="display_name"]')?.focus(); };

loadPlanning();
