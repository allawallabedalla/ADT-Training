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

console.log(failures === 0 ? '\nOK: alle Unit-Tests bestanden' : `\n${failures} Unit-Test(s) fehlgeschlagen`);
process.exit(failures === 0 ? 0 : 1);
