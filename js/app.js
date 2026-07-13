/* ADT Trainer – App-Logik (Vanilla JS, keine Abhängigkeiten, offline-fähig). */
"use strict";

/* ------------------------------------------------------------------ *
 * 0) Datenvalidierung – schützt vor fehlerhaften Fragen-Einträgen
 * ------------------------------------------------------------------ */
const DATA_OK = (() => {
  if (typeof QUESTIONS === "undefined" || !Array.isArray(QUESTIONS)) return false;
  const ids = new Set();
  for (const q of QUESTIONS) {
    if (!q.id || ids.has(q.id)) { console.error("Frage-Fehler (ID fehlt/doppelt):", q); return false; }
    ids.add(q.id);
    if (!TOPICS[q.topic]) { console.error("Frage-Fehler (unbekanntes Thema):", q.id, q.topic); return false; }
    if (!Array.isArray(q.options) || q.options.length < 2) { console.error("Frage-Fehler (Optionen):", q.id); return false; }
    if (!Array.isArray(q.correct) || q.correct.length < 1) { console.error("Frage-Fehler (keine richtige Antwort):", q.id); return false; }
    for (const c of q.correct) if (c < 0 || c >= q.options.length) { console.error("Frage-Fehler (correct-Index außerhalb):", q.id); return false; }
    if (q.type === "single" && q.correct.length !== 1) { console.error("Frage-Fehler (single mit !=1 richtig):", q.id); return false; }
  }
  return true;
})();

/* ------------------------------------------------------------------ *
 * 1) Persistenter Zustand (localStorage, robust gegen Defekte)
 * ------------------------------------------------------------------ */
const STORE_KEY = "adt_trainer_state_v1";   // NIE umbenennen – siehe workbook.md („Speicherstände sind heilig")
const SCHEMA_VERSION = 1;                     // bei Datenmodell-Änderungen erhöhen UND Migration ergänzen
const DEFAULT_STATE = {
  schemaVersion: SCHEMA_VERSION,
  xp: 0,
  streak: 0,
  lastActiveDay: null,          // "YYYY-MM-DD"
  totalAnswered: 0,
  totalCorrect: 0,
  perQuestion: {},              // id -> { seen, correct, wrong, lastResult }
  badges: {},                   // badgeId -> ISO-Datum
  examsPassed: 0,
  bestExamPct: 0,
};

// Migrations-Gerüst: MIGRATIONS[n] hebt einen Stand von Version n-1 auf n.
// So überleben Lernstände künftige Datenmodell-Änderungen (statt sie zu verwerfen).
const MIGRATIONS = {
  // Beispiel für die Zukunft:
  // 2: (s) => { s.neuesFeld = 0; return s; },
};
function migrate(state) {
  let v = Number(state && state.schemaVersion) || 1;
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS[v + 1];
    if (typeof m === "function") {
      try { state = m(state) || state; }
      catch (e) { console.warn("Migration " + (v + 1) + " fehlgeschlagen", e); }
    }
    v++;
  }
  if (state && typeof state === "object") state.schemaVersion = SCHEMA_VERSION;
  return state;
}

// Defensiv säubern: ein teilweise defekter Stand darf die App nie brechen.
function sanitizeState(raw) {
  const s = { ...DEFAULT_STATE, ...(raw && typeof raw === "object" ? raw : {}) };
  const clampInt = (v, min, max) => {
    let n = Math.floor(Number(v)); if (!isFinite(n)) n = min;
    n = Math.max(min, n); if (max != null) n = Math.min(max, n); return n;
  };
  s.schemaVersion = SCHEMA_VERSION;
  s.xp = clampInt(s.xp, 0);
  s.streak = clampInt(s.streak, 0);
  s.totalAnswered = clampInt(s.totalAnswered, 0);
  s.totalCorrect = clampInt(s.totalCorrect, 0);
  s.examsPassed = clampInt(s.examsPassed, 0);
  s.bestExamPct = clampInt(s.bestExamPct, 0, 100);
  s.lastActiveDay = typeof s.lastActiveDay === "string" ? s.lastActiveDay : null;
  s.perQuestion = (s.perQuestion && typeof s.perQuestion === "object") ? s.perQuestion : {};
  s.badges = (s.badges && typeof s.badges === "object") ? s.badges : {};
  for (const id of Object.keys(s.perQuestion)) {
    const p = s.perQuestion[id] || {};
    s.perQuestion[id] = {
      seen: clampInt(p.seen, 0),
      correct: clampInt(p.correct, 0),
      wrong: clampInt(p.wrong, 0),
      lastResult: (p.lastResult === "correct" || p.lastResult === "wrong") ? p.lastResult : null,
    };
  }
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return sanitizeState(migrate(JSON.parse(raw)));
  } catch (e) {
    console.warn("State beschädigt, setze zurück.", e);
    return { ...DEFAULT_STATE };
  }
}
let S = loadState();
let saveTimer = null;
function persistLocal() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); return true; }
  catch (e) { console.warn("Speichern fehlgeschlagen (localStorage voll?)", e); return false; }
}
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { persistLocal(); scheduleSync(); }, 120);
}
// Ausstehende Speicherung sofort schreiben – z. B. wenn die App geschlossen oder
// in den Hintergrund geschickt wird (auf iOS laufen Timer dann evtl. nicht mehr).
function flushSave() { clearTimeout(saveTimer); persistLocal(); }

