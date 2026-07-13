# Changelog

Alle nennenswerten Änderungen am ADT Trainer. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/); Versionierung nach
[SemVer](https://semver.org/lang/de/) (solange < 1.0.0 kann sich vieles ändern).

## [Unreleased]

### Geplant
- Siehe [Backlog im Workbook](workbook.md#backlog).

---

## [0.8.0] — 2026-07-13  ·  Phase 2: Härtung & Transparenz

Schließt die durch Cloud/Push entstandene Fläche.

### Sicherheit
- **`codeExists` entfernt** (kein Existenz-Orakel für Sync-Codes mehr).
- **Pflicht-Härtung der Supabase-Funktionen** als [`supabase/sync-hardening.sql`](supabase/sync-hardening.sql):
  Code-Längenprüfung + Größenlimits für `sync_pull`, `sync_push`, `push_save`
  (Schutz vor Missbrauch/Kostentreiben). README entsprechend aktualisiert (Härtung empfohlen ausführen).
  ⚠️ Serverseitig: einmal im Supabase SQL Editor ausführen.

### Transparenz / Datenschutz
- **In-App-Datenschutzhinweis** im Info-Reiter: welche Daten wo (lokal + optional Supabase/EU),
  opt-in, keine Namen/Patientendaten/Werbung/Analyse, jederzeit löschbar.
- **„Inoffiziell"-Disclaimer** prominent (Info-Reiter + dezent in der Home-Fußzeile):
  kein Produkt der ADT e. V., nicht die offiziellen Prüfungsfragen.

### Tests
- E2E-Check für Datenschutz-/Disclaimer-Text ergänzt. `bash tests/run.sh` grün. Service Worker v9.

---

## [0.7.0] — 2026-07-13  ·  Phase 1: Quick Wins

Erstes Release der Workshop-Umsetzung – Usability, Barrierefreiheit, Robustheit.

### Behoben – Fachinhalt
- **the-004**: Strahlentherapie war fälschlich als „systemische" Therapie gewertet.
  Frage fachlich korrigiert (Strahlentherapie ist lokal/lokoregionär, nicht systemisch),
  Erklärung schärft die Unterscheidung.

### Verbessert – Usability
- **Verpasste richtige Antwort** ist jetzt klar erkennbar: grünes Häkchen + Label „Richtige Antwort".
- **Level-Up-Moment**: beim Erreichen eines neuen Levels erscheint ein Feier-Hinweis mit neuem Titel.
- **Pinch-Zoom entsperrt** (viewport `maximum-scale=1` entfernt) – lange Fachtexte vergrößerbar.
- **Reset** ist jetzt ein deutlicher, roter Button (statt kleinem grauen Inline-Link).
- Quiz-Abbruch nutzt den **iOS-Dialog** statt des System-`confirm()` (konsistente Designsprache).

### Verbessert – Barrierefreiheit
- Toast als **`aria-live`-Region** (Screenreader hören Verdikt/XP/Status); Antwort-Optionen mit
  beschreibenden `aria-label` („richtig, ausgewählt" / „richtige Antwort, nicht gewählt").
- Globaler **`:focus-visible`-Fokusring** und **`prefers-reduced-motion`**-Unterstützung.
- **Kontrast** der Tertiärtexte (Hinweise/Badges) auf ≥ 4,5:1 angehoben.

### Verbessert – Robustheit
- **Service-Worker-Fetch-Timeout** (3,5 s): App startet bei „lie-fi" sofort aus dem Cache.
- **NaN-Schutz** bei der XP-Vergabe (defensive `difficulty`-Absicherung).
- `theme-color` an das App-Blau (#007aff) angeglichen.

### Tests
- E2E-Regressionstest für den „Richtige Antwort"-Hinweis ergänzt; Reset-Test an den neuen
  Dialog angepasst. `bash tests/run.sh` vollständig grün. Service Worker v8.

### Entwicklung / Infrastruktur (2026-07-13)
- **Test-Infrastruktur** im Repo (`tests/`): `validate-questions.mjs`, `unit-sync.mjs`,
  `e2e-smoke.mjs` (Playwright) und Runner `tests/run.sh`. Läuft künftig vor jeder
  Auslieferung („grün = auslieferbar"). Keine App-Änderung.
- **Abarbeitungsstrategie** dokumentiert (`docs/arbeitsstrategie.md`): Methode, Definition
  of Done, Phasenplan – Grundlage für die sukzessive, robuste Umsetzung des Backlogs.

---

## [0.6.0] — 2026-07-13

### Hinzugefügt
- **Info-/Anleitungs-Reiter** („So funktioniert's", Startseite → Fortschritt): erklärt die
  App verständlich – Lernmodi, Prüfungsformat, Belohnungen, Geräte-Sync, Erinnerungen und
  Installation als Home-Bildschirm-App. iOS-Layout mit Icon-Zeilen; zeigt die App-Version.
- Bestätigt: **Lern-Erinnerungen** serverseitig eingerichtet und auf dem Gerät verifiziert
  (echter Web Push kam an).

### Service Worker v7
- verteilt den Info-Reiter an installierte Nutzer.

---

## [0.5.0] — 2026-07-13

### Hinzugefügt – Lern-Erinnerungen (Web Push)
- **Client + Service Worker**: Push-Abo (VAPID), `push`/`notificationclick`-Handler,
  Einstellungs-Bereich „Lern-Erinnerungen" mit Uhrzeitwahl, Aktivieren/Ausschalten
  und „Test senden" (lokale Beispiel-Benachrichtigung).
- **Server (Code + Anleitung mitgeliefert)**: Supabase Edge Function
  `supabase/functions/send-reminders` versendet stündlich fällige Erinnerungen;
  `supabase/reminders-setup.sql` (Tabelle `push_subscriptions` + Funktionen
  `push_save`/`push_remove` + pg_cron-Zeitplan). README-Abschnitt „Lern-Erinnerungen".
- Zeitzonengerecht (lokale Stunde je Gerät), Schutz vor Mehrfachversand pro Tag,
  automatische Bereinigung abgelaufener Abos (404/410).

### Robustheit
- Ohne gesetzten `vapidPublicKey`/Serverteil zeigt die App im Erinnerungs-Bereich
  einen klaren Hinweis statt eines nicht funktionierenden Buttons – die Kern-App
  bleibt davon vollständig unberührt.
- Hinweis für iPhone: Web Push erfordert die zum Home-Bildschirm hinzugefügte PWA.

### Service Worker v6
- `push`- und `notificationclick`-Handler; Cache-Version erhöht (verteilt das Update).

> Der Push-**Versand** wurde nicht end-to-end getestet (Sandbox ohne Zugriff auf
> Supabase/Push-Dienste). Client-Seite und Einstellungs-UI sind im Browser geprüft
> (rendert fehlerfrei, degradiert sauber). Verifikation auf dem Gerät durch den Nutzer.

---

## [0.4.1] — 2026-07-13

### Hinzugefügt
- **Vier neue Erfolge** als langfristige Ziele: Ausdauernd (250), Marathon (500),
  Unermüdlich (750) und Tausend! (1000 Fragen beantwortet) – inkl. passender
  SF-Symbols-Icons (Diamant, Rakete, Berg, Pokal). Erfolge gesamt: 14.

---

## [0.4.0] — 2026-07-13

iOS-natives Design-Update + wichtiger Reset-Bugfix.

### Behoben (wichtig)
- **Reset löschte den Fortschritt nicht vollständig.** Ursache: `{ ...DEFAULT_STATE }`
  kopierte `perQuestion`/`badges` nur flach – beide teilten sich dieselbe Objekt-Referenz
  wie die Vorlage, die beim Beantworten mutiert wurde. Ein Reset übernahm dadurch die
  „gelöschten" Daten wieder (auch nach hartem Reload). Jetzt echte Tiefkopie
  (`freshState()`), und `sanitizeState()` baut immer frische Objekte. Per Regressionstest
  abgesichert (Beantworten → Reset ohne Reload → `perQuestion` wirklich leer).

### Geändert – Design (Apple HIG, durchgängig iOS-nativ)
- **SVG-Icon-Set im SF-Symbols-Stil** ersetzt alle Emoji-UI-Icons – als farbige,
  abgerundete Icon-Kacheln (iOS-Settings-Optik) für Modi, Themen, Sync-Aktionen und Erfolge.
- **Large-Title mit Scroll-Collapse**: große Überschrift je Ansicht, die beim Scrollen
  in den kompakten, transluzenten Navigationsbalken übergeht.
- **Inset-gruppierte Listen** mit Hairline-Trennern (statt Einzelkarten).
- **iOS-Farbsystem**: system blue/green/red/orange, echtes „systemGroupedBackground";
  im Dark Mode OLED-Schwarz mit erhöhten Karten.
- Verfeinerter **Typo-Maßstab** (Large Title 34, Titel 22–24, klare Sekundärfarben) und
  8-pt-Raster; SF-Systemfont.
- **Scroll-Reset** bei jedem Ansichtswechsel (neue Ansicht startet oben).

### Technik
- Service Worker **v4** (verteilt Design- und Fix-Update; In-App-Banner „Neue Version").

### Getestet
- Reset-Regressionstest (ohne Reload) – Fortschritt wird vollständig geleert.
- Voller Browser-Testlauf (Migration/Sanitisierung, Reset-Modal, Backup Export+Import) grün.
- Cross-Device-Sync-Regression nach dem Settings-Redesign weiterhin grün.
- Screenshots aller Ansichten in Light & Dark – keine Laufzeitfehler.

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
