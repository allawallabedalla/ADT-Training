// End-to-End-Smoke-Test im Browser (Playwright, Service Worker deaktiviert).
// Prüft die wichtigsten Invarianten ohne Laufzeitfehler.
// BASE-URL via Umgebungsvariable BASE (Default: http://localhost:8399/index.html).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { seedContent } from './seed-content.mjs';
import { parseItems } from '../tools/reports-to-backlog.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');

const BASE = process.env.BASE || 'http://localhost:8399/index.html';

// Eine Frage irgendwie beantworten – unabhaengig vom Aufgabentyp. Ohne das muss jede
// Schleife wissen, welche Typen es gibt; genau daran sind die Tests beim Aufgabentyp
// „Code eingeben" zerbrochen.
async function antworteIrgendwie(pg) {
  if (await pg.$('#numField')) { await pg.fill('#numField', '5'); return 'numeric'; }
  if (await pg.$('#codeField')) { await pg.fill('#codeField', 'X99.9'); return 'code'; }
  const opt = await pg.$('.opt');
  if (opt) { await opt.click(); return 'option'; }
  return null;
}
// Dasselbe fuer die Pruefungsansicht (andere Feld-IDs, kein Pruef-Knopf).
async function antworteImExamen(pg) {
  if (await pg.$('#examNum')) { await pg.fill('#examNum', '7'); return 'numeric'; }
  if (await pg.$('#examCode')) { await pg.fill('#examCode', 'X99.9'); return 'code'; }
  const opt = await pg.$('.opt');
  if (opt) { await opt.click(); return 'option'; }
  return null;
}
const TMP = process.env.TMPDIR || '/tmp';
const errors = [];
const checks = [];
const chk = (c, m) => { checks.push(c); console.log((c ? 'ok:  ' : 'FAIL:') + ' ' + m); };

const browser = await chromium.launch();
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage();
  // Onboarding-Overlay standardmäßig überspringen, damit es die übrigen Tests nicht blockiert.
  if (opts.onboarded !== false) await p.addInitScript(() => localStorage.setItem('adt_onboarded', '1'));
  // Zugangsschutz standardmäßig neutralisieren (Beispielkatalog als „freigeschaltet"),
  // sonst hinge jeder Test am Freischalt-Bildschirm. Mit { seeded: false } bleibt er scharf.
  if (opts.seeded !== false) await seedContent(p);
  // Reine Netzwerk-Status-Meldungen des Browsers (z. B. bewusst getestete 400/404-Antworten)
  // sind KEINE App-Fehler – nur echte JS-Fehler zählen.
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  return p;
}

// 1) Home lädt fehlerfrei
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  chk((await p.textContent('.stat-grid .stat:nth-child(3) .num')).trim() === '0', 'Home: frischer Start, XP=0');
}

// 2) Kaputter Speicherstand wird saniert, App startet
{
  const p = await page();
  await p.addInitScript(() => localStorage.setItem('adt_trainer_state_v1', JSON.stringify({ xp: '50', totalAnswered: -3, perQuestion: { q: { seen: NaN } } })));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  chk((await p.textContent('.stat-grid .stat:nth-child(3) .num')).trim() === '50', 'Sanitisierung: xp "50" -> 50');
}

// 3) Reset OHNE Reload leert perQuestion (Regression zum Referenz-Bug)
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="mixed"]'); await p.waitForSelector('.q-card');
  for (let i = 0; i < 3; i++) {
    await p.waitForSelector('.q-card');
    await antworteIrgendwie(p);
    await p.click('#checkBtn'); await p.waitForSelector('.explain'); await p.click('#nextBtn');
  }
  // Quiz verlassen: jetzt ein iOS-Modal statt confirm() -> „Beenden" klicken
  await p.click('#backBtn');
  await p.waitForSelector('.modal-overlay .modal-btn.btn-danger');
  await p.click('.modal-overlay .modal-btn.btn-danger');
  await p.waitForSelector('[data-act="reset"]');
  // Reset auslösen -> Modal „Ja, löschen"
  await p.click('[data-act="reset"]');
  await p.waitForSelector('.modal-overlay .modal-btn.btn-danger');
  await p.click('.modal-overlay .modal-btn.btn-danger');
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('adt_trainer_state_v1')));
  chk(st.totalAnswered === 0 && Object.keys(st.perQuestion).length === 0, 'Reset leert Zähler UND perQuestion');
}

// 4) Backup-Import wird verlustarm gemergt
{
  const p = await page();
  const f = TMP + '/adt-import-test.json';
  fs.writeFileSync(f, JSON.stringify({ app: 'adt-trainer', state: { xp: 999, perQuestion: { 'tnm-001': { seen: 5, correct: 5, wrong: 0, lastResult: 'correct' } }, badges: { first: '2020-01-01T00:00:00Z' } } }));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="settings"]'); await p.waitForSelector('#importFile', { state: 'attached' });
  await p.setInputFiles('#importFile', f); await p.waitForTimeout(500);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('adt_trainer_state_v1')));
  chk(st.xp === 999 && st.totalAnswered === 5, 'Backup-Import: xp=999, Zähler abgeleitet');
}

// 5) Settings, Info, Themen, Erfolge rendern
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="topics"]'); await p.waitForSelector('.topic-row'); chk(true, 'Themen rendern');
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.click('[data-act="badges"]'); await p.waitForSelector('.badge-grid'); chk(true, 'Erfolge rendern');
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.click('[data-act="info"]'); await p.waitForSelector('.large-title');
  const infoTxt = await p.textContent('#app');
  chk(/Datenschutz/.test(infoTxt) && /Inoffiziell/.test(infoTxt) && /kein Produkt der ADT/.test(infoTxt), 'Info: Datenschutz + Inoffiziell-Disclaimer vorhanden');
}

// 6) Verpasste richtige Antwort zeigt „Richtige Antwort"-Hinweis (Quick-Win-Regression)
{
  const p = await page();
  p.on('dialog', (d) => d.accept());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="mixed"]'); await p.waitForSelector('.q-card');
  let missedSeen = false, allHaveNote = true;
  for (let i = 0; i < 8; i++) {
    await p.waitForSelector('.q-card');
    const typ = await antworteIrgendwie(p);
    if (typ !== 'option') { await p.click('#checkBtn'); await p.waitForSelector('.explain'); await p.click('#nextBtn'); continue; }
    await p.click('#checkBtn'); await p.waitForSelector('.explain');
    const missed = await p.$$eval('.opt.missed', (els) => els.length);
    const notes = await p.$$eval('.opt.missed .opt-note', (els) => els.length);
    if (missed > 0) { missedSeen = true; if (notes !== missed) allHaveNote = false; }
    await p.click('#nextBtn');
  }
  chk(missedSeen && allHaveNote, 'Verpasste richtige Antwort trägt "Richtige Antwort"-Hinweis');
}

// 7) Prüfungsmodus: starten -> alle beantworten -> abgeben -> Ergebnis
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="exam"]');
  await p.waitForSelector('.exam-bar');
  for (let i = 0; i < 40; i++) {
    await p.waitForSelector('.q-card');
    await antworteImExamen(p);
    const nextDisabled = await p.getAttribute('#examNext', 'disabled');
    if (nextDisabled !== null) break; // letzte Frage erreicht
    await p.click('#examNext');
  }
  await p.click('#examSubmit');
  await p.waitForSelector('.modal-overlay .modal-btn.btn-danger');
  await p.click('.modal-overlay .modal-btn.btn-danger');
  await p.waitForSelector('.pass-badge');
  const profile = await p.$('.theme-row');
  const review = await p.$('.review-item');
  chk(!!profile && !!review, 'Prüfung: Abgabe → Ergebnis mit Themenprofil & Review');
  const bodyTxt = await p.textContent('body');
  chk(/Prüfungsblöcke/.test(bodyTxt) && /Codierung/.test(bodyTxt),
      'Prüfung: Ergebnis zeigt die Prüfungsblöcke (40/50/10)');
}

// 6c) Beobachtungsdaten (Stufe 1 des Bereitschafts-Konzepts): Erfassung + Migration
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  // frisch antworten -> first + lastAt werden gesetzt
  await p.click('[data-act="mixed"]');
  await p.waitForSelector('.q-card');
  const heute = await p.evaluate(() => todayStr());
  await antworteIrgendwie(p); await p.click('#checkBtn');
  const rec = await p.evaluate(() => {
    const id = SESSION.questions[SESSION.idx].id;
    const q = S.perQuestion[id];
    return { first: q.first, lastAt: q.lastAt, lastResult: q.lastResult };
  });
  chk(rec.first === 'correct' || rec.first === 'wrong', 'Beobachtung: first beim ersten Kontakt gesetzt');
  chk(rec.first === rec.lastResult, 'Beobachtung: first entspricht beim ersten Kontakt dem Ergebnis');
  chk(rec.lastAt === heute, 'Beobachtung: lastAt = heute');

  // first darf bei spaeteren Antworten NICHT ueberschrieben werden
  const stable = await p.evaluate(() => {
    const id = SESSION.questions[SESSION.idx].id;
    const before = S.perQuestion[id].first;
    const q = QUESTIONS.find(x => x.id === id);
    // gegenteiliges Ergebnis erzwingen
    const falsch = before === 'correct';
    S.perQuestion[id].lastResult = falsch ? 'wrong' : 'correct';
    const p2 = S.perQuestion[id];
    if (p2.first !== 'correct' && p2.first !== 'wrong') p2.first = 'wrong';
    return { before, after: S.perQuestion[id].first };
  });
  chk(stable.before === stable.after, 'Beobachtung: first wird spaeter nicht ueberschrieben');
}

