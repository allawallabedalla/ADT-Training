# Guideline: Aus vielen PDFs einen perfekten Fragen-Katalog (.js) erzeugen

Diese Anleitung reproduziert exakt das Verfahren, mit dem der TNM- und Statistik-
Katalog dieses Projekts entstanden ist: **streng quellengebunden, mit Folien-
Beleg an jeder Frage, mehrfach durch unabhängige Audit-Agenten geprüft.**
Sie ist als Copy-&-Paste-Ablauf für **lokales Claude Code** gedacht.

---

## 0) Voraussetzungen (einmalig)

```bash
pip install --quiet pymupdf pillow    # PDF rendern + Bild lesen
# Node ist für die Validierung nötig (bereits im Projekt vorhanden)
```

Lege deine Quell-PDFs unter `material/` ab (ist per .gitignore ausgeschlossen,
bleibt also lokal/vertraulich).

---

## 1) PDFs rendern + Text extrahieren (Grundlage für die Agenten)

```bash
python3 - <<'PY'
import fitz, os, glob
SRC = "material"                     # Ordner mit den PDFs
OUT = "scratch"                      # Arbeitsordner (nicht committen)
for pdf in glob.glob(f"{SRC}/*.pdf"):
    name = os.path.splitext(os.path.basename(pdf))[0]
    d = f"{OUT}/{name}"; os.makedirs(f"{d}/pages", exist_ok=True)
    doc = fitz.open(pdf); full=[]
    for i,p in enumerate(doc,1):
        full.append(f"\n===== PDF-SEITE {i} =====\n{p.get_text()}")
        p.get_pixmap(dpi=150).save(f"{d}/pages/p{i:03d}.png")
    open(f"{d}/fulltext.txt","w").write("".join(full))
    print(name, len(doc), "Seiten")
PY
```

**Wichtig:** PowerPoint-Export-PDFs zeigen oft **zwei Folien pro PDF-Seite**
(oben+unten). Die maßgebliche Nummer ist die **Fußzeilen-Foliennummer** unten
rechts auf jeder Folie — die wird zitiert, nicht der PDF-Seitenindex.

---

## 2) Zielformat (MUSS exakt so aussehen – „perfekt wie die anderen")

Eine `.js`-Datei nach dem Muster von `data/questions.js`:

```js
const XYZ_TOPICS = {
  thema_key: { name: "Anzeigename", icon: "📊", color: "#4a90a4" },
};

const XYZ_QUESTIONS = [
  {
    id: "xy-001",              // eindeutig, stabil, Präfix je Thema
    topic: "thema_key",         // muss in XYZ_TOPICS existieren
    difficulty: 2,              // 1 | 2 | 3
    type: "multi",              // "multi" (1+ richtig) | "single" | "numeric"
    question: "Fragetext …",
    options: ["A","B","C","D"], // multi/single: >=2, plausible FALSCHE Distraktoren
    correct: [0,2],             // 0-basierte Indizes der richtigen; >=1
    // statt options/correct bei numeric:
    // answer: 5, tolerance: 0, unit: "cm",
    explanation: "Warum richtig … 📄 Quelle: <Skript>, Folie N",
    source: "<Skript>, Folie N (Kapitel)",
  },
];

if (typeof window !== "undefined") {
  window.XYZ_SAMPLE = { TOPICS: XYZ_TOPICS, QUESTIONS: XYZ_QUESTIONS };
  window.XYZ_TOPICS = XYZ_TOPICS; window.XYZ_QUESTIONS = XYZ_QUESTIONS;
}
if (typeof module !== "undefined" && module.exports)
  module.exports = { XYZ_TOPICS, XYZ_QUESTIONS };
```

**Die 5 Pflicht-Parameter, die das Ergebnis „perfekt" machen:**
1. **`type` bevorzugt `multi` + `numeric`** (Prüfungsordnung: mehrere richtige
   Antworten + Rechenaufgaben). `single` nur, wenn wirklich genau eine passt.
2. **Sichtbarer Quellverweis am Ende jeder `explanation`:**
   `📄 Quelle: <Skript>, Folie N` — die Foliennummer aus der Fußzeile.
3. **`source`-Pflichtfeld** (Datei + Folie + Kapitel) für die Nachprüfbarkeit.
4. **Nur aus der Quelle** — kein Modellwissen ergänzen. Gibt eine Folie nichts
   Konkretes her (Titel/Diskussion), wird sie übersprungen.
5. **numeric ohne `options`/`correct`**, dafür `answer` (Zahl) + `tolerance`
   (+ `unit`). Bei Grenzwerten die Folien-Schreibweise (≤/<) exakt übernehmen.

**Abdeckungsregel:** Pro Folie mit konkretem Inhalt (T/N/M-Kriterien, Stadien,
Definitionen, Grenzwerte, Rechenbeispiele) **2–4 Fragen**, die ALLE Fakten der
Folie abdecken. Ziel ist 100 % Abdeckung.

---

## 3) Entwurf parallelisieren (mehrere Zeichen-Agenten nach Kapiteln)

Bei großen PDFs die Folien in Blöcke aufteilen und je Block einen Agenten
starten. Prompt-Vorlage (pro Block anpassen: Seitenbereich, Kapitel, Ausgabedatei):

