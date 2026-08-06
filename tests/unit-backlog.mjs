// Unit-Tests für tools/reports-to-backlog.mjs – den Weg von „gemeldete Fragen" (Export aus
// der App) zum Backlog im Repo. Wichtig ist vor allem, dass beim Zusammenführen NICHTS
// verloren geht: Abgehaktes bleibt abgehakt, Handnotizen bleiben stehen.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseItems, mergeBacklog } = await import(path.join(root, 'tools/reports-to-backlog.mjs'));

let failures = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); failures++; } else console.log('ok:  ' + m); };

// So sieht der Export der App aus (reportsAsText)
const exp1 = `# Fragen-Backlog (gemeldete Fragen)

Stand: 05.08.2026, 14:32 · App 0.31.0
Offen: 2

## Offen

- [ ] **tnm-012** · TNM-Klassifikation (UICC) · gemeldet 05.08.2026
      Notiz: Antwort B ist auch richtig
      Frage: Wie viele Lymphknoten waren tumorfrei?
      Lösung: 15 Lymphknoten

- [ ] **gr-002** · Grundlagen · gemeldet 05.08.2026
      Frage: Welche Aussagen treffen zu?
`;

const items = parseItems(exp1);
ok(items.length === 2, 'parse: beide Einträge erkannt');
ok(items[0].id === 'tnm-012' && items[0].done === false, 'parse: ID und offener Zustand');
ok(items[0].lines.join('\n').includes('Notiz: Antwort B ist auch richtig'), 'parse: eingerückte Details gehören zum Eintrag');

// Erstes Zusammenführen: leeres Backlog + Export
const first = mergeBacklog('', exp1, '2026-08-05');
ok(first.added.length === 2 && first.open === 2, 'merge: erster Lauf übernimmt alles als offen');
ok(/## Offen[\s\S]*tnm-012[\s\S]*## Erledigt/.test(first.text), 'merge: Abschnitte Offen/Erledigt in der richtigen Reihenfolge');

// Eine Frage wurde abgehakt und von Hand kommentiert
const bearbeitet = first.text
  .replace('- [ ] **tnm-012**', '- [x] **tnm-012**')
  .replace('      Lösung: 15 Lymphknoten', '      Lösung: 15 Lymphknoten\n      → korrigiert in der Pipeline am 06.08.');

// Zweiter Export: dieselbe Frage ist in der App weiterhin gemeldet, dazu eine neue
const exp2 = exp1.replace('## Offen\n', '## Offen\n\n- [ ] **icd-007** · ICD-O-3 · gemeldet 06.08.2026\n      Frage: Neue Meldung\n');
const second = mergeBacklog(bearbeitet, exp2, '2026-08-06');
ok(second.added.length === 1 && second.added[0] === 'icd-007', 'merge: nur wirklich neue IDs kommen dazu');
ok(/## Erledigt[\s\S]*- \[x\] \*\*tnm-012\*\*/.test(second.text), 'merge: Abgehaktes bleibt abgehakt (kommt nicht als offen zurück)');
ok(second.text.includes('→ korrigiert in der Pipeline am 06.08.'), 'merge: Handnotiz im Backlog überlebt');
ok(second.open === 2, 'merge: offen = gr-002 + icd-007');
ok((second.text.match(/\*\*gr-002\*\*/g) || []).length === 1, 'merge: keine Dubletten');

// Aufgehobene Meldung: Eintrag bleibt im Backlog (erledigt wird durch Abhaken, nicht durch Verschwinden)
const third = mergeBacklog(second.text, '# leer\n\n## Offen\n\n(keine offenen Meldungen)\n', '2026-08-07');
ok(third.open === 2 && third.added.length === 0, 'merge: leerer Export löscht nichts');

console.log(failures === 0 ? '\nOK: alle Backlog-Tests bestanden' : `\n${failures} Backlog-Test(s) fehlgeschlagen`);
process.exit(failures === 0 ? 0 : 1);
