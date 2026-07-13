# Changelog

Alle nennenswerten Änderungen am ADT Trainer. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/); Versionierung nach
[SemVer](https://semver.org/lang/de/) (solange < 1.0.0 kann sich vieles ändern).

## [Unreleased]

### Geplant
- Siehe [Backlog im Workbook](workbook.md#backlog).

---

## [0.1.0] — 2026-07-13

Erste funktionsfähige Version der Trainings-App (PWA) zur Vorbereitung auf die
ADT-Prüfung „Tumordokumentar/in".

### Hinzugefügt
- **PWA-Grundgerüst**: installierbar über Safari „Zum Home-Bildschirm", offline-fähig
  (`index.html`, `manifest.webmanifest`, `sw.js`, App-Icons als PNG).
- **Lernmodi**: Gemischtes Training, Nach Thema lernen, Schwachstellen wiederholen,
  Prüfungssimulation (30 Fragen, bestanden ab 50 %).
- **Prüfungsgetreues MC-Format**: mehrere richtige Antworten möglich, Wertung
  alles-oder-nichts (kein Teilpunkt) gemäß § 5 der Prüfungsordnung.
- **Erklärung zu jeder Frage** zur Vermittlung der Inhalte.
- **Gamification**: XP, Level mit Titeln, Tages-Serie (Streak), 10 Erfolge/Badges.
- **Fortschritt & Statistik**: Trefferquote, gemeisterte Fragen je Thema,
  Prüfungs-Rekorde — lokal gespeichert (localStorage), defektsicher.
- **55 Fragen** über **9 Themen** (Grundlagen, TNM/UICC, ICD-O-3, ICD-10 & Dignität,
  Grading/Residual, Krebsregister & Meldewesen, Epidemiologie & Statistik,
  Therapie & Verlauf, Datenschutz & Recht), inkl. Datenvalidierung beim Start.
- **Design**: Light/Dark-Modus, iOS-optimiert, große Touch-Flächen.
- **Projektdokumente**: `README.md`, `pitch.md`, `workbook.md`, dieses `changelog.md`.

### Geändert
- App-Dateien vom Unterordner `app/` ins **Repository-Root** verschoben, damit
  GitHub Pages („Deploy from a branch", Ordner `/(root)`) sie ausliefern kann.
  Alle Pfade sind relativ; Funktion und Offline-Betrieb unverändert.

### Getestet
- Syntaxprüfung (`node --check`) für JS-Dateien, JSON-Validierung des Manifests.
- Fragen-Datenbank programmatisch validiert (keine doppelten IDs, gültige Indizes,
  Erklärungen vorhanden) — 55 Fragen ok.
- Browser-Durchlauf (Chromium/Playwright, iPhone-Viewport): Quiz-Ablauf, XP/Streak/Badges,
  Themen- und Erfolge-Ansicht, Service-Worker-Registrierung — **keine Laufzeitfehler**.
