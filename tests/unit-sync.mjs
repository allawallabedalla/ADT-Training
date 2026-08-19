// Unit-Tests der reinen Logik in js/sync.js (ohne Browser).
// Deckt Merge, Code-Erzeugung/-Normalisierung, Header-Logik, overwriteRemote, Pending ab.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- Browser-Umgebung stubben (Node 22 hat ein read-only navigator: überschreiben) ---
const store = {};
let online = true;
Object.defineProperty(globalThis, 'navigator', { value: { get onLine() { return online; } }, writable: true, configurable: true });
globalThis.window = { crypto: webcrypto, ADT_CONFIG: {} };
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
let captured = null; let failNext = 0;
globalThis.fetch = async (url, opts) => {
  captured = { url, headers: opts.headers };
  if (failNext > 0) { failNext--; throw new Error('network down'); }
  return { ok: true, status: 200, text: async () => 'null' };
};

// eslint-disable-next-line no-eval
eval(fs.readFileSync(path.join(root, 'js/sync.js'), 'utf8'));
const S = globalThis.window.ADTSync;

let failures = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); failures++; } else console.log('ok:  ' + m); };

// ---- Merge: monoton, verlustarm, Zähler aus perQuestion abgeleitet ----
const A = { xp: 120, streak: 3, examsPassed: 1, bestExamPct: 80, lastActiveDay: '2026-07-12',
  perQuestion: { q1: { seen: 2, correct: 2, wrong: 0, lastResult: 'correct' }, q2: { seen: 1, correct: 0, wrong: 1, lastResult: 'wrong' } },
  badges: { first: '2026-07-11T10:00:00Z' } };
const B = { xp: 90, streak: 5, examsPassed: 0, bestExamPct: 60, lastActiveDay: '2026-07-13',
  perQuestion: { q1: { seen: 1, correct: 1, wrong: 0, lastResult: 'correct' }, q2: { seen: 3, correct: 2, wrong: 1, lastResult: 'correct' }, q3: { seen: 1, correct: 1, wrong: 0, lastResult: 'correct' } },
  badges: { first: '2026-07-13T08:00:00Z', ten: '2026-07-13T09:00:00Z' } };
const m = S.mergeStates(A, B);
ok(m.xp === 120, 'merge xp = max');
ok(m.streak === 5, 'merge streak = max');
ok(m.bestStreak >= 5, 'merge bestStreak >= gemergte Serie (nie kleiner)');
ok(m.lastActiveDay === '2026-07-13', 'merge lastActiveDay = spätestes');
ok(m.perQuestion.q2.correct === 2, 'merge perQuestion.correct = max');
ok(m.perQuestion.q3 && m.totalAnswered === 6 && m.totalCorrect === 5, 'merge Zähler aus perQuestion abgeleitet');
ok(m.badges.first === '2026-07-11T10:00:00Z', 'merge badge früheres Datum behalten');

// ---- Spaced Repetition: Box/Fälligkeit im Merge ----
const SA = { schemaVersion: 2, perQuestion: {
  qx: { seen: 3, correct: 3, wrong: 0, lastResult: 'correct', box: 3, due: '2026-07-20' },
  qy: { seen: 2, correct: 1, wrong: 1, lastResult: 'wrong', box: 0, due: '2026-07-13' },
}, badges: {} };
const SB = { schemaVersion: 2, perQuestion: {
  qx: { seen: 2, correct: 2, wrong: 0, lastResult: 'correct', box: 2, due: '2026-07-16' },
  qy: { seen: 2, correct: 1, wrong: 1, lastResult: 'correct', box: 2, due: '2026-07-18' },
}, badges: {} };
const ms = S.mergeStates(SA, SB);
ok(ms.schemaVersion === 2, 'merge schemaVersion mitgeführt (verhindert Re-Migration)');
ok(ms.perQuestion.qx.box === 3 && ms.perQuestion.qx.due === '2026-07-20', 'merge SRS: höhere Box gewinnt mit ihrer Fälligkeit');
ok(ms.perQuestion.qy.box === 2 && ms.perQuestion.qy.due === '2026-07-18', 'merge SRS: bei höherer Box das jeweilige Fälligkeitsdatum');
// gegen altes Remote ohne SRS-Felder: lokale Box bleibt erhalten
const mOld = S.mergeStates({ schemaVersion: 2, perQuestion: { qz: { seen: 1, correct: 1, box: 4, due: '2026-08-01' } }, badges: {} },
  { perQuestion: { qz: { seen: 1, correct: 1 } }, badges: {} });
