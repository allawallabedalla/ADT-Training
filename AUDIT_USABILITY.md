# Usability-Audit ADT-Training

Stand: 2026-07-27 · Prüfer: automatisierter Durchlauf mit Playwright/Chromium 1.56
gegen den echten Katalog.

**Aufbau:** statischer Server (`python3 -m http.server 8099`) im Repo-Wurzelverzeichnis,
Chromium (`/opt/pw-browsers/chromium`), Standard-Viewport 1280×900, Mobil-Viewport 390×844,
Sprache `de-DE`. Der echte Katalog aus `/home/user/Secret/material/content.json`
(**5977 Fragen · 111 Themen**) wurde vor dem Laden direkt in IndexedDB `adt_content` /
Store `kv` / Key `content_v1` geschrieben, dazu `adt_content_idb="1"`,
`adt_content_code`, `adt_onboarded="1"` in localStorage – die App startet damit
entsperrt, genau wie nach einer echten Freischaltung.

**Netz:** Supabase ist aus dieser Umgebung nicht erreichbar; jeder Aufruf endet mit
`net::ERR_TUNNEL_CONNECTION_FAILED`. Das entspricht dem Alltagsfall „App offen, kein
Netz" und wurde bewusst nicht umgangen.

**Bezug zum Code-Review:** die in `AUDIT_CODE.md` markierten Stellen wurden im Browser
gezielt nachgeprüft. **H1** (Fortschrittsverlust bei IndexedDB-Ausfall) und **H5**
(Zahleneingabe: leeres Feld = 0, Tausenderpunkt) sind im laufenden Betrieb reproduziert
und mit Messwerten belegt – siehe U-H1, U-H4, U-H5.

**Prüfumfang:** Startbildschirm · Themenliste mit 111 Kategorien · Mischtraining
(richtig/falsch/Erklärung/Weiterblättern/Rundenende) · Prüfungssimulation (Start, Timer,
Navigation, Übersicht, Abgabe, Auswertung) · Schwachstellen-Modus · numeric-Fragen
(Komma/Punkt/Tausendertrenner/Toleranz/Einheit/leeres Feld) · multi-Fragen
(Mehrfachauswahl, Bestätigen, Teilrichtig-Bewertung) · Fällige Wiederholungen ·
Statistik & Erfolge · Backup-Export/-Import (inkl. beschädigter Datei) · Offline-Betrieb ·
Theme hell/dunkel · Schriftgröße „Groß" · Zoom 200 % · Reflow bei 320/360/390 px ·
Tastatur & ARIA · Mobil 390×844 · Startzeiten, Speicherbedarf, IndexedDB-Größe.

**Ergebnis:** **6 hoch · 6 mittel · 9 niedrig**

**Screenshots:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/`

---

# Überblick

| # | Schwere | Bereich | Befund |
|---|---|---|---|
| U-H1 | hoch | Start/Datenhaltung | Geht der IndexedDB-Eintrag verloren, startet die App unbemerkt mit 59 Beispielfragen und löscht mit der ersten Antwort den gesamten Lernfortschritt |
| U-H2 | hoch | Themenliste | 111 Themen als eine ungefilterte Liste – kein Suchfeld, keine Gruppierung, 6964 px Scrollstrecke |
| U-H3 | hoch | Themenliste | Themen sind nach dem internen Schlüssel sortiert, nicht nach dem angezeigten Namen – die Reihenfolge wirkt zufällig |
| U-H4 | hoch | numeric-Fragen | Geleertes Zahlenfeld wird als Antwort „0" gewertet – bei Fragen mit Lösung 0 sogar als „Richtig" |
| U-H5 | hoch | numeric-Fragen | Deutsche Tausenderschreibweise wird falsch gelesen: „1.000" ergibt 1, „1.234,5" blockiert den Knopf ohne Hinweis |
| U-H6 | hoch | Schwachstellen-Modus | Der Schwachstellen-Modus ist fertig implementiert, aber von keiner Stelle der Oberfläche aus erreichbar |
| U-M1 | mittel | numeric-Fragen | Geforderte Genauigkeit wird vor dem Antworten nirgends genannt – 148 Dezimalfragen verlangen die Lösung auf die letzte Stelle genau |
| U-M2 | mittel | Statistik | Statistik listet alle 111 Themen ungefiltert – 8454 px Scrollstrecke, davon über 100 Zeilen ohne Datenwert („–") |
| U-M3 | mittel | Prüfungssimulation | Prüfungsauswertung ist 11512 px lang – Themenprofil mit 30 Zeilen „1/1" und alle 30 Fragen ausgeklappt |
| U-M4 | mittel | Layout/Desktop | Am Laptop bleibt die App auf 430 px Spaltenbreite beschränkt – die langen Listen werden dadurch unnötig lang |
| U-M5 | mittel | Tastatur | Nach „Weiter" landet der Fokus auf `<body>` – Tastaturnutzer verlieren bei jeder Frage ihre Position, Screenreader melden die neue Frage nicht |
| U-M6 | mittel | Kontrast | Themen-Chip verfehlt im Hellmodus die Kontrastvorgabe – alle 27 Themenfarben liegen unter 4,5:1 |
| U-N1 | niedrig | numeric-Fragen | Mitgetippte Einheit („75 %") blockiert den Prüf-Knopf kommentarlos |
| U-N2 | niedrig | Themenliste | Die im Katalog hinterlegten Themen-Symbole werden nie benutzt – alle 111 Zeilen tragen dasselbe Sechseck |
| U-N3 | niedrig | Backup-Import | Nach dem Import meldet die App „zusammengeführt", zeigt aber inkonsistente Zähler: XP aus der Datei, Fragenzahl aus dem Gerät |
| U-N4 | niedrig | Tastatur/ARIA | Kein Sprunglink und keine Überschriftenstruktur – in der Themenliste liegen 112 Tabstopps hintereinander |
| U-N5 | niedrig | Startseite | Der Installationshinweis nennt immer Safari/iPhone – auch in Chrome am Laptop und auf Android |
| U-N6 | niedrig | Mobil | Prüfungs-Markierung (40×40 px) und die 30 Felder der Prüfungsübersicht (42×42 px) liegen unter der 44-px-Empfehlung |
| U-N7 | niedrig | Zoom | Bei 200 % Zoom auf dem Telefon entsteht waagerechtes Scrollen; Antworttexte laufen über den Kartenrand |
| U-N8 | niedrig | Synchronisation | „Sync-Code erstellt" wird auch ohne Netz gemeldet – der Code existiert dann nur auf diesem Gerät |
| U-N9 | niedrig | Übungsrunde | Die Auswertung einer Übungsrunde zeigt keine Übersicht der Fehler – anders als die Prüfungsauswertung |

---

# Befunde

## HOCH

### U-H1 – Geht der IndexedDB-Eintrag verloren, startet die App unbemerkt mit 59 Beispielfragen und löscht mit der ersten Antwort den gesamten Lernfortschritt

**Schwere:** hoch · **Bereich:** Start/Datenhaltung · **Code-Review:** bestätigt H1 im Browser

**Was passiert:** Im Browser durchgespielt und bestätigt – das ist der schwerwiegendste beobachtete Befund.

Ausgangslage: echter Katalog geladen, **200 Fragen gelernt** (`S.perQuestion` = 200 Einträge, 1900 XP, Level 6, `adt_trainer_state_v1` = 20 375 Zeichen). Dann wird der IndexedDB-Eintrag `content_v1` entfernt (im echten Betrieb: ITP-Eviction unter iOS, Speicherdruck, privater Modus, beschädigte Datenbank), während die Markierung `adt_content_idb="1"` in localStorage bestehen bleibt.

Nach dem Neuladen:

- **Kein Freischalt-Bildschirm** (`#gateCode` nicht vorhanden), **keine Warnung** (`/fehler|problem|nicht geladen/i.test(document.body.innerText)` → `false`).
- Die App läuft mit dem **Beispielkatalog**: `QUESTIONS.length` → **59**, `Object.keys(TOPICS).length` → **9**. Der Fußtext meldet ungerührt „**59 Fragen · 9 Themen**".
- `S.perQuestion` im Speicher: **0 Einträge** – `sanitizeState()` hat alle 200 gegen die 59 Beispiel-IDs weggefiltert.
- Die Startseite sieht dabei **völlig normal** aus: „Level 6 · TNM-Kenner", „200 beantwortet", „95 % Trefferquote", „1900 XP gesamt" (siehe Screenshot). XP und Level überleben und verdecken den Verlust vollständig.
- In localStorage stehen zu diesem Zeitpunkt **noch alle 200 Einträge** – der Schaden wäre reparabel.

Sobald **eine einzige Frage** beantwortet wird, schreibt `saveState()` den beschnittenen Stand zurück. Danach gemessen: `perQuestion` in localStorage = **1 Eintrag**, `xp` = 1910, `totalAnswered` = 201. **199 von 200 Lernständen sind unwiederbringlich weg**, während die Zähler weiterlaufen und alles in Ordnung aussieht. In der Praxis genügt schon das automatische Zurücksetzen der Serie beim Start (`js/app.js:2304`), um zu schreiben, ohne dass der Nutzer irgendetwas tut.