// 6d) Migration v3 -> v4: Erstversuch aus Altbestand rekonstruieren
{
  const p = await page();
  await p.addInitScript(() => {
    localStorage.setItem('adt_trainer_state_v1', JSON.stringify({
      schemaVersion: 3,
      perQuestion: {
        // ECHTE Katalog-IDs noetig: sanitizeState parkt unbekannte IDs als orphanQuestions.
        // eindeutig rekonstruierbar:
        'gr-001': { seen: 1, correct: 1, wrong: 0, lastResult: 'correct', box: 1, due: '2026-08-20' },
        'gr-002': { seen: 1, correct: 0, wrong: 1, lastResult: 'wrong', box: 0, due: '2026-08-18' },
        'gr-003': { seen: 4, correct: 4, wrong: 0, lastResult: 'correct', box: 4, due: '2026-09-01' },
        'gr-004': { seen: 3, correct: 0, wrong: 3, lastResult: 'wrong', box: 0, due: '2026-08-18' },
        // gemischt -> Reihenfolge unbekannt, muss null bleiben:
        'gr-005': { seen: 5, correct: 3, wrong: 2, lastResult: 'correct', box: 1, due: '2026-08-20' },
      }, badges: {},
    }));
  });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const g = id => (S.perQuestion[id] || {}).first;
    return { a1: g('gr-001'), a2: g('gr-002'), a3: g('gr-003'), a4: g('gr-004'), a5: g('gr-005'), ver: S.schemaVersion };
  });
  chk(r.ver >= 4, 'Migration: Schema-Version auf 4 gehoben');
  chk(r.a1 === 'correct' && r.a2 === 'wrong', 'Migration: seen==1 -> Erstversuch = lastResult');
  chk(r.a3 === 'correct', 'Migration: alle richtig -> Erstversuch richtig');
  chk(r.a4 === 'wrong', 'Migration: alle falsch -> Erstversuch falsch');
  chk(r.a5 === null, 'Migration: gemischt -> Erstversuch bleibt unbekannt (null)');
}

// 6e) Kalter Abruf: spaetere Wiederholungen zaehlen mit, aber nicht am selben Tag
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="mixed"]');
  await p.waitForSelector('.q-card');
  const heute = await p.evaluate(() => todayStr());
  await antworteIrgendwie(p); await p.click('#checkBtn');
  const r1 = await p.evaluate(() => {
    const id = SESSION.questions[SESSION.idx].id;
    const q = S.perQuestion[id];
    return { id, cold: q.cold, coldAt: q.coldAt, first: q.first };
  });
  chk(r1.cold === r1.first && !!r1.cold, 'Kalter Abruf: Erstkontakt IST ein kalter Abruf');
  chk(r1.coldAt === heute, 'Kalter Abruf: coldAt = heute');

  // gleicher Tag -> keine neue Beobachtung (Wiedererkennen statt Wissen)
  const r2 = await p.evaluate((id) => {
    const q = S.perQuestion[id];
    const vorher = q.cold;
    const gegenteil = vorher === 'correct' ? 'wrong' : 'correct';
    const prevAt = q.lastAt;
    if (!prevAt || daysBetween(prevAt, todayStr()) >= COLD_GAP_DAYS) { q.cold = gegenteil; q.coldAt = todayStr(); }
    return { vorher, nachher: q.cold };
  }, r1.id);
  chk(r2.vorher === r2.nachher, 'Kalter Abruf: Wiederholung am selben Tag zaehlt NICHT');

  // spaeterer Tag -> Beobachtung wird ersetzt (Lernfortschritt schlaegt durch)
  const r3 = await p.evaluate((id) => {
    const q = S.perQuestion[id];
    q.cold = 'wrong'; q.coldAt = '2026-01-01'; q.lastAt = '2026-01-01';
    const gegenteil = 'correct';
    if (!q.lastAt || daysBetween(q.lastAt, todayStr()) >= COLD_GAP_DAYS) { q.cold = gegenteil; q.coldAt = todayStr(); }
    return q.cold;
  }, r1.id);
  chk(r3 === 'correct', 'Kalter Abruf: Wiederholung an spaeterem Tag ersetzt die Beobachtung');
}

// 6f) Migration v4 -> v5: Erstversuch wird zum Startwert des kalten Abrufs
{
  const p = await page();
  await p.addInitScript(() => {
    localStorage.setItem('adt_trainer_state_v1', JSON.stringify({
      schemaVersion: 4,
      perQuestion: {
        'gr-001': { seen: 1, correct: 1, wrong: 0, lastResult: 'correct', box: 1, due: '2026-08-20', first: 'correct', lastAt: '2026-08-10' },
        'gr-002': { seen: 3, correct: 1, wrong: 2, lastResult: 'wrong', box: 0, due: '2026-08-18', first: 'wrong', lastAt: '2026-08-12' },
        'gr-003': { seen: 5, correct: 3, wrong: 2, lastResult: 'correct', box: 1, due: '2026-08-20', first: null, lastAt: '2026-08-12' },
      }, badges: {},
    }));
  });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const g = id => S.perQuestion[id] || {};
    return { ver: S.schemaVersion, a: g('gr-001'), b: g('gr-002'), c: g('gr-003') };
  });
  chk(r.ver >= 5, 'Migration v5: Schema-Version gehoben');
  chk(r.a.cold === 'correct' && r.a.coldAt === '2026-08-10', 'Migration v5: cold uebernimmt first samt Datum');
  chk(r.b.cold === 'wrong', 'Migration v5: falscher Erstversuch bleibt zunaechst falsch');
  chk(r.c.cold === null && r.c.coldAt === null, 'Migration v5: unbekannter Erstversuch bleibt unbekannt');
}

// 6g) Bestehenswahrscheinlichkeit: Referenzwerte, Gewichtung, Mindestdatenlage
// Die Rechnung wird mit festen Beobachtungszahlen geprueft (nicht ueber den Katalog –
// der ist im Test klein). Referenzwerte stammen aus der unabhaengigen Nachrechnung
// des Beta-Binomial-Modells.
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const O = (K, C, S) => ({ K: { n: K[0], x: K[1] }, C: { n: C[0], x: C[1] }, S: { n: S[0], x: S[1] } });
  const rechne = (obs) => p.evaluate((obs) => passProbability(obs), obs);

  const zuWenig = await rechne(O([10, 10], [0, 0], [0, 0]));
  chk(zuWenig.genug === false && zuWenig.fehlt === 20, 'Prognose: unter 30 Beobachtungen keine Zahl');

  const r1 = await rechne(O([50, 30], [0, 0], [0, 0]));
  chk(r1.genug === true && Math.abs(r1.p * 100 - 83.3) < 1.5, 'Prognose: 60 % auf 50 Fragen -> ~83 % (Referenz)');
  const r2 = await rechne(O([100, 70], [0, 0], [0, 0]));
  chk(Math.abs(r2.p * 100 - 99) < 1.5, 'Prognose: 70 % auf 100 Fragen -> ~99 % (Referenz)');
  const r3 = await rechne(O([100, 55], [0, 0], [0, 0]));
  chk(Math.abs(r3.p * 100 - 73.9) < 2, 'Prognose: 55 % auf 100 Fragen -> ~74 % (Referenz)');
  const r4 = await rechne(O([200, 120], [0, 0], [0, 0]));
  chk(Math.abs(r4.p * 100 - 91.6) < 2, 'Prognose: 60 % auf 200 Fragen -> ~92 % (Referenz)');

  // Codierung ist 50 % der Pruefung, Klinik 40 % -> die Codier-Quote muss staerker wiegen
  const klinikStark = await rechne(O([100, 70], [100, 40], [0, 0]));
  const codeStark   = await rechne(O([100, 40], [100, 70], [0, 0]));
  chk(codeStark.p > klinikStark.p + 0.05, 'Prognose: Codierung wiegt schwerer als Klinik (Blueprint 50/40)');

  // fehlende Bloecke werden ausgewiesen, nicht stillschweigend als 0 gewertet
  chk(Array.isArray(codeStark.ohneDaten) && codeStark.ohneDaten.includes('S'), 'Prognose: Block ohne Daten wird ausgewiesen');
  chk(codeStark.p > 0 && codeStark.p < 1, 'Prognose: nie exakt 0 oder 1');

  // monoton in der Trefferquote und in der Datenmenge
  const a = await rechne(O([100, 60], [0, 0], [0, 0]));
  const b = await rechne(O([100, 80], [0, 0], [0, 0]));
  chk(b.p > a.p, 'Prognose: hoehere Trefferquote -> hoehere Wahrscheinlichkeit');
  const eng1 = await rechne(O([60, 39], [0, 0], [0, 0]));
  const eng2 = await rechne(O([200, 130], [0, 0], [0, 0]));
  chk(eng2.p > eng1.p, 'Prognose: gleiche Quote, mehr Daten -> sicherer');

  // Katastrophenfall bleibt niedrig, Traumfall erreicht nie 100 %
  const mies = await rechne(O([100, 20], [0, 0], [0, 0]));
  chk(mies.p < 0.05, 'Prognose: 20 % richtig -> klar unter der Bestehensgrenze');
  const top = await rechne(O([300, 300], [0, 0], [0, 0]));
  chk(top.p < 1 && top.p > 0.99, 'Prognose: alles richtig -> sehr hoch, aber nie 100 %');
  const txt = await p.evaluate(() => passPctText(0.9997));
  chk(!/100/.test(txt), 'Prognose: Anzeige nennt nie 100 % (' + txt + ')');
}

