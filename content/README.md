# Geprüfte Lerninhalte (unkritisch, im Repo)

Hier liegen **fachlich unkritische** Frage-/Antwort-Listen, die direkt aus offen
verfügbarem Schulungsmaterial erzeugt und gegengeprüft wurden. Vertrauliche
Inhalte (aus internen Schulungs-PowerPoints) gehören **nicht** hierher, sondern
gegated in Supabase — siehe `docs/content-authoring.md`.

## Inhalt

| Datei | Zweck |
|---|---|
| `deskriptive-statistik.json` | Maschinenlesbare, mit `tools/validate-content.mjs` geprüfte Fragenliste (55 Fragen, 5 Themen). |
| `deskriptive-statistik.md` | Lesbare Freigabe-Liste „Frage → richtige Antwort → Beleg" für die menschliche Fachprüfung. Automatisch aus dem JSON erzeugt. |

## Quelle

Foliensatz **„Deskriptive Statistik in der Tumordokumentation"**
(Dr. Gerd Wegener, ADT-Netzwerk, Fortbildung in der Krebsregistrierung, 19.01.2026).
Jede Frage nennt in ihrem `source`-Feld die konkrete Folie samt Zitat.

## Wie Halluzinationen ausgeschlossen wurden

1. **Nur aus der Quelle:** Der komplette Folientext wurde extrahiert; jede Frage
   ist an einer konkreten Folie belegt. Kein Fakt aus reinem Modellwissen.
2. **4-fache Gegenprüfung:** Vier unabhängige Prüf-Durchgänge haben jede Frage
   gegen den Originaltext abgeglichen — je ein Durchgang für
   Grundlagen/Lagemaße, für Korrelation/Darstellung, für Überlebenszeitanalyse
   **plus** eigenständige Nachrechnung aller Rechenaufgaben, sowie ein
   adversariale Gesamt-Prüfung aller 55 Fragen (Mehrdeutigkeit, falsche
   Distraktoren, Über-Interpretation, Zitat-Treue).
3. **Nur eindeutig Belegtes bleibt:** Eine Frage, deren Aussage der Folientext
   nicht eindeutig deckte (Skalenniveau intervall/verhältnis/absolut), wurde auf
   die im Skript zweifelsfrei belegte Kernaussage umgeschrieben.
4. **Struktur maschinell geprüft:** `node tools/validate-content.mjs content/deskriptive-statistik.json` → grün.

## Letzter Schritt vor dem Einsatz

Die Liste `deskriptive-statistik.md` ist für die **menschliche Fachprüfung**
gedacht. Erst nach Freigabe werden die Fragen in die App übernommen (entweder
direkt in `data/questions.js` als öffentliche Inhalte oder gegated in Supabase).

## Neu erzeugen der Lese-Liste

```bash
node tools/content-to-md.mjs content/deskriptive-statistik.json > content/deskriptive-statistik.md
```
