# Code-Audit ADT-Training

Stand: 2026-07-27 · Geprüfte Dateien: `js/app.js` (2355 Z.), `js/sync.js`, `sw.js`,
`index.html`, `config.js`, `css/styles.css`, `data/questions.js`, `manifest.webmanifest`,
`tests/*`. Betriebsannahme laut `config.js`: `contentGated: true`, Katalog ~5977 Fragen /
111 Themen (~7,4 MB) in IndexedDB.

Es sind **nur Befunde mit konkret benennbarem Fehlszenario** aufgeführt. Keine Stilkritik.

Zusammenfassung: **6 hoch · 17 mittel · 12 niedrig**

---

## HOCH

### H1 – Kompletter Lernfortschritt wird gelöscht, wenn der IndexedDB-Lesevorgang einmal scheitert

**Datei/Zeile:** `js/app.js:151`, `js/app.js:286–294`, `js/app.js:2288–2291`, `js/app.js:2304`

**Was schiefgeht (Szenario):**
1. `data/questions.js` setzt beim Laden `window.QUESTIONS` auf den **Beispielkatalog** (59 Fragen),
   weil bei IDB-Ablage `adt_content_v1` in localStorage bewusst gelöscht wurde (`app.js:266`).
2. Auf Modulebene läuft `let S = loadState();` (Z. 151) – also **vor** `boot()`. `sanitizeState()`
   filtert `perQuestion` gegen die aktuell geladenen IDs, das sind zu diesem Zeitpunkt die 59
   Beispiel-IDs. Alle Einträge des echten Katalogs (`gr-001` … 5977 Stück) fallen weg.
3. `boot()` repariert das nur, **wenn** `hydrateContent()` `true` liefert (Z. 2288). Liefert es
   `false` – iOS-Safari im privaten Modus, ITP-Eviction der IDB, `indexedDB.open` schlägt fehl,
   Datensatz beschädigt –, dann bleibt `S` der beschnittene Stand.
4. `contentUnlocked()` ist trotzdem `true` (die Markierung `adt_content_idb="1"` liegt in
   localStorage, `app.js:191`), der Gate erscheint also nicht; `DATA_OK` ist `true` (Beispielkatalog
   ist valide). Die App startet **ohne jede Meldung mit 59 Beispielfragen**.
5. Der erste Schreibvorgang macht den Verlust dauerhaft. Das passiert oft schon **vor** jeder
   Nutzerinteraktion: Z. 2304 `if (S.lastActiveDay && daysBetween(...) > 2) { S.streak = 0; saveState(); }`.
   Spätestens die erste beantwortete Frage (`checkCurrent → saveState`) überschreibt
   `adt_trainer_state_v1` mit dem beschnittenen Stand.

Ergebnis: XP/Level/Serie bleiben, aber **alle 5977 `perQuestion`-Einträge (Leitner-Boxen,
Fälligkeiten, Treffer/Fehler) sind weg** – irreversibel, ohne Hinweis. Cloud-Sync rettet das nur,
wenn er eingerichtet ist (`mergeStates` bildet die Vereinigung, `sync.js:78`).

**Vorschlag:**
- `loadState()` **nicht** auf Modulebene ausführen, sondern erst in `boot()` **nach** `hydrateContent()`.
  Bis dahin `S = freshState()` als Platzhalter, und Rendern erst nach `boot()`.
- Zusätzlich: schlägt `hydrateContent()` fehl, obwohl `CONTENT_IDB_FLAG === "1"` gesetzt ist, ist das
  ein **harter Fehler** – nicht stillschweigend auf den Beispielkatalog zurückfallen. Eigener
  Fehlerbildschirm („Inhalte konnten nicht geladen werden – Fortschritt ist gesichert“) mit den
  Aktionen „Erneut versuchen“ und „Inhalte neu freischalten“, und **kein** `saveState()` in diesem
  Zustand (Schreibsperre setzen).
- Siehe auch H3: die Beschneidung selbst gehört abgesichert.

---

### H2 – `boot()` kann dauerhaft hängen → weißer Bildschirm ohne Fehlermeldung

**Datei/Zeile:** `js/app.js:225–233` (`idbOpen`), `js/app.js:242–249` (`idbGet`), `js/app.js:2288`

**Was schiefgeht (Szenario):** `idbOpen()` löst sein Promise nur in `onsuccess`/`onerror` auf.
Der Fall `req.onblocked` wird nicht behandelt, und es gibt **keinen Timeout**. Bekannte
WebKit-Eigenheit: nach Wiederherstellung einer PWA aus dem Hintergrund bzw. nach einem
IDB-internen Fehler feuert ein `IDBOpenDBRequest` gelegentlich **überhaupt kein** Ereignis.
Dann bleibt `await hydrateContent()` in Z. 2288 für immer stehen. Da das gesamte Rendern
(`go("home")`, Gate, Fehlerbildschirm) hinter diesem `await` liegt und `boot().catch(...)`
(Z. 2324) nur bei einer *Ablehnung* greift, sieht der Nutzer **dauerhaft die leere
`<main id="app">`** – kein Spinner, kein Text, kein Ausweg außer App-Neustart (der dasselbe
Verhalten zeigen kann).

**Vorschlag:**
```js
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error("idb-timeout")), ms))]);
```
in `hydrateContent()` um `idbGet()` legen (z. B. 8000 ms), `req.onblocked` in `idbOpen()` als
Fehler behandeln, und den Timeout-Fall wie H1 als harten, sichtbaren Fehler führen.

---

### H3 – `sanitizeState()` verwirft Fortschritt bei jedem Katalog-Update mit geänderten IDs; der eingebaute Schutz greift nie

**Datei/Zeile:** `js/app.js:116–135`, insbesondere `js/app.js:119–123`

**Was schiefgeht (Szenario):** Der Guard lautet
```js
const knownQ = (typeof QUESTIONS !== "undefined" && Array.isArray(QUESTIONS) && QUESTIONS.length)
  ? new Set(QUESTIONS.map(q => q.id)) : null;
```
Er soll verhindern, dass ein Ladefehler den Fortschritt löscht. Er ist aber **wirkungslos**, weil
`QUESTIONS` durch `data/questions.js` **immer** befüllt ist (mindestens mit den 59 Beispielfragen).
`knownQ` ist damit nie `null`; die Filterung läuft immer, notfalls gegen den falschen Katalog (→ H1).

Zweites, unabhängiges Szenario: Der Betreiber liefert per `refreshContentInBackground()` einen
korrigierten Katalog aus, in dem eine Frage-ID umbenannt wurde (`reg-008` → `register-008`) oder
50 überholte Fragen entfernt wurden. Beim nächsten Start hydratisiert der neue Katalog, `loadState()`
wirft den Fortschritt zu allen nicht mehr vorhandenen IDs weg, `saveState()` macht es dauerhaft.
Betroffen sind auch Leitner-Boxen von Fragen, die es inhaltlich weiter gibt und nur umbenannt wurden.
Der `masteredCount()`/Badge-Stand bricht sichtbar ein, `totalAnswered` bleibt dagegen stehen –
der nächste `mergeStates()` (`sync.js:102–105`) rechnet die Gesamtzähler aus `perQuestion` neu und
**senkt** sie dann sichtbar ab.

**Vorschlag:**
- Unbekannte IDs **nicht löschen, sondern parken**: `s.orphanQuestions[id]` (mit Zeitstempel) statt
  `continue`. Beim nächsten Laden werden dort wieder vorhandene IDs zurückgeholt. Ein Katalog-Update
  mit umbenannten IDs verliert dann nichts.
