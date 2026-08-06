/*
 * Gemeldete Fragen → Backlog im Repo
 * ------------------------------------------------------------------
 * Die App (Einstellungen → Gemeldete Fragen → „Als Datei") exportiert die Meldungen
 * bereits als Markdown-Backlog mit Kästchen. Dieses Werkzeug führt so einen Export mit
 * `docs/fragen-backlog.md` zusammen, damit die Arbeitsliste im Repo mitwächst:
 *
 *   node tools/reports-to-backlog.mjs ~/Downloads/adt-trainer-gemeldete-fragen-2026-08-05.md
 *   node tools/reports-to-backlog.mjs <export.md> --out docs/fragen-backlog.md
 *
 * Regeln (bewusst einfach und verlustfrei):
 *   - Neue Frage-IDs kommen unter „Offen" dazu.
 *   - Bereits abgehakte Einträge (`- [x]`) bleiben abgehakt und wandern nach „Erledigt" –
 *     auch wenn die Frage in der App noch gemeldet ist.
 *   - Vorhandene Einträge werden NICHT überschrieben: handschriftliche Ergänzungen im
 *     Backlog bleiben stehen.
 *   - Nichts verschwindet von allein. Ist eine Meldung in der App aufgehoben worden,
 *     bleibt der Eintrag hier – erledigt wird er durchs Abhaken.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ITEM_RE = /^- \[([ xX])\]\s+\*\*(.+?)\*\*/;

// Markdown in Einträge zerlegen: ein Eintrag reicht von seiner Kästchen-Zeile bis zur
// nächsten Kästchen-Zeile oder Überschrift.
export function parseItems(md) {
  const lines = String(md || "").split(/\r?\n/);
  const items = [];
  let cur = null;
  const flush = () => {
    if (!cur) return;
    while (cur.lines.length && !cur.lines[cur.lines.length - 1].trim()) cur.lines.pop();
    items.push(cur);
    cur = null;
  };
  for (const line of lines) {
    const m = ITEM_RE.exec(line);
    if (m) { flush(); cur = { id: m[2].trim(), done: m[1].toLowerCase() === 'x', lines: [line] }; continue; }
    if (/^#{1,6}\s/.test(line)) { flush(); continue; }
    if (cur) cur.lines.push(line);
  }
  flush();
  return items;
}

export function renderBacklog(open, done, stamp) {
  const out = [
    '# Fragen-Backlog',
    '',
    '> Arbeitsliste der in der App als **fragwürdig** gemeldeten Fragen.',
    '> Aktualisieren: `node tools/reports-to-backlog.mjs <export.md>`',
    '> (Export kommt aus der App: Einstellungen → Gemeldete Fragen → „Als Datei").',
    '',
    `Zuletzt aktualisiert: ${stamp} · offen: ${open.length} · erledigt: ${done.length}`,
    '',
    '## Offen',
    '',
  ];
  if (open.length) for (const it of open) out.push(...it.lines, '');
  else out.push('(nichts offen)', '');
  out.push('## Erledigt', '');
  if (done.length) for (const it of done) out.push(...it.lines, '');
  else out.push('(noch nichts erledigt)', '');
  return out.join('\n');
}

// Kern: bestehendes Backlog + frischer Export → neues Backlog.
export function mergeBacklog(existingMd, exportMd, stamp) {
  const existing = parseItems(existingMd);
  const incoming = parseItems(exportMd);
  const known = new Set(existing.map((i) => i.id));
  const merged = existing.concat(incoming.filter((i) => !known.has(i.id)));   // Bestand gewinnt
  return {
    text: renderBacklog(merged.filter((i) => !i.done), merged.filter((i) => i.done), stamp),
    added: incoming.filter((i) => !known.has(i.id)).map((i) => i.id),
    total: merged.length,
    open: merged.filter((i) => !i.done).length,
  };
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : path.join(root, 'docs/fragen-backlog.md');
  const src = args.filter((a, i) => a !== '--out' && i !== outIdx + 1)[0];
  if (!src) {
    console.error('Nutzung: node tools/reports-to-backlog.mjs <export.md> [--out docs/fragen-backlog.md]');
    process.exit(2);
  }
  let exportMd;
  try { exportMd = fs.readFileSync(src, 'utf8'); }
  catch (e) { console.error('Export nicht lesbar: ' + e.message); process.exit(2); }
  const existing = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const stamp = new Date().toISOString().slice(0, 10);
  const res = mergeBacklog(existing, exportMd, stamp);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, res.text);
  console.log(`${path.relative(root, out)}: ${res.added.length} neu, ${res.open} offen, ${res.total} gesamt`);
  if (res.added.length) console.log('  neu: ' + res.added.join(', '));
}
