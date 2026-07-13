# Abarbeitungsstrategie – ADT Trainer

> Ziel: den kompletten Backlog **sukzessive, robust und fachlich korrekt** abarbeiten.
> Tempo ist zweitrangig – jede Änderung wird sauber getestet und dokumentiert.
> Grundlage: `workbook.md` (Backlog) und `docs/experten-workshop-2026-07-13.md` (Befunde).

## 1. Leitprinzipien
1. **Makellose Funktion vor Umfang.** Kein Push ohne bestandene Tests.
2. **Klein & reversibel.** Jede Einheit ist ein kleiner, in sich abgeschlossener, testbarer Commit.
3. **Sicherheitsnetz zuerst.** Automatische Tests laufen vor jeder Auslieferung.
4. **Korrektheit hat Vorrang** (besonders Fachinhalt) – im Zweifel konservativ + Quelle.
5. **Keine neuen Risiken einschleusen** ohne sie zu benennen (Kosten/Recht/Security/Usability).
6. **Leitplanken:** kostenlos · nur wenige Personen · Robustheit & Usability zählen.

## 2. Sicherheitsnetz (Test-Infrastruktur, `tests/`)
- `tests/validate-questions.mjs` – prüft die Fragen-Datenbank (IDs eindeutig, Themen gültig,
  correct-Indizes im Bereich, single=genau 1, Erklärungen vorhanden, difficulty gültig).
- `tests/unit-sync.mjs` – Unit-Tests der reinen Logik in `js/sync.js` (Merge, Code-Erzeugung/
  -Normalisierung, Header-Logik beider Schlüsseltypen, overwriteRemote, Offline/Pending).
- `tests/e2e-smoke.mjs` – End-to-End im Browser (Playwright, Service Worker aus): App lädt
  fehlerfrei, Quiz-Ablauf, **Reset leert wirklich** (Regression), Backup-Import mergt,
  Settings/Info rendern – jeweils ohne Laufzeitfehler.
- `tests/run.sh` – Runner: `node --check` aller JS → Fragen-Validierung → Unit → E2E.
- Ausführen: `bash tests/run.sh`. **Grün = auslieferbar.**
- Wächst mit: **jeder Bugfix bekommt einen Regressionstest**, jedes neue Feature einen Test.

## 3. Arbeitszyklus je Backlog-Punkt (Definition of Done)
1. **Verstehen** – Befund im Bericht/Backlog + betroffene Codestellen identifizieren.
2. **Schneiden** – kleinste sinnvolle Änderung festlegen.
3. **Test zuerst** – Soll-Zustand als Test formulieren (bei Bugfix: Test, der vorher rot wäre).
4. **Umsetzen.**
5. **Prüfen** – `bash tests/run.sh` grün; bei UI zusätzlich Screenshot Light **und** Dark, Konsole fehlerfrei.
6. **Risiko-Check** – bringt die Änderung neue Kosten/Recht/Security/Usability-Risiken? Kurz notieren.
7. **Dokumentieren** – `changelog.md` (+ ggf. `workbook.md`/`pitch.md`); bei Client-Änderung
   `APP_VERSION` und SW-`CACHE` erhöhen (bis Cache-Robustheit umgesetzt ist).
8. **Ausliefern** – kleiner, beschreibender Commit → push Feature-Branch **und** `main`.
9. **Abhaken** – Backlog-Punkt in `workbook.md` auf ✅.

## 4. Phasenplan (Reihenfolge)
- **Phase 0 – Sicherheitsnetz:** Test-Infrastruktur im Repo (dieser Schritt). ⭐ zuerst.
- **Phase 1 – Quick Wins** (Usability & Robustheit) → Release v0.7.0.
- **Phase 2 – RPC-Härtung + leichter Datenschutz-Hinweis** (schließt die Cloud/Push-Fläche) → v0.8.0.
- **Phase 3 – Modul-Split + Unit-Tests der Kernlogik** (Sicherheitsnetz vertiefen) → v0.9.0.
- **Phase 4 – Große P1-Features**, je eigenes getestetes Release:
  Fragetyp-Abstraktion → echter Prüfungsmodus (+ Session-Persistenz) → Spaced Repetition + Mastery
  → Anwendungs-/Rechenaufgaben → Quiz-Barrierefreiheit.
- **Phase 5 – P2** (Onboarding/Tagesziel, faire Streak, Zurück-Navigation, Cache-Robustheit,
  Item-Überarbeitung, Badge-Rebalancing).
- **Phase 6 – P3 / Cleanup** (Kleinbefunde, Konfidenz-Kalibrierung, Datenschutz-Feinheiten).
- **Laufend:** fachliche Gesamt-Review + Content-Ausbau, sobald Material vorliegt.

## 5. Umgang mit Fachinhalt (Korrektheit)
- Fachliche Änderungen nur mit belastbarer Begründung (Klassifikation/Regel benennen).
- Editionsstand fixieren (TNM 8. Aufl., ICD-O-3, ICD-10-GM, oBDS-Terminologie).
- Unsichere Punkte (z. B. CUP-Kode, pM0) als „zu verifizieren" markieren, nicht raten;
  wo möglich mit offiziellem Material/Nico gegenprüfen.

## 6. Fortschritt sichtbar halten
- `changelog.md` = Chronik. `workbook.md` = lebender Backlog (Haken setzen).
- Pro Release kurze Zusammenfassung im Chat + Screenshots.