- Falls Löschen gewünscht bleibt: nur löschen, wenn eine explizite Zusicherung vorliegt, dass der
  *richtige* Katalog geladen ist (z. B. Flag `contentSource === "idb"` bzw. Fingerprint stimmt), und
  hart begrenzen (nie mehr als x % der Einträge in einem Durchgang verwerfen, sonst abbrechen).
- Vor dem ersten Schreiben nach einem Katalogwechsel eine Sicherungskopie
  (`adt_trainer_state_v1.bak`) anlegen.

---

### H4 – `loadState()` wirft bei einem Parse-Fehler den kompletten Stand still weg

**Datei/Zeile:** `js/app.js:141–150`

**Was schiefgeht (Szenario):** iOS beendet Safari/die PWA während eines `localStorage.setItem`
(OOM-Kill, erzwungenes Beenden). Der Wert unter `adt_trainer_state_v1` ist abgeschnitten.
Beim nächsten Start wirft `JSON.parse` → `catch` → `return freshState()`. Der Nutzer sieht Level 1,
0 XP, Serie 0 und **keinerlei Hinweis**; nur `console.warn` protokolliert etwas. Der erste
`saveState()` überschreibt den beschädigten – möglicherweise noch zu 95 % rettbaren – Rohwert
endgültig. Das widerspricht dem Prinzip „Speicherstände sind heilig“ aus `workbook.md`.

**Vorschlag:** Im `catch` (a) den Rohwert unter `adt_trainer_state_v1.corrupt.<ts>` aufheben,
(b) einen zuvor bei jedem erfolgreichen Laden geschriebenen Schattenstand
(`adt_trainer_state_v1.bak`) versuchen und (c) den Nutzer per Modal informieren, statt kommentarlos
bei Null zu starten.

---

### H5 – Leeres Zahlenfeld wird als Antwort „0“ gewertet; deutsche Tausenderpunkte werden falsch gelesen

**Datei/Zeile:** `js/app.js:611` (`parseNum`), `js/app.js:612–616` (`hasResponse`),
`js/app.js:729–737` (`setNumericResponse`), `js/app.js:1531–1535` (`examSetNumeric`)

```js
function parseNum(v) { const n = Number(String(v).trim().replace(",", ".")); return isFinite(n) ? n : NaN; }
```

**Szenario A (leeres Feld = 0):** `Number("")` ist **0**, nicht `NaN` (verifiziert). Ablauf:
Nutzer tippt bei einer numeric-Frage „12“, merkt den Fehler, löscht das Feld vollständig.
`setNumericResponse("")` → `parseNum("")` = 0 → `isFinite(0)` → `set.add(0)` →
`hasResponse` = true → **„Antwort prüfen“ bleibt aktiv**. Ein Tippen darauf wertet die *leere*
Eingabe als „0“: `gradeQuestion` liefert falsch, `p.wrong++`, `srsUpdate(p,false)` setzt die Frage
auf **Box 0** zurück, `totalAnswered` steigt. Bei einer Frage mit Antwort 0 (oder Toleranz ≥ Antwort)
wäre das leere Feld sogar **richtig**. In der Prüfung zählt `examSetNumeric("")` die Frage über
`EXAM.picks[i].length` zusätzlich als „beantwortet“ (`app.js:1528, 1548`), sodass die Übersicht
und der Abgabe-Dialog eine falsche Zahl melden.

**Szenario B (Tausenderpunkt):** `replace(",", ".")` ersetzt nur das **erste** Komma und lässt Punkte
stehen. Eingabe „1.000“ für eintausend → `Number("1.000")` = **1** → als falsch gewertet, obwohl der
Nutzer richtig gerechnet hat. Eingabe „1.234,5“ → `"1.234.5"` → `NaN` → der Prüf-Knopf bleibt
**dauerhaft deaktiviert**, ohne dass irgendwo steht, warum (der Hinweis lautet nur
„Komma oder Punkt“, `app.js:1326`).

**Vorschlag:**
```js
function parseNum(v) {
  const s = String(v).trim();
  if (!s) return NaN;                                   // leer ist KEINE Antwort
  let t = s.replace(/\s| |'/g, "");
  if (/,/.test(t)) t = t.replace(/\./g, "").replace(",", ".");   // 1.234,5 -> 1234.5
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // 1.000 -> 1000
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
```
Zusätzlich `hasResponse` für numeric explizit gegen „Feld leer“ prüfen und bei unlesbarer Eingabe
eine sichtbare Rückmeldung statt eines stumm deaktivierten Knopfes zeigen.

---

### H6 – Ein einziger fehlerhafter Katalogeintrag legt die App tot – ohne Ausweg

**Datei/Zeile:** `js/app.js:7–27` (`checkData`), `js/app.js:2296–2298`

**Was schiefgeht (Szenario):** `checkData()` gibt beim **ersten** Verstoß `false` zurück. Liefert der
Server einen Katalog aus, in dem eine von 5977 Fragen ein Thema referenziert, das in `TOPICS` fehlt
(z. B. Tippfehler `epidemiolgie`), dann ist `DATA_OK` false und `boot()` zeigt
```
⚠️ Daten-Fehler – Die Fragen-Datenbank enthält einen Formatfehler. Details in der Konsole.
```
Dieser Bildschirm hat **keine Aktion**: keine Einstellungen, kein „Inhalte neu freischalten“
(`relockContent`, `app.js:2167`) ist erreichbar, kein Reload-Knopf. Das Gerät bleibt bis zu einem
manuellen Löschen der Website-Daten unbrauchbar – für 5976 einwandfreie Fragen. Da der Katalog
serverseitig ausgeliefert wird, betrifft ein solcher Fehler **alle** Geräte gleichzeitig.

**Vorschlag:** `checkData()` in `sanitizeCatalog()` umbauen: fehlerhafte Einträge herausfiltern,
zählen, protokollieren und nur dann abbrechen, wenn *kein* gültiger Eintrag übrig bleibt.
Zusätzlich den Fehlerbildschirm mit den Knöpfen „Neu laden“ und „Inhalte neu freischalten“
(ruft `relockContent()`) ausstatten.

---

## MITTEL

### M1 – Bei jedem App-Start wird der komplette ~7,4-MB-Katalog heruntergeladen

**Datei/Zeile:** `js/app.js:296–312` (`refreshContentInBackground`), Aufruf `js/app.js:2300`

**Was schiefgeht:** Der Fingerprint-Vergleich (Z. 306–307) findet **nach** `ADTSync.getContent(code)`
statt. Er spart nur den IDB-Schreibvorgang, **nicht den Download**. Konkret: Ein Nutzer öffnet die
App fünfmal am Tag in der Bahn → fünfmal ~7,4 MB JSON über Mobilfunk, obwohl sich nichts geändert
hat. Nebenbei konkurriert das mit dem Startvorgang um Bandbreite und Speicher (der Antwort-String
wird komplett in den Speicher geparst, `sync.js:133–134`), und Fehler werden vollständig
verschluckt (`catch (e) {}`, Z. 311).

**Vorschlag:** Serverseitig eine schlanke RPC `get_content_fp(p_code)` anbieten, die nur den
Fingerprint (und ggf. eine Versionsnummer) liefert; den Volltext nur bei Abweichung holen.
Alternativ `If-None-Match`/ETag nutzen. Zusätzlich höchstens einmal pro 24 h prüfen
(Zeitstempel in localStorage) und nur bei `navigator.connection.saveData !== true`.

---

### M2 – Inhaltliche Korrekturen werden vom Fingerprint nicht erkannt

**Datei/Zeile:** `js/app.js:206–220` (`contentFingerprint`)

**Was schiefgeht:** Gemischt werden nur `id`, `question`, `explanation`, `options`, `correct`,
`answer`. **Nicht** berücksichtigt: `type`, `topic`, `difficulty`, `tolerance`, `unit` sowie der
gesamte Inhalt von `TOPICS` (nur `Object.keys(...).length` fließt ein).

