/* ADT Trainer – App-Logik (Vanilla JS, keine Abhängigkeiten, offline-fähig). */
"use strict";

/* ------------------------------------------------------------------ *
 * 0) Datenvalidierung – schützt vor fehlerhaften Fragen-Einträgen
 * ------------------------------------------------------------------ */
/* Prüft jede Frage einzeln. Eine fehlerhafte Frage darf NICHT den ganzen Katalog
   unbrauchbar machen — sie wird aussortiert, gezählt und protokolliert. Abgebrochen wird
   nur, wenn am Ende keine gültige Frage übrig bleibt. */
function questionValid(q, ids) {
  if (!q || !q.id || ids.has(q.id)) { console.error("Frage-Fehler (ID fehlt/doppelt):", q && q.id); return false; }
  if (!TOPICS[q.topic]) { console.error("Frage-Fehler (unbekanntes Thema):", q.id, q.topic); return false; }
  if (!["single", "multi", "numeric", "code"].includes(q.type)) { console.error("Frage-Fehler (unbekannter Typ):", q.id, q.type); return false; }
  if (typeof q.question !== "string" || !q.question.trim()) { console.error("Frage-Fehler (leerer Fragetext):", q.id); return false; }
  if (q.type === "numeric") {
    // Rechen-/Anwendungsaufgabe: erwartete Zahl + optionale Toleranz statt Optionen.
    if (typeof q.answer !== "number" || !isFinite(q.answer)) { console.error("Frage-Fehler (numeric ohne gültige answer):", q.id); return false; }
    if (q.tolerance != null && (typeof q.tolerance !== "number" || !isFinite(q.tolerance) || q.tolerance < 0)) { console.error("Frage-Fehler (numeric tolerance ungültig):", q.id); return false; }
  } else if (q.type === "code") {
    // Kodier-Aufgabe: erwarteter Kode als Text (z. B. "C50.4", "8500/3") statt Optionen.
    if (typeof q.answer !== "string" || !q.answer.trim()) { console.error("Frage-Fehler (code ohne answer):", q.id); return false; }
    if (q.accept != null && (!Array.isArray(q.accept) || q.accept.some(a => typeof a !== "string" || !a.trim()))) {
      console.error("Frage-Fehler (code accept ungültig):", q.id); return false;
    }
  } else {
    if (!Array.isArray(q.options) || q.options.length < 2) { console.error("Frage-Fehler (Optionen):", q.id); return false; }
    if (!Array.isArray(q.correct) || q.correct.length < 1) { console.error("Frage-Fehler (keine richtige Antwort):", q.id); return false; }
    for (const c of q.correct) if (c < 0 || c >= q.options.length) { console.error("Frage-Fehler (correct-Index außerhalb):", q.id); return false; }
    if (q.type === "single" && q.correct.length !== 1) { console.error("Frage-Fehler (single mit !=1 richtig):", q.id); return false; }
  }
  // image ist optional; wenn gesetzt, nur warnen (kein harter Fehler), da es die
  // Frage selbst nicht unbrauchbar macht — es fehlt dann nur die Abbildung.
  if (q.image != null && (typeof q.image !== "string" || !q.image.startsWith("data:image/"))) {
    console.warn("Frage-Warnung (image kein gültiger data:image/-URI):", q.id);
  }
  return true;
}
let DATA_SKIPPED = 0;   // Anzahl der beim letzten Check aussortierten Fragen
function checkData() {
  if (typeof QUESTIONS === "undefined" || !Array.isArray(QUESTIONS) || !QUESTIONS.length) return false;
  const ids = new Set(), gut = [];
  for (const q of QUESTIONS) { if (questionValid(q, ids)) { ids.add(q.id); gut.push(q); } }
  DATA_SKIPPED = QUESTIONS.length - gut.length;
  if (!gut.length) return false;                  // nichts Brauchbares übrig → harter Fehler
  if (DATA_SKIPPED) { console.warn(`${DATA_SKIPPED} fehlerhafte Frage(n) übersprungen.`); window.QUESTIONS = gut; }
  return true;
}
// Wird nach dem Nachladen der freigeschalteten Inhalte erneut ausgewertet (siehe boot()).
let DATA_OK = checkData();

/* ------------------------------------------------------------------ *
 * 1) Persistenter Zustand (localStorage, robust gegen Defekte)
 * ------------------------------------------------------------------ */
const STORE_KEY = "adt_trainer_state_v1";   // NIE umbenennen – siehe workbook.md („Speicherstände sind heilig")
const SCHEMA_VERSION = 5;                     // bei Datenmodell-Änderungen erhöhen UND Migration ergänzen

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
  orphanQuestions: {},          // Fortschritt zu IDs, die der aktuelle Katalog nicht kennt
  reports: {},                  // id -> { on, at, note } — als „fragwürdig" gemeldete Fragen
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
  // v2 -> v3: Feld `reports` (als „fragwürdig" gemeldete Fragen) ergänzt. Rein additiv –
  // es gibt nichts umzurechnen; sanitizeState() legt das leere Objekt an. Die Version wird
  // trotzdem erhöht, damit das Datenmodell und die Migrationskette lückenlos dokumentiert sind.
  3: (s) => s,
  // v3 -> v4: Beobachtungsdaten je Frage (`first`, `lastAt`) für die künftige
  // Bereitschafts-Schätzung (Konzept: workbook.md → „Prüfungsbereitschaft aus
  // Beobachtungsdaten"). Rein additiv; der Erstversuch lässt sich für einen Teil
  // des Altbestands eindeutig rekonstruieren:
  //   seen == 1        -> der eine Versuch IST der erste
  //   wrong == 0       -> alle richtig, also auch der erste
  //   correct == 0     -> alle falsch, also auch der erste
  //   sonst            -> Reihenfolge unbekannt, bleibt null (zählt später nicht mit)
  // `lastAt` kann nicht rekonstruiert werden (nie gespeichert) und bleibt leer –
  // die Schätzung behandelt fehlende Werte als „unbekannt", nicht als „heute".
  4: (s) => {
    const pq = (s && s.perQuestion && typeof s.perQuestion === "object") ? s.perQuestion : {};
    for (const id of Object.keys(pq)) {
      const p = pq[id] || {};
      if (p.first === "correct" || p.first === "wrong") continue;   // schon gesetzt
      const seen = Math.max(0, Math.floor(Number(p.seen) || 0));
      const corr = Math.max(0, Math.floor(Number(p.correct) || 0));
      const wrong = Math.max(0, Math.floor(Number(p.wrong) || 0));
      let first = null;
      if (seen === 1) first = (p.lastResult === "correct" || p.lastResult === "wrong") ? p.lastResult : null;
      else if (seen > 1 && wrong === 0 && corr > 0) first = "correct";
      else if (seen > 1 && corr === 0 && wrong > 0) first = "wrong";
      p.first = first;
      pq[id] = p;
    }
    return s;
  },
  // v4 -> v5: Beobachtung ist nicht mehr nur der ERSTE Kontakt, sondern der jeweils
  // letzte „kalte" Abruf (`cold`, `coldAt`) – also jede Antwort auf eine Frage, die
  // an diesem Tag noch nicht dran war. Begründung: Der Erstversuch altert nie weg;
  // eine anfangs falsche, inzwischen gelernte Frage bliebe für immer als „falsch"
  // gebucht. Der Startwert ist genau der Erstversuch – der IST ein kalter Abruf.
  5: (s) => {
    const pq = (s && s.perQuestion && typeof s.perQuestion === "object") ? s.perQuestion : {};
    for (const id of Object.keys(pq)) {
      const p = pq[id] || {};
      if (p.cold === "correct" || p.cold === "wrong") continue;
      p.cold = (p.first === "correct" || p.first === "wrong") ? p.first : null;
      p.coldAt = p.cold ? (p.lastAt || null) : null;
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

/* Grenzen für gemeldete Fragen (Details siehe Abschnitt „Fragen melden").
   Hier oben deklariert, weil sanitizeState() sie braucht. */
const REPORT_MAX = 300;        // gleichzeitig aktive Meldungen
const REPORT_NOTE_MAX = 300;   // Zeichen je Notiz
const REPORT_KEEP = 600;       // gespeicherte Einträge inkl. „aufgehoben"-Vermerke

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
  // Nur filtern, wenn der ECHTE Katalog geladen ist. Läuft die App noch mit dem
  // Beispielkatalog (Inhalte nicht hydratisiert), würde sonst der gesamte Fortschritt
  // verworfen — „Speicherstände sind heilig".
  const knownQ = (CONTENT_READY && typeof QUESTIONS !== "undefined" && Array.isArray(QUESTIONS) && QUESTIONS.length)
    ? new Set(QUESTIONS.map(q => q.id)) : null;
  const rawPq = (src.perQuestion && typeof src.perQuestion === "object") ? src.perQuestion : {};
  // Fortschritt zu unbekannten IDs wird nicht gelöscht, sondern geparkt: Wird eine Frage-ID
  // in einem späteren Katalog wieder gültig (Umbenennung, versehentlich entfallene Frage),
  // kommt der Lernstand zurück.
  const rawOrph = (src.orphanQuestions && typeof src.orphanQuestions === "object") ? src.orphanQuestions : {};
  s.orphanQuestions = {};
  for (const id of Object.keys(rawOrph)) {
    if (knownQ && knownQ.has(id)) rawPq[id] = rawPq[id] || rawOrph[id];   // wieder gültig → zurückholen
    else s.orphanQuestions[id] = rawOrph[id];
  }
  for (const id of Object.keys(rawPq)) {
    if (knownQ && !knownQ.has(id)) { s.orphanQuestions[id] = rawPq[id]; continue; }
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
      // Beobachtungsdaten für die Bereitschafts-Schätzung (Konzept in workbook.md):
      // `first` = Ergebnis des ERSTEN Kontakts (generalisiert auf ungesehenen Stoff),
      // `lastAt` = Datum der letzten Antwort (trennt echten Abruf vom Echo derselben Sitzung).
      first: (p.first === "correct" || p.first === "wrong") ? p.first : null,
      lastAt: /^\d{4}-\d{2}-\d{2}$/.test(String(p.lastAt || "")) ? p.lastAt : null,
      // `cold` = Ergebnis des letzten KALTEN Abrufs (Frage war an dem Tag noch nicht dran),
      // `coldAt` dessen Datum. Das ist die Beobachtung, die die Prognose auswertet.
      cold: (p.cold === "correct" || p.cold === "wrong") ? p.cold : null,
      coldAt: /^\d{4}-\d{2}-\d{2}$/.test(String(p.coldAt || "")) ? p.coldAt : null,
    };
  }
  const rawBg = (src.badges && typeof src.badges === "object") ? src.badges : {};
  for (const k of Object.keys(rawBg)) s.badges[k] = rawBg[k];
  // Meldungen („fragwürdige" Fragen): bewusst NICHT nach bekannten IDs gefiltert – sie sind
  // Feedback ZUM Katalog und sollen einen Katalog-Wechsel überleben (sonst verschwände genau
  // die Rückmeldung zu einer Frage, die deshalb geändert wurde). Nur Form und Menge begrenzen.
  const rawRep = (src.reports && typeof src.reports === "object") ? src.reports : {};
  s.reports = {};
  const repEntries = Object.keys(rawRep)
    .filter(id => typeof id === "string" && id.length <= 80)
    .map(id => {
      const r = rawRep[id] || {};
      return [id, {
        on: r.on === true,
        at: typeof r.at === "string" ? r.at.slice(0, 40) : "",
        note: typeof r.note === "string" ? r.note.slice(0, REPORT_NOTE_MAX) : "",
        issuedAt: typeof r.issuedAt === "string" ? r.issuedAt.slice(0, 40) : "",
        issueNumber: Math.max(0, Math.floor(Number(r.issueNumber) || 0)),
        issueUrl: (typeof r.issueUrl === "string" && /^https:\/\/github\.com\//.test(r.issueUrl)) ? r.issueUrl.slice(0, 300) : "",
      }];
    })
    // Aktive Meldungen zuerst, danach die neuesten – so überlebt beim Kappen das Wichtigste.
    .sort((a, b) => (Number(b[1].on) - Number(a[1].on)) || String(b[1].at).localeCompare(String(a[1].at)))
    .slice(0, REPORT_KEEP);
  for (const [id, r] of repEntries) s.reports[id] = r;
  return s;
}

/* Beschädigten Stand nie kommentarlos wegwerfen: Rohwert aufheben, Schattenkopie
   versuchen, Nutzer informieren. */
const STATE_BAK_KEY = STORE_KEY + ".bak";
let stateRecovered = null;      // "bak" | "verloren" — für einen Hinweis nach dem Start
function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) {}
  if (!raw) {
    try { const b = localStorage.getItem(STATE_BAK_KEY); if (b) { stateRecovered = "bak"; return sanitizeState(migrate(JSON.parse(b))); } } catch (e) {}
    return freshState();
  }
  try {
    const s = sanitizeState(migrate(JSON.parse(raw)));
    try { localStorage.setItem(STATE_BAK_KEY, raw); } catch (e) {}   // Schattenkopie des letzten guten Stands
    return s;
  } catch (e) {
    console.warn("State beschädigt.", e);
    try { localStorage.setItem(STORE_KEY + ".corrupt." + Date.now(), raw.slice(0, 200000)); } catch (_) {}
    try {
      const b = localStorage.getItem(STATE_BAK_KEY);
      if (b) { stateRecovered = "bak"; return sanitizeState(migrate(JSON.parse(b))); }
    } catch (_) {}
    stateRecovered = "verloren";
    return freshState();
  }
}
/* Wird erst in boot() nach hydrateContent() belegt — vorher steht der echte Katalog
   noch nicht bereit und sanitizeState() dürfte nicht filtern (siehe knownQ). */
let CONTENT_READY = false;
let S = freshState();
let WRITE_LOCK = false;         // bei hartem Ladefehler: nichts überschreiben
let saveTimer = null;
let quotaWarned = false;
function persistLocal() {
  if (WRITE_LOCK) return false;      // Katalog nicht geladen → Stand nicht überschreiben
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
function bumpToday(n) { try { const c = getToday() + (n || 0); localStorage.setItem(TODAY_KEY, JSON.stringify({ date: todayStr(), count: c })); logMastery(); return c; } catch { return 0; } }
function isOnboarded() { try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch { return true; } }
function setOnboarded() { try { localStorage.setItem(ONBOARD_KEY, "1"); } catch (e) {} }

/* ---- Zugangsschutz für Lerninhalte (Zugangscode → serverseitige Prüfung) ---- */
const CONTENT_KEY = "adt_content_v1";        // lokal gecachte, freigeschaltete Inhalte
const CONTENT_CODE_KEY = "adt_content_code"; // Code (für stille Hintergrund-Aktualisierung)
// Gespeicherter Zugangscode – dient auch als Ausweis gegenüber der Issue-Funktion.
function getContentCode() { try { return localStorage.getItem(CONTENT_CODE_KEY) || ""; } catch { return ""; } }
function contentGateActive() { return !!(window.ADT_CONFIG && window.ADT_CONFIG.contentGated); }
function contentUnlocked() {
  try { return !!localStorage.getItem(CONTENT_KEY) || localStorage.getItem(CONTENT_IDB_FLAG) === "1"; }
  catch { return false; }
}
/* Ablage der freigeschalteten Inhalte.
   localStorage allein reicht nicht: Der Katalog hat ~3,9 Mio. Zeichen, und localStorage
   speichert UTF-16 → ~7,4 MB effektiv. iOS Safari erlaubt dort nur ~5 MB, `setItem` wirft
   dann QuotaExceededError. Deshalb liegen die Inhalte in IndexedDB (viel größeres Kontingent);
   in localStorage bleibt nur eine kleine Markierung, damit der Startcheck synchron bleibt.
   localStorage wird weiter als Fallback für kleine Kataloge unterstützt (Altstände). */
const CONTENT_IDB_FLAG = "adt_content_idb";   // "1" = Inhalte liegen in IndexedDB
const CONTENT_FP_KEY = "adt_content_fp";      // Fingerabdruck des gespeicherten Katalogs

/* Fingerabdruck über Anzahl, IDs und Inhalt jeder Frage. Erkennt auch Korrekturen, die
   die Fragenzahl nicht ändern (umformulierter Fragetext, korrigierte Option/Erklärung).
   Läuft ohne den 4-MB-String zu bauen – 32-Bit-Rollhash je Feld. */
function contentFingerprint(content) {
  try {
    const Q = content.QUESTIONS;
    if (!Array.isArray(Q)) return "";
    let h = 2166136261;
    const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } };
    const S1 = "";                       // Feldtrenner: verhindert, dass sich
    for (const q of Q) {                       // Verschiebungen zwischen Feldern ausgleichen
      mix(q.id || ""); mix(S1); mix(q.topic || ""); mix(S1); mix(q.type || ""); mix(S1);
      mix(String(q.difficulty == null ? "" : q.difficulty)); mix(S1);
      mix(q.question || ""); mix(S1); mix(q.explanation || ""); mix(S1);
      mix(q.unit || ""); mix(S1); mix(String(q.tolerance == null ? "" : q.tolerance)); mix(S1);
      if (Array.isArray(q.options)) for (const o of q.options) { mix(String(o)); mix(S1); }
      if (Array.isArray(q.correct)) mix(q.correct.join(","));
      if (q.answer != null) mix(String(q.answer));
      mix(S1);
    }
    mix(JSON.stringify(content.TOPICS || {}));  // Themennamen, Farben, Zuordnungen
    return `${Q.length}.${Object.keys(content.TOPICS || {}).length}.${h.toString(36)}`;
  } catch (e) { return ""; }
}
const IDB_NAME = "adt_content";
const IDB_STORE = "kv";
const IDB_KEY = "content_v1";

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB nicht verfügbar"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB-Fehler"));
    // WebKit-Eigenheit: ein blockierter Request feuert sonst gar kein Ereignis mehr.
    req.onblocked = () => reject(new Error("IndexedDB blockiert"));
  });
}
/* IndexedDB kann in Safari nach dem Wiederherstellen einer PWA hängen bleiben, ohne je
   ein Ereignis zu feuern. Ohne Zeitgrenze bliebe boot() für immer stehen → weiße Seite. */
function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(label || "timeout")), ms))]);
}
function idbPut(value) {
  return idbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, IDB_KEY);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error("Schreiben fehlgeschlagen")); };
  }));
}
function idbGet() {
  return idbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const rq = tx.objectStore(IDB_STORE).get(IDB_KEY);
    rq.onsuccess = () => { const v = rq.result; db.close(); resolve(v || null); };
    rq.onerror = () => { db.close(); reject(rq.error || new Error("Lesen fehlgeschlagen")); };
  }));
}
function idbDelete() {
  return idbOpen().then((db) => new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    tx.oncomplete = tx.onabort = tx.onerror = () => { db.close(); resolve(true); };
  })).catch(() => true);
}