ok(mOld.perQuestion.qz.box === 4 && mOld.perQuestion.qz.due === '2026-08-01', 'merge SRS: lokale Box überlebt altes Remote ohne SRS');

// ---- Gemeldete Fragen („fragwürdig"): jüngerer Zeitstempel gewinnt, Notiz bleibt ----
const RA = { perQuestion: {}, badges: {}, reports: {
  r1: { on: true, at: '2026-07-14T10:00:00Z', note: 'Antwort B stimmt nicht' },   // hier gemeldet
  r2: { on: false, at: '2026-07-14T12:00:00Z', note: '' },                        // hier aufgehoben (jünger)
  r3: { on: true, at: '2026-07-14T09:00:00Z', note: '' },
} };
const RB = { perQuestion: {}, badges: {}, reports: {
  r2: { on: true, at: '2026-07-14T08:00:00Z', note: 'unklar' },                   // älter → verliert
  r3: { on: true, at: '2026-07-14T11:00:00Z', note: '' },                         // jünger, ohne Notiz
  r4: { on: true, at: '2026-07-14T13:00:00Z', note: 'Tippfehler' },               // nur remote
} };
const mr = S.mergeStates(RA, RB);
ok(mr.reports.r1.on === true && mr.reports.r1.note === 'Antwort B stimmt nicht', 'merge reports: einseitige Meldung inkl. Notiz übernommen');
ok(mr.reports.r2.on === false, 'merge reports: jüngeres Aufheben gewinnt (kommt NICHT zurück)');
ok(mr.reports.r2.note === 'unklar', 'merge reports: Notiz überlebt das Aufheben');
ok(mr.reports.r3.on === true && mr.reports.r3.at === '2026-07-14T11:00:00Z', 'merge reports: jüngerer Zeitstempel gewinnt');
ok(mr.reports.r4.on === true && mr.reports.r4.note === 'Tippfehler', 'merge reports: neue Meldung vom anderen Gerät übernommen');
// Kommutativ: gleiches Ergebnis, egal welche Seite „lokal" ist (Schlüsselreihenfolge egal).
const canon = (o) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k].on, o[k].at, o[k].note]));
const mrRev = S.mergeStates(RB, RA);
ok(canon(mrRev.reports) === canon(mr.reports), 'merge reports: Reihenfolge egal (kommutativ)');
// „Issue vorbereitet" ist eine Einbahnstraße: einmal gesetzt, darf es kein Merge zurücknehmen
const mi = S.mergeStates(
  { perQuestion: {}, badges: {}, reports: { r9: { on: true, at: '2026-08-06T09:00:00Z', note: 'a', issuedAt: '2026-08-06T08:00:00Z' } } },
  { perQuestion: {}, badges: {}, reports: { r9: { on: true, at: '2026-08-06T10:00:00Z', note: 'b' } } });   // jünger, aber ohne Vermerk
ok(mi.reports.r9.note === 'b' && mi.reports.r9.issuedAt === '2026-08-06T08:00:00Z',
  'merge reports: „Issue vorbereitet" bleibt erhalten, auch wenn die jüngere Seite es nicht kennt');

const mrNone = S.mergeStates({ perQuestion: {}, badges: {} }, { perQuestion: {}, badges: {} });
ok(mrNone.reports && Object.keys(mrNone.reports).length === 0, 'merge reports: fehlendes Feld ergibt leeres Objekt');

// ---- Code-Erzeugung / Normalisierung ----
ok(/^ADT-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(S.generateCode()), 'generateCode Format');
ok(S.normalizeCode('adt xxxxx yyyyy zzzzz') === 'ADT-XXXXX-YYYYY-ZZZZZ', 'normalizeCode');
const codes = new Set(); for (let i = 0; i < 500; i++) codes.add(S.generateCode());
ok(codes.size === 500, '500 Codes eindeutig');