Konkrete Fälle, die nie bei den Nutzern ankommen:
- Eine Frage wird von `"single"` auf `"multi"` korrigiert (gleiche `options`, gleiches `correct`
  mit einem Element) → Fingerprint identisch → Update wird nie geschrieben; Nutzer sehen weiter
  „Einfachauswahl“.
- Eine numeric-Frage bekommt `tolerance: 0.5` statt `0`, weil Nutzer sich über Rundung beschwert
  haben → Fingerprint identisch → Toleranz bleibt bei den Nutzern 0, korrekte Antworten weiter falsch.
- Eine Frage wird dem richtigen Thema zugeordnet (`topic` geändert) oder ein Themenname/eine
  Themenfarbe wird korrigiert → Fingerprint identisch → Themenstatistik bleibt falsch.

**Vorschlag:** Alle bewertungs- und anzeigerelevanten Felder mitmischen:
```js
mix(q.id); mix(q.topic || ""); mix(q.type || ""); mix(String(q.difficulty ?? ""));
mix(q.question || ""); mix(q.explanation || ""); mix(q.unit || ""); mix(String(q.tolerance ?? ""));
```
sowie `JSON.stringify(content.TOPICS)` in einem Durchgang. Zusätzlich Feldtrenner (`mix(" ")`)
einfügen, damit Verschiebungen zwischen Feldern nicht ausgeglichen werden. Siehe auch N7.

---

### M3 – Nach einem Rückfall auf localStorage bleibt die IDB-Markierung stehen → veralteter Katalog überschreibt den neuen

**Datei/Zeile:** `js/app.js:260–281` (`storeUnlockedContent`), `js/app.js:286–294` (`hydrateContent`)

**Was schiefgeht (Szenario):** Gerät hat Inhalte in IndexedDB (`adt_content_idb === "1"`).
`refreshContentInBackground()` holt einen neuen Katalog; `idbPut` scheitert (Speicherdruck,
IDB vorübergehend gesperrt). Der Fallback in Z. 273–275 schreibt den neuen Katalog erfolgreich nach
localStorage und gibt `"ok"` zurück – **`CONTENT_IDB_FLAG` bleibt aber auf `"1"`**, und
`CONTENT_FP_KEY` wird auf den neuen Fingerprint gesetzt (Z. 309).

Nächster Start: `data/questions.js` lädt korrekt den **neuen** Katalog aus `adt_content_v1`; danach
sieht `hydrateContent()` das Flag `"1"`, liest den **alten** IDB-Datensatz und **überschreibt**
`window.TOPICS`/`window.QUESTIONS` damit. Der Nutzer arbeitet dauerhaft mit dem alten Katalog,
während der Fingerprint bereits den neuen meldet – die Hintergrundaktualisierung „hakt“ still fest
und wird nie wieder etwas herunterladen.

**Vorschlag:** Der localStorage-Pfad muss `localStorage.removeItem(CONTENT_IDB_FLAG)` setzen
(und den IDB-Datensatz per `idbDelete()` räumen), bevor er `"ok"` meldet. Sauberer: eine einzige
Variable `adt_content_store = "idb" | "ls"` statt zweier unabhängiger Markierungen.

---

### M4 – localStorage-Fallback für den Katalog ist auf iOS aktiv schädlich

**Datei/Zeile:** `js/app.js:273–280`

**Was schiefgeht (Szenario):** Ist IndexedDB nicht nutzbar (iOS-Privatmodus), versucht die App
`localStorage.setItem(CONTENT_KEY, JSON.stringify(payload))` mit ~3,9 Mio. Zeichen. Zwei Folgen:
1. Der `JSON.stringify` erzeugt vorher einen ~7,4-MB-UTF-16-String im Speicher – auf älteren
   iPhones ein realistischer Auslöser für einen Tab-Neustart *bevor* der `QuotaExceededError` kommt.
2. Passt ein kleinerer Katalog gerade noch (z. B. 3,5 MB von 5 MB), ist das Kontingent danach fast
   voll. Der Lernstand selbst braucht bei 5977 Fragen ~1,3 MB UTF-16
   (`{"seen":..,"correct":..,"box":..,"due":"YYYY-MM-DD","masteredOnce":false}` ≈ 110 Byte/Eintrag).
   Ab da wirft **jeder** `persistLocal()` `QuotaExceededError` (`app.js:154–162`); der Nutzer sieht
   den Toast „⚠️ Speicher voll“ **genau einmal** (`quotaWarned` wird nie zurückgesetzt) und lernt
   danach stundenlang, ohne dass irgendetwas gespeichert wird.

**Vorschlag:** Den localStorage-Fallback auf kleine Kataloge begrenzen (`json.length < 1_500_000`,
sonst direkt `"quota"` melden) und dem Nutzer im Gate klar sagen, dass dieses Gerät/dieser Modus
nicht unterstützt wird. `quotaWarned` nach einem erfolgreichen Schreibvorgang zurücksetzen und bei
anhaltendem Fehler ein persistentes Banner statt eines Toasts anzeigen.

---

### M5 – „Code ungültig“ auch bei Server-/Netzfehler; zusätzlich kein Retry

**Datei/Zeile:** `js/sync.js:225–231` (`getContent`), `js/app.js:2093–2097` (Gate)

**Was schiefgeht:** `getContent()` fängt **alles** ab und gibt `null` zurück – 401 (falscher Code),
500 (Supabase-Ausfall), CORS-Fehler, DNS-Fehler, abgebrochene Mobilfunkverbindung sind nicht
unterscheidbar. Der Gate meldet daraufhin „Code ungültig oder Inhalte nicht erreichbar.“
Konkret: Supabase hat eine Störung, der Nutzer tippt seinen korrekten Zugangscode zum fünften Mal
ab, prüft Groß-/Kleinschreibung, fragt beim Kursleiter nach – die Ursache steht in der Konsole.
Zusätzlich nutzt `getContent` bewusst `rpcOnce` **ohne** Wiederholung (Z. 228); ein einzelner
Aussetzer im Mobilfunk reicht für die Fehlmeldung, obwohl `rpc()` (Z. 139–152) genau dafür
Backoff-Wiederholungen hätte.

Der Speicherfehler-Pfad ist vorbildlich differenziert (`"ok" | "quota" | "fehler"`, `app.js:258–281`) –
dieselbe Sorgfalt fehlt beim Abruf.

**Vorschlag:** `getContent` gibt `{ ok, content, reason }` mit `reason ∈ {"bad-code","offline","server","parse"}`
zurück (HTTP-Status aus `rpcOnce` durchreichen, 401/403 = falscher Code, alles andere = technisch),
und retryt bei transienten Fehlern über `rpc()`. Im Gate drei getrennte Texte anzeigen.

---

### M6 – Prüfung kann doppelt abgegeben werden → TypeError und blockierender Dialog

**Datei/Zeile:** `js/app.js:1499–1508` (`startExamTimer`), `js/app.js:1638–1645` (`confirmSubmitExam`),
`js/app.js:1647–1674` (`submitExam`)

**Was schiefgeht (Szenario):** Bei 00:03 Restzeit tippt der Nutzer auf „Prüfung abgeben“.
`confirmSubmitExam()` öffnet ein `modalChoice` und **wartet**. Der Intervalltimer läuft weiter,
erreicht 0 und ruft `submitExam(true)`; dort wird `EXAM = null` gesetzt (Z. 1671) und auf
`examresult` navigiert. Der Bestätigungsdialog liegt aber weiterhin über der Ergebnisseite.
Tippt der Nutzer jetzt auf „Abgeben“, läuft `submitExam(false)` → `examQuestions()` →
`EXAM.qids` auf `null` → **TypeError**. Der Aufruf kommt direkt aus dem Klick-Handler, also greift
der Schutz in `renderView()` (Z. 1903) *nicht*; die Ausnahme landet nur im globalen
`window.onerror`-Logger (Z. 2265). Der Dialog bleibt hängen, der „Abgeben“-Knopf ist tot.
Analog: `confirmSubmitExam` liest `EXAM.qids.length` (Z. 1639) – auch das kracht, wenn der Timer
zwischen Klick und Öffnen zuschlägt.