// 6h) Aufgabentyp „Code eingeben": Bewertung, Eingabe, Prüfungsmodus
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });

  // --- Bewertung (reine Logik) ---
  const g = (q, v) => p.evaluate(([q, v]) => gradeQuestion(q, [v]), [q, v]);
  const Q = { type: 'code', answer: 'C50.4' };
  chk(await g(Q, 'C50.4'), 'Code: exakte Schreibweise richtig');
  chk(await g(Q, 'c50.4'), 'Code: Kleinschreibung richtig');
  chk(await g(Q, ' C50.4 '), 'Code: Leerzeichen aussen egal');
  chk(await g(Q, 'C504'), 'Code: fehlender Punkt zaehlt als richtig');
  chk(await g(Q, 'C50,4'), 'Code: Komma statt Punkt richtig');
  chk(!(await g(Q, 'C50.5')), 'Code: falsche Endziffer ist falsch');
  // Dokumentierte Grosszuegigkeit: Trennzeichen werden ignoriert, "C5.04" ist dieselbe
  // Ziffernfolge wie "C50.4". Bewusst in Kauf genommen – kein realer ICD-Kode kollidiert.
  chk(await g(Q, 'C5.04'), 'Code: Trennzeichen werden vollstaendig ignoriert');
  chk(!(await g(Q, '')), 'Code: leere Eingabe ist keine Antwort');
  chk(!(await g(Q, '   ')), 'Code: nur Leerzeichen ist keine Antwort');
  chk(!(await g(Q, '.-/')), 'Code: nur Trennzeichen ist keine Antwort');

  const M = { type: 'code', answer: '8500/3' };
  chk(await g(M, '8500/3'), 'Code: Morphologie mit Schraegstrich');
  chk(await g(M, '8500 3'), 'Code: Morphologie mit Leerzeichen');
  chk(!(await g(M, '8500/2')), 'Code: falsche Dignitaet ist falsch');
  chk(!(await g(M, '3/8500')), 'Code: vertauschte Reihenfolge ist falsch');

  const A = { type: 'code', answer: 'C18.7', accept: ['C19'] };
  chk(await g(A, 'C19'), 'Code: accept-Alternative gilt');
  chk(await g(A, 'C18.7'), 'Code: Hauptantwort gilt weiterhin');
  chk(!(await g(A, 'C20')), 'Code: nicht gelistete Alternative ist falsch');

  const hr = await p.evaluate(() => [hasResponse({ type: 'code', answer: 'X' }, ['C50']),
                                     hasResponse({ type: 'code', answer: 'X' }, ['  ']),
                                     hasResponse({ type: 'code', answer: 'X' }, [])]);
  chk(hr[0] === true && hr[1] === false && hr[2] === false, 'Code: hasResponse erkennt leere Eingabe');

  const txt = await p.evaluate(() => correctAnswerText({ type: 'code', answer: 'C50.4', accept: ['C50.9'] }));
  chk(/C50\.4/.test(txt) && /C50\.9/.test(txt), 'Code: Loesungstext nennt Antwort und Alternativen');

  // --- Eingabe im Uebungsmodus (echte Frage aus dem Katalog) ---
  const gestartet = await p.evaluate(() => {
    const q = QUESTIONS.find(x => x.type === 'code');
    if (!q) return false;
    SESSION = { mode: 'practice', topic: null, questions: [q], optionOrders: [[]], idx: 0,
      picks: [new Set()], checked: [false], correctFlags: [null] };
    go('quiz');
    return true;
  });
  chk(gestartet, 'Code: Uebungsmodus mit Kode-Frage gestartet');
  await p.waitForSelector('#codeField');
  chk((await p.$('.options')) === null, 'Code: keine Antwortoptionen sichtbar');
  const chipTxt = await p.textContent('.chip.code');
  chk(/Kode/.test(chipTxt || ''), 'Code: Aufgabentyp wird als Chip benannt');
  chk(await p.isDisabled('#checkBtn'), 'Code: Pruefen ist ohne Eingabe gesperrt');

  await p.fill('#codeField', '  ');
  chk(await p.isDisabled('#checkBtn'), 'Code: reine Leerzeichen schalten Pruefen nicht frei');

  const loesung = await p.evaluate(() => SESSION.questions[0].answer.toLowerCase());
  await p.fill('#codeField', loesung);
  chk(!(await p.isDisabled('#checkBtn')), 'Code: Eingabe schaltet Pruefen frei');
  await p.click('#checkBtn');
  await p.waitForSelector('#explainBox');
  const verdikt = await p.textContent('.verdict');
  chk(/Richtig/.test(verdikt), 'Code: kleingeschriebene Loesung wird als richtig gewertet');
  chk(/Richtige Antwort/.test(await p.textContent('#explainBox')), 'Code: Musterloesung wird gezeigt');
  const gebucht = await p.evaluate(() => {
    const q = S.perQuestion[SESSION.questions[0].id];
    return { seen: q.seen, correct: q.correct, cold: q.cold };
  });
  chk(gebucht.seen === 1 && gebucht.correct === 1 && gebucht.cold === 'correct',
    'Code: Fortschritt und Beobachtung werden gebucht wie bei jedem anderen Typ');

  // --- Pruefungsmodus ---
  const imExamen = await p.evaluate(() => {
    const q = QUESTIONS.find(x => x.type === 'code');
    return examPickType(q);
  });
  chk(imExamen === 'code', 'Code: Pruefungsmodus kennt den Typ (kein Rueckfall auf multi)');
}

// 6i) Blockzuordnung: eine Kodier-Aufgabe zaehlt immer als Codierung
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => ({
    // klinisches Thema, aber Aufgabentyp code -> Codierung
    codeInKlinik: examBlockOf({ type: 'code', topic: 'syserkr_lymphome' }),
    mcInKlinik:   examBlockOf({ type: 'single', topic: 'syserkr_lymphome' }),
    codeInStat:   examBlockOf({ type: 'code', topic: 'deskstat_haeufigkeit_grafik' }),
    mcInStat:     examBlockOf({ type: 'single', topic: 'deskstat_haeufigkeit_grafik' }),
    alsString:    examBlockOf('deskstat_haeufigkeit_grafik'),
  }));
  chk(r.codeInKlinik === 'C', 'Block: Kodier-Aufgabe im klinischen Thema zaehlt als Codierung');
  chk(r.mcInKlinik === 'K', 'Block: Auswahlfrage im klinischen Thema bleibt Klinik');
  chk(r.codeInStat === 'C', 'Block: Kodier-Aufgabe schlaegt auch die Statistik-Zuordnung');
  chk(r.mcInStat === 'S', 'Block: Statistik-Thema bleibt sonst Statistik');
  chk(r.alsString === 'S', 'Block: Themenschluessel als String wird weiterhin akzeptiert');
}

// 6j) Übungsmodus „Kodes eintragen": eigener Einstieg, nur Kodier-Aufgaben
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-act="mixed"]');
  const anzahl = await p.evaluate(() => QUESTIONS.filter(q => q.type === 'code').length);
  chk(anzahl > 0, 'Kodes-Modus: Testkatalog enthaelt Kodier-Aufgaben (Voraussetzung)');
  const btn = await p.$('[data-act="code"]');
  chk(!!btn, 'Kodes-Modus: Knopf erscheint auf der Startseite');
  chk(new RegExp(String(anzahl)).test(await p.textContent('[data-act="code"]')),
    'Kodes-Modus: Knopf nennt die Anzahl der Aufgaben');

  await p.click('[data-act="code"]');
  await p.waitForSelector('.q-card');
  const nurCode = await p.evaluate(() => ({
    alle: SESSION.questions.every(q => q.type === 'code'),
    n: SESSION.questions.length,
    modus: SESSION.mode,
  }));
  chk(nurCode.alle && nurCode.n > 0, 'Kodes-Modus: Runde enthaelt ausschliesslich Kodier-Aufgaben');
  chk(nurCode.modus === 'code', 'Kodes-Modus: Session traegt den eigenen Modus');
  chk(!!(await p.$('#codeField')), 'Kodes-Modus: Eingabefeld statt Optionen');

  // Ohne Kodier-Aufgaben im Katalog darf der Knopf nicht erscheinen
  const q2 = await page();
  await q2.addInitScript(() => { window.__ohneCode = true; });
  await q2.goto(BASE, { waitUntil: 'networkidle' });
  await q2.evaluate(() => { window.QUESTIONS = QUESTIONS.filter(q => q.type !== 'code'); go('home'); });
  await q2.waitForSelector('[data-act="mixed"]');
  chk((await q2.$('[data-act="code"]')) === null, 'Kodes-Modus: ohne Kodier-Aufgaben kein Knopf');
}

// 6k) sw.js traegt dieselbe Version wie app.js
// Ohne das feuert `updatefound` nicht und es gibt KEINEN automatischen Update-Hinweis:
// der Browser meldet eine neue Fassung nur, wenn sich sw.js selbst aendert.
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const app = await p.evaluate(() => APP_VERSION);
  const swTxt = await (await p.request.get(new URL('sw.js', BASE).href)).text();
  const m = /^\s*const SW_APP_VERSION\s*=\s*"([^"]+)"/m.exec(swTxt);
  chk(!!m, 'Update: sw.js enthaelt eine SW_APP_VERSION');
  chk(m && m[1] === app, `Update: sw.js (${m && m[1]}) traegt dieselbe Version wie app.js (${app})`);
}

