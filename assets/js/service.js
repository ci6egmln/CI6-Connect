const $ = id => document.getElementById(id);
const DAY_MS = 86400000;
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const state = {
  data: null,
  start: null,
  end: null,
  mode: "default",
  months: 0,
  monthValue: "",
  offsetWeeks: 0,
  selected: new Set(),
  lastSelected: "",
  entries: new Map(),
  activeRecoveryPerson: null,
  recoverySortDirection: "desc",
  recoveryGroupedRows: [],
  studentExport: null,
  planningPrintExport: null,
  dragSelection: null,
  suppressNextClick: false,
  editingRecoveryId: null,
  entryColorTouched: false
};

const RECOVERY_REASONS = {
  credit: [
    "Activité rupture de rythme",
    "Activité tradition",
    "Jour férié travaillé",
    "Samedi travaillé",
    "Dimanche travaillé",
    "Week-end travaillé",
    "Permanence soir sans récup",
    "Permanence matin sans récup"
  ],
  debit: ["RPC", "Repos récupérateur"]
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
  if (state.mode === "month" && /^\d{4}-\d{2}$/.test(state.monthValue)) {
    const [year, month] = state.monthValue.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 12));
    const end = new Date(Date.UTC(year, month, 0, 12));
    return { start, end };
  }
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
      if (data.permission.isCdu) managePeopleButton.hidden = false;
      else managePeopleButton.remove();
    }
    const purgeButton = $("purgePlanning");
    if (purgeButton) {
      if (data.permission.isCdu) purgeButton.hidden = false;
      else purgeButton.remove();
    }
    const permanenceCounterControl = $("permanenceCounterStartControl");
    if (permanenceCounterControl) {
      permanenceCounterControl.hidden = false;
      $("permanenceCounterStart").value = data.permanenceCountStart || "";
      $("permanenceCounterStart").disabled = !data.permission.isCdu;
      $("savePermanenceCounterStart").hidden = !data.permission.isCdu;
      permanenceCounterControl.classList.toggle("readonly", !data.permission.isCdu);
      permanenceCounterControl.title = data.permission.isCdu ? "Date de début du comptage des permanences" : "Information : seul le CDU peut modifier cette date";
    }
    const serviceCompletedControl = $("serviceCompletedThroughControl");
    if (serviceCompletedControl) {
      serviceCompletedControl.hidden = false;
      $("serviceCompletedThrough").value = data.serviceCompletedThrough || "";
      $("serviceCompletedThrough").disabled = !data.permission.isCdu;
      $("saveServiceCompletedThrough").hidden = !data.permission.isCdu;
      serviceCompletedControl.classList.toggle("readonly", !data.permission.isCdu);
      serviceCompletedControl.title = data.permission.isCdu
        ? "Date de clôture : le service et les repos sont considérés comme réalisés jusqu’à cette date"
        : "Information : seul le CDU peut modifier la date de clôture";
    }
    const completedInfo = $("serviceCompletedThroughInfo");
    if (completedInfo) {
      completedInfo.hidden = false;
      const infoDate = $("serviceCompletedThroughInfoDate");
      if (infoDate) infoDate.textContent = data.serviceCompletedThrough
        ? frDate(data.serviceCompletedThrough, { day: "2-digit", month: "2-digit", year: "numeric" })
        : "Non définie";
    }
    const sopControls = $("sopYearControls");
    if (sopControls) sopControls.hidden = !data.permission.isCdu;
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

async function savePermanenceCounterStart() {
  if (!state.data?.permission?.isCdu) return;
  const startDate = $("permanenceCounterStart")?.value || "";
  if (!startDate) {
    message("planningMessage", "Choisissez la date de début du compteur P.", "error");
    return;
  }
  const label = frDate(startDate, { day: "2-digit", month: "2-digit", year: "numeric" });
  if (!confirm(`Réinitialiser le compteur P à partir du ${label} ?\n\nLes permanences antérieures resteront dans le planning mais ne seront plus comptées.`)) return;
  try {
    await api("/cadres/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-permanence-count-start", start_date: startDate })
    });
    message("planningMessage", `Le compteur P repart désormais du ${label}.`, "success");
    await loadPlanning({ preserveScroll: true });
  } catch (error) {
    message("planningMessage", error.message, "error");
  }
}

async function saveServiceCompletedThrough() {
  if (!state.data?.permission?.isCdu) return;
  const completedThrough = $("serviceCompletedThrough")?.value || "";
  if (!completedThrough) {
    message("planningMessage", "Choisissez la date de clôture du service.", "error");
    return;
  }
  const label = frDate(completedThrough, { day: "2-digit", month: "2-digit", year: "numeric" });
  if (!confirm(`Clôturer le service jusqu’au ${label} ?\n\nJusqu’à cette date, le planning est considéré comme réalisé : les repos manquants et les RR pris entrent dans le compteur. Les cadres ne pourront plus modifier cette période. Les RR placés après cette date resteront affichés comme demandes futures, sans être décomptés du solde.`)) return;
  try {
    await api("/cadres/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-service-completed-through", completed_through: completedThrough })
    });
    message("planningMessage", `Service clôturé jusqu’au ${label}. Les repos manquants et les RR pris ont été recalculés.`, "success");
    await loadPlanning({ preserveScroll: true });
  } catch (error) {
    message("planningMessage", error.message, "error");
  }
}

function updatePeriodLabel() {
  $("periodLabel").textContent = `${frDate(state.start)} — ${frDate(state.end)}`;
  document.querySelectorAll(".range-button").forEach(button => button.classList.toggle("active", state.mode === "future" && Number(button.dataset.months) === state.months));
  const monthPicker = $("monthPicker");
  if (monthPicker && state.mode === "month" && state.monthValue) monthPicker.value = state.monthValue;
  $("showFullMonth")?.classList.toggle("active", state.mode === "month");
}

function paletteButtonText(type) {
  if (type.code === "PERM_POSEE") return "Permission posée Agorha";
  if (type.code === "PERM_VALIDEE") return "Permission validée";
  return type.code;
}

function entryDisplayLabel(entry) {
  if (!entry) return "";
  if (entry.custom_label) return entry.custom_label;
  if (entry.service_code === "PERM_POSEE") return "Permission posée Agorha";
  if (entry.service_code === "PERM_VALIDEE") return "Permission validée";
  return entry.service_code || "";
}

function renderPalette() {
  // entryDetails est déplacé dans la palette, immédiatement après le bouton
  // « Ajouter un libellé ou une note », pour rester compact et sur la même ligne.
  const detailsPanel = $("entryDetails");
  if (detailsPanel) detailsPanel.remove();
  $("servicePalette").innerHTML = state.data.serviceTypes.map(type => {
    const button = `
      <button class="palette-button${type.code.startsWith("PERM_") ? " palette-button-permission" : ""}" type="button" data-code="${type.code}" style="--palette-color:${type.color};--palette-text:${type.textColor}" title="${esc(type.label)}">
        ${esc(paletteButtonText(type))}
      </button>`;
    return type.code === "PERM_VALIDEE"
      ? `${button}<button id="toggleDetails" class="button secondary compact palette-details-button" type="button">Ajouter un libellé ou une note</button>`
      : button;
  }).join("");
  $("servicePalette").querySelectorAll("[data-code]").forEach(button => button.onclick = () => applyService(
    button.dataset.code,
    { merge: state.selected.size > 1 }
  ));
  const toggle = $("toggleDetails");
  if (toggle && detailsPanel) toggle.insertAdjacentElement("afterend", detailsPanel);
  if (toggle) toggle.onclick = () => {
    const willOpen = $("entryDetails").hidden;
    $("entryDetails").hidden = !willOpen;
    if (willOpen) syncEntryDetailsFromSelection();
  };
  document.querySelectorAll('input[name="activityColor"]').forEach(input => {
    input.onchange = () => { state.entryColorTouched = true; };
  });
  updateSelectionBar();
}