**Vorschlag:** In `submitExam()` als erstes `if (!EXAM || EXAM.submitted) return;` prüfen und
`EXAM.submitted = true` **vor** der Auswertung setzen. Beim Auto-Submit offene Dialoge schließen
(`document.querySelectorAll(".modal-overlay").forEach(el => el.remove())`) bzw. das ausstehende
`modalChoice`-Promise mit `null` auflösen.

---

### M7 – History-Einträge zu Quiz/Prüfung/Ergebnis überleben einen Reload, die zugehörigen Objekte nicht

**Datei/Zeile:** `js/app.js:1889–1918` (`renderView`), `js/app.js:1938–1948` (`onPopState`),
`js/app.js:1266–1268`, `js/app.js:1379–1382`, `js/app.js:1542–1545`

**Was schiefgeht (Szenario):** Der Nutzer ist bei Frage 7 von 15. Das Update-Banner erscheint, er
tippt „Neu laden“ (`app.js:2010–2014`) – oder iOS entlädt die PWA und stellt sie wieder her.
Nach dem Neustart macht `boot()` ein `history.replaceState` (Z. 2305), die **vorherigen** Einträge
bleiben im Verlauf. Ein Wisch nach rechts / Zurück liefert `popstate` mit `{view:"quiz"}`.
`onPopState` ruft `renderView("quiz")` → `renderQuiz()` → `SESSION.idx` auf `null` → TypeError.
Aufgefangen wird das nur vom `try/catch` in `renderView`, der Nutzer landet auf
„😕 Ups, da ging etwas schief“. Dasselbe gilt für `"exam"` (`EXAM` ist `null`),
`"result"` (`SESSION.mode` in `renderResult`, Z. 1382) und `"examresult"`
(`EXAM_RESULT` ist `null`, Z. 1680 destrukturiert `null`).

**Vorschlag:** In `renderView()` vor dem Delegieren prüfen und still auf `home` umlenken:
```js
if ((view === "quiz" || view === "result") && !SESSION) view = "home";
if (view === "exam" && !EXAM) view = examInProgress() ? (EXAM = loadExam(), "exam") : "home";
if (view === "examresult" && !EXAM_RESULT) view = "home";
```
Für `"exam"` lässt sich der Zustand sogar aus `loadExam()` wiederherstellen – die Prüfung liegt
persistent in `adt_exam_session_v1`.

---

### M8 – Ungeschützter DOM-Zugriff auf Modulebene kann die gesamte App abschalten

**Datei/Zeile:** `js/app.js:2280`, ergänzend `js/app.js:812–814`

```js
document.getElementById("backBtn").addEventListener("click", goBack);
```

**Was schiefgeht (Szenario):** Der Service Worker bedient `index.html` **network-first**
(`sw.js:114`), `js/app.js` dagegen **stale-while-revalidate** (`sw.js:124`). Nach einem Release, das
`index.html` ändert, ist beim ersten Start eine **neue HTML mit altem JS** (bzw. umgekehrt nach dem
Hintergrund-Refresh) aktiv. Verschwindet oder verändert sich dabei die ID `backBtn`, wirft Z. 2280
einen TypeError – und zwar **vor** `boot()` (Z. 2324). Damit wird `boot()` nie aufgerufen: kein
Rendern, kein Fehlerbildschirm, dauerhaft leere Seite, die auch der `boot().catch(...)` nicht abfängt.
Der Rest der Datei ist konsequent defensiv (`if (bar)`, `if (cb)`, …) – genau diese eine Stelle
nicht.

**Vorschlag:** `const back = document.getElementById("backBtn"); if (back) back.addEventListener(...)`.
`app`/`actionbar` (Z. 812–813) analog absichern und `boot()` in ein `try/catch` auf oberster Ebene
setzen, das im Notfall `document.body.innerHTML` mit einer Minimalmeldung + Reload-Knopf füllt.

---

### M9 – Mehrere Kontraste unter WCAG AA (nachgemessen)

**Datei/Zeile:** `css/styles.css:243` (`.chip`), `:266` (`.opt-note`), `:298–305` (`.btn-primary`,
`.btn-ghost`), `:318–320` (`.pass-badge`), `:482–485` (`.link-danger`), `:249–255` (`.opt`-Rahmen);
Themenfarben aus `data/questions.js:27–37`

Gemessene Verhältnisse (Hellmodus, sRGB, WCAG-2-Formel):

| Element | Vorder-/Hintergrund | Ist | Soll |
|---|---|---|---|
| `.pass-badge.pass` „BESTANDEN“ (15 px fett) | `#34c759` auf `#e5f8ea` | **2,00** | 4,5 |
| `.opt-note` „Richtige Antwort“ (12 px fett) | `#34c759` auf `#ffffff` | **2,22** | 4,5 |
| `.exam-flag.on` (Markierungs-Icon) | `#ffffff` auf `#ff9500` | **2,20** | 3,0 |
| Themen-Chip „Grading …“ | `#d9a441` auf `#faf3e6` | **2,04** | 4,5 |
| Themen-Chip „Therapie & Verlauf“ | `#6aa84f` auf `#ebf3e8` | **2,53** | 4,5 |
| Themen-Chip „ICD-10 & Dignität“ | `#3fa796` auf `#e5f3f1` | **2,57** | 4,5 |
| `.pass-badge.fail` „NICHT BESTANDEN“ | `#ff3b30` auf `#ffe9e7` | **3,05** | 4,5 |
| `.link-danger` „Fortschritt zurücksetzen“ | `#ff3b30` auf `#f2f2f7` | **3,18** | 4,5 |
| `.btn-primary` (Haupt-Aktion, 17 px) | `#ffffff` auf `#007aff` | **4,02** | 4,5 |
| `.btn-ghost` / `.link` | `#007aff` auf `#ffffff` | **4,02** | 4,5 |
| `.opt`-Rahmen (unausgewählte Antwort) | `#d6d6dc` auf `#ffffff` | **1,45** | 3,0 (1.4.11) |

**Konkretes Szenario:** Der Themen-Chip steht auf **jeder** Fragenkarte (`app.js:1336`, `1586`);
bei „Grading, Residual- & Zusatzcodes“ ist die Beschriftung mit 2,04:1 bei 12 px für Nutzer mit
Sehschwäche praktisch nicht lesbar. Ebenso ist das zentrale Prüfungsergebnis „BESTANDEN“ mit 2,00:1
kaum wahrnehmbar. Der Rahmen unausgewählter Antwortoptionen (1,45:1) macht die Klickflächen im
Hellmodus bei Sonnenlicht unsichtbar.

**Vorschlag:** Chip-Text nicht in der Themenfarbe setzen, sondern `var(--text)` auf dem getönten
Hintergrund (Farbe nur über den bereits vorhandenen `.cdot`-Punkt transportieren). Für
`.pass-badge`/`.opt-note` dunklere Textvarianten definieren (`--success-ink: #1c6b32`,
`--danger-ink: #b3261e`). `--primary` im Hellmodus auf `#0064d2` (≈ 5,3:1) absenken.
`--border` auf `#b8b8bf` (≈ 3,0:1) anheben.

---

### M10 – Nach jeder Antwort werden ~700 000 Array-Elemente durchlaufen

