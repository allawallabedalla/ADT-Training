# Fragen-Backlog

> Arbeitsliste der in der App als **fragwürdig** gemeldeten Fragen.
> Aktualisieren: `node tools/reports-to-backlog.mjs <export.md>`
> (Export kommt aus der App: Einstellungen → Gemeldete Fragen → „Als Datei").
> GitHub-Issues (privat, `allawallabedalla/Secret`) sind die führende Quelle je Frage –
> hier steht zusätzlich die Übersicht samt Einordnung.
> Hinweis: Die Beobachtungs-Abschnitte sind von Hand geschrieben; `reports-to-backlog.mjs`
> überträgt nur die Kästchen-Einträge – Prosa vor „## Offen" nach einem Lauf wieder einsetzen.

Zuletzt aktualisiert: 2026-08-18 · offen: 0 · erledigt: 23

### Beobachtung: gehäuft „ohne Abbildung/Tabelle nicht lösbar"

Alle vier bisherigen Meldungen (06.08., 07:05–07:07 Uhr, App 0.36.0) laufen auf **dasselbe
Muster** hinaus: Die Frage verweist auf eine Tabelle/Abbildung aus der Kursfolie
(„Übersichtstabelle", „Häufigkeitstabelle", „Dokumentationsbeispiel"), die in der App **nicht
angezeigt wird** – ohne die Vorlage ist die richtige Antwort nicht herleitbar, nur auswendig
wissbar. Die Fragen selbst sind fachlich korrekt (Lösung + Quellenangabe stimmen), das Problem
ist die fehlende Selbstständigkeit der Frage.

Die Pipeline hat mit `selfcontained.py` / `selfcontained_check.py` bereits eine Prüfung genau
dafür – diese vier sind offenbar trotzdem durchgerutscht (oder als Bild vorgesehen, das Bild
aber nicht mit ausgeliefert). Lohnt sich, **einmal gebündelt** anzugehen statt einzeln:
1. Die vier unten gezielt fixen (Text erweitern **oder** Abbildung als `image` ergänzen –
   die App unterstützt das bereits, siehe `qImageHtml` in `js/app.js`).
   ⚠ Seit 13.08. eingeschränkt durch **Regel 1** (Entscheidung Nico, s. u.): Ein Bild ist nur
   dann der Fix, wenn die Antwort daraus erst erschlossen werden muss. Steht die Lösung in der
   Abbildung ablesbar, wird die Frage gestrichen oder umformuliert – siehe Nachträge unten.
2. Stichprobenartig querchecken, ob `selfcontained_check.py` zuletzt tatsächlich gegen den
   ausgelieferten Stand lief (nicht nur gegen die Rohgenerierung).

### Beobachtung 2 (12.08.): „Kodes muss ich nicht auswendig können" — neue Kategorie E

13 Meldungen am 12.08. (15:05–15:20 Uhr, App 0.36.0, Fragen-Stand 07.08.2026), **alle aus dem
gyn-Skript**. Elf davon tragen dieselbe Notiz-Variante („Muss die Codes nicht auswendig können",
„Keine genauen histocodes", „Muss ich nicht können"): die Frage verlangt das **Auswendiglernen
eines Nachschlage-Schlüssels** – OPS-Bereichsnummern, Zielgebiet-Schlüssel der Strahlentherapie,
ICD-O-3-Morphologiekodes aus der WHO-5th-Liste. Zwei weitere (#18, #19) sind Nachläufer der schon
bekannten **Kategorie A** (Beschriftungen einer Abbildung/Anatomie-Nomenklatur).

Fachlich sind die Fragen im Wesentlichen sauber: Zielgebiete-Tabelle (Folie 90/S.133) und
NEC-Kodeliste (Folie 31/S.104) wurden am Folienbild nachgeprüft, **alle Lösungen stimmen**.
Genau ein echter Fehler kam dabei heraus (`gyn-b7-105`, siehe unten). Das Problem ist also
Relevanz und Zuschnitt, nicht Richtigkeit.

Drei systematische Punkte, die mehr wert sind als die 13 Einzelfälle:

1. **Der Melde-Stichprobeneffekt.** Die gemeldeten Fragen sind nur ein Ausschnitt ihres Clusters:
   aus der Zielgebiete-Tabelle (Folie 90) stammen **8 Fragen** (`gyn-b9-121`…`gyn-b9-128`),
   gemeldet sind 4. Aus der NEC-Liste (Folie 31) stammen **5** (`gyn-b7-104`…`gyn-b7-108`),
   gemeldet 2. Aus der OPS-Folie 87 stammen **9**, gemeldet 1. Einzeln fixen heißt, dieselbe
   Meldung in zwei Wochen wieder zu bekommen → **clusterweise** entscheiden.
2. **Größenordnung im Gesamtkatalog.** Eine Heuristik über `material/content.json`
   (Frage fragt nach „Kode/Schlüssel/Nummer" **oder** alle richtigen Antworten sind Kodes) findet
   **281 von 5.951 Fragen (4,7 %)**: gyn 85 · strahl 37 · hirn 33 · brust 32 · icdo 26 ·
   klassqual 23 · darm 11 · lunge2 10 · übrige ≤ 8. Das ist die realistische Obergrenze der
   Kategorie E – nicht alles davon ist irrelevant (ICD-10-Lokalisation und ICD-O-Topographie
   gehören zum Handwerk), aber der Bestand ist groß genug für eine eigene Runde.
3. **Der Detektor kennt die Kategorie nicht.** `pipeline/relevanz.py` erkennt nur A–D; für E
   gibt es kein Muster, deshalb war keine der 13 Fragen in den 144 Kandidaten der letzten Runde.
   Bei Kategorie A ist die Lücke feiner: das Muster sucht „beschriftet/Abbildung/zeigt die
   Übersicht", die beiden Nachläufer sagen aber „**nennt das Kursskript**" – Formulierung, die
   die Selfcontained-Runde selbst eingesetzt hat. Vorschlag: `relevanz.py` um E ergänzen
   (Fragestamm „Welchen Kode/Schlüssel …" + Antwortoptionen, die reine Kodes sind) und A um
   „nennt das Kursskript/die Folie" erweitern.

### Beobachtung 3 (ERLEDIGT am 17.08.): der ausgelieferte Katalog war nicht der aus `main`

Das ist der wichtigere Fund der Auswertung – er betrifft jede künftige Korrektur.

Die Meldungen tragen den Datenstand der App: **`Fragen-Stand 07.08.2026 · 1ef4a7`**. Dieses Label
ist laut `contentVersionLabel()` (`js/app.js`) die `VERSION` aus `content.json`, also
`<Build-Datum>-<Inhalts-Hash>`. Im Secret-Repo steht auf `main` aber
**`VERSION = 2026-08-05-e2c688ad`**. Anderer Hash = **anderer Inhalt**: der ausgelieferte Katalog
wurde am 07.08. gebaut und hochgeladen, ohne dass dieser Build je im Repo gelandet ist.

Der Textvergleich der 14 gemeldeten Fragen bestätigt das in beide Richtungen:

| Frage | in der App | in `main` |
|---|---|---|
| `gyn-b1-005` | „Welche Epithelarten werden unterschieden?" | „… nennt das Kursskript in der Übersicht ‚Arten von Epithel'?" (Selfcontained-Runde, Grund `kontext`) |
| `strahl-b6-043` | „… Übersichtstabelle **zum oBDS-Feld 14.12** …" | „… Übersichtstabelle …" (Feldverweis entfernt) |

Die übrigen 12 stimmen überein. Einmal ist die App älter als `main`, einmal enthält sie einen
Zusatz, den `main` nicht (mehr) hat – der Upload lässt sich also aus keinem Repo-Stand
reproduzieren. Praktische Folgen:

- Man korrigiert sonst gegen einen Stand, den niemand sieht (und die 26 Löschungen/83
  Umformulierungen der Relevanz-Runde sind womöglich gar nicht live – was erklären würde,
  warum genau diese Fragetypen erneut gemeldet werden).
- Vor der nächsten Korrekturrunde: `python3 pipeline/build_content.py` → `build_sql_chunked.py`
  → Upload nach `material/relevanz/UPLOAD.md`, und **die erzeugte `VERSION` committen**. Danach
  muss das Label in der App exakt der `VERSION` in `main` entsprechen; erst dann sind Meldungen
  eindeutig einer Katalogfassung zuzuordnen.

**Nachtrag 18.08. — die Lücke ist zu.** Die fünf Meldungen vom 17.08. tragen
`Fragen-Stand 13.08.2026 · f191e8`, und das ist exakt die `VERSION 2026-08-13-f191e8a4` aus
`main`. Der Upload wurde also zwischen dem 13. und dem 17.08. gefahren; alle fünf gemeldeten
Fragen ließen sich 1:1 im Repo-Stand wiederfinden. Damit sind Meldungen ab sofort eindeutig
einer Katalogfassung zuzuordnen — und die Meldungen vom 17.08. sind **kein Nachhall eines nie
ausgelieferten Fixes**, sondern echtes neues Feedback auf den bereinigten Katalog.
Die Regel bleibt: nach jeder Runde erst hochladen, dann Meldungen auswerten.

### Entscheidung Nico (13.08.) — gilt ab sofort für alle Runden

Drei Rückfragen zu den Meldungen, drei Festlegungen:

1. **Eine Abbildung ist nur dann der Fix, wenn sie Eingangsdaten liefert — nicht die Antwort.**
   Zu #16: „Das Bild enthält auch gleich die fertige Antwort, deshalb unsinnig, es als Hinweis zu
   behalten." Damit fällt die Standardempfehlung der ersten Runde („Tabelle als `image`
   ergänzen") für alle Fragen, deren Lösung in der Tabelle **ablesbar** ist – dort wird aus der
   Frage sonst eine Suchübung. Bild ergänzen bleibt richtig, wo die Abbildung Material zum
   **Rechnen/Schließen** ist und die Antwort erst daraus entsteht (Fallbeschreibung, Befund,
   Diagramm). Die vier Einträge vom 06.08. sind unten entsprechend nachgezogen.
2. **Alle reinen Kode-Abfragen raus** — auch ICD-10-Lokalisation und ICD-O-3-Topographie.
   Damit sind meine „keep"-Empfehlungen zu `gyn-b1-001` und `gyn-b7-023` hinfällig (unten
   korrigiert), und die Runde E betrifft die volle Größenordnung: **~281 Fragen** über alle
   Skripte, davon ~26 im `icdo`-Skript. Maßstab bleibt: fällt nur, was **allein den Kode**
   abfragt; eine Frage, deren Antwort ein Sachverhalt ist und die einen Kode nur nennt, bleibt.
3. **Von der Anatomie fallen nur Abbildungs- und Nomenklaturfragen** (lateinische Bezeichnungen,
   Zuordnung zu Bildbeschriftungen). Anatomie mit Kodier-Bezug bleibt – das Kapitel „Grundlagen &
   Anatomie" wird also nicht pauschal geleert.

**Empfehlung für die Umsetzung** (im Secret-Repo, nicht hier): eine Relevanz-Runde „E" analog zur
letzten – `keep` / `rewrite` (ID behalten!) / `delete` je Frage, aber **je Folien-Cluster
entschieden**, nicht je gemeldeter Frage. Aus jeder Kode-Tabelle bleibt die eine Frage, die das
Prinzip prüft (z. B. `gyn-b9-128`: „(r, l)" = Seitenangabe Pflicht), die Schlüssel-Drills fallen.
Die ID-Invariante aus `RESUME.md` gilt unverändert.

### Umsetzung (13.08.): Runde E ist gefahren

Alles unten steht im Secret-Repo auf `claude/gabs-neue-issues-3x2js2`
(Commits `3f5fea1` + `fa9bff5`), Bilanz in `material/relevanz/BILANZ.md`:

- `pipeline/relevanz.py` kennt jetzt **Kategorie E** und die erweiterte **Kategorie A**,
  dazu `--work DIR` und `--nur A,B,C,D,E` für getrennte Runden.
- **296 Kandidaten** geprüft → **51 `keep` · 7 `rewrite` · 244 `delete`**.
- Katalog **5.951 → 5.707 Fragen**, Version `2026-08-13-f191e8a4`.
  ID-Invariante maschinell geprüft: 0 neue IDs, 7 Fragen behalten ihre ID und ihren Fortschritt.
- Trennlinie: gefallen ist, wo ein **Klassifikationskode selbst die Antwort** ist. Geblieben
  sind Regelanwendung (Kodierregeln, Kodierbeispiele, Befundlesen), **oBDS-Feldschlüssel**
  (`T` = trifft nicht zu, `R` = Revision, `SZ` = Stammzelltransplantation) und Sachfragen.
- Kein Thema ist leer geworden; am stärksten betroffen `gyn_icdo_morphologie` (98 → 38).

**Offen bleibt nur der Upload** (Beobachtung 3): der neue Stand liegt im Repo, aber noch nicht
in Supabase. `python3 pipeline/build_sql_chunked.py --keep-code` → 15 Dateien nach
`material/supabase/`, dann `material/relevanz/UPLOAD.md` abarbeiten (Zugangscode bleibt gültig,
Geräte müssen sich nicht neu anmelden). Erst danach zeigt die App `Stand 13.08.2026 · f191e8`.

### Beobachtung 4 (17.08.): „Beispiel, nicht pauschal" — neue Kategorie F

Fünf Meldungen am 17.08. (18:59–19:34 Uhr, App 0.37.0, **Fragen-Stand 13.08.2026 · f191e8**).
Vier davon sind derselbe, bislang unbekannte Typ: **die Antwort ist eine aus einer zitierten
Studie oder einer Abbildung abgelesene Zahl**.

| Issue | Frage-ID | Antwort ist … | Notiz |
|---|---|---|---|
| #28 | `brust-b4-010` | 49 % (Balken „Total ET" einer Kohortenauswertung) | „Beispiel, nicht pauschal" |
| #25 | `strahl-b4-035` | p = 0,04 (Kaplan-Meier-Kurve) | „Beispiel, nicht pausxhal" |
| #24 | `patho1-b2-036` | 133/261 Ereignisse, p, HR 0,48 (Trastuzumab-Studie) | „Nicht nachvollziehbar" |
| #27 | `gyn-b4-006` | n = 228/219/690 aus einer Kurvenlegende | „Abbildung nicht sinnvoll" |

Die fünfte (#26, `hautk2-b1-005`) ist ein **Nachläufer der Kategorie E**: Zuordnung
Melanom → ICD-10-/Morphologiekode.

Fachlich sind alle fünf korrekt — Frage, Lösung und Erklärung stimmen gegen die hinterlegte
Quelle. Es geht wieder um **Relevanz und Zuschnitt, nicht um Richtigkeit**. Bei #27 und #24
kommt der Typ „finde die falsche Zahl unter lauter richtigen Zahlen" hinzu, der reines
Zahlengedächtnis ohne Regelbezug prüft.

Drei systematische Punkte:

1. **Der Detektor war für alle fünf blind.** `pipeline/relevanz.py` klassifizierte
   *keine einzige* der Meldungen. Zwei Lücken: für F gab es kein Muster, und `E_TOK` verlangte
   den Kode am **Optionsanfang** — Zuordnungsfragen tragen ihn mitten im Text („Malignes
   Melanom o.n.A. – 8720/3"). Ohne beide Reparaturen hätte die nächste Runde sie wieder verfehlt.
2. **Der Stichproben-Effekt, zum dritten Mal.** Jede gemeldete Frage hat nahezu identische
   Zwillinge auf derselben Folie, die *nicht* gemeldet wurden: `gyn-b4-005` fragt dieselbe
   Kurvenlegende als numeric ab (n für FIGO Ib), `patho1-b2-035` fragt die Hazard Ratio 0,48
   derselben Studie einzeln ab, auf `brust` S.49 stehen zwölf Fragen, von denen sechs
   Kohortenzahlen abfragen.
3. **Größenordnung.** Der erweiterte Detektor findet **94 F-Kandidaten (1,6 %)** —
   `gyn` 30 · `brust` 23 · `strahl` 11 — plus 92 E-Nachläufer, von denen der Großteil
   allerdings legitime Kodierregeln sind (M.-Paget-Ausnahmeregel, Bedeutung der Kode-Endungen).
   Größter unbemerkter Block: die Studien-Steckbriefe in `hautk1` (ORR/OS/HR je Zulassungsstudie).

**Nebenbefund zu #28:** `brust-b4-010` ist zusätzlich **nicht selbsttragend** — „Welchen
Gesamtanteil (Total) hatte die endokrine Therapie (ET) allein?" nennt weder Kohorte noch
Auswertung. Ein Kategorie-A-Defekt, der `selfcontained_check.py` entgangen ist.

### Umsetzung (18.08.): Runde F ist gefahren

Alles im Secret-Repo auf `claude/neue-offene-issues-fcsm2x` (Commit `247cc70`),
Bilanz in `material/relevanzF/BILANZ.md`:

- `pipeline/relevanz.py` kennt jetzt **Kategorie F** (`F_ASK` × `F_CTX` × „Antwort ist im Kern
  eine nackte Zahl", abzüglich `F_GRENZE`) und erkennt Kategorie **E** auch, wenn der Kode
  *innerhalb* der Option steht. Neu außerdem `--neu-only` und das Feld `frueher` je Kandidat,
  damit frühere Entscheidungen nicht neu aufgerollt werden.
- **186 Kandidaten** geprüft (94 F, 92 E; 33 davon in Runde A–E schon entschieden und unberührt
  gelassen) → **49 `keep` · 104 `delete`**, entschieden **je Folien-Cluster**.
- Katalog **5.707 → 5.603 Fragen**, Version `2026-08-18-f8d815af`.
  ID-Invariante maschinell geprüft: 0 neue IDs, 0 inhaltliche Änderungen an den gebliebenen Fragen.
- **Trennlinie:** gefallen ist, wo die Zahl aus einer Studie oder Abbildung *abgelesen* wird.
  Geblieben ist, wo sie eine **Klassifikationsgrenze** ist (T2 > 2 cm, Grading-Score,
  FIGO-Definition), eine **biologische oder epidemiologische Regelmäßigkeit** beschreibt
  (~86 % der Mammakarzinome HR+, ~80 % duktal, ~20 % BRCA1/2 beim Ovarialkarzinom,
  Krampfanfall als häufigstes Erstsymptom bei ZNS-Tumoren) oder **berechnet** statt abgelesen
  werden muss (Odds-Ratio-Rechenbeispiel `patho2-b1-019`).
- Für E galt unverändert die Festlegung vom 13.08. — es fällt nur, wo der **Kode selbst die
  Antwort** ist. Von 92 E-Kandidaten sind daher nur 20 gefallen.
- Kein Thema ist leer geworden; am stärksten betroffen `hautk1_nichtmelanozytaerer_hautkrebs`
  (120 → 110) und `gyn_ovar` (90 → 81).

**Offen bleibt der Upload:** Stand `2026-08-18-f8d815af` liegt im Repo, die App liefert noch
`13.08.2026 · f191e8` aus. `python3 pipeline/build_sql_chunked.py --keep-code` → dann
`material/relevanz/UPLOAD.md` abarbeiten.

## Erledigt — alle 23 Meldungen abgearbeitet (Stand 18.08.2026)

- [x] **gyn-b3-044** · Zervixkarzinom · gemeldet 06.08.2026 · [Issue #6](https://github.com/allawallabedalla/Secret/issues/6)
      Notiz: Frage ist ohne Folie kaum zu verstehen
      Frage: Welche Altersgrenze in Jahren nennt das Kursskript beim CIN-Management
      („Alter: jünger als … Jahre")?
      Lösung: 24
      Erklärung: Die Folie nennt „Alter: jünger als 24 Jahre". Quelle: gyn, S.40 unten
      Einordnung: numeric-Frage ohne jeden Kontext, welche Konstellation/Befund gemeint ist –
      reines Erraten oder Auswendiglernen einer isolierten Zahl. Entweder den Kontext
      (Befundkonstellation aus der Folie) in den Fragetext holen, oder die Frage streichen.
      Nachtrag 13.08. (Regel 1): Die Zahl steht auf der Folie direkt lesbar – ein Bild wäre die
      Antwort selbst. Also `delete`, außer der Kontext lässt sich sinnvoll in den Text holen.
      **Ergebnis (13.08.):** `delete` — isolierte Zahl ohne Befundkonstellation, von der Folie ablesbar (Regel 1).

- [x] **brust-b5-038** · Brustkrebs – Kodierung & Dokumentation · gemeldet 06.08.2026 · [Issue #7](https://github.com/allawallabedalla/Secret/issues/7)
      Notiz: Hier wird auf eine nicht sichtbare Tabelle verwiesen
      Frage: Welcher ICD-10-Kode gehört laut Übersichtstabelle zu C50.* mit dem
      Dignitätscode XXXX/0 (gutartig)?
      Optionen: D24 [richtig] · D48.6 · D05.* · C50.*
      Lösung: D24 · Quelle: brust, Folie 16 (S.69)
      Einordnung: Frage verweist wörtlich auf „Übersichtstabelle", die nicht mitgeliefert wird.
      Beste Lösung: die Tabelle (oder den relevanten Ausschnitt) als `image` an die Frage
      hängen – die App kann das bereits (Zoom-Lightbox vorhanden).
      Nachtrag 13.08. (Regeln 1+2): Bild fällt weg – die Tabellenzeile *ist* die Antwort. Und als
      Frage nach einem ICD-10-Kode fällt sie unter Regel 2. Rettbarer Kern: die Dignitätslogik
      (Endziffer /0 = gutartig → D-Kodegruppe statt C50.*). `rewrite` darauf, sonst `delete`.
      **Ergebnis (13.08.):** `delete` mit Runde E — reine ICD-10-Kode-Abfrage; die Dignitätslogik (/0 → D-Gruppe) wird in `medgrund-b2-013` weiterhin geprüft.

- [x] **deskstat-b2-009** · Deskriptive Statistik – Häufigkeiten & Grafische Darstellung · gemeldet 06.08.2026 · [Issue #8](https://github.com/allawallabedalla/Secret/issues/8)
      Notiz: Nicht lösbar ohne Folie
      Frage: Wie viele Fälle weisen in der Häufigkeitstabelle „Haarfarbe" (geordnet nach
      Codes) fehlende Angaben auf (Gesamtzahl 43)?
      Lösung: 3 · Quelle: deskstat, Folie 40 (S.23)
      Einordnung: Rechenaufgabe (`numeric`), die auf konkrete Werte aus einer Tabelle
      zugreift, die nicht angezeigt wird – ohne Abbildung nicht beantwortbar.
      Beste Lösung: Tabelle „Haarfarbe" als `image` ergänzen (Musterbeispiel für
      Häufigkeitstabellen ist ohnehin lehrreich zu sehen).
      Nachtrag 13.08. (Regel 1): Grenzfall. Die „3" steht in der Tabelle als eigene Zeile
      („fehlend"), ist also ablesbar statt zu errechnen – dann ist das Bild die Antwort.
      `rewrite` auf eine echte Rechenaufgabe (Anteil fehlender Angaben an n = 43) oder `delete`.
      **Ergebnis (13.08.):** `rewrite` — echte Rechenaufgabe: „43 Fälle, bei 40 liegt die Angabe vor → Anteil fehlender Angaben in %" (7,0 %, Toleranz 0,2). Zahlen stehen im Fragetext, keine Tabelle nötig.

- [x] **strahl-b6-073** · Strahlentherapie – Dokumentations-Fallbeispiele · gemeldet 06.08.2026 · [Issue #9](https://github.com/allawallabedalla/Secret/issues/9)
      Notiz: Nicht lösbar ohne Folien
      Frage: Welche Angaben stehen im Dokumentationsbeispiel Aderhautmelanom bei Ende
      Grund und Nebenwirkungen?
      Optionen: „Ende Grund: E = reguläres Ende" [richtig] · „Nebenwirkungen: K = keine" [richtig]
      · „Ende Grund: F = Zieldosis erreicht mit Unterbrechung > 3 Kalendertage" ·
      „Nebenwirkungen: Grad 1"
      Lösung: E = reguläres Ende, K = keine · Quelle: strahl, Folie 43 (S.88)
      Einordnung: Die Erklärung erwähnt eine „Fallbeschreibung" („keine Pausen", „gut
      toleriert") mit den zwei Codes – aber im Fragetext selbst fehlt die Fallbeschreibung
      komplett. Wahrscheinlich beim Kürzen verloren gegangen; Fragetext müsste die
      Fallbeschreibung enthalten (oder die Folie als `image`).
      Nachtrag 13.08. (Regel 1): **Hier bleibt der Fix richtig** – die Fallbeschreibung ist
      Eingangsmaterial („keine Pausen", „gut toleriert"), die Kodes E/K folgen erst daraus.
      Also Fallbeschreibung in den Fragetext holen; ein Bild braucht es dafür nicht.
      **Ergebnis (13.08.):** `rewrite` — Fallbeschreibung (07.08.–09.08.2023, ohne Unterbrechung, Zieldosis erreicht, keine unerwünschten Wirkungen) steht jetzt im Fragetext; E und K sind daraus erschließbar. Am Folienbild S.88 geprüft.

- [x] **strahl-b6-043** · Strahlentherapie – oBDS-Kodierung & Meldebögen · gemeldet 07.08.2026 · [Issue #10](https://github.com/allawallabedalla/Secret/issues/10)
      Notiz: Hier ist wieder eine tabelle verwiesen
      Frage: Wie erklärt die Übersichtstabelle (App: „zum oBDS-Feld 14.12") den simultan
      integrierten Boost (SIB)? · Lösung: Der Boost erfolgt gleichzeitig mit der
      Hauptbestrahlung · Quelle: strahl, Folie 37 (S.85)
      Einordnung: **der einfachste Fall im ganzen Backlog.** Am Folienbild geprüft: die Tabelle
      stellt SIB/SEQ/KON gegenüber, die Lösung stimmt wörtlich. Anders als bei #7/#8/#9 ist die
      Frage aber **ohne die Tabelle vollständig lösbar** – die drei Distraktoren sind die
      Definitionen von SEQ und KON, und „simultan integriert" trägt die Antwort im Namen. Es
      stört nur die Floskel „laut Übersichtstabelle", die den Eindruck einer fehlenden Vorlage
      erzeugt. Fix: Floskel streichen („Was bezeichnet der simultan integrierte Boost (SIB)?"),
      Erklärung behalten. Lohnt sich als **generische Suche**: alle Fragen mit „laut
      Übersichtstabelle/laut Tabelle" im Fragetext, die inhaltlich gar keine Tabelle brauchen.
      **Ergebnis (13.08.):** `rewrite` — Floskel „laut Übersichtstabelle" gestrichen, sonst unverändert. Am Folienbild S.85 geprüft.

- [x] **gyn-b9-108** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #11](https://github.com/allawallabedalla/Secret/issues/11)
      Notiz: Muss die Codes nicht auswendig können
      Frage: Welche OPS-Zuordnungen gelten für Operationen an den weiblichen Genitalorganen?
      Lösung: 5-65 Ovar, 5-66 Tuba uterina, 5-67 Cervix uteri, 5-68 Inzision/Exzision/
      Exstirpation des Uterus · Quelle: gyn, Folie 87 (S.132)
      Einordnung: Kategorie E. Fachlich richtig, aber die OPS-Bereichsnummern sind
      Nachschlagewerk – im Beruf wird der Kode aus dem OPS-Katalog geholt, nicht erinnert.
      Empfehlung: `rewrite` auf das Prinzip (OPS-Kapitel 5 = Operationen, Gliederung nach
      Organ, Seitenangabe/Zusatzkodes) statt der Nummernliste. Achtung Cluster: **9 Fragen**
      hängen an Folie 87 – zusammen entscheiden.
      **Ergebnis (13.08.):** `delete` mit Runde E (OPS-Bereichsnummern).

- [x] **gyn-b1-001** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #12](https://github.com/allawallabedalla/Secret/issues/12)
      Notiz: Muss die Codes nicht auswendig können
      Frage: Welche Zuordnungen von ICD-10-Code und Lokalisation sind korrekt?
      Lösung: C51 Vulva, C53 Cervix uteri, C56 Ovar (C54 = Corpus uteri, nicht Ovar)
      Quelle: gyn, S.3 oben
      Einordnung: Ich hatte `keep` vorgeschlagen (C5x-Lokalisationen = tägliches Handwerkszeug,
      geprüft wird die Verwechslung C54 vs. C56). **Durch Entscheidung 2 vom 13.08. überholt:
      auch ICD-10-Zuordnungen fallen → `delete`.** Wenn ein Rest bleiben soll, dann höchstens
      eine Frage zum Prinzip (Gliederung der weiblichen Genitalorgane in C51–C57), nicht die
      Kode-Zuordnung selbst.
      **Ergebnis (13.08.):** `delete` mit Runde E — nach Entscheidung 2 fallen auch ICD-10-Zuordnungen.

- [x] **gyn-b9-123** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #13](https://github.com/allawallabedalla/Secret/issues/13)
      Notiz: Muss ich nicht auswendig können
      Frage: Welcher Zielgebiet-Schlüssel steht für die Beckenwand? · Lösung: 5.11
      Quelle: gyn, Folie 90 (S.133) — am Folienbild geprüft: **stimmt**
      Einordnung: Kategorie E, reiner Schlüssel-Drill aus einer 9-zeiligen Tabelle.
      Empfehlung: `delete` (siehe Cluster-Entscheidung unten bei #14).
      **Ergebnis (13.08.):** `delete` mit Runde E (Zielgebiet-Schlüssel).

- [x] **gyn-b9-121** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #14](https://github.com/allawallabedalla/Secret/issues/14)
      Notiz: Muss ich nicht auswendig können
      Frage: Welche Zielgebiet-Schlüssel sieht die Doku für gynäkologische Organe vor?
      Lösung: 5.7 Uterus, 5.8 Zervix, 5.9 Vulva, 5.10 Vagina · Quelle: gyn, Folie 90 (S.133)
      Einordnung: Kategorie E **und Redundanz-Problem**: die Optionen dieser Frage enthalten
      die Lösungen von `gyn-b9-122` (5.10 Vagina) und `gyn-b9-123` (5.11 Beckenwand, in der
      Erklärung) – wer sie zuerst zieht, kennt die anderen beiden.
      **Cluster-Entscheidung Folie 90 (8 Fragen, `gyn-b9-121`…`128`):** die Schlüssel-Drills
      121–125 und 127 streichen bzw. zu **einer** Übersichtsfrage zusammenführen; behalten,
      was das Prinzip prüft: `gyn-b9-128` („(r, l)" = Seitenangabe Pflicht) und `gyn-b9-126`
      (was der Beckenlymphabfluss 9.10 umfasst – anatomisch/inhaltlich relevant).
      **Ergebnis (13.08.):** `delete` mit Runde E. Aus dem Cluster Folie 90 bleiben `gyn-b9-126` (Umfang des Beckenlymphabflusses) und `gyn-b9-128` („(r, l)" = Seitenangabe Pflicht).

- [x] **gyn-b9-124** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #15](https://github.com/allawallabedalla/Secret/issues/15)
      Notiz: Muss ich nicht können
      Frage: Welches Zielgebiet bezeichnet der Schlüssel 9.8? · Lösung: Paraaortale/paracavale
      Lymphknoten · Quelle: gyn, Folie 90 (S.133) — am Folienbild geprüft: **stimmt**
      Einordnung: Kategorie E, Schlüssel→Text-Richtung derselben Tabelle; die Distraktoren sind
      die Nachbarzeilen (9.9/9.10/9.11). `delete` im Cluster (siehe #14).
      **Ergebnis (13.08.):** `delete` mit Runde E (Zielgebiet-Schlüssel).

- [x] **gyn-b9-086** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #16](https://github.com/allawallabedalla/Secret/issues/16)
      Notiz: Ergibt keinen Sinn mit Bild
      Frage: Welche Gene bzw. Marker sind in der Übersicht zur Dokumentation der genetischen
      Varianten aufgeführt? · Quelle: gyn, Folie 82 (S.129)
      Einordnung: Am Folienbild geprüft – die Folie **ist** nur diese Tabelle (BRCA 1, BRCA 2,
      ERBB2, L1CAM, p16_IHC, PD-L1_IHC, POLE, RET, TP53 + „Zusätzlich MMR/MSI"), es gibt keinen
      Erklärtext. Zwei Zuschnitt-Fehler: eine Option bündelt drei Zeilen („POLE, RET und TP53"),
      und `p16_IHC`/`PD-L1_IHC` stehen nur in der Erklärung, nicht in den Optionen – die Frage
      prüft damit weder Vollständigkeit noch Verständnis, sondern Listen-Wiedererkennung.
      Rückfrage geklärt (13.08.): „Ergibt keinen Sinn mit Bild" heißt **die Tabelle enthält die
      fertige Antwort** – ein `image` wäre hier kein Fix, sondern gäbe die Lösung her. Genau
      daraus ist Regel 1 oben entstanden.
      Empfehlung: `delete`; allenfalls `rewrite` auf den einzigen prüfbaren Kern der Folie (dass
      genetische Varianten je Gen mit Exon-Angabe dokumentiert werden, MMR/MSI zusätzlich).
      **Ergebnis (13.08.):** `delete` — die Gentabelle enthält die fertige Antwort, ein Bild wäre kein Fix (Regel 1).

- [x] **gyn-b9-122** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #17](https://github.com/allawallabedalla/Secret/issues/17)
      Notiz: Muss ich nicht können
      Frage: Welcher Zielgebiet-Schlüssel steht für die Vagina? · Lösung: 5.10
      Quelle: gyn, Folie 90 (S.133) — am Folienbild geprüft: **stimmt**
      Einordnung: Kategorie E; Lösung steht wörtlich in den Optionen von `gyn-b9-121`.
      `delete` im Cluster (siehe #14).
      **Ergebnis (13.08.):** `delete` mit Runde E (Zielgebiet-Schlüssel).

- [x] **gyn-b1-005** · Grundlagen & Anatomie · gemeldet 12.08.2026 · [Issue #18](https://github.com/allawallabedalla/Secret/issues/18)
      Notiz: Ohne Abbildung kein Sinn
      Frage (App): Welche Epithelarten werden unterschieden?
      Frage (Repo, neuer): Welche Epithelarten nennt das Kursskript in der Übersicht
      „Arten von Epithel"? · Quelle: gyn, S.4 oben
      Einordnung: Kategorie A (Abbildungs-Beschriftung), **plus Auslieferungsproblem**: die App
      zeigt den alten Wortlaut, der Repo-Stand ist schon nachgebessert (Selfcontained-Runde,
      Grund `kontext`) – der Supabase-Upload ist hier älter als `main`. Inhaltlich bleibt die
      Frage auch mit Kontext schwach: sie ist allein über den unmöglichen Distraktor
      („sarkomatöses Epithel") lösbar, die drei richtigen Optionen sind dann geraten.
      Empfehlung nach Entscheidung 3 (13.08.): als Nomenklatur-/Abbildungsfrage → `delete`.
      Ein `image` scheidet nach Regel 1 aus (die Abbildung beschriftet die Antworten). Falls der
      Inhalt erhalten bleiben soll, dann nur mit Kodier-Bezug (Epithelart → Morphologiegruppe),
      das wäre dann eine andere Frage. Unabhängig davon: **Upload-Stand nachziehen** (Beob. 3).
      **Ergebnis (13.08.):** `delete` — Abbildungs-/Nomenklaturfrage (Entscheidung 3). Die Upload-Abweichung erledigt sich damit für diese Frage; Beobachtung 3 bleibt trotzdem offen.

- [x] **gyn-b7-003** · Grundlagen & Anatomie · gemeldet 12.08.2026 · [Issue #19](https://github.com/allawallabedalla/Secret/issues/19)
      Notiz: Muss keine anaotmise zuordnen [sic]
      Frage: Welche Abschnitte der Tuba uterina nennt das Kursskript?
      Quelle: gyn, Folie 6 (S.91, Prometheus-Abbildung)
      Einordnung: Kategorie A in Reinform – lateinische Anatomie-Nomenklatur einer
      Atlas-Abbildung; im oBDS wird nichts davon so dokumentiert. Gleicher Konstruktionsfehler
      wie #18 (nur der Fantasie-Distraktor „Colliculus tubae" trennt). Empfehlung: `delete` –
      durch Entscheidung 3 bestätigt (Nomenklatur fällt). Als Topographie-Frage (C57.0) neu
      aufziehen geht nach Entscheidung 2 ebenfalls nicht, wenn der Kode die Antwort wäre.
      **Ergebnis (13.08.):** `delete` mit Runde E (A-Erweiterung: Quelle ist eine Anatomie-Abbildung).

- [x] **gyn-b7-107** · ICD-O-3, Morphologie & Grading · gemeldet 12.08.2026 · [Issue #20](https://github.com/allawallabedalla/Secret/issues/20)
      Notiz: Muss genau histocodes nicht auswendig können
      Frage: Welchen Morphologiekode nennt die WHO-5th sowohl für das Large cell NEC als auch
      für das Combined large cell NEC? · Lösung: 8013/3 · Quelle: gyn, Folie 31 (S.104)
      Einordnung: Am Folienbild geprüft – **stimmt** (8013/3 steht dort zweimal). Von den fünf
      Fragen des Clusters ist das die einzige mit didaktischem Kern: dass zwei Entitäten
      denselben Kode teilen, ist eine Kodierregel-Beobachtung, kein Nummern-Auswendiglernen.
      Empfehlung: **`rewrite` als einzige Frage der Folie 31** – und zwar so, dass die Antwort
      *nicht* der Kode ist: „Welche zwei Entitäten der WHO-5th teilen sich denselben
      Morphologiekode?" → Large cell NEC und Combined large cell NEC. Damit ist sie mit
      Entscheidung 2 vereinbar (Sachverhalt als Antwort, Kode nur als Nebenangabe). Trägt das
      nicht, dann `delete` zusammen mit dem Rest des Clusters.
      **Ergebnis (13.08.):** `rewrite` — Frage lautet jetzt „Welche zwei Entitäten teilen sich denselben Morphologiekode?"; der Kode steht nur noch in der Erklärung.

- [x] **gyn-b7-105** · ICD-O-3, Morphologie & Grading · gemeldet 12.08.2026 · [Issue #21](https://github.com/allawallabedalla/Secret/issues/21)
      Notiz: Muss genaue histocodes nciht können [sic]
      Frage: Welche Kodes nennt die WHO-5th für die neuroendokrinen Karzinome (NEC)?
      Quelle: gyn, Folie 31 (S.104)
      Einordnung: Kategorie E (4 Kodes am Stück abzufragen ist der Extremfall) **und ein echter
      Sachfehler in der Erklärung**: „Einen Kode 8046/3 gibt es nicht" ist falsch – 8046/3 ist in
      der ICD-O-3 das Non-small cell carcinoma. Richtig wäre „8046/3 kommt auf der Folie nicht
      vor" bzw. „steht dort nicht für das Combined large cell NEC". Am Folienbild geprüft: die
      vier als richtig markierten Kodes stimmen, 8046/3 steht dort nicht.
      Empfehlung: `delete` (inhaltlich Teilmenge von `gyn-b7-107`); falls sie bleibt, **muss**
      die Erklärung korrigiert werden – so steht eine falsche Aussage über die ICD-O-3 im Katalog.
      **Ergebnis (13.08.):** `delete` mit Runde E — der Fehler „8046/3 gibt es nicht" entfällt damit; als Audit-Muster in `BILANZ.md` festgehalten.

- [x] **gyn-b7-092** · ICD-O-3, Morphologie & Grading · gemeldet 12.08.2026 · [Issue #22](https://github.com/allawallabedalla/Secret/issues/22)
      Notiz: Keine genauen histocodes
      Frage: Welchen Keimzelltumor nennt die WHO-5th für den Eileiter?
      Lösung: 9080/3 Immature teratoma NOS · Quelle: gyn, Folie 27 (S.102)
      Einordnung: Kategorie E. Der einzige lernbare Kern ist die Aussage „beim Eileiter führt die
      WHO nur **einen** Keimzelltumor" – die vier Kode-Distraktoren tragen dazu nichts bei.
      Empfehlung: `rewrite` auf diese Aussage (ohne Kodeliste) oder `delete`.
      **Ergebnis (13.08.):** `delete` mit Runde E (Morphologiekode).

- [x] **gyn-b7-023** · ICD-O-3, Morphologie & Grading · gemeldet 12.08.2026 · [Issue #23](https://github.com/allawallabedalla/Secret/issues/23)
      Notiz: Keine genauen codes
      Frage: Welchen ICD-O-3-Topographiekode hat das Myometrium? · Lösung: C54.2
      Quelle: gyn, Folie 13 (S.95)
      Einordnung: Ich hatte `keep` vorgeschlagen (ICD-O-3-Topographie als Handwerkszeug,
      C54.1 Endometrium vs. C54.2 Myometrium als typische Verwechslung). **Durch Entscheidung 2
      vom 13.08. überholt → `delete`.** Das war die Grundsatzentscheidung: die ~26 Kode-Fragen
      des `icdo`-Skripts fallen in derselben Runde mit.
      **Ergebnis (13.08.):** `delete` mit Runde E — nach Entscheidung 2 fällt auch die ICD-O-3-Topographie.

- [x] **patho1-b2-036** · Pathologie I – Molekularpathologie · gemeldet 17.08.2026 · [Issue #24](https://github.com/allawallabedalla/Secret/issues/24)
      Notiz: Nicht nachvollziehbar
      Frage: Welche Angaben zur im Kursskript zitierten Trastuzumab-Studie (krankheitsfreies
      Überleben) treffen zu?
      Optionen: 133 Ereignisse [richtig] · 261 Ereignisse [richtig] · p < 0,0001 [richtig] ·
      Hazard Ratio 0,48 [richtig] · Kontrollgruppe nur 12 Ereignisse
      Quelle: patho1, Folie 54 (S.28)
      Einordnung: Kategorie F. Vier Zahlen einer einzelnen zitierten Studie, dazu ein
      Zahlen-Distraktor – ohne die Folie nicht herleitbar, mit der Folie reines Ablesen.
      **Ergebnis (18.08.):** `delete` mit Runde F. Der Zwilling `patho1-b2-035` (Hazard Ratio 0,48
      als Einzelfrage) fällt mit — er war dem Detektor zunächst entgangen, weil im Fragetext kein
      Abbildungswort steht; `F_CTX` wertet eine Studienstatistik jetzt selbst als Beleg.

- [x] **strahl-b4-035** · Strahlentherapie – Spezialverfahren · gemeldet 17.08.2026 · [Issue #25](https://github.com/allawallabedalla/Secret/issues/25)
      Notiz: Beispiel, nicht pausxhal
      Frage: Welchen p-Wert gibt die Kaplan-Meier-Kurve zur interstitiellen Brachytherapie bei
      Weichteilsarkomen im Kursskript an? · Lösung: 0,04 · Quelle: strahl, S.54 unten
      Einordnung: Kategorie F in Reinform – der p-Wert einer einzelnen Kurve. Die vier übrigen
      Fragen derselben Folie sind Sachfragen zur Brachytherapie und bleiben.
      **Ergebnis (18.08.):** `delete` mit Runde F.

- [x] **hautk2-b1-005** · Hautkrebs II – Grundlagen · gemeldet 17.08.2026 · [Issue #26](https://github.com/allawallabedalla/Secret/issues/26)
      Notiz: Nicht wichtig direkte Zuordnung
      Frage: Welche Zuordnungen von Melanomen zu ICD-10- und Morphologie-Codes treffen zu?
      Optionen: Malignes Melanom o.n.A. – 8720/3 (C43.-) [richtig] · SSM – 8743/3 [richtig] ·
      Melanoma in situ – 8720/2 mit C43.- · Lentigo maligna – 8742/2 [richtig]
      Quelle: hautk2, Folie 4 (S.4)
      Einordnung: Nachläufer der Kategorie E, den Runde E strukturell verfehlt hatte (`E_TOK`
      suchte den Kode am Optionsanfang, hier steht er mitten im Text). Grenzfall: die Frage
      prüft im Kern die Regel *in situ → D03.-, maligne → C43.-*, was nach Regel 2 vom 13.08.
      ein `keep` wäre — ihre **Antwort** besteht aber aus Morphologiekodes.
      **Ergebnis (18.08.):** `delete` mit Runde F — aufgelöst über den Cluster statt über die
      Einzelfrage: `hautk2-b1-007` fragt exakt die Regel ab („Melanom der Haut (maligne) – C43.-,
      (in situ) – D03.-") und **bleibt**. Damit ist die Regel weiterhin abgedeckt und der
      Kode-Drill verschwunden.

- [x] **gyn-b4-006** · Zervixkarzinom · gemeldet 17.08.2026 · [Issue #27](https://github.com/allawallabedalla/Secret/issues/27)
      Notiz: Abbildung nciht sinnvoll
      Frage: Welche Fallzahlen nennt die Legende der Kurve „relatives survival nach FIGO"
      korrekt? · Lösung: Ia n=228, IIa n=219, IIb n=690 · Quelle: gyn, S.46 unten
      Einordnung: Kategorie F, zusätzlich vom Typ „finde die falsche Zahl" (der Distraktor
      verschiebt n=558 von FIGO III auf IV). Auf derselben Folie fragt `gyn-b4-005` dieselbe
      Legende als numeric ab (n für FIGO Ib).
      **Ergebnis (18.08.):** `delete` mit Runde F, zusammen mit `gyn-b4-005`. Die fünf Sachfragen
      der Folie (FIGO-III/IV-Definitionen, Hydronephrose) bleiben.

- [x] **brust-b4-010** · Brustkrebs – Therapie · gemeldet 17.08.2026 · [Issue #28](https://github.com/allawallabedalla/Secret/issues/28)
      Notiz: Beispiel, nicht pauschal
      Frage: Welchen Gesamtanteil (Total) hatte die endokrine Therapie (ET) allein (in %)?
      Lösung: 49 · Quelle: brust, S.49 unten
      Einordnung: Kategorie F **und** Kategorie A – die Frage nennt weder Kohorte noch
      Auswertung, „Total" bleibt ohne die Folie unbestimmt. Auf `brust` S.49 stehen zwölf
      Fragen, sechs davon fragen Kohortenzahlen ab.
      **Ergebnis (18.08.):** `delete` mit Runde F, zusammen mit `brust-b4-003` (n = 7421),
      `brust-b4-011` (Trastuzumab-Anteile) und den Trend-Fragen `b4-015`–`b4-017`. Der
      Sachverhalt der Folie („ET ist die tragende adjuvante Therapie bei HR+") bleibt über
      `brust-b4-008` erhalten; `brust-b4-004` (~86 % HR-positiv) bleibt als biologische
      Regelmäßigkeit.

## Offen

(keine offenen Meldungen — neue Meldungen erscheinen als Issue in `allawallabedalla/Secret`)
