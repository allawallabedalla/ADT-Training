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
    if (!["single", "multi", "numeric"].includes(q.type)) { console.error("Frage-Fehler (unbekannter Typ):", q.id, q.type); return false; }
    if (q.type === "numeric") {
      // Rechen-/Anwendungsaufgabe: erwartete Zahl + optionale Toleranz statt Optionen.
      if (typeof q.answer !== "number" || !isFinite(q.answer)) { console.error("Frage-Fehler (numeric ohne gültige answer):", q.id); return false; }
      if (q.tolerance != null && (typeof q.tolerance !== "number" || !isFinite(q.tolerance) || q.tolerance < 0)) { console.error("Frage-Fehler (numeric tolerance ungültig):", q.id); return false; }
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2) { console.error("Frage-Fehler (Optionen):", q.id); return false; }
      if (!Array.isArray(q.correct) || q.correct.length < 1) { console.error("Frage-Fehler (keine richtige Antwort):", q.id); return false; }
      for (const c of q.correct) if (c < 0 || c >= q.options.length) { console.error("Frage-Fehler (correct-Index außerhalb):", q.id); return false; }
      if (q.type === "single" && q.correct.length !== 1) { console.error("Frage-Fehler (single mit !=1 richtig):", q.id); return false; }
    }
  }
  return true;
})();

/* ------------------------------------------------------------------ *
 * 1) Persistenter Zustand (localStorage, robust gegen Defekte)
 * ------------------------------------------------------------------ */
const STORE_KEY = "adt_trainer_state_v1";   // NIE umbenennen – siehe workbook.md („Speicherstände sind heilig")
const SCHEMA_VERSION = 2;                     // bei Datenmodell-Änderungen erhöhen UND Migration ergänzen

// Spaced Repetition (Leitner): Box 0–5. Pause bis zur nächsten Wiederholung in Tagen.
// Richtig -> eine Box höher (längere Pause); falsch -> zurück auf Box 0 (heute erneut).
// Hier oben deklariert, weil die Migration (oben) darauf zugreift, bevor Abschnitt 2 läuft.
const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];
const SRS_MASTER_BOX = 3;                     // ab dieser Box gilt eine Frage als „sicher"
const DEFAULT_STATE = {
  schemaVersion: SCHEMA_VERSION,
  xp: 0,
  streak: 0,
  bestStreak: 0,                // längste je erreichte Tages-Serie (Rekord)
  lastActiveDay: null,          // "YYYY-MM-DD"
  totalAnswered: 0,
  totalCorrect: 0,
  perQuestion: {},              // id -> { seen, correct, wrong, lastResult, box, due }
  badges: {},                   // badgeId -> ISO-Datum
  examsPassed: 0,
  bestExamPct: 0,
};

// Migrations-Gerüst: MIGRATIONS[n] hebt einen Stand von Version n-1 auf n.
// So überleben Lernstände künftige Datenmodell-Änderungen (statt sie zu verwerfen).
const MIGRATIONS = {
  // v1 -> v2: Spaced-Repetition-Felder (Leitner-Box + Fälligkeit) je Frage ergänzen.
  // Warmstart aus dem bisherigen Fortschritt, damit kein Lernstand verloren geht:
  //   - schon einmal korrekt & zuletzt NICHT falsch  -> Box 3 ("sicher", 7 Tage Pause)
  //   - schon einmal korrekt, aber zuletzt falsch     -> Box 1
  //   - noch nie korrekt                              -> Box 0 (heute fällig)
  2: (s) => {
    const pq = (s && s.perQuestion && typeof s.perQuestion === "object") ? s.perQuestion : {};
    for (const id of Object.keys(pq)) {
      const p = pq[id] || {};
      const correct = Math.max(0, Math.floor(Number(p.correct) || 0));
      let box;
      if (correct >= 1 && p.lastResult !== "wrong") box = 3;
      else if (correct >= 1) box = 1;
      else box = 0;
      p.box = box;
      p.due = addDaysStr(SRS_INTERVALS_DAYS[box]);
      pq[id] = p;
    }
    return s;
  },
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

// Frischer Standardzustand als echte Tiefkopie (KEINE geteilten Objekt-Referenzen!).
function freshState() { return JSON.parse(JSON.stringify(DEFAULT_STATE)); }

// Defensiv säubern: ein teilweise defekter Stand darf die App nie brechen.
// Baut IMMER frische perQuestion/badges-Objekte, damit nie eine Referenz auf
// DEFAULT_STATE geteilt wird (sonst würde ein Reset den Fortschritt nicht leeren).
function sanitizeState(raw) {
  const src = (raw && typeof raw === "object") ? raw : {};
  const clampInt = (v, min, max) => {
    let n = Math.floor(Number(v)); if (!isFinite(n)) n = min;
    n = Math.max(min, n); if (max != null) n = Math.min(max, n); return n;
  };
  const s = freshState();
  s.xp = clampInt(src.xp, 0);
  s.streak = clampInt(src.streak, 0);
  // Rekord-Serie nie kleiner als die aktuelle Serie (heilt auch Altstände ohne das Feld).
  s.bestStreak = Math.max(clampInt(src.bestStreak, 0), s.streak);
  s.totalAnswered = clampInt(src.totalAnswered, 0);
  s.totalCorrect = clampInt(src.totalCorrect, 0);
  s.examsPassed = clampInt(src.examsPassed, 0);
  s.bestExamPct = clampInt(src.bestExamPct, 0, 100);
  s.lastActiveDay = typeof src.lastActiveDay === "string" ? src.lastActiveDay : null;
  // Nur bekannte Frage-IDs übernehmen (Defense-in-Depth gegen fremde/aufgeblähte Keys aus
  // Import/Remote). Guard: nur filtern, wenn die Fragen wirklich geladen sind – sonst würde
  // ein Ladefehler den Fortschritt löschen („Speicherstände sind heilig").
  const knownQ = (typeof QUESTIONS !== "undefined" && Array.isArray(QUESTIONS) && QUESTIONS.length)
    ? new Set(QUESTIONS.map(q => q.id)) : null;
  const rawPq = (src.perQuestion && typeof src.perQuestion === "object") ? src.perQuestion : {};
  for (const id of Object.keys(rawPq)) {
    if (knownQ && !knownQ.has(id)) continue;
    const p = rawPq[id] || {};
    s.perQuestion[id] = {
      seen: clampInt(p.seen, 0),
      correct: clampInt(p.correct, 0),
      wrong: clampInt(p.wrong, 0),
      lastResult: (p.lastResult === "correct" || p.lastResult === "wrong") ? p.lastResult : null,
      box: clampInt(p.box, 0, SRS_INTERVALS_DAYS.length - 1),
      due: typeof p.due === "string" ? p.due : null,
      // Bereits „sichere" Fragen gelten als schon gemeistert → kein nachträglicher Bonus.
      masteredOnce: (p.masteredOnce === true) || (clampInt(p.box, 0, SRS_INTERVALS_DAYS.length - 1) >= SRS_MASTER_BOX),
    };
  }
  const rawBg = (src.badges && typeof src.badges === "object") ? src.badges : {};
  for (const k of Object.keys(rawBg)) s.badges[k] = rawBg[k];
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshState();
    return sanitizeState(migrate(JSON.parse(raw)));
  } catch (e) {
    console.warn("State beschädigt, setze zurück.", e);
    return freshState();
  }
}
let S = loadState();
let saveTimer = null;
let quotaWarned = false;
function persistLocal() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); return true; }
  catch (e) {
    console.warn("Speichern fehlgeschlagen (localStorage voll?)", e);
    // Einmalig sichtbar machen, damit stiller Datenverlust nicht unbemerkt bleibt.
    if (!quotaWarned) { quotaWarned = true; try { toast("⚠️ Speicher voll – Fortschritt evtl. nicht gesichert"); } catch (_) {} }
    return false;
  }
}
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { persistLocal(); scheduleSync(); }, 120);
}
// Ausstehende Speicherung sofort schreiben – z. B. wenn die App geschlossen oder
// in den Hintergrund geschickt wird (auf iOS laufen Timer dann evtl. nicht mehr).
function flushSave() { clearTimeout(saveTimer); persistLocal(); }

/* ---- Tagesziel & heutiger Fortschritt (bewusst GERÄTE-LOKAL, nicht gesynct) ----
 * Der Tageszähler ist ein täglicher Anreiz „auf diesem Gerät"; ihn zu synchronisieren
 * würde den verlustarmen Max-Merge verkomplizieren (Zähler müssten summiert werden).
 * Darum wie die Erinnerungs-Uhrzeit rein lokal in localStorage. */
const GOAL_KEY = "adt_daily_goal";
const TODAY_KEY = "adt_today";
const ONBOARD_KEY = "adt_onboarded";
const GOAL_CHOICES = [5, 10, 15, 20, 30];
function getDailyGoal() { try { const v = parseInt(localStorage.getItem(GOAL_KEY), 10); return (v >= 1 && v <= 500) ? v : 10; } catch { return 10; } }
function setDailyGoal(n) { try { localStorage.setItem(GOAL_KEY, String(n)); } catch (e) {} }
function getToday() { try { const o = JSON.parse(localStorage.getItem(TODAY_KEY) || "{}"); return (o && o.date === todayStr()) ? (parseInt(o.count, 10) || 0) : 0; } catch { return 0; } }
function bumpToday(n) { try { const c = getToday() + (n || 0); localStorage.setItem(TODAY_KEY, JSON.stringify({ date: todayStr(), count: c })); return c; } catch { return 0; } }
function isOnboarded() { try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch { return true; } }
function setOnboarded() { try { localStorage.setItem(ONBOARD_KEY, "1"); } catch (e) {} }

/* ---- App-Einstellungen (geräte-lokal) ---- */
const SIZE_KEY = "adt_session_size";   // Fragen pro Übungsrunde (0 = alle)
const THEME_KEY = "adt_theme";          // "auto" | "light" | "dark"
const SIZE_CHOICES = [10, 15, 20, 30, 0];
function getSessionSize() { try { const v = parseInt(localStorage.getItem(SIZE_KEY), 10); return SIZE_CHOICES.includes(v) ? v : 15; } catch { return 15; } }
function setSessionSize(n) { try { localStorage.setItem(SIZE_KEY, String(n)); } catch (e) {} }
function getTheme() { try { const v = localStorage.getItem(THEME_KEY); return (v === "light" || v === "dark") ? v : "auto"; } catch { return "auto"; } }
function setTheme(t) { try { t === "auto" ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(); }
// „auto" folgt dem System (kein data-theme → CSS-Media-Query greift); sonst fest überschreiben.
function applyTheme() {
  const t = getTheme();
  const root = document.documentElement;
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  else root.removeAttribute("data-theme");
}
applyTheme();   // so früh wie möglich anwenden (vermeidet Farb-Flackern)

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
  setStreak();
  if (VIEW === "home") renderHome();
  else if (VIEW === "settings") renderSettings();
}