**Datei/Zeile:** `js/app.js:543` (Badge `master`), `js/app.js:544` (Badge `allmaster`),
`js/app.js:546–556` (`topicMastered`, `masteredCount`), `js/app.js:557–564` (`checkBadges`),
Aufrufe `js/app.js:773`, `js/app.js:1668`

**Was schiefgeht:** `checkBadges()` läuft nach **jeder** beantworteten Frage. Für jedes noch nicht
erreichte Abzeichen wird `test()` ausgeführt:
- `master`: `Object.keys(TOPICS).some(topicMastered)` – `topicMastered` macht pro Thema ein
  `QUESTIONS.filter(...)`. Bei 111 Themen × 5977 Fragen = **663 447 Durchläufe plus 111
  Zwischenarrays**, im ungünstigsten Fall (kein Thema gemeistert) jedes Mal vollständig.
- `allmaster` und `secure25`: je ein vollständiger `masteredCount()`-Lauf (5977).

Da die überwiegende Mehrheit der Nutzer `master`/`allmaster` **nie** erreicht, greift die
Kurzschluss-Prüfung `!S.badges[b.id]` nie, und die Kosten fallen bei jeder einzelnen Antwort an.
Spürbar als Verzögerung zwischen „Antwort prüfen“ und der Erklärungs-Karte auf älteren iPhones.

`renderStats()` (`js/app.js:1781–1791`) ist noch teurer: pro Thema **zweimal** über den Katalog
(einmal direkt `QUESTIONS.filter`, einmal in `topicStats`) → 111 × 2 × 5977 ≈ **1,33 Mio.**
Durchläufe für einen Bildschirmaufbau. `renderTopics()` (Z. 1244–1253) kostet die Hälfte davon.

**Vorschlag:** Einen Index `questionsByTopic` einmalig nach dem Hydratisieren aufbauen
(`Map<topic, Question[]>`) und in `topicStats`, `topicMastered`, `renderStats`, `renderTopics`,
`buildExamQuestions` und `buildSession("topic")` verwenden. `masteredCount` als inkrementellen
Zähler im Zustand führen oder pro Render einmal berechnen und an `checkBadges` durchreichen.

---

### M11 – Jede beantwortete Frage stößt einen Upload des kompletten Zustands an

**Datei/Zeile:** `js/app.js:163–166` (`saveState` → `scheduleSync`), `js/app.js:376–380`,
`js/sync.js:182–209`

**Was schiefgeht:** `saveState()` plant über `scheduleSync()` 3 s später einen vollen `syncNow()`.
Beim üblichen Lerntempo (eine Antwort alle 10–20 s) heißt das: **pro Antwort ein Pull + ein Push**
des gesamten `S`. Bei 5977 `perQuestion`-Einträgen sind das ~700 kB–1,3 MB JSON je Richtung.
Eine Übungsrunde mit 15 Fragen erzeugt so bis zu ~30 MB Datenverkehr; zusätzlich löst jedes
Wiedereinblenden der App (`visibilitychange`, `app.js:2317`) einen weiteren vollen Abgleich aus.
Auf Mobilfunk ist das teuer, und das kostenlose Supabase-Kontingent ist schnell erschöpft.

**Vorschlag:** Debounce deutlich erhöhen (z. B. 30–60 s) plus erzwungener Sync bei `pagehide`
und beim Ende einer Session/Prüfung. Mittelfristig Delta-Sync: nur geänderte `perQuestion`-IDs
seit dem letzten `adt_sync_last` übertragen.

---

### M12 – Service Worker liefert bei Netzfehlern `index.html` als Antwort auf `config.js`

**Datei/Zeile:** `sw.js:114–122`

```js
const networkFirst = e.request.mode === "navigate"
  || url.pathname.endsWith("/config.js") || url.pathname.endsWith("/questions.js");
...
.catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
```

**Was schiefgeht (Szenario):** Der tolerante Precache (`sw.js:34–36`) überspringt eine Datei, wenn
`c.add()` fehlschlägt (bei der Erstinstallation über eine wacklige Verbindung durchaus möglich).
Ist `config.js` nicht im Cache und das Gerät offline, greift der Fallback und liefert
**`index.html` mit `Content-Type: text/html`** als Antwort auf `<script src="./config.js">`.
Der Browser versucht HTML als JavaScript zu parsen → Syntaxfehler → `window.ADT_CONFIG` bleibt
`undefined` → `contentGateActive()` gibt `false` zurück → der Gate wird übersprungen und
`ADTSync.isConfigured()` ist `false`: kein Sync, keine Inhaltsaktualisierung, keine Erinnerungen.
Der Nutzer sieht eine scheinbar funktionierende App, in der still alle Serverfunktionen fehlen.

**Vorschlag:** Den `index.html`-Fallback auf `e.request.mode === "navigate"` beschränken; für
Skript-Anfragen ohne Cache-Treffer die Netzwerkantwort/den Fehler durchreichen. Zusätzlich in
`install` protokollieren bzw. das Precaching für kritische Dateien (`index.html`, `config.js`,
`js/app.js`, `css/styles.css`) doch als All-or-nothing behandeln und nur Icons tolerant laden.

---

### M13 – Bis zu 7 Sekunden Startverzögerung bei schlechtem Netz, obwohl alles im Cache liegt

**Datei/Zeile:** `sw.js:114–122` (`fetchWithTimeout(e.request, 3500)`)

**Was schiefgeht:** Sowohl die Navigation (`index.html`) als auch `data/questions.js` sind
network-first mit 3500 ms Timeout. Bei „lie-fi“ (Verbindung vorhanden, aber unbrauchbar langsam)
wartet zuerst die Navigation 3,5 s und danach das Skript nochmals 3,5 s, bevor jeweils auf den
Cache zurückgefallen wird – also **bis zu 7 s weißer Bildschirm**, obwohl beide Dateien vollständig
im Cache liegen. Bei `contentGated: true` ist `data/questions.js` zudem nur noch die
Beispiel-Attrappe; der Netzwerkvorrang dafür bringt gar keinen Nutzen.

**Vorschlag:** Timeout auf ~1200 ms senken, `data/questions.js` aus der network-first-Liste
entfernen (stale-while-revalidate genügt), und für die Navigation zuerst den Cache anzeigen und im
Hintergrund revalidieren (die Update-Erkennung über den SW existiert bereits).

---

### M14 – Prüfungs-Blueprint ist bei 111 Themen wirkungslos

**Datei/Zeile:** `js/app.js:1455–1468` (`buildExamQuestions`)

**Was schiefgeht:** Die Quote lautet `Math.max(1, Math.round(target * n_t / total))`.
Mit `target = 30` und `total = 5977` ergibt `Math.round(30 · n_t / 5977)` für jedes Thema mit
weniger als ~100 Fragen **0**, wird durch `Math.max(1, …)` auf **1** angehoben. Bei 111 Themen
liefert die Schleife also ~111 Fragen, aus denen anschließend `shuffle(picked).slice(0, 30)`
**rein zufällig** 30 zieht. Ergebnis: Ein Thema mit 500 Fragen hat in der Prüfung exakt dieselbe
Auswahlwahrscheinlichkeit wie ein Thema mit 5 Fragen – die als „proportional zur Verfügbarkeit“
dokumentierte Gewichtung findet nicht statt, und der Nutzer erhält bei jeder Simulation ein
verzerrtes Themenprofil (`renderExamResult`, Z. 1687–1692).

**Vorschlag:** Kontingente über das „größte Reste“-Verfahren (Hare-Niemeyer) auf genau `target`
verteilen, statt jedem Thema mindestens 1 zuzusichern:
```js
const raw = topics.map(t => ({ t, exact: target * byTopic[t].length / total }));
// Ganzzahlanteile vergeben, Rest nach größtem Bruchteil auffüllen
```

---