/* ---- Cloud-Sync-Anbindung (optional, siehe js/sync.js) ---- */
let syncTimer = null;
function syncEnabled() { return !!(window.ADTSync && ADTSync.isConfigured() && ADTSync.getCode()); }
function scheduleSync() {
  if (!syncEnabled()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => runSync(), 3000);
}
function getLocalState() { return S; }
function setLocalState(merged) {
  S = sanitizeState(migrate(merged));
  persistLocal();
}
async function runSync(opts) {
  if (!window.ADTSync) return { ok: false };
  const res = await ADTSync.syncNow(getLocalState, setLocalState, opts || {});
  refreshAfterSync();
  return res;
}
function refreshAfterSync() {
  if (streakEl) streakEl.textContent = "🔥 " + S.streak;
  if (VIEW === "home") renderHome();
  else if (VIEW === "settings") renderSettings();
}

/* ------------------------------------------------------------------ *
 * 2) Hilfen: Datum, Level, XP, Streak
 * ------------------------------------------------------------------ */
function todayStr(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00"), db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}
// Level-Kurve: benötigte Gesamt-XP für Level n = 50 * n * (n-1)  (steigend)
function levelForXp(xp) {
  let lvl = 1;
  while (50 * (lvl + 1) * lvl <= xp) lvl++;
  return lvl;
}
function xpFloor(lvl) { return 50 * lvl * (lvl - 1); }
function levelTitle(lvl) {
  const t = ["Neuling", "Einsteiger", "Kodier-Lehrling", "Doku-Talent", "Registrierer",
    "TNM-Kenner", "ICD-O-Profi", "Onko-Experte", "Register-Meister", "Tumordoku-Ass"];
  return t[Math.min(lvl - 1, t.length - 1)];
}

function touchStreak() {
  const t = todayStr();
  if (S.lastActiveDay === t) return;
  if (S.lastActiveDay && daysBetween(S.lastActiveDay, t) === 1) S.streak += 1;
  else S.streak = 1;
  S.lastActiveDay = t;
  saveState();
}

/* ------------------------------------------------------------------ *
 * 3) Erfolge / Badges
 * ------------------------------------------------------------------ */
const BADGES = [
  { id: "first",     ic: "🌱", name: "Erster Schritt",   desc: "Erste Frage beantwortet",           test: () => S.totalAnswered >= 1 },
  { id: "ten",       ic: "🔟", name: "Warmgelaufen",      desc: "10 Fragen beantwortet",              test: () => S.totalAnswered >= 10 },
  { id: "fifty",     ic: "🏅", name: "Fleißig",           desc: "50 Fragen beantwortet",              test: () => S.totalAnswered >= 50 },
  { id: "hundred",   ic: "💯", name: "Durchstarter",      desc: "100 Fragen beantwortet",             test: () => S.totalAnswered >= 100 },
  { id: "streak3",   ic: "🔥", name: "Dranbleiben",       desc: "3 Tage in Folge geübt",              test: () => S.streak >= 3 },
  { id: "streak7",   ic: "⚡", name: "Wochenserie",       desc: "7 Tage in Folge geübt",              test: () => S.streak >= 7 },
  { id: "exam",      ic: "🎓", name: "Prüfung bestanden", desc: "Prüfungssimulation ≥ 50 %",          test: () => S.examsPassed >= 1 },
  { id: "exam90",    ic: "👑", name: "Bravour",           desc: "Prüfungssimulation ≥ 90 %",          test: () => S.bestExamPct >= 90 },
  { id: "sharp",     ic: "🎯", name: "Treffsicher",       desc: "80 % Gesamt-Trefferquote (ab 30 Fragen)", test: () => S.totalAnswered >= 30 && S.totalCorrect / S.totalAnswered >= 0.8 },
  { id: "master",    ic: "🧠", name: "Themen-Meister",    desc: "Ein Thema komplett gemeistert",      test: () => Object.values(TOPICS).some((_, i) => topicMastered(Object.keys(TOPICS)[i])) },
];
function topicMastered(topicKey) {
  const qs = QUESTIONS.filter(q => q.topic === topicKey);
  if (!qs.length) return false;
  return qs.every(q => { const p = S.perQuestion[q.id]; return p && p.correct >= 1; });
}
function checkBadges() {
  const newly = [];
  for (const b of BADGES) {
    if (!S.badges[b.id] && b.test()) { S.badges[b.id] = new Date().toISOString(); newly.push(b); }
  }
  if (newly.length) saveState();
  return newly;
}

/* ------------------------------------------------------------------ *
 * 4) Statistik-Hilfen
 * ------------------------------------------------------------------ */
function topicStats(topicKey) {
  const qs = QUESTIONS.filter(q => q.topic === topicKey);
  let mastered = 0;
  for (const q of qs) { const p = S.perQuestion[q.id]; if (p && p.correct >= 1) mastered++; }
  return { total: qs.length, mastered, pct: qs.length ? Math.round(mastered / qs.length * 100) : 0 };
}
function overallAccuracy() {
  return S.totalAnswered ? Math.round(S.totalCorrect / S.totalAnswered * 100) : 0;
}
// Fragen, die noch nie richtig beantwortet wurden oder zuletzt falsch waren
function weakQuestions() {
  return QUESTIONS.filter(q => { const p = S.perQuestion[q.id]; return !p || p.correct === 0 || p.lastResult === "wrong"; });
}

/* ------------------------------------------------------------------ *
 * 5) Quiz-Engine
 * ------------------------------------------------------------------ */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Session: { questions:[...], idx, mode, answers:{}, order:[...perQuestion shuffled option order] }
let SESSION = null;

function buildSession(mode, opts = {}) {
  let pool;
  if (mode === "topic") pool = QUESTIONS.filter(q => q.topic === opts.topic);
  else if (mode === "weak") pool = weakQuestions();
  else if (mode === "exam") pool = QUESTIONS;
  else pool = QUESTIONS; // "mixed"

  let questions = shuffle(pool);
  const limit = opts.limit || (mode === "exam" ? Math.min(30, questions.length) : Math.min(15, questions.length));
  questions = questions.slice(0, limit);

  // Antwort-Optionen pro Frage mischen (Reihenfolge merken, um correct-Indizes umzurechnen)
  const optionOrders = questions.map(q => shuffle(q.options.map((_, i) => i)));

  SESSION = {
    mode, topic: opts.topic || null,
    questions, optionOrders,
    idx: 0,
    picks: questions.map(() => new Set()),   // gewählte (originale) Option-Indizes
    checked: questions.map(() => false),
    correctFlags: questions.map(() => null),
  };
}

function currentQ() { return SESSION.questions[SESSION.idx]; }

function togglePick(origIdx) {
  const q = currentQ();
  if (SESSION.checked[SESSION.idx]) return;
  const set = SESSION.picks[SESSION.idx];
  if (q.type === "single") { set.clear(); set.add(origIdx); }
  else { set.has(origIdx) ? set.delete(origIdx) : set.add(origIdx); }
  renderQuiz();
}

function checkCurrent() {
  const i = SESSION.idx, q = currentQ();
  if (SESSION.checked[i]) return;
  const picks = SESSION.picks[i];
  const correct = new Set(q.correct);
  // Alles-oder-nichts (Prüfungsregel): genau die richtigen Antworten getroffen
  let ok = picks.size === correct.size;
  if (ok) for (const c of correct) if (!picks.has(c)) { ok = false; break; }
  SESSION.checked[i] = true;
  SESSION.correctFlags[i] = ok;

  // Fortschritt aktualisieren
  const p = S.perQuestion[q.id] || { seen: 0, correct: 0, wrong: 0, lastResult: null };
  p.seen += 1;
  if (ok) { p.correct += 1; p.lastResult = "correct"; } else { p.wrong += 1; p.lastResult = "wrong"; }
  S.perQuestion[q.id] = p;
  S.totalAnswered += 1;
  if (ok) S.totalCorrect += 1;

  // XP: richtig = 10 + Schwierigkeitsbonus; falsch = 2 (fürs Dranbleiben)
  const gained = ok ? (10 + (q.difficulty - 1) * 5) : 2;
  S.xp += gained;
  touchStreak();
  saveState();

  const newBadges = checkBadges();
  renderQuiz();
  if (ok) toast(`✅ Richtig! +${gained} XP`); else toast(`+${gained} XP fürs Üben`);
  newBadges.forEach((b, k) => setTimeout(() => toast(`${b.ic} Erfolg: ${b.name}`), 900 + k * 1400));
}

function nextQ() {
  if (SESSION.idx < SESSION.questions.length - 1) { SESSION.idx++; renderQuiz(); window.scrollTo(0, 0); }
  else finishSession();
}

function finishSession() {
  const total = SESSION.questions.length;
  const right = SESSION.correctFlags.filter(Boolean).length;
  const pct = total ? Math.round(right / total * 100) : 0;
  if (SESSION.mode === "exam") {
    if (pct >= 50) S.examsPassed += 1;
    if (pct > S.bestExamPct) S.bestExamPct = pct;
    saveState();
    checkBadges();
  }
  renderResult(right, total, pct);
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ *
 * 6) UI-Rendering
 * ------------------------------------------------------------------ */
const app = document.getElementById("app");
const actionbar = document.getElementById("actionbar");
const streakEl = document.getElementById("streakVal");

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function updateAppbar(view) {
  const back = document.getElementById("backBtn");
  back.classList.toggle("hidden", view === "home");
  streakEl.textContent = "🔥 " + S.streak;
}

/* ---- Home ---- */
function renderHome() {
  updateAppbar("home");
  actionbar.classList.add("hidden");
  const lvl = levelForXp(S.xp);
  const floor = xpFloor(lvl), ceil = xpFloor(lvl + 1);
  const into = S.xp - floor, span = ceil - floor;
  const pctBar = Math.round(into / span * 100);
  const acc = overallAccuracy();
  const weak = weakQuestions().length;

  const standalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  const installTip = standalone ? "" : `
    <div class="install-tip">
      <span>📲</span>
      <div><b>Als App installieren:</b> in Safari unten auf <b>Teilen</b> tippen → <b>„Zum Home-Bildschirm"</b>.
      Danach funktioniert alles offline.</div>
    </div>`;

  app.innerHTML = `
    ${installTip}
    <div class="level-card">
      <div class="row"><span class="lvl">Level ${lvl}</span><span class="xp">${into} / ${span} XP</span></div>
      <h2>${esc(levelTitle(lvl))}</h2>
      <div class="xp-bar"><span style="width:${pctBar}%"></span></div>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="num">${S.totalAnswered}</div><div class="lbl">beantwortet</div></div>
      <div class="stat"><div class="num">${acc}%</div><div class="lbl">Trefferquote</div></div>
      <div class="stat"><div class="num">${S.xp}</div><div class="lbl">XP gesamt</div></div>
    </div>

    <div class="section-title">Üben</div>
    <button class="mode-btn" data-act="mixed"><span class="emoji">🎲</span><span class="txt"><b>Gemischtes Training</b><p>Zufällige Fragen aus allen Themen</p></span><span class="chev">›</span></button>
    <button class="mode-btn" data-act="topics"><span class="emoji">📚</span><span class="txt"><b>Nach Thema lernen</b><p>Gezielt einzelne Themengebiete üben</p></span><span class="chev">›</span></button>
    <button class="mode-btn" data-act="weak" ${weak ? "" : "disabled"}><span class="emoji">🩹</span><span class="txt"><b>Schwachstellen wiederholen</b><p>${weak ? weak + " Fragen zum Auffrischen" : "Super – aktuell keine offenen Fragen"}</p></span><span class="chev">›</span></button>

    <div class="section-title">Prüfung</div>
    <button class="mode-btn" data-act="exam"><span class="emoji">🎓</span><span class="txt"><b>Prüfungssimulation</b><p>${Math.min(30, QUESTIONS.length)} Fragen · bestanden ab 50 %</p></span><span class="chev">›</span></button>

    <div class="section-title">Fortschritt</div>
    <button class="mode-btn" data-act="badges"><span class="emoji">🏆</span><span class="txt"><b>Erfolge</b><p>${Object.keys(S.badges).length} / ${BADGES.length} freigeschaltet</p></span><span class="chev">›</span></button>
    <button class="mode-btn" data-act="settings"><span class="emoji">☁️</span><span class="txt"><b>Geräte-Sync</b><p>${syncSubtitle()}</p></span><span class="chev">›</span></button>

    <p class="muted center" style="margin-top:24px">${QUESTIONS.length} Fragen · ${Object.keys(TOPICS).length} Themen<br>
    <span class="link" data-act="reset">Fortschritt zurücksetzen</span></p>
  `;

  app.querySelectorAll("[data-act]").forEach(el => el.addEventListener("click", () => {
    const a = el.dataset.act;
    if (a === "mixed") { buildSession("mixed"); go("quiz"); }
    else if (a === "topics") go("topics");
    else if (a === "weak") { buildSession("weak"); go("quiz"); }
    else if (a === "exam") { buildSession("exam"); go("quiz"); }
    else if (a === "badges") go("badges");
    else if (a === "settings") go("settings");
    else if (a === "reset") confirmReset();
  }));
}

function syncSubtitle() {
  if (!window.ADTSync || !ADTSync.isConfigured()) return "Noch nicht eingerichtet";
  if (!ADTSync.getCode()) return "Einrichten – auf allen Geräten weiterlernen";
  const last = ADTSync.getLastSynced();
  return last ? "Aktiv · zuletzt " + new Date(last).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Aktiv";
}

/* ---- Einstellungen / Geräte-Sync ---- */
function renderSettings() {
  updateAppbar("settings");
  actionbar.classList.add("hidden");
  const hasSync = !!window.ADTSync;
  const configured = hasSync && ADTSync.isConfigured();
  const code = hasSync ? ADTSync.getCode() : null;
  const last = hasSync ? ADTSync.getLastSynced() : null;
  const lastTxt = last ? new Date(last).toLocaleString("de-DE") : "noch nie";

  let body;
  if (!configured) {
    body = `<div class="install-tip"><span>☁️</span><div>
      <b>Cloud-Sync ist noch nicht eingerichtet.</b><br>
      Damit der Fortschritt auf allen Geräten gleich ist, muss einmalig ein kostenloses
      Supabase-Projekt verbunden werden (zwei Werte in <b>config.js</b>).
      Schritt-für-Schritt-Anleitung: <b>README.md</b> → „Geräteübergreifende Synchronisation".</div></div>
      <p class="muted center" style="margin-top:16px">Bis dahin funktioniert alles ganz normal – nur lokal auf diesem Gerät.</p>`;
  } else if (!code) {
    body = `
      <p class="muted">Verbinde dieses Gerät, damit dein Fortschritt automatisch überall gleich ist.</p>
      <button class="mode-btn" id="btnCreate"><span class="emoji">✨</span><span class="txt"><b>Neuen Sync-Code erstellen</b><p>Für dein erstes Gerät</p></span><span class="chev">›</span></button>
      <button class="mode-btn" id="btnConnect"><span class="emoji">🔗</span><span class="txt"><b>Mit vorhandenem Code verbinden</b><p>Code vom anderen Gerät eingeben</p></span><span class="chev">›</span></button>
      <div id="connectBox"></div>`;
  } else {
    body = `
      <div class="q-card">
        <div class="q-meta"><span class="chip" id="syncChip">…</span></div>
        <p class="muted" style="margin:0 0 6px">Dein Sync-Code – auf dem anderen Gerät unter „Mit vorhandenem Code verbinden" eingeben:</p>
        <p id="codeText" style="font-size:19px;font-weight:800;letter-spacing:1px;word-break:break-all;margin:4px 0">${esc(code)}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn-ghost" id="btnCopy" style="width:auto;padding:11px 15px">📋 Kopieren</button>
          <button class="btn-ghost" id="btnSyncNow" style="width:auto;padding:11px 15px">🔄 Jetzt synchronisieren</button>
        </div>
        <p class="muted" style="margin-top:12px">Zuletzt synchronisiert: ${esc(lastTxt)}</p>
      </div>
      <button class="mode-btn" id="btnDisconnect"><span class="emoji">🚪</span><span class="txt"><b>Verbindung trennen</b><p>Code von diesem Gerät entfernen (Daten bleiben in der Cloud)</p></span><span class="chev">›</span></button>`;
  }

  const backup = `
    <div class="section-title" style="margin-top:24px">Sicherung (dieses Gerät)</div>
    <p class="muted" style="margin:0 0 10px">Fortschritt als Datei sichern – als Backup oder zum Übertragen ohne Cloud.</p>
    <button class="mode-btn" id="btnExport"><span class="emoji">💾</span><span class="txt"><b>Backup exportieren</b><p>Fortschritt als Datei speichern</p></span><span class="chev">›</span></button>
    <button class="mode-btn" id="btnImport"><span class="emoji">📥</span><span class="txt"><b>Backup importieren</b><p>Aus Datei wiederherstellen (wird zusammengeführt)</p></span><span class="chev">›</span></button>
    <input type="file" id="importFile" accept="application/json,.json" style="display:none">`;

  app.innerHTML = `<div class="section-title">Geräteübergreifende Synchronisation</div>${body}${backup}`;

  const $ = (id) => document.getElementById(id);
  const bC = $("btnCreate"); if (bC) bC.addEventListener("click", createSyncCode);
  const bK = $("btnConnect"); if (bK) bK.addEventListener("click", showConnectBox);
  const bCopy = $("btnCopy"); if (bCopy) bCopy.addEventListener("click", () => copyCode(code));
  const bSync = $("btnSyncNow"); if (bSync) bSync.addEventListener("click", async () => {
    toast("🔄 Synchronisiere…");
    const r = await runSync({});
    if (r && r.ok) toast("✅ Synchronisiert");
    else if (r && r.reason === "offline") toast("🔌 Offline – wird später abgeglichen");
    else toast("⚠️ Sync fehlgeschlagen");
  });
  const bD = $("btnDisconnect"); if (bD) bD.addEventListener("click", async () => {
    const ok = await modalChoice("Verbindung trennen",
      "Code von diesem Gerät entfernen? Der Fortschritt bleibt lokal und in der Cloud erhalten.",
      [{ label: "Trennen", value: true, variant: "danger" }, { label: "Abbrechen", value: false, variant: "ghost" }]);
    if (ok) { ADTSync.setCode(null); toast("Verbindung getrennt"); renderSettings(); }
  });
  const bEx = $("btnExport"); if (bEx) bEx.addEventListener("click", exportProgress);
  const bIm = $("btnImport"); const imf = $("importFile");
  if (bIm && imf) {
    bIm.addEventListener("click", () => imf.click());
    imf.addEventListener("change", () => { if (imf.files && imf.files[0]) importProgressFile(imf.files[0]); imf.value = ""; });
  }
  updateSyncChip();
}

function updateSyncChip() {
  const chip = document.getElementById("syncChip");
  if (!chip || !window.ADTSync) return;
  if (!navigator.onLine) chip.textContent = "🔌 offline · wird später abgeglichen";
  else if (ADTSync.isSyncing()) chip.textContent = "🔄 synchronisiere…";
  else if (ADTSync.hasPending && ADTSync.hasPending()) chip.textContent = "⏳ Abgleich ausstehend";
  else chip.textContent = "☁️ verbunden";
}

async function createSyncCode() {
  const code = ADTSync.generateCode();
  ADTSync.setCode(code);
  toast("✨ Sync-Code erstellt");
  await runSync({});
  renderSettings();
}

function showConnectBox() {
  const box = document.getElementById("connectBox");
  if (!box) return;
  box.innerHTML = `
    <div class="q-card" style="margin-top:12px">
      <p class="muted" style="margin:0 0 8px">Code vom anderen Gerät eingeben:</p>
      <input id="codeInput" inputmode="text" autocapitalize="characters" autocomplete="off"
        placeholder="ADT-XXXXX-XXXXX-XXXXX"
        style="width:100%;padding:14px;font-size:17px;border-radius:12px;border:2px solid var(--border);background:var(--bg);color:var(--text);letter-spacing:1px">
      <button class="btn-primary" id="btnDoConnect" style="margin-top:12px">Verbinden</button>
    </div>`;
  const inp = document.getElementById("codeInput");
  inp.focus();
  document.getElementById("btnDoConnect").addEventListener("click", () => connectWithCode(inp.value));
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") connectWithCode(inp.value); });
}

async function connectWithCode(raw) {
  const code = ADTSync.normalizeCode(raw);
  if (!code || code.replace(/[^A-Z0-9]/g, "").length < 8) { toast("⚠️ Ungültiger Code"); return; }
  ADTSync.setCode(code);
  toast("🔗 Verbinde…");
  const r = await runSync({});
  if (r && r.ok) toast(r.merged ? "✅ Fortschritt übernommen" : "✅ Verbunden");
  else if (r && r.reason === "offline") toast("🔌 Offline – wird später abgeglichen");
  else toast("⚠️ Verbindung fehlgeschlagen");
  renderSettings();
}

function copyCode(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => toast("📋 Code kopiert")).catch(() => toast("Code: " + code));
  } else {
    toast("Code: " + code);
  }
}

