# Runbook für dein lokales LLM — PDFs → Supabase-fertiger Fragenkatalog

> **So benutzt du das:** Kopiere den gesamten Text unterhalb der Linie und gib
> ihn deinem lokalen Claude Code als Auftrag. Lege vorher alle PDFs in den Ordner
> `material/`. Das LLM arbeitet die PDFs **nacheinander** ab, erfasst **jedes
> Detail**, prüft alles dreifach und legt am Ende `material/content.json` +
> `material/supabase-komplett.sql` an — die SQL-Datei lädst du direkt in Supabase.

---

## AUFTRAG AN DAS LOKALE LLM (ab hier alles kopieren)

Du erzeugst aus allen PDFs im Ordner `material/` **einen einzigen, streng
quellengebundenen Prüfungs-Fragenkatalog** und bereitest ihn Supabase-fertig auf.
Halte dich exakt an dieses Verfahren. **Erfinde nichts** — jede Aussage muss auf
einer Folie stehen.

### Schritt 0 — Werkzeuge
```bash
pip install --quiet pymupdf pillow
mkdir -p scratch gen verify
```

### Schritt 1 — Alle PDFs rendern + Text extrahieren (einmal für alle)
```bash
python3 - <<'PY'
import fitz, os, glob
for pdf in sorted(glob.glob("material/*.pdf")):
    name=os.path.splitext(os.path.basename(pdf))[0]
    d=f"scratch/{name}"; os.makedirs(f"{d}/pages",exist_ok=True)
    doc=fitz.open(pdf); full=[]
    for i,p in enumerate(doc,1):
        full.append(f"\n===== PDF-SEITE {i} =====\n{p.get_text()}")
        p.get_pixmap(dpi=150).save(f"{d}/pages/p{i:03d}.png")
    open(f"{d}/fulltext.txt","w").write("".join(full))
    print(name, len(doc), "Seiten gerendert")
PY
```
Merke: PowerPoint-Export-PDFs zeigen oft **zwei Folien pro Seite** (oben+unten).
Maßgeblich ist die **Fußzeilen-Foliennummer** unten rechts auf jeder Folie — die
wird als Quelle zitiert, nicht der PDF-Seitenindex.

### Schritt 2 — PDFs NACHEINANDER verarbeiten (jedes Detail erfassen)
Arbeite die PDFs **eine nach der anderen** ab. Für das aktuelle PDF:

a) **Sieh dir JEDE gerenderte Folie als Bild an** (nicht nur den Textextrakt —
   der verstümmelt Formeln, Tabellen, Grenzwerte ≤/< und Stadientabellen).
b) Für **jede Folie mit konkretem Inhalt** (T/N/M-Kriterien, Stadien,
   Definitionen, Regeln, Zahlen/Grenzwerte, Rechenbeispiele, Teilnehmerfragen
   mit Antwort) erstelle **2–4 Fragen, die ALLE Fakten der Folie abdecken**.
   Reine Titel-/Diskussions-/Wiederholungsfolien ohne konkrete Kriterien werden
   übersprungen (und im Protokoll mit Grund vermerkt).
c) Bei großen PDFs die Folien in Blöcke aufteilen und je Block einen
   **Unter-Agenten** starten (parallel), der nur seinen Seitenbereich bearbeitet
   und sein JSON nach `gen/<pdf>_<block>.json` schreibt.

**Fragen-Schema (JSON-Objekt) — genau so:**
```json
{
  "id": "kürzel-001",
  "topic": "themen_key",
  "difficulty": 2,
  "type": "multi",
  "question": "Fragetext …",
  "options": ["A","B","C","D"],
  "correct": [0,2],
  "explanation": "Begründung … 📄 Quelle: <PDF-Kurzname>, Folie N",
  "source": "<PDF-Kurzname>, Folie N (Kapitel)"
}
```
- `type`: **bevorzugt `multi`** (eine ODER mehrere richtig) **und `numeric`**
  (Größen-/Anzahl-Grenzwerte). `single` nur, wenn wirklich genau eine passt.