Dieselbe Kette droht bei jedem „Inhalte neu freischalten", wenn die anschließende Neuladung scheitert – der Bestätigungsdialog verspricht dort ausdrücklich „Dein Lernfortschritt bleibt erhalten."

**Reproduktion:**
1. App mit echtem Katalog entsperrt starten, ~200 Fragen lernen (oder `S.perQuestion` füllen und `flushSave()`).
2. Kontrolle: `Object.keys(S.perQuestion).length` → 200.
3. IndexedDB-Eintrag entfernen, Markierung stehen lassen:
   ```js
   indexedDB.open('adt_content',1).onsuccess = e => {
     const db = e.target.result;
     db.transaction('kv','readwrite').objectStore('kv').delete('content_v1');
   };
   ```
   `localStorage.getItem('adt_content_idb')` → weiterhin `"1"`.
4. Seite neu laden. Die Startseite zeigt Level 6 / 200 beantwortet / 1900 XP – **aber** unten „59 Fragen · 9 Themen".
5. `Object.keys(S.perQuestion).length` → **0**; `JSON.parse(localStorage.adt_trainer_state_v1).perQuestion` → noch 200.
6. Eine beliebige Frage beantworten.
7. `Object.keys(JSON.parse(localStorage.adt_trainer_state_v1).perQuestion).length` → **1**.

**Behebungsvorschlag:** Drei Maßnahmen, die zusammengehören (Details in `AUDIT_CODE.md` H1/H3):
1. **Schreibsperre statt stillem Weiterlaufen:** Schlägt `hydrateContent()` fehl, obwohl `adt_content_idb === "1"` gesetzt ist, ist das ein harter Fehler. Eigener Bildschirm „Inhalte konnten nicht geladen werden – dein Fortschritt ist gesichert" mit „Erneut versuchen" und „Inhalte neu freischalten", und in diesem Zustand **kein** `saveState()`.
2. **`loadState()` erst nach `hydrateContent()`** aufrufen, nicht auf Modulebene (`js/app.js:151`), damit `sanitizeState()` nie gegen den Beispielkatalog filtert.
3. **Unbekannte IDs parken statt löschen** (`s.orphanQuestions`) und eine Sicherungskopie `adt_trainer_state_v1.bak` vor dem ersten Schreiben nach einem Katalogwechsel anlegen. Zusätzlich hart begrenzen: verwirft ein Durchlauf mehr als z. B. 20 % der Einträge, abbrechen und melden.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/100-idb-verloren.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/101-idb-verloren-nach-antwort.png`

### U-H2 – 111 Themen als eine ungefilterte Liste – kein Suchfeld, keine Gruppierung, 6964 px Scrollstrecke

**Schwere:** hoch · **Bereich:** Themenliste

**Was passiert:** „Nach Thema lernen" rendert alle 111 Kategorien als flache Liste von `.topic-row`-Buttons. Gemessen: 111 Zeilen, `document.scrollHeight = 6964 px` bei `innerHeight = 900 px` – das sind **7,7 Bildschirmseiten** am Laptop, auf dem Mobil-Viewport (390×844) entsprechend mehr. Im Kopfbereich steht nur „Wähle ein Thema". Ein Suchfeld, eine Filterleiste, eine Gruppierung nach Fachgebiet oder ein Alphabet-Index existieren nicht: die Abfrage `document.querySelector('#app input, #app select')` liefert in dieser Ansicht `null` (0 Eingabefelder). Wer gezielt „Prostatakarzinom – TNM" sucht, muss die Liste visuell durchkämmen. Die Kategorien tragen zudem stark ähnliche Präfixe („Brustkrebs – …" 6×, „Strahlentherapie – …" 4×, „Gynäkologische Tumoren – …" 3×), was das Überfliegen zusätzlich erschwert.

**Reproduktion:**
1. App entsperrt starten → Startseite.
2. „Nach Thema lernen" antippen.
3. In der Konsole: `document.querySelectorAll('.topic-row').length` → `111`;
   `document.documentElement.scrollHeight` → `6964`;
   `document.querySelectorAll('#app input, #app select').length` → `0`.
4. Ein bestimmtes Thema (z. B. „Prostatakarzinom") suchen – nur durch Scrollen möglich.

**Behebungsvorschlag:** Ein Suchfeld über der Liste (Sofortfilter auf `t.name`, zusätzlich auf `quelle`), das reicht schon allein. Darüber hinaus: die Themen nach Fachgebiet gruppieren – das Feld `TOPICS[key].quelle` (z. B. „Analytische Statistik · Isabel Liepe · 17.03.2026") und die gemeinsame `color` liefern die Gruppen bereits frei Haus; als aufklappbare Abschnitte mit Kopfzeile darstellen und die zuletzt genutzten 3–5 Themen oben anpinnen.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/03-topics-top.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/04-topics-bottom.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/61-mobile-topics.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/62-mobile-topics-mid.png`

### U-H3 – Themen sind nach dem internen Schlüssel sortiert, nicht nach dem angezeigten Namen – die Reihenfolge wirkt zufällig

**Schwere:** hoch · **Bereich:** Themenliste

**Was passiert:** `renderTopics()` (`js/app.js:1244`) iteriert mit `Object.entries(TOPICS)` und übernimmt damit die Einfügereihenfolge der Schlüssel, die alphabetisch nach dem **technischen** Namen sortiert sind (`analstat_…`, `basisdok_…`, `befund_…`, `darm_…`, `deskstat_…` …). Angezeigt wird aber `t.name`. Ergebnis: die vier „Kolorektales Karzinom“-Themen stehen zwischen „Befund – Neuroonkologie“ und „Deskriptive Statistik“, weil ihr Schlüssel `darm_*` lautet; „Zervixkarzinom“ steht vor „Endometriumkarzinom“ (`gyn_zervix` vs. `gyn_endometrium` – hier greift wiederum die Schlüsselordnung nicht sichtbar). Ein Abgleich der 111 angezeigten Namen gegen `localeCompare(…, 'de')` ergibt **13 Sprungstellen**. Für den Nutzer ist die Liste damit weder alphabetisch noch thematisch geordnet – er kann nicht abschätzen, wo ein Thema steht, und muss die gesamten 7,7 Bildschirmseiten lesen (verschärft U-H2).

**Reproduktion:**
1. „Nach Thema lernen" öffnen.
2. Von oben lesen: … „Befund – Neuroonkologie & Molekularpathologie", dann **„Kolorektales Karzinom – Chirurgie & Therapie"**, dann „Deskriptive Statistik – Grundlagen & Lagemaße".
3. Weiter unten: „Zervixkarzinom" **vor** „Endometriumkarzinom", danach „Ovarialkarzinom", dann „Gynäkologische Tumoren – TNM & FIGO".
4. Nachrechnen: `[...document.querySelectorAll('.topic-row .info b')].map(e=>e.textContent)` gegen eine mit `localeCompare(…, 'de')` sortierte Kopie vergleichen → 13 Abweichungen.

**Behebungsvorschlag:** Beim Rendern nach dem angezeigten Namen sortieren: `Object.entries(TOPICS).sort((a,b)=>a[1].name.localeCompare(b[1].name,'de'))`. Wird stattdessen nach Fachgebiet gruppiert (siehe U-H2), innerhalb der Gruppe ebenfalls nach `name` sortieren. Der Katalog selbst braucht dafür keine Änderung.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/03-topics-top.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/04-topics-bottom.png`

### U-H4 – Geleertes Zahlenfeld wird als Antwort „0" gewertet – bei Fragen mit Lösung 0 sogar als „Richtig"

**Schwere:** hoch · **Bereich:** numeric-Fragen · **Code-Review:** bestätigt H5 (Szenario A)

**Was passiert:** Bei einer numeric-Frage ist „Antwort prüfen" korrekt deaktiviert, **solange nie etwas getippt wurde** (`SESSION.picks` leer). Tippt man aber eine Zahl und löscht sie danach wieder vollständig, ruft der `input`-Handler `setNumericResponse("")` auf; `parseNum("")` liefert wegen `Number("") === 0` den Wert **0**, der in `picks` landet. Gemessen bei `brust-b1-033` (Lösung 5500): Feld sichtbar **leer**, `SESSION.picks = [0]`, „Antwort prüfen" **aktiv**. Ein Klick darauf wertet die leere Eingabe als Antwort „0": Verdikt „❌ Nicht ganz", `S.totalAnswered` steigt auf 1, `perQuestion.wrong` auf 1 und die Leitner-Box fällt auf **0** zurück – der Nutzer hat nie eine Antwort abgegeben. Umgekehrt bei `deskstat-b3-037` (Lösung 0, „Berechnen Sie p_2 = d_2/n_2 mit d_2=0 und n_2=8,0"): das leere Feld wird mit **„✅ Richtig"** bewertet und als „sicher gelernt" verbucht. Es gibt 3 numeric-Fragen mit Antwort 0 im Katalog.

**Reproduktion:**
1. Mischtraining starten, zu einer numeric-Frage navigieren (Chip „Rechenaufgabe").
2. Irgendeine Zahl tippen, z. B. `12`.
3. Feld vollständig leeren (Strg+A, Entf).
4. Beobachten: Feld ist leer, **„Antwort prüfen" bleibt aktiv**. Konsole: `Array.from(SESSION.picks[SESSION.idx])` → `[0]`.
5. „Antwort prüfen" klicken → „❌ Nicht ganz", Lösung wird aufgedeckt, Frage ist als falsch verbucht.
6. Gegenprobe mit Frage `deskstat-b3-037` (Lösung 0): Schritte 2–5 → **„✅ Richtig"**.

**Behebungsvorschlag:** `parseNum()` muss die leere Eingabe als „keine Antwort" behandeln: `const s = String(v).trim(); if (!s) return NaN;` **vor** dem `Number()`-Aufruf (siehe Vorschlag in `AUDIT_CODE.md` H5). Zusätzlich in `setNumericResponse()` bei leerem Feld `picks.clear()` aufrufen, damit der Prüf-Knopf wieder deaktiviert wird – die Prüfungssimulation (`examSetNumeric`) zählt sonst dieselbe Frage fälschlich als „beantwortet".

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/90-numeric-emptied-check-active.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/91-numeric-empty-graded-wrong.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/94-numeric-zero-empty-counts-correct.png`