/* ---- Themenauswahl ---- */
function renderTopics() {
  updateAppbar("topics");
  actionbar.classList.add("hidden");
  const rows = Object.entries(TOPICS).map(([key, t]) => {
    const st = topicStats(key);
    return `<button class="topic-row" data-topic="${key}">
      <span class="emoji" style="background:${t.color}22">${t.icon}</span>
      <span class="info"><b>${esc(t.name)}</b>
        <span class="bar"><span style="width:${st.pct}%;background:${t.color}"></span></span>
      </span>
      <span class="pct">${st.mastered}/${st.total}</span>
    </button>`;
  }).join("");
  app.innerHTML = `<div class="section-title">Wähle ein Thema</div>${rows}
    <p class="muted center" style="margin-top:16px">„Gemeistert" = Frage mindestens einmal korrekt beantwortet.</p>`;
  app.querySelectorAll("[data-topic]").forEach(el => el.addEventListener("click", () => {
    const key = el.dataset.topic;
    if (!QUESTIONS.some(q => q.topic === key)) { toast("Noch keine Fragen in diesem Thema"); return; }
    buildSession("topic", { topic: key }); go("quiz");
  }));
}

/* ---- Quiz ---- */
function renderQuiz() {
  updateAppbar("quiz");
  const i = SESSION.idx, q = currentQ();
  const total = SESSION.questions.length;
  const checked = SESSION.checked[i];
  const picks = SESSION.picks[i];
  const t = TOPICS[q.topic];
  const diffTxt = ["", "leicht", "mittel", "schwer"][q.difficulty];
  const order = SESSION.optionOrders[i];

  const opts = order.map(origIdx => {
    const isPicked = picks.has(origIdx);
    const isCorrect = q.correct.includes(origIdx);
    let cls = "opt type-" + q.type;
    let mark = isPicked ? (q.type === "single" ? "●" : "✓") : "";
    if (checked) {
      if (isCorrect && isPicked) { cls += " correct"; mark = "✓"; }
      else if (isCorrect && !isPicked) { cls += " missed"; mark = "✓"; }
      else if (!isCorrect && isPicked) { cls += " wrong"; mark = "✕"; }
    } else if (isPicked) cls += " selected";
    return `<button class="${cls}" data-oi="${origIdx}" ${checked ? "disabled" : ""}>
      <span class="box">${mark}</span><span class="otext">${esc(q.options[origIdx])}</span></button>`;
  }).join("");

  let explain = "";
  if (checked) {
    const ok = SESSION.correctFlags[i];
    explain = `<div class="explain ${ok ? "ok" : "no"}">
      <b class="verdict">${ok ? "✅ Richtig" : "❌ Nicht ganz"}</b>${esc(q.explanation)}</div>`;
  }

  app.innerHTML = `
    <div class="quiz-top">
      <div class="progress-track"><span style="width:${Math.round((i) / total * 100)}%"></span></div>
      <span class="q-count">${i + 1} / ${total}</span>
    </div>
    <div class="q-card">
      <div class="q-meta">
        <span class="chip" style="background:${t.color}22;color:${t.color}">${t.icon} ${esc(t.name)}</span>
        <span class="chip">${diffTxt}</span>
        ${q.type === "multi" ? '<span class="chip multi">Mehrfachauswahl</span>' : '<span class="chip">Einfachauswahl</span>'}
      </div>
      <p class="q-text">${esc(q.question)}</p>
      ${q.type === "multi" ? '<p class="q-hint">Es können mehrere Antworten richtig sein. Nur vollständig richtig zählt (Prüfungsregel).</p>' : ''}
      <div class="options">${opts}</div>
      ${explain}
    </div>
    <div class="spacer-lg"></div>
  `;

  app.querySelectorAll("[data-oi]").forEach(el => el.addEventListener("click", () => togglePick(parseInt(el.dataset.oi, 10))));

  // Aktionsleiste
  actionbar.classList.remove("hidden");
  const last = i === total - 1;
  if (!checked) {
    actionbar.innerHTML = `<div class="inner"><button class="btn-primary" id="checkBtn" ${picks.size ? "" : "disabled"}>Antwort prüfen</button></div>`;
    const cb = document.getElementById("checkBtn");
    if (cb) cb.addEventListener("click", checkCurrent);
  } else {
    actionbar.innerHTML = `<div class="inner"><button class="btn-primary" id="nextBtn">${last ? "Auswertung ansehen" : "Weiter"}</button></div>`;
    document.getElementById("nextBtn").addEventListener("click", nextQ);
  }
}