/* ---- Web-Push-Erinnerungen (optional, siehe README → „Lern-Erinnerungen") ---- */
const REMIND_KEY = "adt_reminder_hour";
function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
function pushConfigured() {
  return !!(window.ADT_CONFIG && window.ADT_CONFIG.vapidPublicKey && window.ADTSync && ADTSync.isConfigured());
}
function getReminderHour() { try { const v = localStorage.getItem(REMIND_KEY); return v == null ? null : parseInt(v, 10); } catch { return null; } }
function setReminderHour(h) { try { h == null ? localStorage.removeItem(REMIND_KEY) : localStorage.setItem(REMIND_KEY, String(h)); } catch (e) {} }
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function getPushSubscription() {
  try {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch (e) { return null; }
}
async function remindersActive() {
  return !!(pushSupported() && Notification.permission === "granted" && getReminderHour() != null && (await getPushSubscription()));
}
async function enableReminders(hour) {
  if (!pushSupported()) { toast("⚠️ Auf dem iPhone: App erst zum Home-Bildschirm hinzufügen"); return false; }
  if (!pushConfigured()) { toast("⚠️ Erinnerungen sind serverseitig noch nicht eingerichtet"); return false; }
  try {
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("🔕 Ohne Erlaubnis keine Erinnerungen"); return false; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.ADT_CONFIG.vapidPublicKey),
      });
    }
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "Europe/Berlin";
    const ok = await ADTSync.savePush(sub.toJSON(), hour, tz);
    if (!ok) { toast("⚠️ Konnte Erinnerung nicht speichern"); return false; }
    setReminderHour(hour);
    return true;
  } catch (e) {
    console.warn("enableReminders", e);
    toast("⚠️ Erinnerung konnte nicht aktiviert werden");
    return false;
  }
}
async function disableReminders() {
  try {
    const sub = await getPushSubscription();
    if (sub) { await ADTSync.removePush(sub.endpoint); await sub.unsubscribe(); }
  } catch (e) { console.warn("disableReminders", e); }
  setReminderHour(null);
}
async function sendTestNotification() {
  try {
    if (Notification.permission !== "granted") { toast("Erst Erinnerung aktivieren"); return; }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("ADT Trainer", { body: "So sieht deine Lern-Erinnerung aus 📚", icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", tag: "adt-test" });
    toast("🔔 Test-Benachrichtigung gesendet");
  } catch (e) { toast("⚠️ Test nicht möglich"); }
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
// Datum in n Tagen als "YYYY-MM-DD" (n=0 -> heute). Für Fälligkeiten der Wiederholung.
function addDaysStr(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (Number(n) || 0));
  return todayStr(d);
}
// Leitner-Update nach einer Antwort: Box anpassen und nächste Fälligkeit setzen.
function srsUpdate(p, ok) {
  const cur = Math.max(0, Math.min(SRS_INTERVALS_DAYS.length - 1, Math.floor(Number(p.box) || 0)));
  p.box = ok ? Math.min(cur + 1, SRS_INTERVALS_DAYS.length - 1) : 0;
  p.due = addDaysStr(SRS_INTERVALS_DAYS[p.box]);
  return p;
}
// Ist eine Frage heute (oder überfällig) zur Wiederholung dran?
function isDue(p, t = todayStr()) {
  if (!p) return false;                       // noch nie gesehen -> zählt separat (neu)
  if (!p.due) return true;                    // gesehen, aber ohne Termin -> fällig
  return p.due <= t;
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
  // Faire Serie: ein einzelner verpasster Tag ist erlaubt (Gnadentag) – die Serie läuft
  // weiter. Erst ab zwei verpassten Tagen (Lücke > 2) beginnt sie neu.
  const gap = S.lastActiveDay ? daysBetween(S.lastActiveDay, t) : null;
  if (gap === 1 || gap === 2) S.streak += 1;
  else S.streak = 1;
  S.lastActiveDay = t;
  if (S.streak > S.bestStreak) S.bestStreak = S.streak;
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
  { id: "answered250",  ic: "💎", name: "Ausdauernd",     desc: "250 Fragen beantwortet",             test: () => S.totalAnswered >= 250 },
  { id: "answered500",  ic: "🚀", name: "Marathon",       desc: "500 Fragen beantwortet",             test: () => S.totalAnswered >= 500 },
  { id: "answered750",  ic: "⛰️", name: "Unermüdlich",     desc: "750 Fragen beantwortet",             test: () => S.totalAnswered >= 750 },
  { id: "answered1000", ic: "🏆", name: "Tausend!",       desc: "1000 Fragen beantwortet",            test: () => S.totalAnswered >= 1000 },
  { id: "streak3",   ic: "🔥", name: "Dranbleiben",       desc: "3 Tage in Folge geübt",              test: () => S.streak >= 3 },
  { id: "streak7",   ic: "⚡", name: "Wochenserie",       desc: "7 Tage in Folge geübt",              test: () => S.streak >= 7 },
  { id: "exam",      ic: "🎓", name: "Prüfung bestanden", desc: "Prüfungssimulation ≥ 50 %",          test: () => S.examsPassed >= 1 },
  { id: "exam90",    ic: "👑", name: "Bravour",           desc: "Prüfungssimulation ≥ 90 %",          test: () => S.bestExamPct >= 90 },
  { id: "sharp",     ic: "🎯", name: "Treffsicher",       desc: "80 % Gesamt-Trefferquote (ab 30 Fragen)", test: () => S.totalAnswered >= 30 && S.totalCorrect / S.totalAnswered >= 0.8 },
  { id: "secure25",  ic: "🛡️", name: "Gefestigt",         desc: "25 Fragen sicher (Box 3+)",          test: () => masteredCount() >= 25 },
  { id: "streak14",  ic: "🗓️", name: "Eiserne Serie",     desc: "14 Tage in Folge (Rekord)",          test: () => S.bestStreak >= 14 },
  { id: "master",    ic: "🧠", name: "Themen-Meister",    desc: "Ein Thema komplett gemeistert",      test: () => Object.keys(TOPICS).some(topicMastered) },
  { id: "allmaster", ic: "🏵️", name: "Alles sitzt",       desc: "Alle Fragen sicher (Box 3+)",        test: () => QUESTIONS.length > 0 && masteredCount() >= QUESTIONS.length },
];
function topicMastered(topicKey) {
  const qs = QUESTIONS.filter(q => q.topic === topicKey);
  if (!qs.length) return false;
  return qs.every(q => { const p = S.perQuestion[q.id]; return p && p.box >= SRS_MASTER_BOX; });
}
// Zahl der „sicheren" Fragen (Box ≥ 3) – für Erfolge und den Meisterschafts-Bonus.
function masteredCount() {
  let n = 0;
  for (const q of QUESTIONS) { const p = S.perQuestion[q.id]; if (p && p.box >= SRS_MASTER_BOX) n++; }
  return n;
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
// „Sicher" (gemeistert) = Box ≥ 3; „am Lernen" = Box 1–2; „neu" = ungeübt/Box 0.
function topicStats(topicKey) {
  const qs = QUESTIONS.filter(q => q.topic === topicKey);
  let mastered = 0, learning = 0;
  for (const q of qs) {
    const p = S.perQuestion[q.id];
    if (!p) continue;
    if (p.box >= SRS_MASTER_BOX) mastered++;
    else if (p.box >= 1) learning++;
  }
  return { total: qs.length, mastered, learning, pct: qs.length ? Math.round(mastered / qs.length * 100) : 0 };
}
function overallAccuracy() {
  return S.totalAnswered ? Math.round(S.totalCorrect / S.totalAnswered * 100) : 0;
}
// Fragen, die noch nie richtig beantwortet wurden oder zuletzt falsch waren
function weakQuestions() {
  return QUESTIONS.filter(q => { const p = S.perQuestion[q.id]; return !p || p.correct === 0 || p.lastResult === "wrong"; });
}
// Spaced Repetition: heute (oder überfällig) zur Wiederholung anstehende Fragen.
// Nur bereits gesehene Fragen mit erreichter Fälligkeit – neue Fragen gehören ins Training.
function dueQuestions(t = todayStr()) {
  return QUESTIONS.filter(q => { const p = S.perQuestion[q.id]; return p && isDue(p, t); });
}

/* ------------------------------------------------------------------ *
 * 5) Quiz-Engine
 * ------------------------------------------------------------------ */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---- Fragetyp-Seam: Antwort-Repräsentation & Bewertung je Typ -------------
 * Antworten werden einheitlich als Liste geführt (Übungsmodus: Set; Prüfung: Array):
 *   - single/multi : Original-Option-Indizes
 *   - numeric      : ein Element = die eingegebene Zahl
 * So bleiben Bewertung und „beantwortet?" an EINER Stelle – neue Typen (z. B. Text/
 * Code) lassen sich später ergänzen, ohne Quiz- und Prüfungs-Flow anzufassen.        */
function respList(resp) { return resp == null ? [] : (Array.isArray(resp) ? resp : Array.from(resp)); }
function isInputType(q) { return q.type === "numeric"; }         // freie Eingabe statt Optionen
function parseNum(v) { const n = Number(String(v).trim().replace(",", ".")); return isFinite(n) ? n : NaN; }
function hasResponse(q, resp) {
  const a = respList(resp);
  if (q.type === "numeric") return a.length >= 1 && isFinite(Number(a[0]));
  return a.length >= 1;
}
function gradeQuestion(q, resp) {
  const a = respList(resp);
  if (q.type === "numeric") {
    if (!a.length) return false;
    const v = Number(a[0]);
    return isFinite(v) && Math.abs(v - q.answer) <= (Number(q.tolerance) || 0) + 1e-9;
  }
  // single/multi: Alles-oder-nichts (Prüfungsregel) – exakt die richtige Menge.
  const correct = new Set(q.correct);
  const picked = new Set(a);
  if (picked.size !== correct.size) return false;
  for (const c of correct) if (!picked.has(c)) return false;
  return true;
}
// Wie die richtige Lösung im Review/Feedback dargestellt wird.
function correctAnswerText(q) {
  if (q.type === "numeric") {
    const tol = Number(q.tolerance) || 0;
    return fmtNum(q.answer) + (q.unit ? " " + q.unit : "") + (tol > 0 ? " (±" + fmtNum(tol) + ")" : "");
  }
  return q.correct.map(i => q.options[i]).join(", ");
}
function fmtNum(n) { return String(Number(n)).replace(".", ","); }   // deutsche Dezimaldarstellung

// Session: { questions:[...], idx, mode, answers:{}, order:[...perQuestion shuffled option order] }
let SESSION = null;

function buildSession(mode, opts = {}) {
  let pool;
  if (mode === "topic") pool = QUESTIONS.filter(q => q.topic === opts.topic);
  else if (mode === "weak") pool = weakQuestions();
  else if (mode === "due") pool = dueQuestions();
  else if (mode === "exam") pool = QUESTIONS;
  else pool = QUESTIONS; // "mixed"

  let questions;
  if (mode === "due") {
    // Fällige Wiederholungen: überfällige zuerst (frühestes Fälligkeitsdatum vorne).
    questions = pool.slice().sort((a, b) => {
      const da = (S.perQuestion[a.id] || {}).due || "", db = (S.perQuestion[b.id] || {}).due || "";
      return da < db ? -1 : da > db ? 1 : 0;
    });
  } else {
    questions = shuffle(pool);
  }
  // Übungsrunden folgen der Einstellung „Fragen pro Runde" (0 = alle); Prüfung bleibt fix.
  let limit;
  if (opts.limit) limit = opts.limit;
  else if (mode === "exam") limit = Math.min(30, questions.length);
  else { const sz = getSessionSize(); limit = sz > 0 ? Math.min(sz, questions.length) : questions.length; }
  questions = questions.slice(0, limit);

  // Antwort-Optionen pro Frage mischen (Reihenfolge merken, um correct-Indizes umzurechnen)
  const optionOrders = questions.map(q => shuffle((q.options || []).map((_, i) => i)));

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

// In-place-Auswahl: aktualisiert NUR die betroffenen Optionen im DOM statt die ganze
// Ansicht neu zu rendern. Das hält Fokus/VoiceOver stabil, vermeidet Flackern und ist
// deutlich leichter. `buttons` = alle Options-Buttons der aktuellen Frage.
function applyPick(origIdx, buttons) {
  const q = currentQ();
  if (SESSION.checked[SESSION.idx]) return;
  const set = SESSION.picks[SESSION.idx];
  if (q.type === "single") { set.clear(); set.add(origIdx); }
  else { set.has(origIdx) ? set.delete(origIdx) : set.add(origIdx); }
  for (const el of buttons) {
    const oi = parseInt(el.dataset.oi, 10);
    const on = set.has(oi);
    el.classList.toggle("selected", on);
    el.setAttribute("aria-checked", on ? "true" : "false");
    const box = el.querySelector(".box");
    if (box) box.textContent = on ? (q.type === "single" ? "●" : "✓") : "";
  }
  const cb = document.getElementById("checkBtn");
  if (cb) cb.disabled = !hasResponse(q, set);
}
// Roving Tabindex: nur das aktive Element bleibt im Tab-Stopp.
function setRovingActive(buttons, activeEl) {
  for (const el of buttons) el.setAttribute("tabindex", el === activeEl ? "0" : "-1");
}
// Tastaturbedienung im Optionsfeld (WAI-ARIA radiogroup/checkbox-Muster):
// Pfeile/Home/End bewegen den Fokus; bei Einfachauswahl wählen die Pfeile zugleich aus.
// Leertaste/Enter lösen als native Button-Aktivierung den Klick aus.
// pickFn(buttonEl, buttons) übernimmt die Auswahl – so teilen Übung UND Prüfung diese Logik.
function onOptionKeydown(e, buttons, type, pickFn) {
  if (!buttons.length) return;
  const cur = buttons.indexOf(document.activeElement);
  let idx = cur < 0 ? 0 : cur;
  if (e.key === "ArrowDown" || e.key === "ArrowRight") idx = (idx + 1) % buttons.length;
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") idx = (idx - 1 + buttons.length) % buttons.length;
  else if (e.key === "Home") idx = 0;
  else if (e.key === "End") idx = buttons.length - 1;
  else return;
  e.preventDefault();
  const target = buttons[idx];
  setRovingActive(buttons, target);
  target.focus();
  if (type === "single") pickFn(target, buttons);
}

// Freie Eingabe (numeric): Wert speichern OHNE Re-Render (sonst verliert das Feld den Fokus).
function setNumericResponse(raw) {
  if (SESSION.checked[SESSION.idx]) return;
  const set = SESSION.picks[SESSION.idx];
  set.clear();
  const n = parseNum(raw);
  if (isFinite(n)) set.add(n);
  const cb = document.getElementById("checkBtn");
  if (cb) cb.disabled = !hasResponse(currentQ(), set);
}

function checkCurrent() {
  const i = SESSION.idx, q = currentQ();
  if (SESSION.checked[i]) return;
  const picks = SESSION.picks[i];
  if (!hasResponse(q, picks)) return;         // ohne Antwort nicht prüfen (v. a. leere Zahl-Eingabe)
  const ok = gradeQuestion(q, picks);
  SESSION.checked[i] = true;
  SESSION.correctFlags[i] = ok;

  // Fortschritt aktualisieren
  const p = S.perQuestion[q.id] || { seen: 0, correct: 0, wrong: 0, lastResult: null, box: 0, due: null, masteredOnce: false };
  const boxBefore = Number(p.box) || 0;
  p.seen += 1;
  if (ok) { p.correct += 1; p.lastResult = "correct"; } else { p.wrong += 1; p.lastResult = "wrong"; }
  srsUpdate(p, ok);                       // Leitner-Box + nächste Fälligkeit fortschreiben
  // Erstmeisterung: Frage erreicht zum ersten Mal Box 3+ („sicher") → einmaliger Bonus.
  const justMastered = ok && boxBefore < SRS_MASTER_BOX && p.box >= SRS_MASTER_BOX && !p.masteredOnce;
  if (justMastered) p.masteredOnce = true;
  S.perQuestion[q.id] = p;
  S.totalAnswered += 1;
  if (ok) S.totalCorrect += 1;

  // XP: richtig = 10 + Schwierigkeitsbonus; falsch = 2 (fürs Dranbleiben); Erstmeisterung +15.
  // difficulty defensiv absichern, damit nie NaN-XP entstehen können.
  const diff = (q.difficulty >= 1 && q.difficulty <= 3) ? q.difficulty : 1;
  const gained = ok ? (10 + (diff - 1) * 5) : 2;
  const bonus = justMastered ? 15 : 0;
  const lvlBefore = levelForXp(S.xp);
  S.xp += gained + bonus;
  const lvlAfter = levelForXp(S.xp);
  touchStreak();
  bumpToday(1);                            // Tagesziel-Fortschritt (lokal)
  saveState();

  const newBadges = checkBadges();
  renderQuiz();
  if (ok) toast(`✅ Richtig! +${gained} XP`); else toast(`+${gained} XP fürs Üben`);
  let delay = 900;
  if (justMastered) { setTimeout(() => toast(`🛡️ Frage gemeistert! +${bonus} XP`), delay); delay += 1500; }
  if (lvlAfter > lvlBefore) {
    setTimeout(() => toast(`🎉 Level ${lvlAfter} – ${levelTitle(lvlAfter)}!`), delay);
    delay += 1600;
  }
  newBadges.forEach((b) => { setTimeout(() => toast(`${b.ic} Erfolg: ${b.name}`), delay); delay += 1400; });
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
  // Ergebnis ersetzt die Quiz-Ansicht im Verlauf → „Zurück" führt sauber zur vorigen Ebene.
  RESULT = { right, total, pct };
  go("result", { replace: true });
}

/* ------------------------------------------------------------------ *
 * 6) UI-Rendering
 * ------------------------------------------------------------------ */
const app = document.getElementById("app");
const actionbar = document.getElementById("actionbar");
const streakEl = document.getElementById("streakVal");

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---- SVG-Icon-System (SF-Symbols-Stil, monochром, via currentColor) ---- */
const ICONS = {
  shuffle: '<path d="M4 7h3c1.2 0 2 .6 2.7 1.6l4.6 6.8c.7 1 1.5 1.6 2.7 1.6h3"/><path d="M4 17h3c1.2 0 2-.6 2.7-1.6l.6-.9"/><path d="M14.4 9.5l.6-.9C15.7 7.6 16.5 7 17.7 7H20"/><path d="M17.5 4.5L20 7l-2.5 2.5"/><path d="M17.5 14.5L20 17l-2.5 2.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
  repeat: '<path d="M20 12a8 8 0 1 0-2.4 5.7"/><path d="M20 5v4h-4"/>',
  clipboardCheck: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3.6A1.6 1.6 0 0 1 10.6 2h2.8A1.6 1.6 0 0 1 15 3.6V4"/><path d="M8.6 13.2l2.2 2.2 4.6-4.6"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 6H4.5v1A3 3 0 0 0 7.5 10"/><path d="M17 6h2.5v1A3 3 0 0 1 16.5 10"/><path d="M12 13v3"/><path d="M8.5 20h7"/><path d="M9.5 20a2.5 2.5 0 0 1 5 0"/>',
  icloud: '<path d="M7.4 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.65 1.2A3.5 3.5 0 0 1 17.5 18H7.4z"/>',
  hexagon: '<path d="M12 2.6l8 4.6v9.6l-8 4.6-8-4.6V7.2z"/><circle cx="12" cy="12" r="2.6"/>',
  ruler: '<rect x="2.5" y="8.5" width="19" height="7" rx="1.6"/><path d="M6.5 8.5v3M10 8.5v4M13.5 8.5v3M17 8.5v4"/>',
  scope: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/><circle cx="11" cy="11" r="2.2"/>',
  book: '<path d="M12 6c-1.5-1.2-3.6-2-6-2-1 0-2 .1-3 .4v13c1-.3 2-.4 3-.4 2.4 0 4.5.8 6 2"/><path d="M12 6c1.5-1.2 3.6-2 6-2 1 0 2 .1 3 .4v13c-1-.3-2-.4-3-.4-2.4 0-4.5.8-6 2z"/><path d="M12 6v13"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  columns: '<path d="M3.5 9L12 4.5 20.5 9"/><path d="M5.5 9v8M9.5 9v8M14.5 9v8M18.5 9v8"/><path d="M3.5 20.5h17"/>',
  chart: '<path d="M5 20V11"/><path d="M12 20V5"/><path d="M19 20v-6"/><path d="M3.5 20.5h17"/>',
  capsule: '<rect x="4" y="9" width="16" height="6" rx="3" transform="rotate(45 12 12)"/><path d="M12 6.5v11" transform="rotate(45 12 12)"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15" r="1.3"/><path d="M12 16.3V18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M9.5 14.5l5-5"/><path d="M11 7.5l1.2-1.2a3.8 3.8 0 0 1 5.5 5.5L16.5 13"/><path d="M13 16.5l-1.2 1.2a3.8 3.8 0 0 1-5.5-5.5L7.5 11"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11.5" rx="2.2"/><path d="M5.5 15.5V6.2A2.2 2.2 0 0 1 7.7 4h8"/>',
  sync: '<path d="M20 11.5A8 8 0 0 0 6.4 6"/><path d="M6 3.5V7h3.5"/><path d="M4 12.5A8 8 0 0 0 17.6 18"/><path d="M18 20.5V17h-3.5"/>',
  xcircle: '<circle cx="12" cy="12" r="8.2"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>',
  export: '<path d="M12 15.5V4"/><path d="M8.2 7.3L12 3.5l3.8 3.8"/><path d="M6 12.5V18a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5.5"/>',
  import: '<path d="M12 4v11.5"/><path d="M8.2 11.7L12 15.5l3.8-3.8"/><path d="M6 12.5V18a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5.5"/>',
  flame: '<path d="M12 3c.6 2.6-1.9 3.9-1.9 6.6A1.9 1.9 0 0 0 13.7 10c1 1.3 2 2.8 2 4.7a3.7 3.7 0 1 1-7.4 0C8.3 9.4 11 6.7 12 3z"/>',
  bolt: '<path d="M13 3L5.5 13.5H11l-1 7.5 8-11H12.5z"/>',
  star: '<path d="M12 3.6l2.5 5 5.5.8-4 3.9.95 5.5L12 16.2l-4.9 2.6.95-5.5-4-3.9 5.5-.8z"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5h11.5l-2.2 3.3 2.2 3.3H6"/>',
  medal: '<circle cx="12" cy="14" r="5"/><path d="M9 9.5L7 3M15 9.5L17 3M11 3h2"/><path d="M12 12.2l.9 1.7 1.9.3-1.4 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.4-1.3 1.9-.3z" fill="currentColor" stroke="none"/>',
  crown: '<path d="M4 9l3.2 8.5h9.6L20 9l-4.6 3.2L12 6l-3.4 6.2z"/><path d="M6.5 20.5h11"/>',
  brain: '<path d="M9.5 5.5A2.8 2.8 0 0 0 6.7 8.4 2.8 2.8 0 0 0 5.5 13.6 2.8 2.8 0 0 0 8.3 18a2.3 2.3 0 0 0 3.7-1.85V7.4a2 2 0 0 0-2.5-1.9z"/><path d="M14.5 5.5a2.8 2.8 0 0 1 2.8 2.9 2.8 2.8 0 0 1 1.2 5.2 2.8 2.8 0 0 1-2.8 4.4 2.3 2.3 0 0 1-3.7-1.85"/>',
  gem: '<path d="M6 4.5h12l3 4.5-9 10.5L3 9z"/><path d="M3.2 9h17.6M8.5 4.5L12 9l3.5-4.5M12 9v10.2"/>',
  rocket: '<path d="M12 3c2.8 1.2 4.5 4 4.5 7.6 0 2-.8 3.9-1.8 5.1H9.3C8.3 14.5 7.5 12.6 7.5 10.6 7.5 7 9.2 4.2 12 3z"/><circle cx="12" cy="9.8" r="1.5"/><path d="M9.3 15.7l-1.8 2.6M14.7 15.7l1.8 2.6M12 16.5v3"/>',
  mountain: '<path d="M3 19h18L14 6l-3.2 5.6L8.5 9z"/><path d="M11.4 11.3l1.1 1.3 1.4-1.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  sliders: '<path d="M4 7h9M17 7h3"/><path d="M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  shield: '<path d="M12 3l7 2.5v5.5c0 4.3-2.9 7.4-7 8.5-4.1-1.1-7-4.2-7-8.5V5.5z"/><path d="M9 12l2 2 4-4.5"/>',
};
const APP_VERSION = "0.22.0";
function icon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
}
function iconTile(name, tint) {
  return '<span class="icon-tile" style="--tint:' + tint + '">' + icon(name) + "</span>";
}
const TOPIC_ICON = { grundlagen: "hexagon", tnm: "ruler", icdo: "scope", icd10: "book", grading: "target", register: "columns", epidemiologie: "chart", therapie: "capsule", datenschutz: "lock" };
const BADGE_ICON = {
  first: { i: "flag", c: "#34c759" }, ten: { i: "grid", c: "#007aff" }, fifty: { i: "medal", c: "#ff9500" },
  hundred: { i: "star", c: "#ff2d55" },
  answered250: { i: "gem", c: "#5e5ce6" }, answered500: { i: "rocket", c: "#007aff" },
  answered750: { i: "mountain", c: "#30b0c7" }, answered1000: { i: "trophy", c: "#ffb300" },
  streak3: { i: "flame", c: "#ff6b22" }, streak7: { i: "bolt", c: "#ffcc00" },
  exam: { i: "clipboardCheck", c: "#34c759" }, exam90: { i: "crown", c: "#5e5ce6" },
  sharp: { i: "target", c: "#ff3b30" }, master: { i: "brain", c: "#30b0c7" },
  secure25: { i: "shield", c: "#34c759" }, streak14: { i: "bolt", c: "#ff6b22" }, allmaster: { i: "trophy", c: "#ffb300" },
};

const BAR_TITLES = { home: "ADT Trainer", topics: "Themen", badges: "Erfolge", settings: "Einstellungen", info: "Info", result: "Ergebnis", quiz: "", exam: "Prüfung", examresult: "Ergebnis" };
function setStreak() {
  if (streakEl) streakEl.innerHTML = '<span class="streak-flame">' + icon("flame") + "</span>" + S.streak;
}
function updateAppbar(view) {
  const back = document.getElementById("backBtn");
  if (back) back.classList.toggle("hidden", view === "home");
  const noLargeTitle = view === "quiz" || view === "result" || view === "exam" || view === "examresult";
  const h1 = document.querySelector(".appbar h1");
  if (h1) {
    h1.textContent = BAR_TITLES[view] != null ? BAR_TITLES[view] : "ADT Trainer";
    // Doppeltes <h1> vermeiden: Wo die Ansicht einen Large-Title (h1) hat, ist der
    // Balken-Titel nur ein visuelles Duplikat → für Screenreader ausblenden.
    h1.setAttribute("aria-hidden", noLargeTitle ? "false" : "true");
  }
  const bar = document.querySelector(".appbar");
  if (bar) bar.classList.toggle("scrolled", noLargeTitle);
  setStreak();
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
  const due = dueQuestions().length;

  // Tagesziel-Ring (lokal)
  const goal = getDailyGoal();
  const todayN = getToday();
  const goalDone = todayN >= goal;
  const gPct = goal ? Math.min(100, Math.round(todayN / goal * 100)) : 0;
  const gR = 25, gC = 2 * Math.PI * gR, gOff = gC * (1 - gPct / 100);
  const gColor = goalDone ? "var(--success)" : "var(--primary)";
  const todayCard = `
    <div class="today-card">
      <button class="today-main" data-act="today" aria-label="Heute üben – ${todayN} von ${goal} Fragen">
        <span class="ring-mini">
          <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
            <circle cx="29" cy="29" r="${gR}" fill="none" stroke="var(--bg-elev-2)" stroke-width="6"/>
            <circle cx="29" cy="29" r="${gR}" fill="none" stroke="${gColor}" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${gC.toFixed(1)}" stroke-dashoffset="${gOff.toFixed(1)}" transform="rotate(-90 29 29)"/>
          </svg>
          <span class="ring-num">${goalDone ? "✓" : todayN}</span>
        </span>
        <span class="txt">
          <b>${goalDone ? "Tagesziel erreicht 🎉" : "Tagesziel heute"}</b>
          <p>${todayN} / ${goal} Fragen${goalDone ? " – stark!" : ""}</p>
        </span>
        <span class="chev">›</span>
      </button>
      <button class="today-edit" data-act="goal">Ziel ändern</button>
    </div>`;

  const standalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  const installTip = standalone ? "" : `
    <div class="install-tip">
      <span>📲</span>
      <div><b>Als App installieren:</b> in Safari unten auf <b>Teilen</b> tippen → <b>„Zum Home-Bildschirm"</b>.
      Danach funktioniert alles offline.</div>
    </div>`;

  app.innerHTML = `
    <h1 class="large-title">ADT Trainer<span class="sub">${esc(levelTitle(lvl))} · Level ${lvl}</span></h1>
    ${installTip}
    <div class="level-card">
      <div class="row"><span class="lvl">Level ${lvl}</span><span class="xp">${into} / ${span} XP</span></div>
      <h2>${esc(levelTitle(lvl))}</h2>
      <div class="xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctBar}" aria-label="Level-Fortschritt"><span style="width:${pctBar}%"></span></div>
    </div>

    ${todayCard}

    <div class="stat-grid">
      <div class="stat"><div class="num">${S.totalAnswered}</div><div class="lbl">beantwortet</div></div>
      <div class="stat"><div class="num">${acc}%</div><div class="lbl">Trefferquote</div></div>
      <div class="stat"><div class="num">${S.xp}</div><div class="lbl">XP gesamt</div></div>
    </div>

    <div class="section-title">Üben</div>
    <div class="ios-group">
      <button class="mode-btn" data-act="mixed">${iconTile("shuffle", "#007aff")}<span class="txt"><b>Gemischtes Training</b><p>Zufällige Fragen aus allen Themen</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="topics">${iconTile("grid", "#5e5ce6")}<span class="txt"><b>Nach Thema lernen</b><p>Gezielt einzelne Themengebiete üben</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="due" ${due ? "" : "disabled"}>${iconTile("repeat", "#ff9500")}<span class="txt"><b>Fällige Wiederholungen</b><p>${due ? due + " Frage" + (due === 1 ? "" : "n") + " heute fällig" : "Super – heute nichts fällig"}</p></span><span class="chev">›</span></button>
    </div>

    <div class="section-title">Prüfung</div>
    <div class="ios-group">
      <button class="mode-btn" data-act="exam">${iconTile("clipboardCheck", "#34c759")}<span class="txt"><b>Prüfungssimulation</b><p>${examInProgress() ? "▶︎ Läuft – tippen zum Fortsetzen" : Math.min(30, QUESTIONS.length) + " Fragen · Timer · bestanden ab 50 %"}</p></span><span class="chev">›</span></button>
    </div>

    <div class="section-title">Fortschritt</div>
    <div class="ios-group">
      <button class="mode-btn" data-act="badges">${iconTile("trophy", "#ffb300")}<span class="txt"><b>Erfolge</b><p>${Object.keys(S.badges).length} / ${BADGES.length} freigeschaltet</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="settings">${iconTile("sliders", "#30b0c7")}<span class="txt"><b>Einstellungen</b><p>Design, Sync, Sicherung, Erinnerungen</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="info">${iconTile("info", "#8e8e93")}<span class="txt"><b>So funktioniert's</b><p>Kurzanleitung & Erklärung</p></span><span class="chev">›</span></button>
    </div>

    <p class="muted center" style="margin-top:24px;margin-bottom:4px">${QUESTIONS.length} Fragen · ${Object.keys(TOPICS).length} Themen</p>
    <button class="link-danger" data-act="reset">Fortschritt zurücksetzen</button>
    <p class="muted center" style="margin-top:16px;font-size:12px;opacity:.8">Inoffiziell · kein Produkt der ADT e. V. · <span class="link" data-act="info">Datenschutz</span></p>
  `;

  app.querySelectorAll("[data-act]").forEach(el => el.addEventListener("click", () => {
    const a = el.dataset.act;
    if (a === "mixed") { buildSession("mixed"); go("quiz"); }
    else if (a === "today") { buildSession("mixed"); go("quiz"); }
    else if (a === "goal") changeDailyGoal();
    else if (a === "topics") go("topics");
    else if (a === "due") { buildSession("due"); go("quiz"); }
    else if (a === "exam") examStart();
    else if (a === "badges") go("badges");
    else if (a === "settings") go("settings");
    else if (a === "info") go("info");
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
    body = `<div class="install-tip">${iconTile("icloud", "#30b0c7")}<div>
      <b>Cloud-Sync ist noch nicht eingerichtet.</b><br>
      Damit der Fortschritt auf allen Geräten gleich ist, muss einmalig ein kostenloses
      Supabase-Projekt verbunden werden (zwei Werte in <b>config.js</b>).
      Schritt-für-Schritt-Anleitung: <b>README.md</b> → „Geräteübergreifende Synchronisation".</div></div>
      <p class="muted center" style="margin-top:16px">Bis dahin funktioniert alles ganz normal – nur lokal auf diesem Gerät.</p>`;
  } else if (!code) {
    body = `
      <p class="muted" style="margin:0 0 12px">Verbinde dieses Gerät, damit dein Fortschritt automatisch überall gleich ist.</p>
      <div class="ios-group">
        <button class="mode-btn" id="btnCreate">${iconTile("plus", "#007aff")}<span class="txt"><b>Neuen Sync-Code erstellen</b><p>Für dein erstes Gerät</p></span><span class="chev">›</span></button>
        <button class="mode-btn" id="btnConnect">${iconTile("link", "#5e5ce6")}<span class="txt"><b>Mit vorhandenem Code verbinden</b><p>Code vom anderen Gerät eingeben</p></span><span class="chev">›</span></button>
      </div>
      <div id="connectBox"></div>`;
  } else {
    body = `
      <div class="q-card">
        <div class="q-meta"><span class="chip" id="syncChip">…</span></div>
        <p class="muted" style="margin:0 0 6px">Dein Sync-Code – auf dem anderen Gerät unter „Mit vorhandenem Code verbinden" eingeben:</p>
        <p id="codeText" style="font-size:19px;font-weight:800;letter-spacing:1px;word-break:break-all;margin:4px 0">${esc(code)}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn-ghost" id="btnCopy" style="width:auto;padding:11px 16px">${icon("copy")} Kopieren</button>
          <button class="btn-ghost" id="btnSyncNow" style="width:auto;padding:11px 16px">${icon("sync")} Synchronisieren</button>
        </div>
        <p class="muted" style="margin-top:12px">Zuletzt synchronisiert: ${esc(lastTxt)}</p>
      </div>
      <div class="ios-group">
        <button class="mode-btn" id="btnDisconnect">${iconTile("xcircle", "#ff3b30")}<span class="txt"><b>Verbindung trennen</b><p>Code von diesem Gerät entfernen (Daten bleiben in der Cloud)</p></span><span class="chev">›</span></button>
      </div>`;
  }

  const backup = `
    <div class="section-title">Sicherung (dieses Gerät)</div>
    <div class="ios-group">
      <button class="mode-btn" id="btnExport">${iconTile("export", "#007aff")}<span class="txt"><b>Backup exportieren</b><p>Fortschritt als Datei speichern</p></span><span class="chev">›</span></button>
      <button class="mode-btn" id="btnImport">${iconTile("import", "#30b0c7")}<span class="txt"><b>Backup importieren</b><p>Aus Datei wiederherstellen (wird zusammengeführt)</p></span><span class="chev">›</span></button>
    </div>
    <input type="file" id="importFile" accept="application/json,.json" style="display:none">`;

  const remind = `
    <div class="section-title">Lern-Erinnerungen</div>
    <div id="remindBox"><div class="q-card"><p class="muted" style="margin:0">Lädt…</p></div></div>`;

  const theme = getTheme(), size = getSessionSize();
  const tOpt = (v, l) => `<option value="${v}" ${theme === v ? "selected" : ""}>${l}</option>`;
  const sOpt = (v, l) => `<option value="${v}" ${size === v ? "selected" : ""}>${l}</option>`;
  const prefs = `
    <div class="section-title">Anzeige & Übung</div>
    <div class="q-card">
      <label class="set-row" for="setTheme"><span>Design</span>
        <select id="setTheme" class="ios-select">${tOpt("auto", "Automatisch (System)")}${tOpt("light", "Hell")}${tOpt("dark", "Dunkel")}</select>
      </label>
      <label class="set-row" for="setSize"><span>Fragen pro Runde</span>
        <select id="setSize" class="ios-select">${sOpt(10, "10")}${sOpt(15, "15")}${sOpt(20, "20")}${sOpt(30, "30")}${sOpt(0, "Alle")}</select>
      </label>
    </div>`;

  app.innerHTML = `<h1 class="large-title">Einstellungen</h1>${prefs}
    <div class="section-title">Geräteübergreifende Synchronisation</div>${body}${backup}${remind}`;

  const $ = (id) => document.getElementById(id);
  const stTheme = $("setTheme"); if (stTheme) stTheme.addEventListener("change", () => { setTheme(stTheme.value); toast("🎨 Design übernommen"); });
  const stSize = $("setSize"); if (stSize) stSize.addEventListener("change", () => { const n = parseInt(stSize.value, 10); setSessionSize(n); toast("✅ Fragen pro Runde: " + (n > 0 ? n : "alle")); });
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
  renderReminderBox();
}

function hourOptions(sel) {
  let o = "";
  for (let h = 0; h < 24; h++) o += `<option value="${h}" ${h === sel ? "selected" : ""}>${String(h).padStart(2, "0")}:00 Uhr</option>`;
  return o;
}
async function renderReminderBox() {
  const box = document.getElementById("remindBox");
  if (!box) return;
  if (!pushSupported()) {
    box.innerHTML = `<div class="install-tip">${iconTile("icloud", "#8e8e93")}<div>Benachrichtigungen sind hier nicht verfügbar. Auf dem iPhone: die App über Safari <b>„Zum Home-Bildschirm"</b> hinzufügen – danach sind Erinnerungen möglich.</div></div>`;
    return;
  }
  if (!pushConfigured()) {
    box.innerHTML = `<div class="install-tip">${iconTile("icloud", "#8e8e93")}<div>Erinnerungen sind serverseitig noch nicht eingerichtet. Anleitung: <b>README → „Lern-Erinnerungen"</b>.</div></div>`;
    return;
  }
  const active = await remindersActive();
  const hour = getReminderHour() != null ? getReminderHour() : 18;
  if (active) {
    box.innerHTML = `
      <div class="q-card">
        <div style="display:flex;align-items:center;gap:12px">
          ${iconTile("flame", "#ff6b22")}<div style="flex:1"><b>Tägliche Erinnerung aktiv</b><p class="muted" style="margin:2px 0 0">jeden Tag um ${String(hour).padStart(2, "0")}:00 Uhr</p></div>
        </div>
        <label class="muted" style="display:block;margin-top:14px">Uhrzeit ändern</label>
        <select id="remindHour" class="ios-select">${hourOptions(hour)}</select>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn-ghost" id="remindTest" style="width:auto;padding:11px 16px">${icon("sync")} Test senden</button>
          <button class="btn-ghost" id="remindOff" style="width:auto;padding:11px 16px;color:var(--danger)">Ausschalten</button>
        </div>
      </div>`;
  } else {
    box.innerHTML = `
      <div class="q-card">
        <p class="muted" style="margin:0 0 4px">Lass dich täglich ans Üben erinnern.</p>
        <label class="muted" style="display:block;margin-top:10px">Uhrzeit</label>
        <select id="remindHour" class="ios-select">${hourOptions(hour)}</select>
        <button class="btn-primary" id="remindOn" style="margin-top:14px">Erinnerung aktivieren</button>
      </div>`;
  }
  const test = document.getElementById("remindTest"); if (test) test.addEventListener("click", sendTestNotification);
  const off = document.getElementById("remindOff"); if (off) off.addEventListener("click", async () => { await disableReminders(); toast("Erinnerung ausgeschaltet"); renderReminderBox(); });
  const on = document.getElementById("remindOn"); if (on) on.addEventListener("click", async () => {
    const h = parseInt(document.getElementById("remindHour").value, 10);
    toast("🔔 Aktiviere…");
    if (await enableReminders(h)) { toast("✅ Erinnerung aktiv"); renderReminderBox(); }
  });
  const sel = document.getElementById("remindHour");
  if (sel && active) sel.addEventListener("change", async () => {
    if (await enableReminders(parseInt(sel.value, 10))) { toast("⏰ Uhrzeit aktualisiert"); renderReminderBox(); }
  });
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
      ${iconTile(TOPIC_ICON[key] || "hexagon", t.color)}
      <span class="info"><b>${esc(t.name)}</b>
        <span class="bar"><span style="width:${st.pct}%;background:${t.color}"></span></span>
      </span>
      <span class="pct">${st.mastered}/${st.total}</span>
    </button>`;
  }).join("");
  app.innerHTML = `<h1 class="large-title">Themen</h1>
    <div class="section-title">Wähle ein Thema</div>
    <div class="ios-group">${rows}</div>
    <p class="muted center" style="margin-top:16px">„Sicher" = Frage mehrfach richtig beantwortet (Box ${SRS_MASTER_BOX}+). Die App plant Wiederholungen automatisch.</p>`;
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
  const diffTxt = ["", "leicht", "mittel", "schwer"][q.difficulty] || "mittel";
  const order = SESSION.optionOrders[i];
  const numeric = q.type === "numeric";
  const optRole = q.type === "single" ? "radio" : "checkbox";
  // Roving Tabindex: im Optionsfeld ist genau EIN Element im Tab-Stopp (WAI-ARIA-Muster).
  let activeIdx = order.find(oi => picks.has(oi));
  if (activeIdx === undefined) activeIdx = order.length ? order[0] : -1;

  const opts = order.map(origIdx => {
    const isPicked = picks.has(origIdx);
    const isCorrect = q.correct.includes(origIdx);
    let cls = "opt type-" + q.type;
    let mark = isPicked ? (q.type === "single" ? "●" : "✓") : "";
    let note = "";
    let aria = "";
    if (checked) {
      if (isCorrect && isPicked) { cls += " correct"; mark = "✓"; aria = "richtig, ausgewählt"; }
      else if (isCorrect && !isPicked) { cls += " missed"; mark = "✓"; note = '<span class="opt-note">Richtige Antwort</span>'; aria = "richtige Antwort, nicht gewählt"; }
      else if (!isCorrect && isPicked) { cls += " wrong"; mark = "✕"; aria = "falsch, ausgewählt"; }
    } else if (isPicked) cls += " selected";
    const ariaAttr = aria ? ` aria-label="${esc(q.options[origIdx] + " – " + aria)}"` : "";
    const tabindex = checked ? "-1" : (origIdx === activeIdx ? "0" : "-1");
    return `<button class="${cls}" data-oi="${origIdx}" role="${optRole}" aria-checked="${isPicked ? "true" : "false"}" tabindex="${tabindex}" ${checked ? "disabled aria-disabled=\"true\"" : ""}${ariaAttr}>
      <span class="box" aria-hidden="true">${mark}</span><span class="otext">${esc(q.options[origIdx])}${note}</span></button>`;
  }).join("");

  // Freie Zahl-Eingabe (Rechen-/Anwendungsaufgabe)
  let answerArea;
  if (numeric) {
    const val = picks.size ? fmtNum(Array.from(picks)[0]) : "";
    const state = checked ? (SESSION.correctFlags[i] ? " correct" : " wrong") : "";
    answerArea = `<div class="num-input${state}">
      <input type="text" inputmode="decimal" id="numField" autocomplete="off" ${checked ? "disabled" : ""}
        value="${esc(val)}" placeholder="Zahl eingeben" aria-label="Antwort als Zahl eingeben">
      ${q.unit ? `<span class="num-unit">${esc(q.unit)}</span>` : ""}
    </div>`;
  } else {
    const groupRole = q.type === "single" ? "radiogroup" : "group";
    answerArea = `<div class="options" role="${groupRole}" aria-label="Antwortmöglichkeiten">${opts}</div>`;
  }

  let explain = "";
  if (checked) {
    const ok = SESSION.correctFlags[i];
    const solved = numeric ? `<div class="solved">Richtige Antwort: <b>${esc(correctAnswerText(q))}</b></div>` : "";
    explain = `<div class="explain ${ok ? "ok" : "no"}" id="explainBox" tabindex="-1" role="status">
      <b class="verdict">${ok ? "✅ Richtig" : "❌ Nicht ganz"}</b>${solved}${esc(q.explanation)}</div>`;
  }

  const typeChip = numeric
    ? '<span class="chip">Rechenaufgabe</span>'
    : (q.type === "multi" ? '<span class="chip multi">Mehrfachauswahl</span>' : '<span class="chip">Einfachauswahl</span>');
  const hint = numeric
    ? '<p class="q-hint">Ergebnis als Zahl eingeben (Komma oder Punkt).</p>'
    : (q.type === "multi" ? '<p class="q-hint">Es können mehrere Antworten richtig sein. Nur vollständig richtig zählt (Prüfungsregel).</p>' : '');

  app.innerHTML = `
    <div class="quiz-top">
      <div class="progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${i + 1}" aria-label="Frage ${i + 1} von ${total}"><span style="width:${Math.round((i) / total * 100)}%"></span></div>
      <span class="q-count">${i + 1} / ${total}</span>
    </div>
    <div class="q-card">
      <div class="q-meta">
        <span class="chip" style="background:${t.color}22;color:${t.color}"><span class="cdot" style="background:${t.color}"></span>${esc(t.name)}</span>
        <span class="chip">${diffTxt}</span>
        ${typeChip}
      </div>
      <p class="q-text">${esc(q.question)}</p>
      ${hint}
      ${answerArea}
      ${explain}
    </div>
    <div class="spacer-lg"></div>
  `;

  if (!numeric && !checked) {
    const optsEl = app.querySelector(".options");
    const buttons = optsEl ? Array.from(optsEl.querySelectorAll("[data-oi]")) : [];
    buttons.forEach(el => el.addEventListener("click", () => { applyPick(parseInt(el.dataset.oi, 10), buttons); setRovingActive(buttons, el); }));
    if (optsEl) optsEl.addEventListener("keydown", (e) => onOptionKeydown(e, buttons, q.type, (el, btns) => applyPick(parseInt(el.dataset.oi, 10), btns)));
  }
  if (numeric && !checked) {
    const nf = document.getElementById("numField");
    if (nf) {
      nf.addEventListener("input", () => setNumericResponse(nf.value));
      nf.addEventListener("keydown", (e) => { if (e.key === "Enter" && hasResponse(q, picks)) checkCurrent(); });
      nf.focus();
    }
  }
  // Nach dem Prüfen den Ergebnis-Block fokussieren → Screenreader liest das Verdikt vor.
  if (checked) { const eb = document.getElementById("explainBox"); if (eb) requestAnimationFrame(() => { try { eb.focus(); } catch (_) {} }); }

  // Aktionsleiste
  actionbar.classList.remove("hidden");
  const last = i === total - 1;
  if (!checked) {
    actionbar.innerHTML = `<div class="inner"><button class="btn-primary" id="checkBtn" ${hasResponse(q, picks) ? "" : "disabled"}>Antwort prüfen</button></div>`;
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
    SESSION = { mode: "review", topic: null, questions, optionOrders: questions.map(q => shuffle((q.options || []).map((_, i) => i))), idx: 0, picks: questions.map(() => new Set()), checked: questions.map(() => false), correctFlags: questions.map(() => null) };
    go("quiz");
  });
}

/* ------------------------------------------------------------------ *
 * 5b) Prüfungsmodus – echte Simulation (eigener Flow, persistent)
 * ------------------------------------------------------------------ */
const EXAM_KEY = "adt_exam_session_v1";
const EXAM_SECONDS_PER_Q = 90;      // Zeitbudget je Frage (Simulation)
let EXAM = null;                    // laufende Prüfung
let EXAM_RESULT = null;             // Ergebnis nach Abgabe
let examTimerId = null;

function nowMs() { return Date.now(); }
function examRemainingMs(e) { return Math.max(0, e.startedAt + e.durationMs - nowMs()); }
function fmtTime(ms) { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function examQuestions() { return EXAM.qids.map(id => QUESTIONS.find(q => q.id === id)); }
function examInProgress() { return !!loadExam(); }

function saveExam() { try { localStorage.setItem(EXAM_KEY, JSON.stringify(EXAM)); } catch (e) {} }
function loadExam() {
  try {
    const raw = localStorage.getItem(EXAM_KEY); if (!raw) return null;
    const e = JSON.parse(raw);
    if (!e || !Array.isArray(e.qids) || e.submitted) return null;
    if (examRemainingMs(e) <= 0) return null;                 // abgelaufen
    if (!e.qids.every(id => QUESTIONS.some(q => q.id === id))) return null; // Fragen geändert
    return e;
  } catch (e) { return null; }
}
function removeExam() { try { localStorage.removeItem(EXAM_KEY); } catch (e) {} }

// Blueprint: Fragen je Thema proportional zur Verfügbarkeit ziehen.
function buildExamQuestions() {
  const target = Math.min(30, QUESTIONS.length);
  const total = QUESTIONS.length;
  const byTopic = {};
  for (const q of QUESTIONS) (byTopic[q.topic] = byTopic[q.topic] || []).push(q);
  const picked = [], used = new Set();
  for (const t of Object.keys(byTopic)) {
    const quota = Math.max(1, Math.round(target * byTopic[t].length / total));
    for (const q of shuffle(byTopic[t]).slice(0, quota)) { picked.push(q); used.add(q.id); }
  }
  const rest = shuffle(QUESTIONS.filter(q => !used.has(q.id)));
  while (picked.length < target && rest.length) { const q = rest.pop(); picked.push(q); used.add(q.id); }
  return shuffle(picked).slice(0, target);
}

function examStart() {
  const saved = loadExam();
  if (saved) {
    modalChoice("Laufende Prüfung", "Es läuft noch eine Prüfung. Fortsetzen oder neu starten?",
      [{ label: "Fortsetzen", value: "resume", variant: "primary" },
       { label: "Neu starten", value: "new", variant: "danger" },
       { label: "Abbrechen", value: null, variant: "ghost" }]
    ).then((c) => { if (c === "resume") { EXAM = saved; go("exam"); } else if (c === "new") newExam(); });
    return;
  }
  newExam();
}
function newExam() {
  const qs = buildExamQuestions();
  EXAM = {
    qids: qs.map(q => q.id),
    optionOrders: qs.map(q => shuffle((q.options || []).map((_, i) => i))),
    picks: qs.map(() => []),
    flags: qs.map(() => false),
    idx: 0,
    startedAt: nowMs(),
    durationMs: qs.length * EXAM_SECONDS_PER_Q * 1000,
    submitted: false,
  };
  saveExam();
  go("exam");
}

function stopExamTimer() { if (examTimerId) { clearInterval(examTimerId); examTimerId = null; } }
function startExamTimer() {
  stopExamTimer();
  examTimerId = setInterval(() => {
    if (!EXAM || EXAM.submitted) { stopExamTimer(); return; }
    const rem = examRemainingMs(EXAM);
    const el = document.getElementById("examTimer");
    if (el) { el.textContent = fmtTime(rem); el.classList.toggle("low", rem < 60000); }
    if (rem <= 0) { stopExamTimer(); submitExam(true); }
  }, 1000);
}

// In-place-Auswahl in der Prüfung (kein Full-Re-Render → Fokus/VoiceOver stabil,
// kein Flackern während der Simulation). Aktualisiert Optionen + „beantwortet"-Zähler.
function examApplyPick(origIdx, buttons) {
  const q = examQuestions()[EXAM.idx];
  const arr = EXAM.picks[EXAM.idx];
  if (q.type === "single") EXAM.picks[EXAM.idx] = [origIdx];
  else { const k = arr.indexOf(origIdx); if (k >= 0) arr.splice(k, 1); else arr.push(origIdx); }
  const set = new Set(EXAM.picks[EXAM.idx]);
  for (const el of buttons) {
    const oi = parseInt(el.dataset.eoi, 10);
    const on = set.has(oi);
    el.classList.toggle("selected", on);
    el.setAttribute("aria-checked", on ? "true" : "false");
    const box = el.querySelector(".box");
    if (box) box.textContent = on ? (q.type === "single" ? "●" : "✓") : "";
  }
  saveExam();
  const ov = document.getElementById("examOverview");
  if (ov) { const answered = EXAM.picks.filter(p => p.length).length; ov.textContent = `Übersicht · ${answered}/${EXAM.qids.length} beantwortet`; }
}
// Numerische Prüfungsantwort: speichern OHNE Re-Render (Eingabefeld behält den Fokus).
function examSetNumeric(raw) {
  const n = parseNum(raw);
  EXAM.picks[EXAM.idx] = isFinite(n) ? [n] : [];
  saveExam();
}
function examGoto(i) {
  const N = EXAM.qids.length;
  EXAM.idx = Math.max(0, Math.min(N - 1, i)); saveExam(); renderExam(); window.scrollTo(0, 0);
}
function examToggleFlag() { EXAM.flags[EXAM.idx] = !EXAM.flags[EXAM.idx]; saveExam(); renderExam(); }

function renderExam() {
  updateAppbar("exam");
  const qs = examQuestions();
  const N = qs.length, i = EXAM.idx, q = qs[i], t = TOPICS[q.topic];
  const order = EXAM.optionOrders[i];
  const picks = new Set(EXAM.picks[i]);
  const answered = EXAM.picks.filter(p => p.length).length;

  const numeric = q.type === "numeric";
  const optRole = q.type === "single" ? "radio" : "checkbox";
  let activeIdx = order.find(oi => picks.has(oi));
  if (activeIdx === undefined) activeIdx = order.length ? order[0] : -1;
  const opts = order.map(origIdx => {
    const isPicked = picks.has(origIdx);
    const cls = "opt type-" + q.type + (isPicked ? " selected" : "");
    const mark = isPicked ? (q.type === "single" ? "●" : "✓") : "";
    const tabindex = origIdx === activeIdx ? "0" : "-1";
    return `<button class="${cls}" data-eoi="${origIdx}" role="${optRole}" aria-checked="${isPicked ? "true" : "false"}" tabindex="${tabindex}"><span class="box" aria-hidden="true">${mark}</span><span class="otext">${esc(q.options[origIdx])}</span></button>`;
  }).join("");

  let answerArea;
  if (numeric) {
    const val = EXAM.picks[i].length ? fmtNum(EXAM.picks[i][0]) : "";
    answerArea = `<div class="num-input">
      <input type="text" inputmode="decimal" id="examNum" autocomplete="off" value="${esc(val)}"
        placeholder="Zahl eingeben" aria-label="Antwort als Zahl eingeben">
      ${q.unit ? `<span class="num-unit">${esc(q.unit)}</span>` : ""}
    </div>`;
  } else {
    const groupRole = q.type === "single" ? "radiogroup" : "group";
    answerArea = `<div class="options" role="${groupRole}" aria-label="Antwortmöglichkeiten">${opts}</div>`;
  }
  const typeChip = numeric ? '<span class="chip">Rechenaufgabe</span>'
    : (q.type === "multi" ? '<span class="chip multi">Mehrfachauswahl</span>' : '<span class="chip">Einfachauswahl</span>');
  const hint = numeric ? '<p class="q-hint">Ergebnis als Zahl eingeben. Auswertung erst nach Abgabe.</p>'
    : (q.type === "multi" ? '<p class="q-hint">Mehrere Antworten möglich. Kein Zwischen-Feedback – Auswertung erst nach Abgabe.</p>' : '');

  app.innerHTML = `
    <div class="exam-bar">
      <span class="exam-timer" id="examTimer">${fmtTime(examRemainingMs(EXAM))}</span>
      <span class="exam-count">Frage ${i + 1} / ${N}</span>
      <button class="exam-flag ${EXAM.flags[i] ? "on" : ""}" id="examFlag" aria-label="Frage zur Überprüfung markieren">${icon("flag")}</button>
    </div>
    <div class="q-card">
      <div class="q-meta"><span class="chip" style="background:${t.color}22;color:${t.color}"><span class="cdot" style="background:${t.color}"></span>${esc(t.name)}</span>${typeChip}</div>
      <p class="q-text">${esc(q.question)}</p>
      ${hint}
      ${answerArea}
    </div>
    <button class="btn-ghost" id="examOverview" style="margin-top:4px">Übersicht · ${answered}/${N} beantwortet</button>
    <div class="spacer-lg"></div>
  `;
  if (!numeric) {
    const optsEl = app.querySelector(".options");
    const buttons = optsEl ? Array.from(optsEl.querySelectorAll("[data-eoi]")) : [];
    buttons.forEach(el => el.addEventListener("click", () => { examApplyPick(parseInt(el.dataset.eoi, 10), buttons); setRovingActive(buttons, el); }));
    if (optsEl) optsEl.addEventListener("keydown", (e) => onOptionKeydown(e, buttons, q.type, (bel, btns) => examApplyPick(parseInt(bel.dataset.eoi, 10), btns)));
  } else {
    const nf = document.getElementById("examNum");
    if (nf) nf.addEventListener("input", () => examSetNumeric(nf.value));
  }
  document.getElementById("examFlag").addEventListener("click", examToggleFlag);
  document.getElementById("examOverview").addEventListener("click", showExamOverview);

  actionbar.classList.remove("hidden");
  actionbar.innerHTML = `<div class="inner">
    <div style="display:flex;gap:10px;margin-bottom:10px">
      <button class="btn-ghost" id="examPrev" ${i === 0 ? "disabled" : ""} style="flex:1">‹ Zurück</button>
      <button class="btn-ghost" id="examNext" ${i === N - 1 ? "disabled" : ""} style="flex:1">Weiter ›</button>
    </div>
    <button class="btn-primary" id="examSubmit">Prüfung abgeben</button>
  </div>`;
  document.getElementById("examPrev").addEventListener("click", () => examGoto(i - 1));
  document.getElementById("examNext").addEventListener("click", () => examGoto(i + 1));
  document.getElementById("examSubmit").addEventListener("click", confirmSubmitExam);
  startExamTimer();
}

function showExamOverview() {
  const qs = examQuestions(), N = qs.length;
  const cells = qs.map((q, k) => {
    const cls = "exam-cell" + (EXAM.picks[k].length ? " answered" : "") + (EXAM.flags[k] ? " flagged" : "") + (k === EXAM.idx ? " current" : "");
    return `<button class="${cls}" data-jump="${k}">${k + 1}</button>`;
  }).join("");
  const ov = document.createElement("div"); ov.className = "modal-overlay";
  ov.innerHTML = `<div class="modal-card"><h3 class="modal-title">Übersicht</h3>
    <div class="exam-grid">${cells}</div>
    <p class="muted" style="margin:12px 0 0;font-size:13px">Gefüllt = beantwortet · oranger Rand = markiert</p>
    <div class="modal-actions" style="margin-top:16px"><button class="btn-ghost modal-btn" id="ovClose">Schließen</button></div></div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add("show"));
  const close = () => { ov.classList.remove("show"); setTimeout(() => ov.remove(), 200); };
  ov.querySelectorAll("[data-jump]").forEach(el => el.addEventListener("click", () => { close(); examGoto(parseInt(el.dataset.jump, 10)); }));
  document.getElementById("ovClose").addEventListener("click", close);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
}

async function confirmSubmitExam() {
  const N = EXAM.qids.length, answered = EXAM.picks.filter(p => p.length).length;
  const un = N - answered;
  const ok = await modalChoice("Prüfung abgeben",
    un > 0 ? `${un} Frage(n) noch unbeantwortet. Trotzdem abgeben und auswerten?` : "Prüfung jetzt abgeben und auswerten?",
    [{ label: "Abgeben", value: true, variant: "danger" }, { label: "Weiter prüfen", value: false, variant: "ghost" }]);
  if (ok) submitExam(false);
}

function submitExam(auto) {
  stopExamTimer();
  const qs = examQuestions();
  const results = qs.map((q, k) => {
    const ok = gradeQuestion(q, EXAM.picks[k]);
    return { q, ok, picks: EXAM.picks[k].slice() };
  });
  const right = results.filter(r => r.ok).length, total = qs.length;
  const pct = total ? Math.round(right / total * 100) : 0;

  // Fortschritt aktualisieren (perQuestion + Gesamtzähler + Prüfungsrekord)
  for (const r of results) {
    const p = S.perQuestion[r.q.id] || { seen: 0, correct: 0, wrong: 0, lastResult: null, box: 0, due: null };
    p.seen += 1; if (r.ok) { p.correct += 1; p.lastResult = "correct"; } else { p.wrong += 1; p.lastResult = "wrong"; }
    srsUpdate(p, r.ok);                    // Prüfungsantworten fließen ebenfalls in die Wiederholung ein
    S.perQuestion[r.q.id] = p;
  }
  S.totalAnswered += total; S.totalCorrect += right;
  if (pct >= 50) S.examsPassed += 1;
  if (pct > S.bestExamPct) S.bestExamPct = pct;
  touchStreak(); bumpToday(total); saveState(); checkBadges();

  EXAM_RESULT = { results, right, total, pct, auto };
  EXAM = null; removeExam();
  go("examresult", { replace: true });   // Prüfungsansicht durch das Ergebnis ersetzen
}

function renderExamResult() {
  updateAppbar("examresult");
  stopExamTimer();
  const res = EXAM_RESULT;
  const { right, total, pct } = res;
  const passed = pct >= 50;
  const R = 76, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
  const color = pct >= 75 ? "var(--success)" : pct >= 50 ? "var(--warn)" : "var(--danger)";
  const hero = pct >= 90 ? "🏆 Herausragend!" : pct >= 75 ? "🎉 Stark!" : pct >= 50 ? "👍 Bestanden!" : "💪 Weiter üben!";

  // Themenprofil
  const agg = {};
  for (const r of res.results) { const a = (agg[r.q.topic] = agg[r.q.topic] || { r: 0, n: 0 }); a.n++; if (r.ok) a.r++; }
  const themeRows = Object.keys(agg).map(t => {
    const a = agg[t], p = Math.round(a.r / a.n * 100);
    return `<div class="theme-row"><span class="tn">${esc(TOPICS[t].name)}</span><span class="tbar"><span style="width:${p}%;background:${TOPICS[t].color}"></span></span><span class="tp">${a.r}/${a.n}</span></div>`;
  }).join("");

  // Review
  const review = res.results.map((r, k) => {
    const q = r.q;
    const your = r.picks.length
      ? (q.type === "numeric" ? esc(fmtNum(r.picks[0]) + (q.unit ? " " + q.unit : "")) : r.picks.map(i => esc(q.options[i])).join(", "))
      : "— (nicht beantwortet)";
    const corr = esc(correctAnswerText(q));
    return `<div class="review-item ${r.ok ? "ok" : "no"}">
      <div class="ri-head">${r.ok ? "✅" : "❌"} <b>Frage ${k + 1}</b> · ${esc(TOPICS[q.topic].name)}</div>
      <p class="ri-q">${esc(q.question)}</p>
      <p class="ri-line"><span class="ri-lab">Deine Antwort:</span> ${your}</p>
      ${r.ok ? "" : `<p class="ri-line"><span class="ri-lab">Richtig:</span> ${corr}</p>`}
      <p class="ri-exp">${esc(q.explanation)}</p>
    </div>`;
  }).join("");

  app.innerHTML = `
    <div class="result-hero">
      <div class="big pop">${hero.split(" ")[0]}</div>
      <h2>${esc(hero.slice(hero.indexOf(" ") + 1))}</h2>
      <div class="score-ring">
        <svg width="168" height="168" viewBox="0 0 168 168">
          <circle cx="84" cy="84" r="${R}" fill="none" stroke="var(--bg-elev-2)" stroke-width="14"/>
          <circle cx="84" cy="84" r="${R}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset 1s ease"/>
        </svg>
        <div class="center"><div><div class="pc">${pct}%</div><div class="sub">${right} von ${total} richtig</div></div></div>
      </div>
      <div class="pass-badge ${passed ? "pass" : "fail"}">${passed ? "BESTANDEN" : "NICHT BESTANDEN"} · Grenze 50 %</div>
      ${res.auto ? '<p class="muted center" style="margin-top:8px">Zeit abgelaufen – automatisch abgegeben.</p>' : ""}
    </div>
    <div class="section-title">Themenprofil</div>
    <div class="q-card">${themeRows}</div>
    <div class="section-title">Auswertung im Detail</div>
    ${review}
    <div class="spacer-lg"></div>
  `;

  actionbar.classList.remove("hidden");
  const wrongIds = res.results.filter(r => !r.ok).map(r => r.q.id);
  actionbar.innerHTML = `<div class="inner">
    ${wrongIds.length ? `<button class="btn-primary" id="examAgain" style="margin-bottom:10px">Falsche wiederholen (${wrongIds.length})</button>` : ""}
    <button class="btn-ghost" id="examHome">Zur Startseite</button>
  </div>`;
  document.getElementById("examHome").addEventListener("click", () => go("home"));
  const ea = document.getElementById("examAgain");
  if (ea) ea.addEventListener("click", () => {
    const qs = shuffle(QUESTIONS.filter(q => wrongIds.includes(q.id)));
    SESSION = { mode: "review", topic: null, questions: qs, optionOrders: qs.map(q => shuffle((q.options || []).map((_, i) => i))), idx: 0, picks: qs.map(() => new Set()), checked: qs.map(() => false), correctFlags: qs.map(() => null) };
    go("quiz");
  });
}

/* ---- Badges ---- */
function renderBadges() {
  updateAppbar("badges");
  actionbar.classList.add("hidden");
  const cards = BADGES.map(b => {
    const earned = !!S.badges[b.id];
    const bi = BADGE_ICON[b.id] || { i: "star", c: "#8e8e93" };
    return `<div class="badge ${earned ? "earned" : ""}">
      ${iconTile(bi.i, bi.c)}<div class="bt">${esc(b.name)}</div><div class="bd">${esc(b.desc)}</div></div>`;
  }).join("");
  const n = Object.keys(S.badges).length;
  app.innerHTML = `
    <h1 class="large-title">Erfolge</h1>
    <div class="section-title">${n}/${BADGES.length} freigeschaltet</div>
    <div class="badge-grid">${cards}</div>
    <div class="section-title" style="margin-top:26px">Serie</div>
    <div class="stat-grid two">
      <div class="stat"><div class="num">${S.streak}</div><div class="lbl">aktuelle Serie</div></div>
      <div class="stat"><div class="num">${S.bestStreak}</div><div class="lbl">Rekord-Serie</div></div>
    </div>
    <p class="muted center" style="margin-top:10px;font-size:13px">Ein verpasster Tag ist erlaubt – die Serie bleibt am Leben (Gnadentag).</p>
    <div class="section-title" style="margin-top:22px">Prüfungs-Rekord</div>
    <div class="stat-grid two">
      <div class="stat"><div class="num">${S.bestExamPct}%</div><div class="lbl">beste Simulation</div></div>
      <div class="stat"><div class="num">${S.examsPassed}</div><div class="lbl">bestanden</div></div>
    </div>`;
}

/* ---- Info / Anleitung ---- */
function infoRow(name, tint, title, text) {
  return `<div class="mode-btn info-row">${iconTile(name, tint)}<span class="txt"><b>${title}</b><p>${text}</p></span></div>`;
}
function renderInfo() {
  updateAppbar("info");
  actionbar.classList.add("hidden");
  app.innerHTML = `
    <h1 class="large-title">So funktioniert's<span class="sub">ADT Trainer · Kurzanleitung</span></h1>

    <div class="section-title">Die App</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">Diese App bereitet dich auf die ADT-Prüfung <b>„Tumordokumentar/in"</b> vor. Übe jederzeit am Handy – im echten Prüfungsformat, mit einer Erklärung zu jeder Frage. Alles funktioniert offline.</p></div>

    <div class="section-title">Lernmodi</div>
    <div class="ios-group">
      ${infoRow("shuffle", "#007aff", "Gemischtes Training", "Zufällige Fragen aus allen Themen")}
      ${infoRow("grid", "#5e5ce6", "Nach Thema lernen", "Ein Themengebiet gezielt üben")}
      ${infoRow("repeat", "#ff9500", "Fällige Wiederholungen", "Spaced Repetition: die App bringt jede Frage genau dann zurück, wenn du sie zu vergessen drohst")}
      ${infoRow("clipboardCheck", "#34c759", "Prüfungssimulation", "30 Fragen · bestanden ab 50 %")}
    </div>

    <div class="section-title">Prüfungsformat</div>
    <div class="q-card"><p style="margin:0;line-height:1.6">• Multiple-Choice mit <b>mehreren</b> richtigen Antworten.<br>
    • Ein Punkt nur, wenn <b>alle</b> richtigen Antworten getroffen sind (kein Teilpunkt).<br>
    • Bestanden ab <b>50 %</b> der Punkte.<br>
    • Zugelassene Hilfsmittel in der echten Prüfung: ICD-10, ICD-O-3, OPS.</p></div>

    <div class="section-title">Cleveres Wiederholen</div>
    <div class="q-card"><p style="margin:0;line-height:1.6">Die App nutzt <b>Spaced Repetition</b> (Leitner-System): Jede Frage wandert bei richtiger Antwort in eine höhere Box mit längerer Pause (1 → 3 → 7 → 16 → 35 Tage). Bei einem Fehler geht sie zurück auf Anfang. So wiederholst du genau das, was du zu vergessen drohst – und nicht das, was längst sitzt.<br><br>
    Eine Frage gilt als <b>„sicher"</b>, wenn sie mehrfach richtig war (Box ${SRS_MASTER_BOX}+). Unter <b>Fällige Wiederholungen</b> auf der Startseite steht, was heute dran ist.</p></div>

    <div class="section-title">Belohnungen</div>
    <div class="ios-group">
      ${infoRow("target", "#0a84ff", "Tagesziel", "Setze dir ein tägliches Lernziel – der Ring auf der Startseite zeigt deinen Fortschritt")}
      ${infoRow("star", "#ff2d55", "XP & Level", "Punkte fürs Üben – schwerere Fragen geben mehr")}
      ${infoRow("flame", "#ff6b22", "Tages-Serie", "Jeden Tag üben hält die Serie am Leben – ein Ausrutscher-Tag ist erlaubt (Gnadentag)")}
      ${infoRow("trophy", "#ffb300", "Erfolge", BADGES.length + " Abzeichen – Fleiß, Serien, Prüfung & sichere Fragen")}
    </div>

    <div class="section-title">Auf allen Geräten</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">Unter <b>Einstellungen</b> einen <b>Sync-Code</b> erstellen und auf weiteren Geräten eingeben – dein Fortschritt ist überall gleich. Jeder eigene Code steht für einen eigenen, unabhängigen Fortschritt.</p></div>

    <div class="section-title">Lern-Erinnerungen</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">Optionale <b>tägliche Erinnerung</b> ans Üben zur Wunsch-Uhrzeit (unter Einstellungen). Auf dem iPhone nur, wenn die App zum Home-Bildschirm hinzugefügt ist.</p></div>

    <div class="section-title">Als App installieren</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">In <b>Safari</b> unten auf <b>Teilen</b> → <b>„Zum Home-Bildschirm"</b>. Danach startet die App im Vollbild und läuft komplett offline.</p></div>

    <div class="section-title">Datenschutz & Hinweise</div>
    <div class="q-card"><p style="margin:0;line-height:1.6">
      Dein Lernfortschritt wird <b>lokal auf diesem Gerät</b> gespeichert. Nur wenn du <b>Geräte-Sync</b>
      oder <b>Erinnerungen</b> aktivierst, wird zusätzlich in einem privaten Supabase-Projekt (EU) gespeichert:
      dein Fortschritt (über einen anonymen Sync-Code) bzw. der Benachrichtigungs-Kanal deines Geräts + die Uhrzeit.
      <b>Keine Namen, keine Patientendaten, keine Werbung, keine Weitergabe an Dritte, keine Nutzungsanalyse.</b><br><br>
      Löschen jederzeit: „Fortschritt zurücksetzen" (lokal oder überall) und „Verbindung trennen" bzw. Erinnerung ausschalten.
    </p></div>

    <div class="q-card" style="border:1px solid var(--separator)"><p style="margin:0;line-height:1.55">
      ⚠️ <b>Inoffiziell.</b> Diese App ist ein privates Übungswerkzeug und <b>kein Produkt der ADT e. V.</b>
      Die Fragen dienen dem Üben und sind <b>nicht</b> die offiziellen ADT-Prüfungsfragen.
    </p></div>

    <p class="muted center" style="margin:22px 2px 0">Version ${APP_VERSION}</p>
  `;
}

/* ------------------------------------------------------------------ *
 * 7) Navigation
 * ------------------------------------------------------------------ */
let VIEW = "home";
let RESULT = null;   // Ergebnis der letzten Übungs-Session (für erneutes Rendern bei Navigation)

// Reines Rendern einer Ansicht (ohne History-Nebenwirkungen).
function renderView(view) {
  try {
    window.scrollTo(0, 0);   // neue Ansicht immer oben starten
    if (view === "home") renderHome();
    else if (view === "topics") renderTopics();
    else if (view === "quiz") renderQuiz();
    else if (view === "result") renderResult(RESULT ? RESULT.right : 0, RESULT ? RESULT.total : 0, RESULT ? RESULT.pct : 0);
    else if (view === "exam") renderExam();
    else if (view === "examresult") renderExamResult();
    else if (view === "badges") renderBadges();
    else if (view === "settings") renderSettings();
    else if (view === "info") renderInfo();
    return true;
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
      if (rb) rb.addEventListener("click", () => { try { go("home", { replace: true }); } catch (_) { location.reload(); } });
    } catch (_) { /* im Extremfall bleibt die letzte Ansicht stehen */ }
    return false;
  }
}

// Vorwärts navigieren: rendern + einen History-Eintrag anlegen (oder ersetzen).
// So funktioniert System-/Browser-Zurück nativ innerhalb der App (popstate unten).
function go(view, opts = {}) {
  VIEW = view;
  if (view !== "exam") stopExamTimer();   // Timer läuft nur in der Prüfungsansicht
  renderView(view);
  const state = { view: VIEW };            // VIEW kann bei Render-Fehler auf "home" fallen
  if (opts.replace) history.replaceState(state, ""); else history.pushState(state, "");
}

function confirmLeaveView(view) {
  const cfg = view === "exam"
    ? ["Prüfung verlassen?", "Die Prüfung läuft weiter (die Zeit tickt) – du kannst sie später fortsetzen.", "Verlassen", "Weiter prüfen"]
    : ["Training beenden?", "Der bisherige Fortschritt bleibt gespeichert.", "Beenden", "Weiter üben"];
  return modalChoice(cfg[0], cfg[1], [{ label: cfg[2], value: true, variant: "danger" }, { label: cfg[3], value: false, variant: "ghost" }]);
}

// System-/Browser-Zurück (und der Zurück-Pfeil) landen hier.
async function onPopState(e) {
  const target = (e && e.state && e.state.view) || "home";
  // Aus Quiz/Prüfung heraus zurück: erst bestätigen; bei Abbruch den Pop rückgängig machen.
  if ((VIEW === "quiz" || VIEW === "exam") && target !== VIEW) {
    const ok = await confirmLeaveView(VIEW);
    if (!ok) { history.pushState({ view: VIEW }, ""); return; }
  }
  VIEW = target;
  if (target !== "exam") stopExamTimer();
  renderView(target);   // KEIN erneuter pushState – der Browser hat bereits navigiert
}

// Zurück-Pfeil verhält sich exakt wie System-Zurück.
function goBack() { history.back(); }

/* ---- Tastatur-Komfort (Laptop): Zahlen 1–9 wählen Optionen, Enter prüft/weiter ----
 * Die echte Prüfung findet am Laptop statt – Tastaturbedienung ist darum relevant. */
function optionButtons() { return Array.from(app.querySelectorAll(".options .opt")); }
function handleQuizKey(e) {
  const i = SESSION.idx;
  if (SESSION.checked[i]) { if (e.key === "Enter") { const nb = document.getElementById("nextBtn"); if (nb) { e.preventDefault(); nb.click(); } } return; }
  if (currentQ().type === "numeric") return;   // Zahl-Eingabefeld hat eigenen Enter-Handler
  if (/^[1-9]$/.test(e.key)) {
    const btns = optionButtons(), n = parseInt(e.key, 10) - 1;
    if (btns[n]) { e.preventDefault(); btns[n].click(); }
  } else if (e.key === "Enter") {
    const cb = document.getElementById("checkBtn"); if (cb && !cb.disabled) { e.preventDefault(); cb.click(); }
  }
}
function handleExamKey(e) {
  if (examQuestions()[EXAM.idx].type === "numeric") return;
  if (/^[1-9]$/.test(e.key)) {
    const btns = optionButtons(), n = parseInt(e.key, 10) - 1;
    if (btns[n]) { e.preventDefault(); btns[n].click(); }
  } else if (e.key === "Enter") {
    const nx = document.getElementById("examNext"); if (nx && !nx.disabled) { e.preventDefault(); nx.click(); }
  }
}
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;  // echte Eingaben nicht stören
  if (document.querySelector(".modal-overlay")) return;                  // Dialog hat eigene Tasten
  if (VIEW === "quiz" && SESSION) handleQuizKey(e);
  else if (VIEW === "exam" && EXAM) handleExamKey(e);
});

/* ------------------------------------------------------------------ *
 * 8) Toast & Reset
 * ------------------------------------------------------------------ */
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div"); el.id = "toast"; el.className = "toast";
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
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
// Barrierefrei: role=dialog + aria-modal, Fokus wird gefangen, Escape schließt (null),
// Fokus kehrt nach dem Schließen zum vorher aktiven Element zurück.
let modalTitleSeq = 0;
function modalChoice(title, message, buttons) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const tid = "modalTitle" + (++modalTitleSeq);
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    const btnHtml = buttons.map((b, i) => {
      const cls = b.variant === "danger" ? "btn-danger" : b.variant === "ghost" ? "btn-ghost" : "btn-primary";
      return `<button class="${cls} modal-btn" data-i="${i}">${esc(b.label)}</button>`;
    }).join("");
    ov.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="${tid}">
      <h3 class="modal-title" id="${tid}">${esc(title)}</h3>
      ${message ? `<p class="modal-msg">${esc(message)}</p>` : ""}
      <div class="modal-actions">${btnHtml}</div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    const btns = Array.from(ov.querySelectorAll(".modal-btn"));
    const close = (val) => {
      ov.removeEventListener("keydown", onKey);
      ov.classList.remove("show"); setTimeout(() => ov.remove(), 200);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (_) {}
      resolve(val);
    };
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(null); return; }
      if (e.key === "Tab" && btns.length) {   // Fokusfalle: Tab bleibt im Dialog
        const first = btns[0], last = btns[btns.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    btns.forEach((el) => el.addEventListener("click", () => close(buttons[+el.dataset.i].value)));
    ov.addEventListener("keydown", onKey);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(null); });
    if (btns[0]) btns[0].focus();   // Fokus in den Dialog setzen
  });
}

// Tagesziel wählen/ändern (lokal, geräteweit).
async function changeDailyGoal() {
  const cur = getDailyGoal();
  const buttons = GOAL_CHOICES.map(n => ({ label: n + " Fragen" + (n === cur ? "  ·  aktuell" : ""), value: n, variant: n === cur ? "primary" : "ghost" }));
  buttons.push({ label: "Abbrechen", value: null, variant: "ghost" });
  const choice = await modalChoice("Tagesziel", "Wie viele Fragen möchtest du pro Tag üben?", buttons);
  if (choice) { setDailyGoal(choice); toast("🎯 Tagesziel: " + choice + " Fragen/Tag"); if (VIEW === "home") renderHome(); }
}

// Erststart-Begrüßung: kurz erklären + Tagesziel setzen. Nur einmal (lokal gemerkt).
function showOnboarding() {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-overlay onboard";
    const goals = GOAL_CHOICES.map(n => `<button class="goal-chip${n === 10 ? " sel" : ""}" data-goal="${n}">${n}</button>`).join("");
    ov.innerHTML = `<div class="modal-card onboard-card">
      <div class="onboard-hero">${iconTile("clipboardCheck", "#34c759")}</div>
      <h3 class="modal-title">Willkommen beim ADT&nbsp;Trainer</h3>
      <p class="modal-msg">Übe jederzeit für die Prüfung „Tumordokumentar/in" – im echten Prüfungsformat, mit Erklärung zu jeder Frage. Alles funktioniert offline.</p>
      <div class="onboard-goal">
        <label>Dein Tagesziel (Fragen pro Tag):</label>
        <div class="goal-chips">${goals}</div>
      </div>
      <div class="modal-actions"><button class="btn-primary modal-btn" id="onboardStart">Los geht's</button></div>
    </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    let pick = 10;
    ov.querySelectorAll(".goal-chip").forEach(el => el.addEventListener("click", () => {
      pick = parseInt(el.dataset.goal, 10);
      ov.querySelectorAll(".goal-chip").forEach(c => c.classList.toggle("sel", c === el));
    }));
    document.getElementById("onboardStart").addEventListener("click", () => {
      setDailyGoal(pick); setOnboarded();
      ov.classList.remove("show"); setTimeout(() => ov.remove(), 200);
      if (VIEW === "home") renderHome();
      resolve();
    });
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
      S = freshState(); persistLocal();
      const r = await ADTSync.overwriteRemote(S);
      toast(r && r.ok ? "Überall zurückgesetzt" : "Lokal zurückgesetzt – Cloud folgt bei Verbindung");
    } else {
      // Verbindung trennen, damit der lokale Reset nicht aus der Cloud zurückkehrt
      ADTSync.setCode(null);
      S = freshState(); persistLocal();
      toast("Zurückgesetzt · Cloud-Verbindung getrennt");
    }
    go("home");
  } else {
    const ok = await modalChoice(
      "Fortschritt zurücksetzen",
      "Wirklich den gesamten Lernfortschritt (XP, Level, Serie, Erfolge) löschen? Das kann nicht rückgängig gemacht werden.",
      [{ label: "Ja, löschen", value: true, variant: "danger" }, { label: "Abbrechen", value: false, variant: "ghost" }]
    );
    if (ok) { S = freshState(); persistLocal(); toast("Fortschritt zurückgesetzt"); go("home"); }
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

// iOS-Large-Title: Balken-Titel erscheint beim Scrollen (auf Home/Themen/… mit Large-Title).
window.addEventListener("scroll", () => {
  const bar = document.querySelector(".appbar");
  if (!bar) return;
  if (VIEW === "quiz" || VIEW === "result") return;  // dort dauerhaft sichtbar
  bar.classList.toggle("scrolled", window.scrollY > 24);
}, { passive: true });

document.getElementById("backBtn").addEventListener("click", goBack);

if (!DATA_OK) {
  app.innerHTML = `<div class="empty"><div class="ic">⚠️</div><h2>Daten-Fehler</h2>
    <p class="muted">Die Fragen-Datenbank enthält einen Formatfehler. Details in der Konsole.</p></div>`;
} else {
  // Serie ggf. zurücksetzen, wenn mehr als ein Tag ausgelassen wurde (Gnadentag erlaubt
  // genau einen verpassten Tag). Nur Anzeige-Konsistenz beim Start.
  const t = todayStr();
  if (S.lastActiveDay && daysBetween(S.lastActiveDay, t) > 2) { S.streak = 0; saveState(); }
  go("home", { replace: true });   // Basis-Eintrag des Verlaufs
  window.addEventListener("popstate", onPopState);

  // Erststart-Begrüßung nur für wirklich neue Nutzer (kein Fortschritt, nie gesehen).
  try { if (!isOnboarded() && S.totalAnswered === 0) showOnboarding(); }
  catch (e) { console.warn("Onboarding übersprungen", e); }

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
      // Bei Rückkehr in die App auf einen neuen Service Worker prüfen (selten – die
      // App-Shell hält sich per stale-while-revalidate ohnehin selbst aktuell).
      document.addEventListener("visibilitychange", () => { if (!document.hidden) { try { reg.update(); } catch (e) {} } });
    }).catch((err) => console.warn("SW-Registrierung fehlgeschlagen", err));

    // Neu laden nur, wenn der Nutzer das Update bestätigt hat (verhindert
    // einen unnötigen Reload beim ersten clients.claim).
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!swUpdateAccepted || reloaded) return; reloaded = true; location.reload();
    });
  });
}