/* Speichert die Inhalte. Rückgabe: "ok" | "quota" | "fehler" — damit der
   Freischalt-Bildschirm einen Speicherfehler nicht als „falscher Code" ausgibt. */
async function storeUnlockedContent(content, code) {
  const payload = { TOPICS: content.TOPICS, QUESTIONS: content.QUESTIONS, VERSION: content.VERSION || "" };
  try {
    await idbPut(payload);
    try {
      localStorage.setItem(CONTENT_IDB_FLAG, "1");
      localStorage.removeItem(CONTENT_KEY);      // Altstand aus localStorage räumen
      if (code) localStorage.setItem(CONTENT_CODE_KEY, code);
    } catch (e) { /* Markierung ist klein; scheitert praktisch nie */ }
    return "ok";
  } catch (e) {
    console.warn("IndexedDB nicht nutzbar, versuche localStorage", e && e.message);
  }
  try {
    localStorage.setItem(CONTENT_KEY, JSON.stringify(payload));
    // Markierung MUSS weg, sonst liest hydrateContent() beim nächsten Start weiter den
    // alten IndexedDB-Datensatz und überschreibt den soeben gespeicherten neuen Katalog.
    try { localStorage.removeItem(CONTENT_IDB_FLAG); } catch (e) {}
    idbDelete();
    if (code) localStorage.setItem(CONTENT_CODE_KEY, code);
    return "ok";
  } catch (e) {
    const quota = e && (e.name === "QuotaExceededError" || e.code === 22 || /quota/i.test(e.message || ""));
    return quota ? "quota" : "fehler";
  }
}

/* Inhalte aus IndexedDB in die App holen. Muss VOR loadState() laufen: sanitizeState()
   verwirft Fortschritt zu unbekannten Frage-IDs, und „unbekannt" wäre sonst alles, was
   nicht im Beispielkatalog steht.
   Rückgabe: "ok" (geladen) | "leer" (keine IDB-Inhalte erwartet) | "fehler" (erwartet,
   aber nicht lesbar — dann darf NICHT stillschweigend der Beispielkatalog gelten). */
async function hydrateContent() {
  let erwartet = false;
  try { erwartet = localStorage.getItem(CONTENT_IDB_FLAG) === "1"; } catch (e) {}
  if (!erwartet) return "leer";
  try {
    const c = await withTimeout(idbGet(), 8000, "idb-timeout");
    if (!c || !c.TOPICS || !Array.isArray(c.QUESTIONS) || !c.QUESTIONS.length) return "fehler";
    window.TOPICS = c.TOPICS; window.QUESTIONS = c.QUESTIONS; window.CONTENT_VERSION = c.VERSION || "";
    return "ok";
  } catch (e) { console.warn("Inhalte konnten nicht geladen werden", e && e.message); return "fehler"; }
}
// Stille Aktualisierung: neue Inhalte greifen beim nächsten Start.
async function refreshContentInBackground() {
  try {
    if (!contentUnlocked() || !navigator.onLine || !window.ADTSync) return;
    const code = localStorage.getItem(CONTENT_CODE_KEY);
    if (!code) return;
    const content = await ADTSync.getContent(code);
    if (!content || !content.TOPICS || !Array.isArray(content.QUESTIONS) || !content.QUESTIONS.length) return;
    // Nur schreiben, wenn sich wirklich etwas geändert hat (spart Schreibzugriffe).
    // Der Vergleich darf NICHT nur die Anzahl prüfen: Korrekturen an Fragetexten,
    // Optionen oder Erklärungen ändern die Anzahl nicht und würden sonst nie ankommen.
    const fp = contentFingerprint(content);
    if (fp && fp === localStorage.getItem(CONTENT_FP_KEY)) return;
    if (await storeUnlockedContent(content, code) === "ok") {
      try { localStorage.setItem(CONTENT_FP_KEY, fp); } catch (e) {}
    }
  } catch (e) {}
}