/* ---- Ergebnis ---- */
function renderResult(right, total, pct) {
  updateAppbar("result");
  actionbar.classList.remove("hidden");
  const isExam = SESSION.mode === "exam";
  const passed = pct >= 50;
  const R = 76, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
  const color = pct >= 75 ? "var(--success)" : pct >= 50 ? "var(--warn)" : "var(--danger)";
  let hero, emoji;
  if (pct >= 90) { emoji = "🏆"; hero = "Herausragend!"; }
  else if (pct >= 75) { emoji = "🎉"; hero = "Stark gemacht!"; }
  else if (pct >= 50) { emoji = "👍"; hero = "Bestanden – weiter so!"; }
  else { emoji = "💪"; hero = "Dranbleiben, das wird!"; }

  app.innerHTML = `
    <div class="result-hero">
      <div class="big pop">${emoji}</div>
      <h2>${hero}</h2>
      <div class="score-ring">
        <svg width="168" height="168" viewBox="0 0 168 168">
          <circle cx="84" cy="84" r="${R}" fill="none" stroke="var(--bg-elev-2)" stroke-width="14"/>
          <circle cx="84" cy="84" r="${R}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset 1s ease"/>
        </svg>
        <div class="center"><div><div class="pc">${pct}%</div><div class="sub">${right} von ${total} richtig</div></div></div>
      </div>
      ${isExam ? `<div class="pass-badge ${passed ? "pass" : "fail"}">${passed ? "BESTANDEN" : "NICHT BESTANDEN"} · Grenze 50 %</div>` : ""}
    </div>
    <div class="spacer-lg"></div>
  `;

  const wrongIds = SESSION.questions.filter((q, k) => !SESSION.correctFlags[k]).map(q => q.id);
  actionbar.innerHTML = `<div class="inner">
    ${wrongIds.length ? `<button class="btn-primary" id="againWrong" style="margin-bottom:10px">Falsche wiederholen (${wrongIds.length})</button>` : `<button class="btn-primary" id="homeBtn2" style="margin-bottom:10px">Weiter üben</button>`}
    <button class="btn-ghost" id="homeBtn">Zur Startseite</button>
  </div>`;
  document.getElementById("homeBtn").addEventListener("click", () => go("home"));
  const hb2 = document.getElementById("homeBtn2"); if (hb2) hb2.addEventListener("click", () => go("home"));
  const aw = document.getElementById("againWrong");
  if (aw) aw.addEventListener("click", () => {
    const qs = QUESTIONS.filter(q => wrongIds.includes(q.id));
    SESSION = null; buildSession("mixed"); // Basis, dann überschreiben:
    const questions = shuffle(qs);
    SESSION = { mode: "review", topic: null, questions, optionOrders: questions.map(q => shuffle(q.options.map((_, i) => i))), idx: 0, picks: questions.map(() => new Set()), checked: questions.map(() => false), correctFlags: questions.map(() => null) };
    go("quiz");
  });
}

