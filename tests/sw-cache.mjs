// Service-Worker-/Offline-Test (mit AKTIVEM Service Worker, anders als der e2e-Smoke,
// der ihn bewusst blockiert). Prüft: Registrierung, Precache, Kontrolle und – am
// wichtigsten – dass die App OFFLINE weiter aus dem Cache lädt.
// BASE via Umgebungsvariable (Default: http://localhost:8399/index.html).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');

const BASE = process.env.BASE || 'http://localhost:8399/index.html';
let pass = true;
const chk = (c, m) => { if (!c) { pass = false; console.log('FAIL: ' + m); } else console.log('ok:  ' + m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // SW erlaubt (Default)
const p = await ctx.newPage();
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
await ctx.setOffline(false);

chk(errors.length === 0, 'keine Laufzeitfehler');
errors.forEach((e) => console.log('  ' + e));
await browser.close();
console.log(pass ? '\nOK: SW-/Offline-Test bestanden' : '\nSW-/Offline-Test fehlgeschlagen');
process.exit(pass ? 0 : 1);
