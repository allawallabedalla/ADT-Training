// Service-Worker-/Offline-Test (mit AKTIVEM Service Worker, anders als der e2e-Smoke,
// der ihn bewusst blockiert). Prüft: Registrierung, Precache, Kontrolle und – am
// wichtigsten – dass die App OFFLINE weiter aus dem Cache lädt.
// BASE via Umgebungsvariable (Default: http://localhost:8399/index.html).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { seedContent } from './seed-content.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = process.env.BASE || 'http://localhost:8399/index.html';
let pass = true;
const chk = (c, m) => { if (!c) { pass = false; console.log('FAIL: ' + m); } else console.log('ok:  ' + m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // SW erlaubt (Default)
const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem('adt_onboarded', '1'));
await seedContent(p);   // Zugangsschutz für den Test neutralisieren (siehe seed-content.mjs)
const errors = [];
p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

await p.goto(BASE, { waitUntil: 'networkidle' });
const active = await p.evaluate(() => navigator.serviceWorker.ready.then((r) => !!r.active).catch(() => false));
chk(active, 'Service Worker registriert & aktiv');
const cached = await p.evaluate(async () => {
  const ks = await caches.keys(); if (!ks.length) return 0;
  const c = await caches.open(ks[0]); return (await c.keys()).length;
});
chk(cached >= 8, 'App-Shell im Cache vorgespeichert (' + cached + ' Einträge)');

await p.reload({ waitUntil: 'networkidle' });
chk(await p.evaluate(() => !!navigator.serviceWorker.controller), 'Seite wird vom Service Worker kontrolliert');
await p.waitForSelector('.level-card');

// Kern-Offline-Garantie
await ctx.setOffline(true);
let offlineOk = true;
try { await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('.level-card', { timeout: 6000 }); }
catch (_) { offlineOk = false; }
chk(offlineOk, 'App lädt OFFLINE aus dem Cache (kein Netz)');
chk(await p.evaluate(async () => { try { return (await fetch('css/styles.css')).ok; } catch { return false; } }), 'CSS offline verfügbar');
chk(await p.evaluate(async () => { try { return (await fetch('data/questions.js')).ok; } catch { return false; } }), 'Fragen offline verfügbar');

// Offline meldet die Update-Prüfung ehrlich „geht gerade nicht", statt stumm zu bleiben
await p.evaluate(() => go('settings'));
await p.waitForSelector('#btnUpdate');
await p.click('#btnUpdate');
await p.waitForFunction(() => /Offline/i.test(document.getElementById('updateStatus').textContent), null, { timeout: 8000 }).catch(() => {});
chk(/Offline/i.test(await p.textContent('#updateStatus')), 'Update: offline sagt die App das klar');
await ctx.setOffline(false);

// „Nach Updates suchen": Der Service Worker holt die Shell frisch und meldet die
// ausgelieferte Version zurück (Kern des Knopfes – ohne ihn wäre Neuinstallieren nötig).
{
  const res = await p.evaluate(() => new Promise((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve({ timeout: true }), 15000);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data); };
    navigator.serviceWorker.controller.postMessage({ type: 'REFRESH_SHELL' }, [ch.port2]);
  }));
  const local = await p.evaluate(() => APP_VERSION);
  chk(res && res.ok === true, 'Update: Service Worker beantwortet REFRESH_SHELL');
  chk(res && res.version === local, 'Update: gemeldete Version = ausgelieferte Version (' + local + ')');
  const stillCached = await p.evaluate(async () => {
    const ks = await caches.keys(); const c = await caches.open(ks[0]); return (await c.keys()).length;
  });
  chk(stillCached >= 8, 'Update: Shell nach dem Auffrischen weiterhin vollständig im Cache');
}

// Kein Update vorhanden → klare Rückmeldung, kein Reload
await p.click('#btnUpdate');
await p.waitForFunction(() => /Aktuell: Version/.test(document.getElementById('updateStatus').textContent), null, { timeout: 20000 });
chk(/Aktuell: Version/.test(await p.textContent('#updateStatus')), 'Update: „bereits aktuell" wird gemeldet');
chk(await p.evaluate(() => updateAvailable('99.9.9') === true && updateAvailable(APP_VERSION) === false),
  'Update: Versionsvergleich erkennt neue Fassung');

/* ---- Ganzer Update-Weg: „auf GitHub Pages liegt eine neue Fassung" ------------------
 * Dafür braucht es einen Server, dessen Auslieferung sich MITTEN im Test ändern lässt
 * (ein Deploy im Kleinen) – der statische python-Server kann das nicht, und Playwright
 * fängt Service-Worker-Anfragen nicht ab. Also ein kleiner eigener Server auf gleichem
 * Origin: erst die echte App, nach dem Umschalten eine „neuere" Version. */
{
  const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  let bumped = false;                     // false = echte Auslieferung, true = „neu deployt"
  const realApp = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const newApp = realApp.replace(/^\s*const APP_VERSION\s*=\s*"[^"]+"/m, 'const APP_VERSION = "99.0.0"');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    if (rel === 'js/app.js') {
      const body = bumped ? newApp : realApp;
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }); res.end(body); return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }); res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;

  const uctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const up = await uctx.newPage();
  up.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await up.addInitScript(() => localStorage.setItem('adt_onboarded', '1'));
  await seedContent(up);
  await up.goto(origin + '/index.html', { waitUntil: 'networkidle' });
  await up.evaluate(() => navigator.serviceWorker.ready);
  await up.reload({ waitUntil: 'networkidle' });
  await up.waitForSelector('.level-card');
  const before = await up.evaluate(() => APP_VERSION);

  bumped = true;                          // ab jetzt liegt „auf GitHub Pages" eine neue Fassung
  await up.evaluate(() => go('settings'));
  await up.waitForSelector('#btnUpdate');
  await up.click('#btnUpdate');
  await up.waitForSelector('.modal-overlay .modal-btn', { timeout: 25000 });
  const dlg = await up.textContent('.modal-card');
  chk(/99\.0\.0/.test(dlg), 'Update: neue Fassung wird erkannt und angeboten');

  await up.click('.modal-actions .modal-btn');    // „Jetzt aktualisieren"
  await up.waitForSelector('.level-card');
  const after = await up.evaluate(() => APP_VERSION);
  chk(before !== '99.0.0' && after === '99.0.0', 'Update: nach dem Neuladen läuft die neue Fassung (' + before + ' → ' + after + ')');

  // Und danach wieder offline-fähig – der aufgefrischte Cache muss vollständig sein
  await uctx.setOffline(true);
  let offOk = true;
  try { await up.reload({ waitUntil: 'domcontentloaded' }); await up.waitForSelector('.level-card', { timeout: 6000 }); }
  catch (_) { offOk = false; }
  chk(offOk, 'Update: App bleibt nach der Aktualisierung offline-fähig');
  await uctx.setOffline(false);
  await uctx.close();
  await new Promise((r) => server.close(r));
}

chk(errors.length === 0, 'keine Laufzeitfehler');
errors.forEach((e) => console.log('  ' + e));
await browser.close();
console.log(pass ? '\nOK: SW-/Offline-Test bestanden' : '\nSW-/Offline-Test fehlgeschlagen');
process.exit(pass ? 0 : 1);
