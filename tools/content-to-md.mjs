// Erzeugt aus einer geprüften Inhalts-Datei { TOPICS, QUESTIONS } eine lesbare
// Freigabe-Liste „Frage → richtige Antwort → Beleg“ (Markdown) für die
// menschliche Fachprüfung. Rein deskriptiv – ändert keine Inhalte.
//
// Nutzung:  node tools/content-to-md.mjs content/deskriptive-statistik.json > content/deskriptive-statistik.md
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Nutzung: node tools/content-to-md.mjs <datei.json>'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const { TOPICS, QUESTIONS } = doc;

const typeLabel = { single: 'Einfachauswahl', multi: 'Mehrfachauswahl', numeric: 'Rechenaufgabe' };
const out = [];
out.push('# Deskriptive Statistik — Freigabe-Liste (Frage → Antwort → Beleg)');
out.push('');
out.push('> Automatisch aus `content/deskriptive-statistik.json` erzeugt – **nicht** von Hand bearbeiten.');
out.push('> Neu erzeugen mit: `node tools/content-to-md.mjs content/deskriptive-statistik.json > content/deskriptive-statistik.md`');
out.push('>');
out.push('> Jede Frage stammt ausschließlich aus dem Foliensatz „Deskriptive Statistik in der');
out.push('> Tumordokumentation" (Dr. Gerd Wegener, ADT-Netzwerk, 19.01.2026) und wurde in einer');
out.push('> Gegenprüfung mit 4 unabhängigen Prüf-Durchgängen gegen den Originaltext abgeglichen.');
out.push('');
out.push(`**Umfang:** ${QUESTIONS.length} Fragen in ${Object.keys(TOPICS).length} Themen.`);
out.push('');

const byTopic = {};
for (const q of QUESTIONS) (byTopic[q.topic] ||= []).push(q);

for (const [key, topic] of Object.entries(TOPICS)) {
  const qs = byTopic[key] || [];
  out.push(`## ${topic.name}  _(${qs.length} Fragen)_`);
  out.push('');
  for (const q of qs) {
    out.push(`### ${q.id} — ${typeLabel[q.type] || q.type} · Schwierigkeit ${q.difficulty}`);
    out.push('');
    out.push(`**Frage:** ${q.question}`);
    out.push('');
    if (q.type === 'numeric') {
      const tol = q.tolerance ? ` (±${q.tolerance})` : '';
      const unit = q.unit ? ` ${q.unit}` : '';
      out.push(`**Richtige Antwort:** \`${q.answer}${unit}\`${tol}`);
    } else {
      out.push('**Optionen:**');
      q.options.forEach((opt, i) => {
        const mark = q.correct.includes(i) ? ' ✅' : '';
        out.push(`- ${opt}${mark}`);
      });
    }
    out.push('');
    out.push(`**Erklärung:** ${q.explanation}`);
    out.push('');
    out.push(`**Beleg:** ${q.source}`);
    out.push('');
    out.push('---');
    out.push('');
  }
}

process.stdout.write(out.join('\n'));
