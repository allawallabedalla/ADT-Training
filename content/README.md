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

1. **Nur aus der Quelle:** Der komplette Folieninhalt wurde erfasst; jede Frage
   ist an einer konkreten Folie belegt. Kein Fakt aus reinem Modellwissen.
2. **4-fache Text-Gegenprüfung:** Vier unabhängige Prüf-Durchgänge haben jede
   Frage gegen den Originaltext abgeglichen — Grundlagen/Lagemaße,
   Korrelation/Darstellung, Überlebenszeitanalyse **plus** eigenständige
   Nachrechnung aller Rechenaufgaben, sowie eine adversariale Gesamt-Prüfung
   aller 55 Fragen (Mehrdeutigkeit, falsche Distraktoren, Über-Interpretation,
   Zitat-Treue).
3. **5. Durchgang – visuelle Prüfung an den Original-Folien:** Alle 77 Seiten
   wurden als hochauflösende Bilder gerendert (`tools/pdf-to-images.py`,
   PyMuPDF) und jede Frage **direkt an der gerenderten Folie** gegengeprüft.
   Das fand Fehler, die reine Text-Extraktion nicht sehen konnte, u. a.:
   - **Folie 91:** ein fett gesetztes **„nicht"** war beim Text-Auslesen
     verlorengegangen — die Aussage war dadurch umgekehrt. In `dstat-d11`
     korrigiert (jetzt: „kann normalerweise **nicht** auf einen Zusammenhang
     geschlossen werden").
   - **Folie 8:** vierte Ausprägung des Schmerzempfindens heißt „schwach"
     (nicht „leicht") → `dstat-g04` an den Folientext angeglichen.
   - **Folie 15 statt 14** als Fundstelle der Lage-/Streumaß-Listen
     (`dstat-l02`), Begriff „scatter plot" (Folie 25) exakt übernommen.
   - Alle Rechen-Tabellen (Kaplan-Meier, Cutler-Ederer) Zahl für Zahl am
     gerenderten Raster bestätigt.
4. **Nur eindeutig Belegtes bleibt:** Eine Frage, deren Aussage der Folientext
   nicht eindeutig deckte (Skalenniveau intervall/verhältnis/absolut), wurde auf
   die im Skript zweifelsfrei belegte Kernaussage umgeschrieben.
5. **Struktur maschinell geprüft:** `node tools/validate-content.mjs content/deskriptive-statistik.json` → grün.

Der visuelle Weg (Folie als Bild lesen statt Text scrapen) ist ab jetzt das
Standardverfahren für alle künftigen Foliensätze — siehe `tools/pdf-to-images.py`
und `requirements-dev.txt`.

## Letzter Schritt vor dem Einsatz

Die Liste `deskriptive-statistik.md` ist für die **menschliche Fachprüfung**
gedacht. Erst nach Freigabe werden die Fragen in die App übernommen (entweder
direkt in `data/questions.js` als öffentliche Inhalte oder gegated in Supabase).

## Neu erzeugen der Lese-Liste

```bash
node tools/content-to-md.mjs content/deskriptive-statistik.json > content/deskriptive-statistik.md
```
