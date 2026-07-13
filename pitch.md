# ADT Trainer — Pitch & Produktüberblick

> Stand: 2026-07-13 · Version 0.21.0
> Dieses Dokument erklärt die App im **aktuellen Stand**. Es wird bei jeder
> größeren Änderung mit aktualisiert.

## In einem Satz

Eine robuste, offline-fähige Lern-App fürs iPhone, die gezielt auf die
ADT-Prüfung **„Tumordokumentar/in"** vorbereitet — mit prüfungsgetreuen
Fragen, Erklärungen und motivierender Gamification.

## Problem

Die Vorbereitung auf die ADT-Prüfung ist trocken und umfangreich (Tumor­klassi­fikation,
ICD-O-3/ICD-10, TNM, Krebsregister, Epidemiologie …). Es fehlt ein
kurzweiliges Werkzeug, mit dem man **jederzeit unterwegs am Handy** üben kann —
im echten Prüfungsformat und mit direktem Lerneffekt.

## Zielgruppe

Prüfungskandidat:innen des ADT-Lehrgangs „Tumordokumentar/in". Primärnutzerin:
eine konkrete Anwenderin, die die App auf ihrem iPhone nutzt. Die App muss
darum vor allem **einfach und absturzsicher** sein.

## Lösung

Eine **Progressive Web App (PWA)**:

- Läuft in Safari, wird per *„Zum Home-Bildschirm"* wie eine echte App installiert
- Danach **vollständig offline** nutzbar (kein Netz nötig)
- Kein App Store, kein Entwickler-Account, kein Konto, kein Server
- Fortschritt wird lokal auf dem Gerät gespeichert

## Kernfunktionen (aktueller Stand 0.16.0)

| Bereich | Was es kann |
|---|---|
| **Lernmodi** | Gemischtes Training · Nach Thema lernen · Fällige Wiederholungen (Spaced Repetition) · Prüfungssimulation (30 Fragen, Timer, bestanden ab 50 %) |
| **Aufgabentypen** | Multiple-Choice (einfach/mehrfach) **und Rechen-/Anwendungsaufgaben** mit freier Zahl-Eingabe (Toleranz + Einheit) — näher am echten Prüfungsformat |
| **Spaced Repetition** | Leitner-System: jede Frage wandert bei richtiger Antwort in eine höhere Box mit längerer Pause (1 → 3 → 7 → 16 → 35 Tage), ein Fehler setzt zurück — die App plant Wiederholungen automatisch |
| **Mastery** | Mehrstufig: „neu" → „am Lernen" → „sicher" (mehrfach richtig, Box 3+) — der Themenfortschritt zeigt ehrlich, was wirklich sitzt |
| **Prüfungsformat** | Multiple-Choice mit *mehreren* richtigen Antworten; nur *vollständig* richtig zählt (kein Teilpunkt — wie § 5 der Prüfungsordnung) |
| **Lerneffekt** | Zu **jeder** Frage eine Erklärung — Inhalte werden vermittelt, nicht nur abgefragt |
| **Tagesziel** | Tägliches Lernziel mit Fortschrittsring auf der Startseite (anpassbar); sanftes Onboarding beim Erststart |
| **Gamification** | XP, Level (mit Titeln), faire Tages-Serie (Streak 🔥 mit Gnadentag + Rekord), Erfolge/Badges |
| **Fortschritt** | Trefferquote, gemeisterte Fragen je Thema, Prüfungs-Rekorde |
| **Geräte-Sync** | Optionaler Cloud-Abgleich (Supabase) per **Sync-Code** — auf jedem Gerät weiterlernen, offline-first, verlustarmer Merge, Retry bei Störungen |
| **Erinnerungen** | Optionale tägliche Web-Push-Erinnerung ans Üben (Uhrzeit wählbar; auf iPhone als installierte PWA) |
| **Sicherung** | Backup als Datei exportieren/importieren; „überall/nur hier"-Reset für saubere Übergabe |
| **Robustheit** | Datenvalidierung, selbstheilende Zustands-Sanitisierung, Migrations-Gerüst, Sofort-Speichern beim Schließen, Fehler-Boundary (nie weißer Bildschirm), Offline-Cache, selbst-aktualisierend (stale-while-revalidate) |
| **Design** | Durchgängig iOS-nativ (Apple HIG): flat-monochrome Icons, Large-Titles, gruppierte Listen, iOS-Farbsystem (OLED-Dark), ≥44 pt-Tap-Ziele, Safe-Areas; im Desktop-Browser als zentrierte App-Spalte |
| **Barrierefreiheit** | Antwortauswahl (Übung **und** Prüfung) mit ARIA-Rollen (radiogroup/checkbox), Tastaturbedienung (Pfeile/Leertaste), sichtbarer Fokus, In-place-Auswahl (VoiceOver-stabil), Bewegungsreduktion |

**Kennzahlen:** 59 Fragen (55 Multiple-Choice + 4 Rechenaufgaben) · 9 Themengebiete
(Grundlagen, TNM, ICD-O-3, ICD-10 & Dignität, Grading/Residual, Krebsregister,
Epidemiologie, Therapie, Datenschutz).

## Warum PWA statt native iOS-App

- **Robust & sofort nutzbar:** ein Link genügt, keine Installation über den Store
- **Keine Hürden:** kein Mac/Xcode, kein Apple-Developer-Account (99 $/Jahr), keine Review
- **Offline & schnell:** Service Worker cached alles lokal
- **Einfach pflegbar:** Änderungen sind sofort live, kein App-Update-Zwang

## Prüfungsnähe

Basiert auf der Prüfungsordnung „Tumordokumentar/in" der ADT e. V.
(Stand 08/2022): schriftliche Prüfung, MC-Fragen mit mehrfach richtigen
Antworten sowie Dokumentations-/Rechenaufgaben, 180 Minuten, bestanden ab 50 %.
Zugelassene Hilfsmittel laut PO: ICD-10, ICD-O-3, OPS.

## Technik (kurz)

Reines HTML/CSS/**Vanilla-JavaScript**, keine Frameworks, keine Abhängigkeiten.
Fragen liegen als einfache Datenstruktur in `data/questions.js`. PWA über
`manifest.webmanifest` + `sw.js` (Offline-Cache). Hosting statisch (z. B.
GitHub Pages).

## Installation (Kurzfassung)

1. App-URL in **Safari** öffnen
2. **Teilen** → **„Zum Home-Bildschirm"** → *Hinzufügen*
3. App startet im Vollbild und läuft offline

## Wo es hingeht

Die inhaltliche Ausbaustufe (offizielle/Beispiel-Fragen, mehr Rechen-/Doku-Aufgaben)
und weiterer Feature-Ausbau (Onboarding/Tagesziel, faire Streak) sind im
[Backlog](workbook.md#backlog) festgehalten. Bereits umgesetzt: echter Prüfungsmodus
mit Timer, Spaced-Repetition-Wiederholung, Rechen-/Anwendungsaufgaben, barrierefreie
Antwortauswahl (Übung + Prüfung), Einstellungen & Backup.
