// End-to-End-Smoke-Test im Browser (Playwright, Service Worker deaktiviert).
// Prüft die wichtigsten Invarianten ohne Laufzeitfehler.
// BASE-URL via Umgebungsvariable BASE (Default: http://localhost:8399/index.html).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');

const BASE = process.env.BASE || 'http://localhost:8399/index.html';
const TMP = process.env.TMPDIR || '/tmp';
const errors = [];
const checks = [];
const chk = (c, m) => { checks.push(c); console.log((c ? 'ok:  ' : 'FAIL:') + ' ' + m); };

const browser = await chromium.launch();
async function page() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
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
  for (let i = 0; i < 3; i++) { await p.waitForSelector('.q-card'); await p.click('.opt'); await p.click('#checkBtn'); await p.waitForSelector('.explain'); await p.click('#nextBtn'); }
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
  for (let i = 0; i < 6; i++) {
    await p.waitForSelector('.q-card');
    await p.click('.opt'); await p.click('#checkBtn'); await p.waitForSelector('.explain');
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
    await p.click('.opt');
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
}

// 8) Prüfung: Session-Persistenz (Reload mitten in der Prüfung -> Fortsetzen möglich)
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="exam"]'); await p.waitForSelector('.exam-bar');
  await p.click('.opt'); await p.click('#examNext'); await p.waitForTimeout(100);
  await p.reload({ waitUntil: 'networkidle' });                 // mitten in der Prüfung neu laden
  const saved = await p.evaluate(() => localStorage.getItem('adt_exam_session_v1'));
  chk(!!saved, 'Prüfung: laufende Session bleibt nach Reload erhalten');
}

// 9) Schema-Migration v1 -> v2: SRS-Felder werden aus altem Fortschritt warmgestartet
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
  const okMig = st.schemaVersion === 2
    && st.perQuestion['tnm-001'].box === 3 && st.perQuestion['tnm-001'].due > today
    && st.perQuestion['gr-001'].box === 0 && st.perQuestion['gr-001'].due === today;
  chk(okMig, 'Migration v1->v2: Box/Fälligkeit aus altem Fortschritt warmgestartet');
  // Home zeigt die heute fällige Wiederholung an (mind. 1)
  const dueEnabled = await p.evaluate(() => { const b = document.querySelector('[data-act="due"]'); return b && !b.disabled; });
  chk(dueEnabled, 'Migration: fällige Frage erscheint als aktive Wiederholung auf der Startseite');
}

// 10) SRS: richtige Antwort erhöht die Box und terminiert die Wiederholung in die Zukunft
{
  const p = await page();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="mixed"]'); await p.waitForSelector('.q-card');
  // Eine Frage vollständig korrekt beantworten
  const qid = await p.evaluate(() => SESSION.questions[SESSION.idx].id);
  await p.evaluate(() => { const q = SESSION.questions[SESSION.idx]; SESSION.picks[SESSION.idx] = new Set(q.correct); renderQuiz(); });
  await p.click('#checkBtn'); await p.waitForSelector('.explain.ok');
  const rec = await p.evaluate((id) => S.perQuestion[id], qid);
  const today = await p.evaluate(() => todayStr());
  chk(rec && rec.box === 1 && rec.lastResult === 'correct' && rec.due > today,
    'SRS: korrekte Antwort -> Box 1, Wiederholung erst in Zukunft (nicht sofort fällig)');
}

chk(errors.length === 0, 'keine Laufzeitfehler');
if (errors.length) errors.forEach((e) => console.log('  ' + e));
await browser.close();
const passed = checks.every(Boolean);
console.log(passed ? '\nOK: E2E-Smoke bestanden' : '\nE2E-Smoke fehlgeschlagen');
process.exit(passed ? 0 : 1);
