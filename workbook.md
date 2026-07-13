# Workbook — Zusammenarbeit & Backlog

> Das „Betriebshandbuch" unseres Projekts: **wie** wir zusammenarbeiten, **was**
> als Nächstes ansteht (Backlog) und **welche Entscheidungen** wir getroffen haben.
> Wird laufend gepflegt.
> Stand: 2026-07-13

---

## 1. Wer macht was

- **Nico** — gibt die Richtung vor, liefert Fachinhalte (Kursunterlagen, Beispielfragen),
  priorisiert das Backlog, testet auf dem echten iPhone.
- **Claude** — baut, testet und dokumentiert; pflegt `changelog.md`, `pitch.md` und
  dieses Workbook; schlägt Verbesserungen vor.

## 2. Spielregeln der Zusammenarbeit

- **Sprache:** Deutsch (Code-Kommentare & UI ebenfalls Deutsch).
- **Fachliche Korrektheit hat Vorrang.** Fragen/Antworten müssen stimmen; im Zweifel
  konservativ und mit Quelle/Standard (TNM/UICC, ICD-O-3, ICD-10, ADT/GEKID-Basisdatensatz,
  SGB V). Lieber weniger, dafür korrekte Fragen.
- **Jede Änderung wird getestet**, bevor sie gepusht wird (Syntaxcheck, Fragen-Validierung,
  Browser-Durchlauf via Playwright — keine Laufzeitfehler).
- **Nach jeder Änderung** werden `changelog.md` und – falls relevant – `pitch.md`
  aktualisiert.
- **Kein ungefragtes Pushen auf `main`** und **kein ungefragter Pull Request**.
- **Robustheit vor Funktionsumfang:** Die App darf nicht abstürzen und keinen
  Fortschritt verlieren.

## 3. Projekt-Fakten

| | |
|---|---|
| **Repository** | `allawallabedalla/ADT-Training` |
| **Arbeits-Branch** | `claude/adt-training-app-ios-3kmiak` |
| **App-Code** | Repository-**Root** (`index.html`, `css/`, `js/`, `data/`, `icons/`, `sw.js`, `manifest.webmanifest`) |
| **Hosting** | GitHub Pages (statisch, HTTPS) — Quelle: gewählter Branch + Ordner `/(root)` |
| **Live-URL (geplant)** | `https://allawallabedalla.github.io/ADT-Training/` |
| **Fachinhalte pflegen** | `data/questions.js` |
| **Version** | 0.1.0 (siehe `changelog.md`) |

## 4. Definition of Done (pro Änderung)

- [ ] Fachlich geprüft (bei Inhalten)
- [ ] `node --check` ok + Fragen-Validierung ok
- [ ] Browser-Durchlauf ohne Laufzeitfehler
- [ ] Offline-Betrieb weiterhin intakt (Service-Worker-Dateiliste aktuell, Cache-Version ggf. erhöht)
- [ ] `changelog.md` (und ggf. `pitch.md`) aktualisiert
- [ ] Auf Arbeits-Branch committet & gepusht

---

## 5. Backlog

Priorisierung: **P1** = als Nächstes sinnvoll · **P2** = danach · **P3** = nice-to-have.
Status: ⬜ offen · 🟡 in Arbeit · ✅ erledigt.

### Inhalt (größter Hebel für Prüfungsnähe)
- ⬜ **P1** Offizielle / alte / Beispiel-Prüfungsfragen einarbeiten (Material von Nico)
- ⬜ **P1** Kurs-Skript / Schulungsunterlagen als Quelle für neue Fragen nutzen
- ⬜ **P1** **Rechen- und Dokumentationsaufgaben** als eigener Aufgabentyp (Freitext/Zahl-Eingabe, Lösungsschlüssel)
- ⬜ **P2** Fragenzahl je Thema ausbauen und Gewichtung an Prüfungsrelevanz anpassen
- ⬜ **P3** Quellen-/Referenzangabe je Frage (z. B. „ICD-O-3, Regel …")

### Funktionen (aus Abstimmung 2026-07-13 — „machen wir später")
- ⬜ **P1** **Echter Prüfungsmodus**: Timer (Prüfung 180 Min), kein Sofort-Feedback,
  Fragen-Navigation + Markieren/Flaggen, „Abgeben" → volle Auswertung mit Erklärungen
- ⬜ **P1** **Spaced Repetition (Leitner-System)**: fällige Wiederholungen mit optimalen
  Abständen; Startseite zeigt „heute fällig"
- ⬜ **P2** **Einstellungen & Backup**: Fragenanzahl wählbar, Hell/Dunkel-Umschalter,
  Sofort-Feedback an/aus, Fortschritt **exportieren/importieren** (Sicherung gegen Safari-Datenlöschung)
- ⬜ **P2** **Statistik & Tagesziel**: Trefferquote je Thema über Zeit, Prüfungs-Historie,
  tägliches Lernziel mit Fortschrittsring

### Feinschliff (aus Abstimmung 2026-07-13 — „machen wir später")
- ⬜ **P2** **Tastatur-Steuerung** (Zahlen 1–4 wählen, Enter prüfen/weiter) — relevant, da echte Prüfung am Laptop
- ⬜ **P3** **Sanfte Animationen** (Übergänge zwischen Fragen, Konfetti bei bestandener Prüfung)
- ⬜ **P3** **Haptik & Sound** bei richtig/falsch (abschaltbar; auf iPhone teils eingeschränkt)
- ⬜ **P2** **Barrierefreiheit** (größere Schrift wählbar, Kontraste, Screenreader-Labels)

### Technik / Betrieb
- ⬜ **P2** In-App-Hinweis „neue Version verfügbar" bei Service-Worker-Update
- ⬜ **P3** Merge des Arbeits-Branches auf `main` (auf Wunsch, für dauerhafte Pages-URL)
- ⬜ **P3** Automatischer Konsistenz-Check der Fragen (CI/Test-Skript)

---

## 6. Was wir von Nico brauchen

1. **Fachinhalte** (Foto/PDF/Word genügt): Kurs-Skript, alte/Beispiel-Prüfungsfragen,
   Themenliste mit Gewichtung.
2. **Hinweis zu Rechen-/Doku-Aufgaben**: welche Typen kommen vor (z. B. Inzidenzraten,
   Überlebensraten, Kodier-Übungen)?
3. **Hosting-Entscheidung**: Pages vom Arbeits-Branch (sofort) oder Merge auf `main`
   (dauerhaft).

---

## 7. Entscheidungs-Log

| Datum | Entscheidung | Begründung |
|---|---|---|
| 2026-07-13 | **PWA** statt nativer iOS-App | Robust, sofort nutzbar, kein Store/Account/Mac nötig, offline |
| 2026-07-13 | **Alles-oder-nichts-Wertung** bei MC | Entspricht § 5 der Prüfungsordnung (kein Teilpunkt) |
| 2026-07-13 | App-Dateien im **Repo-Root** | GitHub Pages liefert nur aus `/(root)` oder `/docs` |
| 2026-07-13 | **Vanilla JS**, keine Frameworks | Weniger Abhängigkeiten = robuster & langlebiger |
| 2026-07-13 | Startfragen aus **stabilen Fachstandards** | Bis offizielles Material vorliegt: korrekt & prüfungsnah |

---

## 8. Offene Fragen

- Findet die Prüfung weiterhin am Laptop statt (→ Tastatur-Steuerung sinnvoll)?
- Gibt es eine offizielle Themen-/Gewichtungsvorgabe der ADT?
- Soll die App später mehrere Nutzerprofile unterstützen, oder bleibt sie Single-User?