### U-H5 – Deutsche Tausenderschreibweise wird falsch gelesen: „1.000" ergibt 1, „1.234,5" blockiert den Knopf ohne Hinweis

**Schwere:** hoch · **Bereich:** numeric-Fragen · **Code-Review:** bestätigt H5 (Szenario B)

**Was passiert:** `parseNum()` ersetzt nur das **erste** Komma durch einen Punkt und lässt Punkte unangetastet. Im Browser gemessen (Frage `brust-b1-033`, Lösung 5500):

| Eingabe | `SESSION.picks` | „Antwort prüfen" |
|---|---|---|
| `1000` | `[1000]` | aktiv |
| `1.000` | **`[1]`** | aktiv |
| `1234,5` | `[1234.5]` | aktiv |
| `1.234,5` | **`[]`** | **deaktiviert** |
| `1 000` | `[]` | deaktiviert |
| `1'000` | `[]` | deaktiviert |
| `5e3` | `[5000]` | aktiv |

Wer im deutschen Zahlenformat „5.500" eingibt, antwortet also faktisch „5,5" und wird als falsch bewertet, obwohl er richtig gerechnet hat. Bei „1.234,5" bleibt der Knopf stumm deaktiviert – der einzige Hinweis lautet „Ergebnis als Zahl eingeben (Komma oder Punkt)" und erklärt weder, was blockiert, noch warum. **39 numeric-Fragen** haben Antworten ≥ 1000 (z. B. `brust-b2-039` = 113721, `brust-b4-017` = 140869), also genau die Größenordnung, in der Nutzer Tausenderpunkte setzen. Nebenbefund: `5e3` wird stillschweigend als 5000 akzeptiert – Exponentialschreibweise ist hier eher ein Vertipper.

**Reproduktion:**
1. Mischtraining → numeric-Frage mit vierstelliger Lösung (z. B. `brust-b1-033`, Lösung 5500).
2. `1.000` eintippen → Konsole `Array.from(SESSION.picks[SESSION.idx])` liefert `[1]`.
3. Feld leeren, `1.234,5` eintippen → `picks` bleibt leer, „Antwort prüfen" ist deaktiviert, es erscheint **keine** Erklärung.
4. Dasselbe mit `1 000` (Leerzeichen als Trenner) und `1'000`.

