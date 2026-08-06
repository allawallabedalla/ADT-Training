# Fragen-Backlog

> Arbeitsliste der in der App als **fragwürdig** gemeldeten Fragen.
> Aktualisieren: `node tools/reports-to-backlog.mjs <export.md>`
> (Export kommt aus der App: Einstellungen → Gemeldete Fragen → „Als Datei").
> GitHub-Issues (privat, `allawallabedalla/Secret`) sind die führende Quelle je Frage –
> hier steht zusätzlich die Übersicht samt Einordnung.

Zuletzt aktualisiert: 2026-08-06 · offen: 4 · erledigt: 0

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
2. Stichprobenartig querchecken, ob `selfcontained_check.py` zuletzt tatsächlich gegen den
   ausgelieferten Stand lief (nicht nur gegen die Rohgenerierung).

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

- [ ] **brust-b5-038** · Brustkrebs – Kodierung & Dokumentation · gemeldet 06.08.2026 · [Issue #7](https://github.com/allawallabedalla/Secret/issues/7)
      Notiz: Hier wird auf eine nicht sichtbare Tabelle verwiesen
      Frage: Welcher ICD-10-Kode gehört laut Übersichtstabelle zu C50.* mit dem
      Dignitätscode XXXX/0 (gutartig)?
      Optionen: D24 [richtig] · D48.6 · D05.* · C50.*
      Lösung: D24 · Quelle: brust, Folie 16 (S.69)
      Einordnung: Frage verweist wörtlich auf „Übersichtstabelle", die nicht mitgeliefert wird.
      Beste Lösung: die Tabelle (oder den relevanten Ausschnitt) als `image` an die Frage
      hängen – die App kann das bereits (Zoom-Lightbox vorhanden).

- [ ] **deskstat-b2-009** · Deskriptive Statistik – Häufigkeiten & Grafische Darstellung · gemeldet 06.08.2026 · [Issue #8](https://github.com/allawallabedalla/Secret/issues/8)
      Notiz: Nicht lösbar ohne Folie
      Frage: Wie viele Fälle weisen in der Häufigkeitstabelle „Haarfarbe" (geordnet nach
      Codes) fehlende Angaben auf (Gesamtzahl 43)?
      Lösung: 3 · Quelle: deskstat, Folie 40 (S.23)
      Einordnung: Rechenaufgabe (`numeric`), die auf konkrete Werte aus einer Tabelle
      zugreift, die nicht angezeigt wird – ohne Abbildung nicht beantwortbar.
      Beste Lösung: Tabelle „Haarfarbe" als `image` ergänzen (Musterbeispiel für
      Häufigkeitstabellen ist ohnehin lehrreich zu sehen).

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

## Erledigt

(noch nichts erledigt)