/* ---- Badges ---- */
function renderBadges() {
  updateAppbar("badges");
  actionbar.classList.add("hidden");
  const cards = BADGES.map(b => {
    const earned = !!S.badges[b.id];
    return `<div class="badge ${earned ? "earned" : ""}">
      <div class="ic">${b.ic}</div><div class="bt">${esc(b.name)}</div><div class="bd">${esc(b.desc)}</div></div>`;
  }).join("");
  const n = Object.keys(S.badges).length;
  app.innerHTML = `
    <div class="section-title">Erfolge · ${n}/${BADGES.length}</div>
    <div class="badge-grid">${cards}</div>
    <div class="section-title" style="margin-top:26px">Prüfungs-Rekord</div>
    <div class="stat-grid">
      <div class="stat"><div class="num">${S.bestExamPct}%</div><div class="lbl">beste Simulation</div></div>
      <div class="stat"><div class="num">${S.examsPassed}</div><div class="lbl">bestanden</div></div>
      <div class="stat"><div class="num">${S.streak}</div><div class="lbl">Tage-Serie</div></div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * 7) Navigation
 * ------------------------------------------------------------------ */
let VIEW = "home";
function go(view) {
  const prev = VIEW;
  VIEW = view;
  try {
    if (view === "home") renderHome();
    else if (view === "topics") renderTopics();
    else if (view === "quiz") renderQuiz();
    else if (view === "badges") renderBadges();
    else if (view === "settings") renderSettings();
    history.replaceState({ view }, "");
  } catch (e) {
    console.error("Render-Fehler in Ansicht '" + view + "':", e);
    // Nie weißer Bildschirm: sichere Rückfallanzeige mit Weg zurück.
    VIEW = "home";
    try {
      app.innerHTML = `<div class="empty"><div class="ic">😕</div>
        <h2>Ups, da ging etwas schief</h2>
        <p class="muted">Dein Fortschritt ist sicher gespeichert. Tippe unten, um neu zu starten.</p></div>`;
      actionbar.classList.remove("hidden");
      actionbar.innerHTML = `<div class="inner"><button class="btn-primary" id="recoverBtn">Zur Startseite</button></div>`;
      const rb = document.getElementById("recoverBtn");
      if (rb) rb.addEventListener("click", () => { try { go("home"); } catch (_) { location.reload(); } });
    } catch (_) { /* im Extremfall bleibt die letzte Ansicht stehen */ VIEW = prev; }
  }
}
function goBack() {
  if (VIEW === "quiz") {
    if (confirm("Training beenden? Der bisherige Fortschritt bleibt gespeichert.")) go("home");
  } else if (VIEW === "topics" || VIEW === "badges" || VIEW === "result" || VIEW === "settings") go("home");
  else go("home");
}

/* ------------------------------------------------------------------ *
 * 8) Toast & Reset
 * ------------------------------------------------------------------ */
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1900);
}

// In-App-Banner „neue Version verfügbar" (Service-Worker-Update).
let swUpdateAccepted = false;   // nur nach aktiver Bestätigung neu laden
function showUpdateBanner(worker) {
  if (document.getElementById("updateBanner")) return;
  const bar = document.createElement("div");
  bar.id = "updateBanner"; bar.className = "update-banner";
  bar.innerHTML = `<span>✨ Neue Version verfügbar</span><button id="updateReload">Neu laden</button>`;
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add("show"));
  document.getElementById("updateReload").addEventListener("click", () => {
    swUpdateAccepted = true;
    try { worker.postMessage({ type: "SKIP_WAITING" }); }
    catch (e) { location.reload(); }
  });
}

// Wiederverwendbarer Auswahl-Dialog. buttons: [{label, value, variant}]. Promise -> value.
function modalChoice(title, message, buttons) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    const btnHtml = buttons.map((b, i) => {
      const cls = b.variant === "danger" ? "btn-danger" : b.variant === "ghost" ? "btn-ghost" : "btn-primary";
      return `<button class="${cls} modal-btn" data-i="${i}">${esc(b.label)}</button>`;
    }).join("");
    ov.innerHTML = `<div class="modal-card">
      <h3 class="modal-title">${esc(title)}</h3>
      ${message ? `<p class="modal-msg">${esc(message)}</p>` : ""}
      <div class="modal-actions">${btnHtml}</div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    const close = (val) => { ov.classList.remove("show"); setTimeout(() => ov.remove(), 200); resolve(val); };
    ov.querySelectorAll(".modal-btn").forEach((el) => el.addEventListener("click", () => close(buttons[+el.dataset.i].value)));
    ov.addEventListener("click", (e) => { if (e.target === ov) close(null); });
  });
}