### M15 – `100vh` und doppelter Safe-Area-Abstand auf dem iPhone

**Datei/Zeile:** `css/styles.css:90` (`min-height: 100vh`), `:91` (Body-Padding),
`:100` (Appbar-Padding), `:539`

**Was schiefgeht:**
1. `min-height: 100vh` bezieht sich in mobilem Safari auf den **großen** Viewport (ohne
   Browserleisten). Im Browser-Tab (nicht als Home-Bildschirm-App) ist die Seite dadurch immer
   ~110 px höher als sichtbar. Folge: Es ist auf jedem Bildschirm eine Restscroll-Bewegung möglich,
   die den Scroll-Listener (`app.js:2273–2278`) auslöst und den Appbar-Titel unmotiviert einblendet;
   außerdem verschwindet die fixierte `.actionbar` mit dem Knopf „Antwort prüfen“ teilweise hinter
   der unteren Safari-Leiste, weil `bottom: 0` sich auf denselben großen Viewport bezieht.
2. `body` bekommt `padding-top: var(--safe-top)` **und** `.appbar` zusätzlich
   `padding: calc(6px + var(--safe-top)) …`. Der Notch-Abstand wird damit **zweimal** angewendet:
   auf einem iPhone 14 Pro (safe-area-inset-top = 59 px) entstehen ~118 px Leerraum über dem
   Streak-Pill statt ~65 px. Da die Appbar `position: sticky; top: 0` ist, klebt sie beim Scrollen
   trotzdem korrekt – der Doppelabstand ist nur im Ausgangszustand sichtbar, dort aber deutlich.

**Vorschlag:** `min-height: 100dvh` (mit `100vh` als Fallback davor). Das `padding-top` am `body`
auf `0` setzen und den Safe-Area-Abstand ausschließlich in `.appbar` belassen.

---

### M16 – Prüfungs-Übersicht ist kein Dialog: keine Escape-Taste, kein Fokus-Management

**Datei/Zeile:** `js/app.js:1620–1636` (`showExamOverview`)

**Was schiefgeht:** Anders als `modalChoice` (Z. 2021–2057, dort vorbildlich mit `role="dialog"`,
`aria-modal`, Fokusfalle, Escape und Fokus-Rückgabe) erzeugt `showExamOverview` nur ein
`<div class="modal-card">` **ohne** Rolle, ohne `aria-modal`, ohne Escape-Behandlung und ohne
Fokusverlagerung. Konkret: Ein Nutzer mit Tastatur (die echte Prüfung findet am Laptop statt,
siehe Kommentar Z. 1953) öffnet „Übersicht“, der Fokus bleibt auf dem Knopf **hinter** dem Overlay,
Tab wandert durch die verdeckte Fragenkarte, Escape schließt nichts. Für VoiceOver ist der
Hintergrund weiterhin vorlesbar. Zusätzlich blockiert der globale Tastatur-Handler
(Z. 1980: `if (document.querySelector(".modal-overlay")) return;`) hier zwar die Ziffern-Auswahl,
bietet aber keinen Ersatz.

**Vorschlag:** `showExamOverview` auf denselben Baustein wie `modalChoice` heben – oder mindestens
`role="dialog" aria-modal="true" aria-labelledby`, initialen Fokus auf die erste Zelle,
Escape → `close()` und Fokus-Rückgabe auf `#examOverview` ergänzen.

---

### M17 – Kein Ladezustand, solange der 7,4-MB-Katalog aus IndexedDB deserialisiert wird

**Datei/Zeile:** `js/app.js:2282–2291`, `index.html:28`

**Was schiefgeht:** `<main id="app">` ist bis zum Abschluss von `await hydrateContent()` leer.
Das Auslesen eines ~7,4-MB-Objekts aus IndexedDB inklusive Structured-Clone-Deserialisierung von
5977 Objekten dauert auf einem älteren iPhone durchaus 1–3 s. In dieser Zeit sieht der Nutzer eine
weiße Seite mit leerer Kopfleiste und kann nicht unterscheiden, ob die App gerade lädt oder
abgestürzt ist (vgl. H2, wo dieser Zustand dauerhaft wird).

**Vorschlag:** Vor dem `await` eine Skelett-/Ladeanzeige in `#app` schreiben und sie nach dem ersten
`renderView()` ersetzen.

---

## NIEDRIG

### N1 – Eingabefeld für den Sync-Code ohne zugängliche Beschriftung
**`js/app.js:1209–1211`** – `<input id="codeInput" …>` hat weder `<label for>` noch `aria-label`,
nur ein `placeholder`. VoiceOver kündigt „Textfeld“ ohne Zweck an; sobald der Nutzer tippt,
verschwindet der Platzhalter und damit die einzige Beschriftung.
**Fix:** `aria-label="Sync-Code vom anderen Gerät"` ergänzen (bei `#gateCode`, Z. 2079, und
`#numField`, Z. 1306, ist es korrekt gelöst).

### N2 – `mergeStates` verliert `masteredOnce` → Meisterungs-Bonus kann mehrfach anfallen
**`js/sync.js:97`** – `pq[id] = { seen, correct, wrong, lastResult, box, due };` führt `masteredOnce`
nicht mit. `sanitizeState` rekonstruiert es anschließend nur aus `box >= 3` (`app.js:133`).
Szenario: Frage erreicht Box 3 (+15 XP, `masteredOnce = true`), wird später falsch beantwortet
(Box 0). Nach dem nächsten Sync ist `masteredOnce` weg; erreicht die Frage erneut Box 3, gibt es
die 15 XP ein zweites Mal.
**Fix:** `masteredOnce: !!(pa.masteredOnce || pb.masteredOnce)` in den Merge aufnehmen.

### N3 – Tages-Serie bricht bei Zeitzonen-/Uhrsprung zusammen
**`js/app.js:511–522`** – `daysBetween` kann negativ werden, wenn `lastActiveDay` in der Zukunft
liegt. `mergeStates` (`sync.js:73–74`) übernimmt das **späteste** `lastActiveDay` beider Geräte.
Szenario: Nutzer lernt in Tokio (UTC+9) am 28.07., fliegt nach Berlin und lernt dort noch am 27.07.
lokaler Zeit. `gap = -1` → weder 1 noch 2 → `S.streak = 1`. Die 40-Tage-Serie ist auf 1 zurückgesetzt
(`bestStreak` bleibt erhalten; der nächste Sync stellt `streak` über `Math.max` wieder her – auf
einem Gerät ohne Sync nicht).
**Fix:** `if (gap < 0) return;` (kein Rückschritt) bzw. `gap <= 0` als „schon heute aktiv“ behandeln.

### N4 – Startseite verspricht mehr fällige Wiederholungen, als die Runde enthält
**`js/app.js:906` + `js/app.js:662–667`** – `renderHome` zeigt `dueQuestions().length`, z. B.
„1 843 Fragen heute fällig“. `buildSession("due")` kürzt anschließend auf `getSessionSize()`
(Standard 15). Der Nutzer arbeitet die Runde ab, kehrt zurück und liest weiterhin „1 828 fällig“ –
der Eindruck, nichts geschafft zu haben, ist nach dem Umstieg auf 5977 Fragen dauerhaft.
**Fix:** Auf der Startseite `Math.min(due, sessionSize)` als Rundengröße anzeigen und die
Gesamtzahl separat („davon heute 15 in dieser Runde“).

