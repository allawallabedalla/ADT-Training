# ADT Trainer – Prüfungsvorbereitung Tumordokumentar/in

Eine kleine, robuste **Lern-App fürs iPhone** zur Vorbereitung auf die
ADT-Prüfung **„Tumordokumentar/in"**. Sie läuft als **PWA** (Progressive
Web App) direkt in Safari, lässt sich zum Home-Bildschirm hinzufügen und
funktioniert danach **komplett offline** – ganz ohne App Store.

## Was die App kann

- **Gemischtes Training** – zufällige Fragen aus allen Themen
- **Nach Thema lernen** – gezielt einzelne Themengebiete üben, mit Fortschrittsbalken je Thema
- **Schwachstellen wiederholen** – automatisch die noch nicht sicher beherrschten Fragen
- **Prüfungssimulation** – 30 Fragen, bestanden ab 50 % (wie in der echten Prüfung)
- **Prüfungsgetreues Format** – Multiple-Choice mit *mehreren* richtigen Antworten; nur *vollständig* richtig zählt (kein Teilpunkt, § 5 der Prüfungsordnung)
- **Erklärung zu jeder Frage** – der Lerninhalt wird vermittelt, nicht nur abgefragt
- **Gamification** – XP, Level, Tages-Serie (Streak) und Erfolge/Badges
- **Fortschritt bleibt gespeichert** (lokal auf dem Gerät, kein Konto, kein Server)

## Auf dem iPhone installieren

1. Die App-URL in **Safari** öffnen (siehe Abschnitt *Hosting*).
2. Unten auf das **Teilen-Symbol** tippen.
3. **„Zum Home-Bildschirm"** wählen → *Hinzufügen*.
4. Fertig – die App startet im Vollbild und läuft offline.

## Hosting (z. B. kostenlos über GitHub Pages)

Der komplette App-Code liegt im **Repository-Root** (`index.html` usw.). Zum
Bereitstellen genügt ein beliebiger statischer Webserver (HTTPS erforderlich,
damit der Offline-Modus/Service Worker funktioniert). Mit **GitHub Pages**:
Repository-Einstellungen → *Pages* → *Deploy from a branch* → gewünschten
Branch und Ordner `/(root)` wählen → *Save*. Danach ist die App unter der
Pages-URL erreichbar.

Lokal testen:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen
```

## Fragen ergänzen oder anpassen

Alle Fragen stehen in **[`data/questions.js`](app/data/questions.js)**.
Jede Frage hat ein einfaches Format (Thema, Schwierigkeit, Typ, Optionen,
richtige Antworten, Erklärung). Neue Fragen einfach an das Array anhängen –
die App validiert das Format beim Start und meldet Fehler in der Konsole.

> **Wichtig zum Inhalt:** Die aktuell enthaltenen Fragen sind sorgfältig nach
> stabilen Fachstandards (UICC/TNM, ICD-O-3, ICD-10, ADT/GEKID-Basisdatensatz,
> § 65c SGB V) formuliert und dienen dem Üben. Sie sind **nicht** die offiziellen
> ADT-Prüfungsfragen. Für maximale Passgenauigkeit sollten die offiziellen
> Kursunterlagen/Beispielfragen eingearbeitet werden (siehe unten).

## Struktur

```
(Repository-Root)
├── index.html              App-Grundgerüst
├── manifest.webmanifest    PWA-Manifest (Name, Icons, Standalone)
├── sw.js                   Service Worker (Offline-Cache)
├── css/styles.css          Design (Light/Dark, iOS-optimiert)
├── js/app.js               App-Logik (Quiz-Engine, Gamification)
├── data/questions.js       Fragen-Datenbank  ← hier Inhalte pflegen
└── icons/                  App-Icons (PNG)
```

## Grundlage

Basiert auf der Prüfungsordnung „Tumordokumentar/in" der Arbeitsgemeinschaft
Deutscher Tumorzentren e. V. (ADT), Stand 08/2022 (siehe PDF im Repo):
schriftliche Prüfung, MC-Fragen mit mehrfach richtigen Antworten sowie
Dokumentations-/Rechenaufgaben, 180 Minuten, bestanden ab 50 %.