function syncEntryDetailsFromSelection() {
  const customLabelInput = $("customLabel");
  const notesInput = $("entryNotes");
  if (!customLabelInput || !notesInput) return;

  const selectedEntries = [...state.selected].map(key => state.entries.get(key)).filter(Boolean);
  if (!selectedEntries.length || selectedEntries.length !== state.selected.size) return;

  const labels = [...new Set(selectedEntries.map(entry => String(entry.custom_label || "")))];
  const notes = [...new Set(selectedEntries.map(entry => String(entry.notes || "")))];

  // Une activité fusionnée est stockée sur plusieurs cases : si toutes les cases
  // portent le même texte, on le préremplit une seule fois pour permettre sa modification.
  customLabelInput.value = labels.length === 1 ? labels[0] : "";
  notesInput.value = notes.length === 1 ? notes[0] : "";
  const colors = [...new Set(selectedEntries.map(entry => String(entry.custom_color || "").toLowerCase()))];
  document.querySelectorAll('input[name="activityColor"]').forEach(input => { input.checked = colors.length === 1 && colors[0] && input.value.toLowerCase() === colors[0]; });
  state.entryColorTouched = false;
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


function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function weekGroups(days) {
  const groups = [];
  days.forEach(day => {
    const week = isoWeekNumber(day);
    const year = (() => {
      const d = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
      const dow = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dow);
      return d.getUTCFullYear();
    })();
    const key = `${year}-${week}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.count += 1;
    else groups.push({ key, week, count: 1 });
  });
  return groups;
}

function renderPlanning() {
  const days = daysBetween(state.start, state.end);
  const rows = planningRows();
  const today = iso(utcDate());
  const groups = monthGroups(days);
  const weeks = weekGroups(days);
  const nameWidth = nameColumnWidth(rows);
  let html = `<div class="planning-grid" style="--slots:${days.length * 2};--name-width:${nameWidth}px">`;
  html += '<div class="grid-corner" style="grid-column:1;grid-row:1/4">Cadres</div><div class="counter-head permanence" style="grid-column:2;grid-row:1/4" title="Permanences">P</div><div class="counter-head recovery" style="grid-column:3;grid-row:1/4" title="Solde de repos récupérateurs">RR</div>';
  let monthColumn = 4;
  groups.forEach((group, index) => { html += `<div class="month-head${index % 2 ? " alt" : ""}" style="grid-column:${monthColumn}/span ${group.count * 2};grid-row:1">${esc(group.label)}</div>`; monthColumn += group.count * 2; });
  let weekColumn = 4;
  weeks.forEach(group => { html += `<div class="week-head" style="grid-column:${weekColumn}/span ${group.count * 2};grid-row:2">Semaine ${group.week}</div>`; weekColumn += group.count * 2; });
  days.forEach((day, index) => {
    const date = iso(day); const holiday = holidayFor(day); const nonWorkingDay = [0, 6].includes(day.getUTCDay()) || Boolean(holiday);
    html += `<div class="day-head${nonWorkingDay ? " weekend" : ""}${date === today ? " today" : ""}" style="grid-column:${index * 2 + 4}/span 2;grid-row:3"${holiday ? ` title="${esc(holiday)}"` : ""}><strong>${day.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" })}</strong><br><span class="day-date-frame">${String(day.getUTCDate()).padStart(2, "0")}</span><div>M&nbsp;&nbsp;N</div></div>`;
  });
  rows.forEach((row, rowIndex) => {
    const gridRow = rowIndex + 4;
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
      const grouped = span > 1;
      const groupedItems = slots.slice(slotIndex, slotIndex + span);
      const entry = item.entry;
      const type = entry ? typeFor(entry.service_code) : null;
      const label = entryDisplayLabel(entry);
      const title = entry ? `${type?.label || entry.service_code}${entry.custom_label ? ` — ${entry.custom_label}` : ""}${entry.notes ? `\n${entry.notes}` : ""}\nModifié par ${entry.updated_by}` : `${row.name} — ${frDate(item.date)} ${item.slot === "M" ? "matin" : "nuit"}`;
      const nonWorkingDay = [0, 6].includes(item.day.getUTCDay()) || Boolean(holidayFor(item.day));
      const keys = groupedItems.map(slot => slot.key).join(",");
      const color = entry?.custom_color || type?.color || "#fff";
      const textColor = entry?.custom_color ? contrastText(entry.custom_color) : type?.textColor || "#111";
      const startsDay = item.slot === "M";
      const endsDay = groupedItems.at(-1)?.slot === "N";
      html += `<button class="slot-cell${row.peloton ? " peloton" : ""}${nonWorkingDay ? " weekend" : ""}${startsDay ? " day-start" : ""}${endsDay ? " day-end" : ""}${entry ? " has-entry" : ""}${entry?.service_code?.startsWith("PERM_") ? " permission-entry" : ""}${grouped ? " merged-activity" : ""}" data-keys="${keys}" type="button" style="grid-column:${slotIndex + 4}/span ${span};grid-row:${gridRow}${entry ? `;--entry-color:${color};--entry-text:${textColor}` : ""}" title="${esc(title)}"><span class="slot-code">${esc(label)}</span></button>`;
      slotIndex += span;
    }
  });
  html += "</div>";
  $("planningViewport").innerHTML = html;
  bindPlanningSelection();
}

function atomicKeyAtPointer(cell, clientX) {
  const keys = cell.dataset.keys.split(",").filter(Boolean);
  if (keys.length <= 1) return keys[0] || "";
  const rect = cell.getBoundingClientRect();
  const ratio = rect.width > 0 ? Math.max(0, Math.min(0.999999, (clientX - rect.left) / rect.width)) : 0;
  return keys[Math.floor(ratio * keys.length)] || keys[0];
}

function planningRowOrder() {
  const rows = [];
  const seen = new Set();
  document.querySelectorAll("#planningViewport .slot-cell[data-keys]").forEach(cell => {
    const key = cell.dataset.keys.split(",")[0];
    if (!key) return;
    const parsed = parseKey(key);
    const signature = `${parsed.target_type}|${parsed.target_key}`;
    if (!seen.has(signature)) {
      seen.add(signature);
      rows.push({ signature, target_type: parsed.target_type, target_key: parsed.target_key });
    }
  });
  return rows;
}

function planningColumnIndex(key) {
  const parsed = parseKey(key);
  const start = utcDate(state.start);
  const current = utcDate(parsed.service_date);
  const dayIndex = Math.round((current - start) / DAY_MS);
  return dayIndex * 2 + (parsed.slot === "N" ? 1 : 0);
}

function rectangleKeys(anchorKey, currentKey) {
  const rows = planningRowOrder();
  const anchor = parseKey(anchorKey);
  const current = parseKey(currentKey);
  const aRow = rows.findIndex(row => row.signature === `${anchor.target_type}|${anchor.target_key}`);
  const bRow = rows.findIndex(row => row.signature === `${current.target_type}|${current.target_key}`);
  const aCol = planningColumnIndex(anchorKey);
  const bCol = planningColumnIndex(currentKey);
  if (aRow < 0 || bRow < 0 || aCol < 0 || bCol < 0) return [];

  const minRow = Math.min(aRow, bRow);
  const maxRow = Math.max(aRow, bRow);
  const minCol = Math.min(aCol, bCol);
  const maxCol = Math.max(aCol, bCol);
  const days = daysBetween(state.start, state.end);
  const result = [];
  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    const row = rows[rowIndex];
    for (let column = minCol; column <= maxCol; column += 1) {
      const day = days[Math.floor(column / 2)];
      if (!day) continue;
      const slot = column % 2 ? "N" : "M";
      result.push(entryKey(row.target_type, row.target_key, iso(day), slot));
    }
  }
  return result;
}