### N5 – Erste Toast-Meldung wird von VoiceOver nicht vorgelesen
**`js/app.js:1989–1999`** – Das Element mit `role="status" aria-live="polite"` wird erzeugt,
angehängt **und im selben Task** mit Text befüllt. Screenreader werten eine Live-Region erst ab dem
Zeitpunkt aus, ab dem sie im Baum registriert ist; Inhalt, der gleichzeitig eingefügt wird, wird
meist verschluckt. Konkret geht die erste Meldung eines Starts verloren (z. B.
„⚠️ Speicher voll – Fortschritt evtl. nicht gesichert“ aus `persistLocal`, Z. 159 – ausgerechnet
die wichtigste).
**Fix:** Den Toast-Container beim Start einmalig leer anlegen (in `index.html` oder direkt nach
`boot()`) und später nur noch `textContent` setzen.

### N6 – Themenfarben werden ungeprüft in `style`-Attribute geschrieben
**`js/app.js:1249`, `1336`, `1586`, `1691`, `1789`** – `style="background:${t.color}22;color:${t.color}"`
ohne `esc()`/Validierung. `TOPICS` stammt aus der Serverantwort. Ein Tippfehler mit einem
Anführungszeichen im Farbwert bricht aus dem Attribut aus und zerstört die Fragenkarte (bzw.
erlaubt Markup-Injektion, falls der Katalog je aus weniger vertrauenswürdiger Quelle kommt).
Ein fehlendes `color` erzeugt `background:undefined22`.
**Fix:** Farbwerte beim Hydratisieren gegen `/^#[0-9a-f]{3,8}$/i` prüfen und sonst auf
`#8e8e93` zurückfallen.

### N7 – FNV-Hash im Fingerprint verliert die unteren Bits
**`js/app.js:211`** – `h = (h * 16777619) >>> 0` überschreitet für |h| nahe 2³¹ den
Double-Bereich 2⁵³, die Multiplikation rundet. Nachgemessen über 200 000 zufällige Strings:
Bit 0 ist nur in 12,6 %, Bit 1 in 19,1 % der Hashes gesetzt (statt je ~50 %); der effektive
Wertebereich liegt bei ~2³⁰ statt 2³². Praktisch bedeutet das eine gegenüber der Auslegung
mehrfach erhöhte Kollisionswahrscheinlichkeit – bei einem einzelnen Katalog-Fingerprint
weiterhin unkritisch, aber ohne Grund.
**Fix:** `h = Math.imul(h, 16777619) >>> 0`.

### N8 – Manifest-Farben widersprechen der App
**`manifest.webmanifest`** – `background_color: "#0f1320"` (dunkles Marineblau) und
`theme_color: "#4a72e8"` passen zu keinem Zustand der App (`--bg` ist `#f2f2f7` hell bzw. `#000000`
dunkel; `index.html:11–12` setzt `theme-color` auf genau diese Werte). Beim Start der installierten
App blitzt daher ein marineblauer Splash auf, bevor die helle Oberfläche erscheint.
**Fix:** `background_color: "#f2f2f7"`, `theme_color: "#f2f2f7"`.

### N9 – `staleWhileRevalidate` kann `undefined` an `respondWith` übergeben
**`sw.js:98–108`** – Ohne Cache-Treffer **und** mit fehlgeschlagenem Netzwerk liefert
`.catch(() => cached)` `undefined`; `e.respondWith(Promise<undefined>)` lässt die Anfrage mit
einem Netzwerkfehler scheitern. Konkret trifft das `./icons/favicon-32.png`, das **nicht** in
`ASSETS` (`sw.js:14–27`) steht, beim ersten Offline-Start.
**Fix:** `return cached || network.then(r => r || Response.error());` bzw. eine 504-Antwort erzeugen.

### N10 – Prüfungs-Timer ohne Ansage für Screenreader
**`js/app.js:1581`, `1499–1508`** – `#examTimer` wird sekündlich per `textContent` aktualisiert,
hat aber keine Live-Region (korrekt, sonst würde jede Sekunde vorgelesen). Es gibt jedoch **keine**
Ersatzansage: Ein blinder Nutzer erfährt in der Simulation nie, dass nur noch 5 Minuten oder
1 Minute bleiben, und wird von der automatischen Abgabe (`submitExam(true)`, Z. 1506) überrascht.
**Fix:** Bei 10/5/1 Minute Restzeit einen `toast()`-Aufruf (bereits `aria-live`) auslösen.

### N11 – Leere `<h1>` mit `aria-hidden="false"` in Quiz und Prüfung
**`js/app.js:877`, `886–891`** – `BAR_TITLES.quiz` ist `""`; `updateAppbar` setzt für die Ansichten
ohne Large-Title `aria-hidden="false"`. In der Quiz-Ansicht steht damit ein leeres, aber für
Screenreader sichtbares `<h1>` in der Überschriftenliste, während die eigentliche Frage nur ein
`<p class="q-text">` ist – die Überschriftennavigation (VoiceOver-Rotor) führt ins Leere.
**Fix:** Für `quiz` `aria-hidden="true"` setzen bzw. `BAR_TITLES.quiz` auf „Frage“ ändern, und
die Fragestellung als `<h2>` auszeichnen.

### N12 – `checkData()` prüft `question`/`explanation` nicht
**`js/app.js:7–27`** vs. `tests/validate-questions.mjs:40` – Der Node-Validator verlangt eine
Erklärung mit ≥ 10 Zeichen, die Laufzeitprüfung nicht. Ein serverseitig ausgelieferter Datensatz
ohne `explanation` führt zu `esc(undefined)` → in der Erklärungs-Karte steht wörtlich
„undefined“ (`app.js:1319`, `1706`); ohne `question` steht „undefined“ als Fragetext (`app.js:1340`).
**Fix:** Beide Felder in `checkData()` aufnehmen (im Rahmen des Umbaus aus H6 als Filterkriterium).

---

## Geprüft und in Ordnung

**Auswertung / Bewertungslogik**
- `gradeQuestion` für `single`/`multi` (`app.js:617–630`): Mengenvergleich über `Set` mit
  Größenprüfung – „alles oder nichts“ ist zeichengenau korrekt umgesetzt und entspricht der
  dokumentierten Prüfungsregel (kein Teilpunkt). Übung (`Set`) und Prüfung (`Array`) laufen über
  denselben `respList`-Adapter, es gibt keinen zweiten Bewertungspfad.
- Toleranzvergleich numeric: `Math.abs(v - q.answer) <= tol + 1e-9` (`app.js:622`) – das Epsilon
  fängt Gleitkomma-Randfälle wie `0.1 + 0.2` sauber ab; `tolerance` fehlend → 0 ist korrekt.
- Optionsreihenfolge: `optionOrders` speichert die gemischten **Original**-Indizes; Auswahl,
  Bewertung und Review rechnen durchgängig in Original-Indizes (`app.js:670, 1281–1297, 1554–1559`).
  Kein Index-Versatz gefunden.
- `correctAnswerText` und `fmtNum` (`app.js:632–639`) geben deutsche Dezimalkommata und die
  Toleranz korrekt aus.
- Prüfungsergebnis, Themenprofil und Review (`app.js:1676–1744`) rechnen konsistent aus demselben
  `results`-Array.

**Zustand / Migration**
- `freshState()` als echte Tiefkopie und der Neuaufbau von `perQuestion`/`badges` in
  `sanitizeState` verhindern zuverlässig geteilte Referenzen auf `DEFAULT_STATE` (`app.js:95–138`).
- Das Migrationsgerüst (`app.js:58–92`) ist korrekt: Schleife über fehlende Versionen, Fehler pro
  Schritt gekapselt, `schemaVersion` wird gesetzt. `addDaysStr` ist eine hochgezogene
  Funktionsdeklaration und in der v1→v2-Migration verfügbar.
- `clampInt` fängt `NaN`, negative Werte, Strings und `null` ab; der E2E-Test dafür ist vorhanden.
- `mergeStates` (`sync.js:59–116`) ist monoton und verlustarm: Maximum je Feld, Vereinigung der
  IDs und der Badges (frühestes Datum), `bestStreak >= streak`, Gesamtzähler aus `perQuestion`
  abgeleitet, `schemaVersion` mitgeführt. Bis auf `masteredOnce` (N2) vollständig.