**Behebungsvorschlag:** `parseNum()` gegen die deutsche Schreibweise härten (Vorschlag aus `AUDIT_CODE.md` H5 übernehmen): Leerzeichen/schmale Leerzeichen/Apostrophe entfernen; enthält die Eingabe ein Komma, alle Punkte als Tausendertrenner löschen und das Komma zum Dezimalpunkt machen; sonst reine `1.234`-Muster (`/^\d{1,3}(\.\d{3})+$/`) als Tausendertrenner behandeln. Zusätzlich bei unlesbarer Eingabe eine sichtbare Rückmeldung unter dem Feld einblenden („Bitte nur eine Zahl eingeben, z. B. 1234,5") statt den Knopf kommentarlos zu deaktivieren.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/15-numeric-garbage.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/19-numeric-thousand-sep.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/20-numeric-thousand-wrong.png`

### U-H6 – Der Schwachstellen-Modus ist fertig implementiert, aber von keiner Stelle der Oberfläche aus erreichbar

**Schwere:** hoch · **Bereich:** Schwachstellen-Modus

**Was passiert:** `weakQuestions()` (`js/app.js:585`) und der Sitzungstyp `buildSession("weak")` (`js/app.js:647`) existieren und funktionieren – im Browser geprüft: `typeof weakQuestions === 'function'` → `true`, `weakQuestions().length` → **5937** bei 60 beantworteten Fragen. Es gibt jedoch **keinen einzigen Aufrufer**: `grep -n 'weak' js/app.js` liefert genau zwei Treffer (Definition Z. 585 und der `else if`-Zweig Z. 647). Die Startseite bietet `today, goal, mixed, topics, due, exam, badges, stats, settings, info, reset` – kein `weak`. Auch das Wort „schwach"/„Schwachstelle" kommt in der gesamten Oberfläche nicht vor (`document.body.innerText.toLowerCase().includes('schwach')` → `false`, sowohl auf der Startseite als auch in der Statistik). Der Nutzer hat damit **keine Möglichkeit, gezielt seine Fehler zu üben** – ausgenommen die tagesgebundenen „Fälligen Wiederholungen" und das „Falsche wiederholen" direkt nach einer Runde. Wer die App am Vortag benutzt hat und heute seine Schwachstellen wiederholen will, findet keinen Einstieg.

**Reproduktion:**
1. App entsperrt starten, ein paar Fragen falsch beantworten.
2. Startseite absuchen: „Gemischtes Training", „Nach Thema lernen", „Fällige Wiederholungen", „Prüfungssimulation", „Erfolge", „Statistik", „Einstellungen", „So funktioniert's" – kein Schwachstellen-Einstieg.
3. Konsole: `Array.from(document.querySelectorAll('[data-act]')).map(e=>e.dataset.act)` → `['today','goal','mixed','topics','due','exam','badges','stats','settings','info','reset','info']`.
4. Gegenprobe, dass die Funktion existiert: `weakQuestions().length` → 5937; `buildSession('weak'); go('quiz')` startet die Runde einwandfrei.
5. Im Quelltext: `grep -n 'weak' js/app.js` → nur Zeile 585 und 647, kein Aufruf.

**Behebungsvorschlag:** Auf der Startseite eine vierte Kachel im Block „ÜBEN" ergänzen, z. B. „Schwachstellen üben – N Fragen, die du noch nicht sicher hast", die `buildSession("weak"); go("quiz")` auslöst; deaktiviert, solange `weakQuestions().length === 0`. Sinnvoll ist zusätzlich, `weakQuestions()` zu verschärfen (aktuell zählt jede noch nie beantwortete Frage als Schwachstelle – deshalb 5937 von 5977), etwa auf „mindestens einmal gesehen **und** (`correct === 0` oder `lastResult === 'wrong'`)". Sonst ist die Kachel praktisch ein zweites Mischtraining.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/02-home.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/30-home-progress.png`

## MITTEL

### U-M1 – Geforderte Genauigkeit wird vor dem Antworten nirgends genannt – 148 Dezimalfragen verlangen die Lösung auf die letzte Stelle genau

**Schwere:** mittel · **Bereich:** numeric-Fragen

**Was passiert:** Von 832 numeric-Fragen haben **768 die Toleranz 0**, verlangen also eine exakt übereinstimmende Zahl. Darunter sind **148 Fragen mit Dezimalantwort** (11 davon mit drei oder mehr Nachkommastellen), z. B. `analstat-b2-007` mit Lösung 2,64 oder `analstat-b1-034` mit 68,27. Der einzige Hinweis über dem Feld lautet „Ergebnis als Zahl eingeben (Komma oder Punkt)" – **wie genau** gerundet werden soll, steht nirgends. Wer 2,6 oder 68,3 eingibt, bekommt „❌ Nicht ganz" und verliert die Leitner-Box, obwohl er sachlich richtig gerechnet hat. Umgekehrt ist die Toleranz, wo es sie gibt, erst **nach** dem Prüfen sichtbar: die Zeile „Richtige Antwort: 0,0278 (±0,003)" erscheint ausschließlich in der Auflösung (bestätigt an `analstat-b1-018`).

**Reproduktion:**
1. Mischtraining → numeric-Frage mit Dezimallösung, z. B. `analstat-b2-007` (Lösung 2,64; Toleranz 0).
2. Über dem Feld steht nur „Ergebnis als Zahl eingeben (Komma oder Punkt)." – keine Angabe zur Rundung.
3. `2,6` eingeben, prüfen → „❌ Nicht ganz", aufgedeckt wird „Richtige Antwort: 2,64".
4. Gegenprobe `analstat-b1-018` (Toleranz 0,003): erst **nach** dem Prüfen erscheint „(±0,003)".

**Behebungsvorschlag:** Die geforderte Genauigkeit vor dem Antworten anzeigen: bei `tolerance > 0` den Hinweis „Toleranz ±0,003" direkt unter das Feld setzen; bei `tolerance === 0` und dezimaler Antwort „auf N Nachkommastellen genau" aus `String(q.answer)` ableiten. Besser noch: für Dezimalantworten eine Standardtoleranz aus der Stellenzahl ableiten (z. B. eine halbe Einheit der letzten Stelle), damit korrektes Runden nicht als Fehler zählt.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/21-numeric-unit-tolerance.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/93-numeric-tolerance.png`

### U-M2 – Statistik listet alle 111 Themen ungefiltert – 8454 px Scrollstrecke, davon über 100 Zeilen ohne Datenwert („–")

**Schwere:** mittel · **Bereich:** Statistik

**Was passiert:** „Trefferquote je Thema" rendert eine Zeile pro Thema, unabhängig davon, ob das Thema jemals geübt wurde. Nach 60 beantworteten Fragen aus 3 Themen zeigt die Seite **111 Zeilen** bei `scrollHeight = 8454 px` (9,4 Bildschirmseiten am Laptop); in über 100 davon steht als Trefferquote nur „–" und links „0/47 sicher". Sortiert wird wieder nach dem internen Schlüssel (siehe U-H3), es gibt weder Suche noch Filter noch Sortierung (`document.querySelectorAll('#app input, #app select').length` → `0`) und keine Knöpfe (`#app button` → 0 Treffer). Die eigentliche Kernfrage der Ansicht – „wo stehe ich schlecht?" – lässt sich damit nur durch Abscrollen von 9 Bildschirmseiten beantworten, in denen die wenigen aussagekräftigen Zeilen zwischen leeren Zeilen untergehen.

**Reproduktion:**
1. 60 Fragen beantworten (oder Fortschritt setzen), Startseite → „Statistik".
2. Konsole: `document.querySelectorAll('.theme-row').length` → `111`; `document.documentElement.scrollHeight` → `8454`.
3. Durchscrollen: ab „Basisdokumentation – Grundlagen & Diagnosedaten" steht durchgehend „–" als Trefferquote.
4. Nach einem Filter oder einer Sortierung suchen: `document.querySelectorAll('#app input, #app select, #app button').length` → `0`.

**Behebungsvorschlag:** Standardmäßig nur geübte Themen zeigen, absteigend nach Fehlerquote sortiert („schwächstes zuerst"), mit einem Umschalter „Alle Themen anzeigen". Zusätzlich oben eine Kurzfassung „Deine 5 schwächsten Themen" mit direktem Sprung ins jeweilige Thema – damit wird die Statistik zur Handlungsanleitung statt zur Tabelle. Ein Suchfeld wie in der Themenliste (U-H2) hilft auch hier.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/31-stats.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/65-mobile-stats.png`

### U-M3 – Prüfungsauswertung ist 11512 px lang – Themenprofil mit 30 Zeilen „1/1" und alle 30 Fragen ausgeklappt

**Schwere:** mittel · **Bereich:** Prüfungssimulation

**Was passiert:** Nach einer 30-Fragen-Prüfung ist die Ergebnisseite **11512 px** hoch (12,8 Bildschirmseiten bei 900 px Fensterhöhe). Grund: (a) Das „Themenprofil" bildet eine Zeile je vorgekommenem Thema – weil 30 Fragen aus 111 Themen gezogen werden, sind das fast immer **30 Zeilen mit dem Wert „1/1" bzw. „0/1"**; ein Balken über einer einzigen Frage hat keinen Aussagewert. (b) Darunter folgt „Auswertung im Detail" mit allen 30 Fragen **vollständig ausgeklappt** – Fragetext, eigene Antwort, richtige Antwort und die komplette Erklärung, ohne Möglichkeit zum Zuklappen und ohne Filter „nur falsche zeigen". Die eigentlich wichtigen Elemente (Prozentwert, bestanden/nicht bestanden, „Falsche wiederholen") stehen ganz oben bzw. in der Aktionsleiste – wer die Fehler durchgehen will, scrollt durch 12 Bildschirmseiten und muss die 3 richtigen Antworten mitlesen.

**Reproduktion:**
1. Startseite → „Prüfungssimulation" (30 Fragen, 45 min).
2. Einige Fragen beantworten, „Prüfung abgeben" → Rückfrage „25 Frage(n) noch unbeantwortet. Trotzdem abgeben und auswerten?" → „Abgeben".
3. Ergebnisseite: `document.documentElement.scrollHeight` → `11512`.
4. `document.querySelectorAll('.theme-row').length` → 30, fast alle mit „1/1" oder „0/1".
5. `document.querySelectorAll('.review-item').length` → 30, alle ausgeklappt; kein Filter, kein Zuklappen.

**Behebungsvorschlag:** Themenprofil nur zeigen, wenn ein Thema mindestens 2–3 Fragen beigesteuert hat, sonst nach Oberkategorie zusammenfassen (siehe die `quelle`-Gruppen aus U-H2). Detailauswertung standardmäßig auf die **falsch beantworteten** Fragen beschränken, mit Umschalter „Alle 30 anzeigen", und die Erklärung je Eintrag einklappbar machen (`<details>`).

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/26-exam-result.png`

### U-M4 – Am Laptop bleibt die App auf 430 px Spaltenbreite beschränkt – die langen Listen werden dadurch unnötig lang

**Schwere:** mittel · **Bereich:** Layout/Desktop

**Was passiert:** `css/styles.css:535–545` klemmt den `body` ab 700 px Fensterbreite auf `max-width: 430px` fest (Telefon-Optik am Desktop). Bei 1280×900 belegt die App damit **34 % der Fensterbreite**, die restlichen ~850 px bleiben leer. Das ist für Übungsfragen vertretbar, für die drei Listenansichten aber der Hauptgrund für die extremen Scrollstrecken: Themenliste 6964 px (U-H2), Statistik 8454 px (U-M2), Prüfungsauswertung 11512 px (U-M3) – bei zwei- oder dreispaltigem Layout wären das jeweils ein Drittel. Der Code selbst nennt das Laptop-Szenario ausdrücklich als relevant („Die echte Prüfung findet am Laptop statt – Tastaturbedienung ist darum relevant", `js/app.js:1957`), das Layout trägt dem aber nicht Rechnung.

**Reproduktion:**
1. Fenster auf 1280×900 (oder breiter), App öffnen.
2. `getComputedStyle(document.body).maxWidth` → `430px`; `document.body.getBoundingClientRect().width` → `430`.
3. „Nach Thema lernen" öffnen – 111 Zeilen in einer 430 px breiten Spalte, `scrollHeight = 6964`.
4. Dasselbe in „Statistik" (8454 px) und in der Prüfungsauswertung (11512 px).

**Behebungsvorschlag:** Die 430-px-Klammer für Frage- und Prüfungsansichten beibehalten (dort ist die schmale Zeilenlänge gut lesbar), aber für die reinen Listenansichten – Themen, Statistik, Erfolge, Prüfungsauswertung – ab ca. 900 px Fensterbreite auf ein mehrspaltiges Raster umschalten (`display:grid; grid-template-columns: repeat(auto-fill, minmax(320px,1fr))` bei `max-width: 1100px`).

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/03-topics-top.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/31-stats.png`

### U-M5 – Nach „Weiter" landet der Fokus auf `<body>` – Tastaturnutzer verlieren bei jeder Frage ihre Position, Screenreader melden die neue Frage nicht

**Schwere:** mittel · **Bereich:** Tastatur

**Was passiert:** Der Quiz-Ablauf ist bis zum Prüfen sauber tastaturbedienbar: Ziffern 1–9 wählen Optionen, Pfeiltasten bewegen sich im Optionsfeld (Roving Tabindex), Enter prüft, und nach dem Prüfen wandert der Fokus korrekt in `#explainBox` (`role="status"`), sodass die Auflösung vorgelesen wird. Beim **Weiterblättern** bricht die Kette: Nach `#nextBtn` wird `#app` komplett neu gerendert, der fokussierte Knopf verschwindet aus dem DOM, und der Fokus fällt auf `document.body` zurück – gemessen über drei aufeinanderfolgende Fragen, jedes Mal `afterNext = "BODY"`. Folgen: (a) Tastaturnutzer müssen sich pro Frage neu eintabben; (b) die neue Frage wird **nicht angekündigt** – die einzige Live-Region im Quiz ist der Toast (`#toast`, `role=status`, `aria-live=polite`), der Fragetext selbst steht in keiner. Ein Screenreader-Nutzer bekommt nach „Weiter" also Stille und muss die Seite manuell neu erkunden. Das wiegt schwer, weil die Zielprüfung laut Quelltextkommentar am Laptop stattfindet (`js/app.js:1957`).

**Reproduktion:**
1. Mischtraining starten.
2. Mit Ziffer `1` eine Option wählen, `Enter` → Auflösung erscheint, `document.activeElement.id` → `explainBox` (korrekt).
3. `Enter` erneut → nächste Frage.
4. `document.activeElement.tagName` → **`BODY`**.
5. `document.querySelectorAll('[aria-live],[role=status]')` in der Quiz-Ansicht → nur `div.toast`.

**Behebungsvorschlag:** Nach dem Rendern der nächsten Frage den Fokus gezielt setzen: bei Options-Fragen auf `.opt[tabindex="0"]`, bei numeric auf `#numField` (dort passiert das beim ersten Rendern bereits – `numericAutofocus` war `numField`). Zusätzlich den Fragetext-Container mit `role="status"`/`aria-live="polite"` oder – sauberer – die Frage als `<h2 tabindex="-1">` ausführen und diese fokussieren; dann wird „Frage 4 von 15 …" vorgelesen.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/52-quiz-after-keys.png`

### U-M6 – Themen-Chip verfehlt im Hellmodus die Kontrastvorgabe – alle 27 Themenfarben liegen unter 4,5:1

**Schwere:** mittel · **Bereich:** Kontrast

**Was passiert:** Der Chip mit dem Themennamen über jeder Frage färbt Text und Hintergrund aus derselben Themenfarbe: `background: <color>22` (≈13 % Deckkraft über Weiß), `color: <color>`, Schriftgröße 12 px, Gewicht 600. Damit ist der Kontrast zwangsläufig niedrig. Im Browser gemessen: 2,70:1 für die Farbe `#8a9a5a`. Rechnet man alle **27 verschiedenen Themenfarben** des Katalogs gegen den kompositierten Hintergrund, liegt das Ergebnis zwischen **2,70:1** (`#8a9a5a` Pathologie II, `#c8843f` TNM Bewegungsapparat) und **4,44:1** (`#6a5acd` Hirntumoren) – **27 von 27 verfehlen** die WCAG-AA-Schwelle von 4,5:1 für Text unter 18,66 px. Der Chip ist die einzige Stelle, an der während einer Frage das Thema steht; er ist damit nicht dekorativ. Im Dunkelmodus ist die Lage besser (gemessen 4,56:1), aber knapp. Alle übrigen Stichproben bestehen: Fragetext 17,0:1, Optionstext 17,0:1, Hinweiszeile 5,15:1, Fortschrittszähler 5,37:1.

**Reproduktion:**
1. Mischtraining starten, Chip mit dem Themennamen oben in der Fragekarte betrachten.
2. Konsole (Kontrast mit Alpha-Kompositierung über den Kartenhintergrund): für `.chip` mit Themenfarbe → 2,70:1 bei 12 px/600.
3. Nachrechnen für alle Farben: die 27 in `content.json` vorkommenden `TOPICS[*].color`-Werte gegen `color + 13 % über Weiß` → Spanne 2,70–4,44, keiner ≥ 4,5.

**Behebungsvorschlag:** Die Themenfarbe nur für Punkt und Rahmen des Chips verwenden und die Beschriftung in der normalen Textfarbe (`var(--text)`) setzen; oder die Farbe für den Text abdunkeln (`color-mix(in srgb, <color> 70%, black)`) und den Hintergrund heller lassen. Auch das Anheben auf 13 px/700 allein genügt nicht – die Schwelle sinkt erst ab 18,66 px auf 3:1.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/10-quiz-first.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/71-dark-quiz-checked.png`

## NIEDRIG

### U-N1 – Mitgetippte Einheit („75 %") blockiert den Prüf-Knopf kommentarlos

**Schwere:** niedrig · **Bereich:** numeric-Fragen

**Was passiert:** Bei den **443 numeric-Fragen mit Einheit** (%, mm, cm, Gy, Monate, mg/m², MBq, € …) steht die Einheit als grauer Zusatz rechts im Eingabefeld – das ist gut. Wer sie aber trotzdem mit eintippt („75 %" oder „75%" bei `analstat-b1-033`), erhält `parseNum` = `NaN`, `picks` bleibt leer und „Antwort prüfen" ist deaktiviert. Es erscheint keine Meldung; der Nutzer sieht eine gefüllte Eingabe und einen toten Knopf.

**Reproduktion:**
1. Mischtraining → numeric-Frage mit Einheit, z. B. `analstat-b1-033` (Lösung 75, Einheit %).
2. `75 %` eintippen → „Antwort prüfen" ist deaktiviert, keine Erklärung.
3. `75%` eintippen → dasselbe.
4. `75` eintippen → Knopf wird aktiv.

**Behebungsvorschlag:** In `parseNum()` eine angehängte Einheit tolerieren: nach der Zahl alles Nicht-Numerische abschneiden, sofern der Rest der Einheit der Frage entspricht (oder generell `parseFloat` auf den bereinigten String anwenden). Mindestens aber die stumme Deaktivierung durch eine sichtbare Rückmeldung ersetzen.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/92-numeric-with-unit.png`

### U-N2 – Die im Katalog hinterlegten Themen-Symbole werden nie benutzt – alle 111 Zeilen tragen dasselbe Sechseck

**Schwere:** niedrig · **Bereich:** Themenliste

**Was passiert:** Jedes Thema in `content.json` bringt ein eigenes Emoji mit (`🎲` Analytische Statistik, `📊`, `📈`, `🗂️` Basisdokumentation …). `renderTopics()` verwendet aber `iconTile(TOPIC_ICON[key] || "hexagon", t.color)` – `TOPIC_ICON` (`js/app.js:865`) ist eine fest verdrahtete Tabelle mit neun Schlüsseln aus dem **Beispielkatalog** (`grundlagen`, `tnm`, `icdo`, `icd10`, `grading`, `register`, `epidemiologie`, `therapie`, `datenschutz`). Kein einziger Schlüssel des echten Katalogs (`analstat_…`, `basisdok_…`, `darm_…`) trifft zu, also greift für **alle 111 Zeilen** der Fallback „hexagon". Das Feld `TOPICS[key].icon` wird nirgends gelesen. In der Liste unterscheiden sich die Zeilen damit nur noch durch die Farbe des Sechsecks – der schnellste visuelle Ankerpunkt fehlt, was in einer Liste dieser Länge (U-H2) direkt spürbar ist.

**Reproduktion:**
1. „Nach Thema lernen" öffnen – jede Zeile zeigt dasselbe Sechseck-Symbol.
2. Konsole: `TOPICS['analstat_grundlagen_wahrscheinlichkeit'].icon` → `'🎲'` (im Katalog vorhanden).
3. `Object.keys(TOPIC_ICON).filter(k => k in TOPICS)` → `[]` – keine Überschneidung.
4. Im Quelltext: `js/app.js:1247` nutzt `TOPIC_ICON[key]`, nie `t.icon`.

**Behebungsvorschlag:** In `renderTopics()` das mitgelieferte Emoji bevorzugen: `t.icon ? '<span class="topic-emoji">'+esc(t.icon)+'</span>' : iconTile(TOPIC_ICON[key] || "hexagon", t.color)`. `TOPIC_ICON` bleibt als Rückfallebene für den Beispielkatalog erhalten.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/03-topics-top.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/04-topics-bottom.png`

### U-N3 – Nach dem Import meldet die App „zusammengeführt", zeigt aber inkonsistente Zähler: XP aus der Datei, Fragenzahl aus dem Gerät

**Schwere:** niedrig · **Bereich:** Backup-Import

**Was passiert:** Backup-Export und -Import funktionieren im Grundsatz sauber (siehe „Was gut funktioniert"). Beim Zusammenführen wird jedoch `xp` als Maximum übernommen, während `totalAnswered`/`totalCorrect` aus `perQuestion` **neu berechnet** werden. Test: Gerätestand 60 beantwortet / 420 XP, Importdatei mit `xp: 9999`, `totalAnswered: 500`, `totalCorrect: 400`, aber unverändertem `perQuestion`. Ergebnis nach dem Import: `S.xp = 9999` (also Level-Sprung), `S.totalAnswered = 60`. Die Startseite zeigt danach ein hohes Level neben „60 beantwortet" – für den Nutzer sieht das aus, als sei der Import halb misslungen. Im Alltag tritt das auf, wenn ein Backup aus einer älteren App-Version eingespielt wird, in der `perQuestion` noch anders aussah, oder nach einem Katalogwechsel mit umbenannten IDs (siehe `AUDIT_CODE.md` H3).

**Reproduktion:**
1. Einstellungen → „Backup exportieren" (Datei `adt-trainer-backup-2026-07-27.json`, ~10,9 KB, enthält korrekt **keine** Katalogdaten).
2. In der Datei `state.xp` auf `9999` und `state.totalAnswered` auf `500` setzen, `perQuestion` unverändert lassen.
3. Einstellungen → „Backup importieren" → Datei wählen. Toast: „✅ Backup importiert & zusammengeführt".
4. Konsole: `S.xp` → `9999`, `S.totalAnswered` → `60`.

**Behebungsvorschlag:** Entweder alle Zähler konsistent aus `perQuestion` ableiten (auch XP und Level neu berechnen) oder alle konsistent per Maximum übernehmen. Zusätzlich nach dem Import eine kurze Zusammenfassung statt eines Toasts anzeigen: „X Fragen ergänzt, Y aktualisiert, Level Z" – dann ist nachvollziehbar, was passiert ist.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/35-import-done.png`

### U-N4 – Kein Sprunglink und keine Überschriftenstruktur – in der Themenliste liegen 112 Tabstopps hintereinander

**Schwere:** niedrig · **Bereich:** Tastatur/ARIA

**Was passiert:** Die Themenliste erzeugt 112 fokussierbare Elemente (111 Themenzeilen + Zurück-Pfeil); ein Sprunglink existiert nicht (`document.querySelector('.skip-link, a[href="#app"]')` → `null`). Wer per Tastatur zum Fußtext oder zurück zur Kopfzeile will, tabbt 111-mal. Zugleich fehlt die Überschriftengliederung, mit der Screenreader-Nutzer das umgehen könnten: die Abschnittsmarken „ÜBEN", „PRÜFUNG", „FORTSCHRITT", „WÄHLE EIN THEMA" sind `<div class="section-title">` ohne `role="heading"`; als Überschriften existieren nur zwei konkurrierende `<h1>` („ADT Trainer" in der Kopfleiste und der Seitentitel) sowie ein `<h2>`. `<nav>`-Landmarken gibt es keine.

**Reproduktion:**
1. „Nach Thema lernen" öffnen.
2. Konsole: `document.querySelectorAll('#app button').length` → `111`.
3. `document.querySelector('.skip-link, a[href="#app"]')` → `null`.
4. `document.querySelector('.section-title').tagName` → `DIV`, `getAttribute('role')` → `null`.
5. `document.querySelectorAll('h1').length` → `2`.

**Behebungsvorschlag:** `.section-title` als `<h2>` ausführen (Optik bleibt über die Klasse erhalten), in der Kopfleiste den App-Namen auf `<p>`/`<span>` herabstufen und den Seitentitel als einziges `<h1>` führen. Ein „Zum Inhalt springen"-Link als erstes Element im `<body>` kostet wenig und behebt den Tab-Stau; ein Suchfeld (U-H2) entschärft ihn zusätzlich, weil die Liste dann kurz ist.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/50-focus-home.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/03-topics-top.png`

### U-N5 – Der Installationshinweis nennt immer Safari/iPhone – auch in Chrome am Laptop und auf Android

**Schwere:** niedrig · **Bereich:** Startseite

**Was passiert:** Ganz oben auf der Startseite steht dauerhaft „**Als App installieren:** in Safari unten auf **Teilen** tippen → **„Zum Home-Bildschirm"**. Danach funktioniert alles offline." Die Bedingung dafür ist in `js/app.js:935–939` allein `standalone === false` – das Betriebssystem oder der Browser wird nicht geprüft. Im Test-Chromium unter Linux erscheint der Hinweis also unverändert, ebenso würde er in Chrome unter Windows oder auf Android erscheinen, wo es weder „Teilen" unten noch „Zum Home-Bildschirm" in dieser Form gibt. Derselbe Text steht ein zweites Mal unter „So funktioniert's" (`js/app.js:1862`) und ein drittes Mal im Erinnerungs-Bereich (`js/app.js:1142`). Der Hinweis belegt die wertvollste Fläche der Startseite (über Level, Tagesziel und allen Übungsknöpfen) mit einer Anleitung, die für einen Teil der Nutzer nicht stimmt.

**Reproduktion:**
1. App in Chromium/Chrome am Laptop öffnen (nicht als installierte App).
2. Erste Zeile unter der Kopfleiste: „Als App installieren: in Safari unten auf Teilen tippen → ‚Zum Home-Bildschirm'."
3. Konsole: `window.navigator.standalone` → `undefined`, `matchMedia('(display-mode: standalone)').matches` → `false` – mehr wird nicht abgefragt.

**Behebungsvorschlag:** Den Hinweis nur auf iOS-Safari zeigen (`/iP(hone|ad|od)/.test(navigator.userAgent) && !window.MSStream`), auf Chromium-Browsern stattdessen das `beforeinstallprompt`-Ereignis abfangen und einen echten „Installieren"-Knopf anbieten, und auf allen anderen Plattformen nichts einblenden. Zusätzlich den Hinweis nach dem ersten Wegtippen dauerhaft ausblenden (Merker in localStorage).

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/02-home.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/40-offline-home.png`

### U-N6 – Prüfungs-Markierung (40×40 px) und die 30 Felder der Prüfungsübersicht (42×42 px) liegen unter der 44-px-Empfehlung

**Schwere:** niedrig · **Bereich:** Mobil

**Was passiert:** Auf dem Mobil-Viewport (390×844, `isMobile`, `hasTouch`) sind praktisch alle Bedienelemente großzügig bemessen – Startseite, Themenliste und Quiz haben **kein einziges** Tap-Ziel unter 44×44 px. Zwei Ausnahmen liegen ausgerechnet in der Prüfungssimulation, wo unter Zeitdruck getippt wird: die Flaggen-Schaltfläche „Frage zur Überprüfung markieren" misst **40×40 px**, und in der Übersicht messen alle **30 Fragennummern-Felder 42×42 px**. Beides liegt knapp unter der WCAG-2.2-Empfehlung von 44×44 (AAA 2.5.5 / AA 2.5.8 verlangt 24×24, das ist erfüllt). Die Felder der Übersicht stehen dicht an dicht, ein Fehlgriff springt zur falschen Frage.

**Reproduktion:**
1. Chromium mit `viewport: {width:390,height:844}, isMobile:true, hasTouch:true` starten.
2. Prüfungssimulation starten; Flaggen-Knopf oben rechts messen: `document.getElementById('examFlag').getBoundingClientRect()` → 40×40.
3. „Übersicht · x/30 beantwortet" öffnen; ein Nummernfeld messen → 42×42.
4. Zum Vergleich Startseite/Themen/Quiz: kein Element unter 44×44.

**Behebungsvorschlag:** Beide auf mindestens 44×44 px anheben (bei der Übersicht reicht `min-width/min-height: 44px` mit etwas mehr `gap`; bei 390 px Breite passen dann 6 Felder pro Zeile statt 7). Der sichtbare Kreis darf kleiner bleiben, wenn die Trefferfläche über Padding vergrößert wird.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/66-mobile-exam.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/67-mobile-exam-overview.png`

### U-N7 – Bei 200 % Zoom auf dem Telefon entsteht waagerechtes Scrollen; Antworttexte laufen über den Kartenrand

**Schwere:** niedrig · **Bereich:** Zoom

**Was passiert:** Die vorgeschriebene Reflow-Schwelle wird eingehalten: bei 320, 360 und 390 CSS-px Breite gibt es **kein** waagerechtes Scrollen und **keine** überstehenden Elemente – auch nicht mit der Einstellung „Schriftgröße: Groß" (Wurzelschrift 18 px). Darüber hinaus bricht das Layout jedoch: bei 200 % Zoom auf einem 390-px-Gerät (entspricht 195 CSS px Breite) meldet `document.documentElement.scrollWidth > clientWidth` in allen drei geprüften Ansichten waagerechtes Scrollen – Startseite 263/195 px, Quiz 209/195 px, Statistik 262/195 px. Konkret stehen über: der Kachelblock „Tagesziel heute / Ziel ändern" und die dritte Kennzahl-Kachel („XP gesamt") auf der Startseite, der Antworttext `.otext` im Quiz (rechter Rand bei 208 px, sichtbar abgeschnitten) und die Prozentspalte `.tp` in der Statistik. Das trifft genau die Nutzergruppe, die vergrößert – wer 200 % Zoom braucht, muss dann zusätzlich in beide Richtungen scrollen.

**Reproduktion:**
1. Viewport auf 195×422 CSS px (= 390-px-Telefon bei 200 % Zoom) setzen.
2. Startseite: `document.documentElement.scrollWidth` → `263`, `clientWidth` → `195`.
3. Mischtraining öffnen: `scrollWidth` → `209`; `document.querySelector('.otext').getBoundingClientRect().right` → `208` bei 195 px Fensterbreite.
4. Statistik: `scrollWidth` → `262`.
5. Gegenprobe bei 320 px: `scrollWidth === clientWidth === 320` in allen Ansichten, auch mit „Schriftgröße: Groß".

**Behebungsvorschlag:** Die betroffenen Blöcke unterhalb einer Mindestbreite umbrechen lassen: „Tagesziel/Ziel ändern" und die dreiteilige Kennzahlenreihe per `flex-wrap: wrap` bzw. `grid-template-columns: repeat(auto-fit, minmax(90px,1fr))`; für `.otext` `min-width: 0` und `overflow-wrap: anywhere` setzen, damit lange Wirkstoffnamen („Pembrolizumab") umbrechen statt überzustehen.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/75-zoom200-home.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/76-zoom200-quiz.png` · `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/77-zoom200-stats.png`

### U-N8 – „Sync-Code erstellt" wird auch ohne Netz gemeldet – der Code existiert dann nur auf diesem Gerät

**Schwere:** niedrig · **Bereich:** Synchronisation

**Was passiert:** „Neuen Sync-Code erstellen" erzeugt den Code lokal (`ADTSync.generateCode()`, `js/sync.js:37`), speichert ihn und zeigt sofort den Erfolgs-Toast „✨ Sync-Code erstellt" (`js/app.js:1196–1198`) – **bevor** `runSync()` überhaupt versucht, ihn an den Server zu übertragen. Ohne Verbindung (hier: jeder Supabase-Aufruf endet mit `ERR_TUNNEL_CONNECTION_FAILED`) erscheint trotzdem der Erfolgstext samt gut sichtbarem Code „ADT-Y3FUK-B3QV6-C6549". Dass nichts angekommen ist, verraten nur zwei unauffällige Nebentexte: der Chip „⏳ Abgleich ausstehend" und „Zuletzt synchronisiert: noch nie". Wer den Code notiert und auf dem zweiten Gerät eingibt, findet dort zunächst nichts – der Fortschritt erscheint erst, wenn das erste Gerät irgendwann wieder online geht und pusht. Für den Nutzer sieht das wie ein defekter Sync aus.

**Reproduktion:**
1. Ohne erreichbaren Supabase-Server (oder `context.setOffline(true)`) Einstellungen öffnen.
2. „Neuen Sync-Code erstellen" antippen.
3. Toast: „✨ Sync-Code erstellt"; der Code wird groß angezeigt.
4. Daneben: Chip „⏳ Abgleich ausstehend", darunter „Zuletzt synchronisiert: noch nie".
5. Konsole: vier `ERR_TUNNEL_CONNECTION_FAILED`-Fehler, keine sichtbare Fehlermeldung in der Oberfläche.

**Behebungsvorschlag:** Den Erfolgs-Toast erst nach erfolgreichem `runSync()` zeigen; scheitert der Push, stattdessen „Code angelegt – wird übertragen, sobald du online bist" melden und den Hinweis „Noch nicht in der Cloud – auf dem zweiten Gerät erst nach der ersten Übertragung nutzbar" **prominent** neben den Code setzen statt nur als Chip.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/102-sync-offline-fehler.png`

### U-N9 – Die Auswertung einer Übungsrunde zeigt keine Übersicht der Fehler – anders als die Prüfungsauswertung

**Schwere:** niedrig · **Bereich:** Übungsrunde

**Was passiert:** Nach einer Runde Mischtraining (Standard 15 Fragen) besteht die Ergebnisseite nur aus dem Kopfbereich: Emoji, „Dranbleiben, das wird!“, „33 %“, „5 von 15 richtig“ – die gesamte Seite ist **900 px** hoch, also genau ein Bildschirm, ohne jede Auflistung. Welche Fragen falsch waren, ist nicht mehr nachvollziehbar; die einzige Möglichkeit ist der Knopf „Falsche wiederholen (10)“, der die Fragen erneut stellt. Das steht in auffälligem Gegensatz zur Prüfungsauswertung, die umgekehrt **alle** 30 Fragen vollständig ausklappt (U-M3). Wer eine Runde durchgearbeitet hat und die Erklärung zu Frage 4 noch einmal nachlesen möchte, muss die Frage erneut beantworten.

**Reproduktion:**
1. Mischtraining starten (15 Fragen) und alle 15 beantworten.
2. Nach der letzten Frage „Auswertung ansehen".
3. Ergebnisseite: `document.documentElement.scrollHeight` → `900`; `document.querySelectorAll(".review-item").length` → `0`.
4. Aktionsleiste: nur „Falsche wiederholen (10)" und „Zur Startseite".

**Behebungsvorschlag:** Die Ergebnisseite der Übungsrunde um dieselbe – aber standardmäßig auf die falschen Fragen beschränkte – Auflistung ergänzen, die die Prüfung schon rendert (`.review-item`). Damit werden beide Auswertungen konsistent und beide Extreme (nichts / alles) verschwinden.

**Screenshot:** `/tmp/claude-0/-home-user/d43e6db4-757b-55bd-85ca-1e209f5e93ce/scratchpad/b3/110-runde-ergebnis.png`

---

# Messwerte

Alle Werte auf einem lokalen Rechner gegen `http://localhost:8099/` gemessen –
**ohne Netzlatenz**. Auf einem echten Gerät über Mobilfunk kommt die Übertragungszeit
für ~180 KB Programmcode beim allerersten Aufruf hinzu; der Katalog liegt danach lokal.

### Startzeiten

| Szenario | Zeit bis Startseite bedienbar |
|---|---|
| Kaltstart, brandneues Profil, **ohne** Inhalte (Freischalt-Bildschirm) | **207 ms** |
| Kaltstart, IndexedDB gefüllt, kein Service-Worker-Cache | **112 ms** |
| Warmstart (Service Worker aktiv, zweites Neuladen) | **75 ms** |
| Warmstart, drittes Neuladen | **~75 ms** |
| Offline-Neuladen (`context.setOffline(true)`) | **85 ms** |

Ergänzende Navigationsdaten beim Warmstart: `domContentLoaded` 18 ms, `loadEventEnd` 19 ms,
First Contentful Paint **36 ms**. Der Katalog wird also nach dem Rendern der Programmoberfläche
nachgezogen und blockiert den ersten Bildaufbau nicht.

### Katalog laden

| Kennwert | Wert |
|---|---|
| Lesen aus IndexedDB + Deserialisieren (`hydrateContent`) | **17 ms** |
| Fragen / Themen im Katalog | **5977 / 111** |
| Katalog als JSON | **3 906 356 Zeichen** (≈ 7,4 MB als UTF-16 im Speicher) |

### Speicherbedarf

| Posten | Größe |
|---|---|
| **IndexedDB-Eintrag `adt_content/kv/content_v1`** | **1 874 226 Bytes (1,79 MB)** – strukturiert geklont, deutlich kleiner als der JSON-Text |
| Service-Worker-Cache `adt-shell-v1` (12 Dateien) | 245 745 Bytes (240 KB) |
| Service-Worker-Registrierung | 5 382 Bytes |
| **Belegung gesamt** (`navigator.storage.estimate`) | **2,03 MB** von 884–926 MB Kontingent (**0,2 %**) |
| localStorage insgesamt | ~20,6 KB · `adt_trainer_state_v1` 20 375 Zeichen bei 200 gelernten Fragen (≈ 102 Byte je Frage) · `adt_content_idb` 1 · `adt_content_code` 8 · `adt_onboarded` 1 |
| Hochgerechnet bei allen 5977 gelernten Fragen | ~600 KB in localStorage – unter dem iOS-Limit von ~5 MB, aber in derselben Größenordnung wie eine Sicherungsdatei |
| JS-Heap nach dem Laden des Katalogs | **33,7 MB belegt / 43,2 MB reserviert** (Limit 4096 MB) |

### Umfang der Ansichten (Fensterhöhe 900 px bzw. 844 px mobil)

| Ansicht | Desktop 1280×900 | Mobil 390×844 |
|---|---|---|
| Startseite | 1448 px | – |
| Themenliste (111 Einträge) | **6964 px** = 7,7 Bildschirme | **7114 px** = 8,4 Bildschirme (Zeilenhöhe 80 px) |
| Statistik (111 Themenzeilen) | **8454 px** = 9,4 Bildschirme | **9339 px** = 11,1 Bildschirme |
| Prüfungsauswertung (30 Fragen) | **11 512 px** = 12,8 Bildschirme | – |
| Längste Frage im Katalog (`strahl-b2-046`, 5 Optionen, längste Option 153 Zeichen) | – | 1151 px – passt in 1,4 Bildschirme |

Renderzeiten: Themenliste 97 ms nach dem Antippen, ein vollständiger Scroll-Durchlauf
über alle 111 Zeilen 0 ms Skriptzeit (kein Ruckeln, kein virtuelles Scrollen nötig),
Prüfungsstart 805 ms.

### Katalog-Zusammensetzung (Grundlage mehrerer Befunde)

| Kennwert | Wert |
|---|---|
| Fragetypen | multi 3566 · single 1579 · numeric 832 |
| Fragen je Thema | min 1 · Median 42 · max 205 · kein leeres Thema |
| numeric mit Toleranz 0 (exakte Eingabe nötig) | **768 von 832** |
| davon mit Dezimalantwort | **148** (11 mit ≥ 3 Nachkommastellen) |
| numeric mit Antwort ≥ 1000 (Tausenderpunkt-Risiko) | **39** |
| numeric mit Antwort 0 | 3 |
| numeric mit Einheit | 443 (17 verschiedene: %, mm, cm, Gy, Monate, mg/m², MBq, €, …) |
| Verschiedene Themenfarben | 27 – **alle** verfehlen als Chip-Text die Kontrastvorgabe 4,5:1 (2,70–4,44) |

### Fehlerbild in der Konsole

Über alle Durchläufe hinweg: **keine unbehandelten Promise-Rejections**, **keine
`pageerror`-Ereignisse**, keine JavaScript-Ausnahmen. Die einzigen Konsolenfehler sind
fehlgeschlagene Netzaufrufe zu Supabase (`net::ERR_TUNNEL_CONNECTION_FAILED`, 1–4 je
Sitzung) – sie werden von der App abgefangen und stören den Ablauf nicht. Eine
`console.warn` erschien nur beim absichtlichen Import einer beschädigten Datei
(„Import fehlgeschlagen SyntaxError …\", `js/app.js:2240`), begleitet von einer korrekten
Meldung in der Oberfläche.


---

# Was gut funktioniert

Das Folgende wurde geprüft und funktionierte einwandfrei – es ist die Gegenprobe zu den
Befunden oben, damit bei einer Überarbeitung nichts davon verloren geht.

**Start und Stabilität**
- Die App ist in **112 ms** bedienbar, obwohl 5977 Fragen aus IndexedDB kommen; der Katalog
  blockiert den ersten Bildaufbau nicht (FCP 36 ms).
- In sämtlichen Durchläufen (Start, Quiz, Prüfung, Statistik, Backup, Offline, Mobil, Zoom)
  trat **keine einzige JavaScript-Ausnahme** und **keine unbehandelte Promise-Rejection** auf.
- Der Freischalt-Bildschirm ist verständlich formuliert und nennt die Bedingung
  („Zum Freischalten einmalig online sein“).

**Offline-Betrieb – der stärkste Teil der App**
- Nach `context.setOffline(true)` lädt die App in **85 ms** neu und ist vollständig bedienbar.
  Der Service Worker (`adt-shell-v1`) hält alle 12 nötigen Dateien vor.
- Offline geprüft und funktionsfähig: Startseite, Mischtraining inklusive Bewertung und
  Erklärung, Einstellungen, **Start einer kompletten Prüfungssimulation**. Nichts hängt,
  nichts meldet einen Fehler, es gibt keine Wartezustände.
- Die Netzfehler zu Supabase werden sauber abgefangen und schlagen nicht in die Oberfläche durch.

**Quiz-Ablauf**
- Richtig/falsch wird eindeutig zurückgemeldet („✅ Richtig“ / „❌ Nicht ganz“), die
  Erklärung erscheint sofort, nicht gewählte richtige Antworten werden mit „Richtige Antwort“
  markiert, falsch gewählte separat – alle Optionen werden nach dem Prüfen korrekt gesperrt
  (`.opt` sämtlich `disabled`), ein nachträgliches Ändern ist nicht möglich.
- Bei multi-Fragen steht die Bewertungsregel **vor** dem Antworten da: „Es können mehrere
  Antworten richtig sein. Nur vollständig richtig zählt (Prüfungsregel).“ Das ist genau die
  Regel der echten Prüfung und wird konsistent angewandt (teilrichtig = falsch, mit korrekter
  Markierung der verpassten Option).
- Die Optionsreihenfolge wird je Frage gemischt, der Fortschrittsbalken ist als
  `role="progressbar"` mit `aria-valuenow` ausgezeichnet.

**Prüfungssimulation**
- 30 Fragen, **45-Minuten-Timer**, Bestehensgrenze 50 % – alles vorab sichtbar. Start in 805 ms.
- Keine Zwischenrückmeldung während der Prüfung (prüfungsgetreu), Antworten bleiben bis zur
  Abgabe änderbar, Vor-/Zurück-Navigation, Markierungsfunktion und eine Übersicht mit
  Beantwortungsstand sind vorhanden.
- Die Abgabe fragt sinnvoll zurück: „25 Frage(n) noch unbeantwortet. Trotzdem abgeben und
  auswerten?“ mit „Abgeben“ / „Weiter prüfen“.
- Die Auswertung zeigt Prozentwert, Ring-Diagramm, „NICHT BESTANDEN · Grenze 50 %“ und bietet
  direkt „Falsche wiederholen (27)“ an – der wichtigste Anschlussschritt ist einen Klick entfernt.
- Eine laufende Prüfung wird erkannt und auf der Startseite als „▶︎ Läuft – tippen zum
  Fortsetzen“ angeboten.

**Backup**
- Export erzeugt `adt-trainer-backup-2026-07-27.json` (10,9 KB) mit `schemaVersion`,
  `exportedAt` und dem vollständigen Lernstand – und enthält korrekt **keine** Katalogdaten
  (geprüft: kein `QUESTIONS` in der Datei). Das ist für einen zugangsgeschützten Katalog genau richtig.
- Import meldet „✅ Backup importiert & zusammengeführt“ und führt zusammen, statt zu überschreiben.
- Eine absichtlich beschädigte Datei führt zu einer klaren Meldung
  („⚠️ Datei konnte nicht gelesen werden“) statt zu einem Absturz; der bisherige Stand bleibt unberührt.
- Das Datei-Eingabefeld wird nach dem Import zurückgesetzt, dieselbe Datei lässt sich also erneut wählen.

**Darstellung**
- **Kein waagerechtes Scrollen** bei 320, 360 und 390 px Breite – in Startseite, Quiz und
  Statistik, auch mit der Einstellung „Schriftgröße: Groß“ (Wurzelschrift 18 px). Kein einziges
  überstehendes Element.
- Dunkelmodus folgt dem System (`prefers-color-scheme: dark` → Hintergrund `rgb(0,0,0)`), und
  die manuelle Umstellung auf „Hell“ setzt sich gegen ein dunkles System korrekt durch.
- Auf 390×844 hat **keine** Ansicht außer der Prüfung ein Tap-Ziel unter 44×44 px.
- Kontraste außerhalb des Themen-Chips sind gut bis sehr gut: Fragetext und Optionstext 17,0:1,
  Hinweiszeile 5,15:1, Fortschrittszähler 5,37:1.
- Die längste Frage des Katalogs (`strahl-b2-046`, 5 Optionen, längste Option 153 Zeichen)
  bleibt auf dem Telefon vollständig lesbar und läuft nirgends über.

**Tastatur und ARIA**
- `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px }` ist global gesetzt –
  der Fokus ist auf **jedem** geprüften Element deutlich sichtbar.
- **Kein einziges Bedienelement ohne zugängliche Beschriftung** (Prüfung über alle
  `button`, `a[href]`, `input`, `select` einer Ansicht: 0 Treffer). Symbolknöpfe tragen
  `aria-label` („Zurück“, „Frage zur Überprüfung markieren“, „Antwort als Zahl eingeben“).
- Ziffern 1–9 wählen Optionen, Enter prüft und blättert weiter, Pfeiltasten bewegen sich im
  Optionsfeld nach dem WAI-ARIA-Muster mit Roving Tabindex (`tabindex="0"` auf genau einem Element).
- Optionen sind korrekt als `role="radio"`/`role="checkbox"` mit `aria-checked` in einer
  Gruppe `role="radiogroup"`/`role="group"` mit `aria-label="Antwortmöglichkeiten"` ausgezeichnet;
  nach dem Prüfen kommt `aria-disabled` und eine sprechende Beschriftung („… – richtig, ausgewählt“) hinzu.
- Der Fokus springt nach dem Prüfen in die Erklärung (`#explainBox`, `role="status"`), sie wird
  also vorgelesen. Toasts sind `role="status"` mit `aria-live="polite"`.
- `lang="de"` ist gesetzt, es gibt genau ein `<main>` und ein `<header>`.

**Bedienführung**
- Das Verlassen von Quiz und Prüfung ist mit passend unterschiedlichen Rückfragen abgesichert
  („Die Prüfung läuft weiter (die Zeit tickt)“ vs. „Der bisherige Fortschritt bleibt gespeichert“);
  System-Zurück und der Zurück-Pfeil verhalten sich gleich.
- „Inhalte neu freischalten“ warnt vorab verständlich und lässt sich abbrechen.
- Bei numeric-Fragen liegt der Fokus beim Öffnen bereits im Eingabefeld, das Feld ist
  `inputmode="decimal"` (Zifferntastatur auf dem Telefon), 55 px hoch, und die Einheit steht
  als eigener Zusatz rechts daneben, ohne die Eingabe zu überlappen.
- Nach jeder Runde bietet die Ergebnisseite „Falsche wiederholen (N)“ an.