// 6l) „Schwachstellen" sind nur bereits beantwortete Fragen
// Frueher zaehlten auch nie gesehene mit – bei 5.656 Fragen stand dort der halbe
// Katalog, eine Zahl die sich beim Lernen kaum bewegt.
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const ids = QUESTIONS.map(q => q.id);
    S.perQuestion = {};
    // eine falsch beantwortete, eine richtige, eine nie gesehene
    S.perQuestion[ids[0]] = { seen: 2, correct: 0, wrong: 2, lastResult: 'wrong', box: 0, due: null, masteredOnce: false };
    S.perQuestion[ids[1]] = { seen: 3, correct: 3, wrong: 0, lastResult: 'correct', box: 3, due: null, masteredOnce: true };
    S.perQuestion[ids[2]] = { seen: 3, correct: 2, wrong: 1, lastResult: 'wrong', box: 1, due: null, masteredOnce: false };
    const w = weakQuestions().map(q => q.id);
    return { n: w.length, hatFalsche: w.includes(ids[0]), hatZuletztFalsch: w.includes(ids[2]),
             hatRichtige: w.includes(ids[1]), hatUngesehene: w.includes(ids[5]), katalog: QUESTIONS.length };
  });
  chk(r.hatFalsche, 'Schwachstellen: nie richtig beantwortete Frage zaehlt');
  chk(r.hatZuletztFalsch, 'Schwachstellen: zuletzt falsch beantwortete Frage zaehlt');
  chk(!r.hatRichtige, 'Schwachstellen: sicher beantwortete Frage zaehlt nicht');
  chk(!r.hatUngesehene, 'Schwachstellen: nie gesehene Frage zaehlt NICHT');
  chk(r.n === 2, `Schwachstellen: genau die zwei erwarteten (statt ${r.katalog - 1})`);
}

// 7b) Prüfungs-Blueprint: Ziehung folgt der echten Gewichtung 40/50/10
// (vorher zog die Simulation faktisch 1 Frage je Thema und untergewichtete
// damit Codierung – den größten Block der echten Prüfung).
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    // Katalog mit bekannter Blockverteilung unterschieben
    const mk = (t, n, o) => Array.from({ length: n }, (_, i) =>
      ({ id: t + i, topic: t, type: 'single', question: 'x', options: ['a', 'b'], correct: [0] }));
    window.QUESTIONS = [
      ...mk('brust_therapie', 200), ...mk('gyn_zervix', 200),          // K
      ...mk('tnm_grundlagen', 200), ...mk('icdo_icd_kodierung', 200),  // C
      ...mk('deskstat_grundlagen_lagemasse', 100),                     // S
    ];
    const runs = 50, agg = { K: 0, C: 0, S: 0 };
    let sizeOk = true, dupOk = true;
    for (let i = 0; i < runs; i++) {
      const qs = buildExamQuestions();
      if (qs.length !== 30) sizeOk = false;
      if (new Set(qs.map(q => q.id)).size !== qs.length) dupOk = false;
      const c = examBlockCounts(qs);
      agg.K += c.K; agg.C += c.C; agg.S += c.S;
    }
    return { K: agg.K / runs, C: agg.C / runs, S: agg.S / runs, sizeOk, dupOk };
  });
  chk(r.sizeOk, 'Blueprint: jede Simulation hat genau 30 Fragen');
  chk(r.dupOk, 'Blueprint: keine Frage doppelt in einer Simulation');
  chk(Math.abs(r.K - 12) < 0.6, `Blueprint: Allgemein & Klinik ~12/30 (ist ${r.K})`);
  chk(Math.abs(r.C - 15) < 0.6, `Blueprint: Codierung ~15/30 (ist ${r.C})`);
  chk(Math.abs(r.S - 3) < 0.6, `Blueprint: Statistik ~3/30 (ist ${r.S})`);
}

// 7c) Blueprint-Randfall: fehlt ein Block, werden seine Plätze umverteilt
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const mk = (t, n) => Array.from({ length: n }, (_, i) =>
      ({ id: t + i, topic: t, type: 'single', question: 'x', options: ['a', 'b'], correct: [0] }));
    window.QUESTIONS = [...mk('brust_therapie', 60), ...mk('tnm_grundlagen', 60)]; // keine Statistik
    const qs = buildExamQuestions();
    return { n: qs.length, s: examBlockCounts(qs).S };
  });
  chk(r.n === 30 && r.s === 0, 'Blueprint: fehlender Block wird umverteilt (weiterhin 30 Fragen)');
}

// 8) Prüfung: Session-Persistenz (Reload mitten in der Prüfung -> Fortsetzen möglich)
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="exam"]'); await p.waitForSelector('.exam-bar');
  await antworteImExamen(p);
  await p.click('#examNext'); await p.waitForTimeout(100);
  await p.reload({ waitUntil: 'networkidle' });                 // mitten in der Prüfung neu laden
  const saved = await p.evaluate(() => localStorage.getItem('adt_exam_session_v1'));
  chk(!!saved, 'Prüfung: laufende Session bleibt nach Reload erhalten');
}

// 8b) Prüfung verrät den Fragetyp nicht (Prüfungsordnung § 5: nur vollständig richtig zählt,
//     und die echte Prüfung sagt nicht, wie viele Antworten richtig sind). Alle Auswahlfragen
//     erscheinen in der Simulation als Mehrfachauswahl – im Lernmodus bleibt der echte Typ.
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="exam"]'); await p.waitForSelector('.exam-bar');

  // Nur aussagekräftig, wenn die Prüfung überhaupt eine single-Frage enthält.
  const typen = await p.evaluate(() => EXAM.qids.map(id => (QUESTIONS.find(q => q.id === id) || {}).type));
  chk(typen.includes('single'), 'Prüfung: Auswahl enthält mindestens eine single-Frage (Testvoraussetzung)');

  const singleIdx = typen.indexOf('single');
  await p.evaluate((i) => examGoto(i), singleIdx);
  await p.waitForSelector('.q-card');
  const chip = (await p.textContent('.q-meta')).trim();
  const rollen = await p.$$eval('.opt', els => els.map(e => e.getAttribute('role')));
  chk(!/Einfachauswahl/.test(chip) && /Mehrfachauswahl/.test(chip), 'Prüfung: single-Frage zeigt „Mehrfachauswahl", nicht „Einfachauswahl"');
  chk(rollen.length > 1 && rollen.every(r => r === 'checkbox'), 'Prüfung: Optionen sind Checkboxen (keine Radiobuttons)');

  // Zwei Kreuze bei einer single-Frage müssen stehen bleiben – die Prüfung korrigiert nicht still.
  const opts = await p.$$('.opt');
  await opts[0].click(); await opts[1].click();
  const gewaehlt = await p.$$eval('.opt', els => els.filter(e => e.getAttribute('aria-checked') === 'true').length);
  chk(gewaehlt === 2, 'Prüfung: zwei Auswahlen bei einer single-Frage bleiben beide stehen');

  // Gegenprobe Lernmodus: dort steht der echte Typ weiterhin dran.
  const q = await page();
  await q.goto(BASE, { waitUntil: 'networkidle' });
  await q.evaluate(() => localStorage.removeItem('adt_exam_session_v1'));
  await q.click('[data-act="mixed"]'); await q.waitForSelector('.q-card');
  const chips = [];
  for (let i = 0; i < 12 && !chips.some(c => /Einfachauswahl/.test(c)); i++) {
    chips.push((await q.textContent('.q-meta')).trim());
    await antworteIrgendwie(q);
    const weiter = await q.$('#checkBtn'); if (weiter) await weiter.click();
    const next = await q.$('#nextBtn'); if (!next) break;
    await next.click();
    await q.waitForSelector('.q-card');
  }
  chk(chips.some(c => /Einfachauswahl/.test(c)), 'Übung: Einfachauswahl wird weiterhin als solche angezeigt');
}

// 9) Schema-Migration v1 -> v3: SRS-Felder werden aus altem Fortschritt warmgestartet
{
  const p = await page();
  await p.addInitScript(() => localStorage.setItem('adt_trainer_state_v1', JSON.stringify({
    schemaVersion: 1, xp: 100, totalAnswered: 3, totalCorrect: 2,
    perQuestion: {
      'tnm-001': { seen: 2, correct: 2, wrong: 0, lastResult: 'correct' },   // -> Box 3 (sicher), +7 Tage
      'gr-001':  { seen: 1, correct: 0, wrong: 1, lastResult: 'wrong' },      // -> Box 0, heute fällig
    }, badges: {},
  })));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  // In-Memory-Zustand lesen (loadState migriert beim Start; localStorage wird erst beim
  // nächsten Speichern neu geschrieben – die Migration selbst wirkt sofort auf S).
  const st = await p.evaluate(() => S);
  const today = await p.evaluate(() => todayStr());
  // Version nicht fest verankern (sie waechst mit dem Datenmodell) – gefordert ist,
  // dass die Kette bis zur aktuellen Version durchlaeuft und der Warmstart stimmt.
  const okMig = st.schemaVersion >= 3
    && st.perQuestion['tnm-001'].box === 3 && st.perQuestion['tnm-001'].due > today
    && st.perQuestion['gr-001'].box === 0 && st.perQuestion['gr-001'].due === today;
  chk(okMig, 'Migration v1->v3: Box/Fälligkeit aus altem Fortschritt warmgestartet');
  chk(st.reports && typeof st.reports === 'object' && !Object.keys(st.reports).length,
    'Migration v2->v3: Meldungen-Feld ergänzt, alter Fortschritt unangetastet');
  // Home zeigt die heute fällige Wiederholung an (mind. 1)
  const dueEnabled = await p.evaluate(() => { const b = document.querySelector('[data-act="due"]'); return b && !b.disabled; });
  chk(dueEnabled, 'Migration: fällige Frage erscheint als aktive Wiederholung auf der Startseite');
}

// 10) SRS: richtige Antwort erhöht die Box und terminiert die Wiederholung in die Zukunft
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  // Deterministisch eine Options-Frage (nicht numeric) korrekt vorbelegen
  const qid = await p.evaluate(() => {
    const q = QUESTIONS.find(x => Array.isArray(x.options) && x.options.length);
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set(q.correct)], checked: [false], correctFlags: [null] };
    go('quiz');
    return q.id;
  });
  await p.waitForSelector('.q-card');
  await p.click('#checkBtn'); await p.waitForSelector('.explain.ok');
  const rec = await p.evaluate((id) => S.perQuestion[id], qid);
  const today = await p.evaluate(() => todayStr());
  chk(rec && rec.box === 1 && rec.lastResult === 'correct' && rec.due > today,
    'SRS: korrekte Antwort -> Box 1, Wiederholung erst in Zukunft (nicht sofort fällig)');
}

