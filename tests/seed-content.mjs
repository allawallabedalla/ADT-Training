/*
 * Testhilfe: Zugangsschutz neutralisieren.
 * ------------------------------------------------------------------
 * Seit `contentGated: true` (v0.29.0) verlangt die App beim Start einen Zugangscode –
 * ohne freigeschaltete Inhalte kommt sie nie bis zur Startseite, und JEDER Browser-Test
 * würde am Freischalt-Bildschirm hängen. Für die Tests hinterlegen wir deshalb den
 * öffentlichen BEISPIEL-Katalog aus `data/questions.js` als „freigeschaltete" Inhalte.
 * Die App verhält sich damit exakt wie vor der Aktivierung des Schutzes – der
 * Schutzmechanismus selbst wird weiterhin separat getestet (e2e-smoke, Abschnitt „Gate").
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// data/questions.js in einer Mini-Umgebung auswerten – es legt window.ADT_SAMPLE an.
export function sampleContent() {
  const src = fs.readFileSync(path.join(root, 'data/questions.js'), 'utf8');
  const win = { localStorage: { getItem: () => null } };
  new Function('window', src)(win);
  if (!win.ADT_SAMPLE || !Array.isArray(win.ADT_SAMPLE.QUESTIONS)) throw new Error('Beispielkatalog nicht gefunden');
  return win.ADT_SAMPLE;
}

export const CONTENT_KEY = 'adt_content_v1';

// Vor dem ersten Skript der Seite ausführen: Beispielkatalog als freigeschaltet ablegen.
export async function seedContent(page) {
  await page.addInitScript(
    ([key, content]) => localStorage.setItem(key, JSON.stringify(content)),
    [CONTENT_KEY, sampleContent()],
  );
}
