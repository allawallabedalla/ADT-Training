// Validiert data/questions.js: Format, Eindeutigkeit, Konsistenz.
// Läuft in Node ohne Browser. Exit 0 = ok, 1 = Fehler.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'data/questions.js'), 'utf8');
const window = {};
// eslint-disable-next-line no-eval
eval(code); // setzt window.TOPICS / window.QUESTIONS über den Guard in der Datei
const TOPICS = window.TOPICS, QUESTIONS = window.QUESTIONS;

let errors = 0;
const fail = (m) => { console.log('FAIL: ' + m); errors++; };

if (!TOPICS || typeof TOPICS !== 'object') fail('TOPICS fehlt');
if (!Array.isArray(QUESTIONS) || QUESTIONS.length === 0) fail('QUESTIONS fehlt/leer');

const ids = new Set();
for (const q of QUESTIONS || []) {
  if (!q.id) { fail('Frage ohne id'); continue; }
  if (ids.has(q.id)) fail('Doppelte id: ' + q.id);
  ids.add(q.id);
  if (!TOPICS[q.topic]) fail(q.id + ': unbekanntes Thema ' + q.topic);
  if (!['single', 'multi', 'numeric', 'code'].includes(q.type)) fail(q.id + ': ungültiger type ' + q.type);
  if (![1, 2, 3].includes(q.difficulty)) fail(q.id + ': ungültige difficulty ' + q.difficulty);
  if (q.type === 'numeric') {
    if (typeof q.answer !== 'number' || !isFinite(q.answer)) fail(q.id + ': numeric ohne gültige answer');
    if (q.tolerance != null && (typeof q.tolerance !== 'number' || !isFinite(q.tolerance) || q.tolerance < 0)) fail(q.id + ': numeric tolerance ungültig');
    if ('options' in q || 'correct' in q) fail(q.id + ': numeric darf keine options/correct haben');
  } else if (q.type === 'code') {
    if (typeof q.answer !== 'string' || !q.answer.trim()) fail(q.id + ': code ohne answer');
    if (q.accept != null && (!Array.isArray(q.accept) || q.accept.some(a => typeof a !== 'string' || !a.trim()))) fail(q.id + ': code accept ungültig');
    if ('options' in q || 'correct' in q) fail(q.id + ': code darf keine options/correct haben');
    // Ein Kode, der sich nur durch Trennzeichen von der Musterlösung unterscheidet, ist
    // keine Alternative – die App wertet ihn ohnehin als richtig. Meist ein Autorenfehler.
    const key = v => String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (const a of (q.accept || [])) if (key(a) === key(q.answer)) fail(q.id + ': accept "' + a + '" ist identisch zur answer (nur andere Trennzeichen)');
  } else {
    if (!Array.isArray(q.options) || q.options.length < 2) fail(q.id + ': <2 Optionen');
    if (!Array.isArray(q.correct) || q.correct.length < 1) fail(q.id + ': keine richtige Antwort');
    if (new Set(q.correct).size !== (q.correct || []).length) fail(q.id + ': doppelter correct-Index');
    for (const c of q.correct || []) if (c < 0 || c >= (q.options || []).length) fail(q.id + ': correct-Index außerhalb');
    if (q.type === 'single' && (q.correct || []).length !== 1) fail(q.id + ': single mit != 1 richtig');
  }
  if (!q.explanation || q.explanation.length < 10) fail(q.id + ': Erklärung fehlt/kurz');
}

const byTopic = {};
for (const q of QUESTIONS || []) byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;

if (errors === 0) {
  console.log(`OK: ${QUESTIONS.length} Fragen, ${Object.keys(TOPICS).length} Themen valide.`);
  console.log('Verteilung: ' + JSON.stringify(byTopic));
  process.exit(0);
} else {
  console.log(`\n${errors} Fehler in der Fragen-Datenbank.`);
  process.exit(1);
}