// 11) Numerische Rechenaufgabe: Eingabe, Bewertung mit Toleranz, SRS-Fortschreibung
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  // Deterministisch eine numeric-Frage als Ein-Fragen-Session rendern
  const qid = await p.evaluate(() => {
    const q = QUESTIONS.find(x => x.type === 'numeric');
    if (!q) return null;
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [[]], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] };
    go('quiz');
    return q.id;
  });
  chk(!!qid, 'Numeric: mindestens eine Rechenaufgabe vorhanden');
  await p.waitForSelector('#numField');
  // Falsche Zahl -> „Nicht ganz" + richtige Lösung wird gezeigt
  await p.fill('#numField', '999999');
  await p.click('#checkBtn'); await p.waitForSelector('.explain.no');
  const solvedShown = await p.$('.explain .solved');
  chk(!!solvedShown, 'Numeric: falsche Eingabe zeigt Verdikt + richtige Lösung');
  const recWrong = await p.evaluate((id) => S.perQuestion[id], qid);
  chk(recWrong && recWrong.box === 0 && recWrong.lastResult === 'wrong', 'Numeric: falsche Antwort -> Box 0');
  // Neue Session, korrekte Zahl -> „Richtig" + Box steigt
  await p.evaluate((id) => {
    const q = QUESTIONS.find(x => x.id === id);
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [[]], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] };
    go('quiz');
  }, qid);
  await p.waitForSelector('#numField');
  const answer = await p.evaluate((id) => String(QUESTIONS.find(x => x.id === id).answer).replace('.', ','), qid);
  await p.fill('#numField', answer);
  await p.click('#checkBtn'); await p.waitForSelector('.explain.ok');
  const recOk = await p.evaluate((id) => S.perQuestion[id], qid);
  chk(recOk && recOk.lastResult === 'correct' && recOk.box >= 1, 'Numeric: korrekte Eingabe -> Richtig, Box steigt');
}

// 12) Barrierefreie & robuste Antwortauswahl: In-place-Toggle + ARIA-Rollen + Tastatur
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  // Deterministisch eine Einfachauswahl-Frage rendern
  await p.evaluate(() => {
    const q = QUESTIONS.find(x => x.type === 'single');
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] };
    go('quiz');
  });
  await p.waitForSelector('.options[role="radiogroup"]');
  chk(true, 'A11y: Optionsfeld hat role=radiogroup');
  const roleOk = await p.$$eval('.opt', els => els.every(e => e.getAttribute('role') === 'radio'));
  chk(roleOk, 'A11y: Optionen haben role=radio + aria-checked');
  // In-place-Toggle: Container-Knoten darf NICHT ersetzt werden
  await p.evaluate(() => { document.querySelector('.options').dataset.probe = 'keep'; });
  await p.$$eval('.opt', els => els[1].click());
  const inPlace = await p.evaluate(() => document.querySelector('.options').dataset.probe === 'keep');
  chk(inPlace, 'A11y: Auswahl aktualisiert in-place (kein Full-Re-Render)');
  const checkedState = await p.$$eval('.opt', els => [els[0].getAttribute('aria-checked'), els[1].getAttribute('aria-checked')]);
  chk(checkedState[1] === 'true' && checkedState[0] === 'false', 'A11y: aria-checked spiegelt die Auswahl');
  const btnEnabled = await p.evaluate(() => !document.getElementById('checkBtn').disabled);
  chk(btnEnabled, 'A11y: „Antwort prüfen" wird nach Auswahl aktiv');
  // Tastatur: Pfeiltaste bewegt Auswahl (Einfachauswahl wählt zugleich)
  await p.$$eval('.opt', els => els[0].focus());
  await p.keyboard.press('ArrowDown');
  const afterKey = await p.$$eval('.opt', els => els.map(e => e.getAttribute('aria-checked')));
  chk(afterKey.filter(v => v === 'true').length === 1 && afterKey[0] !== 'true', 'A11y: Pfeiltaste verschiebt die Auswahl (Einfachauswahl)');

  // Mehrfachauswahl: Toggle an/aus
  await p.evaluate(() => {
    const q = QUESTIONS.find(x => x.type === 'multi');
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] };
    go('quiz');
  });
  await p.waitForSelector('.options[role="group"]');
  await p.$$eval('.opt', els => els[0].click());
  const on = await p.$$eval('.opt', els => els[0].getAttribute('aria-checked'));
  await p.$$eval('.opt', els => els[0].click());
  const off = await p.$$eval('.opt', els => els[0].getAttribute('aria-checked'));
  chk(on === 'true' && off === 'false', 'A11y: Mehrfachauswahl toggelt an und wieder aus');
}

// 13) Prüfung: barrierefreie & in-place Antwortauswahl (gleiches Muster wie Übung)
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="exam"]'); await p.waitForSelector('.exam-bar');
  // zu einer Options-Frage navigieren (nicht numeric)
  let found = false;
  for (let i = 0; i < 40; i++) {
    if (await p.$('.options[role]')) { found = true; break; }
    const nd = await p.getAttribute('#examNext', 'disabled');
    if (nd !== null) break;
    await p.click('#examNext');
  }
  chk(found, 'Prüfung: Options-Frage erreichbar');
  const role = await p.getAttribute('.options', 'role');
  chk(role === 'radiogroup' || role === 'group', 'Prüfung A11y: Optionsfeld hat radiogroup/group');
  await p.evaluate(() => { document.querySelector('.options').dataset.probe = 'keep'; });
  await p.$$eval('.opt', els => els[0].click());
  const inPlace = await p.evaluate(() => document.querySelector('.options').dataset.probe === 'keep');
  chk(inPlace, 'Prüfung A11y: Auswahl aktualisiert in-place (kein Full-Re-Render)');
  const checkedAttr = await p.$$eval('.opt', els => els[0].getAttribute('aria-checked'));
  chk(checkedAttr === 'true', 'Prüfung A11y: aria-checked gesetzt');
  const ov = await p.textContent('#examOverview');
  chk(ov.includes('1/'), 'Prüfung: „beantwortet"-Zähler aktualisiert sich in-place');
}

// 14) Faire Serie: Gnadentag hält die Serie, zwei verpasste Tage setzen zurück, Rekord bleibt
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const res = await p.evaluate(() => {
    // genau ein Tag verpasst (Lücke 2) -> Serie läuft weiter
    S.streak = 5; S.bestStreak = 5; S.lastActiveDay = addDaysStr(-2);
    touchStreak();
    const graceKept = S.streak;
    // zwei Tage verpasst (Lücke 3) -> Neustart bei 1
    S.streak = 5; S.lastActiveDay = addDaysStr(-3);
    touchStreak();
    const reset = S.streak;
    return { graceKept, reset, best: S.bestStreak };
  });
  chk(res.graceKept === 6, 'Serie: ein Gnadentag hält die Serie (5 -> 6)');
  chk(res.reset === 1, 'Serie: zwei verpasste Tage setzen zurück (-> 1)');
  chk(res.best >= 6, 'Serie: Rekord-Serie bleibt erhalten');
}

// 15) Tagesziel: Ring auf der Startseite, Fortschritt zählt heute, Ziel änderbar
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.today-card');
  const start = await p.textContent('.today-main .txt p');
  chk(/0 \/ 10 Fragen/.test(start), 'Tagesziel: Startzustand 0/10 auf der Startseite');
  // eine Frage beantworten -> Tageszähler steigt
  await p.evaluate(() => {
    const q = QUESTIONS.find(x => Array.isArray(x.options) && x.options.length);
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set(q.correct)], checked: [false], correctFlags: [null] };
    go('quiz');
  });
  await p.click('#checkBtn'); await p.waitForSelector('.explain');
  await p.evaluate(() => go('home'));
  await p.waitForSelector('.today-card');
  const after = await p.textContent('.today-main .txt p');
  chk(/1 \/ 10 Fragen/.test(after), 'Tagesziel: nach 1 Antwort steht 1/10');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('adt_today') || '{}').count);
  chk(stored === 1, 'Tagesziel: heutiger Zähler lokal gespeichert');
}

// 16) Onboarding: Erststart zeigt Begrüßung, setzt Tagesziel und Flag
{
  const p = await page({ onboarded: false });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.modal-overlay.onboard');
  chk(true, 'Onboarding: Begrüßung erscheint beim Erststart');
  // anderes Ziel wählen (20) und starten
  await p.click('.goal-chip[data-goal="20"]');
  await p.click('#onboardStart');
  await p.waitForSelector('.modal-overlay.onboard', { state: 'detached' });
  const goal = await p.evaluate(() => localStorage.getItem('adt_daily_goal'));
  const flag = await p.evaluate(() => localStorage.getItem('adt_onboarded'));
  chk(goal === '20' && flag === '1', 'Onboarding: Ziel (20) + Flag gesetzt');
  const ring = await p.textContent('.today-main .txt p');
  chk(/\/ 20 Fragen/.test(ring), 'Onboarding: Startseite übernimmt das gewählte Ziel');
  // Reload -> Onboarding erscheint NICHT erneut
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('.today-card');
  const again = await p.$('.modal-overlay.onboard');
  chk(!again, 'Onboarding: erscheint nach Abschluss nicht erneut');
}

