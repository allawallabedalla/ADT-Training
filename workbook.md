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

- **⭐ OBERSTE REGEL – makellose Funktion:** Das Allerwichtigste ist, dass die App
  fehlerfrei und zuverlässig läuft. Kein Feature wird ausgeliefert, das die Stabilität
  gefährdet. Jede Änderung wird vor dem Push im echten Browser getestet.
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
- **Speicherstände sind heilig:** Der localStorage-Schlüssel `adt_trainer_state_v1`
  wird **nie umbenannt**. Datenmodell-Änderungen erfolgen per **Migration** (alte
  Stände einlesen und ergänzen), damit Lernfortschritt App-Updates immer überlebt.

## 3. Projekt-Fakten

| | |
|---|---|
| **Repository** | `allawallabedalla/ADT-Training` |
| **Arbeits-Branch** | `claude/adt-training-app-ios-3kmiak` |
| **App-Code** | Repository-**Root** (`index.html`, `css/`, `js/`, `data/`, `icons/`, `sw.js`, `manifest.webmanifest`) |
| **Hosting** | GitHub Pages (statisch, HTTPS) — Quelle: gewählter Branch + Ordner `/(root)` |
| **Live-URL (geplant)** | `https://allawallabedalla.github.io/ADT-Training/` |
| **Fachinhalte pflegen** | `data/questions.js` |
| **Version** | 0.2.0 (siehe `changelog.md`) |
| **Cloud-Sync** | Supabase (kostenlos), Konfiguration in `config.js`; Identität per Sync-Code |

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

### Kürzlich erledigt
- ✅ **Geräteübergreifende Synchronisation** (Cloud-Sync via Supabase, Sync-Code, verlustarmer Merge) — v0.2.0, 2026-07-13
- ✅ **Robustheits-Paket** (v0.3.0, 2026-07-13): Migrations-Gerüst · defensive Zustands-Sanitisierung ·
  Fehler-Boundary · Sofort-Speichern beim Schließen · Sync-Härtung (Retry/Backoff, „ausstehend") ·
  Reset inkl. Cloud · lokales Backup (Export/Import) · Update-Banner · iOS-konforme UI (Modal/Banner)
- ✅ Supabase-Funktionen-Härtung dokumentiert (Größenlimit, Code-Längen-Prüfung)

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
- 🟡 **P2** **Einstellungen**: Fragenanzahl wählbar, Hell/Dunkel-Umschalter, Sofort-Feedback an/aus
  (Backup **exportieren/importieren** ist bereits erledigt, v0.3.0)
- ⬜ **P2** **Statistik & Tagesziel**: Trefferquote je Thema über Zeit, Prüfungs-Historie,
  tägliches Lernziel mit Fortschrittsring

### Feinschliff (aus Abstimmung 2026-07-13 — „machen wir später")
- ⬜ **P2** **Tastatur-Steuerung** (Zahlen 1–4 wählen, Enter prüfen/weiter) — relevant, da echte Prüfung am Laptop
- ⬜ **P3** **Sanfte Animationen** (Übergänge zwischen Fragen, Konfetti bei bestandener Prüfung)
- ⬜ **P3** **Haptik & Sound** bei richtig/falsch (abschaltbar; auf iPhone teils eingeschränkt)
- ⬜ **P2** **Barrierefreiheit** (größere Schrift wählbar, Kontraste, Screenreader-Labels)

### Technik / Betrieb
- ✅ **Reset erweitern**: „überall (Cloud) / nur dieses Gerät" umgesetzt (v0.3.0)
- ✅ **In-App-Hinweis „neue Version verfügbar"** bei Service-Worker-Update (v0.3.0)
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
| 2026-07-13 | Cloud-Sync über **Supabase** (statt Firebase) | REST/RPC per einfachem `fetch`, kein SDK → robuster, offline-first, kein CDN-Zwang |
| 2026-07-13 | Identität per **Sync-Code** (statt Login) | Kein Passwort/OAuth nötig – einfachste Nutzung; Code = Zugriffsschlüssel (capability) |
| 2026-07-13 | **Network-first** für `config.js` & `questions.js` im SW | Konfig-/Fragen-Updates erreichen Nutzer ohne Cache-Neuversionierung |
| 2026-07-13 | Speicher-Schlüssel `adt_trainer_state_v1` bleibt **stabil** | Speicherstände überleben App-Updates; Änderungen nur per Migration |
| 2026-07-13 | Frontend folgt **iOS-Design-Guidelines (Apple HIG)** | Tap-Ziele ≥ 44 pt, 8-pt-Raster, Safe-Areas, Depth/Deference – vertrautes, wertiges Look-and-feel |
| 2026-07-13 | Service-Worker-Updates **nur nach Nutzerbestätigung** | Kein stiller Wechsel/Reload-Loop; Nutzer entscheidet über „Neu laden" |

---

## 8. Offene Fragen

- Findet die Prüfung weiterhin am Laptop statt (→ Tastatur-Steuerung sinnvoll)?
- Gibt es eine offizielle Themen-/Gewichtungsvorgabe der ADT?
- Cloud-Sync eingerichtet? (Supabase-Projekt anlegen + `config.js` befüllen — siehe README)