/* ---- Prüfungs-Historie (geräte-lokal, für die Statistik) ---- */
const EXAMHIST_KEY = "adt_exam_history";
function getExamHistory() { try { const a = JSON.parse(localStorage.getItem(EXAMHIST_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }
function pushExamHistory(pct) {
  try {
    const a = getExamHistory();
    a.push({ d: new Date().toISOString(), pct: Math.max(0, Math.min(100, Math.round(pct))) });
    while (a.length > 30) a.shift();               // nur die letzten 30 behalten
    localStorage.setItem(EXAMHIST_KEY, JSON.stringify(a));
  } catch (e) {}
}

/* ---- App-Einstellungen (geräte-lokal) ---- */
const SIZE_KEY = "adt_session_size";   // Fragen pro Übungsrunde (0 = alle)
const THEME_KEY = "adt_theme";          // "auto" | "light" | "dark"
const FONT_KEY = "adt_fontsize";        // "normal" | "large"
function getFontSize() { try { return localStorage.getItem(FONT_KEY) === "large" ? "large" : "normal"; } catch { return "normal"; } }
function setFontSize(v) { try { v === "large" ? localStorage.setItem(FONT_KEY, "large") : localStorage.removeItem(FONT_KEY); } catch (e) {} applyFontSize(); }
function applyFontSize() { document.documentElement.setAttribute("data-fontsize", getFontSize()); }
const SIZE_CHOICES = [10, 15, 20, 30, 0];
function getSessionSize() { try { const v = parseInt(localStorage.getItem(SIZE_KEY), 10); return SIZE_CHOICES.includes(v) ? v : 15; } catch { return 15; } }
function setSessionSize(n) { try { localStorage.setItem(SIZE_KEY, String(n)); } catch (e) {} }
const HAPTICS_KEY = "adt_haptics";      // "on" | "off"
function getHaptics() { try { return localStorage.getItem(HAPTICS_KEY) !== "off"; } catch { return true; } }
function setHaptics(on) { try { localStorage.setItem(HAPTICS_KEY, on ? "on" : "off"); } catch (e) {} }
function reduceMotion() { try { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } }
// Kurzes haptisches Feedback (funktioniert v. a. auf Android; auf iPhone eingeschränkt).
function hapticFeedback(ok) {
  if (!getHaptics()) return;
  try { if (navigator.vibrate) navigator.vibrate(ok ? 15 : [8, 30, 8]); } catch (e) {}
}
// Kleiner Konfetti-Regen für Erfolgsmomente (respektiert „Bewegung reduzieren").
function celebrate() {
  if (reduceMotion()) return;
  const colors = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#5e5ce6"];
  const layer = document.createElement("div");
  layer.className = "confetti"; layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 80; i++) {
    const s = document.createElement("i");
    s.style.left = Math.round(Math.random() * 100) + "%";
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = (Math.random() * 0.35).toFixed(2) + "s";
    s.style.animationDuration = (1.8 + Math.random() * 1.2).toFixed(2) + "s";
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}
function getTheme() { try { const v = localStorage.getItem(THEME_KEY); return (v === "light" || v === "dark") ? v : "auto"; } catch { return "auto"; } }
function setTheme(t) { try { t === "auto" ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(); }
// „auto" folgt dem System (kein data-theme → CSS-Media-Query greift); sonst fest überschreiben.
function applyTheme() {
  const t = getTheme();
  const root = document.documentElement;
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  else root.removeAttribute("data-theme");
}
applyTheme(); applyFontSize();   // so früh wie möglich anwenden (vermeidet Flackern)

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

/* ---- Prüfungstermin: nur Countdown ----
 * Historie (bewusst dokumentiert, damit der Fehler nicht zurückkehrt): Die Wochenzahl
 * steuerte früher die Zielmarke der „Prüfungsbereitschaft". Das war falsch — wer weniger
 * Lernzeit eintrug, galt bei identischem Wissen früher als bereit. Bereitschaft ist eine
 * Eigenschaft des Könnens, nicht des Plans. Die Bewertung läuft jetzt über
 * passProbability(); diese Einstellung dient ausschließlich dem Countdown. */
const STUDY_WEEKS_CHOICES = [1, 2, 3, 4, 6, 8, 12];
const STUDY_WEEKS_KEY = "adt_study_weeks";
// "X Wochen bis zur Prüfung" muss wirklich runterzählen, sonst zeigte der Countdown
// jeden Tag aufs Neue "X Wochen ab jetzt". STUDY_START_KEY hält den Tag fest, ab dem
// gezählt wird – erster Aufruf oder jede Änderung der Wochenzahl setzt ihn neu.
const STUDY_START_KEY = "adt_study_start";
function getStudyWeeks() { try { const v = parseInt(localStorage.getItem(STUDY_WEEKS_KEY), 10); return STUDY_WEEKS_CHOICES.includes(v) ? v : 4; } catch { return 4; } }
function setStudyWeeks(n) { try { localStorage.setItem(STUDY_WEEKS_KEY, String(n)); resetStudyStart(); } catch (e) {} }
function getStudyStart() {
  try {
    let d = localStorage.getItem(STUDY_START_KEY);
    if (!d) { d = todayStr(); localStorage.setItem(STUDY_START_KEY, d); }
    return d;
  } catch { return todayStr(); }
}
function resetStudyStart() { try { localStorage.setItem(STUDY_START_KEY, todayStr()); } catch (e) {} }
// Tage, die von der geplanten Vorbereitungszeit noch übrig sind (kann nicht
// unter 0 fallen, sobald die geplanten Wochen verstrichen sind).
function remainingStudyDays() {
  return Math.max(0, getStudyWeeks() * 7 - daysBetween(getStudyStart(), todayStr()));
}


/* ---- Bestehenswahrscheinlichkeit ----
 * Statt einer willkürlichen Schwelle („2× ≥ 65 %") die direkte Frage beantworten:
 * Wie wahrscheinlich erreicht sie in einer Prüfung die 50-%-Grenze?
 *
 * Verfahren: je Prüfungsblock ein Beta-Posterior aus ihren Antworten, gewichtet nach
 * der echten Prüfung (40/50/10), daraus eine Beta-Binomial-Vorhersage über eine
 * Prüfung mit EXAM_ASSUMED_N Fragen. Zwei Unsicherheiten stecken darin:
 *   1. Wie gut ist sie wirklich? (schrumpft mit jeder Antwort)
 *   2. Wie fällt die Prüfung aus? (bleibt — die Prüfung ist selbst eine Stichprobe)
 * Deshalb steigt die Zahl bei knappem Können auch mit sehr vielen Antworten nicht
 * über ~95 %: das ist ehrlich, kein Rechenfehler.
 *
 * Robustheit geprüft: Ob die echte Prüfung 30 oder 120 Fragen hat, verschiebt das
 * Ergebnis bei 65 % Trefferquote nur von 95 % auf 99 %; der Klumpungsfaktor (1,0–3,0)
 * bewegt es um unter 5 Punkte. Die beiden geschätzten Größen sind also unkritisch.
 *
 * WICHTIG: Die Zahl gilt für UNSEREN Katalog. Die echte Prüfung hat andere Fragen und
 * den Aufgabentyp „Code eingeben", den wir nicht haben — ein Gültigkeits-, kein
 * Stichprobenproblem. Die Anzeige benennt das. */
const EXAM_ASSUMED_N = 60;      // angenommene Fragenzahl der echten Prüfung (unkritisch, s. o.)
const EXAM_PASS_RATIO = 0.5;    // Bestehensgrenze laut Prüfungsordnung
const CLUSTER_DEFF = 1.6;       // Klumpung: Ø 2,2 Fragen je Folie, ρ konservativ 0,5 -> ANNAHME
const PASSPROB_MIN_N = 30;
// Ein Abruf gilt als „kalt", wenn die Frage seit mindestens so vielen Tagen nicht dran war.
// 1 Tag schließt das Echo derselben Sitzung aus (Wiedererkennen statt Wissen) und ist bei
// vier Wochen Restzeit die Schwelle, die überhaupt genug Beobachtungen liefert.
const COLD_GAP_DAYS = 1;      // darunter keine Zahl zeigen, sondern „sammelt Daten"

// P(X >= kmin) für X ~ BetaBinomial(N, a, b) – rekursiv, ohne Spezialfunktionen.
function betaBinomTailGE(kmin, N, a, b) {
  let f = 1;
  for (let i = 0; i < N; i++) f *= (b + i) / (a + b + i);   // f(0)
  let sum = kmin <= 0 ? f : 0;
  for (let k = 0; k < N; k++) {
    f *= ((N - k) / (k + 1)) * ((a + k) / (b + N - k - 1)); // f(k+1)/f(k)
    if (k + 1 >= kmin) sum += f;
  }
  return Math.min(1, Math.max(0, sum));
}

/* Eine Beobachtung je Frage – niemals Zähler summieren (der Cloud-Merge nimmt je Feld
 * das Maximum, wodurch correct+wrong > seen entstehen kann; als Stichprobe wäre das
 * unbrauchbar). Gezählt wird der LETZTE KALTE ABRUF (`cold`): jede Antwort auf eine
 * Frage, die an dem Tag nicht schon dran war – der Erstkontakt eingeschlossen.
 *
 * Warum nicht nur der Erstversuch: Der misst zwar sauber „ungesehener Stoff", altert aber
 * nie weg. Eine Frage, die im ersten Anlauf danebenging und inzwischen dreimal richtig
 * beantwortet wurde, bliebe für immer als Fehler gebucht – die Prognose könnte dem
 * Lernfortschritt nie folgen. Warum nicht jede Antwort: Direkt nach der Auflösung ist
 * eine Wiederholung Wiedererkennen, kein Abruf; das würde die Quote hochziehen.
 * Der kalte Abruf am Folgetag ist der Kompromiss, den auch die Lernforschung nimmt.
 *
 * Zwei bekannte Verzerrungen, beide nach oben:
 *  - Die Wiederholung ist nicht zufällig: Leitner legt falsche Fragen früher wieder vor,
 *    richtige seltener. Aufstufungen kommen also häufiger vor als Abstufungen.
 *  - Für Fragen aus der Zeit vor v0.41.0 ist der Startwert nur dort bekannt, wo die
 *    Historie eindeutig war (immer richtig / immer falsch / einmal gesehen); gemischte
 *    Altfragen fehlen, und das sind eher die schwierigen.
 * Beides steht als Vorbehalt auf der Karte. */
function passObservations() {
  const acc = { K: { n: 0, x: 0 }, C: { n: 0, x: 0 }, S: { n: 0, x: 0 } };
  for (const q of QUESTIONS) {
    const p = S.perQuestion[q.id];
    if (!p) continue;
    const o = (p.cold === "correct" || p.cold === "wrong") ? p.cold
            : ((p.first === "correct" || p.first === "wrong") ? p.first : null);   // Altdaten ohne Migration
    if (!o) continue;
    const b = acc[examBlockOf(q)];
    b.n++; if (o === "correct") b.x++;
  }
  return acc;
}

/* `obs` ist optional – ohne Argument werden die echten Beobachtungen genommen.
 * Der Parameter existiert, damit die Rechnung mit festen Zahlen prüfbar ist,
 * unabhängig davon, wie groß der geladene Katalog gerade ist. */
function passProbability(obs) {
  obs = obs || passObservations();
  const blocks = ["K", "C", "S"].filter(b => obs[b].n > 0);
  const gesamtN = ["K", "C", "S"].reduce((s, b) => s + obs[b].n, 0);
  if (!blocks.length || gesamtN < PASSPROB_MIN_N) {
    return { genug: false, n: gesamtN, fehlt: PASSPROB_MIN_N - gesamtN, obs };
  }
  // Gewichte der echten Prüfung, auf die Blöcke mit Daten normiert
  const wSum = blocks.reduce((s, b) => s + EXAM_BLUEPRINT[b], 0);
  let m = 0, v = 0;
  for (const b of blocks) {
    const w = EXAM_BLUEPRINT[b] / wSum;
    const ne = obs[b].n / CLUSTER_DEFF, xe = obs[b].x / CLUSTER_DEFF;
    const mb = (xe + 1) / (ne + 2);                 // Beta-Posterior-Mittel (Laplace)
    const vb = mb * (1 - mb) / (ne + 3);            // dessen Varianz
    m += w * mb; v += w * w * vb;
  }
  // Momentenmethode: gewichtetes Mittel -> Beta(a, b)
  let a, bb;
  const common = v > 0 ? (m * (1 - m) / v - 1) : 0;
  if (common > 0) { a = m * common; bb = (1 - m) * common; }
  else { a = 1 + m; bb = 1 + (1 - m); }             // Rückfall, sollte nicht vorkommen
  const p = betaBinomTailGE(Math.ceil(EXAM_ASSUMED_N * EXAM_PASS_RATIO), EXAM_ASSUMED_N, a, bb);
  const ohneDaten = ["K", "C", "S"].filter(b => obs[b].n === 0);
  return { genug: true, p, n: gesamtN, obs, ohneDaten, schnitt: m };
}

// Sprachliche Einordnung – nie „du bestehst", immer als Aussage über die Daten.
function passLabel(p) {
  if (p >= 0.95) return { txt: "sehr zuversichtlich", col: "var(--success)" };
  if (p >= 0.85) return { txt: "zuversichtlich", col: "var(--success)" };
  if (p >= 0.60) return { txt: "auf gutem Weg", col: "#ffcc00" };
  if (p >= 0.35) return { txt: "noch offen", col: "#ff9500" };
  return { txt: "noch nicht so weit", col: "#ff9500" };
}
function passPctText(p) {
  if (p > 0.99) return "> 99 %";          // nie 100 % behaupten – Modellgrenzen
  if (p < 0.01) return "< 1 %";
  return Math.round(p * 100) + " %";
}

/* Eine Karte, zwei Ansichten: kompakt (Startseite, tippbar → Statistik) und
 * ausführlich (Statistik, mit Begründung). Ein Renderer, damit nichts divergiert. */
function readinessCardHTML(detailed) {
  logMastery();
  if (!QUESTIONS.length) return "";
  const pp = passProbability();

  // Hauptaussage ist die Bestehenswahrscheinlichkeit – objektiv, von keiner
  // Einstellung beeinflussbar. Die Lernzeit-Hochrechnung ist bewusst NICHT mehr Teil
  // des Urteils (sie steckt in der getrennten Planungsanzeige), weil sonst gälte:
  // weniger Lernzeit eintragen = früher „bereit" bei identischem Wissen.
  if (!pp.genug) {
    const txt = `Noch ${pp.fehlt} Fragen bis zur ersten Einschätzung – dann rechnet die App aus,
      wie wahrscheinlich du bestehst.`;
    const head0 = `<span class="ready-head"><b>Prüfungsprognose</b><span class="ready-label" style="color:var(--text-dim)">sammelt Daten</span></span>`;
    if (!detailed) {
      return `<button class="ready-card" data-act="mixed" aria-label="Prüfungsprognose: noch ${pp.fehlt} Fragen bis zur ersten Einschätzung">
        ${head0}<span class="ready-sub">${txt}</span>
        <span class="ready-sub" style="color:var(--primary)">→ Weiter üben</span></button>`;
    }
    return `<div class="ready-card static">${head0}<span class="ready-sub">${txt}</span>
      <span class="ready-sub muted" style="margin-top:6px">Grundlage ist dein Ergebnis bei <b>kalten Abrufen</b> – also jedes Mal, wenn eine
      Frage kam, die an dem Tag noch nicht dran war. Nur das sagt etwas über Stoff aus, den du nicht gerade eben gelesen hast.</span></div>`;
  }

  const lbl = passLabel(pp.p);
  const pct = passPctText(pp.p);
  const balken = Math.round(pp.p * 100);
  const head = `<span class="ready-head"><b>Prüfungsprognose</b><span class="ready-label" style="color:${lbl.col}">${lbl.txt}</span></span>`;
  const bar = `<span class="ready-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${balken}">
      <span class="fill" style="width:${balken}%;background:${lbl.col}"></span>
      <span class="mark" style="left:50%" title="Bestehensgrenze der echten Prüfung"></span>
    </span>`;
  const kern = `<span class="ready-sub"><b style="font-size:15px;color:${lbl.col}">${pct}</b> – aus ${pp.n.toLocaleString("de-DE")} kalt abgerufenen Fragen</span>`;

  if (!detailed) {
    return `<button class="ready-card" data-act="stats" aria-label="Prüfungsprognose ${pct}, ${lbl.txt}">
      ${head}${bar}${kern}
    </button>`;
  }

  // Blockweise Aufschlüsselung: wo hakt es?
  const blockRows = ["K", "C", "S"].map(b => {
    const o = pp.obs[b];
    const anteil = o.n ? Math.round(o.x / o.n * 100) : null;
    const wert = anteil === null ? "noch keine Daten" : `${anteil} % richtig (${o.n} Fragen)`;
    return `<div class="theme-row"><span class="tn">${EXAM_BLOCK_NAMES[b]}<br><span class="muted" style="font-size:12px">${EXAM_BLUEPRINT[b]} % der Prüfung</span></span>
      <span class="tp" style="width:auto;text-align:right">${wert}</span></div>`;
  }).join("");

  const hinweis = pp.ohneDaten.length
    ? `<span class="ready-sub" style="color:#ff9500">Für ${pp.ohneDaten.map(b => EXAM_BLOCK_NAMES[b]).join(" und ")} liegen noch keine Daten vor – die Zahl stützt sich nur auf die übrigen Blöcke.</span>`
    : "";

  return `<div class="ready-card static">
    ${head}${bar}${kern}
    ${hinweis}
    <div style="margin-top:10px">${blockRows}</div>
    <span class="ready-sub muted" style="margin-top:10px">Gerechnet wird aus deinem Ergebnis bei <b>kalten Abrufen</b>: jede Frage zählt einmal,
      und zwar mit dem letzten Mal, an dem sie kam, ohne an dem Tag schon dran gewesen zu sein. Der erste Kontakt gehört dazu –
      spätere Wiederholungen aber auch, sonst könnte die Zahl deinem Lernfortschritt nie folgen. Gewichtet wird wie die echte Prüfung
      (${EXAM_BLUEPRINT.K}/${EXAM_BLUEPRINT.C}/${EXAM_BLUEPRINT.S}), und vorsichtig gerechnet: Fragen zur selben Folie zählen
      nicht als voneinander unabhängig.</span>
    <span class="ready-sub muted" style="margin-top:6px">Zwei Unsicherheiten stecken darin: wie gut du wirklich bist (wird mit jeder
      Antwort genauer) und wie die Prüfung ausfällt (bleibt – sie ist selbst eine Stichprobe). Deshalb steigt der Wert bei knappem
      Stand auch mit viel Übung nicht über ~95 %.</span>
    <span class="ready-sub muted" style="margin-top:6px">Die Zahl ist eher etwas zu freundlich als zu streng: Wiederholungen sind nicht zufällig
      verteilt – falsche Fragen kommen früher zurück als richtige, Verbesserungen fallen also häufiger auf als Verschlechterungen.</span>
    <span class="ready-sub muted" style="margin-top:6px"><b>Vorbehalt:</b> Die Zahl gilt für diesen Fragenkatalog. Die echte Prüfung
      hat andere Fragen und den Aufgabentyp „Code eingeben", den diese App nicht übt.</span>
  </div>`;
}

/* Lerntempo-Log (lokal): einmal je Tag der aktuelle „sicher"-Stand, für die
 * Prognose „bei deinem Tempo bist du in ~N Tagen bereit". */
const MLOG_KEY = "adt_mastery_log";
function logMastery() {
  try {
    const t = todayStr(), m = masteredCount();
    let log = JSON.parse(localStorage.getItem(MLOG_KEY) || "[]");
    if (!Array.isArray(log)) log = [];
    const last = log[log.length - 1];
    if (last && last.d === t) { if (m !== last.m) { last.m = m; localStorage.setItem(MLOG_KEY, JSON.stringify(log)); } return; }
    log.push({ d: t, m });
    if (log.length > 60) log = log.slice(-60);
    localStorage.setItem(MLOG_KEY, JSON.stringify(log));
  } catch (e) {}
}
// Ø neu gesicherte Fragen pro Tag – gemessen am ältesten Log-Eintrag der
// letzten 3 Wochen, der mindestens 3 Tage zurückliegt. Null = noch keine Basis.

/* „Für heute genug": Tagesziel erreicht UND keine Wiederholung mehr fällig.
 * Mehr bringt heute wenig – die Intervalle wirken über Nacht. */
function enoughForToday() {
  return getToday() >= getDailyGoal() && dueQuestions().length === 0;
}
function dueTomorrowCount() {
  const t = addDaysStr(1);
  return QUESTIONS.filter(q => { const p = S.perQuestion[q.id]; return p && p.due && p.due <= t; }).length;
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
function isInputType(q) { return q.type === "numeric" || q.type === "code"; }   // freie Eingabe statt Optionen

/* Kode-Vergleich. Geprüft wird das Wissen „welcher Kode", nicht die Tippgenauigkeit:
 * Groß-/Kleinschreibung, Leerzeichen und die Trennzeichen (Punkt, Komma, Schrägstrich,
 * Bindestrich) werden weggelassen. Damit gilt „c504" ebenso wie „C50.4" und „8500 3"
 * wie „8500/3". Das ist bewusst großzügig – in der Prüfung tippt man in ein Feld, und
 * ein fehlender Punkt ist kein fachlicher Fehler. Die saubere Schreibweise steht in der
 * Rückmeldung. Reihenfolge und Ziffern müssen dagegen exakt stimmen. */
function codeKey(v) {
  return String(v == null ? "" : v).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function codeAccepted(q) {
  const list = [q.answer].concat(Array.isArray(q.accept) ? q.accept : []);
  return list.map(codeKey).filter(Boolean);
}
/* Zahl aus einer Nutzereingabe lesen. Wichtig:
   - Leeres Feld ist KEINE Antwort (Number("") wäre 0 und würde als Antwort „0" gewertet).
   - Deutsche Schreibweise: "1.234,5" → 1234.5, "1.000" → 1000. Ein reines
     replace(",", ".") würde daraus 1 bzw. NaN machen. */
function parseNum(v) {
  const s = String(v).trim();
  if (!s) return NaN;                                                  // leer = keine Antwort
  let t = s.replace(/[\s  ']/g, "");
  if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");  // Komma = Dezimaltrenner
  else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // reine Tausenderpunkte
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
function hasResponse(q, resp) {
  const a = respList(resp);
  if (q.type === "numeric") return a.length >= 1 && Number.isFinite(Number(a[0]));
  if (q.type === "code") return a.length >= 1 && !!codeKey(a[0]);
  return a.length >= 1;
}
function gradeQuestion(q, resp) {
  const a = respList(resp);
  if (q.type === "numeric") {
    if (!a.length) return false;
    const v = Number(a[0]);
    return isFinite(v) && Math.abs(v - q.answer) <= (Number(q.tolerance) || 0) + 1e-9;
  }
  if (q.type === "code") {
    const k = codeKey(a[0]);
    return !!k && codeAccepted(q).includes(k);
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
  if (q.type === "code") {
    const alt = (Array.isArray(q.accept) ? q.accept : []).filter(Boolean);
    return q.answer + (alt.length ? " (auch: " + alt.join(", ") + ")" : "");
  }
  if (q.type === "numeric") {
    const tol = Number(q.tolerance) || 0;
    return fmtNum(q.answer) + (q.unit ? " " + q.unit : "") + (tol > 0 ? " (±" + fmtNum(tol) + ")" : "");
  }
  return q.correct.map(i => q.options[i]).join(", ");
}
function fmtNum(n) { return String(Number(n)).replace(".", ","); }   // deutsche Dezimaldarstellung

/* ------------------------------------------------------------------ *
 * 4b) Fragen melden („fragwürdig") – Feedback zum Fragenkatalog
 * ------------------------------------------------------------------
 * Zweck: Beim Üben mit EINEM Tipp festhalten, dass eine Frage komisch wirkt
 * (falsche Antwort, unklar formuliert, Tippfehler) – ohne den Lernfluss zu
 * unterbrechen. Gesammelt wird alles unter Einstellungen → „Gemeldete Fragen";
 * dort lässt sich je Meldung eine Notiz ergänzen und das Ganze kopieren oder als
 * Datei exportieren, um die Fragen später gebündelt zu überarbeiten.
 *
 * Datenmodell: S.reports[id] = { on, at, note }. Das AUFHEBEN einer Markierung
 * wird als { on:false } MIT neuem Zeitstempel gespeichert (Grabstein): Der
 * Cloud-Merge entscheidet je Frage über den jüngeren Zeitstempel – sonst würde
 * eine vom anderen Gerät stammende Meldung nach dem Entfernen zurückkehren.
 */
function reportsMap() {
  if (!S.reports || typeof S.reports !== "object") S.reports = {};
  return S.reports;
}
function isReported(id) { const r = reportsMap()[id]; return !!(r && r.on); }
function reportCount() { const m = reportsMap(); return Object.keys(m).filter(id => m[id] && m[id].on).length; }
// Gemeldete Fragen, neueste zuerst. `q` ist null, wenn der aktuelle Katalog die ID nicht kennt.
function reportedList() {
  const m = reportsMap();
  return Object.keys(m)
    .filter(id => m[id] && m[id].on)
    .map(id => ({
      id, at: m[id].at || "", note: m[id].note || "", issuedAt: m[id].issuedAt || "",
      issueNumber: m[id].issueNumber || 0, issueUrl: m[id].issueUrl || "",
      q: QUESTIONS.find(q => q.id === id) || null,
    }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function setReported(id, on, note) {
  const m = reportsMap();
  const prev = m[id] || {};
  if (on && !prev.on && reportCount() >= REPORT_MAX) return false;   // Obergrenze erreicht
  m[id] = {
    on: !!on,
    at: new Date().toISOString(),
    note: String(note != null ? note : (prev.note || "")).slice(0, REPORT_NOTE_MAX),
    issuedAt: prev.issuedAt || "",     // Merkzettel „Issue schon angelegt" bleibt erhalten
    issueNumber: prev.issueNumber || 0,
    issueUrl: prev.issueUrl || "",
  };
  saveState();
  return true;
}
/* Merken, dass für diese Frage schon ein Issue vorbereitet wurde. Bewusst als Merkhilfe
   formuliert, nicht als Tatsache: Ob in GitHub am Ende „Create" getippt wurde, kann die
   App nicht wissen – sie hat nur den Link geöffnet. */
function markIssued(id) {
  const r = reportsMap()[id];
  if (!r) return;
  r.issuedAt = new Date().toISOString();
  r.at = r.issuedAt;                   // zählt als Änderung → gewinnt beim Cloud-Merge
  saveState();
}
/* Melde-Dialog: kleiner Alert mit Notizfeld – die Frage bleibt darunter stehen, es wird
   nichts verlassen und nichts neu gerendert. Die Notiz ist optional: „Melden" genügt.
   Gibt den neuen Melde-Zustand zurück (unverändert bei Abbruch). */
async function openReportDialog(id) {
  const on = isReported(id);
  const cur = reportsMap()[id] || {};
  const buttons = on
    ? [{ label: "Notiz speichern", value: "save" },
       { label: "Meldung aufheben", value: "remove", variant: "danger" },
       { label: "Abbrechen", value: null, variant: "ghost" }]
    : [{ label: "Melden", value: "save" },
       { label: "Abbrechen", value: null, variant: "ghost" }];
  // Steht der direkte Weg bereit, entsteht das Issue sofort beim Melden – das gehört in den Text,
  // damit klar ist, dass danach nichts mehr zu tun ist.
  const auto = issueApiPossible();
  const res = await modalPrompt(
    on ? "Meldung bearbeiten" : "Frage melden",
    on ? "Diese Frage ist als fragwürdig markiert. Notiz ändern oder die Meldung aufheben."
       : ("Was wirkt fragwürdig? Die Notiz ist optional – „Melden“ genügt." +
          (auto ? " Es wird direkt ein GitHub-Issue angelegt." : "")),
    {
      value: cur.note || "",
      placeholder: "z. B. Antwort B ist auch richtig",
      label: "Notiz zur Meldung (optional)",
      maxLength: REPORT_NOTE_MAX,
      buttons: buttons,
    });
  if (!res || !res.action) return on;                       // Abbruch/Escape: alles bleibt
  if (res.action === "remove") { setReported(id, false); toast("Meldung aufgehoben"); return false; }
  if (!setReported(id, true, res.value)) {
    toast("⚠️ Zu viele Meldungen – bitte erst welche abarbeiten");
    return on;
  }
  hapticFeedback(true);
  toast(on ? "📝 Notiz gespeichert" : "🚩 Frage gemeldet – danke!");
  autoCreateIssue(id);     // läuft im Hintergrund weiter – der Lernfluss wartet nicht
  return true;
}

/* Ein Tipp genügt: Direkt beim Melden entsteht das Issue. Bewusst OHNE await – das
   Netz kann eine Sekunde brauchen, und solange soll niemand vor der Frage warten.
   Das Ergebnis kommt als Toast nach; die Meldung steht in jedem Fall schon in der Liste,
   und schlägt das Anlegen fehl, bleibt dort der Knopf „Als Issue" zum Nachholen. */
function autoCreateIssue(id) {
  if (!issueApiPossible()) return;
  const r = reportedList().find(x => x.id === id);
  if (!r || r.issueNumber) return;                  // nicht gemeldet oder längst angelegt
  createIssueDirect(r).then((res) => {
    if (res && res.ok) {
      toast(res.existing ? "Issue #" + res.number + " gibt es schon" : "✅ Issue #" + res.number + " angelegt");
    } else if (res && res.error !== "not-possible") {
      toast("⚠️ Issue nicht angelegt – Einstellungen → Gemeldete Fragen");
    }
    if (VIEW === "reports") renderReports();         // Liste zeigt die Nummer sofort
  }).catch(() => {});
}
function setReportNote(id, note) {
  const r = reportsMap()[id];
  if (!r || !r.on) return;
  const clean = String(note || "").slice(0, REPORT_NOTE_MAX);
  if (clean === (r.note || "")) return;
  r.note = clean;
  r.at = new Date().toISOString();   // Notiz zählt als Änderung → gewinnt beim Merge
  saveState();
}

const REPORT_LABEL_ON = "Als fragwürdig gemeldet";
const REPORT_LABEL_OFF = "Frage melden";
// Melde-Knopf für eine Frage (Übung und Prüfungs-Auswertung nutzen denselben).
function reportButtonHtml(id) {
  const on = isReported(id);
  return `<button class="report-btn${on ? " on" : ""}" data-report="${esc(id)}" aria-pressed="${on ? "true" : "false"}"
    title="Frage als fragwürdig melden – mit optionaler Notiz">${icon("flag")}<span class="rb-txt">${on ? REPORT_LABEL_ON : REPORT_LABEL_OFF}</span></button>`;
}
// Knöpfe in `root` verdrahten. Der Dialog legt sich über die aktuelle Ansicht, danach
// wird der Knopf in place aktualisiert – kein Re-Render, damit der Lernfluss
// (Auswahl, Scrollposition, Fokus) unangetastet bleibt.
function wireReportButtons(root) {
  root.querySelectorAll("[data-report]").forEach(el => el.addEventListener("click", async () => {
    const on = await openReportDialog(el.dataset.report);
    el.classList.toggle("on", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
    const lbl = el.querySelector(".rb-txt");
    if (lbl) lbl.textContent = on ? REPORT_LABEL_ON : REPORT_LABEL_OFF;
  }));
}

/* Alle Meldungen als Markdown-**Backlog** (zum Kopieren oder als Datei):
   je Frage ein Kästchen zum Abhaken, darunter eingerückt alles, was zum Korrigieren nötig ist.
   Genau dieses Format liest `tools/reports-to-backlog.mjs` ein und führt es mit
   `docs/fragen-backlog.md` zusammen – abgehakte Einträge bleiben abgehakt. */
function reportDate(iso) { return iso ? new Date(iso).toLocaleDateString("de-DE") : "unbekannt"; }
// Alles, was zum Korrigieren einer gemeldeten Frage nötig ist – einmal formuliert,
// genutzt vom Backlog-Export (eingerückt) und vom GitHub-Issue (ohne Einrückung).
function reportDetailLines(r, indent) {
  const p = indent || "";
  const q = r.q;
  const out = [];
  if (r.note) out.push(p + "Notiz: " + r.note);
  if (q) {
    out.push(p + "Frage: " + q.question);
    if (Array.isArray(q.options) && q.options.length) {
      q.options.forEach((o, i) => out.push(p + (q.correct.includes(i) ? "· [richtig] " : "· ") + o));
    }
    out.push(p + "Lösung: " + correctAnswerText(q));
    if (q.explanation) out.push(p + "Erklärung: " + q.explanation);
  } else {
    out.push(p + "(Diese Frage ist im aktuellen Katalog nicht mehr enthalten.)");
  }
  return out;
}
function versionLine() {
  return "App " + APP_VERSION + (contentVersionLabel() ? " · Fragen-" + contentVersionLabel() : "");
}
function reportsAsText() {
  const list = reportedList();
  const lines = [
    "# Fragen-Backlog (gemeldete Fragen)",
    "",
    "Stand: " + new Date().toLocaleString("de-DE") + " · " + versionLine(),
    "Offen: " + list.length,
    "",
    "## Offen",
    "",
  ];
  for (const r of list) {
    const t = r.q ? TOPICS[r.q.topic] : null;
    lines.push(`- [ ] **${r.id}**` + (t ? " · " + t.name : "") + " · gemeldet " + reportDate(r.at));
    lines.push(...reportDetailLines(r, "      "));
    lines.push("");
  }
  if (!list.length) lines.push("(keine offenen Meldungen)", "");
  return lines.join("\n");
}

/* ---- Meldung als GitHub-Issue ----------------------------------------------------
 * Bewusst OHNE Token in der App: Wir bauen nur GitHubs eigenen „neues Issue"-Link mit
 * vorbefülltem Titel und Text. Getippt wird „Create" dann in GitHub – dadurch braucht die
 * App kein Geheimnis, keinen Server und keine zusätzliche Berechtigung.
 * Zielrepo steht in config.js (`feedbackRepo`). Es sollte PRIVAT sein: Die Fragen sind
 * zugangsgeschützt und haben in einem öffentlichen Repo nichts zu suchen. Ist nichts
 * konfiguriert, erscheinen die Knöpfe gar nicht erst. */
const FEEDBACK_LABEL = "frage-feedback";
const ISSUE_URL_MAX = 7000;      // konservativ – lange URLs schlucken manche Browser stumm
function feedbackRepo() {
  const r = (window.ADT_CONFIG && ADT_CONFIG.feedbackRepo) || "";
  return /^[\w.-]+\/[\w.-]+$/.test(String(r).trim()) ? String(r).trim() : "";
}
// Vorbefüllter Link; kürzt den Text notfalls, damit die URL nicht abgeschnitten wird.
function issueUrl(title, body) {
  const repo = feedbackRepo();
  if (!repo) return "";
  const base = "https://github.com/" + repo + "/issues/new?labels=" + encodeURIComponent(FEEDBACK_LABEL) +
    "&title=" + encodeURIComponent(String(title).slice(0, 200)) + "&body=";
  const hint = "\n\n… gekürzt – der vollständige Stand steckt im Datei-Export der App.";
  const room = Math.max(500, ISSUE_URL_MAX - base.length - encodeURIComponent(hint).length);
  let b = String(body);
  if (encodeURIComponent(b).length > room) {
    while (b.length > 300 && encodeURIComponent(b).length > room) b = b.slice(0, Math.floor(b.length * 0.9));
    b += hint;
  }
  return base + encodeURIComponent(b);
}
function issueForReport(r) {
  const t = r.q ? TOPICS[r.q.topic] : null;
  const title = "Frage " + r.id + (t ? " · " + t.name : "");
  const body = [
    "**Frage-ID:** `" + r.id + "`",
    "**Thema:** " + (t ? t.name : "unbekannt"),
    "**Gemeldet:** " + reportDate(r.at) + " · " + versionLine(),
    "",
  ].concat(reportDetailLines(r, "")).join("\n");
  return issueUrl(title, body);
}
/* Bewusst EIN Issue je Frage (kein Sammel-Issue): Jede Frage ist ein eigener Vorgang, der
   für sich diskutiert, zugewiesen und geschlossen werden kann. Ein Sammel-Issue müsste man
   von Hand nachpflegen und bliebe offen, bis die letzte Frage erledigt ist. */
function openIssue(url) {
  if (!url) return;
  try { window.open(url, "_blank", "noopener"); }
  catch (e) { location.href = url; }
}

/* ---- Issue DIREKT anlegen (ohne Umweg über GitHub) --------------------------------
 * Bevorzugter Weg: Die Edge Function `create-issue` legt das Issue serverseitig an –
 * sie hält den GitHub-Token als Secret, die App kennt keinen. Man bleibt in der App und
 * bekommt nur die Issue-Nummer zurück.
 * Klappt das nicht (Funktion nicht deployt, offline, kein Zugangscode), bleibt der
 * vorbefüllte Link als Rückfallebene – gemeldet wird also immer, nur der Weg unterscheidet sich. */
function issueApiPossible() {
  return !!(window.ADTSync && ADTSync.isConfigured() && ADTSync.createIssue && getContentCode());
}
function issueTitleFor(r) {
  const t = r.q ? TOPICS[r.q.topic] : null;
  return "Frage " + r.id + (t ? " · " + t.name : "");
}
function issueBodyFor(r) {
  const t = r.q ? TOPICS[r.q.topic] : null;
  return [
    "**Frage-ID:** `" + r.id + "`",
    "**Thema:** " + (t ? t.name : "unbekannt"),
    "**Gemeldet:** " + reportDate(r.at) + " · " + versionLine(),
    "",
  ].concat(reportDetailLines(r, "")).join("\n");
}
// Ergebnis: { ok, number, url, existing } | { error }
async function createIssueDirect(r) {
  if (!issueApiPossible()) return { error: "not-possible" };
  const res = await ADTSync.createIssue({
    code: getContentCode(),
    id: r.id,
    title: issueTitleFor(r),
    body: issueBodyFor(r),
  });
  if (res && res.ok && res.number) {
    const rec = reportsMap()[r.id];
    if (rec) {
      rec.issueNumber = res.number;
      rec.issueUrl = String(res.url || "");
      rec.issuedAt = new Date().toISOString();
      rec.at = rec.issuedAt;
      saveState();
    }
  }
  return res || { error: "empty" };
}
// Erklärt einen Fehlschlag in einem Satz – nie nur „hat nicht geklappt".
function issueErrorText(err) {
  switch (err) {
    case "offline": return "Offline – Issue später anlegen.";
    case "unauthorized": return "Zugangscode wurde nicht akzeptiert.";
    case "rate-limited": return "Zu viele Issues in kurzer Zeit – bitte später.";
    case "not-configured":
    case "not-possible": return "Direktes Anlegen ist nicht eingerichtet.";
    case "http-404":
    case "http-501": return "Die Serverfunktion ist noch nicht eingerichtet.";
    default: return "Anlegen fehlgeschlagen (" + err + ").";
  }
}

// Session: { questions:[...], idx, mode, answers:{}, order:[...perQuestion shuffled option order] }
let SESSION = null;

function buildSession(mode, opts = {}) {
  let pool;
  if (mode === "topic") pool = QUESTIONS.filter(q => q.topic === opts.topic);
  else if (mode === "code") pool = QUESTIONS.filter(q => q.type === "code");
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
  if (Number.isFinite(n)) set.add(n);
  const cb = document.getElementById("checkBtn");
  if (cb) cb.disabled = !hasResponse(currentQ(), set);
  // Unlesbare Eingabe sichtbar machen, statt den Knopf kommentarlos zu sperren.
  const hint = document.getElementById("numHint");
  if (hint) {
    const unlesbar = String(raw).trim() !== "" && !Number.isFinite(n);
    hint.textContent = unlesbar ? "Bitte nur eine Zahl eingeben (Komma oder Punkt als Dezimaltrenner)." : "";
    hint.style.display = unlesbar ? "" : "none";
  }
}

// Freie Eingabe (code): Rohtext speichern – normalisiert wird erst beim Bewerten,
// damit im Feld genau das stehen bleibt, was getippt wurde.
function setCodeResponse(raw) {
  if (SESSION.checked[SESSION.idx]) return;
  const set = SESSION.picks[SESSION.idx];
  set.clear();
  const t = String(raw);
  if (codeKey(t)) set.add(t);
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
  const p = S.perQuestion[q.id] || { seen: 0, correct: 0, wrong: 0, lastResult: null, box: 0, due: null, masteredOnce: false, first: null, lastAt: null, cold: null, coldAt: null };
  const boxBefore = Number(p.box) || 0;
  const prevAt = /^\d{4}-\d{2}-\d{2}$/.test(String(p.lastAt || "")) ? p.lastAt : null;
  p.seen += 1;
  if (ok) { p.correct += 1; p.lastResult = "correct"; } else { p.wrong += 1; p.lastResult = "wrong"; }
  // Beobachtungsdaten (Konzept: workbook.md). Der erste Kontakt wird genau einmal
  // festgehalten und nie überschrieben. Zusätzlich wird der letzte KALTE Abruf gebucht:
  // jede Antwort auf eine Frage, die seit mindestens COLD_GAP_DAYS nicht dran war
  // (inkl. des Erstkontakts). Nur solche Abrufe messen Wissen statt Kurzzeit-Echo –
  // und anders als der Erstversuch altern sie mit dem Lernstand mit.
  const heute = todayStr();
  if (p.first !== "correct" && p.first !== "wrong") p.first = ok ? "correct" : "wrong";
  if (!prevAt || daysBetween(prevAt, heute) >= COLD_GAP_DAYS) {
    p.cold = ok ? "correct" : "wrong";
    p.coldAt = heute;
  }
  p.lastAt = heute;
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
  hapticFeedback(ok);
  renderQuiz();
  // KEIN XP-Toast je Frage mehr: „Richtig/Nicht ganz" steht bereits in der Erklärungs-Karte,
  // und der XP-Fortschritt ist auf der Startseite/Level-Leiste sichtbar. Es werden nur noch
  // besondere Momente gemeldet – Frage gemeistert, Level-Aufstieg, neuer Erfolg (gestaffelt).
  let delay = 0;
  if (justMastered) { setTimeout(() => toast(`🛡️ Frage gemeistert! +${bonus} XP`), delay); delay += 1600; }
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
  if (pct >= 80) celebrate();   // starkes Ergebnis feiern
}

/* ------------------------------------------------------------------ *
 * 6) UI-Rendering
 * ------------------------------------------------------------------ */
const app = document.getElementById("app");
const actionbar = document.getElementById("actionbar");
const streakEl = document.getElementById("streakVal");

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* Manche Fragen brauchen eine echte Abbildung (Diagrammwerte, die nur im Bild
   ablesbar sind) — q.image ist dann ein Base64-Data-URI, reist mit dem Katalog
   und funktioniert damit auch offline. Klick öffnet eine vergrößerte Ansicht
   (Diagrammtext ist inline oft zu klein). */
function qImageHtml(q) {
  if (!q.image) return "";
  return `<button type="button" class="q-image-btn" data-q-image aria-label="Abbildung zur Frage vergrößern">
    <img src="${esc(q.image)}" alt="Abbildung zur Frage" loading="lazy">
    <span class="q-image-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg></span>
  </button>`;
}
function wireImageZoom(container) {
  (container || document).querySelectorAll("[data-q-image]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const img = btn.querySelector("img");
      if (img) openImageLightbox(img.src, img.alt);
    });
  });
}
// Vergrößerte Bildansicht als eigenes Overlay (gleiches Verhalten wie modalChoice:
// Escape/Backdrop-Klick schließt, Fokus kehrt zurück).
function openImageLightbox(src, alt) {
  const prevFocus = document.activeElement;
  const ov = document.createElement("div");
  ov.className = "modal-overlay img-lightbox";
  ov.innerHTML = `<div class="lightbox-card" role="dialog" aria-modal="true" aria-label="${esc(alt || "Abbildung")}">
    <button class="lightbox-close" aria-label="Schließen">✕</button>
    <img src="${esc(src)}" alt="${esc(alt || "Abbildung")}">
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("show"));
  const close = () => {
    ov.removeEventListener("keydown", onKey);
    ov.classList.remove("show"); setTimeout(() => ov.remove(), 200);
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (_) {}
  };
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
  ov.querySelector(".lightbox-close").addEventListener("click", close);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.addEventListener("keydown", onKey);
  ov.querySelector(".lightbox-close").focus();
}

/* ---- SVG-Icon-System (SF-Symbols-Stil, monochром, via currentColor) ---- */
const ICONS = {
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 1.6"/><path d="M9.5 3h5"/><path d="M12 3v3"/>',
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
  keypad: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.4"/><path d="M7.5 10h1M11.5 10h1M15.5 10h1"/><path d="M7.5 14h9"/>',
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
  share: '<path d="M12 3.5v11"/><path d="M8.5 7L12 3.5 15.5 7"/><path d="M7 11.5H6a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5.5a2 2 0 0 0-2-2h-1"/>',
};
// Achtung: sw.js liest diese Zeile beim Update-Check per Regex aus der ausgelieferten
// Datei, um sie mit der laufenden Fassung zu vergleichen. Schreibweise bitte so lassen –
// und in Kommentaren keine zweite Zuweisung dieses Namens notieren (die käme zuerst).
const APP_VERSION = "0.44.0";
// Datenstand des Fragenkatalogs: "<Build-Datum>-<Kurz-Hash des Inhalts>", von
// pipeline/build_content.py erzeugt. Der Hash hängt nur vom Inhalt ab — zwei
// Auslieferungen mit identischen Fragen haben denselben Hash-Anteil, auch an
// verschiedenen Tagen gebaut. Damit lässt sich ein Update eindeutig erkennen,
// ohne den ganzen Katalog zu vergleichen.
function contentVersionLabel() {
  const v = (typeof CONTENT_VERSION !== "undefined" && CONTENT_VERSION) ? String(CONTENT_VERSION) : "";
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})-([0-9a-f]{6,})$/.exec(v);
  return m ? `Stand ${m[3]}.${m[2]}.${m[1]} · ${m[4].slice(0, 6)}` : `Stand ${v}`;
}
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
  streak3: { i: "flame", c: "#ff6b22" }, streak7: { i: "flame", c: "#ffcc00" },
  exam: { i: "clipboardCheck", c: "#34c759" }, exam90: { i: "crown", c: "#5e5ce6" },
  sharp: { i: "target", c: "#ff3b30" }, master: { i: "brain", c: "#30b0c7" },
  secure25: { i: "shield", c: "#34c759" }, streak14: { i: "flame", c: "#ff6b22" }, allmaster: { i: "trophy", c: "#ffb300" },
};

const BAR_TITLES = { home: "ADT Trainer", topics: "Themen", badges: "Erfolge", stats: "Statistik", settings: "Einstellungen", info: "Info", result: "Ergebnis", quiz: "", exam: "Prüfung", examresult: "Ergebnis", reports: "Gemeldete Fragen" };
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

/* ------------------------------------------------------------------ *
 * Pomodoro-Lern-Timer (rein lokal, überlebt Re-Render und Neuladen)
 *  - 25 min lernen -> 5 min Pause, nach jeder 4. Runde 15 min.
 *  - Pausen starten automatisch; die nächste Lernrunde wartet auf einen Tipp
 *    (bewusster Wiedereinstieg statt Dauer-Uhr).
 *  - Zustand über Zeitstempel (endsAt), das Intervall dient nur der Anzeige.
 * ------------------------------------------------------------------ */
const POMO_KEY = "adt_pomo_v1";
const POMO_DONE_KEY = "adt_pomo_done";     // Tageszähler getrennt vom Timer – überlebt „Beenden"
const POMO_GOAL_KEY = "adt_pomo_goal";     // Tagesziel Runden, einstellbar (0 = kein Ziel)
const POMO_WORK = 25 * 60 * 1000, POMO_BREAK = 5 * 60 * 1000, POMO_LONG = 15 * 60 * 1000, POMO_EVERY = 4;
const POMO_ABANDON_MS = 60 * 60 * 1000;    // länger als 1 h abgelaufen = Sitzung verlassen
// 4 Runden = ein voller Zyklus bis zur langen Pause (~2 Std. inkl. Pausen) – als
// Standard sinnvoll, weil er mit dem ohnehin eingebauten Rhythmus zusammenfällt.
const POMO_GOAL_CHOICES = [0, 2, 4, 6, 8];
function getPomoGoal() { try { const v = parseInt(localStorage.getItem(POMO_GOAL_KEY), 10); return POMO_GOAL_CHOICES.includes(v) ? v : 4; } catch { return 4; } }
function setPomoGoal(n) { try { localStorage.setItem(POMO_GOAL_KEY, String(n)); } catch (e) {} }
let pomoTickId = null;

function pomoLoad() {
  try { const p = JSON.parse(localStorage.getItem(POMO_KEY) || "null"); return (p && p.phase) ? p : null; }
  catch (e) { return null; }
}
function pomoSave(p) { try { if (p) localStorage.setItem(POMO_KEY, JSON.stringify(p)); else localStorage.removeItem(POMO_KEY); } catch (e) {} }
function pomoDoneToday() {
  try { const o = JSON.parse(localStorage.getItem(POMO_DONE_KEY) || "{}"); return (o && o.date === todayStr()) ? (parseInt(o.n, 10) || 0) : 0; }
  catch (e) { return 0; }
}
function pomoBumpDone() { try { localStorage.setItem(POMO_DONE_KEY, JSON.stringify({ date: todayStr(), n: pomoDoneToday() + 1 })); } catch (e) {} }
function pomoPhaseMs(phase, n) { return phase === "work" ? POMO_WORK : (phase === "long" ? POMO_LONG : POMO_BREAK); }
function pomoRemainMs(p) { return p.paused ? p.remainMs : Math.max(0, p.endsAt - Date.now()); }
function pomoVibrate() { try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) {} }

function pomoStart() {
  const p = { phase: "work", paused: false, endsAt: Date.now() + POMO_WORK, remainMs: null };
  pomoSave(p); pomoEnsureTick(); pomoRender();
  toast("🍅 25 Minuten Fokus – los geht's!");
}
function pomoPauseResume() {
  const p = pomoLoad(); if (!p) return;
  if (p.paused) {
    const rest = Number.isFinite(p.remainMs) ? p.remainMs : pomoPhaseMs(p.phase);
    p.endsAt = Date.now() + rest; p.paused = false; p.remainMs = null;
    pomoSave(p);
    if (rest <= 0) pomoSettle();       // in der letzten Sekunde pausiert → Phase sofort abschließen
  } else { p.remainMs = pomoRemainMs(p); p.paused = true; pomoSave(p); }
  pomoRender();
}
function pomoStop(silent) {
  const n = pomoDoneToday();            // Tageszähler liegt in POMO_DONE_KEY und bleibt erhalten
  pomoSave(null);
  if (pomoTickId) { clearInterval(pomoTickId); pomoTickId = null; }
  pomoRender(); pomoPanel(false);
  if (!silent) toast("Timer beendet" + (n ? " – 🍅 ×" + n + " heute. Stark!" : ""));
}
// Phasenwechsel, wenn die Zeit abgelaufen ist (auch nach App-Neustart).
function pomoSettle() {
  const p = pomoLoad(); if (!p || p.paused) return p;
  if (pomoRemainMs(p) > 0) return p;
  // Lange nach Phasenende zurück (App war zu): Sitzung gilt als verlassen –
  // Timer still beenden, keine Rundengutschrift, kein nachträglicher Pausen-Toast.
  if (Date.now() - p.endsAt > POMO_ABANDON_MS) { pomoSave(null); pomoRender(); return null; }
  if (p.phase === "work") {
    pomoBumpDone();
    const n = pomoDoneToday();
    const lang = n % POMO_EVERY === 0;
    p.phase = lang ? "long" : "break";
    p.paused = false; p.endsAt = Date.now() + pomoPhaseMs(p.phase); p.remainMs = null;
    pomoSave(p); pomoVibrate();
    const goal = getPomoGoal();
    const pausentxt = lang ? "15 Minuten lange Pause!" : "5 Minuten Pause. Beine vertreten! ☕";
    toast(goal && n === goal
      ? "🎯 Pomodoro-Ziel erreicht (" + n + "/" + goal + ")! " + pausentxt
      : "🍅 Runde " + n + " geschafft – " + pausentxt);
  } else {
    p.phase = "work"; p.paused = true; p.remainMs = POMO_WORK;
    pomoSave(p); pomoVibrate();
    toast("Pause vorbei – wenn du magst: Timer antippen für die nächste Runde. Oder guten Gewissens Schluss machen.");
  }
  return p;
}
function pomoEnsureTick() {
  if (pomoTickId) return;
  pomoTickId = setInterval(() => {
    const p = pomoLoad();
    if (!p) { clearInterval(pomoTickId); pomoTickId = null; pomoRender(); return; }
    pomoSettle(); pomoRender();
  }, 1000);
}
function pomoSubtitle() {
  const p = pomoLoad();
  if (!p) {
    const n = pomoDoneToday(), goal = getPomoGoal();
    if (!n) return "25 min Fokus · 5 min Pause – mit klarem Feierabend";
    if (goal && n >= goal) return "×" + n + " heute – Tagesziel erreicht ✓";
    return "×" + n + (goal ? " von " + goal : "") + " heute – weiter?";
  }
  const mm = fmtTime(pomoRemainMs(p));
  if (p.paused && p.phase === "work" && (p.remainMs || 0) >= POMO_WORK)
    return "Bereit für Runde " + (pomoDoneToday() + 1) + " – tippen zum Start";
  if (p.paused) return "Pausiert (" + mm + ") – tippen zum Weitermachen";
  return (p.phase === "work" ? "Fokus läuft – noch " : "Pause – noch ") + mm;
}
function pomoTap() {
  const p = pomoLoad();
  if (!p) pomoStart(); else pomoPanel(true);
}
/* Pill in der App-Leiste – auf jeder Ansicht sichtbar */
function pomoRender() {
  const pill = document.getElementById("pomoPill");
  if (!pill) return;
  const p = pomoLoad();
  if (!p) {
    pill.classList.add("hidden");
    const sub0 = document.getElementById("pomoModeSub");
    if (sub0) sub0.textContent = pomoSubtitle();
    pomoPanelSync(null); return;
  }
  pill.classList.remove("hidden");
  const mm = fmtTime(pomoRemainMs(p));
  pill.textContent = (p.paused ? "⏸ " : (p.phase === "work" ? "🍅 " : "☕ ")) + mm;
  pill.classList.toggle("break", p.phase !== "work");
  const sub = document.getElementById("pomoModeSub");
  if (sub) sub.textContent = pomoSubtitle();
  pomoPanelSync(p);
}
/* Kleines Bedienfeld (am Body, damit View-Wechsel es nicht wegwischen) */
function pomoPanel(show) {
  let el = document.getElementById("pomoPanel");
  if (!show) { if (el) el.classList.remove("show"); return; }
  if (!el) {
    el = document.createElement("div"); el.id = "pomoPanel"; el.className = "pomo-panel";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Lern-Timer");
    el.innerHTML = `<div class="pomo-sheet">
      <div class="pomo-head"><b id="pomoTitle">Lern-Timer</b><span id="pomoCount" class="muted"></span></div>
      <div class="pomo-time" id="pomoTime">25:00</div>
      <div class="pomo-btns">
        <button class="btn-primary" id="pomoMain">Pause</button>
        <button class="btn-ghost" id="pomoEnd">Beenden</button>
      </div>
      <p class="muted pomo-note">25 min Fokus · 5 min Pause · nach 4 Runden 15 min.<br>Pausen starten von selbst, jede neue Runde startest du.</p>
    </div>`;
    document.body.appendChild(el);
    el.querySelector("#pomoMain").addEventListener("click", () => {
      const p = pomoLoad();
      if (!p) { pomoStart(); return; }
      pomoPauseResume();
    });
    el.querySelector("#pomoEnd").addEventListener("click", pomoStop);
    el.addEventListener("click", (e) => { if (e.target === el) pomoPanel(false); });
  }
  el.classList.add("show");
  pomoPanelSync(pomoLoad());
}
function pomoPanelSync(p) {
  const el = document.getElementById("pomoPanel");
  if (!el || !el.classList.contains("show")) return;
  if (!p) { el.classList.remove("show"); return; }
  el.querySelector("#pomoTime").textContent = fmtTime(pomoRemainMs(p));
  const wartend = p.paused && p.phase === "work" && (p.remainMs || 0) >= POMO_WORK; // nach einer Pause: neue Runde wartet
  el.querySelector("#pomoTitle").textContent = p.phase === "work"
    ? (wartend ? "Bereit für die nächste Runde?" : (p.paused ? "Fokus (pausiert)" : "Fokus 🍅"))
    : (p.phase === "long" ? "Lange Pause ☕" : "Pause ☕");
  const n = pomoDoneToday(), goal = getPomoGoal();
  el.querySelector("#pomoCount").textContent = n
    ? "🍅 ×" + n + (goal ? " / " + goal : "") + " heute" + (goal && n >= goal ? " ✓" : "")
    : (goal ? "Ziel heute: " + goal + " Runden" : "");
  el.querySelector("#pomoMain").textContent = p.paused ? (wartend ? "Runde starten" : "Weiter") : "Pause";
}
function pomoInit() {
  const pill = document.getElementById("pomoPill");
  if (pill) pill.addEventListener("click", () => pomoPanel(!document.getElementById("pomoPanel") || !document.getElementById("pomoPanel").classList.contains("show")));
  if (pomoLoad()) { pomoSettle(); pomoEnsureTick(); }
  pomoRender();
  document.addEventListener("visibilitychange", () => { if (!document.hidden && pomoLoad()) { pomoSettle(); pomoEnsureTick(); pomoRender(); } });
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
  const weak = weakQuestions().length;
  // Kodier-Aufgaben („Kode eingeben") sind der Prüfungsteil, den es sonst nirgends gezielt
  // gibt: die Simulation zieht sie nur zufällig mit. Der Knopf erscheint nur, wenn der
  // geladene Katalog welche enthält – der öffentliche Beispielkatalog hat wenige, ältere gar keine.
  const codeCount = QUESTIONS.filter(q => q.type === "code").length;

  // Tagesziel-Ring (lokal)
  const goal = getDailyGoal();
  const todayN = getToday();
  const goalDone = todayN >= goal;
  const enough = goalDone && due === 0;
  const morgen = enough ? dueTomorrowCount() : 0;
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
          <b>${enough ? "Für heute ist wirklich Schluss ✅" : goalDone ? "Tagesziel erreicht 🎉" : "Tagesziel heute"}</b>
          <p>${enough
            ? "Ziel geschafft, nichts mehr fällig." + (morgen ? " Morgen: " + morgen + " Wiederholung" + (morgen === 1 ? "" : "en") + "." : "")
            : todayN + " / " + goal + " Fragen" + (goalDone ? " – stark!" : "")}</p>
        </span>
        <span class="chev">›</span>
      </button>
      <button class="today-edit" data-act="goal">Ziel ändern</button>
    </div>`;

  const readyCard = readinessCardHTML(false);

  const standalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  const installTip = standalone ? "" : `
    <div class="install-tip">
      <span class="tip-ic">${icon("share")}</span>
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
    ${readyCard}

    <div class="stat-grid">
      <div class="stat"><div class="num">${S.totalAnswered}</div><div class="lbl">beantwortet</div></div>
      <div class="stat"><div class="num">${acc}%</div><div class="lbl">Trefferquote</div></div>
      <div class="stat"><div class="num">${S.xp}</div><div class="lbl">XP gesamt</div></div>
    </div>

    <div class="section-title">Üben</div>
    <div class="ios-group">
      <button class="mode-btn" data-act="mixed">${iconTile("shuffle", "#007aff")}<span class="txt"><b>Gemischtes Training</b><p>Zufällige Fragen aus allen Themen</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="topics">${iconTile("grid", "#5e5ce6")}<span class="txt"><b>Nach Thema lernen</b><p>Gezielt einzelne Themengebiete üben</p></span><span class="chev">›</span></button>
      ${codeCount ? `<button class="mode-btn" data-act="code">${iconTile("keypad", "#7c5cbf")}<span class="txt"><b>Kodes eintragen</b><p>${codeCount} Aufgaben – nachschlagen statt ankreuzen</p></span><span class="chev">›</span></button>` : ""}
      <button class="mode-btn" data-act="due" ${due ? "" : "disabled"}>${iconTile("repeat", "#ff9500")}<span class="txt"><b>Fällige Wiederholungen</b><p>${due ? due + " Frage" + (due === 1 ? "" : "n") + " heute fällig" : "Super – heute nichts fällig"}</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="weak" ${weak ? "" : "disabled"}>${iconTile("target", "#ff3b30")}<span class="txt"><b>Schwachstellen üben</b><p>${weak ? weak + " Frage" + (weak === 1 ? "" : "n") + " noch nicht sicher" : "Alles sitzt – keine Schwachstellen"}</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="pomo">${iconTile("timer", "#af52de")}<span class="txt"><b>Lern-Timer (Pomodoro)</b><p id="pomoModeSub">${pomoSubtitle()}</p></span><span class="chev">›</span></button>
    </div>

    <div class="section-title">Prüfung</div>
    <div class="ios-group">
      <button class="mode-btn" data-act="exam">${iconTile("clipboardCheck", "#34c759")}<span class="txt"><b>Prüfungssimulation</b><p>${examInProgress() ? "▶︎ Läuft – tippen zum Fortsetzen" : Math.min(30, QUESTIONS.length) + " Fragen · Timer · bestanden ab 50 %"}</p></span><span class="chev">›</span></button>
    </div>

    <div class="section-title">Fortschritt</div>
    <div class="ios-group">
      <button class="mode-btn" data-act="badges">${iconTile("trophy", "#ffb300")}<span class="txt"><b>Erfolge</b><p>${Object.keys(S.badges).length} / ${BADGES.length} freigeschaltet</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="stats">${iconTile("chart", "#5e5ce6")}<span class="txt"><b>Statistik</b><p>Trefferquote je Thema & Prüfungs-Historie</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="settings">${iconTile("sliders", "#30b0c7")}<span class="txt"><b>Einstellungen</b><p>Design, Sync, Sicherung, Erinnerungen</p></span><span class="chev">›</span></button>
      <button class="mode-btn" data-act="info">${iconTile("info", "#8e8e93")}<span class="txt"><b>So funktioniert's</b><p>Kurzanleitung & Erklärung</p></span><span class="chev">›</span></button>
    </div>

    <p class="muted center" style="margin-top:24px;margin-bottom:4px">${QUESTIONS.length} Fragen · ${Object.keys(TOPICS).length} Themen${contentVersionLabel() ? " · " + esc(contentVersionLabel()) : ""}</p>
    <button class="link-danger" data-act="reset">Fortschritt zurücksetzen</button>
    <p class="muted center" style="margin-top:16px;font-size:12px;opacity:.8">Inoffiziell · kein Produkt der ADT e. V. · <span class="link" data-act="info">Datenschutz</span></p>
  `;

  app.querySelectorAll("[data-act]").forEach(el => el.addEventListener("click", () => {
    const a = el.dataset.act;
    if (a === "mixed") { buildSession("mixed"); go("quiz"); }
    else if (a === "today") { buildSession("mixed"); go("quiz"); }
    else if (a === "goal") changeDailyGoal();
    else if (a === "topics") go("topics");
    else if (a === "code") { buildSession("code"); go("quiz"); }
    else if (a === "due") { buildSession("due"); go("quiz"); }
    else if (a === "weak") { buildSession("weak"); go("quiz"); }
    else if (a === "pomo") pomoTap();
    else if (a === "exam") examStart();
    else if (a === "badges") go("badges");
    else if (a === "stats") go("stats");
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
        <button class="mode-btn" id="btnDeleteCloud">${iconTile("xcircle", "#ff3b30")}<span class="txt"><b>Cloud-Daten löschen</b><p>Cloud-Fortschritt entfernen – lokaler Fortschritt bleibt</p></span><span class="chev">›</span></button>
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

  // App-Aktualisierung: neue Fassungen liegen auf GitHub Pages bereit, die
  // Home-Bildschirm-App merkt das aber oft erst Tage später (Cache des Service Workers).
  const appUpdate = `
    <div class="section-title">App-Version</div>
    <div class="q-card">
      <p style="margin:0 0 4px"><b>Version ${esc(APP_VERSION)}</b>${contentVersionLabel() ? " · Fragen-" + esc(contentVersionLabel()) : ""}</p>
      <p class="muted" id="updateStatus" style="margin:0 0 12px" role="status" aria-live="polite">Holt die neueste Fassung – ohne die App neu zu installieren.</p>
      <button class="btn-ghost" id="btnUpdate" style="width:auto;padding:11px 16px">${icon("sync")} Nach Updates suchen</button>
    </div>`;

  // Gesammeltes Feedback zu fragwürdigen Fragen (beim Üben per Knopf markiert).
  const nRep = reportCount();
  const feedback = `
    <div class="section-title">Fragen-Feedback</div>
    <div class="ios-group">
      <button class="mode-btn" id="btnReports">${iconTile("flag", "#ff9500")}<span class="txt"><b>Gemeldete Fragen${nRep ? " (" + nRep + ")" : ""}</b>
        <p>${nRep ? "Ansehen, kommentieren, exportieren" : "Beim Üben unter der Frage auf „" + REPORT_LABEL_OFF + "“ tippen"}</p></span><span class="chev">›</span></button>
    </div>`;

  // Lerninhalte: erlaubt das erneute Freischalten mit einem neuen Zugangscode.
  // Ohne diesen Weg bleibt ein Gerät für immer auf dem Katalog hängen, mit dem es
  // einmal freigeschaltet wurde – der Freischalt-Bildschirm erscheint nur, wenn noch
  // keine Inhalte gespeichert sind, und die stille Hintergrund-Aktualisierung nutzt
  // den alten, nach einem Katalog-Wechsel ungültigen Code.
  const content = contentGateActive() ? `
    <div class="section-title">Lerninhalte</div>
    <div class="ios-group">
      <button class="mode-btn" id="btnRelock">${iconTile("lock", "#ff9500")}<span class="txt"><b>Inhalte neu freischalten</b><p>Aktuell ${QUESTIONS.length} Fragen · ${Object.keys(TOPICS).length} Themen${contentVersionLabel() ? " · " + esc(contentVersionLabel()) : ""}. Nötig, wenn es einen neuen Zugangscode gibt.</p></span><span class="chev">›</span></button>
    </div>` : "";

  const theme = getTheme(), size = getSessionSize(), haptics = getHaptics(), font = getFontSize(), pomoGoal = getPomoGoal();
  const tOpt = (v, l) => `<option value="${v}" ${theme === v ? "selected" : ""}>${l}</option>`;
  const sOpt = (v, l) => `<option value="${v}" ${size === v ? "selected" : ""}>${l}</option>`;
  const hOpt = (v, l) => `<option value="${v}" ${(haptics ? "on" : "off") === v ? "selected" : ""}>${l}</option>`;
  const fOpt = (v, l) => `<option value="${v}" ${font === v ? "selected" : ""}>${l}</option>`;
  const pgOpt = (v, l) => `<option value="${v}" ${pomoGoal === v ? "selected" : ""}>${l}</option>`;
  const prefs = `
    <div class="section-title">Anzeige & Übung</div>
    <div class="q-card">
      <label class="set-row" for="setTheme"><span>Design</span>
        <select id="setTheme" class="ios-select">${tOpt("auto", "Automatisch (System)")}${tOpt("light", "Hell")}${tOpt("dark", "Dunkel")}</select>
      </label>
      <label class="set-row" for="setFont"><span>Schriftgröße</span>
        <select id="setFont" class="ios-select">${fOpt("normal", "Normal")}${fOpt("large", "Groß")}</select>
      </label>
      <label class="set-row" for="setSize"><span>Fragen pro Runde</span>
        <select id="setSize" class="ios-select">${sOpt(10, "10")}${sOpt(15, "15")}${sOpt(20, "20")}${sOpt(30, "30")}${sOpt(0, "Alle")}</select>
      </label>
      <label class="set-row" for="setHaptics"><span>Haptisches Feedback</span>
        <select id="setHaptics" class="ios-select">${hOpt("on", "An")}${hOpt("off", "Aus")}</select>
      </label>
      <label class="set-row" for="setPomoGoal"><span>Pomodoro-Ziel</span>
        <select id="setPomoGoal" class="ios-select">${pgOpt(0, "Aus")}${pgOpt(2, "2 Runden (~1 Std.)")}${pgOpt(4, "4 Runden (~2 Std.)")}${pgOpt(6, "6 Runden (~3 Std.)")}${pgOpt(8, "8 Runden (~4 Std.)")}</select>
      </label>
    </div>`;

  const studyWeeks = getStudyWeeks();
  const swOpt = (v) => `<option value="${v}" ${studyWeeks === v ? "selected" : ""}>${v} Woche${v === 1 ? "" : "n"}</option>`;
  const restTage = remainingStudyDays();
  const studyPlan = `
    <div class="section-title">Prüfungstermin</div>
    <div class="q-card">
      <p class="muted" style="margin:0 0 12px">Nur für den Countdown auf der Startseite. Die Bestehenswahrscheinlichkeit
      hängt bewusst <b>nicht</b> davon ab – sie misst dein Können, nicht deinen Plan.</p>
      <label class="set-row" for="setStudyWeeks"><span>Noch bis zur Prüfung</span>
        <select id="setStudyWeeks" class="ios-select">${STUDY_WEEKS_CHOICES.map(swOpt).join("")}</select>
      </label>
      <p class="muted" style="margin:10px 0 0">Aktuell: noch <b>${restTage}</b> Tag${restTage === 1 ? "" : "e"}.</p>
    </div>`;

  app.innerHTML = `<h1 class="large-title">Einstellungen</h1>${studyPlan}${prefs}
    <div class="section-title">Geräteübergreifende Synchronisation</div>${body}${backup}${feedback}${content}${remind}${appUpdate}`;

  const $ = (id) => document.getElementById(id);
  const stTheme = $("setTheme"); if (stTheme) stTheme.addEventListener("change", () => { setTheme(stTheme.value); toast("🎨 Design übernommen"); });
  const stSize = $("setSize"); if (stSize) stSize.addEventListener("change", () => { const n = parseInt(stSize.value, 10); setSessionSize(n); toast("✅ Fragen pro Runde: " + (n > 0 ? n : "alle")); });
  const stHap = $("setHaptics"); if (stHap) stHap.addEventListener("change", () => { const on = stHap.value === "on"; setHaptics(on); if (on) hapticFeedback(true); toast(on ? "📳 Haptik an" : "Haptik aus"); });
  const stFont = $("setFont"); if (stFont) stFont.addEventListener("change", () => { setFontSize(stFont.value); toast("🔤 Schriftgröße: " + (stFont.value === "large" ? "Groß" : "Normal")); });
  const stPomoGoal = $("setPomoGoal"); if (stPomoGoal) stPomoGoal.addEventListener("change", () => {
    const n = parseInt(stPomoGoal.value, 10); setPomoGoal(n);
    toast(n ? "🍅 Pomodoro-Ziel: " + n + " Runden/Tag" : "Pomodoro-Ziel ausgeschaltet");
    pomoRender();
  });
  const stStudyWeeks = $("setStudyWeeks"); if (stStudyWeeks) stStudyWeeks.addEventListener("change", () => {
    setStudyWeeks(parseInt(stStudyWeeks.value, 10)); toast("📅 Prüfungstermin aktualisiert");
    if (VIEW === "settings") renderSettings();
  });
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
  const bDel = $("btnDeleteCloud"); if (bDel) bDel.addEventListener("click", deleteCloudData);
  const bRe = $("btnRelock"); if (bRe) bRe.addEventListener("click", relockContent);
  const bRep = $("btnReports"); if (bRep) bRep.addEventListener("click", () => go("reports"));
  const bUp = $("btnUpdate"); if (bUp) bUp.addEventListener("click", () => checkForUpdate());
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
    box.innerHTML = `<div class="install-tip">${iconTile("bell", "#8e8e93")}<div>Benachrichtigungen sind hier nicht verfügbar. Auf dem iPhone: die App über Safari <b>„Zum Home-Bildschirm"</b> hinzufügen – danach sind Erinnerungen möglich.</div></div>`;
    return;
  }
  if (!pushConfigured()) {
    box.innerHTML = `<div class="install-tip">${iconTile("bell", "#8e8e93")}<div>Erinnerungen sind serverseitig noch nicht eingerichtet. Anleitung: <b>README → „Lern-Erinnerungen"</b>.</div></div>`;
    return;
  }
  const active = await remindersActive();
  const hour = getReminderHour() != null ? getReminderHour() : 18;
  if (active) {
    box.innerHTML = `
      <div class="q-card">
        <div style="display:flex;align-items:center;gap:12px">
          ${iconTile("bell", "#ff6b22")}<div style="flex:1"><b>Tägliche Erinnerung aktiv</b><p class="muted" style="margin:2px 0 0">jeden Tag um ${String(hour).padStart(2, "0")}:00 Uhr</p></div>
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
let topicFilter = "";
function renderTopics() {
  updateAppbar("topics");
  actionbar.classList.add("hidden");
  // Nach Anzeigenamen sortieren — nach internem Schlüssel stünde „Kolorektales Karzinom"
  // unter D (darm_…). Bei 111 Themen ist das nicht auffindbar.
  const alle = Object.entries(TOPICS).sort((a, b) => (a[1].name || "").localeCompare(b[1].name || "", "de"));
  // Umlaute falten, damit „qualitat" auch „Qualität" findet.
  const norm = (s) => String(s).toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ");
  const f = norm(topicFilter).trim();
  const treffer = f ? alle.filter(([, t]) => norm(t.name).indexOf(f) >= 0) : alle;

  const rows = treffer.map(([key, t]) => {
    const st = topicStats(key);
    return `<button class="topic-row" data-topic="${key}">
      ${iconTile(TOPIC_ICON[key] || "hexagon", t.color)}
      <span class="info"><b>${esc(t.name)}</b>
        <span class="bar"><span style="width:${st.pct}%;background:${t.color}"></span></span>
      </span>
      <span class="pct">${st.mastered}/${st.total}</span>
    </button>`;
  }).join("") || `<p class="muted center" style="padding:24px">Kein Thema gefunden.</p>`;

  app.innerHTML = `<h1 class="large-title">Themen</h1>
    <div class="row" style="gap:8px;margin:8px 0">
      <input id="topicSearch" type="search" class="input" style="flex:1" placeholder="Thema suchen…"
             aria-label="Themen durchsuchen" value="${esc(topicFilter)}" autocomplete="off">
    </div>
    <div class="section-title" id="topicCount" aria-live="polite">${treffer.length} von ${alle.length} Themen</div>
    <div class="ios-group">${rows}</div>
    <p class="muted center" style="margin-top:16px">„Sicher" = Frage mehrfach richtig beantwortet (Box ${SRS_MASTER_BOX}+). Die App plant Wiederholungen automatisch.</p>`;

  const box = document.getElementById("topicSearch");
  if (box) {
    box.addEventListener("input", () => {
      const pos = box.selectionStart;
      topicFilter = box.value;
      renderTopics();
      const nb = document.getElementById("topicSearch");
      if (nb) { nb.focus(); try { nb.setSelectionRange(pos, pos); } catch (e) {} }
    });
  }
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
  const isCode = q.type === "code";
  const frei = numeric || isCode;                 // freie Eingabe statt Optionsliste
  const optRole = q.type === "single" ? "radio" : "checkbox";
  // Roving Tabindex: im Optionsfeld ist genau EIN Element im Tab-Stopp (WAI-ARIA-Muster).
  let activeIdx = order.find(oi => picks.has(oi));
  if (activeIdx === undefined) activeIdx = order.length ? order[0] : -1;

  const opts = frei ? "" : order.map(origIdx => {
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
  } else if (isCode) {
    const val = picks.size ? String(Array.from(picks)[0]) : "";
    const state = checked ? (SESSION.correctFlags[i] ? " correct" : " wrong") : "";
    answerArea = `<div class="num-input code${state}">
      <input type="text" inputmode="text" id="codeField" autocomplete="off" autocapitalize="characters"
        autocorrect="off" spellcheck="false" ${checked ? "disabled" : ""}
        value="${esc(val)}" placeholder="${esc(typeof q.placeholder === "string" && q.placeholder ? q.placeholder : "z. B. C50.4")}" aria-label="Kode eingeben">
    </div>`;
  } else {
    const groupRole = q.type === "single" ? "radiogroup" : "group";
    answerArea = `<div class="options" role="${groupRole}" aria-label="Antwortmöglichkeiten">${opts}</div>`;
  }

  let explain = "";
  if (checked) {
    const ok = SESSION.correctFlags[i];
    const solved = frei ? `<div class="solved">Richtige Antwort: <b>${esc(correctAnswerText(q))}</b></div>` : "";
    explain = `<div class="explain ${ok ? "ok" : "no"}" id="explainBox" tabindex="-1" role="status">
      <b class="verdict">${ok ? "✅ Richtig" : "❌ Nicht ganz"}</b>${solved}${esc(q.explanation)}</div>`;
  }

  const typeChip = numeric
    ? '<span class="chip">Rechenaufgabe</span>'
    : (isCode ? '<span class="chip code">Kode eingeben</span>'
    : (q.type === "multi" ? '<span class="chip multi">Mehrfachauswahl</span>' : '<span class="chip">Einfachauswahl</span>'));
  const hint = numeric
    ? '<p class="q-hint">Ergebnis als Zahl eingeben (Komma oder Punkt).</p><p class="q-hint err" id="numHint" role="alert" style="display:none"></p>'
    : (isCode ? '<p class="q-hint">Kode eintragen. Punkte, Leerzeichen und Groß-/Kleinschreibung sind egal – die Ziffern und ihre Reihenfolge zählen.</p>'
    : (q.type === "multi" ? '<p class="q-hint">Es können mehrere Antworten richtig sein. Nur vollständig richtig zählt (Prüfungsregel).</p>' : ''));

  app.innerHTML = `
    <div class="quiz-top">
      <div class="progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${i + 1}" aria-label="Frage ${i + 1} von ${total}"><span style="width:${Math.round((i + 1) / total * 100)}%"></span></div>
      <span class="q-count">${i + 1} / ${total}</span>
    </div>
    <div class="q-card${checked ? "" : " q-anim"}">
      <div class="q-meta">
        <span class="chip" style="background:${t.color}22;color:${t.color}"><span class="cdot" style="background:${t.color}"></span>${esc(t.name)}</span>
        <span class="chip">${diffTxt}</span>
        ${typeChip}
      </div>
      <p class="q-text">${esc(q.question)}</p>
      ${qImageHtml(q)}
      ${hint}
      ${answerArea}
      ${explain}
      <div class="q-foot">${reportButtonHtml(q.id)}</div>
    </div>
    <div class="spacer-lg"></div>
  `;
  wireImageZoom(app);
  wireReportButtons(app);

  if (!frei && !checked) {
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
  if (isCode && !checked) {
    const cf = document.getElementById("codeField");
    if (cf) {
      cf.addEventListener("input", () => setCodeResponse(cf.value));
      cf.addEventListener("keydown", (e) => { if (e.key === "Enter" && hasResponse(q, picks)) checkCurrent(); });
      cf.focus();
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
  const genug = !isExam && enoughForToday();
  const morgenN = genug ? dueTomorrowCount() : 0;
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
    ${genug ? `<div class="q-card done-hint">✅ <b>Für heute reicht es wirklich.</b><br>
      Tagesziel erreicht und keine Wiederholung mehr fällig – mehr bringt heute kaum etwas,
      die Lernintervalle wirken über Nacht. Dein Fortschritt läuft nicht weg: die App sagt dir,
      wann die nächsten Wiederholungen dran sind.${morgenN ? " Morgen sind es " + morgenN + "." : ""}</div>` : ""}
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
/* ---- Prüfungs-Blueprint: die echte Gewichtung nachbilden ----
 * Die ADT-Prüfungsmail (15.09.2026) nennt die Gewichtung der echten Prüfung:
 *   Allgemein (klinische Referierende + Block I) 40 % · Codierung 50 % · Statistik 10 %
 * Vorher zog die Simulation faktisch EINE Frage je Thema (111 Themen → 30 zufällig),
 * gewichtete also nach Themenzahl statt nach Prüfungsrelevanz: ~55/39/6 statt 40/50/10.
 * Codierung – die Hälfte der echten Prüfung – war damit der schwächst getestete Block.
 *
 * Zuordnung als Regel statt als 111-Zeilen-Tabelle: robust gegenüber Katalog-Updates
 * (neue Themen werden automatisch einsortiert) und funktioniert auch mit dem kleinen
 * Beispielkatalog. Lesart: „Codierung" = die Tätigkeit (TNM/ICD-O/OPS/oBDS vergeben),
 * unabhängig davon, welches Skript sie gelehrt hat. Die Mail ließe auch die Lesart zu,
 * Block I (medgrund/basisdok/klassqual/kregister) komplett zu „Allgemein" zu zählen –
 * dann läge der Katalog bei 63/31/6. Beides ist vertretbar; Regel unten anpassbar. */
const EXAM_BLUEPRINT = { K: 40, C: 50, S: 10 };   // Allgemein/Klinik · Codierung · Statistik
const EXAM_BLOCK_NAMES = { K: "Allgemein & Klinik", C: "Codierung", S: "Statistik" };
const EXAM_STAT_RX = /^(deskstat|analstat)|statistik|^patho2_studien$/i;
const EXAM_COD_RX = /^(tnm|icdo|befund|erheb|erhebbearb|basisdok)(_|$)|tnm|staging|grading|kodierung|icd|\bops\b|obds|dokumentation|klassifikation|datenqualitaet|morpholog|histopathologie|meldew|meldeb/i;
/* Ordnet eine Frage einem der drei Prüfungsblöcke zu. Nimmt die FRAGE, nicht nur das
 * Thema: Eine Kodier-Aufgabe („Kode eingeben") ist immer Codierung, auch wenn sie in
 * einem klinischen Thema steht — die Lymphom- und Leukämie-Kodes zählten sonst als
 * „Allgemein & Klinik" und die Simulation zöge zu wenig Codierung. Ein String wird
 * weiterhin als Themenschlüssel akzeptiert. */
function examBlockOf(q) {
  if (q && typeof q === "object") {
    if (q.type === "code") return "C";
    q = q.topic;
  }
  const k = String(q || "");
  if (EXAM_STAT_RX.test(k)) return "S";
  return EXAM_COD_RX.test(k) ? "C" : "K";
}

function buildExamQuestions() {
  const target = Math.min(30, QUESTIONS.length);
  const BL = ["K", "C", "S"];
  // Fragen nach Block und darin nach Thema bündeln
  const byBlock = { K: {}, C: {}, S: {} };
  for (const q of QUESTIONS) {
    const b = examBlockOf(q);
    (byBlock[b][q.topic] = byBlock[b][q.topic] || []).push(q);
  }
  const avail = {}, slots = {};
  for (const b of BL) {
    avail[b] = Object.values(byBlock[b]).reduce((s, a) => s + a.length, 0);
    slots[b] = Math.min(avail[b], Math.round(target * EXAM_BLUEPRINT[b] / 100));
  }
  // Rundungsdrift und Blöcke ohne genug Fragen ausgleichen – zuerst Codierung
  // auffüllen (größter Anteil der echten Prüfung), Statistik zuletzt kürzen.
  let rest = target - BL.reduce((s, b) => s + slots[b], 0);
  while (rest > 0) {
    let moved = false;
    for (const b of ["C", "K", "S"]) if (rest > 0 && slots[b] < avail[b]) { slots[b]++; rest--; moved = true; }
    if (!moved) break;                       // Katalog kleiner als target
  }
  while (rest < 0) {
    let moved = false;
    for (const b of ["S", "K", "C"]) if (rest < 0 && slots[b] > 0) { slots[b]--; rest++; moved = true; }
    if (!moved) break;
  }
  // Innerhalb eines Blocks reihum über die Themen ziehen, damit nicht alle
  // Codierungsfragen aus demselben Thema kommen.
  const picked = [];
  for (const b of BL) {
    const pools = shuffle(Object.keys(byBlock[b])).map(t => shuffle(byBlock[b][t]));
    let need = slots[b];
    while (need > 0) {
      let took = false;
      for (const pool of pools) {
        if (need <= 0) break;
        if (pool.length) { picked.push(pool.pop()); need--; took = true; }
      }
      if (!took) break;
    }
  }
  return shuffle(picked).slice(0, target);
}
// Wie viele Fragen je Block sind in einer Fragenliste? (Auswertung/Anzeige)
function examBlockCounts(qs) {
  const c = { K: 0, C: 0, S: 0 };
  for (const q of qs) c[examBlockOf(q)]++;
  return c;
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

// Fragetyp AUS SICHT DER PRÜFUNG. Die echte Prüfung sagt nicht, wie viele Antworten richtig
// sind – und § 5 der Prüfungsordnung wertet alles-oder-nichts (nur vollständig richtig zählt).
// Wer in der Simulation an den Radiobuttons ablesen kann „hier ist genau eine richtig", übt
// eine Erleichterung ein, die es in der Prüfung nicht gibt. Deshalb verhalten sich single-
// und multi-Fragen hier gleich: Mehrfachauswahl. Der Katalog bleibt unberührt, die Übung
// (Lernmodus) zeigt weiterhin den echten Typ.
function examPickType(q) { return (q.type === "numeric" || q.type === "code") ? q.type : "multi"; }

// In-place-Auswahl in der Prüfung (kein Full-Re-Render → Fokus/VoiceOver stabil,
// kein Flackern während der Simulation). Aktualisiert Optionen + „beantwortet"-Zähler.
function examApplyPick(origIdx, buttons) {
  const arr = EXAM.picks[EXAM.idx];
  const k = arr.indexOf(origIdx);
  if (k >= 0) arr.splice(k, 1); else arr.push(origIdx);
  const set = new Set(EXAM.picks[EXAM.idx]);
  for (const el of buttons) {
    const oi = parseInt(el.dataset.eoi, 10);
    const on = set.has(oi);
    el.classList.toggle("selected", on);
    el.setAttribute("aria-checked", on ? "true" : "false");
    const box = el.querySelector(".box");
    if (box) box.textContent = on ? "✓" : "";
  }
  saveExam();
  const ov = document.getElementById("examOverview");
  if (ov) { const answered = EXAM.picks.filter(p => p.length).length; ov.textContent = `Übersicht · ${answered}/${EXAM.qids.length} beantwortet`; }
}
// Kode-Antwort in der Prüfung: speichern OHNE Re-Render (Eingabefeld behält den Fokus).
function examSetCode(raw) {
  const t = String(raw);
  EXAM.picks[EXAM.idx] = codeKey(t) ? [t] : [];
  saveExam();
  const ov = document.getElementById("examOverview");
  if (ov) { const a = EXAM.picks.filter(p => p.length).length; ov.textContent = `Übersicht · ${a}/${EXAM.qids.length} beantwortet`; }
}
// Numerische Prüfungsantwort: speichern OHNE Re-Render (Eingabefeld behält den Fokus).
function examSetNumeric(raw) {
  const n = parseNum(raw);
  EXAM.picks[EXAM.idx] = Number.isFinite(n) ? [n] : [];
  saveExam();
  const ov = document.getElementById("examOverview");
  if (ov) { const a = EXAM.picks.filter(p => p.length).length; ov.textContent = `Übersicht · ${a}/${EXAM.qids.length} beantwortet`; }
  // In der Prüfung gibt es kein Zwischen-Feedback und keinen Prüf-Knopf: Ohne diesen
  // Hinweis fiele eine unlesbare Eingabe kommentarlos aus der Wertung.
  const hint = document.getElementById("examNumHint");
  if (hint) {
    const unlesbar = String(raw).trim() !== "" && !Number.isFinite(n);
    hint.textContent = unlesbar ? "Diese Eingabe wird nicht als Antwort gewertet – bitte nur eine Zahl eingeben." : "";
    hint.style.display = unlesbar ? "" : "none";
  }
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

  const ptype = examPickType(q);
  const numeric = ptype === "numeric";
  const isCode = ptype === "code";
  const frei = numeric || isCode;
  const optRole = "checkbox";
  let activeIdx = order.find(oi => picks.has(oi));
  if (activeIdx === undefined) activeIdx = order.length ? order[0] : -1;
  const opts = frei ? "" : order.map(origIdx => {
    const isPicked = picks.has(origIdx);
    const cls = "opt type-" + ptype + (isPicked ? " selected" : "");
    const mark = isPicked ? "✓" : "";
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
  } else if (isCode) {
    const val = EXAM.picks[i].length ? String(EXAM.picks[i][0]) : "";
    answerArea = `<div class="num-input code">
      <input type="text" inputmode="text" id="examCode" autocomplete="off" autocapitalize="characters"
        autocorrect="off" spellcheck="false" value="${esc(val)}"
        placeholder="${esc(typeof q.placeholder === "string" && q.placeholder ? q.placeholder : "z. B. C50.4")}" aria-label="Kode eingeben">
    </div>`;
  } else {
    answerArea = `<div class="options" role="group" aria-label="Antwortmöglichkeiten">${opts}</div>`;
  }
  const typeChip = numeric ? '<span class="chip">Rechenaufgabe</span>'
    : (isCode ? '<span class="chip code">Kode eingeben</span>' : '<span class="chip multi">Mehrfachauswahl</span>');
  const hint = numeric ? '<p class="q-hint">Ergebnis als Zahl eingeben. Auswertung erst nach Abgabe.</p><p class="q-hint err" id="examNumHint" role="alert" style="display:none"></p>'
    : (isCode ? '<p class="q-hint">Kode eintragen. Punkte und Groß-/Kleinschreibung sind egal. Auswertung erst nach Abgabe.</p>'
    : '<p class="q-hint">Es können eine oder mehrere Antworten richtig sein. Nur vollständig richtig zählt. Kein Zwischen-Feedback – Auswertung erst nach Abgabe.</p>');

  app.innerHTML = `
    <div class="exam-bar">
      <span class="exam-timer" id="examTimer">${fmtTime(examRemainingMs(EXAM))}</span>
      <span class="exam-count">Frage ${i + 1} / ${N}</span>
      <button class="exam-flag ${EXAM.flags[i] ? "on" : ""}" id="examFlag" aria-label="Frage zur Überprüfung markieren">${icon("flag")}</button>
    </div>
    <div class="q-card">
      <div class="q-meta"><span class="chip" style="background:${t.color}22;color:${t.color}"><span class="cdot" style="background:${t.color}"></span>${esc(t.name)}</span>${typeChip}</div>
      <p class="q-text">${esc(q.question)}</p>
      ${qImageHtml(q)}
      ${hint}
      ${answerArea}
    </div>
    <button class="btn-ghost" id="examOverview" style="margin-top:4px">Übersicht · ${answered}/${N} beantwortet</button>
    <div class="spacer-lg"></div>
  `;
  wireImageZoom(app);
  if (!frei) {
    const optsEl = app.querySelector(".options");
    const buttons = optsEl ? Array.from(optsEl.querySelectorAll("[data-eoi]")) : [];
    buttons.forEach(el => el.addEventListener("click", () => { examApplyPick(parseInt(el.dataset.eoi, 10), buttons); setRovingActive(buttons, el); }));
    if (optsEl) optsEl.addEventListener("keydown", (e) => onOptionKeydown(e, buttons, examPickType(q), (bel, btns) => examApplyPick(parseInt(bel.dataset.eoi, 10), btns)));
  } else if (numeric) {
    const nf = document.getElementById("examNum");
    if (nf) nf.addEventListener("input", () => examSetNumeric(nf.value));
  } else {
    const cf = document.getElementById("examCode");
    if (cf) cf.addEventListener("input", () => examSetCode(cf.value));
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
  pushExamHistory(pct);                   // für die Prüfungs-Historie (lokal)
  touchStreak(); bumpToday(total); saveState(); checkBadges();

  EXAM_RESULT = { results, right, total, pct, auto };
  EXAM = null; removeExam();
  go("examresult", { replace: true });   // Prüfungsansicht durch das Ergebnis ersetzen
  if (pct >= 50) celebrate();            // bestandene Prüfung feiern
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

  // Prüfungsblöcke (Gewichtung der echten Prüfung: 40/50/10) – zeigt sofort,
  // ob ausgerechnet Codierung schwächelt, der größte Block der echten Prüfung.
  const bAgg = { K: { r: 0, n: 0 }, C: { r: 0, n: 0 }, S: { r: 0, n: 0 } };
  for (const r of res.results) { const b = bAgg[examBlockOf(r.q)]; b.n++; if (r.ok) b.r++; }
  const blockRows = ["K", "C", "S"].filter(b => bAgg[b].n).map(b => {
    const a = bAgg[b], p = Math.round(a.r / a.n * 100);
    const col = p >= 75 ? "var(--success)" : p >= 50 ? "var(--warn)" : "var(--danger)";
    return `<div class="theme-row"><span class="tn">${EXAM_BLOCK_NAMES[b]}<br><span class="muted" style="font-size:12px">${EXAM_BLUEPRINT[b]} % der echten Prüfung</span></span><span class="tbar"><span style="width:${p}%;background:${col}"></span></span><span class="tp">${a.r}/${a.n}</span></div>`;
  }).join("");

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
      ? (q.type === "numeric" ? esc(fmtNum(r.picks[0]) + (q.unit ? " " + q.unit : ""))
         : q.type === "code" ? esc(String(r.picks[0]))
         : r.picks.map(i => esc(q.options[i])).join(", "))
      : "— (nicht beantwortet)";
    const corr = esc(correctAnswerText(q));
    return `<div class="review-item ${r.ok ? "ok" : "no"}">
      <div class="ri-head">${r.ok ? "✅" : "❌"} <b>Frage ${k + 1}</b> · ${esc(TOPICS[q.topic].name)}</div>
      <p class="ri-q">${esc(q.question)}</p>
      <p class="ri-line"><span class="ri-lab">Deine Antwort:</span> ${your}</p>
      ${r.ok ? "" : `<p class="ri-line"><span class="ri-lab">Richtig:</span> ${corr}</p>`}
      <p class="ri-exp">${esc(q.explanation)}</p>
      <div class="q-foot">${reportButtonHtml(q.id)}</div>
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
    <div class="section-title">Prüfungsblöcke</div>
    <div class="q-card">${blockRows}
      <p class="muted" style="margin:10px 0 0;font-size:12.5px">Die Simulation zieht die Fragen in der Gewichtung der echten Prüfung
      (Allgemein &amp; Klinik 40 % · Codierung 50 % · Statistik 10 %).</p></div>
    <div class="section-title">Themenprofil</div>
    <div class="q-card">${themeRows}</div>
    <div class="section-title">Auswertung im Detail</div>
    ${review}
    <div class="spacer-lg"></div>
  `;
  wireReportButtons(app);

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

/* ---- Statistik: Trefferquote je Thema + Prüfungs-Historie ---- */
function renderStats() {
  updateAppbar("stats");
  actionbar.classList.add("hidden");
  const acc = overallAccuracy();
  const secure = masteredCount();

  const topicRows = Object.entries(TOPICS).map(([key, t]) => {
    const qs = QUESTIONS.filter(q => q.topic === key);
    let seen = 0, correct = 0;
    for (const q of qs) { const p = S.perQuestion[q.id]; if (p) { seen += p.seen; correct += p.correct; } }
    const a = seen ? Math.round(correct / seen * 100) : 0;
    const st = topicStats(key);
    return `<div class="theme-row">
      <span class="tn">${esc(t.name)}<br><span class="muted" style="font-size:12px">${st.mastered}/${st.total} sicher</span></span>
      <span class="tbar"><span style="width:${a}%;background:${t.color}"></span></span>
      <span class="tp">${seen ? a + "%" : "–"}</span></div>`;
  }).join("");

  const hist = getExamHistory().slice().reverse();   // neueste zuerst
  const histRows = hist.length
    ? hist.slice(0, 15).map(h => {
        const dt = new Date(h.d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
        const col = h.pct >= 50 ? "var(--success)" : "var(--danger)";
        return `<div class="theme-row"><span class="tn">${dt}</span><span class="tbar"><span style="width:${h.pct}%;background:${col}"></span></span><span class="tp">${h.pct}%</span></div>`;
      }).join("")
    : `<p class="muted" style="margin:0">Noch keine Prüfungssimulation abgeschlossen.</p>`;

  app.innerHTML = `
    <h1 class="large-title">Statistik</h1>
    ${readinessCardHTML(true)}
    <div class="stat-grid">
      <div class="stat"><div class="num">${S.totalAnswered}</div><div class="lbl">beantwortet</div></div>
      <div class="stat"><div class="num">${acc}%</div><div class="lbl">Trefferquote</div></div>
      <div class="stat"><div class="num">${secure}</div><div class="lbl">sichere Fragen</div></div>
    </div>
    <div class="section-title">Trefferquote je Thema</div>
    <div class="q-card">${topicRows}</div>
    <div class="section-title">Prüfungs-Historie</div>
    <div class="q-card">${histRows}</div>
    <p class="muted center" style="margin-top:14px;font-size:12px">Die Prüfungs-Historie wird lokal auf diesem Gerät geführt.</p>`;
}

/* ---- Gemeldete Fragen (gesammeltes Feedback) ---- */
function renderReports() {
  updateAppbar("reports");
  actionbar.classList.add("hidden");
  const list = reportedList();

  if (!list.length) {
    app.innerHTML = `<h1 class="large-title">Gemeldete Fragen</h1>
      <div class="empty"><div class="ic">🚩</div>
        <h2>Noch nichts gemeldet</h2>
        <p class="muted">Tippe beim Üben unter einer Frage auf <b>„${REPORT_LABEL_OFF}"</b>, wenn sie
        fragwürdig wirkt – falsche Antwort, unklar formuliert oder ein Tippfehler.
        Hier sammelt sich alles, damit die Fragen später gebündelt überarbeitet werden können.</p></div>`;
    return;
  }

  const hasIssueTarget = !!feedbackRepo();
  const issuedCount = list.filter(r => r.issuedAt).length;
  const items = list.map(r => {
    const q = r.q;
    const t = q ? TOPICS[q.topic] : null;
    const when = r.at ? new Date(r.at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–";
    const issued = r.issuedAt ? new Date(r.issuedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
    return `<div class="review-item report-item">
      <div class="ri-head">🚩 ${esc(when)} · ${t ? esc(t.name) : "Thema unbekannt"} · ${esc(r.id)}</div>
      <p class="ri-q">${q ? esc(q.question) : "Diese Frage ist im aktuellen Katalog nicht mehr enthalten."}</p>
      ${q ? `<p class="ri-line"><span class="ri-lab">Richtig:</span> ${esc(correctAnswerText(q))}</p>` : ""}
      <input class="input report-note" type="text" data-note="${esc(r.id)}" value="${esc(r.note)}"
        placeholder="Was stimmt nicht? (optional)" aria-label="Notiz zur gemeldeten Frage" autocomplete="off">
      ${r.issueNumber
        ? `<p class="ri-line issued-note">${icon("share")} Issue <a class="link" href="${esc(r.issueUrl || "#")}" target="_blank" rel="noopener">#${esc(String(r.issueNumber))}</a> angelegt am ${esc(issued)}</p>`
        : (issued ? `<p class="ri-line issued-note">${icon("share")} Issue vorbereitet am ${esc(issued)}</p>` : "")}
      <div class="report-actions">
        ${hasIssueTarget ? `<button class="btn-ghost${issued ? " done" : ""}" data-issue="${esc(r.id)}">${icon("share")}<span class="ib-txt">${r.issueNumber ? "Nochmal senden" : (issued ? "Issue erneut öffnen" : "Als Issue")}</span></button>` : ""}
        <button class="btn-ghost report-remove" data-unreport="${esc(r.id)}">Meldung aufheben</button>
      </div>
    </div>`;
  }).join("");

  app.innerHTML = `<h1 class="large-title">Gemeldete Fragen<span class="sub">${list.length} markiert</span></h1>
    <div class="q-card">
      <p class="muted" style="margin:0 0 12px">Notiz je Frage ergänzen und weitergeben –
      ${hasIssueTarget ? "je Frage ein GitHub-Issue, " : ""}oder alles zusammen kopieren bzw. als Datei sichern.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-ghost" id="repCopy" style="width:auto;padding:11px 16px">${icon("copy")} Alle kopieren</button>
        <button class="btn-ghost" id="repExport" style="width:auto;padding:11px 16px">${icon("export")} Als Datei</button>
      </div>
      ${hasIssueTarget ? `<p class="muted" style="margin:12px 0 0;font-size:13px">„Als Issue" legt <b>je Frage ein eigenes Issue</b> in <b>${esc(feedbackRepo())}</b> an – in GitHub nur noch „Create" tippen.${issuedCount ? ` Bereits vorbereitet: <b>${issuedCount}</b> von ${list.length}.` : ""}</p>` : ""}
    </div>
    ${items}
    <button class="btn-ghost" id="repClear" style="color:var(--danger);margin-top:6px">Alle Meldungen aufheben</button>
    <div class="spacer-lg"></div>`;

  app.querySelectorAll("[data-note]").forEach(el => {
    el.addEventListener("change", () => setReportNote(el.dataset.note, el.value));
    el.addEventListener("blur", () => setReportNote(el.dataset.note, el.value));
  });
  app.querySelectorAll("[data-unreport]").forEach(el => el.addEventListener("click", () => {
    setReported(el.dataset.unreport, false);
    toast("Meldung aufgehoben");
    renderReports();
  }));
  app.querySelectorAll("[data-issue]").forEach(el => el.addEventListener("click", async () => {
    const r = list.find(x => x.id === el.dataset.issue);
    if (!r) return;
    // 1. Wahl: direkt serverseitig anlegen – man bleibt in der App.
    if (issueApiPossible()) {
      const label = el.querySelector(".ib-txt");
      const before = label ? label.textContent : "";
      el.disabled = true; if (label) label.textContent = "Lege an…";
      const res = await createIssueDirect(r);
      el.disabled = false; if (label) label.textContent = before;
      if (res && res.ok) {
        toast(res.existing ? "Issue #" + res.number + " gibt es schon" : "✅ Issue #" + res.number + " angelegt");
        renderReports();
        return;
      }
      // 2. Wahl: GitHub-Formular öffnen. Ehrlich sagen, warum der direkte Weg ausfiel.
      const ok = await modalChoice("Direkt anlegen ging nicht",
        issueErrorText(res && res.error) + " Stattdessen das ausgefüllte GitHub-Formular öffnen?",
        [{ label: "Formular öffnen", value: true }, { label: "Abbrechen", value: false, variant: "ghost" }]);
      if (!ok) return;
    }
    openIssue(issueForReport(r));
    markIssued(r.id);        // Merkzettel, damit beim Durchgehen nichts doppelt angelegt wird
    renderReports();
  }));
  document.getElementById("repCopy").addEventListener("click", copyReports);
  document.getElementById("repExport").addEventListener("click", exportReports);
  document.getElementById("repClear").addEventListener("click", async () => {
    const ok = await modalChoice("Alle Meldungen aufheben",
      `Wirklich alle ${list.length} Markierungen entfernen? Die Notizen gehen dabei verloren.`,
      [{ label: "Ja, aufheben", value: true, variant: "danger" }, { label: "Abbrechen", value: false, variant: "ghost" }]);
    if (!ok) return;
    for (const r of list) setReported(r.id, false);
    toast("Alle Meldungen aufgehoben");
    renderReports();
  });
}

function copyReports() {
  const txt = reportsAsText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => toast("📋 Meldungen kopiert")).catch(() => toast("⚠️ Kopieren nicht möglich – bitte exportieren"));
  } else {
    toast("⚠️ Kopieren nicht möglich – bitte exportieren");
  }
}

function exportReports() {
  try {
    const blob = new Blob([reportsAsText()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "adt-trainer-gemeldete-fragen-" + todayStr() + ".md";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    toast("💾 Datei gespeichert");
  } catch (e) {
    console.warn("Export der Meldungen fehlgeschlagen", e);
    toast("⚠️ Export nicht möglich");
  }
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

    <div class="section-title">Fragwürdige Fragen melden</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">Unter jeder Frage sitzt <b>„${REPORT_LABEL_OFF}"</b> 🚩 – für alles, was falsch,
    unklar oder fehlerhaft wirkt (am Laptop: Taste <b>M</b>). Es öffnet sich ein kleiner Dialog über der Frage: mit oder ohne
    <b>Notiz</b> melden, danach geht es genau dort weiter, wo du warst. Gesammelt wird alles unter
    <b>Einstellungen → Gemeldete Fragen</b>; dort lässt sich die Liste kopieren oder als Datei exportieren, um die
    Fragen später gebündelt zu überarbeiten.</p></div>

    <div class="section-title">Auf allen Geräten</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">Unter <b>Einstellungen</b> einen <b>Sync-Code</b> erstellen und auf weiteren Geräten eingeben – dein Fortschritt ist überall gleich. Jeder eigene Code steht für einen eigenen, unabhängigen Fortschritt.</p></div>

    <div class="section-title">Lern-Erinnerungen</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">Optionale <b>tägliche Erinnerung</b> ans Üben zur Wunsch-Uhrzeit (unter Einstellungen). Auf dem iPhone nur, wenn die App zum Home-Bildschirm hinzugefügt ist.</p></div>

    <div class="section-title">Als App installieren</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">In <b>Safari</b> unten auf <b>Teilen</b> → <b>„Zum Home-Bildschirm"</b>. Danach startet die App im Vollbild und läuft komplett offline.</p></div>

    <div class="section-title">Updates</div>
    <div class="q-card"><p style="margin:0;line-height:1.55">Neue Fassungen kommen automatisch – meist beim übernächsten Start. Wer nicht warten will:
    <b>Einstellungen → App-Version → „Nach Updates suchen"</b>. Die App holt dann sofort die neueste Fassung.
    <b>Neu installieren ist nie nötig</b>, und der Lernfortschritt bleibt dabei erhalten.</p></div>

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

    <p class="muted center" style="margin:22px 2px 0">App-Version ${APP_VERSION}${contentVersionLabel() ? " · Fragen-" + esc(contentVersionLabel()) : ""}</p>
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
    else if (view === "stats") renderStats();
    else if (view === "settings") renderSettings();
    else if (view === "reports") renderReports();
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
  // „m" wie melden: Frage als fragwürdig markieren (auch nach dem Prüfen).
  if (e.key === "m" || e.key === "M") {
    const rb = app.querySelector("[data-report]");
    if (rb) { e.preventDefault(); rb.click(); }
    return;
  }
  if (SESSION.checked[i]) { if (e.key === "Enter") { const nb = document.getElementById("nextBtn"); if (nb) { e.preventDefault(); nb.click(); } } return; }
  if (isInputType(currentQ())) return;         // Eingabefeld hat einen eigenen Enter-Handler
  if (/^[1-9]$/.test(e.key)) {
    const btns = optionButtons(), n = parseInt(e.key, 10) - 1;
    if (btns[n]) { e.preventDefault(); btns[n].click(); }
  } else if (e.key === "Enter") {
    const cb = document.getElementById("checkBtn"); if (cb && !cb.disabled) { e.preventDefault(); cb.click(); }
  }
}
function handleExamKey(e) {
  if (isInputType(examQuestions()[EXAM.idx])) return;
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

/* ---- „Nach Updates suchen" (App-Aktualisierung auf Knopfdruck) ----------------------
 * Die App liegt auf GitHub Pages; eine neue Fassung ist also einfach da, sobald gepusht
 * wurde. Nur merkt die Home-Bildschirm-App auf dem iPhone das oft tagelang nicht: Der
 * Service Worker liefert die alte Shell aus dem Cache und aktualisiert sie erst für den
 * NÄCHSTEN Start. Dieser Knopf erzwingt den Vorgang – Neuinstallieren ist nie nötig.
 *
 * Ablauf: (1) auf einen neuen Service Worker prüfen, (2) Shell frisch in den Cache holen
 * (macht der Service Worker, siehe sw.js → REFRESH_SHELL), (3) ausgelieferte mit laufender
 * Version vergleichen und das Neuladen anbieten. */
const SW_REFRESH_TIMEOUT_MS = 20000;
function updateAvailable(remoteVersion) {
  // Jede Abweichung zählt – auch ein bewusstes Zurückrollen soll ankommen.
  return !!remoteVersion && remoteVersion !== APP_VERSION;
}
// Service Worker bitten, die App-Shell frisch zu laden. Liefert { ok, version } oder null.
function swRefreshShell() {
  return new Promise((resolve) => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return resolve(null);
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const t = setTimeout(() => finish(null), SW_REFRESH_TIMEOUT_MS);
    try {
      const ch = new MessageChannel();
      ch.port1.onmessage = (ev) => { clearTimeout(t); finish(ev.data || null); };
      navigator.serviceWorker.controller.postMessage({ type: "REFRESH_SHELL" }, [ch.port2]);
    } catch (e) { clearTimeout(t); finish(null); }
  });
}
// Wartenden Service Worker aktivieren und neu laden (controllerchange löst den Reload aus).
function applyWaitingWorker(worker) {
  swUpdateAccepted = true;
  try { worker.postMessage({ type: "SKIP_WAITING" }); }
  catch (e) { location.reload(); }
  setTimeout(() => { if (!document.hidden) location.reload(); }, 2500);   // Sicherheitsnetz
}
let updateCheckRunning = false;
async function checkForUpdate(opts = {}) {
  if (updateCheckRunning) return;
  updateCheckRunning = true;
  const status = (txt) => { const el = document.getElementById("updateStatus"); if (el) el.textContent = txt; };
  try {
    if (!navigator.onLine) { status("Offline – zum Aktualisieren online gehen."); toast("🔌 Offline"); return; }
    status("Suche nach Updates…");

    // Ohne Service Worker (z. B. normaler Browser-Tab, Privatmodus) bleibt nur das
    // harte Neuladen – dabei holt der Browser die Dateien ohnehin frisch.
    if (!("serviceWorker" in navigator)) { location.reload(); return; }

    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) { try { await reg.update(); } catch (e) { /* offline/blockiert: unten weiter */ } }

    // Fall A: sw.js selbst ist neu → es wartet bereits eine neue Fassung.
    if (reg && reg.waiting && navigator.serviceWorker.controller) {
      status("Neue Version wird geladen…");
      applyWaitingWorker(reg.waiting);
      return;
    }

    // Ohne kontrollierenden Service Worker (normaler Browser-Tab, Privatmodus, allererster
    // Start) gibt es gar keine Cache-Schicht, die im Weg stehen könnte – neu laden genügt.
    if (!navigator.serviceWorker.controller) { status("Lädt neu…"); location.reload(); return; }

    // Fall B: nur Shell-Dateien (app.js/css/Fragen) sind neu → frisch in den Cache holen.
    const res = await swRefreshShell();
    if (!res || !res.ok) {
      status("Update-Prüfung nicht möglich – bitte später erneut versuchen.");
      toast("⚠️ Prüfung fehlgeschlagen");
      return;
    }
    if (!updateAvailable(res.version)) {
      status("Aktuell: Version " + APP_VERSION + " · zuletzt geprüft " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
      toast("✅ Bereits aktuell");
      return;
    }

    status("Version " + res.version + " ist verfügbar.");
    const ok = opts.auto ? true : await modalChoice(
      "Neue Version verfügbar",
      `Version ${res.version} ist da (installiert: ${APP_VERSION}). Jetzt neu laden? Dein Fortschritt bleibt erhalten.`,
      [{ label: "Jetzt aktualisieren", value: true }, { label: "Später", value: false, variant: "ghost" }]);
    if (ok) { status("Wird geladen…"); location.reload(); }
  } catch (e) {
    console.warn("Update-Prüfung fehlgeschlagen", e);
    status("Update-Prüfung fehlgeschlagen.");
    toast("⚠️ Prüfung fehlgeschlagen");
  } finally {
    updateCheckRunning = false;
  }
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

/* Wie modalChoice, aber mit einem Textfeld – für kurze Eingaben, ohne die Ansicht
   zu verlassen (z. B. Notiz beim Melden einer Frage).
   Liefert { action, value } bzw. { action: null } bei Abbruch/Escape. */
function modalPrompt(title, message, opts = {}) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const tid = "modalTitle" + (++modalTitleSeq);
    const iid = "modalInput" + modalTitleSeq;
    const buttons = opts.buttons || [{ label: "OK", value: "ok" }, { label: "Abbrechen", value: null, variant: "ghost" }];
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    const btnHtml = buttons.map((b, i) => {
      const cls = b.variant === "danger" ? "btn-danger" : b.variant === "ghost" ? "btn-ghost" : "btn-primary";
      return `<button class="${cls} modal-btn" data-i="${i}">${esc(b.label)}</button>`;
    }).join("");
    ov.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="${tid}">
      <h3 class="modal-title" id="${tid}">${esc(title)}</h3>
      ${message ? `<p class="modal-msg">${esc(message)}</p>` : ""}
      <input class="input modal-input" type="text" id="${iid}" value="${esc(opts.value || "")}"
        placeholder="${esc(opts.placeholder || "")}" maxlength="${Math.max(1, parseInt(opts.maxLength, 10) || 300)}"
        aria-label="${esc(opts.label || title)}" autocomplete="off">
      <div class="modal-actions">${btnHtml}</div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    const field = ov.querySelector("#" + iid);
    const btns = Array.from(ov.querySelectorAll(".modal-btn"));
    const focusables = [field].concat(btns);
    const close = (action) => {
      ov.removeEventListener("keydown", onKey);
      ov.classList.remove("show"); setTimeout(() => ov.remove(), 200);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (_) {}
      resolve({ action: action, value: (field.value || "").trim() });
    };
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(null); return; }
      // Enter im Textfeld = erste (bestätigende) Aktion – wie im iOS-Alert.
      if (e.key === "Enter" && e.target === field) { e.preventDefault(); close(buttons[0].value); return; }
      if (e.key === "Tab") {   // Fokusfalle: Tab bleibt im Dialog
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    btns.forEach((el) => el.addEventListener("click", () => close(buttons[+el.dataset.i].value)));
    ov.addEventListener("keydown", onKey);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(null); });
    field.focus();
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
// Freischalt-Bildschirm: blockiert die App, bis ein gültiger Zugangscode eingegeben wurde.
function showContentGate(msg) {
  try { updateAppbar("home"); } catch (e) {}
  const back = document.getElementById("backBtn"); if (back) back.classList.add("hidden");
  actionbar.classList.add("hidden");
  app.innerHTML = `
    <h1 class="large-title">Geschützte Inhalte</h1>
    <div class="q-card">
      <p style="margin:0 0 12px;line-height:1.55">Diese Lerninhalte sind zugangsgeschützt. Bitte gib deinen <b>Zugangscode</b> ein – er wird auf diesem Gerät gespeichert, du brauchst ihn nur einmal.</p>
      <input id="gateCode" inputmode="text" autocapitalize="none" autocomplete="off" spellcheck="false"
        placeholder="Zugangscode" aria-label="Zugangscode"
        style="width:100%;padding:14px;font-size:17px;border-radius:12px;border:2px solid var(--border);background:var(--bg-elev);color:var(--text)">
      <button class="btn-primary" id="gateBtn" style="margin-top:12px">Freischalten</button>
      <p id="gateErr" style="color:var(--danger);margin:10px 0 0;min-height:1.2em">${msg ? esc(msg) : ""}</p>
    </div>
    <p class="muted center" style="margin-top:16px;font-size:12px">Ohne gültigen Code werden keine Inhalte geladen. Zum Freischalten einmalig online sein.</p>`;
  const inp = document.getElementById("gateCode");
  const btn = document.getElementById("gateBtn");
  const err = document.getElementById("gateErr");
  const submit = async () => {
    const code = (inp.value || "").trim();
    if (!code) return;
    btn.disabled = true; err.style.color = "var(--text-dim)"; err.textContent = "Prüfe…";
    if (!navigator.onLine) { err.style.color = "var(--danger)"; err.textContent = "Zum Freischalten einmalig online sein."; btn.disabled = false; return; }
    const content = window.ADTSync ? await ADTSync.getContent(code) : null;
    if (!content) {
      err.style.color = "var(--danger)";
      err.textContent = "Code ungültig oder Inhalte nicht erreichbar.";
      btn.disabled = false; return;
    }
    // Code war richtig – ab hier kann nur noch das Speichern scheitern. Das muss
    // unterscheidbar sein, sonst sucht man den Fehler beim Code (siehe iOS-Speichergrenze).
    const res = await storeUnlockedContent(content, code);
    if (res === "ok") {
      try { localStorage.setItem(CONTENT_FP_KEY, contentFingerprint(content)); } catch (e) {}
      location.reload(); return;
    }
    err.style.color = "var(--danger)";
    err.textContent = res === "quota"
      ? "Code ist richtig, aber der Speicher dieses Geräts ist voll. Bitte Speicher freigeben und erneut versuchen."
      : "Code ist richtig, das Speichern auf diesem Gerät ist fehlgeschlagen.";
    btn.disabled = false;
  };
  if (btn) btn.addEventListener("click", submit);
  if (inp) { inp.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); }); inp.focus(); }
}

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

// Cloud-Fortschritt löschen (Privatsphäre): überschreibt den Cloud-Eintrag mit einem
// leeren Stand und trennt dieses Gerät. Der LOKALE Fortschritt bleibt erhalten.
async function deleteCloudData() {
  if (!syncEnabled()) { toast("Kein Cloud-Sync aktiv"); return; }
  const ok = await modalChoice(
    "Cloud-Daten löschen",
    "Deinen in der Cloud gespeicherten Fortschritt löschen? Der Fortschritt auf diesem Gerät bleibt erhalten – dieses Gerät wird nur von der Cloud getrennt.",
    [{ label: "Cloud-Daten löschen", value: true, variant: "danger" }, { label: "Abbrechen", value: false, variant: "ghost" }]
  );
  if (!ok) return;
  const r = await ADTSync.overwriteRemote(freshState());   // Cloud-Zeile leeren
  if (r && r.ok) { ADTSync.setCode(null); toast("☁️ Cloud-Daten gelöscht · getrennt"); }
  else if (r && r.reason === "offline") { toast("🔌 Offline – bitte später erneut versuchen"); }
  else { toast("⚠️ Löschen fehlgeschlagen"); }
  renderSettings();
}

/* Gecachte Lerninhalte verwerfen, damit der Freischalt-Bildschirm wieder erscheint.
   Der Lernfortschritt bleibt unangetastet – er hängt an den Frage-IDs, nicht am Katalog.
   Zum erneuten Freischalten muss das Gerät einmal online sein. */
async function relockContent() {
  const ok = await modalChoice("Inhalte neu freischalten",
    "Die gespeicherten Fragen werden von diesem Gerät entfernt. Danach brauchst du den " +
    "Zugangscode und einmalig eine Internetverbindung. Dein Lernfortschritt bleibt erhalten.",
    [{ label: "Neu freischalten", value: true, variant: "danger" },
     { label: "Abbrechen", value: false, variant: "ghost" }]);
  if (!ok) return;
  try {
    localStorage.removeItem(CONTENT_KEY);
    localStorage.removeItem(CONTENT_CODE_KEY);
    localStorage.removeItem(CONTENT_IDB_FLAG);
    localStorage.removeItem(CONTENT_FP_KEY);
  } catch (e) {}
  await idbDelete();
  location.reload();
}

// Zurücksetzen betrifft den LERNfortschritt. Gemeldete Fragen sind Feedback zum Katalog,
// kein Fortschritt – sie bleiben deshalb erhalten (und werden beim nächsten Sync wieder
// hochgeschoben, auch nach „überall zurücksetzen").
function freshStateKeepingReports() {
  const keep = reportsMap();
  const s = freshState();
  s.reports = JSON.parse(JSON.stringify(keep));
  return s;
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
      S = freshStateKeepingReports(); persistLocal();
      const r = await ADTSync.overwriteRemote(S);
      toast(r && r.ok ? "Überall zurückgesetzt" : "Lokal zurückgesetzt – Cloud folgt bei Verbindung");
    } else {
      // Verbindung trennen, damit der lokale Reset nicht aus der Cloud zurückkehrt
      ADTSync.setCode(null);
      S = freshStateKeepingReports(); persistLocal();
      toast("Zurückgesetzt · Cloud-Verbindung getrennt");
    }
    go("home");
  } else {
    const ok = await modalChoice(
      "Fortschritt zurücksetzen",
      "Wirklich den gesamten Lernfortschritt (XP, Level, Serie, Erfolge) löschen? Das kann nicht rückgängig gemacht werden.",
      [{ label: "Ja, löschen", value: true, variant: "danger" }, { label: "Abbrechen", value: false, variant: "ghost" }]
    );
    if (ok) { S = freshStateKeepingReports(); persistLocal(); toast("Fortschritt zurückgesetzt"); go("home"); }
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

async function boot() {

// Freigeschaltete Inhalte liegen (bei großen Katalogen) in IndexedDB und müssen erst
// asynchron geholt werden. Danach Validierung UND Zustand neu auswerten: sanitizeState()
// verwirft Fortschritt zu Frage-IDs, die es im geladenen Katalog nicht gibt — lief es
// gegen den Beispielkatalog, wäre der ganze Fortschritt weg.
const hyd = await hydrateContent();

if (hyd === "fehler") {
  // Die Inhalte SOLLTEN da sein, sind aber nicht lesbar. Jetzt auf den Beispielkatalog
  // zurückzufallen würde beim ersten Speichern den gesamten Lernfortschritt beschneiden.
  // Deshalb: Schreibsperre, klarer Fehlerbildschirm, Auswege anbieten.
  WRITE_LOCK = true;
  app.innerHTML = `<div class="empty"><div class="ic">⚠️</div><h2>Inhalte nicht ladbar</h2>
    <p class="muted">Die freigeschalteten Lerninhalte konnten nicht gelesen werden.
    Dein Lernfortschritt ist gesichert und wird nicht verändert.</p>
    <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">
      <button class="btn primary" id="errReload">Erneut versuchen</button>
      <button class="btn" id="errRelock">Inhalte neu freischalten</button>
    </div></div>`;
  const r1 = document.getElementById("errReload"); if (r1) r1.addEventListener("click", () => location.reload());
  const r2 = document.getElementById("errRelock"); if (r2) r2.addEventListener("click", () => relockContent());
  return;
}

// Erst jetzt steht der richtige Katalog fest — vorher darf sanitizeState() nicht filtern.
// contentUnlocked() gehört dazu: kleine Kataloge liegen in localStorage und wurden von
// data/questions.js bereits synchron übernommen (hydrateContent meldet dann „leer", weil es
// nur die IndexedDB-Ablage kennt). Ohne diesen Fall bliebe die Sanitisierung dauerhaft
// zahnlos – fremde Frage-IDs würden nie aussortiert/geparkt.
CONTENT_READY = (hyd === "ok") || !contentGateActive() || contentUnlocked();
DATA_OK = checkData();
S = loadState();

if (contentGateActive() && !contentUnlocked()) {
  // Inhalte sind geschützt und dieses Gerät ist noch nicht freigeschaltet → Zugangscode verlangen.
  showContentGate();
} else if (!DATA_OK) {
  app.innerHTML = `<div class="empty"><div class="ic">⚠️</div><h2>Daten-Fehler</h2>
    <p class="muted">Die Fragen-Datenbank enthält einen Formatfehler. Details in der Konsole.</p>
    <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">
      <button class="btn primary" id="derrReload">Neu laden</button>
      <button class="btn" id="derrRelock">Inhalte neu freischalten</button>
    </div></div>`;
  const d1 = document.getElementById("derrReload"); if (d1) d1.addEventListener("click", () => location.reload());
  const d2 = document.getElementById("derrRelock"); if (d2) d2.addEventListener("click", () => relockContent());
} else {
  refreshContentInBackground();   // freigeschaltete Inhalte still aktuell halten (greift nächsten Start)
  // Serie ggf. zurücksetzen, wenn mehr als ein Tag ausgelassen wurde (Gnadentag erlaubt
  // genau einen verpassten Tag). Nur Anzeige-Konsistenz beim Start.
  const t = todayStr();
  if (S.lastActiveDay && daysBetween(S.lastActiveDay, t) > 2) { S.streak = 0; saveState(); }
  go("home", { replace: true });   // Basis-Eintrag des Verlaufs
  window.addEventListener("popstate", onPopState);
  // Lern-Timer wieder aufnehmen, falls einer lief. Nie boot-kritisch:
  // ein Fehler hier darf den nachfolgenden Sync-Init nicht verhindern.
  try { pomoInit(); } catch (e) { console.warn("Lern-Timer-Start übersprungen", e); }

  // Erststart-Begrüßung nur für wirklich neue Nutzer (kein Fortschritt, nie gesehen).
  try { if (!isOnboarded() && S.totalAnswered === 0) showOnboarding(); }
  catch (e) { console.warn("Onboarding übersprungen", e); }

  // Beschädigter Speicherstand: nicht kommentarlos bei Null anfangen.
  if (stateRecovered === "bak") setTimeout(() => toast("Fortschritt aus Sicherungskopie wiederhergestellt"), 800);
  else if (stateRecovered === "verloren") setTimeout(() => toast("⚠️ Gespeicherter Fortschritt war beschädigt"), 800);
  if (DATA_SKIPPED) setTimeout(() => toast(`${DATA_SKIPPED} fehlerhafte Frage(n) übersprungen`), 1400);

  // Cloud-Sync: Statusanzeige aktualisieren + bei passenden Ereignissen abgleichen
  if (window.ADTSync) {
    ADTSync.onChange(() => { updateSyncChip(); refreshAfterSync(); });
    if (syncEnabled()) runSync({});                              // beim Start
    window.addEventListener("online", () => { if (syncEnabled()) runSync({}); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && syncEnabled()) runSync({}); });
  }
}

}  // ---- Ende boot()

// Start. Schlägt das Laden der Inhalte unerwartet fehl, darf die App nicht weiß bleiben.
boot().catch((e) => {
  console.error("Start fehlgeschlagen", e);
  app.innerHTML = `<div class="empty"><div class="ic">⚠️</div><h2>Start fehlgeschlagen</h2>
    <p class="muted">Die Lerninhalte konnten nicht geladen werden. App schließen und neu öffnen.</p></div>`;
});

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
