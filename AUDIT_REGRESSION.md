# Regressionstest ADT-Training — Nachprüfung der Fehlerbehebungen

Stand: 2026-07-27 · Prüfer: automatisierter Durchlauf mit Playwright/Chromium 1.56.1
gegen den echten Katalog · Bezug: `AUDIT_USABILITY.md`, `AUDIT_CODE.md`

**Aufbau:** statischer Server (`python3 -m http.server 8099`) im Repo-Wurzelverzeichnis,
Chromium (`/opt/pw-browsers/chromium`), Viewport 1280×900, Sprache `de-DE`.
Der echte Katalog aus `/home/user/Secret/material/content.json`
(**5977 Fragen · 111 Themen**) wird vor jedem Testlauf direkt in IndexedDB
`adt_content` / Store `kv` / Key `content_v1` geschrieben; dazu in localStorage
`adt_content_idb="1"`, `adt_content_code`, `adt_onboarded="1"`. Supabase ist aus dieser
Umgebung nicht erreichbar und wird zusätzlich blockiert (entspricht „App offen, kein Netz").

**Screenshots:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/reg/`

---

## Überblick

| # | Behebung | erwartet | beobachtet | bestanden |
|---|---|---|---|---|
| 1 | `parseNum` (Quiz + Prüfung) | leeres Feld sperrt „Antwort prüfen"; `1.000`→1000, `1.234,5`→1234.5, `12,5`→12.5; unlesbare Eingabe zeigt `#numHint` | Quiz vollständig erfüllt; Prüfung rechnet korrekt, hat aber **kein** `#numHint`-Element | **teilweise** |
| 2 | Themenliste: 111 Themen, alphabetisch nach Anzeigename, Suchfeld | Sortierung nach Name, `#topicSearch` filtert, `#topicCount` stimmt, Fokus bleibt, Umlaute | alles erfüllt (111 Zeilen, „Kolorektales Karzinom" auf Position 48–51 unter K) | **ja** |
| 3 | Schwachstellen-Modus auf der Startseite | Knopf `[data-act="weak"]` vorhanden, bei frischem Zustand aktiv, Klick startet eine Runde | Knopf vorhanden und aktiv („5977 Fragen noch nicht sicher"), Klick startet `SESSION.mode="weak"` | **ja** |
| 4 | Fortschritt bleibt bei IndexedDB-Verlust erhalten | Fehlerbildschirm „Inhalte nicht ladbar" mit beiden Knöpfen, `adt_trainer_state_v1` unverändert | Fehlerbildschirm da, `WRITE_LOCK=true`, Speicherstand **byte-identisch** (200 → 200 Einträge) | **ja** |
| 5 | Unbekannte IDs werden geparkt statt gelöscht | `zzz-999` landet unter `orphanQuestions`; nach Aufnahme in den Katalog zurück in `perQuestion` | genau so, Werte unverändert (seen 7 / correct 5 / wrong 2 / box 1 / due 2026-07-30) | **ja** |
| 6 | Beschädigter Speicherstand | Wiederherstellung aus `.bak`, Hinweis, Rohwert unter `.corrupt.*` | alles erfüllt (42 Einträge zurück, Toast „Fortschritt aus Sicherungskopie wiederhergestellt", `adt_trainer_state_v1.corrupt.<ts>` angelegt) | **ja** |
| 7 | Fehlerhafte Frage killt die App nicht | Start mit 5976 Fragen + Hinweis „1 fehlerhafte Frage(n) übersprungen" | genau so; Daten-Fehler-Bildschirm kommt nur noch, wenn **keine** Frage gültig ist | **ja** |
| 8 | Regression allgemein | Start, Mischtraining, Prüfung, Statistik, Backup, Theme, Offline — ohne Konsolenfehler | alles funktionsfähig; 0 `pageerror`, 0 unbehandelte Promise-Rejections | **ja** |

---

# Details

## 1 — `parseNum` (js/app.js:679)

**Screenshots:** `reg/01-quiz-leer-nach-12.png` · `reg/02-quiz-abc-hinweis.png` ·
`reg/03-quiz-1000.png` · `reg/04-exam-numeric.png`

**Aufbau:** Übungsrunde über das Thema `deskstat_ueberlebenszeitanalyse`
(39 von 65 Fragen sind `numeric`), erste numeric-Frage `deskstat-b4-029`.
Wichtig: die erwartete Antwort dieser Frage ist **0** — genau der Fall, in dem die
Altlast „leeres Feld = 0" fälschlich „Richtig" gemeldet hätte.

### 1a — Direktaufruf `parseNum()`

| Eingabe | Ergebnis | erwartet | ok |
|---|---|---|---|
| `""` | `NaN` | `NaN` | ja |
| `"   "` | `NaN` | `NaN` | ja |
| `"12"` | `12` | `12` | ja |
| `"1.000"` | `1000` | `1000` | ja |
| `"1.234,5"` | `1234.5` | `1234.5` | ja |
| `"12,5"` | `12.5` | `12.5` | ja |
| `"12.5"` | `12.5` | `12.5` | ja |
| `"1 000"` | `1000` | `1000` | ja |
| `"1.000,00"` | `1000` | `1000` | ja |
| `"-1.000"` | `-1000` | `-1000` | ja |
| `"0"` | `0` | `0` | ja |
| `"abc"` | `NaN` | `NaN` | ja |
| `"1.2.3"` | `NaN` | `NaN` | ja |
| `"75 %"` | `NaN` | `NaN` | ja |

### 1b — Quiz (`#numField`, `setNumericResponse`)

Eingabe jeweils echt getippt, Knopfzustand und `#numHint` danach ausgelesen.

| Eingabe | `SESSION.picks` | „Antwort prüfen" | `#numHint` | bestanden |
|---|---|---|---|---|
| `12` | `[12]` | aktiv | verborgen | ja |
| **vollständig gelöscht nach `12`** | `[]` | **deaktiviert** | verborgen | **ja** |
| `1.000` | `[1000]` | aktiv | verborgen | ja |
| `1.234,5` | `[1234.5]` | aktiv | verborgen | ja |
| `12,5` | `[12.5]` | aktiv | verborgen | ja |
| `12.5` | `[12.5]` | aktiv | verborgen | ja |
| `1 000` | `[1000]` | aktiv | verborgen | ja |
| `abc` | `[]` | deaktiviert | **sichtbar**: „Bitte nur eine Zahl eingeben (Komma oder Punkt als Dezimaltrenner)." | ja |
| `1.2.3` | `[]` | deaktiviert | **sichtbar**, gleicher Text | ja |
| `75 %` | `[]` | deaktiviert | **sichtbar**, gleicher Text | ja (behebt zusätzlich U-N1) |

Das `#numHint`-Element ist im Quiz vorhanden (`role="alert"`), wird nur bei unlesbarer
Eingabe eingeblendet und bei leerem Feld wieder ausgeblendet — ein geleertes Feld gilt
also als „noch nicht geantwortet", nicht als Fehler. Der Fokus bleibt beim Tippen im Feld
(kein Re-Render).

### 1c — Prüfungssimulation (`#examNum`, `examSetNumeric`, js/app.js:1641)

| Eingabe | `EXAM.picks[idx]` | Zähler „Übersicht" | bestanden |
|---|---|---|---|
| `12` | `[12]` | `1/30 beantwortet` | ja |
| **vollständig gelöscht nach `12`** | `[]` | **`0/30 beantwortet`** | **ja** |
| `1.000` | `[1000]` | `1/30` | ja |
| `1.234,5` | `[1234.5]` | `1/30` | ja |
| `12,5` | `[12.5]` | `1/30` | ja |
| `abc` | `[]` | `0/30` | rechnerisch ja, **ohne Hinweis** |
| `1.2.3` | `[]` | `0/30` | rechnerisch ja, **ohne Hinweis** |

### Bewertung Punkt 1: **teilweise bestanden**

Die Zahlenauswertung selbst ist in beiden Modi korrekt behoben — alle geforderten
Fälle stimmen, das leere Feld wird nirgends mehr als `0` gewertet.

**Abweichung:** Die Prüfungsansicht rendert **kein `#numHint`-Element**
(`document.querySelectorAll('#numHint').length` → `0`; siehe `js/app.js:1674-1690`,
der numeric-Zweig von `renderExam()` enthält nur `.num-input` ohne Hinweiszeile,
und `examSetNumeric()` schreibt auch keinen Hinweis). Tippt ein Prüfling `abc` oder
`1.2.3`, verschwindet die Frage **kommentarlos** aus dem Zähler „Übersicht · n/30
beantwortet" — es gibt in der Prüfung keinen gesperrten Knopf, an dem das auffiele,
und keine rote Meldung. Der Prüfling gibt die Frage unbeantwortet ab, ohne es zu merken.
Im Quiz ist derselbe Fall sauber gelöst.

---

## 2 — Themenliste: Sortierung nach Anzeigename + Suchfeld (js/app.js:1326-1372)

**Screenshots:** `reg/05-themen-sortiert.png` · `reg/06-themen-suche-kolo.png` ·
`reg/07-themen-umlaut.png` · `reg/08-themen-kein-treffer.png` · `reg/09-themen-klick-gefiltert.png`

Geöffnet über die Startseite („Nach Thema lernen", `[data-act="topics"]`), nichts injiziert.

### 2a — Anzahl und Sortierung

- **111 `.topic-row`-Zeilen** gerendert (erwartet 111). ✔
- Reihenfolge stimmt exakt mit `namen.sort(localeCompare(…, "de"))` überein → **`sortedByName = true`**. ✔
- Nach internem Schlüssel sortiert wäre sie **nicht** (`sortedByKey = false`) → die alte
  Schlüsselsortierung ist wirklich weg. ✔

Kopf der Liste:
`Analytische Statistik – Grundlagen & Wahrscheinlichkeit` · `… – Hypothesentests & Schätzung` ·
`… – Überlebenszeitanalyse` · `Basisdokumentation – Grundlagen & Diagnosedaten` · …
Ende: `TNM-Wissen – Präfixe & Zusatzangaben` · `Vulva- & Vaginalkarzinom` · `Zervixkarzinom`.

### 2b — „Kolorektales Karzinom" steht unter K

Erste Kolorektal-Zeile auf **Index 47** (48. von 111). Umgebung:

| Pos | Anzeigename | interner Schlüssel |
|---|---|---|
| 45 | Klassifikation & Qualität – Klinische Dokumentation | `klassqual_klinische_dokumentation` |
| 46 | Klassifikation & Qualität – TNM-Klassifikation | `klassqual_tnm_klassifikation` |
| **47** | **Kolorektales Karzinom – Chirurgie & Therapie** | **`darm_chirurgie_therapie`** |
| **48** | **Kolorektales Karzinom – Diagnostik, Lokalisation & Dokumentation** | **`darm_diagnostik_…`** |
| **49** | **Kolorektales Karzinom – Grundlagen & Epidemiologie** | **`darm_grundlagen_epidemiologie`** |
| **50** | **Kolorektales Karzinom – TNM & Staging** | **`darm_tnm_staging`** |
| 51 | Krebsregister – Datenmanagement | `kregister_datenmanagement` |

Alle vier `darm_*`-Themen stehen zwischen „Klassifikation…" und „Krebsregister…", also
unter **K** und nicht mehr unter **D**. ✔

### 2c — Suchfeld `#topicSearch` und Zähler `#topicCount`

Feld vorhanden (`type="search"`, `aria-label="Themen durchsuchen"`),
Zähler vorhanden (`aria-live="polite"`).

| Eingabe | Treffer | `#topicCount` | Fokus danach | ok |
|---|---|---|---|---|
| (leer) | 111 | `111 von 111 Themen` | – | ja |
| `kolo` | 10 | `10 von 111 Themen` | `topicSearch` | ja (Teilstring, greift auch in „Gynä**kolo**gische", „Neuroon**kolo**gie") |
| `Kolorektales Karzinom – T` | 1 | `1 von 111 Themen` | `topicSearch` | ja (Gedankenstrich stört nicht) |
| `strahlen` | 8 | `8 von 111 Themen` | `topicSearch` | ja |
| `Zervix` | 1 | `1 von 111 Themen` | `topicSearch` | ja |
| `xyzq` | 0 | `0 von 111 Themen` | `topicSearch` | ja, dazu „Kein Thema gefunden." |

Der Zähler stimmt in allen Fällen mit der tatsächlichen Zeilenzahl überein.

### 2d — Fokus bleibt beim Tippen im Feld

Zeichenweise `strahlen` über die echte Tastatur getippt, nach **jedem** Zeichen
`document.activeElement.id` gelesen: 8×`topicSearch`, kein einziger Fokusverlust.
Die Cursorposition wandert korrekt mit (`selectionStart = 8` nach 8 Zeichen), also
funktioniert das `setSelectionRange`-Wiederherstellen nach dem Re-Render. ✔

### 2e — Umlaute

| Eingabe | Treffer | Beispieltreffer |
|---|---|---|
| `Überleben` | 2 | Analytische/Deskriptive Statistik – Überlebenszeitanalyse |
| `überleben` (klein) | 2 | dieselben → Groß/Klein egal |
| `Ü` (einzelnes Zeichen) | 2 | dieselben |
| `Gynäkolog` | 5 | Gynäkologische Tumoren – … |
| `Lymphgefäße` / `lymphgefäße` | 1 / 1 | TNM-Wissen – Lymphgefäße & Metastasen (`ß` funktioniert) |
| `Präfixe` / `präfix` | 1 / 1 | TNM-Wissen – Präfixe & Zusatzangaben |
| `Qualität` | 5 | Klassifikation & Qualität – … |
| `TNM-Lösungen` | 1 | TNM-Lösungen VIII – Prostata Fallbearbeitung (es gibt nur eines) |
| `ä` | 19 | alle Themen mit `ä` im Namen |

Gegenprobe: `ösophag`, `Weichteil`, `Prüf` liefern 0 Treffer — im Katalog existiert
kein solches Thema, das Ergebnis ist also richtig.

### 2f — Gefilterte Zeile ist weiterhin klickbar

Nach `Zervix` auf die verbleibende Zeile geklickt → Übungsrunde startet,
`SESSION.mode = "topic"`, `SESSION.topic = "gyn_zervix"`, 15 Fragen. ✔

### Bewertung Punkt 2: **bestanden**

Keine Konsolenfehler, keine Promise-Rejections.

**Zwei Randbemerkungen (kein Fehlschlag, keine Regression):**
- Die Liste ist mit Suchfeld weiterhin **7024 px** hoch, wenn nicht gefiltert wird
  (U-H2 nannte 6964 px). Das Suchfeld macht sie auffindbar, kürzt sie aber nicht;
  eine Gruppierung/ein Alphabet-Index fehlt nach wie vor.
- Die Suche faltet **keine Umlaute**: `qualitat` (ohne ä) findet „Qualität" nicht
  (0 Treffer), `Ueberleben` findet „Überlebenszeitanalyse" nicht. Wer auf einer
  Tastatur ohne Umlaute tippt oder `ue`/`ae`/`oe` gewohnt ist, geht leer aus.

---

## 3 — Schwachstellen-Modus auf der Startseite (js/app.js:1049, 1077)

**Screenshots:** `reg/10-start-schwachstellen-knopf.png` · `reg/11-schwachstellen-runde.png` ·
`reg/12-schwachstellen-alles-sitzt.png`

| Prüfung | erwartet | beobachtet | ok |
|---|---|---|---|
| Knopf existiert | `[data-act="weak"]` auf der Startseite | genau **1** Treffer, sichtbar, im Block „ÜBEN" unter „Fällige Wiederholungen" | ja |
| frischer Zustand | Knopf **aktiv** | `disabled`-Attribut nicht gesetzt; `S.perQuestion` = 0 Einträge, `weakQuestions()` = **5977** (= alle Fragen sind „nicht sicher") | ja |
| Beschriftung | verständlich | „**Schwachstellen üben** — 5977 Fragen noch nicht sicher ›" | ja |
| Klick startet Runde | Übungsrunde im weak-Modus | `SESSION.mode = "weak"`, 15 Fragen (= Einstellung „Fragen pro Runde"), `idx = 0`, Fragekarte gerendert, Kopfzeile „1 / 15" | ja |

Gegenproben:

- **Alle Fragen sicher** (`box=5`, `lastResult="correct"` für alle 5977 gesetzt):
  `weakQuestions()` = 0, Knopf **deaktiviert**, Text „Alles sitzt – keine Schwachstellen". ✔
- **Genau eine Frage unsicher**: Knopf wieder aktiv, Text im **Singular**
  „1 Frage noch nicht sicher"; Klick baut eine Runde mit genau **1** Frage
  (`analstat-b1-001`, die zuvor als falsch markierte). ✔

Keine Konsolenfehler, keine Promise-Rejections.

### Bewertung Punkt 3: **bestanden**

---

## 4 — Fortschritt bleibt bei IndexedDB-Verlust erhalten (js/app.js:2400-2420) — Kerntest

**Screenshots:** `reg/13-inhalte-nicht-ladbar.png` · `reg/14-relock-dialog.png` ·
`reg/15-nach-relock-gate.png`

**Ausgangslage:** echter Katalog (5977 Fragen) in IndexedDB, in localStorage ein
`adt_trainer_state_v1` mit Fortschritt zu **200 echten Frage-IDs**
(1900 XP, Serie 4, Rekord 9, 400 beantwortet, 380 richtig, 2 bestandene Prüfungen,
1 Erfolg) — **24 385 Zeichen**, SHA-256 (16) `ee69037c8bc5442b`.

**Kontrollstart (Katalog vorhanden):** `QUESTIONS.length` = 5977,
`S.perQuestion` = **200**, `S.orphanQuestions` = 0, XP = 1900, Startseite normal.
Der Fortschritt kommt also sauber an.

**Eingriff:** nur `indexedDB adt_content / kv / content_v1` gelöscht.
`localStorage.adt_content_idb` bleibt `"1"` (verifiziert). Danach neu geladen.

### Ergebnis nach dem Neuladen

| Prüfung | erwartet | beobachtet | ok |
|---|---|---|---|
| Fehlerbildschirm | „Inhalte nicht ladbar" | „⚠️ **Inhalte nicht ladbar** — Die freigeschalteten Lerninhalte konnten nicht gelesen werden. Dein Lernfortschritt ist gesichert und wird nicht verändert." | ja |
| Knopf 1 | „Erneut versuchen" | `#errReload`, Beschriftung „Erneut versuchen" | ja |
| Knopf 2 | „Inhalte neu freischalten" | `#errRelock`, Beschriftung „Inhalte neu freischalten" | ja |
| Schreibsperre | aktiv | `WRITE_LOCK = true`, `CONTENT_READY = false` | ja |
| kein stiller Beispielkatalog-Betrieb | keine Startseite | Startseite wird gar nicht gerendert (boot bricht ab), obwohl `QUESTIONS.length` intern auf den 59 Beispielfragen steht | ja |

### Speicherstand-Vergleich (der entscheidende Punkt)

| Zeitpunkt | Länge | `perQuestion`-Einträge | XP | SHA-256(16) | identisch mit „vorher" |
|---|---|---|---|---|---|
| **vorher** (Katalog da) | 24 385 | **200** | 1900 | `ee69037c8bc5442b` | – |
| nach Reload mit fehlender IDB | 24 385 | **200** | 1900 | `ee69037c8bc5442b` | **ja, byte-identisch** |
| nach **erzwungenem** `S.xp=99999; saveState(); flushSave()` | 24 385 | **200** | 1900 | `ee69037c8bc5442b` | **ja** — die Schreibsperre hält |
| nach Klick „Erneut versuchen" (IDB weiter leer) | 24 385 | **200** | 1900 | – | **ja**, Fehlerbildschirm erscheint erneut |
| nach Klick „Inhalte neu freischalten" + Bestätigung | 24 385 | **200** | – | – | **ja** |

Vorher/nachher: **200 → 200 Einträge**. Der in U-H1 beschriebene Verlust
(200 → 0 im Speicher, dann 200 → 1 in localStorage nach der ersten Antwort) ist
vollständig behoben; selbst ein bewusst erzwungener `saveState()` schreibt nichts.

**„Inhalte neu freischalten" im Detail:** öffnet den Bestätigungsdialog
(„Die gespeicherten Fragen werden von diesem Gerät entfernt … Dein Lernfortschritt
bleibt erhalten."). Nach „Neu freischalten" sind `adt_content_idb`,
`adt_content_code`, `adt_content_fp` entfernt, der Zugangscode-Bildschirm
(`#gateCode`, „Geschützte Inhalte") erscheint — und `adt_trainer_state_v1` ist
weiterhin unverändert (200 Einträge). Das Versprechen des Dialogs wird also gehalten.

Keine Konsolenfehler, keine Promise-Rejections in der gesamten Kette.

### Bewertung Punkt 4: **bestanden**

---

## 5 — Unbekannte Frage-IDs werden geparkt statt gelöscht (js/app.js:136-150)

**Screenshots:** `reg/16-orphan-geparkt.png` · `reg/17-orphan-zurueckgeholt.png`

**Ausgangslage:** echter Katalog in IndexedDB. `adt_trainer_state_v1.perQuestion`
enthält 3 echte IDs (`analstat-b1-001/-002/-003`) und **2 erfundene**
(`zzz-999`, `fantasie-abc`); `orphanQuestions` ist leer.

### 5a — Laden mit vorhandenem Katalog

| Prüfung | erwartet | beobachtet | ok |
|---|---|---|---|
| `S.perQuestion` | nur die 3 echten IDs | `analstat-b1-001`, `-002`, `-003` | ja |
| `S.orphanQuestions` | `zzz-999`, `fantasie-abc` | genau diese beiden | ja |
| Daten der geparkten IDs | unverändert | `zzz-999` = `{seen:7, correct:5, wrong:2, lastResult:"wrong", box:1, due:"2026-07-30", masteredOnce:false}` — 1:1 wie eingesetzt | ja |
| nach `saveState()`/`flushSave()` in localStorage | Parkplatz wird mitgeschrieben | `orphanQuestions` steht mit beiden IDs samt Werten in `adt_trainer_state_v1` | ja |

Nichts gelöscht — die alte Variante hätte beide Einträge beim ersten Speichern verworfen.

### 5b — `zzz-999` in den Katalog aufgenommen, erneut geladen

Katalog um eine echte Frage mit `id: "zzz-999"` ergänzt (5978 Fragen), neu geladen:

| Prüfung | erwartet | beobachtet | ok |
|---|---|---|---|
| `QUESTIONS.length` | 5978 | 5978 | ja |
| `S.perQuestion` | enthält jetzt `zzz-999` | `analstat-b1-001`, `-002`, `-003`, **`zzz-999`** | ja |
| Werte von `zzz-999` | zurückgeholt, unverändert | `{seen:7, correct:5, wrong:2, lastResult:"wrong", box:1, due:"2026-07-30", masteredOnce:false}` — identisch | ja |
| `S.orphanQuestions` | nur noch `fantasie-abc` | `["fantasie-abc"]` | ja |
| nach `saveState()` in localStorage | gleiche Aufteilung | `perQuestion` 4 IDs inkl. `zzz-999`, `orphanQuestions` nur `fantasie-abc` | ja |

Der Lernstand wandert also verlustfrei hin und zurück; eine ID, die weiter unbekannt
bleibt, bleibt geparkt und wird nicht stillschweigend entsorgt.

Keine Konsolenfehler, keine Promise-Rejections.

### Bewertung Punkt 5: **bestanden**

---

## 6 — Beschädigter Speicherstand (js/app.js:165-187)

**Screenshots:** `reg/18-bak-wiederherstellung.png` · `reg/19-ohne-bak-verloren.png`

**Hinweis zum Aufbau:** die App schreibt bei `pagehide` per `flushSave()` ihren Zustand
zurück (js/app.js:2381). Wird das kaputte JSON aus der laufenden App heraus gesetzt,
überschreibt dieser Handler es beim Navigieren sofort wieder. Der Test schreibt das
kaputte JSON deshalb von einer **leeren Seite gleicher Herkunft** aus, damit es den
Neustart wirklich erreicht.

**Ausgangslage:** gültiger Stand mit **42 Einträgen** (xp 777, Serie 5, Rekord 11,
126 beantwortet, 120 richtig, 1 bestandene Prüfung, bestes Ergebnis 73 %, 1 Erfolg).
Nach einem Normalstart existiert `adt_trainer_state_v1.bak` (5278 Zeichen, 42 Einträge, xp 777). ✔

Dann `adt_trainer_state_v1` überschrieben mit abgeschnittenem JSON:
`{"schemaVersion":2,"xp":777,"perQuestion":{"analstat-b1-001":{"seen":3,`

### 6a — Neuladen mit gültiger `.bak`

| Prüfung | erwartet | beobachtet | ok |
|---|---|---|---|
| App startet | normal | Startseite gerendert (`[data-act="mixed"]` vorhanden) | ja |
| Stand wiederhergestellt | aus `.bak` | `stateRecovered = "bak"`; **42** `perQuestion`-Einträge, xp 777, Serie 5, Rekord 11, 126/120, examsPassed 1, bestExamPct 73, Erfolg `erste` — vollständig | ja |
| Hinweis für den Nutzer | sichtbar | Toast (`class="toast show"`): „**Fortschritt aus Sicherungskopie wiederhergestellt**" | ja |
| Rohwert aufgehoben | `.corrupt.*`-Schlüssel | `adt_trainer_state_v1.corrupt.1785150509506` mit exakt dem kaputten Text | ja |
| Konsole | Warnung statt Absturz | `[warning] State beschädigt. SyntaxError …` in `loadState` — kein `pageerror`, keine Rejection | ja |

### 6b — Gegenprobe ohne `.bak`

`.bak` entfernt, gleiches kaputtes JSON:

- `stateRecovered = "verloren"`, frischer Zustand (0 Einträge, xp 0) — korrekt, es gibt nichts zu retten.
- Toast: „**⚠️ Gespeicherter Fortschritt war beschädigt**". ✔
- Rohwert trotzdem unter `adt_trainer_state_v1.corrupt.1785150516166` gesichert — manuell rettbar. ✔

### Bewertung Punkt 6: **bestanden**

**Randbemerkung (kein Fehlschlag):** Nach der Wiederherstellung bleibt der kaputte Text
zunächst in `adt_trainer_state_v1` stehen — die App schreibt den geretteten Stand erst
beim nächsten `saveState()` zurück (im Test nach einer Aktion: `perQuestion` = 42,
xp = 778, wieder gültiges JSON). Datenverlust droht dadurch nicht, weil `.bak` und
`.corrupt.*` beide vorhanden sind; ein sofortiges Zurückschreiben nach dem Retten
wäre aber sauberer.

---

## 7 — Eine fehlerhafte Frage bringt die App nicht mehr zum Stillstand (js/app.js:9-36)

**Screenshots:** `reg/20-eine-fehlerhafte-frage.png` · `reg/21-mehrere-fehlerhafte-fragen.png` ·
`reg/22-alle-fragen-kaputt.png`

### 7a — Genau EINE Frage mit nicht existierendem `topic`

Katalog injiziert, in dem `QUESTIONS[1234]` (`deskstat-b1-003`) das Thema
`gibt_es_nicht` trägt.

| Prüfung | erwartet | beobachtet | ok |
|---|---|---|---|
| App startet | normal | Startseite gerendert, `DATA_OK = true` | ja |
| Fragenzahl | **5976** | `QUESTIONS.length` = **5976**, `TOPICS` = 111 | ja |
| Fußzeile | 5976 Fragen | „**5976 Fragen · 111 Themen**" | ja |
| Zähler | 1 aussortiert | `DATA_SKIPPED = 1` | ja |
| Hinweis | „1 fehlerhafte Frage(n) übersprungen" | Toast: „**1 fehlerhafte Frage(n) übersprungen**" | ja |
| Daten-Fehler-Bildschirm | **darf nicht** erscheinen | erscheint nicht | ja |
| Konsole | protokolliert, kein Absturz | `[error] Frage-Fehler (unbekanntes Thema): deskstat-b1-003 gibt_es_nicht` + `[warning] 1 fehlerhafte Frage(n) übersprungen.` — kein `pageerror`, keine Rejection | ja |

### 7b — Vier Fragen, vier verschiedene Fehlerarten

Unbekanntes Thema · fehlende `id` · unbekannter `type` · leerer Fragetext:

- `QUESTIONS.length` = **5973**, `DATA_SKIPPED = 4`, Startseite normal,
  Fußzeile „5973 Fragen · 111 Themen", Toast „**4 fehlerhafte Frage(n) übersprungen**".
- Konsole nennt jede Frage einzeln mit Grund:
  `Frage-Fehler (unbekanntes Thema): analstat-b1-011 xx` ·
  `Frage-Fehler (ID fehlt/doppelt): undefined` ·
  `Frage-Fehler (unbekannter Typ): analstat-b1-031 bloedsinn` ·
  `Frage-Fehler (leerer Fragetext): analstat-b2-005`. ✔

### 7c — Gegenprobe: ALLE Fragen kaputt

Alle 5977 Fragen mit unbekanntem Thema → `DATA_OK = false`, keine Startseite,
sondern der harte Bildschirm „**Daten-Fehler**" mit „Neu laden" / „Inhalte neu
freischalten". Das ist das gewünschte Verhalten: der Notausgang bleibt erhalten,
er greift nur nicht mehr bei Einzelfehlern. ✔

### Bewertung Punkt 7: **bestanden**

---

## 8 — Regression allgemein

**Screenshots:** `reg/23-startseite.png` · `reg/24-mischtraining-richtig.png` ·
`reg/25-mischtraining-falsch.png` · `reg/26-pruefung-frage1.png` ·
`reg/27-pruefung-abgabe-dialog.png` · `reg/28-pruefung-auswertung.png` ·
`reg/29-statistik.png` · `reg/30-einstellungen.png` · `reg/31-backup-import.png` ·
`reg/32-theme-dark.png` · `reg/32-theme-light.png` · `reg/33-offline-reload.png` ·
`reg/34-offline-quiz.png`

| Bereich | erwartet | beobachtet | ok |
|---|---|---|---|
| Startseite | vollständig, echter Katalog | 5977 Fragen · 111 Themen; alle Einstiege vorhanden (`today`, `goal`, `mixed`, `topics`, `due`, `weak`, `exam`, `badges`, `stats`, `settings`, `info`, `reset`) | ja |
| Mischtraining – richtig | „✅ Richtig", XP steigt | `prostata-b3-056` richtig, Verdikt „✅ Richtig", XP 0→20, 1 beantwortet / 1 richtig | ja |
| Mischtraining – falsch | „❌ Nicht ganz", zählt als falsch | `darm-b2-021` falsch, Verdikt „❌ Nicht ganz", XP 20→22 (Teilnahme-XP), 2 beantwortet / 1 richtig, `perQuestion` = 2 | ja |
| Prüfung starten | 30 Fragen, Timer läuft | 30 Fragen, Timer „44:59", Frage 1/30 | ja |
| Prüfung abgeben | Abfragedialog, dann Auswertung | Dialog „Abgeben / Weiter prüfen"; Auswertung „🏆 Herausragend! · 100 % · 30 von 30 richtig · **BESTANDEN** · Grenze 50 %", Themenprofil | ja |
| Prüfung persistiert | Historie + Kennzahlen | `S.examsPassed = 1`, `S.bestExamPct = 100`, `adt_exam_history` = 1 Eintrag | ja |
| Statistik | Kennzahlen + Themenliste | „32 beantwortet · 97 % Trefferquote · 0 sichere Fragen" + Trefferquote je Thema | ja |
| Backup-Export | Datei mit Zustand | Download `adt-trainer-backup-2026-07-27.json`, 6219 Bytes, `app:"adt-trainer"`, `schemaVersion:2`, `exportedAt` gesetzt, 32 `perQuestion`-Einträge, xp 22 | ja |
| Backup-Import | zusammenführen, nichts verlieren | Datei mit +50 Fragen und +5000 XP eingespielt → `perQuestion` 32 → **82**, xp 22 → **5022**; Toast „✅ Backup importiert & zusammengeführt" | ja |
| Backup-Import, kaputte Datei | abfangen, Stand unberührt | `{ das ist kein json` → Toast „⚠️ Datei konnte nicht gelesen werden", Zustand unverändert (82 / 5022); Konsole nur `[warning] Import fehlgeschlagen SyntaxError …` | ja |
| Theme „Dunkel" | `data-theme="dark"` | Attribut `dark`, `adt_theme="dark"`, Hintergrund `rgb(0,0,0)` | ja |
| Theme „Hell" | `data-theme="light"` | Attribut `light`, `adt_theme="light"`, Hintergrund `rgb(242,242,247)` | ja |
| Theme „Automatisch" | Attribut entfernt | Attribut `null`, `adt_theme` gelöscht | ja |
| Offline-Reload | App startet weiter, Fortschritt da | Service Worker registriert und aktiv, Cache `adt-shell-v1`; nach `setOffline(true)` + Reload: **5977 Fragen · 111 Themen**, Startseite normal, xp 333, `perQuestion` = 1 erhalten | ja |
| Offline üben | Runde startbar | „Gemischtes Training" offline geklickt → Fragekarte, 15 Fragen | ja |

### Konsole und Promise-Rejections

Über alle Durchläufe von Punkt 8 hinweg:

- `pageerror`: **0**
- unbehandelte Promise-Rejections (`window.__rej`): **0**
- Konsolenmeldungen: nur die **erwarteten** — die Warnung des absichtlich kaputten
  Import-Tests und (in den Läufen mit blockiertem Service Worker) die Playwright-eigene
  Meldung „Service Worker registration blocked by Playwright". Im Lauf mit erlaubtem
  Service Worker (Offline-Test) blieb die Konsole vollständig leer.

### Bewertung Punkt 8: **bestanden**

**Hinweis zum Testaufbau:** Der Offline-Test lief in einem eigenen Browser-Kontext mit
erlaubtem Service Worker; alle übrigen Tests blockieren ihn, damit jeder Durchlauf mit
frischem, ungecachtem Code startet.

---

# Zusammenfassung

| Punkt | Ergebnis |
|---|---|
| 1 — `parseNum` | **teilweise** — Rechnen überall korrekt, aber die Prüfungsansicht hat kein `#numHint` |
| 2 — Themenliste | bestanden |
| 3 — Schwachstellen-Modus | bestanden |
| 4 — Fortschritt bleibt erhalten | bestanden (Speicherstand byte-identisch) |
| 5 — Unbekannte IDs geparkt | bestanden |
| 6 — Beschädigter Speicherstand | bestanden |
| 7 — Fehlerhafte Frage | bestanden |
| 8 — Regression allgemein | bestanden |

**Offener Punkt (einziger):** In der Prüfungssimulation fehlt die Rückmeldung bei
unlesbarer Zahleneingabe. `renderExam()` rendert kein `#numHint`, und `examSetNumeric()`
setzt keinen Hinweis — die Frage rutscht still aus dem Zähler „beantwortet". Im Quiz ist
derselbe Fall gelöst; die beiden Ansichten sollten sich hier gleich verhalten.

**Nachrangige Beobachtungen (keine Fehlschläge):**
- Die Themensuche faltet keine Umlaute (`qualitat` findet „Qualität" nicht).
- Die ungefilterte Themenliste ist weiterhin ~7000 px lang; das Suchfeld macht sie
  auffindbar, kürzt sie aber nicht.
- Nach einer `.bak`-Wiederherstellung bleibt der kaputte Rohwert bis zum nächsten
  `saveState()` in `adt_trainer_state_v1` stehen (kein Datenverlust, da `.bak` und
  `.corrupt.*` vorhanden sind).