async function confirmReset() {
  if (syncEnabled()) {
    const choice = await modalChoice(
      "Fortschritt zurücksetzen",
      "Dieses Gerät ist mit der Cloud verbunden. Wie möchtest du zurücksetzen?",
      [
        { label: "Überall (Cloud + dieses Gerät)", value: "all", variant: "danger" },
        { label: "Nur dieses Gerät (trennt die Cloud)", value: "local", variant: "primary" },
        { label: "Abbrechen", value: null, variant: "ghost" },
      ]
    );
    if (!choice) return;
    if (choice === "all") {
      S = { ...DEFAULT_STATE }; persistLocal();
      const r = await ADTSync.overwriteRemote(S);
      toast(r && r.ok ? "Überall zurückgesetzt" : "Lokal zurückgesetzt – Cloud folgt bei Verbindung");
    } else {
      // Verbindung trennen, damit der lokale Reset nicht aus der Cloud zurückkehrt
      ADTSync.setCode(null);
      S = { ...DEFAULT_STATE }; persistLocal();
      toast("Zurückgesetzt · Cloud-Verbindung getrennt");
    }
    go("home");
  } else {
    const ok = await modalChoice(
      "Fortschritt zurücksetzen",
      "Wirklich den gesamten Lernfortschritt (XP, Level, Serie, Erfolge) löschen? Das kann nicht rückgängig gemacht werden.",
      [{ label: "Ja, löschen", value: true, variant: "danger" }, { label: "Abbrechen", value: false, variant: "ghost" }]
    );
    if (ok) { S = { ...DEFAULT_STATE }; persistLocal(); toast("Fortschritt zurückgesetzt"); go("home"); }
  }
}

