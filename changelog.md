# Changelog

Alle nennenswerten Änderungen am ADT Trainer. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/); Versionierung nach
[SemVer](https://semver.org/lang/de/) (solange < 1.0.0 kann sich vieles ändern).

## [Unreleased]

### Geplant
- Siehe [Backlog im Workbook](workbook.md#backlog).

---

## [0.3.0] — 2026-07-13

Robustheits-Paket: Fundament, Sync und Bedienung deutlich abgesichert.
Leitlinie: **Die App muss makellos funktionieren.**

### Hinzugefügt
- **Migrations-Gerüst** für Speicherstände (`schemaVersion` + `MIGRATIONS`): künftige
  Datenmodell-Änderungen migrieren alte Stände, statt sie zu verwerfen.
- **Defensive Zustands-Sanitisierung** beim Laden/Zusammenführen: kaputte oder veraltete
  Werte (falsche Typen, negative Zahlen, defekte Fragen-Einträge) werden geheilt statt
  zu crashen.
- **Fehler-Boundary** in der Navigation: ein Render-Fehler zeigt eine freundliche
  Rückfall-Ansicht statt eines weißen Bildschirms; globale `error`/`unhandledrejection`-Handler.
- **Sofort-Speichern beim Schließen/Backgrounden** (`pagehide`/`visibilitychange`): die
  letzte Antwort geht auch dann nicht verloren, wenn die App unmittelbar geschlossen wird.
- **Reset inkl. Cloud**: „Fortschritt zurücksetzen" bietet bei aktivem Sync die Wahl
  „überall (Cloud + Gerät)" oder „nur dieses Gerät (trennt die Cloud)".
- **Lokales Backup**: Fortschritt als `.json`-Datei exportieren und importieren
  (wird verlustarm zusammengeführt) – Sicherung unabhängig von der Cloud.
- **In-App-Update-Hinweis**: Banner „Neue Version verfügbar" mit „Neu laden";
  Updates werden erst nach Bestätigung aktiviert (kein stiller Wechsel, kein Reload-Loop).
- **Wiederverwendbarer Modal-Dialog** (statt `confirm()`), iOS-konform gestaltet.

### Geändert
- **Sync gehärtet**: Wiederholung mit Backoff bei transienten Fehlern (Netz/5xx/429),
  „Abgleich ausstehend"-Kennzeichnung bei Offline/Fehler, Statusanzeige erweitert.
- **Frontend nach iOS-Design-Guidelines** (Apple HIG): Tap-Ziele ≥ 44 pt (u. a.
  Zurück-Button), 8-pt-Raster, Backdrop-Blur/Depth für Modal & Banner, Safe-Area-Beachtung.
- **Service Worker v3**: kein automatisches `skipWaiting` mehr – Update-Aktivierung
  wird per Banner vom Nutzer bestätigt; `message`-Handler für `SKIP_WAITING`.

### Sicherheit
- Optionale **Härtung der Supabase-Funktion** dokumentiert (README): Größenlimit
  (~200 KB) pro Datensatz und Code-Längen-Prüfung gegen Missbrauch.

### Getestet
- Unit-Tests: Merge, Code-Erzeugung/-Normalisierung, `overwriteRemote`, Retry-Backoff,
  Offline-„ausstehend"-Flag, korrekte Header-Logik für beide Schlüsseltypen.
- Browser-Testlauf (Chromium/Playwright): frischer Start, **Migration/Sanitisierung eines
  defekten Speicherstands**, Reset-Modal, Backup-Export **und** -Import (Merge), alles ohne
  Laufzeitfehler.
- Regressionstest Cross-Device-Sync (bidirektional) weiterhin grün.

---

## [0.2.1] — 2026-07-13

### Behoben
- **Cloud-Sync mit neuem Supabase-Schlüsselformat** (`sb_publishable_…`): Diese Keys
  sind keine JWTs und dürfen laut Supabase **nicht** im `Authorization`-Header stehen
  (sonst HTTP 401). Der Schlüssel wird jetzt nur noch im `apikey`-Header gesendet;
  ein `Authorization: Bearer …` wird ausschließlich bei klassischen JWT-Keys (`eyJ…`)
  gesetzt (Abwärtskompatibilität). Verifiziert per Header-Unit-Test für beide Formate.

### Konfiguriert
- `config.js` mit dem Supabase-Projekt verbunden (Projekt-URL + öffentlicher `sb_publishable`-Key).

---

## [0.2.0] — 2026-07-13

Geräteübergreifende Synchronisation des Lernfortschritts.

### Hinzugefügt
- **Cloud-Sync (optional)** über ein kostenloses Supabase-Backend, angebunden per
  einfachem `fetch` (kein externes SDK). Neue Dateien: `config.js` (Konfiguration),
  `js/sync.js` (Sync-Engine).
- **Sync-Code-Identität**: kryptografisch zufälliger, gut lesbarer Code
  (`ADT-XXXXX-XXXXX-XXXXX`) statt Login/Passwort. Auf Gerät 1 erstellen, auf
  weiteren Geräten eingeben.
- **Einstellungsseite „Geräte-Sync"** (Startseite → Fortschritt): Code erstellen,
  verbinden, kopieren, jetzt synchronisieren, Verbindung trennen, Statusanzeige.
- **Automatischer Abgleich** beim App-Start, bei Änderungen (3-Sekunden-Debounce),
  bei erneuter Online-Verbindung und beim Zurückkehren in die App.
- **Verlustarmer Merge**: Fortschrittswerte werden monoton zusammengeführt (Maximum
  je Feld, Vereinigung der Erfolge); Gesamtzähler werden aus den Einzelfragen neu
  berechnet – so geht auf keinem Gerät Fortschritt verloren.
- **Einrichtungsanleitung** inkl. SQL-Snippet in der `README.md`.

### Geändert
- **Service Worker** auf Version `v2`: `config.js` und `data/questions.js` werden
  jetzt **Network-first** ausgeliefert, damit Konfig- und Fragen-Updates die Nutzer
  ohne Cache-Neuversionierung erreichen (offline weiterhin aus dem Cache).
- Skript-Ladereihenfolge in `index.html`: `config.js` und `js/sync.js` vor `app.js`.

### Sicherheit
- Direkter Tabellenzugriff ist per Row Level Security gesperrt; Zugriff nur über
  zwei `security definer`-Funktionen, die den geheimen Sync-Code kennen müssen.
  Der öffentliche `anon`-Key ist bewusst clientseitig (Standard bei Supabase).

### Getestet
- Merge-Logik als Unit-Test (Maximum/Union/Ableitung der Gesamtzähler) – bestanden.
- Sync-Code-Erzeugung/-Normalisierung, 1000 Codes eindeutig – bestanden.
- **Cross-Device-Integrationstest** (Browser, zwei getrennte Speicher, gemockter
  Supabase-Server): Gerät A lernt → Gerät B übernimmt per Code → Gerät B lernt
  weiter → Gerät A übernimmt beim Öffnen. Bidirektional erfolgreich, keine Laufzeitfehler.
- App **ohne** Konfiguration weiterhin voll funktionsfähig (nur lokal, keine Fehler).

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
