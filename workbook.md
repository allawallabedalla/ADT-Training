# Workbook — Zusammenarbeit & Backlog

> Das „Betriebshandbuch" unseres Projekts: **wie** wir zusammenarbeiten, **was**
> als Nächstes ansteht (Backlog) und **welche Entscheidungen** wir getroffen haben.
> Wird laufend gepflegt.
> Stand: 2026-08-06

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
| **Arbeits-Branch** | `claude/wizardly-clarke-qizl3i` |
| **App-Code** | Repository-**Root** (`index.html`, `css/`, `js/`, `data/`, `icons/`, `sw.js`, `manifest.webmanifest`) |
| **Hosting** | GitHub Pages (statisch, HTTPS) — Quelle: gewählter Branch + Ordner `/(root)` |
| **Live-URL (geplant)** | `https://allawallabedalla.github.io/ADT-Training/` |
| **Fachinhalte pflegen** | `data/questions.js` (bei `contentGated: true`: Pipeline im `Secret`-Repo → Supabase) |
| **Fragen-Feedback** | Melden in der App → als GitHub-Issue (privates `Secret`-Repo, `config.js` → `feedbackRepo`) **oder** Export → `tools/reports-to-backlog.mjs` → `docs/fragen-backlog.md` (Ablauf: README → „Fragen-Feedback") |
| **Version** | 0.36.0 (siehe `changelog.md`) |
| **Cloud-Sync** | Supabase (kostenlos), Konfiguration in `config.js`; Identität per Sync-Code |

## 4. Definition of Done (pro Änderung)

Ausführliche Methode: `docs/arbeitsstrategie.md`.

- [ ] Fachlich geprüft (bei Inhalten)
- [ ] **`bash tests/run.sh` grün** (Syntax + Fragen-Validierung + Unit + E2E-Smoke)
- [ ] Bei Bugfix: **Regressionstest** ergänzt; bei Feature: Test ergänzt
- [ ] Bei UI: Screenshot Light **und** Dark, Konsole fehlerfrei
- [ ] Risiko-Check (neue Kosten/Recht/Security/Usability?) – kurz notiert
- [ ] Offline-Betrieb intakt (SW-Dateiliste aktuell, `CACHE`/`APP_VERSION` erhöht bei Client-Änderung).
      **`APP_VERSION` immer erhöhen** – App und `sw.js` vergleichen genau diesen Wert für
      „Nach Updates suchen"; ohne Erhöhung meldet die Prüfung „bereits aktuell".
- [ ] `changelog.md` (und ggf. `pitch.md`/`workbook.md`) aktualisiert
- [ ] Kleiner, beschreibender Commit → push Feature-Branch **und** `main`

---

## 5. Backlog

Priorisierung: **P1** = als Nächstes sinnvoll · **P2** = danach · **P3** = nice-to-have.
Status: ⬜ offen · 🟡 in Arbeit · ✅ erledigt.

### Kürzlich erledigt
- ✅ **Melden = ein Tipp** (v0.36.0, 2026-08-06): Das Issue entsteht unmittelbar beim „Frage
  melden" (im Hintergrund, ohne den Lernfluss zu bremsen); die Meldung erscheint zusätzlich
  wie bisher in der Sammelansicht. Fehlschlag = Meldung bleibt, Nachholen per Knopf in der Liste.
- ✅ **Issues direkt anlegen** (v0.35.0, 2026-08-06): Edge Function `create-issue` als Vermittler
  (GitHub-Token als Secret, Zugangscode-Prüfung, Dublettenschutz je Frage, 30/h). Die App bleibt
  offen, der Formular-Weg bleibt Rückfallebene. Einrichtung: README → „Issues direkt anlegen".
- ✅ **Meldung als GitHub-Issue** (v0.33.0/0.34.0, 2026-08-06): vorbefüllter Issue-Link – bewusst
  **ein Issue je Frage** (Sammel-Issue wieder entfernt), mit Merkhilfe „Issue vorbereitet";
  ohne Token/Server in der App. Zielrepo per `config.js` (`feedbackRepo`),
  bewusst das **private** `Secret`-Repo, weil der Issue-Text den geschützten Fragetext enthält.
- ✅ **Meldungen → Backlog** (v0.32.0, 2026-08-05): Der Export der gemeldeten Fragen ist jetzt
  ein Markdown-Backlog zum Abhaken; `tools/reports-to-backlog.mjs` führt ihn verlustfrei mit
  `docs/fragen-backlog.md` zusammen (Abgehaktes bleibt abgehakt, Handnotizen bleiben stehen).
- ✅ **„Nach Updates suchen"** (v0.31.0, 2026-08-05): Knopf in den Einstellungen holt die auf
  GitHub Pages liegende Fassung sofort (Service-Worker-Befehl `REFRESH_SHELL` + Versionsvergleich),
  statt bis zum übernächsten Start zu warten – Neuinstallieren der iPhone-App entfällt.
  Getestet inkl. simuliertem Deploy mitten im Testlauf.
- ✅ **Fragen als „fragwürdig" melden** (v0.30.0, 2026-08-05): Melde-Knopf unter jeder Frage
  (Übung + Prüfungs-Auswertung) mit kleinem Dialog für einen optionalen Kommentar – ohne die
  Frage zu verlassen; Sammelansicht in den Einstellungen mit Notiz je Frage,
  Kopieren/Export als Markdown, Sync über Geräte (jüngerer Zeitstempel gewinnt, Grabstein beim
  Aufheben). Nebenbei behoben: Sanitisierung bei `localStorage`-Katalog und der seit
  `contentGated: true` blockierte Testlauf (`tests/seed-content.mjs`).
- ✅ **Geräteübergreifende Synchronisation** (Cloud-Sync via Supabase, Sync-Code, verlustarmer Merge) — v0.2.0, 2026-07-13
- ✅ **Robustheits-Paket** (v0.3.0, 2026-07-13): Migrations-Gerüst · defensive Zustands-Sanitisierung ·
  Fehler-Boundary · Sofort-Speichern beim Schließen · Sync-Härtung (Retry/Backoff, „ausstehend") ·
  Reset inkl. Cloud · lokales Backup (Export/Import) · Update-Banner · iOS-konforme UI (Modal/Banner)
- ✅ Supabase-Funktionen-Härtung dokumentiert (Größenlimit, Code-Längen-Prüfung)
- ✅ **iOS-Design-Update** (v0.4.0, 2026-07-13): SVG-Icon-Set (SF-Symbols-Stil) statt Emoji,
  Large-Title mit Scroll-Collapse, inset-gruppierte Listen, iOS-Farbsystem (OLED-Dark),
  Scroll-Reset bei Ansichtswechsel
- ✅ **Bugfix Reset** (v0.4.0): geteilte Objekt-Referenz behoben – Reset leert nun vollständig

### 🔬 Aus Experten-Workshop (2026-07-13, kuratiert)
Vollständiger Bericht: `docs/experten-workshop-2026-07-13.md`. Kuratiert unter den
Leitplanken **kostenlos · nur wenige Personen · Robustheit & Usability wichtig**.

**Abarbeitungsstrategie:** siehe `docs/arbeitsstrategie.md` (Methode, Definition of Done, Phasenplan).

**Empfohlene Umsetzungsreihenfolge (vereinbart 2026-07-13):**
0. ✅ **Sicherheitsnetz** (Test-Infrastruktur `tests/`, `bash tests/run.sh`) – erledigt 2026-07-13
1. ✅ **Quick Wins** (Usability & Robustheit) → v0.7.0 – erledigt 2026-07-13
2. ✅ **RPC-Härtung + leichter Datenschutz-Hinweis** (schließt die Cloud/Push-Fläche) → v0.8.0 (2026-07-13)
3. **Modul-Split + Test-Harness (Sicherheitsnetz)** – vor den großen Features
4. Große P1-Features: ✅ echter Prüfungsmodus (v0.9.0) → ✅ Spaced Repetition + Mastery (v0.10.0) → ✅ Fragetyp-Abstraktion + Rechenaufgaben (v0.11.0) → ✅ Quiz-Barrierefreiheit (In-place-Toggle + ARIA, v0.12.0) → als Nächstes: P2-Paket (Onboarding/Tagesziel, faire Streak, Zurück-Navigation, Modul-Split, Cache-Robustheit …)
5. Parallel/laufend: fachliche Gesamt-Review der Fragen + Content-Ausbau (sobald Material da ist)

**Bekannte Risiken durch bisherige Umsetzung (ehrlich dokumentiert, alle im Backlog adressiert):**
- Cloud/Push = neue Datenverarbeitung + offene anon-Endpunkte (Capability-Schutz per geheimem Code) → RPC-Härtung + Datenschutz-Hinweis (Schritt 2).
- ~~Manuelles SW-Cache-Versionieren ist fehleranfällig (einmal vergessen)~~ → ✅ behoben (v0.17.0): stale-while-revalidate, stabiler Cache-Name.
- network-first ohne Timeout → „lie-fi"-Start-Hänger → Fetch-Timeout (Quick Wins).
- Kein automatisches Test-Netz im Repo; app.js wächst als Monolith → Modul-Split + Test-Harness (Schritt 3).
- Server-Versand (Push/Reminder-Zeitlogik, Abo-Aufräumen) nie end-to-end getestet (Sandbox-Limit) → auf dem Gerät verifizieren.

**P1 – als Nächstes:**
- ✅ **Quick Wins (Paket)** (v0.7.0): Pinch-Zoom entsperrt · verpasste richtige Antwort sichtbar (grünes Häkchen + Label) ·
  Level-Up-Moment · SW-Fetch-Timeout (lie-fi) · Screenreader-Basics (aria-live, :focus-visible, reduced-motion) ·
  Kontrast --text-faint ≥4,5:1 · Reset als roter Button + Quiz-confirm → iOS-Dialog · NaN-XP-Schutz · theme-color angeglichen
- ✅ **Fachkorrektur the-004** (Strahlentherapie ist lokal, nicht systemisch) – v0.7.0
- ⬜ **Fachliche Gesamt-Review** aller Fragen gegen UICC 8. Aufl., ICD-O-3, ICD-10-GM, oBDS-Begriff (CUP-Kode, pM0 prüfen)
- ✅ **Fragetyp-Abstraktion** (v0.11.0): zentrale `hasResponse`/`gradeQuestion` je Typ – Enabler für neue Aufgabentypen (single/multi unverändert)
- ✅ **Echter Prüfungsmodus** (Timer, kein Sofort-Feedback, freie Navigation/Flaggen, Themen-Blueprint, Sammelauswertung) + **Session-Persistenz** — v0.9.0
- ✅ **Spaced Repetition + mehrstufige Mastery** (v0.10.0): Leitner-Boxen 0–5 (1/3/7/16/35 Tage),
  „Fällige Wiederholungen" mit „heute fällig", Mastery „sicher" ab Box 3, Schema-v2-Migration ohne
  Datenverlust, Box/Fälligkeit im Merge. Offen (später): Push an Fälligkeit koppeln (heute Fixzeit)
- 🟡 **Anwendungs-/Kodier-/Rechenaufgaben** (numeric/code-Eingabe): ✅ **numeric** end-to-end
  (Übung + Prüfung) mit 4 ersten Rechenaufgaben (v0.11.0). Offen: **Text/Code-Eingabe** (ICD-O/ICD-10)
  + mehr Rechenaufgaben, sobald Material da ist
- ✅ **Quiz barrierefrei & robuster** (v0.12.0): In-place-Toggle statt Full-Re-Render, ARIA-Rollen
  (radiogroup/checkbox + aria-checked), Tastatur (Pfeile/Home/End/Leertaste, Roving-Tabindex),
  Ergebnis-Fokus.
- ✅ **Prüfungsansicht barrierefrei & in-place** (v0.13.0): gleiches Muster wie Übung (geteilte
  Tastatur-/Auswahllogik), „beantwortet"-Zähler aktualisiert in-place.
- ✅ **Desktop-Darstellung** (v0.13.0): App ab 700 px als zentrierte Spalte auf abgesetztem
  Hintergrund (Kopf-/Aktionsleiste ausgerichtet); iPhone-Vollbild unverändert.

**P2 – danach:**
- ✅ Onboarding-Flow + Tagesziel (v0.15.0): Erststart-Begrüßung + tägliches Lernziel mit
  Fortschrittsring (geräte-lokal). Offen: Statistik/Historie über Zeit
- ✅ Faire Streak (v0.14.0): Gnadentag (ein verpasster Tag erlaubt) + Rekord-Serie (bestStreak)
- ✅ Native Zurück-Navigation (v0.19.0): pushState/popstate, Quiz/Prüfung mit Bestätigung, Ergebnis ersetzt Ansicht
- 🟡 **app.js Module + Test-Harness + Fragen-CI-Check**: ✅ Node-Test-Harness (tests/) + Fragen-CI-Check
  (GitHub Actions, v0.27.0). Modul-Split **bewusst zurückgestellt**: hohes Regressionsrisiko am
  laufenden Monolithen ohne Nutzen für die Funktion – die Testabdeckung sichert die Korrektheit.
- ✅ Cache-Robustheit (v0.17.0): stale-while-revalidate für die App-Shell + reg.update +
  no-cache-Revalidierung; stabiler Cache-Name → kein manuelles Cache-Bumpen mehr. Neuer
  SW-/Offline-Test (`tests/sw-cache.mjs`).
- ⬜ Distraktoren/Items nach Item-Writing-Standards überarbeiten (Nonsens-Distraktoren, Test-Wiseness)
- ⬜ Content-Ausbau ≥15–20 Fragen/Thema inkl. neuem Thema **OPS/Prozeduren** (wartet teils auf Material)
- ✅ anon-RPCs verpflichtend härten (Größen-/Längen-Check) + `codeExists` entfernt (v0.8.0; SQL: supabase/sync-hardening.sql)
- ✅ Badge-Rebalancing + Erstmeisterungs-Bonus-XP (v0.22.0): 3 SRS-/Rekord-Erfolge, +15 XP bei Erstmeisterung

**P3 / optional:**
- ⬜ Konfidenz-Tap + Kalibrierungs-Feedback (Metakognition)
- ✅ Leichter Datenschutz-/Transparenz-Hinweis + „inoffiziell"-Disclaimer in der App (v0.8.0)
- ✅ In-App „Cloud-Daten löschen" (v0.23.0): leert die Cloud-Zeile + trennt, lokal bleibt

**Kleinere Befunde & Cleanup (P3) – die restlichen Einzelpunkte aus dem Bericht:**
- 🟡 Robustheit: ✅ Precache tolerant (v0.18.0) · ✅ QuotaExceeded-Hinweis (v0.18.0) · ✅ `perQuestion`-Whitelist (v0.18.0) · ✅ SW-Fetch same-origin (v0.17.0) · offen: `difficulty` in DATA_OK (Laufzeit ist bereits gegen NaN-XP abgesichert; von `validate-questions` geprüft)
- 🟡 Barrierefreiheit (ergänzend): ✅ `modalChoice` role=dialog + Fokusfalle + Escape (v0.21.0) · ✅ progressbar-Rollen (v0.21.0) · ✅ doppeltes `<h1>` entdoppelt (v0.21.0) · ✅ größere Schrift wählbar (v0.27.0); Dynamic Type (volle rem-Umstellung) bewusst zurückgestellt (Risiko am Monolithen)
- ✅ UI-Cleanup (v0.25.0): Fortschrittsbalken zeigt Position · Install-Tip-Icon monochrom · theme-color an Hintergrund angeglichen · Dead-CSS entfernt · master-Test vereinfacht (v0.22.0). Offen: Toast-Emojis (bewusst gelassen – transiente Mikro-Rückmeldung)
- ⬜ Lern-Feinheiten: „Schwachstellen" enthält auch nie gesehene Items → Benennung/Trennung schärfen · antwortspezifisches Feedback (später) · Session-Größe/Dosierung an Tagesziel koppeln
- ⬜ Fachliche Detailpunkte (in die Gesamt-Review): CUP-Kode C80.- prüfen · organspezifisches Grading · Meldefristen/Meldevergütung/Vertrauensstelle ergänzen · difficulty-Labels konsistent

**Verworfen (Leitplanke „nur wenige Personen / kostenlos"):**
- ❌ Kurs-/Lerngruppen-Code + Kohorten-Leaderboard (B2B2C-Skalierung)
- ❌ Teilen-Button/QR-Code (Verbreitung) · ❌ Voll-Impressum/AVV/Umbenennung (erst bei öffentlicher Verbreitung)
- ❌ Rate-Limiting der RPCs · ❌ Retention-Cron + Fragen-Index/Memoisierung (erst bei Skalierung)
- ❌ Nutzungs-Analytik/Funnel-Metriken + Landingpage/Store-Auffindbarkeit (bewusst datensparsam, nur wenige Nutzer)

_Vollständige Einzelbefunde (101) mit Fundstelle: `docs/experten-workshop-2026-07-13.md`._

### 📬 Aus der ADT-Prüfungsmail (2026-08-18) — erste autoritative Ablaufbeschreibung

Die Einladungsmail der ADT-Geschäftsstelle nennt erstmals **Gewichtung, Aufgabenformate und
Ablauf** der echten Prüfung. Abgleich mit App + Katalog: drei Bestätigungen, drei echte Lücken.

**Die Eckdaten:** 15.09.2026, 13:00–16:15 Uhr, Berlin, notarielle Aufsicht ·
**Gewichtung: Allgemein/Klinik 40 % · Codierung 50 % · Statistik 10 %** ·
Formate: MC-Fragen, Rechenaufgaben, **Eingabe von Codes** ·
Ablauf: **Teil I 120 Min. mit TNM-Buch**, 15 Min. Pause, **Teil II 60 Min. ohne** ·
Taschenrechner wird gestellt, ICD-10/ICD-O-3/OPS liegen als **durchsuchbare PDFs** im Portal.

**✅ Bestätigt (kein Handlungsbedarf):**
- **Bestehensgrenze 50 %** — die PO im Repo sagt wörtlich „mindestens 50 % der möglichen
  Punkte". Unsere hartcodierte Grenze ist korrekt; der offene Punkt aus dem Experten-Workshop
  („nicht gegen die reale PO belegt") ist damit **erledigt**.
- **Relevanz-Runde E war richtig.** Dass ICD-10/ICD-O-3/OPS in der Prüfung als durchsuchbare
  PDFs vorliegen (die Mail nennt sogar STRG+F), belegt nachträglich die Entscheidung, 264 reine
  Kode-Abfragen zu streichen — genau das schlägt man in der Prüfung nach.
- **180 Minuten, MC + Rechenaufgaben, Alles-oder-nichts** — deckt sich mit PO, Docs und Katalog
  (3.335 multi · 1.476 single · 732 numeric).

**✅ P1 — Prüfungssimulation: Blueprint auf 40/50/10** (erledigt v0.40.0, 2026-08-18).
`buildExamQuestions()` vergibt faktisch **eine Frage je Thema** (111 Themen → daraus 30 zufällig),
gewichtet also nach *Themenzahl* statt nach Prüfungsrelevanz. Ergebnis: **~53 % Klinik ·
~41 % Codierung · ~6 % Statistik** statt 40/50/10 — in einer 30er-Simulation rund
**12 Codierungsfragen statt 15**. Codierung ist die Hälfte der Prüfung und der am schwächsten
getestete Block. Nötig: Themen → Prüfungsblock zuordnen (Tabelle, ~111 Einträge; TNM/Staging/
Grading gehören zu Codierung, auch wo der Themenschlüssel das nicht hergibt) und die Ziehung
blockweise quotieren (12/15/3), innerhalb des Blocks über Themen streuen.
**Erledigt:** Ziehung jetzt 12/15/3, innerhalb des Blocks über Themen gestreut, mit
Umverteilung bei zu kleinen Blöcken; Ergebnis je Block in der Auswertung sichtbar.
6 Regressionstests sichern die Gewichtung ab.

**⬜ P1 — Aufgabentyp „Code eingeben" fehlt vollständig.**
Die Mail nennt ihn als drittes Format neben MC und Rechenaufgabe. Die App kennt nur
`single`/`multi`/`numeric` — eine Eingabe wie `C50.4` oder `8500/3` ist nirgends übbar.
Das ist **die eigentliche Prüfungskompetenz**: mit den PDFs nachschlagen und den richtigen Kode
eintragen. Deckt sich mit dem 🔴-hoch-Fund des Experten-Workshops („Fallvignette → Kodierung
wird nicht geübt") und mit dem bereits offenen Punkt „Freitext/Code-Eingabe" unter *Inhalt*.
Realistisch in Stufen: (a) Aufgabentyp `code` mit Normalisierung/Toleranz (Punkt vs. Komma,
Groß-/Kleinschreibung), (b) 20–30 Fallvignetten als Startbestand, (c) Ausbau.

**⬜ P2 — Simulation als Zweiteiler.**
Real: 120 Min. (mit TNM-Buch) + 15 Min. Pause + 60 Min. (ohne). App: 45 Min. am Stück
(30 × 90 Sek.), kein Teilwechsel. Für die Formatgewöhnung reicht eine „Light"-Fassung:
zwei Abschnitte mit Pausen-Hinweis und Banner „TNM-Buch erlaubt / nicht erlaubt", echte
Länge optional zuschaltbar. Der Ausdauer-Aspekt (120 Min. am Stück) wird bisher von keinem
Feature geübt.

**⬜ P2 — Katalog-Gewichtung an die Prüfung angleichen.**
Konkretisiert den bestehenden Punkt „Fragenzahl je Thema ausbauen": Codierung liegt bei
**41 % (2.281 Fragen)**, soll 50 % — Statistik bei **6 % (330)**, soll 10 %. Zum Ausgleich
müssten grob **+500 Codierungs-** und **+250 Statistik-Fragen** entstehen (oder Klinik
ausgedünnt werden). Anders als der Blueprint-Fix (P1) betrifft das den Katalog selbst und ist
damit die teurere, aber nachhaltigere Hälfte derselben Sache.

**⬜ P2 — „Prüfungsbereitschaft" nachkalibrieren (hängt an P1).**
Das Feature (v0.39.1) stützt sein „Bereit" auf zwei Kriterien: Lernstand **und** die letzten
zwei Simulationen ≥ 65 %. Solange die Simulation die falsche Mischung testet, ist der zweite
Nachweis genau dort am dünnsten, wo die Prüfung am schwersten wiegt — „Bereit" kann aufleuchten,
während Codierung noch schwach ist. Nach dem Blueprint-Fix prüfen, ob 65 % die richtige Hürde
bleibt, und ggf. **je Block** eine Untergrenze fordern (z. B. Codierung ≥ 50 %).

**⬜ P3 — TNM-Buch als Hilfsmittel abbilden.**
Neu und in der PO **nicht** erwähnt (die nennt nur ICD-10/ICD-O-3/OPS): In Teil I ist das
TNM-Buch zugelassen, in Teil II nicht. Konsequenz für den Katalog: reine TNM-Grenzwerte
(T2 > 2 cm o. ä.) sind in Teil I nachschlagbar — welcher Stoff in welchem Teil drankommt, sagt
die Mail aber nicht. Vor einer Streichrunde analog zu Runde E daher **erst klären**, sonst
fliegt Stoff, der in Teil II ohne Buch gebraucht wird.

**Sofort ohne Code-Änderung (für die Lernenden):**
Codierung bewusst übergewichten (via „Nach Thema lernen") — die halbe Prüfung ist Codierung und
dank Nachschlage-PDFs die am besten trainierbare Hälfte. Und: Pomodoro-Ziel auf 1–2 Runden
stellen, der Standard (4 Runden ≈ 2 Std.) passt nicht zu 30 Min./Tag.

### Inhalt (größter Hebel für Prüfungsnähe)
- ⬜ **P1** Offizielle / alte / Beispiel-Prüfungsfragen einarbeiten (Material von Nico)
- ⬜ **P1** Kurs-Skript / Schulungsunterlagen als Quelle für neue Fragen nutzen
- 🟡 **P1** **Rechen- und Dokumentationsaufgaben** als eigener Aufgabentyp: ✅ Zahl-Eingabe (v0.11.0);
  offen: Freitext/Code-Eingabe + Ausbau des Aufgabenbestands
  → **durch die Prüfungsmail bestätigt und konkretisiert**, siehe „Aufgabentyp „Code eingeben"" oben
- ⬜ **P2** Fragenzahl je Thema ausbauen und Gewichtung an Prüfungsrelevanz anpassen
  → **Zielzahlen jetzt bekannt** (40/50/10), siehe „Katalog-Gewichtung" oben
- ⬜ **P3** Quellen-/Referenzangabe je Frage (z. B. „ICD-O-3, Regel …")

### Funktionen (aus Abstimmung 2026-07-13 — „machen wir später")
- ✅ **P1** **Echter Prüfungsmodus** (v0.9.0, erledigt): Timer, kein Sofort-Feedback,
  Fragen-Navigation + Markieren/Flaggen, „Abgeben" → volle Auswertung mit Erklärungen
- ✅ **P1** **Spaced Repetition (Leitner-System)** (v0.10.0): fällige Wiederholungen mit optimalen
  Abständen; Startseite zeigt „heute fällig"
- 🟡 **P2** **Einstellungen**: ✅ Fragenanzahl wählbar + Hell/Dunkel-Umschalter (v0.20.0), Backup (v0.3.0);
  offen: Sofort-Feedback an/aus (bewusst zurückgestellt – der Prüfungsmodus bietet bereits das Ohne-Feedback-Erlebnis)
- 🟡 **P2** **Statistik & Tagesziel**: ✅ tägliches Lernziel mit Fortschrittsring (v0.15.0);
  ✅ Trefferquote je Thema + Prüfungs-Historie (v0.24.0)

### Neu / offen
- ✅ **Info-/Anleitungs-Reiter** „So funktioniert's" (v0.6.0, 2026-07-13): erklärt Modi,
  Prüfungsformat, Belohnungen, Sync, Erinnerungen, Installation.
- ✅ **Lern-Erinnerungen** (v0.5.0): Client + Service Worker + Edge Function + stündlicher Zeitplan.
  Serverseitig eingerichtet und **auf dem Gerät verifiziert** (echter Push kam an) — 2026-07-13.

### Feinschliff (aus Abstimmung 2026-07-13 — „machen wir später")
- ✅ **P2** **Tastatur-Steuerung** (v0.21.0): Zahlen 1–9 wählen, Enter prüft/weiter (Übung + Prüfung)
- ✅ **P3** **Sanfte Animationen** (v0.26.0): Frage-Einblendung + Konfetti bei bestandener Prüfung
- 🟡 **P3** **Haptik & Sound**: ✅ Haptik abschaltbar (v0.26.0); Sound bewusst weggelassen (iPhone-Einschränkung, störend)
- ✅ **P2** **Barrierefreiheit** (v0.21.0/0.27.0): größere Schrift wählbar, ARIA/Rollen, Tastatur, Fokus, Kontraste

### Technik / Betrieb
- ✅ **Reset erweitern**: „überall (Cloud) / nur dieses Gerät" umgesetzt (v0.3.0)
- ✅ **In-App-Hinweis „neue Version verfügbar"** bei Service-Worker-Update (v0.3.0)
- ✅ **P3** Merge des Arbeits-Branches auf `main` (jeder Release wird per Fast-Forward auf `main` deployt)
- ✅ **P3** Automatischer Konsistenz-Check der Fragen (CI, v0.27.0: .github/workflows/ci.yml)

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
| 2026-07-13 | **Mehrbenutzer über unabhängige Sync-Codes** – kein Account-System | Jeder Code = eigener, unabhängiger Fortschritt auf beliebig vielen Geräten. Ein Gerät = ein Profil; getrennte Nutzer = getrennte Codes. Einfachste robuste Lösung (Nutzerentscheidung). |

---

## 8. Offene Fragen

- Findet die Prüfung weiterhin am Laptop statt (→ Tastatur-Steuerung sinnvoll)?
- Gibt es eine offizielle Themen-/Gewichtungsvorgabe der ADT?

## 9a. Nutzermodell (entschieden)

Ein Profil pro Gerät (localStorage). Geräteübergreifend & mehrbenutzerfähig über
**Sync-Codes**: jeder Code trägt einen eigenen, unabhängigen Fortschritt. Getrennte
Personen verwenden getrennte Codes → vollständig isoliert. Kein Login/Account nötig.
Benannte lokale Profile auf einem Gerät sind bewusst nicht umgesetzt (P3, nur falls je gewünscht).
