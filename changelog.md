# Changelog

Alle nennenswerten Änderungen am ADT Trainer. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/); Versionierung nach
[SemVer](https://semver.org/lang/de/) (solange < 1.0.0 kann sich vieles ändern).

## [Unreleased]

### Geplant
- Siehe [Backlog im Workbook](workbook.md#backlog).

---

## [0.28.0] — 2026-07-13  ·  Weniger Toasts beim Lernen

### Geändert
- **Kein XP-Hinweis mehr nach jeder Frage.** Ob „Richtig/Nicht ganz" steht bereits klar in
  der Erklärungs-Karte, und der XP-Fortschritt ist auf der Startseite/Level-Leiste sichtbar.
  Eingeblendet werden jetzt nur noch **besondere Momente**: Frage gemeistert (Box 3),
  Level-Aufstieg und neue Erfolge. Ruhigeres, weniger ablenkendes Lernen.

### Technik
- `tests/run.sh` grün.

---

## [0.27.0] — 2026-07-13  ·  Größere Schrift (Barrierefreiheit)

### Hinzugefügt
- **Schriftgröße „Groß"** in den Einstellungen: hebt gezielt die Lese-Flächen an (Fragen,
  Antworten, Erklärungen, Review) – bewusst begrenzt statt globalem Skalieren, damit das
  Layout stabil bleibt.

### Technik
- 1 neuer Test. `tests/run.sh` grün. Zusätzlich: **CI-Workflow** (GitHub Actions) prüft bei
  jedem Push/PR Syntax, Fragen-Datenbank und Sync-Logik.

---

## [0.26.0] — 2026-07-13  ·  Feiermomente & Feinschliff

### Hinzugefügt
- **Konfetti** bei bestandener Prüfung und bei starken Übungsergebnissen (≥ 80 %).
- **Sanfte Einblendung** neuer Fragen.
- **Haptisches Feedback** bei Antworten (an/aus in den Einstellungen; auf Android spürbar,
  auf dem iPhone eingeschränkt).
- Alle Effekte respektieren „Bewegung reduzieren" (Systemeinstellung).

### Bewusst weggelassen
- **Sound**: auf dem iPhone stark eingeschränkt und schnell störend – daher nicht umgesetzt.

### Technik
- 4 neue Tests. `tests/run.sh` grün.

---

## [0.25.0] — 2026-07-13  ·  UI-Feinschliff

### Geändert
- **Quiz-Fortschrittsbalken zeigt die Position** (Frage 1 von N ist nicht mehr 0 %).
- **Statusleiste an den App-Hintergrund angeglichen** (nahtlos: hell #f2f2f7 / dunkel #000).
- **Installations-Hinweis** nutzt jetzt ein monochromes Icon statt Emoji (konsistent flat).
- Toten CSS-Code entfernt (ungenutzte `.emoji`/Badge-`.ic`-Regeln).

### Technik
- `tests/run.sh` grün.

---

## [0.24.0] — 2026-07-13  ·  Statistik & Prüfungs-Historie

### Hinzugefügt
- **Neue Statistik-Seite**: Trefferquote je Thema (mit „sicher"-Zähler pro Thema),
  Gesamtwerte (beantwortet, Trefferquote, sichere Fragen) und eine **Prüfungs-Historie**
  (Datum + Ergebnis der letzten Simulationen, bestanden/durchgefallen farbig).
- Startseiten-Eintrag „Statistik".

### Technik
- Prüfungs-Historie geräte-lokal (letzte 30). 2 neue Tests. `tests/run.sh` grün.

---

## [0.23.0] — 2026-07-13  ·  Cloud-Daten löschen

### Hinzugefügt
- **„Cloud-Daten löschen"** in den Einstellungen (nur bei aktivem Sync): entfernt den in der
  Cloud gespeicherten Fortschritt und trennt dieses Gerät – der **lokale** Fortschritt bleibt
  erhalten. Transparente Datenkontrolle ohne Backend-Eingriff (leert die Cloud-Zeile).

### Technik
- 2 neue UI-Tests (Sync in der Sandbox nicht erreichbar → Netzaufruf nicht ausgelöst).
  `tests/run.sh` grün.

---

## [0.22.0] — 2026-07-13  ·  Erfolge & Meisterschafts-Bonus

### Hinzugefügt
- **3 neue Erfolge** (weniger reine Mengen-Abzeichen, mehr echtes Können): „Gefestigt"
  (25 Fragen sicher), „Eiserne Serie" (14-Tage-Rekord), „Alles sitzt" (alle Fragen sicher).
  Jetzt 17 Abzeichen.
- **Erstmeisterungs-Bonus**: Erreicht eine Frage zum ersten Mal Box 3 („sicher"), gibt es
  einmalig **+15 XP** – belohnt echtes Beherrschen statt bloßer Wiederholung.

### Geändert
- Verschachtelten `master`-Erfolgstest vereinfacht. Badge-Zähler im Info-Tab dynamisch.

### Technik
- Neues Feld `masteredOnce` (additiv; bereits sichere Fragen zählen als gemeistert → kein
  nachträglicher Bonus). 2 neue Tests. `tests/run.sh` grün.

---

## [0.21.0] — 2026-07-13  ·  Barrierefreiheit & Tastatur

### Hinzugefügt
- **Tastaturbedienung am Laptop** (die echte Prüfung ist am Rechner): Zahlen **1–9** wählen
  Antwortoptionen, **Enter** prüft bzw. geht weiter – in Übung UND Prüfung.
- **Barrierefreier Dialog**: Auswahl-Dialoge sind jetzt `role="dialog"` (aria-modal) mit
  **Fokusfalle**, **Escape** schließt (Abbruch), und der Fokus kehrt danach zurück.
- **Fortschrittsbalken** (Level & Quiz) als `role="progressbar"` mit Werten.
- **Doppeltes `<h1>` behoben**: Wo eine Ansicht einen Large-Title hat, wird der Balken-Titel
  für Screenreader ausgeblendet (sonst zwei H1 pro Seite).

### Technik
- 7 neue Prüfungen im A11y-/Tastatur-Test. `tests/run.sh` grün.

---

## [0.20.0] — 2026-07-13  ·  Einstellungen (Design & Rundengröße)

Der bisherige „Sync & Sicherung"-Bereich wird zur zentralen **Einstellungen**-Seite.

### Hinzugefügt
- **Design-Umschalter**: Automatisch (folgt dem System) · Hell · Dunkel – die feste Wahl
  überstimmt die Systemeinstellung.
- **Fragen pro Runde** wählbar (10/15/20/30/Alle) – gilt für alle Übungsmodi; die
  Prüfungssimulation bleibt fix.

### Geändert
- Startseiten-Eintrag „Geräte-Sync" → **„Einstellungen"** (mit Design, Sync, Sicherung,
  Erinnerungen an einem Ort).
- Einstellungen sind geräte-lokal (kein Eingriff in den gesyncten Lernstand).

### Technik
- Dunkle Farbwerte für „Auto" (Media-Query) und feste Umschaltung (`data-theme`) mit
  demselben Satz; eine feste Wahl überstimmt das System. 6 neue Tests. `tests/run.sh` grün.

---

## [0.19.0] — 2026-07-13  ·  Native Zurück-Navigation

### Hinzugefügt
- **System-/Browser-Zurück bleibt in der App**: Die Ansichten legen echte Verlaufseinträge
  an (pushState/popstate). Der Zurück-Wisch bzw. die Zurück-Taste führen zur vorigen Ebene,
  statt die App zu verlassen. Aus Quiz/Prüfung heraus kommt wie gewohnt die Rückfrage
  („Beenden?/Verlassen?"); bei „Weiter" bleibt man drin. Ergebnis-Ansichten ersetzen die
  Quiz-/Prüfungsansicht im Verlauf (sauberes Zurück).

### Technik
- Rendern von der History-Logik getrennt (`renderView` vs. `go`), zentraler `popstate`-Handler.
  3 neue E2E-Tests. `tests/run.sh` grün.

---

## [0.18.0] — 2026-07-13  ·  Härtung

Kleine, aber wichtige Robustheits-Verbesserungen (Defense-in-Depth).

### Geändert
- **Toleranter Precache** im Service Worker: Assets werden einzeln gecacht – eine
  fehlende Datei lässt nicht mehr die ganze Installation (und damit Offline) scheitern.
- **Fremde Frage-IDs werden verworfen**: `sanitizeState` übernimmt nur `perQuestion`-
  Einträge zu echten Fragen (bounded gegen aufgeblähte/fehlerhafte Import-/Remote-Daten) –
  mit Sicherung, dass bei einem Lade-Fehler nichts gelöscht wird.
- **Speicher-voll sichtbar**: Schlägt das lokale Speichern fehl (Quota), erscheint einmalig
  ein Hinweis statt stillem Datenverlust.

### Technik
- 1 neuer Regressionstest (Whitelist). `tests/run.sh` grün (Cache-Name stabil, kein Bump nötig).

---

## [0.17.0] — 2026-07-13  ·  Selbst-aktualisierender Cache (Robustheit)

Beseitigt eine bekannte Fragilität: das **manuelle Hochzählen** der Service-Worker-Cache-
Version bei jedem Release (einmal vergessen → Nutzer bekämen keine Updates mehr).

### Geändert
- **App-Shell jetzt „stale-while-revalidate"**: HTML/CSS/JS/Icons kommen sofort aus dem
  Cache und werden im Hintergrund frisch nachgeladen → die neue Version ist beim nächsten
  Start automatisch da, **ohne** dass eine Cache-Version erhöht werden muss.
- **config.js & questions.js bleiben network-first**: korrigierte Fragen/Konfiguration
  erreichen die Nutzer weiterhin sofort (sobald online).
- **HTTP-Cache umgangen** (`cache: "no-cache"`) bei allen SW-Netz-Abrufen – sonst hätte der
  Browser-HTTP-Cache eine „frische" Antwort in Wahrheit veraltet ausliefern können. (Der
  Fehler wurde im Browser-Test entdeckt und behoben.)
- `reg.update()` beim Zurückkehren in die App (prüft selten, aber zuverlässig auf einen
  neuen Service Worker).
- Cache-Name ist jetzt **stabil** (`adt-shell-v1`) – kein Bumpen je Release mehr; alte
  versionierte Caches werden beim Aktivieren aufgeräumt.

### Technik
- Neuer Test-Schritt **`tests/sw-cache.mjs`** (Playwright mit aktivem Service Worker):
  Registrierung, Precache, Kontrolle, **Laden ohne Netz**. Zusätzlich manuell verifiziert:
  eine geänderte Datei propagiert per SWR ohne Cache-Bump. `tests/run.sh` grün.

---

## [0.16.1] — 2026-07-13  ·  Icons ohne Hintergrundkachel

- **Hintergrund-„Schattierung" hinter den Icons entfernt**: Icons stehen jetzt als reine
  Glyphen (etwas größer) ohne Kachel – konsequenter Flat-Look. Erfolge unterscheiden
  freigeschaltet/nicht über volle vs. blasse Glyphen. Service Worker v18.

---

## [0.16.0] — 2026-07-13  ·  Flat-monochrome Icons

### Geändert
- **Icon-Optik auf flat & monochrom umgestellt**: Statt der bunten iOS-Kacheln jetzt
  durchgängig neutrale, einfarbige Icons (Glyph in Labelfarbe auf dezenter Fläche) –
  einheitlich in Hell und Dunkel. Betrifft alle Icon-Kacheln (Startseite, Themen, Sync,
  Info, Onboarding) sowie die Serien-Flamme.
- **Erfolge**: freigeschaltete Abzeichen erscheinen als **gefüllte, invertierte** Kachel
  (heben sich monochrom klar ab), noch nicht erreichte bleiben blass.
- Umsetzung zentral in `css/styles.css` (eine Stelle) – funktionale Farben (Fortschritts­balken,
  Prüf-Feedback grün/rot, Level-Hero) bleiben erhalten. Service Worker v17.

---

## [0.15.0] — 2026-07-13  ·  Tagesziel & Onboarding

Für neue Nutzer:innen ein sanfter Einstieg, für alle ein täglicher Anreiz.

### Hinzugefügt
- **Tagesziel mit Fortschrittsring** auf der Startseite: zeigt „X / Ziel Fragen heute",
  füllt sich beim Üben und wechselt bei Erreichen in einen grünen „geschafft"-Zustand.
  Tippen startet direkt eine Übung; das Ziel ist jederzeit über „Ziel ändern" anpassbar
  (5/10/15/20/30 Fragen).
- **Onboarding beim Erststart**: kurze Begrüßung, die die App erklärt und das Tagesziel
  setzen lässt – erscheint nur einmal und nur für wirklich neue Nutzer:innen (kein
  Fortschritt vorhanden), niemals für Bestandsnutzer.

### Technik / Design
- Tageszähler & Ziel sind bewusst **geräte-lokal** (localStorage, wie die Erinnerungs-Uhrzeit)
  – kein Eingriff in den gesyncten Lernstand, keine Schema-Änderung, keine Merge-Komplexität.
- 6 neue Tests (Ring-Startwert, Zähler nach Antwort, Onboarding zeigt/setzt/wiederholt-nicht).
  Test-Harness überspringt Onboarding standardmäßig. `tests/run.sh` grün. Service Worker v16.

---

## [0.14.0] — 2026-07-13  ·  Faire Tages-Serie & Rekord

Die Tages-Serie ist jetzt motivierender statt bestrafend.

### Hinzugefügt
- **Gnadentag**: Ein einzelner verpasster Tag beendet die Serie nicht mehr – sie läuft
  weiter. Erst ab **zwei** verpassten Tagen beginnt sie neu. (Kein demotivierender Reset
  nach einem einzigen Aussetzer.)
- **Rekord-Serie**: Die längste je erreichte Serie wird gespeichert und unter **Erfolge**
  angezeigt (neben der aktuellen Serie).

### Geändert / Technik
- Neues Feld `bestStreak` (additiv, ohne Schema-Bruch): heilt Altstände, indem der Rekord
  nie kleiner als die aktuelle Serie ist. Im Geräte-Sync verlustarm als Maximum geführt.
- 3 neue Tests (Gnadentag hält Serie, zwei verpasste Tage → Reset, Rekord bleibt) + Merge-Test.
  `tests/run.sh` grün. Service Worker v15.

---

## [0.13.0] — 2026-07-13  ·  Prüfungs-Barrierefreiheit & Desktop-Darstellung

### Geändert
- **Prüfungsansicht barrierefrei & in-place**: Dieselbe robuste Antwortauswahl wie im
  Übungsquiz jetzt auch in der Prüfungssimulation – In-place-Toggle (kein Full-Re-Render,
  VoiceOver-Fokus bleibt während der Simulation stabil), ARIA-Rollen (radiogroup/checkbox +
  aria-checked), Tastaturbedienung (Pfeile/Home/End/Leertaste, Roving-Tabindex). Der
  „beantwortet"-Zähler aktualisiert sich in-place. Tastatur-/Auswahllogik ist mit dem
  Übungsquiz geteilt (kein Doppel-Code).
- **Desktop/breite Fenster**: Im Browser wird die App ab 700 px als **zentrierte App-Spalte**
  auf abgesetztem Hintergrund dargestellt (statt frei stehender Inhalt im leeren Feld) –
  Kopf- und Aktionsleiste an der Spalte ausgerichtet. Die iPhone-Darstellung (schmales
  Vollbild) bleibt komplett unverändert.

### Technik
- 1 neuer E2E-Test-Block für die Prüfungs-Antwortauswahl (Rollen, In-place, aria-checked,
  Zähler). Flaky-Fix in einem SRS-Test (Rechenaufgaben im Zufallspool). `tests/run.sh` grün.
  Service Worker v14.

---

## [0.12.0] — 2026-07-13  ·  Barrierefreie & robuste Antwortauswahl

Die Antwortauswahl im Übungsquiz ist jetzt barrierefrei und leichter – ein wichtiger
Baustein für „makellose Funktion" (v. a. mit VoiceOver auf dem iPhone).

### Geändert
- **In-place-Auswahl statt Full-Re-Render**: Ein Tippen aktualisiert nur die betroffenen
  Optionen im DOM, statt die ganze Ansicht neu aufzubauen. Das hält den (VoiceOver-)Fokus
  stabil, verhindert Flackern und ist deutlich sparsamer.
- **ARIA-Rollen**: Optionsfeld als `radiogroup` (Einfachauswahl) bzw. `group` (Mehrfachauswahl);
  jede Option als `radio`/`checkbox` mit `aria-checked`. Screenreader kündigen Auswahl-Status korrekt an.
- **Tastaturbedienung** nach WAI-ARIA-Muster: Pfeiltasten/Home/End bewegen den Fokus
  (Einfachauswahl wählt dabei zugleich), Leertaste/Enter schalten um; Roving-Tabindex
  (ein Tab-Stopp je Frage).
- **Ergebnis-Fokus**: Nach „Antwort prüfen" springt der Fokus auf den Erklärungsblock
  (`role="status"`), damit das Verdikt vorgelesen wird.

### Technik
- 1 neuer E2E-Test-Block (7 Prüfungen: Rollen, In-place-Toggle, aria-checked, Tastatur,
  Mehrfach-Toggle). `tests/run.sh` grün. Service Worker v13.

---

## [0.11.0] — 2026-07-13  ·  Fragetypen & Rechenaufgaben

Die App kann jetzt mehr als Multiple-Choice – ein Schritt näher am echten Prüfungsformat
(das auch Dokumentations-/Rechenaufgaben enthält).

### Hinzugefügt
- **Neuer Aufgabentyp „Rechenaufgabe" (numeric)**: freie Zahl-Eingabe statt Optionen,
  mit optionaler Toleranz und Einheit. Funktioniert im **Übungsmodus und in der
  Prüfungssimulation** (dort ohne Zwischen-Feedback, Auswertung mit „deine Zahl vs. richtig").
- **4 erste Rechen-/Anwendungsaufgaben**: Überlebenszeit in Monaten, Erkrankungsalter,
  rohe Inzidenzrate (pro 100.000), tumorfreie Lymphknoten – jeweils mit Rechenweg in der Erklärung.

### Geändert / Technik
- **Fragetyp-Seam**: „beantwortet?" und Bewertung laufen jetzt zentral über `hasResponse`/
  `gradeQuestion` je Typ – single/multi verhalten sich unverändert, neue Typen (z. B. Text/Code)
  lassen sich später ergänzen, ohne Quiz-/Prüfungs-Flow anzufassen.
- Datenvalidierung (`DATA_OK` + Test) kennt den `numeric`-Typ (Zahl + Toleranz statt Optionen).
- 4 neue Tests (Bewertung numeric, falsch → Box 0, richtig → Box steigt, richtige Lösung sichtbar);
  Prüfungs-Tests numerik-fest gemacht. `tests/run.sh` grün. Service Worker v12.

**Kennzahlen:** 59 Fragen (55 MC + 4 Rechenaufgaben) · 9 Themengebiete.

---

## [0.10.0] — 2026-07-13  ·  Spaced Repetition & mehrstufige Mastery

Aus „einmal richtig = gemeistert" wird ein echtes Wiederholungssystem, das den
Lernstoff langfristig verankert – ohne dass etwas manuell geplant werden muss.

### Hinzugefügt
- **Spaced Repetition (Leitner-System)**: Jede Frage sitzt in einer Box 0–5. Richtig
  beantwortet steigt sie eine Box höher mit längerer Pause (**1 → 3 → 7 → 16 → 35 Tage**),
  ein Fehler setzt sie auf Box 0 zurück. So kommt jede Frage genau dann wieder, wenn sie
  zu verblassen droht.
- **„Fällige Wiederholungen"** auf der Startseite (ersetzt „Schwachstellen wiederholen"):
  zeigt an, wie viele Fragen heute dran sind, überfällige zuerst.
- **Mehrstufige Mastery**: Ein Thema gilt erst als **„sicher"** (gemeistert), wenn seine
  Fragen mehrfach richtig saßen (Box 3+) – nicht schon nach einem einzigen Treffer. Das
  macht den Fortschrittsbalken ehrlicher.
- **Info-Tab**: neuer Abschnitt „Cleveres Wiederholen", der das System erklärt.

### Geändert / Datenmodell
- Neues Schema **v2** mit sauberer Migration: bestehender Fortschritt wird warmgestartet
  (schon Gekonntes → Box 3 mit 7-Tage-Pause, zuletzt Falsches → Box 1, Ungeübtes → heute
  fällig). **Kein Lernstand geht verloren.**
- Der geräteübergreifende **Merge** führt Box/Fälligkeit verlustarm zusammen (weiter
  fortgeschrittene Box gewinnt) und trägt die Schema-Version mit, damit kein Sync die
  Wiederholungsplanung zurücksetzt.

### Technik
- 4 neue Tests (SRS-Merge, Schema-Migration, Box-Aufstieg nach Antwort, Fälligkeits-Anzeige).
  `tests/run.sh` grün. Service Worker v11.

---

## [0.9.0] — 2026-07-13  ·  Echter Prüfungsmodus

Die Prüfungssimulation ist jetzt eine realistische Generalprobe statt verkapptem Üben.

### Hinzugefügt
- **Countdown-Timer** (Simulation: 90 s je Frage) – läuft als Wanduhr weiter, auch nach
  Verlassen/Reload; bei 0 wird automatisch abgegeben.
- **Kein Zwischen-Feedback / keine XP-Toasts** während der Prüfung.
- **Freie Navigation**: Vor/Zurück, Fragen **markieren** (Flag) und eine **Übersicht**
  (Gitter mit beantwortet/markiert/aktuell) zum direkten Anspringen.
- **Blueprint-Zusammenstellung**: 30 Fragen mit **themenproportionaler Quote** (jedes
  der 9 Themen ist vertreten) – Läufe sind vergleichbar.
- **Abgeben → Auswertung**: Score, Bestehensgrenze (≥ 50 %), **Themenprofil** (richtig/gesamt
  je Thema) und **Detail-Review** (deine Antwort vs. richtige + Erklärung, „Falsche wiederholen").
- **Session-Persistenz**: eine laufende Prüfung überlebt Reload/App-Wechsel; die Startseite
  bietet „Fortsetzen" an. (schließt das im Workshop genannte Session-Verlust-Risiko)

### Technik
- Eigener, in sich geschlossener Prüfungs-Flow (der Übungs-Quiz bleibt unangetastet).
- 2 neue E2E-Tests (kompletter Prüfungsablauf + Session-Persistenz). `tests/run.sh` grün. Service Worker v10.

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