// ---- Header-Logik: neuer sb_-Key ohne Authorization, JWT mit ----
globalThis.window.ADT_CONFIG = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'sb_publishable_TEST' };
S.setCode('ADT-AAAAA-BBBBB-CCCCC');
await S.overwriteRemote({ xp: 1, perQuestion: {}, badges: {} });
ok(captured && captured.headers.apikey.startsWith('sb_publishable_'), 'sb-Key im apikey-Header');
ok(captured && !('Authorization' in captured.headers), 'kein Authorization bei sb_-Key');
globalThis.window.ADT_CONFIG = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'eyJhbGciOi.test.sig' };
await S.overwriteRemote({ xp: 1, perQuestion: {}, badges: {} });
ok(captured.headers.Authorization === 'Bearer eyJhbGciOi.test.sig', 'JWT-Key mit Authorization');

// ---- Retry + Pending ----
captured = null; failNext = 1;
const r = await S.overwriteRemote({ xp: 2, perQuestion: {}, badges: {} });
ok(r.ok === true, 'Retry: nach 1 Fehlversuch erfolgreich');
online = false;
await S.overwriteRemote({ xp: 3, perQuestion: {}, badges: {} });
ok(S.hasPending() === true, 'Pending nach offline gesetzt');
online = true;

// ---- Beobachtungsdaten im Merge (Stufe 1 des Bereitschafts-Konzepts) ----
// `first` = Ergebnis des ersten Kontakts; es kann nur einen geben. Bei Konflikt
// gewinnt bewusst "wrong" (konservativ). `lastAt` = spaeteres Datum gewinnt.
const OA = { schemaVersion: 4, perQuestion: {
  o1: { seen: 1, correct: 1, wrong: 0, lastResult: 'correct', box: 1, due: '2026-08-20', first: 'correct', lastAt: '2026-08-18' },
  o2: { seen: 2, correct: 1, wrong: 1, lastResult: 'wrong', box: 0, due: '2026-08-18', first: 'correct', lastAt: '2026-08-17' },
  o3: { seen: 1, correct: 0, wrong: 1, lastResult: 'wrong', box: 0, due: '2026-08-18', first: null, lastAt: null },
}, badges: {} };
const OB = { schemaVersion: 4, perQuestion: {
  o1: { seen: 1, correct: 1, wrong: 0, lastResult: 'correct', box: 1, due: '2026-08-20', first: 'correct', lastAt: '2026-08-19' },
  o2: { seen: 2, correct: 1, wrong: 1, lastResult: 'wrong', box: 0, due: '2026-08-18', first: 'wrong', lastAt: '2026-08-16' },
  o3: { seen: 1, correct: 0, wrong: 1, lastResult: 'wrong', box: 0, due: '2026-08-18', first: 'wrong', lastAt: '2026-08-15' },
}, badges: {} };
const mo = S.mergeStates(OA, OB);
ok(mo.perQuestion.o1.first === 'correct', 'merge first: Einigkeit bleibt erhalten');
ok(mo.perQuestion.o1.lastAt === '2026-08-19', 'merge lastAt = spaeteres Datum');
ok(mo.perQuestion.o2.first === 'wrong', 'merge first: bei Konflikt gewinnt "wrong" (konservativ)');
ok(mo.perQuestion.o3.first === 'wrong', 'merge first: vorhandener Wert schlaegt null');
ok(mo.perQuestion.o3.lastAt === '2026-08-15', 'merge lastAt: vorhandenes Datum schlaegt null');

// masteredOnce ging historisch beim Merge verloren (fehlte in der Ergebniszeile).
const mm = S.mergeStates(
  { schemaVersion: 4, perQuestion: { q9: { seen: 5, correct: 3, wrong: 2, lastResult: 'wrong', box: 0, due: '2026-08-18', masteredOnce: true } }, badges: {} },
  { schemaVersion: 4, perQuestion: { q9: { seen: 5, correct: 3, wrong: 2, lastResult: 'wrong', box: 0, due: '2026-08-18' } }, badges: {} });
ok(mm.perQuestion.q9.masteredOnce === true, 'merge masteredOnce ueberlebt (kein doppelter Erstmeisterungs-Bonus)');

console.log(failures === 0 ? '\nOK: alle Unit-Tests bestanden' : `\n${failures} Unit-Test(s) fehlgeschlagen`);
process.exit(failures === 0 ? 0 : 1);