/* ---- Lokales Backup: Export / Import (unabhängig von der Cloud) ---- */
function exportProgress() {
  try {
    const payload = { app: "adt-trainer", schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), state: S };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = todayStr();
    a.href = url; a.download = "adt-trainer-backup-" + stamp + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    toast("💾 Backup gespeichert");
  } catch (e) {
    console.warn("Export fehlgeschlagen", e);
    toast("⚠️ Export nicht möglich");
  }
}

function importProgressFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = parsed && parsed.state ? parsed.state : parsed; // roh oder verpackt
      if (!incoming || typeof incoming !== "object") throw new Error("Ungültige Datei");
      const cleanIncoming = sanitizeState(migrate(incoming));
      // Verlustarm zusammenführen (nie schlechter als vorher)
      const merged = window.ADTSync ? ADTSync.mergeStates(S, cleanIncoming) : cleanIncoming;
      S = sanitizeState(migrate(merged));
      persistLocal();
      checkBadges();
      toast("✅ Backup importiert & zusammengeführt");
      if (syncEnabled()) runSync({});
      go("settings");
    } catch (e) {
      console.warn("Import fehlgeschlagen", e);
      toast("⚠️ Datei konnte nicht gelesen werden");
    }
  };
  reader.onerror = () => toast("⚠️ Datei konnte nicht gelesen werden");
  reader.readAsText(file);
}