- Bei `numeric`: statt `options`/`correct` die Felder `answer` (Zahl),
  `tolerance` (Zahl), `unit` (z. B. "cm"/"mm"/""). **Keine** `options`/`correct`.
- `correct`: 0-basierte Indizes der richtigen Optionen (≥ 1). Distraktoren müssen
  eindeutig FALSCH sein.
- **Pflicht:** `explanation` endet mit `📄 Quelle: <PDF>, Folie N` (sichtbarer
  Mini-Verweis) **und** das `source`-Feld nennt PDF + Folie + Kapitel.
- Grenzwert-Schreibweise (≤/<) **exakt** wie auf der Folie übernehmen.
- IDs eindeutig, stabiles Präfix je Themengebiet.

`topic`-Schlüssel selbst vergeben und in `TOPICS` definieren (Name, icon, color).

### Schritt 3 — DREI unabhängige Audit-Agenten (jede Frage gegenprüfen)
Wenn alle PDFs entworfen sind, starte **3 Agenten unabhängig** (kein gemeinsamer
Kontext, echte Triangulation), jeder mit identischem Auftrag über **alle** Fragen:

> Du bist UNABHÄNGIGER PRÜFER. Beurteile NUR nach den Folien, kein Außenwissen.
> Prüfe ALLE Fragen. AUFGABE 1 (Korrektheit): Verifiziere jede Frage über den
> Volltext `scratch/<pdf>/fulltext.txt`; bei Zahlen, Grenzwerten und
> Stadientabellen ZWINGEND das Folienbild `scratch/<pdf>/pages/pNNN.png` öffnen.
> Prüfe: Ist die als richtig markierte Antwort durch die Folie gedeckt?
> numeric-Zahl korrekt? Distraktoren wirklich falsch? Halluzinationen? Achte auf
> vertauschte cm/mm-Grenzen, falsche Stadien-Zuordnung, falsche correct-Indizes,
> Zahlendreher. AUFGABE 2 (Abdeckung): Liste jede Folie mit konkretem Inhalt OHNE
> Frage. AUSGABE als JSON nach `verify/vN.json`:
> `{"wrong":[{"id","problem","suggestedFix","severity"}],"coverageGaps":[{"source","missingTopic"}],"summary":""}`.
> Melde eine Frage nur als falsch, wenn du sie gegen die Quelle verifiziert hast.

### Schritt 4 — Konsolidieren, korrigieren, Lücken schließen
- Sammle `verify/v1..v3.json`. Jeden von **≥ 1 Agent belegten** Fund am Original
  (Folienbild) prüfen und korrigieren. Für jede gemeldete Abdeckungslücke neue,
  belegte Fragen ergänzen.
- **Quelltreue vor „Richtigstellung":** Enthält ein Skript selbst einen Fehler
  (falsche Rundung, doppelte Stadienzeile o. ä.), übernimm den Skriptwert und
  vermerke das transparent in der `explanation` — nicht stillschweigend ändern.

### Schritt 5 — Zusammenführen + validieren
```bash
node - <<'JS'
const fs=require("fs"),glob=require("fs").readdirSync("gen").filter(f=>f.endsWith(".json"));
let Q=[]; for(const f of glob) Q=Q.concat(JSON.parse(fs.readFileSync("gen/"+f,"utf8")));
// numeric bereinigen + fehlende source aus explanation ableiten
for(const q of Q){
  if(q.type==="numeric"){delete q.options;delete q.correct;if(q.tolerance==null)q.tolerance=0;}
  if(!q.source){const m=(q.explanation||"").match(/📄 Quelle:\s*(.+)$/);if(m)q.source=m[1].trim();}
}
const TOPICS = /* HIER deine TOPICS-Definition einsetzen */ {};
fs.writeFileSync("material/content.json",JSON.stringify({TOPICS,QUESTIONS:Q},null,1)+"\n");
console.log("Fragen:",Q.length);
JS
node tools/validate-content.mjs material/content.json   # MUSS grün sein
```
Der Validator erzwingt: eindeutige IDs, gültige `type`/`difficulty`, `numeric`
ohne `options`/`correct`, gültige `correct`-Indizes, **`source` an jeder Frage**.
Erst weitermachen, wenn **OK**.