function bindPlanningSelection() {
  const viewport = $("planningViewport");
  const cells = [...viewport.querySelectorAll(".slot-cell[data-keys]")];

  cells.forEach(cell => {
    cell.onclick = event => {
      if (state.suppressNextClick) {
        state.suppressNextClick = false;
        return;
      }
      selectCells(cell.dataset.keys.split(","), {
        extend: event.shiftKey,
        additive: event.ctrlKey || event.metaKey
      });
    };

    cell.onpointerdown = event => {
      if (event.button !== 0 || !["mouse", "pen"].includes(event.pointerType)) return;
      const anchorKey = atomicKeyAtPointer(cell, event.clientX);
      if (!anchorKey) return;
      state.dragSelection = {
        anchorKey,
        currentKey: anchorKey,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        additive: event.ctrlKey || event.metaKey,
        base: new Set(event.ctrlKey || event.metaKey ? state.selected : [])
      };
    };
  });
}

document.addEventListener("pointermove", event => {
  const drag = state.dragSelection;
  if (!drag || !["mouse", "pen"].includes(event.pointerType)) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
  drag.moved = true;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("#planningViewport .slot-cell[data-keys]");
  if (!target) return;
  const currentKey = atomicKeyAtPointer(target, event.clientX);
  if (!currentKey) return;
  drag.currentKey = currentKey;
  state.selected = new Set(drag.base);
  rectangleKeys(drag.anchorKey, currentKey).forEach(key => state.selected.add(key));
  state.lastSelected = currentKey;
  refreshSelectionClasses();
  updateSelectionBar();
  event.preventDefault();
}, { passive: false });

document.addEventListener("pointerup", event => {
  const drag = state.dragSelection;
  if (!drag || !["mouse", "pen"].includes(event.pointerType)) return;
  if (drag.moved) state.suppressNextClick = true;
  state.dragSelection = null;
});

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
function selectionContainsLockedDate() {
  const today = iso(utcDate());
  const cutoff = state.data?.serviceCompletedThrough || "";
  return [...state.selected].some(key => {
    const date = parseKey(key).service_date;
    return date < today || Boolean(cutoff && date <= cutoff);
  });
}
function pastPlanningLocked() {
  return Boolean(state.selected.size && selectionContainsLockedDate() && !state.data?.permission?.isCdu);
}
function updateSelectionBar() {
  const count = state.selected.size;
  $("selectionCount").textContent = count ? `${count} case${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}` : "Aucune case sélectionnée";
  const allFilled = count > 0 && [...state.selected].every(key => state.entries.has(key));
  const pastLocked = pastPlanningLocked();
  $("deleteSelection").disabled = ![...state.selected].some(key => state.entries.has(key)) || pastLocked;
  const modifyButton = $("modifySelection");
  if (modifyButton) modifyButton.disabled = !allFilled || pastLocked;
  document.querySelectorAll("#servicePalette .palette-button").forEach(button => { button.disabled = pastLocked; });
  const detailsToggle = $("toggleDetails");
  if (detailsToggle) detailsToggle.disabled = pastLocked;
  if (count) syncEntryDetailsFromSelection();
}

function clearSelection() { state.selected.clear(); state.lastSelected = ""; refreshSelectionClasses(); updateSelectionBar(); }

function weeklyRestConflictForR() {
  const restCodes = new Set(["R", "PERM_POSEE", "PERM_VALIDEE"]);
  const selectedPersonDates = new Map();

  for (const key of state.selected) {
    const parsed = parseKey(key);
    if (parsed.target_type !== "person") continue;
    const weekStart = iso(monday(utcDate(parsed.service_date)));
    const groupKey = `${parsed.target_key}|${weekStart}`;
    if (!selectedPersonDates.has(groupKey)) selectedPersonDates.set(groupKey, new Set());
    selectedPersonDates.get(groupKey).add(parsed.service_date);
  }
  if (!selectedPersonDates.size) return [];

  const existingByGroup = new Map();
  for (const [key, entry] of state.entries) {
    if (state.selected.has(key) || entry.target_type !== "person" || !restCodes.has(entry.service_code)) continue;
    const weekStart = iso(monday(utcDate(entry.service_date)));
    const groupKey = `${entry.target_key}|${weekStart}`;
    if (!selectedPersonDates.has(groupKey)) continue;
    if (!existingByGroup.has(groupKey)) existingByGroup.set(groupKey, new Set());
    existingByGroup.get(groupKey).add(entry.service_date);
  }

  const conflicts = [];
  for (const [groupKey, selectedDates] of selectedPersonDates) {
    const existingDates = existingByGroup.get(groupKey) || new Set();
    const resultingDates = new Set([...existingDates, ...selectedDates]);
    if (existingDates.size >= 2 || resultingDates.size > 2) {
      const [personId, weekStart] = groupKey.split("|");
      const person = state.data?.people?.find(item => String(item.id) === String(personId));
      conflicts.push({
        personId,
        personName: person ? [String(person.grade || "").trim(), planningSurname(person)].filter(Boolean).join(" ") : `Cadre ${personId}`,
        weekStart,
        existing: existingDates.size,
        resulting: resultingDates.size
      });
    }
  }
  return conflicts;
}

function confirmRorRR(code) {
  if (code !== "R") return code;
  const conflicts = weeklyRestConflictForR();
  if (!conflicts.length) return code;
  const first = conflicts[0];
  const extra = conflicts.length > 1 ? `\n${conflicts.length - 1} autre(s) cadre/semaine sont également concernés.` : "";
  const useRR = confirm(
    `${first.personName} dispose déjà de 2 jours de repos, ou cette saisie porterait la semaine à plus de 2 jours de repos (semaine du ${frDate(first.weekStart)}).\n\n` +
    `Vous avez peut-être voulu saisir un RR.\n\nOK : poser RR à la place de R\nAnnuler : annuler l’ajout et laisser la case inchangée.${extra}`
  );
  return useRR ? "RR" : null;
}

