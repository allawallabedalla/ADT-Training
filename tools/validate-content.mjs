// Validiert eine Inhalts-Datei { "TOPICS": {...}, "QUESTIONS": [...] } für den
// zugangsgeschützten Content (das JSON, das in Supabase app_content.data kommt).
//
// Nutzung (lokal):  node tools/validate-content.mjs material/content.json
//
// Prüft Struktur/IDs/Antwort-Konsistenz UND erzwingt den QUELLBELEG (source) an
// jeder Frage – für echtes Material darf keine Frage ohne nachprüfbare Quelle rein.
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Nutzung: node tools/validate-content.mjs <datei.json>'); process.exit(2); }
let doc;
try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('JSON nicht lesbar:', e.message); process.exit(2); }

const TOPICS = doc.TOPICS, QUESTIONS = doc.QUESTIONS;
let errors = 0, warns = 0;
const fail = (m) => { console.log('FAIL: ' + m); errors++; };
const warn = (m) => { console.log('WARN: ' + m); warns++; };

if (!TOPICS || typeof TOPICS !== 'object') fail('TOPICS fehlt/ungültig');
else for (const [k, t] of Object.entries(TOPICS)) {
  if (!t || !t.name) fail('Thema ' + k + ': name fehlt');
  if (!t || !t.color) fail('Thema ' + k + ': color fehlt');
}
if (!Array.isArray(QUESTIONS) || !QUESTIONS.length) fail('QUESTIONS fehlt/leer');

const ids = new Set();
for (const q of QUESTIONS || []) {
  if (!q.id) { fail('Frage ohne id'); continue; }
  if (ids.has(q.id)) fail('Doppelte id: ' + q.id);
  ids.add(q.id);
  if (!TOPICS || !TOPICS[q.topic]) fail(q.id + ': unbekanntes Thema "' + q.topic + '"');
  if (!['single', 'multi', 'numeric'].includes(q.type)) fail(q.id + ': ungültiger type ' + q.type);
  if (![1, 2, 3].includes(q.difficulty)) fail(q.id + ': difficulty muss 1/2/3 sein');
  if (!q.explanation || String(q.explanation).length < 10) fail(q.id + ': Erklärung fehlt/zu kurz');
  // QUELLBELEG verpflichtend (Nachvollziehbarkeit gegen die Folie):
  if (!q.source || String(q.source).length < 3) fail(q.id + ': QUELLBELEG (source) fehlt – jede Frage MUSS ihre Quelle nennen (z. B. "Foliensatz X, Folie 12")');
  if (q.type === 'numeric') {
    if (typeof q.answer !== 'number' || !isFinite(q.answer)) fail(q.id + ': numeric ohne gültige answer (Zahl)');
    if (q.tolerance != null && (typeof q.tolerance !== 'number' || !isFinite(q.tolerance) || q.tolerance < 0)) fail(q.id + ': tolerance ungültig');
    if ('options' in q || 'correct' in q) fail(q.id + ': numeric darf keine options/correct haben');
  } else {
    if (!Array.isArray(q.options) || q.options.length < 2) fail(q.id + ': <2 Optionen');
    if (!Array.isArray(q.correct) || q.correct.length < 1) fail(q.id + ': keine richtige Antwort');
    if (new Set(q.correct).size !== (q.correct || []).length) fail(q.id + ': doppelter correct-Index');
    for (const c of q.correct || []) if (c < 0 || c >= (q.options || []).length) fail(q.id + ': correct-Index außerhalb');
    if (q.type === 'single' && (q.correct || []).length !== 1) fail(q.id + ': single mit != 1 richtig');
    if (q.type === 'multi' && (q.correct || []).length < 1) fail(q.id + ': multi ohne richtige Antwort');
  }
}

const byTopic = {};
for (const q of QUESTIONS || []) byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;

if (errors === 0) {
  console.log(`\nOK: ${QUESTIONS.length} Fragen, ${Object.keys(TOPICS).length} Themen valide` + (warns ? ` (${warns} Hinweise)` : '') + '.');
  console.log('Verteilung: ' + JSON.stringify(byTopic));
  process.exit(0);
} else {
  console.log(`\n${errors} Fehler${warns ? ', ' + warns + ' Hinweise' : ''}. NICHT laden, bis alles grün ist.`);
  process.exit(1);
}