// 17) Härtung: unbekannte Frage-IDs in perQuestion werden verworfen, echte behalten
{
  const p = await page();
  await p.addInitScript(() => localStorage.setItem('adt_trainer_state_v1', JSON.stringify({
    schemaVersion: 2,
    perQuestion: { 'gr-001': { seen: 1, correct: 1, box: 1, due: '2020-01-01' }, 'BOGUS-XYZ': { seen: 9, correct: 9 } },
    badges: {},
  })));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  const pq = await p.evaluate(() => S.perQuestion);
  chk(pq['gr-001'] && !pq['BOGUS-XYZ'], 'Härtung: fremde Frage-ID verworfen, echte behalten');
}

// 18) Native Zurück-Navigation (System-/Browser-Zurück bleibt in der App)
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  // Themen -> Zurück -> Startseite
  await p.click('[data-act="topics"]'); await p.waitForSelector('.topic-row');
  await p.evaluate(() => history.back());
  await p.waitForSelector('.level-card');
  chk(true, 'Zurück: Themen → Startseite (in der App)');
  // Quiz -> Zurück -> Bestätigung -> verlassen -> Startseite
  await p.click('[data-act="mixed"]'); await p.waitForSelector('.q-card');
  await p.evaluate(() => history.back());
  await p.waitForSelector('.modal-overlay .modal-btn.btn-danger');
  await p.click('.modal-overlay .modal-btn.btn-danger');
  await p.waitForSelector('.level-card');
  chk(true, 'Zurück aus Quiz: fragt nach und führt zur Startseite');
  // Quiz -> Zurück -> „Weiter üben" -> bleibt im Quiz
  await p.click('[data-act="mixed"]'); await p.waitForSelector('.q-card');
  await p.evaluate(() => history.back());
  await p.waitForSelector('.modal-overlay .modal-btn.btn-ghost');
  await p.click('.modal-overlay .modal-btn.btn-ghost');
  await p.waitForTimeout(200);
  chk(!!(await p.$('.q-card')), 'Zurück aus Quiz: „Weiter üben" bleibt im Quiz');
}

// 19) Einstellungen: Fragen pro Runde + Design-Umschalter
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  // Einstellungsseite rendert die neuen Steuerelemente
  await p.click('[data-act="settings"]');
  await p.waitForSelector('#setSize');
  await p.waitForSelector('#setTheme');
  chk(true, 'Einstellungen: Seite mit Design + Fragen-pro-Runde rendert');
  // Fragen pro Runde begrenzt die Session
  const len10 = await p.evaluate(() => { setSessionSize(10); buildSession('mixed'); return SESSION.questions.length; });
  chk(len10 === 10, 'Einstellung: 10 Fragen pro Runde greift');
  const lenAll = await p.evaluate(() => { setSessionSize(0); buildSession('mixed'); return SESSION.questions.length; });
  chk(lenAll === (await p.evaluate(() => QUESTIONS.length)), 'Einstellung: „Alle" nutzt alle Fragen');
  // Design-Umschalter setzt/entfernt data-theme
  await p.evaluate(() => setTheme('dark'));
  chk(await p.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'Design: Dunkel setzt data-theme=dark');
  await p.evaluate(() => setTheme('light'));
  chk(await p.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'light', 'Design: Hell setzt data-theme=light');
  await p.evaluate(() => setTheme('auto'));
  chk(await p.evaluate(() => document.documentElement.getAttribute('data-theme')) === null, 'Design: Automatisch folgt System (kein data-theme)');
}

// 20) Barrierefreiheit-Paket + Tastatur (Laptop)
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  // Doppeltes h1 vermeiden: Balken-Titel auf Home für Screenreader ausgeblendet
  chk(await p.getAttribute('.appbar h1', 'aria-hidden') === 'true', 'A11y: Balken-h1 auf Home ausgeblendet');
  // Dialog: role=dialog + Escape schließt (Abbruch)
  await p.click('[data-act="reset"]');
  await p.waitForSelector('.modal-card[role="dialog"]');
  chk(true, 'A11y: Auswahl-Dialog hat role=dialog');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  chk(!(await p.$('.modal-overlay')), 'A11y: Escape schließt den Dialog (Abbruch)');

  // Deterministische Options-Frage rendern und per Zahl/Enter bedienen
  await p.evaluate(() => {
    const q = QUESTIONS.find(x => Array.isArray(x.options) && x.options.length);
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] };
    go('quiz');
  });
  await p.waitForSelector('.options .opt');
  chk(await p.getAttribute('.progress-track', 'role') === 'progressbar', 'A11y: Quiz-Fortschritt ist progressbar');
  chk(await p.getAttribute('.appbar h1', 'aria-hidden') === 'false', 'A11y: im Quiz ist der Balken-Titel das (einzige) h1');
  await p.keyboard.press('1');
  await p.waitForTimeout(100);
  chk(await p.$$eval('.options .opt', els => els[0].getAttribute('aria-checked')) === 'true', 'Tastatur: „1" wählt die erste Option');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.explain');
  chk(true, 'Tastatur: Enter prüft die Antwort');
}

// 21) Erstmeisterung: Frage erreicht Box 3 → einmaliger Bonus-XP
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  const r = await p.evaluate(() => {
    const q = QUESTIONS.find(x => Array.isArray(x.options) && x.options.length);
    S.perQuestion[q.id] = { seen: 2, correct: 2, wrong: 0, lastResult: 'correct', box: 2, due: todayStr(), masteredOnce: false };
    const xpBefore = S.xp;
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set(q.correct)], checked: [false], correctFlags: [null] };
    go('quiz');
    return { id: q.id, xpBefore };
  });
  await p.click('#checkBtn'); await p.waitForSelector('.explain.ok');
  const after = await p.evaluate((id) => ({ xp: S.xp, rec: S.perQuestion[id] }), r.id);
  chk(after.rec.box >= 3 && after.rec.masteredOnce === true, 'Erstmeisterung: Box 3+ erreicht, Einmal-Flag gesetzt');
  chk(after.xp - r.xpBefore >= 25, 'Erstmeisterung: Bonus-XP vergeben (≥ Basis+15)');
}

// 22) Cloud-Daten löschen: Button + Bestätigung erscheinen bei aktivem Sync (UI-Verdrahtung)
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  await p.evaluate(() => { if (window.ADTSync) ADTSync.setCode('ADT-AAAAA-BBBBB-CCCCC'); });
  await p.click('[data-act="settings"]');
  await p.waitForSelector('#btnDeleteCloud');
  chk(true, 'Cloud löschen: Button erscheint im verbundenen Zustand');
  await p.click('#btnDeleteCloud');
  await p.waitForSelector('.modal-card[role="dialog"]');
  chk(true, 'Cloud löschen: Bestätigungs-Dialog erscheint');
  await p.click('.modal-overlay .modal-btn.btn-ghost'); // Abbrechen (kein Netzaufruf)
  await p.evaluate(() => { if (window.ADTSync) ADTSync.setCode(null); });
}

// 23) Statistik: Seite rendert + Prüfungs-Historie wird geführt
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  await p.click('[data-act="stats"]');
  await p.waitForSelector('.large-title');
  const txt = await p.textContent('#app');
  chk(/Trefferquote je Thema/.test(txt) && /Prüfungs-Historie/.test(txt), 'Statistik: Themen + Historie rendern');
  await p.evaluate(() => pushExamHistory(72));
  await p.evaluate(() => go('stats'));
  chk(/72%/.test(await p.textContent('#app')), 'Statistik: Prüfungs-Historie zeigt Eintrag');
}

// 24) Animation & Haptik
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('.level-card');
  // Haptik-Einstellung persistiert
  await p.click('[data-act="settings"]'); await p.waitForSelector('#setHaptics');
  await p.evaluate(() => setHaptics(false));
  chk(await p.evaluate(() => getHaptics()) === false, 'Haptik: „Aus" wird gespeichert');
  await p.evaluate(() => setHaptics(true));
  chk(await p.evaluate(() => getHaptics()) === true, 'Haptik: „An" wird gespeichert');
  // Konfetti erzeugt einen Effekt-Layer
  const has = await p.evaluate(() => { celebrate(); return !!document.querySelector('.confetti'); });
  chk(has, 'Konfetti: celebrate() erzeugt einen Effekt-Layer');
  // Schriftgröße „Groß" setzt data-fontsize
  await p.evaluate(() => setFontSize('large'));
  chk(await p.evaluate(() => document.documentElement.getAttribute('data-fontsize')) === 'large', 'Schrift: „Groß" setzt data-fontsize=large');
  await p.evaluate(() => setFontSize('normal'));
  // Frische Frage bekommt die Einblende-Klasse
  await p.evaluate(() => { const q = QUESTIONS.find(x => Array.isArray(x.options) && x.options.length); SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] }; go('quiz'); });
  await p.waitForSelector('.q-card.q-anim');
  chk(true, 'Animation: neue Frage wird sanft eingeblendet (q-anim)');
}