> Entwirf Prüfungsfragen STRENG aus den gerenderten Folien
> `scratch/<name>/pages/pNNN.png`, Seiten **pAAA bis pBBB**. Nutze
> AUSSCHLIESSLICH Sichtbares; ergänze nichts aus eigenem Wissen; überspringe
> reine Titel-/Diskussionsfolien. Für jede Folie mit konkretem Inhalt 2–4 Fragen
> (bevorzugt `multi` + `numeric`), die ALLE Fakten abdecken. Zitiere die
> Fußzeilen-Foliennummer. Schreibe ein gültiges JSON-Array (Schema wie oben,
> `explanation` endet mit `📄 Quelle: <Skript>, Folie N`) nach
> `scratch/gen/<block>.json`. KEINE Markdown-Fences. Antworte mit einer Zeile:
> Anzahl Fragen + Themen + übersprungene Folien mit Grund.

Danach alle Block-JSONs zusammenführen und in die `.js`-Hülle (Abschnitt 2) gießen.

---

## 4) DREI unabhängige Audit-Agenten (jede Frage gegenprüfen)

Starte **3 Agenten unabhängig** mit identischem Auftrag (Triangulation). Jeder
prüft **alle** Fragen auf **(1) Korrektheit** und **(2) vollständige Abdeckung**:

> Du bist UNABHÄNGIGER PRÜFER. Beurteile NUR nach den Folien, kein Außenwissen.
> Eingaben: Katalog `<pfad>.js` (oder das JSON), Folienbilder
> `scratch/<name>/pages/pNNN.png` (Fußzeilennummer = Folie), Volltext
> `scratch/<name>/fulltext.txt`.
> AUFGABE 1 – Korrektheit: Gehe JEDE Frage durch. Verifiziere über den Volltext
> (Schlüsselbegriffe der zitierten Folie), bei Zahlen/Tabellen/Grenzwerten das
> Folienbild öffnen. Prüfe: ist die als richtig markierte Antwort durch die Folie
> gedeckt? numeric-Zahl korrekt? Sind die Distraktoren wirklich falsch (nicht
> versehentlich auch richtig)? Halluzinationen? Achte besonders auf vertauschte
> cm/mm-Grenzen, falsche Stadien-Zuordnung, falsche correct-Indizes, Zahlendreher.
> AUFGABE 2 – Abdeckung: Liste jede Folie mit konkretem Inhalt OHNE zugehörige
> Frage.
> AUSGABE: JSON nach `scratch/verify/vN.json`:
> `{"wrong":[{"id","problem","suggestedFix","severity"}],"coverageGaps":[{"source","missingTopic"}],"summary":"…"}`.
> Melde eine Frage nur als falsch, wenn gegen die Quelle verifiziert.

**Wichtige Parameter für die Audit-Agenten:**
- **Unabhängig** (kein gemeinsamer Kontext) → echte Triangulation.
- **Bild-Pflicht bei allen numerics, Grenzwerten und Stadientabellen** (der
  reine Textextrakt verwechselt oft `≤`/`<` und verstümmelt Tabellen).
- Nur **verifizierte** Funde melden, mit Folienbeleg + Schweregrad.

---

## 5) Konsolidieren, korrigieren, validieren

- Alle drei `vN.json` einsammeln. Ein Fund, den **≥1 Agent belegt**, wird am
  Original geprüft und korrigiert; Abdeckungslücken mit neuen, belegten Fragen
  schließen.
- **Quelltreue vor „Richtigstellung":** enthält das Skript selbst einen Fehler
  (z. B. falsche Rundung/Stadien-Dublette), wird der Skriptwert übernommen und in
  der `explanation` transparent vermerkt — nicht stillschweigend „korrigiert".
- Struktur prüfen (das Projekt bringt zwei Validatoren mit):
  ```bash
  node tools/validate-content.mjs material/content.json   # für { TOPICS, QUESTIONS }
  node tests/validate-questions.mjs                        # für data/questions.js
  ```
  Muss **grün** sein (eindeutige IDs, numeric ohne options/correct, jede Frage
  mit `source`, gültige correct-Indizes).

---

## 6) In die App (vertraulich → gegated)

Geheime, aus PDFs erzeugte Inhalte gehören **nicht** ins öffentliche
`data/questions.js`, sondern gegated nach Supabase:
1. `material/content.json` (`{ TOPICS, QUESTIONS }`) erzeugen und validieren.
2. `supabase/content-gate.sql` einmalig ausführen; Zugangscode setzen
   (`update public.content_gate set code_hash = 'DEIN-CODE' where id = 1;`).
   Der Gate vergleicht den Code als **Klartext** (kein pgcrypto nötig,
   Supabase-kompatibel); Mindestlänge laut Funktion 4 Zeichen.
3. Upsert nach `public.app_content` (siehe `material/go-live.sql`-Muster).
4. In `config.js` `contentGated: true` setzen.

---

### Checkliste „perfekt wie die anderen"
- [ ] Nur aus der Quelle, keine Halluzination
- [ ] Jede Frage: `source` + sichtbares `📄 Quelle: …, Folie N`
- [ ] Bevorzugt `multi` + `numeric`, plausible Distraktoren
- [ ] 2–4 Fragen je Inhaltsfolie → 100 % Abdeckung
- [ ] 3 unabhängige Audit-Agenten, Bild-Pflicht bei Zahlen/Tabellen
- [ ] Validator grün
