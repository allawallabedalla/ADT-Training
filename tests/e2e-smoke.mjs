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
  p.on('dialog', (d) => d.accept());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('[data-act="mixed"]'); await p.waitForSelector('.q-card');
  for (let i = 0; i < 3; i++) { await p.waitForSelector('.q-card'); await p.click('.opt'); await p.click('#checkBtn'); await p.waitForSelector('.explain'); await p.click('#nextBtn'); }
  await p.click('#backBtn'); await p.waitForSelector('[data-act="reset"]');
  await p.click('[data-act="reset"]'); await p.waitForSelector('.modal-overlay .modal-btn');
  await p.click('.modal-btn.btn-danger'); await p.waitForTimeout(300);
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
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.click('[data-act="info"]'); await p.waitForSelector('.large-title'); chk(true, 'Info rendert');
}

chk(errors.length === 0, 'keine Laufzeitfehler');
if (errors.length) errors.forEach((e) => console.log('  ' + e));
await browser.close();
const passed = checks.every(Boolean);
console.log(passed ? '\nOK: E2E-Smoke bestanden' : '\nE2E-Smoke fehlgeschlagen');
process.exit(passed ? 0 : 1);