async function applyService(code, { merge = false, customColor = "", activity = false } = {}) {
  if (!state.selected.size) return message("planningMessage", "Sélectionnez d’abord une ou plusieurs cases.", "error");
  if (pastPlanningLocked()) return message("planningMessage", "Seul le CDU peut modifier une date passée ou déjà clôturée.", "error");
  code = confirmRorRR(code);
  if (!code) return message("planningMessage", "Ajout annulé : aucune modification n’a été apportée au planning.", "info");
  const replacedRest = [...state.selected].map(key => state.entries.get(key)).filter(entry => entry && ["RR", "RPC"].includes(entry.service_code) && entry.service_code !== code);
  let removalReason = "";
  if (replacedRest.length) {
    removalReason = prompt("Motif du retrait du repos :", "Modification du planning") || "";
    if (!removalReason.trim()) return message("planningMessage", "Le motif du retrait est obligatoire.", "error");
  }
  const items = [...state.selected].map(key => ({
    ...parseKey(key),
    expected_empty: !state.entries.has(key),
    expected_updated_at: state.entries.get(key)?.updated_at || null
  }));
  message("planningMessage", "Enregistrement en cours…", "info");
  try {
    const data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-entries", items, service_code: code, custom_label: $("customLabel").value, custom_color: customColor, notes: $("entryNotes").value, merge, activity, removal_reason: removalReason }) });
    data.entries.forEach(entry => state.entries.set(entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry));
    if (["RR", "RPC"].includes(code)) {
      const personEntries = data.entries.filter(entry => entry.target_type === "person");
      if (personEntries.length && code === "RR") {
        // Un RR posé au planning doit toujours apparaître dans le suivi. S'il est au-delà
        // de la date de clôture, le serveur le conserve comme RR futur demandé et ne le
        // décompte du solde qu'une fois la clôture avancée jusqu'à sa date.
        await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-from-entries", ids: personEntries.map(entry => entry.id) }) });
      } else if (personEntries.length && code === "RPC" && confirm(`Déduire automatiquement ${number(personEntries.length * 0.5)} jour(s) des compteurs de repos concernés ?`)) {
        await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-from-entries", ids: personEntries.map(entry => entry.id) }) });
      }
    }
    const permanenceCandidates = data.permanence_credit_candidates || [];
    if (permanenceCandidates.length && confirm(`Une ou plusieurs permanences ne sont pas suivies d’un RPJ. Créditer +0,5 jour par permanence concernée (${number(permanenceCandidates.length * 0.5)} jour(s) au total) ?`)) {
      await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-from-permanence", ids: permanenceCandidates.map(entry => entry.id) }) });
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

async function saveEntryDetails() {
  if (!state.selected.size) return message("planningMessage", "Sélectionnez d’abord une ou plusieurs cases déjà renseignées.", "error");
  if (pastPlanningLocked()) return message("planningMessage", "Seul le CDU peut modifier une date passée ou déjà clôturée.", "error");
  const selectedEntries = [...state.selected].map(key => state.entries.get(key)).filter(Boolean);
  if (!selectedEntries.length) return message("planningMessage", "La sélection ne contient aucun service auquel ajouter une note.", "error");
  if (selectedEntries.length !== state.selected.size) return message("planningMessage", "Pour ajouter une note, toutes les cases sélectionnées doivent déjà contenir un service.", "error");
  const ids = [...new Set(selectedEntries.map(entry => Number(entry.id)).filter(Number.isInteger))];
  if (!ids.length) return message("planningMessage", "Impossible d’identifier les cases sélectionnées.", "error");
  const customLabel = $("customLabel").value.trim();
  const notes = $("entryNotes").value.trim();
  message("planningMessage", "Enregistrement du libellé / de la note…", "info");
  try {
    const selectedColor = document.querySelector('input[name="activityColor"]:checked')?.value || "";
    const payload = { action: "update-entry-details", ids, custom_label: customLabel, notes };
    if (state.entryColorTouched) payload.custom_color = selectedColor;
    const data = await api("/cadres/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    (data.entries || []).forEach(entry => state.entries.set(entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry));
    message("planningMessage", `${ids.length} case${ids.length > 1 ? "s" : ""} mise${ids.length > 1 ? "s" : ""} à jour.`, "ok");
    renderPlanning();
    clearSelection();
  } catch (error) {
    message("planningMessage", error.message, "error");
  }
}

function modifySelection() {
  if (pastPlanningLocked()) return message("planningMessage", "Seul le CDU peut modifier une date passée ou déjà clôturée.", "error");
  if (!state.selected.size || ![...state.selected].every(key => state.entries.has(key))) {
    return message("planningMessage", "Sélectionnez uniquement des cases déjà renseignées.", "error");
  }
  const details = $("entryDetails");
  if (details) {
    details.hidden = false;
    syncEntryDetailsFromSelection();
    $("customLabel")?.focus();
    details.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
}

async function deleteSelection() {
  if (pastPlanningLocked()) return message("planningMessage", "Seul le CDU peut modifier une date passée ou déjà clôturée.", "error");
  const selectedEntries = [...state.selected].map(key => state.entries.get(key)).filter(Boolean);
  const ids = [...new Set(selectedEntries.map(entry => entry.id).filter(Boolean))];
  if (!ids.length) return;
  if (!confirm(`Supprimer le contenu de ${ids.length} case${ids.length > 1 ? "s" : ""} ?`)) return;
  let deletionReason = "";
  if (selectedEntries.some(entry => ["RR", "RPC"].includes(entry.service_code))) {
    deletionReason = prompt("Motif du retrait du repos :", "Modification du planning") || "";
    if (!deletionReason.trim()) return message("planningMessage", "Le motif du retrait est obligatoire.", "error");
  }
  try {
    const data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-entries", ids, deletion_reason: deletionReason }) });
    [...state.selected].forEach(key => state.entries.delete(key));
    const permanenceCandidates = data.permanence_credit_candidates || [];
    if (permanenceCandidates.length && confirm(`Le retrait du RPJ rend ${permanenceCandidates.length} permanence${permanenceCandidates.length > 1 ? "s" : ""} éligible${permanenceCandidates.length > 1 ? "s" : ""} à récupération. Créditer +0,5 jour par permanence ?`)) {
      await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-from-permanence", ids: permanenceCandidates.map(entry => entry.id) }) });
    }
    renderPlanning(); clearSelection(); await refreshCounters();
    message("planningMessage", "Contenu supprimé et compteur régularisé si nécessaire.", "ok");
  } catch (error) { message("planningMessage", error.message, "error"); }
}

async function refreshCounters() {
  const scroll = { left: $("planningViewport").scrollLeft, top: $("planningViewport").scrollTop };
  const data = await api(`/cadres/service?action=bootstrap&start=${iso(state.start)}&end=${iso(state.end)}`);
  state.data = data; state.entries = new Map(data.entries.map(entry => [entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry]));
  renderPlanning(); renderSop(); renderRecovery();
  $("planningViewport").scrollLeft = scroll.left; $("planningViewport").scrollTop = scroll.top;
}

function sopCalendarMonths(year, currentYear = new Date().getFullYear()) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1, 12, 0, 0);
    return {
      key: `${year}-${String(index + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      current: year === currentYear && index === new Date().getMonth()
    };
  });
}

function sopDatesByMonth(items = []) {
  const result = new Map();
  const byDate = new Map();
  (Array.isArray(items) ? items : []).forEach(item => {
    const date = typeof item === "string" ? item : item.date;
    const slot = typeof item === "string" ? "" : item.slot;
    if (!date) return;
    if (!byDate.has(date)) byDate.set(date, new Set());
    if (slot) byDate.get(date).add(slot);
  });
  [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([date]) => {
    const month = date.slice(0, 7);
    if (!result.has(month)) result.set(month, []);
    result.get(month).push({ date });
  });
  return result;
}

function renderSopYearControls() {
  const controls = $("sopYearControls");
  const chips = $("sopYearChips");
  if (!controls || !chips || !state.data) return;
  if (!state.data.permission?.isCdu) {
    controls.hidden = true;
    return;
  }
  controls.hidden = false;
  const years = [...new Set((state.data.sopYears || []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  chips.innerHTML = years.map(year => `
    <span class="sop-year-chip"><strong>${year}</strong><button class="role-cdu" type="button" data-remove-sop-year="${year}" title="Retirer ${year}" aria-label="Retirer l’année ${year}">×</button></span>
  `).join("");
  chips.querySelectorAll("[data-remove-sop-year]").forEach(button => {
    button.onclick = () => removeSopYear(Number(button.dataset.removeSopYear));
  });
}

async function saveSopYears(years) {
  try {
    const data = await api("/cadres/service", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-sop-years", years })
    });
    state.data.sopYears = data.years || years;
    await refreshCounters();
    message("planningMessage", "Années de l’équité SOP mises à jour.", "ok");
  } catch (error) { message("planningMessage", error.message, "error"); }
}

async function addSopYear() {
  const input = $("sopYearInput");
  const year = Number(input?.value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    message("planningMessage", "Saisissez une année valide.", "error");
    input?.focus(); return;
  }
  const years = [...new Set([...(state.data?.sopYears || []), year])].map(Number).sort((a, b) => a - b);
  if (years.length === (state.data?.sopYears || []).length) { input.value = ""; return; }
  input.value = "";
  await saveSopYears(years);
}

async function removeSopYear(year) {
  const years = (state.data?.sopYears || []).map(Number).filter(value => value !== Number(year));
  if (!years.length) { message("planningMessage", "Conservez au moins une année dans l’équité SOP.", "error"); return; }
  if (!confirm(`Retirer ${year} de l’affichage Équité SOP ? Les données du planning ne seront pas supprimées.`)) return;
  await saveSopYears(years);
}

function renderSop() {
  const currentYear = new Date().getFullYear();
  const years = [...new Set((state.data.sopYears || [currentYear - 1, currentYear, currentYear + 1]).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  const months = sopCalendarMonths(currentYear, currentYear);
  const eligibleIds = new Set(state.data.people.filter(person => Number(person.sop_eligible) === 1).map(person => Number(person.id)));
  const sopByPerson = new Map((state.data.sop || []).map(item => [Number(item.person_id), item]));
  const people = state.data.people
    .filter(person => eligibleIds.has(Number(person.id)))
    .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100) || String(a.display_name || "").localeCompare(String(b.display_name || ""), "fr"));

  renderSopYearControls();
  const head = $("sopHead");
  if (head) head.innerHTML = `<th>Cadre</th><th class="sop-year-col">Année</th>${months.map(month => `<th class="sop-month">${esc(month.label)}</th>`).join("")}`;

  const rows = [];
  people.forEach(person => {
    const dataRow = sopByPerson.get(Number(person.id)) || { completed_dates: [] };
    const dates = sopDatesByMonth(dataRow.completed_dates || []);
    years.forEach((year, yearIndex) => {
      const yearMonths = sopCalendarMonths(year, currentYear);
      const cells = yearMonths.map(month => {
        const monthDates = dates.get(month.key) || [];
        const content = monthDates.length
          ? `<div class="sop-month-dates">${monthDates.map(item => `<span class="sop-month-date">${esc(frDate(item.date, { day: "2-digit", month: "2-digit" }))}</span>`).join("")}</div>`
          : "";
        return `<td class="sop-month-cell${month.current ? " sop-current-month" : ""}">${content}</td>`;
      }).join("");
      const yearTotal = yearMonths.reduce((total, month) => total + (dates.get(month.key) || []).length, 0);
      const personCell = yearIndex === 0
        ? `<td class="sop-person-cell" rowspan="${years.length}"><strong>${esc([person.grade, person.display_name].filter(Boolean).join(" "))}</strong></td>`
        : "";
      rows.push(`<tr class="sop-year-row sop-year-tone-${yearIndex % 4}${yearIndex === 0 ? " sop-person-start" : ""}${yearIndex === years.length - 1 ? " sop-person-end" : ""}${year === currentYear ? " sop-current-year-row" : ""}">${personCell}<td class="sop-year-value">${year} <span class="sop-year-total">(${yearTotal})</span></td>${cells}</tr>`);
    });
  });
  $("sopBody").innerHTML = rows.join("") || `<tr><td colspan="14" class="empty-state">Aucun cadre éligible aux SOP.</td></tr>`;
}

function renderRecovery() {
  $("recoveryCards").innerHTML = state.data.people.map(person => {
    const totals = state.data.recovery.find(item => Number(item.person_id) === Number(person.id)) || {};
    const balance = Number(totals.balance || 0);
    const futureRR = Number(totals.future_rr_requested || 0);
    const futureBlock = futureRR > 0 ? `<div><span class="future-rr-summary-label">RR futurs demandés</span><strong class="future-rr-summary">${number(futureRR)}</strong></div>` : "";
    return `<button class="recovery-card${futureRR > 0 ? " has-future" : ""}" type="button" data-person="${person.id}"><h3>${esc([person.grade, person.display_name].filter(Boolean).join(" "))}</h3><div class="recovery-numbers"><div><span>Crédités</span><strong>${number(totals.credited)}</strong></div><div><span>Pris</span><strong>${number(totals.taken)}</strong></div><div><span>Solde</span><strong class="${balance < 0 ? "balance-negative" : ""}">${number(balance)}</strong></div>${futureBlock}</div></button>`;
  }).join("") || '<div class="empty-state">Aucun cadre dans le planning.</div>';
  $("recoveryCards").querySelectorAll("[data-person]").forEach(button => button.onclick = () => loadRecoveryDetail(Number(button.dataset.person)));
}

async function loadRecoveryDetail(personId) {
  try {
    const data = await api(`/cadres/service?action=recovery&person_id=${personId}`);
    state.activeRecoveryPerson = personId;
    const totals = state.data.recovery.find(item => Number(item.person_id) === personId) || {};
    $("recoveryPerson").textContent = [data.person.grade, data.person.display_name].filter(Boolean).join(" ");
    const futureRR = Number(totals.future_rr_requested || 0);
    const cutoffLabel = data.completedThrough ? frDate(data.completedThrough) : "non définie";
    $("recoveryBalance").textContent = `Solde arrêté à la clôture (${cutoffLabel}) : ${number(totals.balance)} jour(s) · RR futurs demandés : ${number(futureRR)} jour(s)`;
    const grouped = [];
    const byGroup = new Map();
    for (const movement of data.movements) {
      const futureFlag = Number(movement.future_rr || 0) === 1;
      const key = `${movement.display_group || movement.movement_group || `single-${movement.id}`}|future:${futureFlag ? 1 : 0}`;
      const effectiveStart = movement.effective_start || movement.movement_date;
      const effectiveEnd = movement.effective_end || movement.period_end || effectiveStart;
      if (!byGroup.has(key)) {
        const row = { ...movement, future_rr: futureFlag ? 1 : 0, amount: 0, ids: [], start_date: effectiveStart, end_date: effectiveEnd, action_date: movement.created_at || movement.movement_date };
        byGroup.set(key, row); grouped.push(row);
      }
      const row = byGroup.get(key);
      row.ids.push(Number(movement.id));
      row.amount += Number(movement.amount || 0);
      if (effectiveStart < row.start_date) row.start_date = effectiveStart;
      if (effectiveEnd > row.end_date) row.end_date = effectiveEnd;
      if (movement.created_at && (!row.action_date || movement.created_at < row.action_date)) row.action_date = movement.created_at;
    }
    state.recoveryGroupedRows = grouped;
    renderRecoveryDetailRows();
    $("recoveryDetail").hidden = false; $("recoveryDetail").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { message("recoveryMessage", error.message, "error"); }
}


function renderRecoveryDetailRows() {
  const displayReason = value => String(value || "").replace(/^Annulation repos récupérateur$/i, "Annulation repos");
  const direction = state.recoverySortDirection === "asc" ? 1 : -1;
  const rows = [...(state.recoveryGroupedRows || [])].sort((a, b) => {
    const startCompare = String(a.start_date || "").localeCompare(String(b.start_date || ""));
    if (startCompare) return startCompare * direction;
    return String(a.action_date || "").localeCompare(String(b.action_date || "")) * direction;
  });
  const canEdit = Boolean(state.data?.permission?.isCdu);
  const actionsHead = $("recoveryActionsHead");
  if (actionsHead) actionsHead.hidden = !canEdit;
  $("recoveryBody").innerHTML = rows.map(movement => {
    const actions = canEdit ? `<td><div class="recovery-row-actions"><button class="button compact role-cdu" data-edit-recovery="${movement.ids?.[0] || movement.id}" type="button">Modifier</button><button class="button compact role-cdu" data-delete-recovery="${(movement.ids || [movement.id]).join(',')}" type="button">Supprimer</button></div></td>` : "";
    const isFutureRR = Number(movement.future_rr || 0) === 1;
    const isNormalRR = !isFutureRR && String(movement.entry_service_code || "").toUpperCase() === "RR";
    const reason = isFutureRR ? `<span class="future-rr-badge">RR futurs demandés</span>` : esc(displayReason(movement.reason));
    const typeLabel = isFutureRR ? "À décompter" : (movement.movement_type === "credit" ? "Crédit" : "Débit");
    const rowClass = isFutureRR ? "future-rr-row" : (isNormalRR ? "normal-rr-row" : "");
    const amountClass = (isFutureRR || isNormalRR) ? "" : (Number(movement.amount) < 0 ? "fair-high" : "fair-low");
    return `<tr class="${rowClass}"><td class="recovery-action-date">${frDate(String(movement.action_date || "").slice(0, 10))}</td><td>${frDate(movement.start_date)}</td><td>${movement.end_date !== movement.start_date ? frDate(movement.end_date) : "—"}</td><td>${typeLabel}</td><td class="${amountClass}">${Number(movement.amount) > 0 ? "+" : ""}${number(movement.amount)}</td><td>${reason}</td><td>${esc(movement.comment || (isFutureRR ? "Demande enregistrée, hors compteur jusqu’à la clôture." : "—"))}</td><td>${esc(movement.created_by)}</td>${actions}</tr>`;
  }).join("") || `<tr><td colspan="${canEdit ? 9 : 8}" class="empty-state">Aucun mouvement enregistré.</td></tr>`;
  $("recoveryBody").querySelectorAll('[data-edit-recovery]').forEach(button => button.onclick = () => editRecoveryMovement(Number(button.dataset.editRecovery)));
  $("recoveryBody").querySelectorAll('[data-delete-recovery]').forEach(button => button.onclick = () => deleteRecoveryMovements(button.dataset.deleteRecovery.split(',').map(Number)));
  const button = $("sortRecoveryStart");
  if (button) {
    button.textContent = state.recoverySortDirection === "asc" ? "Date début ↑" : "Date début ↓";
    button.title = state.recoverySortDirection === "asc" ? "Tri du plus ancien au plus récent. Cliquer pour inverser." : "Tri du plus récent au plus ancien. Cliquer pour inverser.";
  }
}

async function editRecoveryMovement(id) {
  if (!state.data?.permission?.isCdu) return;
  const row = (state.recoveryGroupedRows || []).find(item => (item.ids || [item.id]).includes(id));
  if (!row) return;
  state.editingRecoveryId = id;
  $("movementType").value = row.movement_type || (Number(row.amount) < 0 ? "debit" : "credit");
  updateMovementReasons();
  $("movementAmount").value = Math.abs(Number(row.amount || 0.5));
  $("movementDate").value = row.start_date || row.movement_date;
  $("movementEndDate").value = row.end_date || row.period_end || row.start_date || row.movement_date;
  const reason = String(row.reason || "");
  if (![...$("movementReason").options].some(option => option.value === reason)) {
    $("movementReason").insertAdjacentHTML("beforeend", `<option value="${esc(reason)}">${esc(reason)}</option>`);
  }
  $("movementReason").value = reason;
  $("movementComment").value = row.comment || "";
  $("movementPeople").closest("fieldset").hidden = true;
  $("movementDialog").querySelector("h2").textContent = "Modifier le mouvement";
  $("saveMovement").textContent = "Enregistrer les modifications";
  $("movementDialog").showModal();
}

async function deleteRecoveryMovements(ids) {
  if (!state.data?.permission?.isCdu || !ids.length) return;
  if (!confirm(`Supprimer définitivement ${ids.length > 1 ? "ces mouvements" : "ce mouvement"} du détail des repos récupérateurs ?`)) return;
  try {
    await api("/cadres/service", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"delete-recovery-movements", ids }) });
    await loadPlanning({ preserveScroll:true });
    await loadRecoveryDetail(state.activeRecoveryPerson);
    message("recoveryMessage", "Mouvement supprimé.", "ok");
  } catch (error) { message("recoveryMessage", error.message, "error"); }
}

function populateMovementPeople(selectedIds = []) {
  const selected = new Set(selectedIds.map(Number));
  $("movementPeople").innerHTML = state.data.people.map(person => `<label class="movement-person"><input type="checkbox" value="${person.id}"${selected.has(Number(person.id)) ? " checked" : ""}><span>${esc([person.grade, person.display_name].filter(Boolean).join(" "))}</span></label>`).join("");
}

function updateMovementReasons() {
  const type = $("movementType").value;
  $("movementReason").innerHTML = (RECOVERY_REASONS[type] || [])
    .filter(reason => !["SPO", "SOP"].includes(String(reason).trim().toUpperCase()))
    .map(reason => `<option value="${esc(reason)}">${esc(reason)}</option>`).join("");
}

function openMovementDialog() {
  if (!state.activeRecoveryPerson) return;
  state.editingRecoveryId = null;
  $("movementPeople").closest("fieldset").hidden = false;
  $("movementDialog").querySelector("h2").textContent = "Ajouter un mouvement";
  $("saveMovement").textContent = "Enregistrer";
  populateMovementPeople([state.activeRecoveryPerson]);
  $("movementDate").value = iso(utcDate());
  $("movementEndDate").value = $("movementDate").value;
  $("movementComment").value = "";
  updateMovementReasons();
  $("movementDialog").showModal();
}

async function saveMovement(event) {
  event.preventDefault();
  try {
    let data;
    if (state.editingRecoveryId) {
      data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-recovery-movement", id: state.editingRecoveryId, movement_type: $("movementType").value, amount: Number($("movementAmount").value), movement_date: $("movementDate").value, period_end: $("movementEndDate").value, reason: $("movementReason").value, comment: $("movementComment").value }) });
    } else {
      const personIds = [...$("movementPeople").querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value));
      if (!personIds.length) return message("recoveryMessage", "Sélectionnez au moins un cadre.", "error");
      data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-movement", person_ids: personIds, movement_type: $("movementType").value, amount: Number($("movementAmount").value), movement_date: $("movementDate").value, period_end: $("movementEndDate").value, reason: $("movementReason").value, comment: $("movementComment").value }) });
    }
    const wasEditing = Boolean(state.editingRecoveryId);
    state.editingRecoveryId = null;
    $("movementDialog").close(); $("movementComment").value = "";
    await refreshCounters();
    if (state.activeRecoveryPerson) await loadRecoveryDetail(state.activeRecoveryPerson);
    message("recoveryMessage", wasEditing ? "Mouvement modifié." : `Mouvement enregistré pour ${data.created} cadre${data.created > 1 ? "s" : ""}.`, "ok");
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


function monthBounds(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) throw new Error("Choisissez un mois valide.");
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, month, 1, 12));
  const end = new Date(Date.UTC(year, month + 1, 0, 12));
  return { start, end };
}

function monthlyImageRows(data) {
  const pelotons = data.pelotons.map(key => ({ targetType: "peloton", targetKey: key, label: key }));
  const people = data.people.map(person => ({ targetType: "person", targetKey: String(person.id), label: [person.grade, planningSurname(person)].filter(Boolean).join(" ") }));
  return [...pelotons, ...people];
}

function fitCanvasText(ctx, text, maxWidth) {
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let short = value;
  while (short.length > 1 && ctx.measureText(short + "…").width > maxWidth) short = short.slice(0, -1);
  return short + "…";
}

async function saveMonthAsImage() {
  let bounds;
  try { bounds = monthBounds($("monthImageMonth").value); }
  catch (error) { message("monthImageMessage", error.message, "error"); return; }
  message("monthImageMessage", "Génération de l’image du mois…", "info");
  try {
    const data = await api(`/cadres/service?action=bootstrap&start=${iso(bounds.start)}&end=${iso(bounds.end)}`);
    const rows = monthlyImageRows(data);
    const days = daysBetween(bounds.start, bounds.end);
    const cellW = 40, rowH = 30, labelW = 205, titleH = 54, dayH = 30, slotH = 22;
    const logicalW = labelW + days.length * cellW * 2;
    const logicalH = titleH + dayH + slotH + rows.length * rowH + 18;
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = logicalW * scale; canvas.height = logicalH * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#11171b"; ctx.fillRect(0, 0, logicalW, logicalH);
    ctx.fillStyle = "#eef4f6"; ctx.font = "700 20px Arial, sans-serif";
    ctx.fillText(`CI6 CONNECT — TABLEAU DE SERVICE — ${bounds.start.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase()}`, 14, 32);
    ctx.font = "600 11px Arial, sans-serif";
    ctx.fillStyle = "#c7d0d5"; ctx.fillText("6e compagnie d’instruction", 14, 48);

    const entries = new Map(data.entries.map(entry => [entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry]));
    const types = new Map(data.serviceTypes.map(type => [type.code, type]));
    let x = labelW;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const day of days) {
      const weekend = [0, 6].includes(day.getUTCDay()) || !!holidayFor(day);
      ctx.fillStyle = weekend ? "#222a2f" : "#182026";
      ctx.fillRect(x, titleH, cellW * 2, dayH + slotH);
      ctx.strokeStyle = "#526068"; ctx.strokeRect(x, titleH, cellW * 2, dayH + slotH);
      ctx.fillStyle = "#f4f7f8"; ctx.font = "700 10px Arial, sans-serif";
      ctx.fillText(day.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", timeZone: "UTC" }), x + cellW, titleH + 14);
      ctx.font = "600 9px Arial, sans-serif"; ctx.fillStyle = "#aeb9bf";
      ctx.fillText("M", x + cellW / 2, titleH + dayH + slotH / 2);
      ctx.fillText("N", x + cellW + cellW / 2, titleH + dayH + slotH / 2);
      x += cellW * 2;
    }
    ctx.textAlign = "left";
    rows.forEach((row, rowIndex) => {
      const y = titleH + dayH + slotH + rowIndex * rowH;
      ctx.fillStyle = row.targetType === "peloton" ? "#252f35" : "#171e22";
      ctx.fillRect(0, y, labelW, rowH);
      ctx.strokeStyle = "#445159"; ctx.strokeRect(0, y, labelW, rowH);
      ctx.fillStyle = "#f2f5f6"; ctx.font = row.targetType === "peloton" ? "700 11px Arial, sans-serif" : "600 10px Arial, sans-serif";
      ctx.textBaseline = "middle"; ctx.fillText(fitCanvasText(ctx, row.label, labelW - 16), 8, y + rowH / 2);
      days.forEach((day, dayIndex) => {
        ["M", "N"].forEach((slot, slotIndex) => {
          const xx = labelW + dayIndex * cellW * 2 + slotIndex * cellW;
          const entry = entries.get(entryKey(row.targetType, row.targetKey, iso(day), slot));
          const weekend = [0, 6].includes(day.getUTCDay()) || !!holidayFor(day);
          ctx.fillStyle = weekend ? "#1d252a" : "#141b1f";
          if (entry) {
            const type = types.get(entry.service_code);
            ctx.fillStyle = entry.custom_color || type?.color || "#48545b";
          }
          ctx.fillRect(xx, y, cellW, rowH);
          ctx.strokeStyle = "#39464d"; ctx.strokeRect(xx, y, cellW, rowH);
          if (entry) {
            const type = types.get(entry.service_code);
            const label = entryDisplayLabel(entry);
            ctx.fillStyle = type?.textColor || contrastText(entry.custom_color || type?.color || "#48545b");
            ctx.font = "700 8px Arial, sans-serif"; ctx.textAlign = "center";
            ctx.fillText(fitCanvasText(ctx, label, cellW - 4), xx + cellW / 2, y + rowH / 2);
            ctx.textAlign = "left";
          }
        });
      });
    });
    canvas.toBlob(blob => {
      if (!blob) { message("monthImageMessage", "Impossible de créer l’image.", "error"); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url;
      link.download = `tableau-service-${iso(bounds.start).slice(0, 7)}.png`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      message("monthImageMessage", "Image PNG enregistrée sur le PC.", "ok");
    }, "image/png");
  } catch (error) { message("monthImageMessage", error.message, "error"); }
}

function openMonthImageDialog() {
  const now = utcDate();
  $("monthImageMonth").value = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  message("monthImageMessage", "", "info");
  $("monthImageDialog").showModal();
}

function openPurgeDialog() {
  if (!state.data?.permission?.isCdu) return;
  $("purgeStart").value = iso(monday(utcDate()));
  $("purgeEnd").value = iso(endOfWeek(utcDate()));
  $("purgeConfirmText").value = "";
  $("purgeReason").value = "Reprise totale du service";
  $("purgeServiceEntries").checked = true;
  $("purgeRecoveryLedger").checked = true;
  $("purgeRecoveryLedger").disabled = true;
  const recoveryRequired = $("purgeRecoveryRequired");
  if (recoveryRequired) recoveryRequired.hidden = false;
  message("purgeMessage", "", "info");
  $("purgeDialog").showModal();
}

function syncPurgeScope() {
  const purgeService = $("purgeServiceEntries").checked;
  const recovery = $("purgeRecoveryLedger");
  const required = $("purgeRecoveryRequired");
  if (purgeService) {
    recovery.checked = true;
    recovery.disabled = true;
    if (required) required.hidden = false;
  } else {
    recovery.disabled = false;
    if (required) required.hidden = true;
  }
}

async function purgePlanningPeriod(event) {
  event.preventDefault();
  const start = $("purgeStart").value, end = $("purgeEnd").value;
  const reason = $("purgeReason").value.trim();
  const purgeService = $("purgeServiceEntries").checked;
  const purgeRecovery = purgeService ? true : $("purgeRecoveryLedger").checked;
  if (!start || !end || start > end) return message("purgeMessage", "Période invalide.", "error");
  if (!purgeService && !purgeRecovery) return message("purgeMessage", "Choisissez au moins un élément à purger.", "error");
  if (!reason) return message("purgeMessage", "Indiquez le motif de la purge.", "error");
  if ($("purgeConfirmText").value.trim().toUpperCase() !== "PURGER") return message("purgeMessage", "Saisissez PURGER pour confirmer.", "error");
  const targets = [purgeService ? "les cases du service" : "", purgeRecovery ? "les mouvements de repos récupérateurs" : ""].filter(Boolean).join(" et ");
  if (!confirm(`Supprimer définitivement ${targets} du ${frDate(start)} au ${frDate(end)} ?\n\nCette opération est réservée au CDU et ne peut pas être annulée.`)) return;
  $("executePurge").disabled = true;
  message("purgeMessage", "Purge en cours…", "info");
  try {
    const data = await api("/cadres/service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "purge-period", start, end, reason, purge_service: purgeService, purge_recovery: purgeRecovery }) });
    $("purgeDialog").close();
    await loadPlanning({ preserveScroll: false });
    message("planningMessage", `${data.deleted || 0} case${data.deleted === 1 ? "" : "s"} supprimée${data.deleted === 1 ? "" : "s"}. ${data.recovery_deleted || 0} mouvement${data.recovery_deleted === 1 ? "" : "s"} de repos purgé${data.recovery_deleted === 1 ? "" : "s"}. ${data.reversed || 0} contrepassation${data.reversed === 1 ? "" : "s"}.`, "ok");
  } catch (error) { message("purgeMessage", error.message, "error"); }
  finally { $("executePurge").disabled = false; }
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


function planningPrintSettings() {
  const rawStart = $("planningPrintStart").value;
  if (!rawStart) throw new Error("Choisissez la première semaine à imprimer.");
  const start = monday(utcDate(rawStart));
  const end = addDays(start, 27);
  $("planningPrintStart").value = iso(start);
  return { start, end };
}

function printEntryMap(data) {
  return new Map(data.entries.map(entry => [entryKey(entry.target_type, entry.target_key, entry.service_date, entry.slot), entry]));
}

function planningPrintRows(data) {
  const rows = data.people.map(person => ({
    name: [person.grade, planningSurname(person)].filter(Boolean).join(" "),
    targetType: "person",
    targetKey: String(person.id),
    peloton: false
  }));
  ["P1", "P2", "P3"].forEach(peloton => rows.push({ name: `ACTIVITÉS ${peloton}`, targetType: "peloton", targetKey: peloton, peloton: true }));
  return rows;
}

function planningPrintWeek(data, start, weekIndex) {
  const days = daysBetween(start, addDays(start, 6));
  const entries = printEntryMap(data);
  const rows = planningPrintRows(data);
  const headerDays = days.map(day => `<th colspan="2" class="print-day${[0,6].includes(day.getUTCDay()) || holidayFor(day) ? " weekend" : ""}">${esc(day.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }))}<div><span>M</span><span>N</span></div></th>`).join("");
  const body = rows.map(row => {
    const cells = days.flatMap(day => ["M", "N"].map(slot => {
      const entry = entries.get(entryKey(row.targetType, row.targetKey, iso(day), slot));
      const type = entry ? data.serviceTypes.find(item => item.code === entry.service_code) : null;
      const label = entryDisplayLabel(entry);
      const color = entry?.custom_color || type?.color || "";
      const text = entry?.custom_color ? contrastText(entry.custom_color) : type?.textColor || "#111";
      return `<td class="print-slot${entry ? " has-entry" : ""}"${entry ? ` style="background:${esc(color)};color:${esc(text)}"` : ""}>${esc(label)}</td>`;
    })).join("");
    return `<tr class="${row.peloton ? "print-peloton" : ""}"><th>${esc(row.name)}</th>${cells}</tr>`;
  }).join("");
  return `<section class="planning-print-week"><header><h1>6<sup>e</sup> compagnie d’instruction — Tableau de service</h1><p>Semaine ${weekIndex + 1}/4 · du ${frDate(start)} au ${frDate(addDays(start, 6))}</p></header><table><thead><tr><th class="print-name">Cadres</th>${headerDays}</tr></thead><tbody>${body}</tbody></table></section>`;
}

function planningPrintDocument(exportData) {
  return Array.from({ length: 4 }, (_, index) => planningPrintWeek(exportData.data, addDays(exportData.start, index * 7), index)).join("");
}

async function refreshPlanningPrint() {
  let settings;
  try { settings = planningPrintSettings(); }
  catch (error) { message("planningPrintMessage", error.message, "error"); return null; }
  $("planningPrintPreview").innerHTML = '<div class="loading">Préparation de l’aperçu…</div>';
  message("planningPrintMessage", "", "info");
  try {
    const data = await api(`/cadres/service?action=bootstrap&start=${iso(settings.start)}&end=${iso(settings.end)}`);
    state.planningPrintExport = { ...settings, data };
    $("planningPrintPreview").innerHTML = planningPrintDocument(state.planningPrintExport);
    return state.planningPrintExport;
  } catch (error) {
    $("planningPrintPreview").innerHTML = "";
    message("planningPrintMessage", error.message, "error");
    return null;
  }
}

function currentPlanningScreenDocument() {
  const viewport = $("planningViewport");
  const grid = viewport?.querySelector(".planning-grid");
  if (!grid) throw new Error("Le planning n’est pas encore chargé.");
  const label = $("periodLabel")?.textContent?.trim() || "Période affichée";
  return `
    <section class="planning-screen-print">
      <header class="print-header">
        <h1>6<sup>e</sup> compagnie d’instruction — Tableau de service</h1>
        <p>${esc(label)} — impression conforme à l’écran</p>
      </header>
      <div class="planning-viewport">${viewport.innerHTML}</div>
    </section>`;
}

async function openPlanningPrint() {
  await printPlanning4Weeks();
}

async function printPlanning4Weeks() {
  try {
    $("planningPrintSheet").innerHTML = currentPlanningScreenDocument();
    document.body.classList.add("printing-planning-screen");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-planning-screen"), 500);
  } catch (error) {
    message("planningMessage", error.message, "error");
  }
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
$("showFullMonth").onclick = () => {
  const value = $("monthPicker").value;
  if (!/^\d{4}-\d{2}$/.test(value)) {
    message("planningMessage", "Choisissez un mois et une année.", "error");
    return;
  }
  state.mode = "month";
  state.monthValue = value;
  state.offsetWeeks = 0;
  loadPlanning();
};
$("previousPeriod").onclick = () => {
  if (state.mode === "month" && /^\d{4}-\d{2}$/.test(state.monthValue)) {
    const [year, month] = state.monthValue.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 2, 1, 12));
    state.monthValue = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  } else {
    state.mode = "default";
    state.offsetWeeks -= 1;
  }
  loadPlanning();
};
$("nextPeriod").onclick = () => {
  if (state.mode === "month" && /^\d{4}-\d{2}$/.test(state.monthValue)) {
    const [year, month] = state.monthValue.split("-").map(Number);
    const d = new Date(Date.UTC(year, month, 1, 12));
    state.monthValue = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  } else {
    state.mode = "default";
    state.offsetWeeks += 1;
  }
  loadPlanning();
};
$("today").onclick = () => { state.mode = "default"; state.offsetWeeks = 0; loadPlanning(); };
$("modifySelection").onclick = modifySelection;
$("deleteSelection").onclick = deleteSelection;
$("saveEntryDetails").onclick = saveEntryDetails;
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
$("studentService").onclick = openStudentService;
$("previewPlanningPrint").onclick = refreshPlanningPrint;
$("planningPrintStart").onchange = refreshPlanningPrint;
$("launchPlanningPrint").onclick = printPlanning4Weeks;
$("closePlanningPrint").onclick = () => $("planningPrintDialog").close();
$("cancelPlanningPrint").onclick = () => $("planningPrintDialog").close();
$("previewStudentService").onclick = refreshStudentService;
$("studentServiceStart").onchange = refreshStudentService;
$("studentServiceWeeks").onchange = refreshStudentService;
$("exportStudentService").onclick = exportStudentService;
$("printStudentService").onclick = printStudentService;
$("closeStudentService").onclick = () => $("studentServiceDialog").close();
$("cancelStudentService").onclick = () => $("studentServiceDialog").close();
$("movementDate").value = iso(utcDate());
$("movementEndDate").value = $("movementDate").value;
$("movementType").onchange = updateMovementReasons;
$("movementDate").onchange = () => { if (!$("movementEndDate").value || $("movementEndDate").value < $("movementDate").value) $("movementEndDate").value = $("movementDate").value; };
updateMovementReasons();
$("newMovement").onclick = openMovementDialog;
$("movementForm").addEventListener("submit", saveMovement);
$("cancelMovement").onclick = () => { state.editingRecoveryId = null; $("movementDialog").close(); };
$("closeMovementDialog").onclick = () => { state.editingRecoveryId = null; $("movementDialog").close(); };
$("closeRecovery").onclick = () => { $("recoveryDetail").hidden = true; state.activeRecoveryPerson = null; };
$("sortRecoveryStart")?.addEventListener("click", () => { state.recoverySortDirection = state.recoverySortDirection === "asc" ? "desc" : "asc"; renderRecoveryDetailRows(); });
$("managePeople").onclick = () => {
  if (!state.data?.permission?.isCdu) return;
  renderPeopleEditor();
  $("peopleDialog").showModal();
};
$("addPerson").onclick = addPersonEditorRow;
$("saveAllPeople").onclick = saveAllPeople;
$("saveMonthImage").onclick = openMonthImageDialog;
$("generateMonthImage").onclick = saveMonthAsImage;
$("closeMonthImage").onclick = () => $("monthImageDialog").close();
$("cancelMonthImage").onclick = () => $("monthImageDialog").close();
$("purgePlanning").onclick = openPurgeDialog;
if ($("savePermanenceCounterStart")) $("savePermanenceCounterStart").onclick = savePermanenceCounterStart;
if ($("saveServiceCompletedThrough")) $("saveServiceCompletedThrough").onclick = saveServiceCompletedThrough;
$("purgeForm").addEventListener("submit", purgePlanningPeriod);
$("purgeServiceEntries").addEventListener("change", syncPurgeScope);
$("closePurgeDialog").onclick = () => $("purgeDialog").close();
$("cancelPurge").onclick = () => $("purgeDialog").close();
if ($("sopAddYear")) $("sopAddYear").onclick = addSopYear;
if ($("sopYearInput")) $("sopYearInput").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addSopYear(); } });

const currentMonth = utcDate();
state.monthValue = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, "0")}`;
if ($("monthPicker")) $("monthPicker").value = state.monthValue;
loadPlanning();
