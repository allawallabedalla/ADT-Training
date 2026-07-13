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
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage();
  // Onboarding-Overlay standardmäßig überspringen, damit es die übrigen Tests nicht blockiert.
  if (opts.onboarded !== false) await p.addInitScript(() => localStorage.setItem('adt_onboarded', '1'));
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
  for (let i = 0; i < 3; i++) {
    await p.waitForSelector('.q-card');
    if (await p.$('#numField')) await p.fill('#numField', '5'); else await p.click('.opt');
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
    if (await p.$('#numField')) { await p.fill('#numField', '5'); await p.click('#checkBtn'); await p.waitForSelector('.explain'); await p.click('#nextBtn'); continue; }
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
    // Options- ODER Zahl-Frage beantworten (Prüfung kann jetzt Rechenaufgaben enthalten)
    if (await p.$('#examNum')) await p.fill('#examNum', '7');
    else await p.click('.opt');
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
  if (await p.$('#examNum')) await p.fill('#examNum', '7'); else await p.click('.opt');
  await p.click('#examNext'); await p.waitForTimeout(100);
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
  // Deterministisch eine Options-Frage (nicht numeric) korrekt vorbelegen
  const qid = await p.evaluate(() => {
    const q = QUESTIONS.find(x => x.type !== 'numeric');
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
    const q = QUESTIONS.find(x => x.type !== 'numeric');
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
    const q = QUESTIONS.find(x => x.type !== 'numeric');
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
    const q = QUESTIONS.find(x => x.type !== 'numeric');
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

chk(errors.length === 0, 'keine Laufzeitfehler');
if (errors.length) errors.forEach((e) => console.log('  ' + e));
await browser.close();
const passed = checks.every(Boolean);
console.log(passed ? '\nOK: E2E-Smoke bestanden' : '\nE2E-Smoke fehlgeschlagen');
process.exit(passed ? 0 : 1);