### Schritt 6 — Supabase-fertiges Komplett-Skript erzeugen
Der Zugangs-Gate im Projekt ist bewusst **Klartext** (kein pgcrypto/kein
digest → in jedem Supabase-Projekt lauffähig). `get_content` vergleicht den
Code direkt (`p_code != stored_code`), Mindestlänge 4 Zeichen.
```bash
node - <<'JS'
const fs=require("fs");
const doc=JSON.parse(fs.readFileSync("material/content.json","utf8"));
const payload=JSON.stringify({TOPICS:doc.TOPICS,QUESTIONS:doc.QUESTIONS});
const CODE="DEIN-LANGER-CODE";   // <-- ändern (>= 4 Zeichen; lieber lang & zufällig)
const sql=`create table if not exists public.app_content (id int primary key default 1, data jsonb not null, updated_at timestamptz not null default now(), constraint app_content_one_row check (id=1));
create table if not exists public.content_gate (id int primary key default 1, code_hash text not null, constraint content_gate_one_row check (id=1));
alter table public.app_content enable row level security;
alter table public.content_gate enable row level security;
create or replace function public.get_content(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare stored_code text; begin
  if p_code is null or length(p_code) < 4 then raise exception 'unauthorized'; end if;
  select code_hash into stored_code from public.content_gate where id=1;
  if stored_code is null or p_code != stored_code then raise exception 'unauthorized'; end if;
  return (select data from public.app_content where id=1);
end; $$;
revoke all on function public.get_content(text) from public;
grant execute on function public.get_content(text) to anon, authenticated;
insert into public.content_gate(id,code_hash) values (1, '${CODE}') on conflict (id) do update set code_hash=excluded.code_hash;
insert into public.app_content(id,data,updated_at) values (1, $adt$${payload}$adt$::jsonb, now()) on conflict (id) do update set data=excluded.data, updated_at=now();
select public.get_content('${CODE}') is not null as funktioniert, jsonb_array_length((public.get_content('${CODE}'))->'QUESTIONS') as anzahl_fragen;`;
fs.writeFileSync("material/supabase-komplett.sql",sql);
console.log("supabase-komplett.sql geschrieben, Code:",CODE);
JS
```

### Ergebnis
- `material/content.json` — validierter Katalog (bleibt lokal, gitignore).
- `material/supabase-komplett.sql` — **im Supabase SQL-Editor einfügen und
  ausführen** (idempotent). Der Test am Ende gibt `funktioniert = true` und die
  Fragenanzahl. Danach in der App den gesetzten Code eingeben.

### Abnahme-Checkliste (alles erfüllt = „perfekt")
- [ ] Jede Inhaltsfolie jedes PDFs hat 2–4 Fragen (100 % Abdeckung), Titel-/
      Diskussionsfolien dokumentiert übersprungen
- [ ] Nur aus der Quelle, keine Halluzination; Grenzwerte ≤/< folientreu
- [ ] Bevorzugt `multi` + `numeric`, plausible falsche Distraktoren
- [ ] Jede Frage: `source` + sichtbares `📄 Quelle: …, Folie N`
- [ ] 3 unabhängige Audit-Agenten mit Bild-Pflicht bei Zahlen/Tabellen; alle
      Funde abgearbeitet
- [ ] `node tools/validate-content.mjs material/content.json` = OK
- [ ] `material/supabase-komplett.sql` erzeugt und getestet