// 25) Zugangsschutz: Freischalt-Bildschirm, korrekter Code lädt Inhalte, falscher nicht
{
  const demo = { TOPICS: { demo: { name: 'Demo', color: '#007aff' } }, QUESTIONS: [{ id: 'x1', topic: 'demo', difficulty: 1, type: 'single', question: 'Q?', options: ['a', 'b'], correct: [0], explanation: 'weil a genau richtig ist' }] };
  // Korrekter Code (get_content serverseitig gemockt) → Inhalte kommen nach Reload aus dem Cache
  const p = await page();
  await p.route('**/rpc/get_content', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(demo) }));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForSelector('.level-card');
  await p.evaluate(() => showContentGate());
  await p.waitForSelector('#gateCode');
  chk(true, 'Gate: Freischalt-Bildschirm rendert');
  await p.fill('#gateCode', 'langer-test-zugangscode');
  await p.click('#gateBtn');
  await p.waitForSelector('.level-card');   // Reload → Boot mit freigeschalteten Inhalten
  const okc = await p.evaluate(() => Object.keys(TOPICS).includes('demo') && QUESTIONS[0] && QUESTIONS[0].id === 'x1');
  chk(okc, 'Gate: freigeschaltete Inhalte werden nach Reload genutzt (aus dem Cache)');

  // Falscher Code (get_content antwortet 400) → Fehler, nichts gespeichert
  const q = await page();
  await q.route('**/rpc/get_content', (r) => r.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"unauthorized"}' }));
  await q.goto(BASE, { waitUntil: 'networkidle' }); await q.waitForSelector('.level-card');
  await q.evaluate(() => showContentGate());
  await q.fill('#gateCode', 'falsch');
  await q.click('#gateBtn');
  await q.waitForFunction(() => /ungültig|erreichbar/i.test((document.getElementById('gateErr') || {}).textContent || ''));
  // Der Testkatalog ist vorab hinterlegt (siehe seed-content.mjs) – entscheidend ist, dass ein
  // falscher Code NICHTS Neues speichert (die Demo-Inhalte tauchen also nicht auf).
  chk(!/\bx1\b/.test(await q.evaluate(() => localStorage.getItem('adt_content_v1') || '')), 'Gate: falscher Code speichert keine Inhalte');

  // Ohne freigeschaltete Inhalte blockiert der Schutz die App wirklich (kein Durchkommen).
  const g = await page({ seeded: false });
  await g.goto(BASE, { waitUntil: 'networkidle' });
  await g.waitForSelector('#gateCode');
  chk(!(await g.$('.level-card')), 'Gate: ohne freigeschaltete Inhalte bleibt die App gesperrt');
}

// 26) Frage melden („fragwürdig"): Knopf im Quiz, Sammelansicht, Notiz, Aufheben
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  // Deterministisch eine Options-Frage als Ein-Fragen-Session
  const qid = await p.evaluate(() => {
    const q = QUESTIONS.find(x => Array.isArray(x.options) && x.options.length);
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] };
    go('quiz');
    return q.id;
  });
  await p.waitForSelector('.q-card [data-report]');
  chk(await p.getAttribute('[data-report]', 'aria-pressed') === 'false', 'Melden: Knopf startet ungedrückt');

  // Abbrechen im Dialog ändert nichts
  await p.click('[data-report]');
  await p.waitForSelector('.modal-input');
  chk(await p.$eval('.modal-input', el => el === document.activeElement), 'Melden: Dialog setzt den Fokus ins Notizfeld');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  chk(!(await p.$('.report-btn.on')) && !(await p.evaluate((id) => !!S.reports[id], qid)), 'Melden: Abbruch im Dialog meldet nichts');

  // Melden MIT Kommentar: Dialog über der Frage, danach in place markiert (kein Re-Render)
  await p.click('[data-report]');
  await p.waitForSelector('.modal-input');
  chk(await p.$('.q-card .opt') !== null, 'Melden: Frage bleibt unter dem Dialog stehen (kein Ansichtswechsel)');
  await p.fill('.modal-input', 'Antwort B ist auch richtig');
  await p.click('.modal-actions .modal-btn');   // erster Knopf = „Melden"
  await p.waitForSelector('.report-btn.on');
  chk(await p.getAttribute('[data-report]', 'aria-pressed') === 'true', 'Melden: Knopf gedrückt (aria-pressed)');
  const rep = await p.evaluate((id) => S.reports[id], qid);
  chk(rep && rep.on === true && !!rep.at && rep.note === 'Antwort B ist auch richtig',
    'Melden: Meldung mit Zeitstempel UND Kommentar aus dem Dialog gespeichert');

  // Erneuter Tipp öffnet den Dialog mit vorhandener Notiz (Bearbeiten statt blindem Umschalten)
  await p.click('[data-report]');
  await p.waitForSelector('.modal-input');
  chk(await p.inputValue('.modal-input') === 'Antwort B ist auch richtig', 'Melden: Dialog zeigt die bisherige Notiz');
  await p.fill('.modal-input', 'Formulierung unklar');
  await p.keyboard.press('Enter');              // Enter = erste Aktion („Notiz speichern")
  await p.waitForTimeout(300);
  chk(await p.evaluate((id) => S.reports[id].note, qid) === 'Formulierung unklar', 'Melden: Notiz im Dialog änderbar (Enter bestätigt)');
  chk(await p.$('.report-btn.on') !== null, 'Melden: Frage bleibt nach dem Bearbeiten gemeldet');
  // Antwortmöglichkeiten bleiben bedienbar (Melden darf den Lernfluss nicht stören)
  await p.click('.opt');
  await p.click('#checkBtn'); await p.waitForSelector('.explain');
  chk(await p.$('.report-btn.on') !== null, 'Melden: Markierung überlebt das Prüfen der Antwort');

  // Sammelansicht über die Einstellungen
  await p.evaluate(() => go('settings'));
  await p.waitForSelector('#btnReports');
  chk(/Gemeldete Fragen \(1\)/.test(await p.textContent('#btnReports')), 'Melden: Einstellungen zeigen die Anzahl');
  await p.click('#btnReports');
  await p.waitForSelector('.report-item');
  chk((await p.$$('.report-item')).length === 1, 'Melden: Sammelansicht listet die Frage');

  // Notiz auch in der Liste änderbar (wird gespeichert und im Export-Text ausgegeben)
  chk(await p.inputValue('.report-note') === 'Formulierung unklar', 'Melden: Liste zeigt die Notiz aus dem Dialog');
  await p.fill('.report-note', 'Quelle fehlt');
  await p.evaluate(() => document.querySelector('.report-note').blur());
  await p.waitForTimeout(250);
  const note = await p.evaluate((id) => S.reports[id].note, qid);
  chk(note === 'Quelle fehlt', 'Melden: Notiz in der Liste änderbar');
  const txt = await p.evaluate(() => reportsAsText());
  chk(txt.includes(qid) && txt.includes('Quelle fehlt'), 'Melden: Export-Text enthält Frage-ID und Notiz');
  // Naht zum Repo-Backlog: der Export der App muss vom Werkzeug verstanden werden
  const parsed = parseItems(txt);
  chk(parsed.length === 1 && parsed[0].id === qid && !parsed[0].done && parsed[0].lines.join('\n').includes('Quelle fehlt'),
    'Melden: Export ist ein gültiges Backlog (tools/reports-to-backlog.mjs liest es)');

  // Zurücksetzen des Fortschritts darf Meldungen NICHT löschen (Feedback ≠ Lernfortschritt)
  await p.evaluate(() => { S = freshStateKeepingReports(); persistLocal(); });
  const survived = await p.evaluate((id) => !!(S.reports[id] && S.reports[id].on), qid);
  chk(survived, 'Melden: Meldungen überleben „Fortschritt zurücksetzen"');

  // Aufheben hinterlässt einen Grabstein (on:false MIT Zeitstempel) für den Cloud-Merge
  await p.evaluate(() => go('reports'));
  await p.waitForSelector('[data-unreport]');
  await p.click('[data-unreport]');
  await p.waitForTimeout(250);
  const after = await p.evaluate((id) => S.reports[id], qid);
  chk(after && after.on === false && !!after.at, 'Melden: Aufheben speichert Grabstein (kommt beim Sync nicht zurück)');
  chk(/Noch nichts gemeldet/.test(await p.textContent('#app')), 'Melden: leere Sammelansicht erklärt den Knopf');

  // „Meldung aufheben" geht auch direkt aus dem Dialog – ohne Umweg über die Sammelansicht
  await p.evaluate((id) => {
    setReported(id, true, 'kurz');
    const q = QUESTIONS.find(x => x.id === id);
    SESSION = { mode: 'mixed', topic: null, questions: [q], optionOrders: [q.options.map((_, i) => i)], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] };
    go('quiz');
  }, qid);
  await p.waitForSelector('.report-btn.on');
  await p.click('[data-report]');
  await p.waitForSelector('.modal-actions .modal-btn.btn-danger');
  await p.click('.modal-actions .modal-btn.btn-danger');
  await p.waitForTimeout(300);
  chk(!(await p.$('.report-btn.on')) && await p.evaluate((id) => S.reports[id].on === false, qid),
    'Melden: „Meldung aufheben" im Dialog wirkt sofort auf den Knopf');
}

// 27) Melden: Grenze greift und der Speicherstand wird nicht aufgebläht
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const res = await p.evaluate(() => {
    for (let i = 0; i < REPORT_MAX + 25; i++) setReported('fake-' + i, true);
    return { count: reportCount(), max: REPORT_MAX };
  });
  chk(res.count === res.max, 'Melden: Obergrenze von ' + res.max + ' aktiven Meldungen wird eingehalten');
  // Sanitisierung kappt die Ablage (inkl. Grabsteinen) auf REPORT_KEEP
  const kept = await p.evaluate(() => {
    const many = {};
    for (let i = 0; i < 2000; i++) many['x-' + i] = { on: i < 10, at: '2026-07-14T10:00:0' + (i % 10) + 'Z', note: 'x'.repeat(500) };
    const s = sanitizeState({ reports: many });
    return { n: Object.keys(s.reports).length, keep: REPORT_KEEP, active: Object.keys(s.reports).filter(k => s.reports[k].on).length, noteLen: s.reports[Object.keys(s.reports)[0]].note.length };
  });
  chk(kept.n === kept.keep && kept.active === 10 && kept.noteLen === 300,
    'Melden: Sanitisierung kappt Menge und Notizlänge, aktive Meldungen bleiben');
}

