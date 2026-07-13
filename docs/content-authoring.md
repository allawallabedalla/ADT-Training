# Lerninhalte erstellen — Bauplan (für lokales Claude Code)

Diese Anleitung beschreibt, wie aus **Quellmaterial** (Schulungs-PDFs/PowerPoint)
prüfbare Fragen entstehen. Ziel: **maximale Validität, volle Nachvollziehbarkeit,
kein Veröffentlichen vertraulicher Inhalte.**

## Grundregeln (Datenschutz)

- Roh-Dateien liegen **nur lokal** in `material/` (per `.gitignore` ausgeschlossen) — **nie** committen.
- Das erzeugte Inhalts-JSON ebenfalls in `material/` ablegen (z. B. `material/content.json`) → wird nicht committet.
- Fertige Inhalte gehen **gegated in Supabase** (`app_content`), **nicht** ins Repo.
- Ehrlich: Zum Umwandeln sieht das Claude-Modell den Text (API) — unvermeidbar bei KI-Verarbeitung.

## Anti-Halluzinations-Prozess (verbindlich)

1. **Nur aus der Quelle.** Keine Fakten aus Modellwissen ergänzen. Gibt eine Folie nichts her → keine Frage.
2. **Quellbeleg an JEDER Frage** (`source`): Datei + Fol/Abschnitt + möglichst wörtliches Zitat.
3. **Zweiter Prüf-Durchgang:** jede Frage *nur gegen ihr Quell-Snippet* prüfen — richtige Antwort gedeckt? Distraktoren eindeutig falsch?
4. **Unsicheres markieren, nicht raten** → separater „Bitte prüfen"-Stapel, nicht in die App.
5. **Freigabe-Liste** „Frage → richtige Antwort → Beleg" erzeugen; erst nach menschlicher Fachprüfung laden.
6. **Struktur automatisch prüfen:** `node tools/validate-content.mjs material/content.json` muss grün sein.

> Prompt-Kern fürs lokale Claude Code: *„Erzeuge Fragen ausschließlich aus den Folien in `material/`.
> Jede Frage braucht ein `source`-Feld mit Foliennummer und wörtlichem Zitat. Erfinde nichts. Markiere
> Unsicheres separat. Danach ein zweiter Durchgang, der jede Frage nur gegen ihr Zitat prüft."*

## Ausgabe-Format (`material/content.json`)

```json
{
  "TOPICS": {
    "grundlagen": { "name": "Grundlagen der Onkologie", "color": "#5b8def" }
  },
  "QUESTIONS": [
    {
      "id": "gr-101",
      "topic": "grundlagen",
      "difficulty": 2,
      "type": "single",
      "question": "Fragetext …",
      "options": ["A", "B", "C", "D"],
      "correct": [0],
      "explanation": "Warum A richtig ist (vermittelt den Inhalt).",
      "source": "Foliensatz Grundlagen, Folie 12: \"…wörtliches Zitat…\""
    },
    {
      "id": "tnm-201",
      "topic": "tnm",
      "difficulty": 2,
      "type": "numeric",
      "question": "Rechen-/Anwendungsaufgabe …",
      "answer": 30,
      "tolerance": 0,
      "unit": "Monate",
      "explanation": "Rechenweg …",
      "source": "Foliensatz TNM, Folie 5"
    }
  ]
}
```

**Feld-Regeln**
- `type`: `single` (genau 1 richtig) · `multi` (1+ richtig) · `numeric` (Zahl-Eingabe).
- Option-Typen: `options` (≥2) + `correct` (0-basierte Indizes). Numeric: `answer` (Zahl), optional `tolerance`, `unit`.
- `difficulty`: 1/2/3. `explanation`: ≥10 Zeichen, vermittelt den Inhalt.
- `source`: **Pflicht** — Datei + Folie (+ Zitat). Wird vom App-Client ignoriert, dient nur der Nachprüfbarkeit.
- `id`: stabil halten (der Lernfortschritt hängt daran). Präfix je Thema (z. B. `gr-…`, `tnm-…`).

## Prüfen (lokal, vor dem Laden)

```bash
node tools/validate-content.mjs material/content.json
```

Muss **OK** melden. Erst dann laden.

## In Supabase laden (nur das geprüfte JSON)

Einmalig muss `supabase/content-gate.sql` gelaufen sein (Tabellen + `get_content` + Zugangscode).
Dann die Inhalte upserten (JSON aus `material/content.json` einsetzen):

```sql
insert into public.app_content(id, data, updated_at)
values (1, $$ { "TOPICS": { ... }, "QUESTIONS": [ ... ] } $$::jsonb, now())
on conflict (id) do update set data = excluded.data, updated_at = now();
```

Test: `select public.get_content('DEIN-CODE');` → sollte das JSON zurückgeben.

## Scharfschalten

In `config.js` `contentGated: true` setzen und committen. Ab dann verlangt die App den
Zugangscode und lädt die Fragen aus Supabase (offline-fähig nach dem ersten Freischalten).
Die öffentlichen Beispiel-Fragen in `data/questions.js` können dann auf einen leeren
Platzhalter reduziert werden.