- `flushSave` auf `pagehide` **und** `visibilitychange` (`app.js:2269–2270`) ist die richtige
  Absicherung für iOS, wo `setTimeout` beim Backgrounding nicht mehr feuert.

**Datum**
- `todayStr`/`daysBetween`/`addDaysStr` (`app.js:471–484`) arbeiten durchgängig lokal.
  `new Date("YYYY-MM-DDT00:00:00")` (ohne `Z`) wird von Safari als **Ortszeit** geparst – die
  klassische UTC-Falle ist vermieden. Sommer-/Winterzeitwechsel (23 h/25 h) fängt das
  `Math.round` korrekt ab.

**Fehlerbehandlung / Robustheit**
- `renderView` kapselt jeden Renderer in `try/catch` und zeigt statt eines weißen Bildschirms eine
  Wiederherstellungsansicht mit Weg zurück (`app.js:1889–1918`).
- Alle localStorage-Zugriffe (Ziel, Theme, Schriftgröße, Haptik, Prüfungssitzung, Historie,
  Sync-Code) sind einzeln in `try/catch` gefasst; ein gesperrter Speicher legt nichts lahm.
- `storeUnlockedContent` unterscheidet vorbildlich `"ok" | "quota" | "fehler"` und der Gate zeigt
  drei getrennte Texte, statt einen Speicherfehler als „falscher Code“ auszugeben
  (`app.js:258–281`, `2099–2110`).
- `rpc()` (`sync.js:139–152`) wiederholt nur bei transienten Fehlern (Netz/5xx/429) mit Backoff und
  bricht bei 4xx sofort ab – korrekt unterschieden.
- Der Authorization-Header wird nur für klassische JWT-Keys gesetzt (`sync.js:126`); für die neuen
  `sb_publishable_…`-Schlüssel wäre er ein 401. Passt zu `config.js`.
- `loadExam()` (`app.js:1442–1451`) prüft Ablauf, `submitted`-Flag **und** ob alle Fragen-IDs im
  aktuellen Katalog existieren – eine Prüfung mit veralteten IDs kann nicht wiederhergestellt werden.

**Service Worker**
- `install` cached toleranter Weise Datei für Datei statt `addAll` – eine fehlende Datei bricht
  nicht die gesamte Offline-Fähigkeit (`sw.js:29–37`).
- Kein automatisches `skipWaiting`; das Update wartet auf die Bestätigung des Nutzers, und
  `controllerchange` lädt nur nach aktiver Zustimmung neu (`sw.js:39–41`, `app.js:2002–2015, 2350–2353`).
- Fremde Ursprünge (Supabase) werden nie abgefangen oder gecacht (`sw.js:112`).
- Revalidierungen laufen mit `cache: "no-cache"` und umgehen damit den HTTP-Cache – ein dauerhaft
  veralteter Cache durch `max-age` ist ausgeschlossen (`sw.js:89, 101`).
- `activate` löscht alle fremden Cache-Generationen und ruft `clients.claim()` (`sw.js:71–75`).
- Push- und `notificationclick`-Behandlung sind vollständig und fehlertolerant.

**Barrierefreiheit (positiv)**
- `modalChoice` (`app.js:2021–2057`) ist ein sauber gebautes Dialog-Muster: `role="dialog"`,
  `aria-modal`, eindeutige `aria-labelledby`-ID pro Instanz, funktionierende Tab-Fokusfalle,
  Escape → `null`, Fokus-Rückgabe an das vorherige Element, Klick auf den Hintergrund schließt.
- Roving Tabindex plus Pfeil-/Home-/End-Navigation im Optionsfeld nach WAI-ARIA-Muster, geteilt
  zwischen Übung und Prüfung (`app.js:704–726`).
- In-place-Aktualisierung der Optionen (`applyPick`, `examApplyPick`) statt Full-Re-Render – Fokus
  und VoiceOver-Position bleiben erhalten; das Zahlenfeld verliert beim Tippen nicht den Fokus.
- Ergebnis-Karte bekommt nach dem Prüfen den Fokus, damit das Verdikt vorgelesen wird (`app.js:1363`).
- `:focus-visible` mit 2 px Outline global vorhanden; `prefers-reduced-motion` wird respektiert
  (CSS `:467–479`) und zusätzlich in JS abgefragt (`reduceMotion`, `app.js:339`).
- Tap-Ziele durchgängig ≥ 44 px (`min-height` auf `.opt`, `.mode-btn`, `.btn-primary`,
  `.link-danger`, `.exam-flag`).
- `esc()` wird für alle Katalog-Texte (Frage, Optionen, Erklärung, Themennamen) konsequent
  angewandt – bis auf die Farbwerte (N6) ist keine ungeprüfte Interpolation von Inhalten gefunden.

**Sonstiges**
- `shuffle` ist ein korrekter Fisher-Yates auf einer Kopie (`app.js:597–601`).
- `generateCode` nutzt `crypto.getRandomValues` und ein verwechslungsarmes Alphabet (`sync.js:37–47`).
- Der Zugangscode wird nie clientseitig geprüft; die Autorisierung liegt vollständig serverseitig
  in `get_content` – der öffentliche Build enthält keine geschützten Fragen.
- Der Tageszähler (`adt_today`) ist bewusst nicht Teil des Sync-Zustands; das hält den
  Max-Merge korrekt (Zähler dürfen nicht maximiert werden).

---

## Nachtrag: Testsuite

**T1 – `bash tests/run.sh` schlägt mit der ausgelieferten Konfiguration sofort fehl (Schwere: mittel)**

**Datei/Zeile:** `tests/e2e-smoke.mjs:32` (und ~20 weitere `waitForSelector('.level-card')`),
`tests/sw-cache.mjs:29`, in Verbindung mit `config.js:30` (`contentGated: true`)

**Verifiziert:** Der Testlauf bricht reproduzierbar ab:
```
page.waitForSelector: Timeout 30000ms exceeded.
  - waiting for locator('.level-card') to be visible
    at tests/e2e-smoke.mjs:32
```
Ursache: Mit `contentGated: true` und einem frischen Browser-Kontext (keine freigeschalteten
Inhalte) zeigt `boot()` korrekterweise `showContentGate()`; `.level-card` entsteht nie. Betroffen
sind der E2E-Smoke-Test **und** der Service-Worker-/Offline-Test. Die CI (`.github/workflows/ci.yml`)
fährt bewusst nur Syntax-, Katalog- und Sync-Unit-Tests und fällt deshalb **nicht** auf – das in
`tests/README.md`/`workbook.md` als Freigabekriterium beschriebene „grün = auslieferbar“ ist damit
faktisch nicht mehr prüfbar, und genau die Startreihenfolge- und Offline-Pfade aus H1/H2/M12/M13
sind ungetestet.

**Vorschlag:** In `tests/e2e-smoke.mjs` und `tests/sw-cache.mjs` in `page()` per `addInitScript`
den entsperrten Zustand herstellen (Demo-Katalog in IndexedDB + `adt_content_idb="1"`) oder
`window.ADT_CONFIG.contentGated = false` überschreiben, und den Gate-Test (Abschnitt 25) gezielt
mit aktivem Gate laufen lassen. Zusätzlich Regressionstests ergänzen für:
(a) `adt_content_idb="1"` + kaputte/leere IndexedDB → Fortschritt darf **nicht** verschwinden (H1),
(b) Katalogwechsel mit umbenannter ID → `perQuestion`-Eintrag bleibt erhalten (H3),
(c) leeres Zahlenfeld → „Antwort prüfen“ bleibt deaktiviert (H5).