// 28) Meldung als GitHub-Issue: vorbefüllter Link, ohne Token in der App
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const qid = await p.evaluate(() => {
    const q = QUESTIONS.find(x => Array.isArray(x.options) && x.options.length);
    setReported(q.id, true, 'Antwort B ist auch richtig');
    go('reports');
    return q.id;
  });
  await p.waitForSelector('.report-item');
  chk(await p.$('[data-issue]') !== null, 'Issue: Knopf erscheint, wenn ein Zielrepo konfiguriert ist');
  chk(!(await p.$('#repIssueAll')), 'Issue: kein Sammel-Issue mehr – bewusst eins je Frage');

  const one = await p.evaluate((id) => issueForReport(reportedList().find(r => r.id === id)), qid);
  const repo = await p.evaluate(() => feedbackRepo());
  const u = new URL(one);
  chk(u.origin === 'https://github.com' && u.pathname === '/' + repo + '/issues/new', 'Issue: Link zeigt auf das konfigurierte Repo (' + repo + ')');
  chk(u.searchParams.get('title').includes(qid), 'Issue: Titel enthält die Frage-ID');
  chk(u.searchParams.get('body').includes('Antwort B ist auch richtig'), 'Issue: Notiz steht im Text');
  chk(u.searchParams.get('body').includes('Lösung:'), 'Issue: Lösung zum Korrigieren dabei');
  chk(u.searchParams.get('labels') === 'frage-feedback', 'Issue: Label gesetzt');
  // Kein Zugangsmittel im Link (der Repo-NAME darf „Secret" heißen – gemeint sind Tokens/Keys)
  chk(!/(access_token|api[_-]?key|authorization|ghp_|github_pat_|sb_(publishable|secret))/i.test(one),
    'Issue: kein Token/Key im Link');

  // Direktes Anlegen (Edge Function gemockt): kein Wechsel zu GitHub, Nummer kommt zurück
  {
    const q = await page();
    await q.route('**/functions/v1/create-issue', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, number: 42, url: 'https://github.com/o/r/issues/42' }),
    }));
    await q.goto(BASE, { waitUntil: 'networkidle' });
    const id2 = await q.evaluate(() => {
      localStorage.setItem('adt_content_code', 'test-zugangscode-lang');
      const x = QUESTIONS[1];
      setReported(x.id, true, 'Tippfehler');
      go('reports');
      return x.id;
    });
    await q.waitForSelector('[data-issue]');
    chk(await q.evaluate(() => issueApiPossible()), 'Direkt: Voraussetzungen erkannt (Supabase + Zugangscode)');
    let navigated = false;
    q.on('popup', () => { navigated = true; });
    await q.evaluate(() => { window.open = () => { window.__opened = true; return null; }; });
    await q.click('[data-issue]');
    await q.waitForSelector('.issued-note');
    chk(!navigated && !(await q.evaluate(() => window.__opened)), 'Direkt: kein Wechsel zu GitHub nötig');
    const rec = await q.evaluate((id) => S.reports[id], id2);
    chk(rec.issueNumber === 42 && rec.issueUrl === 'https://github.com/o/r/issues/42', 'Direkt: Issue-Nummer und Link gespeichert');
    chk(/#42/.test(await q.textContent('.issued-note')), 'Direkt: Liste zeigt „Issue #42 angelegt"');

    // Ein Tipp genügt: Melden IM QUIZ legt das Issue direkt an (ohne Umweg über die Liste)
    const q2 = await page();
    await q2.route('**/functions/v1/create-issue', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, number: 77, url: 'https://github.com/o/r/issues/77' }),
    }));
    await q2.goto(BASE, { waitUntil: 'networkidle' });
    const qid3 = await q2.evaluate(() => {
      localStorage.setItem('adt_content_code', 'test-zugangscode-lang');
      const x = QUESTIONS.find(y => Array.isArray(y.options) && y.options.length);
      SESSION = { mode: 'mixed', topic: null, questions: [x], optionOrders: [x.options.map((_, i) => i)], idx: 0, picks: [new Set()], checked: [false], correctFlags: [null] };
      go('quiz');
      return x.id;
    });
    await q2.waitForSelector('.report-btn');
    await q2.click('.report-btn');
    await q2.waitForSelector('.modal-input');
    chk(/direkt ein GitHub-Issue/.test(await q2.textContent('.modal-msg')), 'Sofort: Dialog sagt an, dass ein Issue entsteht');
    await q2.fill('.modal-input', 'Antwort passt nicht');
    await q2.click('.modal-actions .modal-btn');     // „Melden"
    await q2.waitForFunction((id) => S.reports[id] && S.reports[id].issueNumber === 77, qid3, { timeout: 8000 });
    chk(true, 'Sofort: „Frage melden" legt das Issue unmittelbar an (Issue #77)');
    chk(await q2.$('.q-card .opt') !== null && await q2.$('.report-btn.on') !== null,
      'Sofort: die Frage bleibt stehen, Knopf ist markiert');
    // … und die Meldung steht trotzdem in der Liste
    await q2.evaluate(() => go('reports'));
    await q2.waitForSelector('.report-item');
    chk(/#77/.test(await q2.textContent('.issued-note')) && /Antwort passt nicht/.test(await q2.inputValue('.report-note')),
      'Sofort: Meldung erscheint zusätzlich in der Liste – mit Issue-Nummer und Notiz');

    // Serverfehler → ehrliche Rückfrage statt stummem Scheitern
    const e = await page();
    await e.route('**/functions/v1/create-issue', (route) => route.fulfill({
      status: 501, contentType: 'application/json', body: JSON.stringify({ error: 'not-configured' }),
    }));
    await e.goto(BASE, { waitUntil: 'networkidle' });
    await e.evaluate(() => {
      localStorage.setItem('adt_content_code', 'test-zugangscode-lang');
      setReported(QUESTIONS[2].id, true, '');
      go('reports');
    });
    await e.waitForSelector('[data-issue]');
    await e.click('[data-issue]');
    await e.waitForSelector('.modal-card');
    chk(/nicht eingerichtet/.test(await e.textContent('.modal-msg')), 'Direkt: Fehlschlag wird benannt und der Link als Ausweg angeboten');
    await e.click('.modal-actions .modal-btn.btn-ghost');   // „Abbrechen"
    chk(!(await e.evaluate(() => S.reports[QUESTIONS[2].id].issuedAt)), 'Direkt: Abbruch vermerkt nichts');
  }

  // Rückfallebene ohne Serverfunktion: Formular öffnen und vermerken
  await p.evaluate(() => { window.open = () => null; });   // GitHub im Test nicht wirklich öffnen
  await p.click('[data-issue]');
  await p.waitForSelector('.issued-note');
  chk(await p.evaluate((id) => !!S.reports[id].issuedAt, qid), 'Issue: geöffnetes Issue wird am Eintrag vermerkt');
  chk(/Issue erneut öffnen/.test(await p.textContent('[data-issue]')), 'Issue: Knopf wechselt zu „erneut öffnen"');
  chk(/Bereits vorbereitet: <b>1<\/b>/.test(await p.innerHTML('.q-card')), 'Issue: Zähler „bereits vorbereitet" stimmt');
  // Notiz ändern darf den Vermerk nicht verlieren
  await p.evaluate((id) => setReportNote(id, 'noch eine Ergänzung'), qid);
  chk(await p.evaluate((id) => !!S.reports[id].issuedAt, qid), 'Issue: Vermerk überlebt spätere Änderungen');

  // Längengrenze: ein übergroßer Text (sehr lange Frage/Erklärung) darf die URL nicht sprengen
  const long = await p.evaluate(() => issueUrl('Lange Frage', 'Erklärung mit Umlauten äöü '.repeat(1000)));
  chk(long.length <= 8000, 'Issue: Link bleibt auch bei sehr langem Text unter 8 kB (' + long.length + ')');
  chk(decodeURIComponent(new URL(long).searchParams.get('body')).includes('gekürzt'), 'Issue: Kürzung wird im Text gesagt');

  // Ohne konfiguriertes Repo bleiben die Knöpfe weg (keine toten Wege in der Oberfläche)
  await p.evaluate(() => { window.ADT_CONFIG.feedbackRepo = ''; go('reports'); });
  await p.waitForSelector('.report-item');
  chk(!(await p.$('[data-issue]')) && await p.evaluate(() => issueForReport(reportedList()[0]) === ''),
    'Issue: ohne Zielrepo kein Knopf und kein Link');
}

// 29) Update-Knopf: sichtbar mit Version; ohne Service Worker führt er sauber zum Neuladen
{
  const p = await page();   // dieser Test läuft mit BLOCKIERTEM Service Worker
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="settings"]');
  await p.waitForSelector('#btnUpdate');
  const card = await p.textContent('.q-card:has(#btnUpdate)');
  const ver = await p.evaluate(() => APP_VERSION);
  chk(card.includes('Version ' + ver), 'Update: Einstellungen zeigen die laufende Version (' + ver + ')');
  chk(await p.evaluate(() => updateAvailable('99.9.9') === true && updateAvailable(APP_VERSION) === false && updateAvailable('') === false),
    'Update: Versionsvergleich (neu / gleich / unbekannt)');
  // Ohne Service Worker ist Neuladen der richtige Weg – die Seite muss danach normal stehen
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle' }), p.click('#btnUpdate')]);
  await p.waitForSelector('.level-card');
  chk(true, 'Update: ohne Service Worker lädt der Knopf die App neu (ohne Fehler)');
}

chk(errors.length === 0, 'keine Laufzeitfehler');
if (errors.length) errors.forEach((e) => console.log('  ' + e));
await browser.close();
const passed = checks.every(Boolean);
console.log(passed ? '\nOK: E2E-Smoke bestanden' : '\nE2E-Smoke fehlgeschlagen');
process.exit(passed ? 0 : 1);
