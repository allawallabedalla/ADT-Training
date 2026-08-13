# Fragen-Backlog

> Arbeitsliste der in der App als **fragwürdig** gemeldeten Fragen.
> Aktualisieren: `node tools/reports-to-backlog.mjs <export.md>`
> (Export kommt aus der App: Einstellungen → Gemeldete Fragen → „Als Datei").
> GitHub-Issues (privat, `allawallabedalla/Secret`) sind die führende Quelle je Frage –
> hier steht zusätzlich die Übersicht samt Einordnung.
> Hinweis: Die Beobachtungs-Abschnitte sind von Hand geschrieben; `reports-to-backlog.mjs`
> überträgt nur die Kästchen-Einträge – Prosa vor „## Offen" nach einem Lauf wieder einsetzen.

Zuletzt aktualisiert: 2026-08-13 · offen: 18 · erledigt: 0

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

### Beobachtung 3: der ausgelieferte Katalog ist nicht der aus `main`

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

## Offen

- [ ] **gyn-b3-044** · Zervixkarzinom · gemeldet 06.08.2026 · [Issue #6](https://github.com/allawallabedalla/Secret/issues/6)
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

- [ ] **brust-b5-038** · Brustkrebs – Kodierung & Dokumentation · gemeldet 06.08.2026 · [Issue #7](https://github.com/allawallabedalla/Secret/issues/7)
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

- [ ] **deskstat-b2-009** · Deskriptive Statistik – Häufigkeiten & Grafische Darstellung · gemeldet 06.08.2026 · [Issue #8](https://github.com/allawallabedalla/Secret/issues/8)
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

- [ ] **strahl-b6-073** · Strahlentherapie – Dokumentations-Fallbeispiele · gemeldet 06.08.2026 · [Issue #9](https://github.com/allawallabedalla/Secret/issues/9)
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

- [ ] **strahl-b6-043** · Strahlentherapie – oBDS-Kodierung & Meldebögen · gemeldet 07.08.2026 · [Issue #10](https://github.com/allawallabedalla/Secret/issues/10)
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

- [ ] **gyn-b9-108** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #11](https://github.com/allawallabedalla/Secret/issues/11)
      Notiz: Muss die Codes nicht auswendig können
      Frage: Welche OPS-Zuordnungen gelten für Operationen an den weiblichen Genitalorganen?
      Lösung: 5-65 Ovar, 5-66 Tuba uterina, 5-67 Cervix uteri, 5-68 Inzision/Exzision/
      Exstirpation des Uterus · Quelle: gyn, Folie 87 (S.132)
      Einordnung: Kategorie E. Fachlich richtig, aber die OPS-Bereichsnummern sind
      Nachschlagewerk – im Beruf wird der Kode aus dem OPS-Katalog geholt, nicht erinnert.
      Empfehlung: `rewrite` auf das Prinzip (OPS-Kapitel 5 = Operationen, Gliederung nach
      Organ, Seitenangabe/Zusatzkodes) statt der Nummernliste. Achtung Cluster: **9 Fragen**
      hängen an Folie 87 – zusammen entscheiden.

- [ ] **gyn-b1-001** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #12](https://github.com/allawallabedalla/Secret/issues/12)
      Notiz: Muss die Codes nicht auswendig können
      Frage: Welche Zuordnungen von ICD-10-Code und Lokalisation sind korrekt?
      Lösung: C51 Vulva, C53 Cervix uteri, C56 Ovar (C54 = Corpus uteri, nicht Ovar)
      Quelle: gyn, S.3 oben
      Einordnung: Ich hatte `keep` vorgeschlagen (C5x-Lokalisationen = tägliches Handwerkszeug,
      geprüft wird die Verwechslung C54 vs. C56). **Durch Entscheidung 2 vom 13.08. überholt:
      auch ICD-10-Zuordnungen fallen → `delete`.** Wenn ein Rest bleiben soll, dann höchstens
      eine Frage zum Prinzip (Gliederung der weiblichen Genitalorgane in C51–C57), nicht die
      Kode-Zuordnung selbst.

- [ ] **gyn-b9-123** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #13](https://github.com/allawallabedalla/Secret/issues/13)
      Notiz: Muss ich nicht auswendig können
      Frage: Welcher Zielgebiet-Schlüssel steht für die Beckenwand? · Lösung: 5.11
      Quelle: gyn, Folie 90 (S.133) — am Folienbild geprüft: **stimmt**
      Einordnung: Kategorie E, reiner Schlüssel-Drill aus einer 9-zeiligen Tabelle.
      Empfehlung: `delete` (siehe Cluster-Entscheidung unten bei #14).

- [ ] **gyn-b9-121** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #14](https://github.com/allawallabedalla/Secret/issues/14)
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

- [ ] **gyn-b9-124** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #15](https://github.com/allawallabedalla/Secret/issues/15)
      Notiz: Muss ich nicht können
      Frage: Welches Zielgebiet bezeichnet der Schlüssel 9.8? · Lösung: Paraaortale/paracavale
      Lymphknoten · Quelle: gyn, Folie 90 (S.133) — am Folienbild geprüft: **stimmt**
      Einordnung: Kategorie E, Schlüssel→Text-Richtung derselben Tabelle; die Distraktoren sind
      die Nachbarzeilen (9.9/9.10/9.11). `delete` im Cluster (siehe #14).

- [ ] **gyn-b9-086** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #16](https://github.com/allawallabedalla/Secret/issues/16)
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

- [ ] **gyn-b9-122** · Dokumentation, OPS & Strahlentherapie · gemeldet 12.08.2026 · [Issue #17](https://github.com/allawallabedalla/Secret/issues/17)
      Notiz: Muss ich nicht können
      Frage: Welcher Zielgebiet-Schlüssel steht für die Vagina? · Lösung: 5.10
      Quelle: gyn, Folie 90 (S.133) — am Folienbild geprüft: **stimmt**
      Einordnung: Kategorie E; Lösung steht wörtlich in den Optionen von `gyn-b9-121`.
      `delete` im Cluster (siehe #14).

- [ ] **gyn-b1-005** · Grundlagen & Anatomie · gemeldet 12.08.2026 · [Issue #18](https://github.com/allawallabedalla/Secret/issues/18)
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

- [ ] **gyn-b7-003** · Grundlagen & Anatomie · gemeldet 12.08.2026 · [Issue #19](https://github.com/allawallabedalla/Secret/issues/19)
      Notiz: Muss keine anaotmise zuordnen [sic]
      Frage: Welche Abschnitte der Tuba uterina nennt das Kursskript?
      Quelle: gyn, Folie 6 (S.91, Prometheus-Abbildung)
      Einordnung: Kategorie A in Reinform – lateinische Anatomie-Nomenklatur einer
      Atlas-Abbildung; im oBDS wird nichts davon so dokumentiert. Gleicher Konstruktionsfehler
      wie #18 (nur der Fantasie-Distraktor „Colliculus tubae" trennt). Empfehlung: `delete` –
      durch Entscheidung 3 bestätigt (Nomenklatur fällt). Als Topographie-Frage (C57.0) neu
      aufziehen geht nach Entscheidung 2 ebenfalls nicht, wenn der Kode die Antwort wäre.

- [ ] **gyn-b7-107** · ICD-O-3, Morphologie & Grading · gemeldet 12.08.2026 · [Issue #20](https://github.com/allawallabedalla/Secret/issues/20)
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

- [ ] **gyn-b7-105** · ICD-O-3, Morphologie & Grading · gemeldet 12.08.2026 · [Issue #21](https://github.com/allawallabedalla/Secret/issues/21)
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

- [ ] **gyn-b7-092** · ICD-O-3, Morphologie & Grading · gemeldet 12.08.2026 · [Issue #22](https://github.com/allawallabedalla/Secret/issues/22)
      Notiz: Keine genauen histocodes
      Frage: Welchen Keimzelltumor nennt die WHO-5th für den Eileiter?
      Lösung: 9080/3 Immature teratoma NOS · Quelle: gyn, Folie 27 (S.102)
      Einordnung: Kategorie E. Der einzige lernbare Kern ist die Aussage „beim Eileiter führt die
      WHO nur **einen** Keimzelltumor" – die vier Kode-Distraktoren tragen dazu nichts bei.
      Empfehlung: `rewrite` auf diese Aussage (ohne Kodeliste) oder `delete`.

- [ ] **gyn-b7-023** · ICD-O-3, Morphologie & Grading · gemeldet 12.08.2026 · [Issue #23](https://github.com/allawallabedalla/Secret/issues/23)
      Notiz: Keine genauen codes
      Frage: Welchen ICD-O-3-Topographiekode hat das Myometrium? · Lösung: C54.2
      Quelle: gyn, Folie 13 (S.95)
      Einordnung: Ich hatte `keep` vorgeschlagen (ICD-O-3-Topographie als Handwerkszeug,
      C54.1 Endometrium vs. C54.2 Myometrium als typische Verwechslung). **Durch Entscheidung 2
      vom 13.08. überholt → `delete`.** Das war die Grundsatzentscheidung: die ~26 Kode-Fragen
      des `icdo`-Skripts fallen in derselben Runde mit.

## Erledigt

(noch nichts erledigt)