/* ------------------------------------------------------------------ *
 * 9) Start
 * ------------------------------------------------------------------ */
// Globale Fehlerabsicherung – Fehler dürfen die App nie unbedienbar machen.
window.addEventListener("error", (e) => { console.error("Unerwarteter Fehler:", e && e.message); });
window.addEventListener("unhandledrejection", (e) => { console.warn("Unbehandelte Promise-Ablehnung:", e && e.reason); });

// Fortschritt beim Schließen/Backgrounden zuverlässig sichern (nichts geht verloren).
window.addEventListener("pagehide", flushSave);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(); });

document.getElementById("backBtn").addEventListener("click", goBack);

if (!DATA_OK) {
  app.innerHTML = `<div class="empty"><div class="ic">⚠️</div><h2>Daten-Fehler</h2>
    <p class="muted">Die Fragen-Datenbank enthält einen Formatfehler. Details in der Konsole.</p></div>`;
} else {
  // Serie ggf. zurücksetzen, wenn ein Tag ausgelassen wurde (nur Anzeige-Konsistenz)
  const t = todayStr();
  if (S.lastActiveDay && daysBetween(S.lastActiveDay, t) > 1) { S.streak = 0; saveState(); }
  go("home");

  // Cloud-Sync: Statusanzeige aktualisieren + bei passenden Ereignissen abgleichen
  if (window.ADTSync) {
    ADTSync.onChange(() => { updateSyncChip(); refreshAfterSync(); });
    if (syncEnabled()) runSync({});                              // beim Start
    window.addEventListener("online", () => { if (syncEnabled()) runSync({}); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && syncEnabled()) runSync({}); });
  }
}

// Service Worker registrieren (offline) + Update-Erkennung mit In-App-Banner
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      const notifyIfWaiting = () => { if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting); };
      notifyIfWaiting();
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner(nw);
        });
      });
    }).catch((err) => console.warn("SW-Registrierung fehlgeschlagen", err));

    // Neu laden nur, wenn der Nutzer das Update bestätigt hat (verhindert
    // einen unnötigen Reload beim ersten clients.claim).
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!swUpdateAccepted || reloaded) return; reloaded = true; location.reload();
    });
  });
}
