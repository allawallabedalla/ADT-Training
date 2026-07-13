# Experten-Workshop – ADT Trainer

> Ergebnis eines 10-köpfigen Experten-Reviews (intern & extern) · Stand: 2026-07-13 · App-Version 0.6.0
> 10 Fachexperten haben Code, Design, Fachinhalt, Recht/Datenschutz und Produkt akribisch geprüft.

**10 Experten · 101 Befunde** (hoch 30 · mittel 44 · niedrig 27)

## Executive Summary

Die ADT-Lernapp hat ein überdurchschnittlich solides Fundament (HIG-nahes iOS-Design, robuste Fehler-Boundaries, saubere PWA-/Sync-Schicht, fachlich überwiegend korrekte Fragen) und ist frei von Dark Patterns. Zehn Experten zeichnen aber ein konsistentes Bild von vier großen Baustellen, die den Kern des Prüfungsversprechens betreffen: (1) Der Prüfungsmodus ist keine echte Simulation, sondern verkapptes Üben (Sofort-Feedback, keine freie Navigation, kein Timer, kein Blueprint); (2) die App trainiert fast nur Faktenabruf per Multiple-Choice, während die echte, hilfsmittelgestützte Prüfung Anwendung/Kodierung verlangt — Fall→Code/Stadium und Rechenaufgaben fehlen; (3) das Lernmodell erzeugt eine Kompetenz-Illusion (einmal richtig = "gemeistert", keine Spaced Repetition); (4) Barrierefreiheit ist kein Feinschliff, sondern enthält echte Blocker (gesperrter Zoom, Fokusverlust durch Full-Re-Render, fehlende Screenreader-Semantik) — besonders relevant, weil die reale Prüfung laut Workbook am Laptop stattfindet. Hinzu kommen zwei nicht-technische Pflichtthemen vor jeder Verbreitung: fehlende Datenschutzerklärung/Einwilligung samt ungebremster anon-RPCs sowie das Marken-/Irreführungsrisiko des Namens "ADT". Die gute Nachricht: Viele hochwirksame Korrekturen sind Quick Wins (Zoom entlocken, sichtbares Häkchen, Level-Up-Moment, drei fachliche Einzelkorrekturen). Empfohlene Reihenfolge: erst die Fragetyp-Abstraktion als Enabler und die fachlichen Korrekturen, dann Prüfungsmodus + Anwendungsaufgaben + Spaced Repetition, parallel das Barrierefreiheits- und das Rechts-/Datenschutzpaket.

## Bereichsübergreifende Themen

- Echter Prüfungsmodus (Timer, kein Sofort-Feedback, freie Navigation, Flaggen, Sammelauswertung) — unabhängig genannt von UX, Assessment, Lernwissenschaft und Architektur (Session-Persistenz).
- Gesperrter Pinch-Zoom (viewport maximum-scale=1) — als WCAG-Verstoß beanstandet von UX, Barrierefreiheit und Performance/PWA.
- Full-Re-Render bei jeder Interaktion (innerHTML) mit Fokus-/Scrollverlust — kritisiert von Barrierefreiheit, Architektur und Performance.
- Fehlende Anwendungs-/Kodier- und Rechen-/Freitextaufgaben statt reinem MC — Architektur, Lernwissenschaft und Assessment fordern neue Aufgabentypen.
- Kompetenz-Illusion: 'einmal richtig = gemeistert' plus fehlende Spaced Repetition — Lernwissenschaft, Assessment und Growth.
- Content-Decke: nur 55 Fragen, sehr ungleich verteilt, schwache/absurde Distraktoren — Fachexpertin, Assessment, Lernwissenschaft, Growth.
- Onboarding/Erststart-Flow fehlt, 'So funktioniert's' versteckt, leere 0-Stats — UX und Growth.
- Tagesziel an die Streak koppeln — Gamification und Lernwissenschaft.
- Barrierefreiheits-Paket (ARIA-Rollen/aria-checked, Fokus-Management, aria-live, :focus-visible, reduced-motion, Kontrast) — UX und Barrierefreiheit.
- Modul-Split von app.js + Testbarkeit der Kernlogik — Architektur (Grundlage für Prüfungsmodus/Spaced Repetition).
- Vereinfachung des verschachtelten master-Badge-Tests — unabhängig von Architektur und Gamification bemerkt.

## Quick Wins (kleiner Aufwand, hoher Nutzen)

- **[S]** Pinch-Zoom aktivieren: maximum-scale=1/user-scalable aus dem viewport-Tag entfernen (viewport-fit=cover genügt)  
  _Barrierefreiheit_
- **[S]** Verpasste richtige Antwort sichtbar machen: grünes Häkchen/Füllung für .opt.missed .box + Label 'Richtige Antwort'  
  _UX / Feedback-Zustände_
- **[S]** Sichtbares Level-Up-Erlebnis: in checkCurrent levelForXp(alt) vs (neu) vergleichen und Toast/Modal mit neuem Titel auslösen  
  _Gamification_
- **[S]** Drei fachliche Einzelkorrekturen: pM0/pMX-Aussage (tnm-009), Strahlentherapie nicht als systemisch (the-004), CUP-Kode C80.0 statt C80.9 (icd-004)  
  _Fachinhalt_
- **[S]** Fetch-Timeout im network-first-Zweig des Service Workers (AbortController ~3-4s) gegen lie-fi-Hänger beim Start  
  _PWA / Performance_
- **[S]** Toast mit role=status/aria-live=polite und visually-hidden aria-live für das Quiz-Verdikt ('Richtig, +12 XP')  
  _Barrierefreiheit_
- **[S]** Sichtbarer :focus-visible-Ring global + @media (prefers-reduced-motion: reduce)-Block ergänzen  
  _Barrierefreiheit_
- **[S]** Reset von <span> auf <button class=link> in eigener Listenzeile (rot, 44px) umbauen; window.confirm im Quiz durch modalChoice ersetzen  
  _UX / Konsistenz_
- **[S]** Kontrast von --text-faint auf mind. 4,5:1 anheben (betrifft Prüfungs-Hinweis .q-hint und Badge-Text)  
  _Barrierefreiheit_

## Priorisierte Roadmap

### P1

- **[L] Fragetyp-Abstraktion (Strategy/Handler-Registry: validate/buildState/renderInput/grade je Typ)** — _Architektur_  
  Technischer Enabler für alle inhaltlichen P1-Vorhaben. Ohne die Abstraktion erzwingt jeder neue Aufgabentyp invasive Änderungen an fünf verstreuten Stellen (DATA_OK, buildSession, togglePick, checkCurrent, renderQuiz); DATA_OK würde Freitext-Items sofort als ungültig ablehnen. Zuerst bauen, dann Inhalte ausrollen.
- **[L] Fachliche Aktualisierung: TNM-Editionsstand (UICC 8. Aufl.) fixieren, oBDS-Terminologie, UICC-Stadiengruppierung und Sentinel-/ITC-Nodalnotation als neue Fragen** — _Fachinhalt_  
  Fachliche Korrektheit hat laut Projektregel Vorrang. Ohne Editionsangabe sind mehrere Aussagen nicht eindeutig; oBDS ist der verbindliche aktuelle Begriff; Stadiengruppierung und ITC-Notation sind prüfungszentrale Kernkompetenzen, die komplett fehlen.
- **[L] Anwendungs-/Kodieraufgaben mit Nachschlage-Workflow (Fallvignette → Topografie/Morphologie/TNM/OPS) plus numeric-Eingabe für Raten und TNM→Stadium** — _Aufgabentypen / Inhalt_  
  Trifft den Kern der echten, hilfsmittelgestützten Prüfung: gefragt ist Fall→Code, nicht das Auswendiglernen nachschlagbarer Codes. Numeric/Freitext bricht die MC-Kompetenz-Illusion (Generation Effect) und übt Rechenweg und Stadiengruppierung, die MC nicht prüfen kann.
- **[L] Echter Prüfungsmodus: Timer 180 Min, kein Sofort-Feedback/keine XP-Toasts, freie Vor-/Zurück-Navigation + Flaggen, Blueprint-gesteuerte Themenquote, Abgeben → Sammelauswertung mit Themenprofil** — _Prüfungsmodus_  
  Größter Realismus-Hebel und Kernversprechen; von vier Experten unabhängig gefordert. Der heutige Exam-Modus fühlt sich wie Üben an, garantiert keine Themenabdeckung und ist zwischen Läufen nicht vergleichbar. Setzt Session-Persistenz (separater Storage-Key) voraus.
- **[L] Spaced Repetition (Leitner/SM-2) mit mehrstufiger, rücksetzbarer Mastery-Definition und 'heute fällig' auf der Startseite** — _Lernlogik_  
  Behebt die zwei größten Retention-Lücken gemeinsam: verteilte Wiederholung entlang der Vergessenskurve UND Ersatz der irreführenden 'einmal richtig = gemeistert'-Logik durch einen stabilen Sicherheitsstatus. Push-Erinnerungen an Fälligkeit koppeln statt an eine Uhrzeit.
- **[M] Quiz barrierefrei bedienbar: In-place-Toggle statt Full-Re-Render, role=radio/checkbox + aria-checked an Optionen, Fokus-Handling nach Render** — _Barrierefreiheit / Architektur_  
  Größter Einzelblocker der Bedienbarkeit: der komplette innerHTML-Neuaufbau bei jedem Tap zerstört Fokus und VoiceOver-Position und macht den Kern-Flow per Tastatur/Screenreader unbenutzbar — kritisch, da die Prüfung am Laptop stattfindet. Ohne diese Basis nützen weitere aria-Verbesserungen wenig.
- **[M] Datenschutzerklärung + Impressum und zweistufige Einwilligung vor Cloud-Sync und vor Push** — _Datenschutz / Recht_  
  Rechtlich zwingend (Art. 13 DSGVO, Einwilligung) und aktuell komplett fehlend; ohne das ist der öffentliche Betrieb einer Gesundheits-/Prüfungs-Lernapp angreifbar. EU-Region verbindlich festlegen, AVV mit Supabase.

### P2

- **[M] Pflicht-Härtung + Rate-Limiting aller anon-RPCs (sync_pull/push, push_save/remove): Längen-/Größenvalidierung verbindlich statt 'optional'** — _Security_  
  Die im README nur als optional beschriebene Payload-Validierung macht die vermutlich deployte Variante völlig ungeprüft. Ohne Rate-Limit sind Enumeration, Datenzerstörung, Müll-Datensätze und Kostentreiben möglich; codeExists-Orakel entfernen, Server-Mindestlänge >=16 erzwingen.
- **[M] Onboarding-Flow mit Aha-Moment und Tagesziel (an die Streak gekoppelt, mit Fortschrittsring)** — _Onboarding / Retention_  
  Neue Nutzer landen auf leeren 0-Stats, 'So funktioniert's' ist versteckt. Ein kurzer, überspringbarer Willkommens-Flow (<30 Sek bis zur ersten Frage) plus editierbares Tagesziel schafft den täglichen Fortschrittsanker und den ersten XP-/Streak-Moment — höchster Retention-Hebel pro Aufwand.
- **[M] Faire Streak: Gnadentag + Schutzkontingent + Rekord-Anerkennung** — _Gamification_  
  Ein verpasster Tag setzt die Serie heute hart und stumm auf 0 — klassische Streak-Angst und häufigster Abbruchgrund nach einem Ausrutscher. Kulanz verwandelt den demotivierenden Reset in einen Rückkehr-Anreiz.
- **[M] Badge-Rebalancing + Erstmeisterungs-Bonus-XP: Mengen-Grind deckeln, Meisterschafts-/Abdeckungs-Badges ergänzen** — _Gamification_  
  8 von 14 Badges sind reines Mengen-Grinding (bis 1000 Antworten ≈ 18-facher Durchlauf bei 55 Fragen), während das eigentliche Prüfungsziel (alle Themen/Fragen sicher) kein Badge hat. Einmaliger Erstmeisterungs-Bonus koppelt XP an Lernfortschritt statt an Zeit.
- **[M] Native Zurück-Navigation via History (pushState/popstate) mit In-Quiz-Bestätigung** — _Navigation / UX_  
  go() nutzt durchgehend replaceState; Swipe-back und Hardware-Back führen aus der App heraus statt zur vorigen Ansicht, im Quiz droht unbemerkter Abbruch. Erwartungskonforme Gesten sind Kern-HIG-Verhalten.
- **[L] Modul-Split von app.js + Export der reinen Logik und Node-Test-Harness (Merge, Level-Kurve, Bewertung, Sanitisierung) plus Fragen-CI-Check** — _Architektur / Qualität_  
  Der 1176-Zeilen-Monolith mit globalem Scope koppelt Kernlogik an DOM-Globale und ist nicht testbar. Voraussetzung für wartbaren Ausbau (Prüfungsmodus, Spaced Repetition) und für die Projektregel 'makellose Funktion' via automatisierter Regressionstests.
- **[M] Stale-while-revalidate für App-Shell + periodischer reg.update() bei visibilitychange** — _PWA / Performance_  
  Beseitigt die zwei fragilsten PWA-Stellen: cache-first plus manuelle Cache-Versionierung liefert bei vergessenem Bump dauerhaft alten Code; ohne periodisches update sehen langlebige Standalone-Sessions Updates erst nach Neustart.
- **[M] Konfidenz-Tap + Kalibrierungs-Feedback (Metakognition)** — _Lernwissenschaft_  
  Günstig, hoher Hebel: deckt die für MC typische Überkonfidenz auf, lenkt Wiederholung gezielt auf geratene/unsichere Treffer und trainiert die realistische Selbsteinschätzung — vor einer Prüfung entscheidend. Aktuell komplett abwesend.
- **[M] Distraktor- und Item-Überarbeitung nach Item-Writing-Standards (plausible Fehlvorstellungen statt Nonsens, homogene Optionslängen, 'alle richtig'-Muster begrenzen)** — _Item-Qualität_  
  Absurde Distraktoren (z. B. 'neuronal-elektrisch über Nervenimpulse') und Test-Wiseness-Cues (längste Option/‚nimm alle') senken Trennschärfe und diagnostische Aussagekraft der bestehenden Items sofort.
- **[M] Marken-/Rechts-Check des Namens 'ADT' + prominenter In-App-Disclaimer 'Inoffiziell'** — _Recht / Positionierung_  
  'ADT' ist die reale Arbeitsgemeinschaft Deutscher Tumorzentren; Name plus Prüfungs-Claim können Offizialität suggerieren (Marken-/UWG-Irreführungsrisiko), sobald über die eine Nutzerin hinaus verbreitet wird. Der Disclaimer steht heute nur im README.
- **[L] Content-Ausbau: ≥15-20 Fragen je Thema inkl. neuem Thema 'OPS/Prozeduren' und Item-Varianten/Paraphrasen** — _Inhalt_  
  55 Fragen sind zu wenig für eine glaubwürdige Simulation und begünstigen das Auswendiglernen konkreter Item-Strings; OPS ist als zugelassenes Hilfsmittel/Prüfungsinhalt gar nicht abgebildet, Datenschutz mit 2 Fragen unterrepräsentiert. Verzahnt mit Spaced Repetition.

### P3

- **[L] Kurs-/Lerngruppen-Code mit anonymisiertem Kohorten-Leaderboard (opt-in) und Verteilung kurseigener Fragensets** — _Growth / Skalierung_  
  Schafft den bislang fehlenden Skalierungs- und Retention-Hebel in einem, direkt auf dem bestehenden Sync-Code-Modell aufsetzbar; erschließt Verbreitung im Lehrgangs-Jahrgang (B2B2C über Kursanbieter). Nachrangig, bis Kernprodukt und Rechts-/Datenschutzbasis stehen.
- **[S] App-Weitergabe: Share-Button (navigator.share, Fallback Link kopieren) + clientseitiger QR-Code** — _Growth_  
  Aktiviert den stärksten organischen Kanal (Mundpropaganda im Kursraum), der produktseitig heute komplett fehlt — sehr geringer Aufwand, aber erst sinnvoll nach dem Rechts-Check des Namens.
- **[M] Lösch- & Aufbewahrungslogik (Retention-Job für verwaiste Codes/Push-Abos) + In-App 'Cloud-Daten endgültig löschen'; Fragen-Index & Memoisierung für Skalierung** — _Datenschutz / Performance_  
  Erfüllt Speicherbegrenzung (Art. 5) und Löschrecht (Art. 17); parallel gruppierter Fragen-Index/Memoisierung, damit Home/Themen bei wachsendem Fragenbestand nicht zu wiederholten Voll-Scans werden — beides erst mit steigender Nutzung/Content-Menge dringlich.

## Risiken

- Rechtsrisiko vor Verbreitung: fehlende Datenschutzerklärung/Einwilligung (Art. 13 DSGVO) und ungebremste, nur 'optional' gehärtete anon-RPCs ermöglichen Datenzerstörung und Missbrauch; zusätzlich Marken-/UWG-Irreführung durch den Namen 'ADT'. Öffentlicher Betrieb wäre angreifbar.
- Fachlich veraltete/unscharfe Aussagen (pM0 nur bei Autopsie, Strahlentherapie als systemisch, CUP-Kode) können falsches Wissen antrainieren; ohne fixierten TNM-Editionsstand und oBDS-Terminologie ist die Prüfungsnähe nicht belastbar — verletzt die oberste Projektregel 'Korrektheit hat Vorrang'.
- Kompetenz-Illusion: 'einmal richtig = gemeistert' plus reines Wiedererkennen ohne Spaced Repetition lassen Lernende Prüfungsreife überschätzen — genau der teuerste metakognitive Fehler vor der Prüfung.
- Barrierefreiheits-Blocker (gesperrter Zoom, Fokusverlust durch Full-Re-Render, fehlende Screenreader-Semantik) schließen Nutzer aus und gefährden die laut Workbook laptop-/tastaturbasierte Prüfungsnutzung.
- PWA-Update-Falle: cache-first plus manuelle Cache-Versionierung liefert bei vergessenem Bump dauerhaft alten Code; network-first ohne Timeout lässt den Start bei 'lie-fi' hängen — reale Feldbedingungen (Klinik/Zug).
- Content-Decke: bei nur 55 Fragen läuft die 'Schwachstellen'-Wiederkehrschleife ins Leere und Item-Texte werden auswendig gelernt statt Konzepte — begrenzt Langzeit-Retention und Teilbarkeit.
- Session-Verlust: die laufende Quiz-Session lebt nur im Speicher; Reload/App-Kill mitten im (geplanten) 180-Minuten-Prüfungsmodus verwirft alle Antworten — Persistenz muss vor dem Prüfungsmodus stehen.
- Architektur-Schuld: Ohne Fragetyp-Abstraktion und Modul-Split wird jede der geplanten Erweiterungen zu einer riskanten Änderung an verstreuten Stellen; difficulty wird zudem ungeprüft in XP/Index verwendet und kann bei einer fehlerhaften Frage zu NaN-XP-Verlust führen.

---

## Alle Befunde je Experte

### Senior UX-Designer/in (iOS-Schwerpunkt, Apple HIG)

_Die App ist visuell erstaunlich HIG-nah: konsequentes iOS-Farb- und Dark-System, Blur-Bars mit Safe-Areas, SF-Symbols-Stil-Icons, große Tap-Ziele und eine robuste Fehler-Boundary. Die größten offenen Hebel liegen nicht im Look, sondern im Feinschliff der Zustände (ein unsichtbares Häkchen bei verpasster Antwort), in Navigation und Gesten (Browser-/Swipe-Back fehlt), im Erststart/Onboarding und in echter Barrierefreiheit (deaktivierter Zoom, fehlende ARIA-Rollen/Fokus). Kein Blocker, aber mehrere kleine, hochwirksame Korrekturen heben das Erlebnis von gut auf wertig-nativ._

**Stärken:**
- Sehr konsistentes iOS-Design: systemGroupedBackground, OLED-Dark, Separator-Linien, Backdrop-Blur auf Navigation/Actionbar und korrekte Safe-Area-Insets (styles.css: .appbar, .actionbar, :root safe-area Variablen).
- Tap-Ergonomie überwiegend HIG-konform: .back-btn 44x44, .mode-btn min-height 60px, .opt-Padding 15px, .btn-primary min-height 52px.
- Starke UI-Robustheit: try/catch um jede View mit sicherer Recovery-Ansicht statt weißem Bildschirm (go(), app.js ~966) plus DATA_OK-Fallback.
- Gute Lernschleife am Ergebnis: Score-Ring, gestufte Hero-Texte und direkter Button 'Falsche wiederholen (n)' (renderResult).
- Leer-/Deaktiviert-Zustände sind bedacht: Schwachstellen-Button disabled mit erklärendem Untertitel, Themen ohne Fragen abgefangen.
- Large-Title mit Scroll-Collapse, inset-gruppierte Listen und Icon-Kacheln im Settings-Stil wirken vertraut und nativ.

**Befunde:**

- 🔴 hoch · **Zustände / Micro-Interactions** (S)  
  Verpasste richtige Antwort (Klasse .opt.missed) zeigt kein sichtbares Häkchen: .opt .box hat color:transparent (styles.css:203), und .opt.missed (styles.css:212) setzt nur den gestrichelten Rand, nie eine Box-Farbe. app.js:784 vergibt mark='✓', das aber unsichtbar bleibt. Der Lernende erkennt die verpasste korrekte Option nur am subtilen Rand — genau die wichtigste Lern-Rückmeldung geht verloren.  
  → _Regel ergänzen: .opt.missed .box { color: var(--success); border-color: var(--success); } (oder gefülltes grünes Häkchen). Zusätzlich ein Label wie 'Richtige Antwort' an der verpassten Option einblenden._
- 🔴 hoch · **Barrierefreiheit / HIG** (S)  
  index.html:5 setzt viewport maximum-scale=1 und verhindert damit Pinch-Zoom. Das verstößt gegen WCAG 1.4.4 und Apples Empfehlung, Zoom nie zu sperren — kritisch für eine Prüfungs-Lern-App mit teils langen Fachtexten.  
  → _maximum-scale=1 (und user-scalable-Sperren) entfernen. viewport-fit=cover reicht für die Safe-Areas; Zoom aktiviert lassen._
- 🟠 mittel · **Konsistenz** (S)  
  Beim Verlassen des Quiz wird das native window.confirm() genutzt (app.js:983), während sonst überall der eigene iOS-Alert modalChoice() verwendet wird. Der Systemdialog bricht die Designsprache und wirkt im Standalone-PWA fremd.  
  → _goBack() im Quiz auf modalChoice() umstellen (Buttons 'Training beenden' danger / 'Weiter üben' ghost) — konsistent mit Reset/Disconnect._
- 🟠 mittel · **Nutzerführung / Navigation** (M)  
  go() nutzt durchgehend history.replaceState (app.js:965), es gibt nur einen History-Eintrag. Dadurch führen der Android-Zurück-Button und die iOS-Swipe-back-Geste aus der App heraus statt zur vorigen Ansicht — im Quiz droht so unbemerkt der Abbruch. Der einzige Rückweg ist der kleine Chevron oben links.  
  → _pushState pro View + popstate-Handler, der wie goBack() navigiert (im Quiz mit Bestätigung). So funktionieren native Zurück-Gesten und Hardware-Back erwartungskonform._
- 🟠 mittel · **Onboarding / Erststart** (M)  
  Kein Erststart-Flow: Neue Nutzer landen direkt auf Home mit leeren Stat-Kacheln (0 beantwortet, 0%, 0 XP) als schwachem Empty-State. Die Anleitung 'So funktioniert's' liegt zudem unauffällig als letzter Eintrag unter der Sektion 'Fortschritt' (app.js:522) — semantisch falsch einsortiert und leicht zu übersehen.  
  → _Einmaliges, überspringbares Willkommen (2-3 Karten: Modi, Prüfungsregel, Installation) beim ersten Start; Home-Stats bei 0 durch eine motivierende Startkarte 'Erste Frage starten' ersetzen; 'So funktioniert's' in eine eigene Sektion 'App/Mehr' heben._
- 🟠 mittel · **Barrierefreiheit** (M)  
  Antwort-Optionen sind reine <button> ohne role/aria-checked (single=radio, multi=checkbox), der Auswahlzustand ist nur visuell (app.js:787). Beim View-Wechsel wird kein Fokus gesetzt und es gibt kein aria-live/Route-Announcement, sodass VoiceOver den Wechsel nicht meldet. Zusätzlich existieren zwei h1 (Appbar-Titel + .large-title) und es fehlt ein :focus-visible-Stil.  
  → _role=radio/checkbox + aria-checked an Optionen; nach jedem Render Fokus auf die Überschrift setzen (tabindex=-1) oder aria-live-Region 'Frage x von y'; Appbar-Titel auf role=heading beschränken/entdoppeln; globalen :focus-visible-Ring ergänzen (auch für die im Workbook offene Laptop-Prüfung relevant)._
- 🟠 mittel · **Prüfungsmodus (Backlog bestätigen/schärfen)** (L)  
  Der Exam-Modus verhält sich wie normales Üben: Sofort-Feedback pro Frage, XP-Toasts ('+10 XP') und keine Rück-/Flaggen-Navigation (buildSession/checkCurrent). Das widerspricht dem realen Prüfungsformat und dem im Backlog geplanten 'echten Prüfungsmodus'.  
  → _Backlog-P1 bestätigen und schärfen: im Exam kein Sofort-Feedback/keine Toasts, freie Vor-/Zurück-Navigation, Flaggen, sichtbarer Restfortschritt, 'Abgeben' -> gesammelte Auswertung mit Erklärungen. Optionaler Timer als sekundär._
- 🟡 niedrig · **Touch-Ergonomie / IA** (S)  
  Die destruktive Aktion 'Fortschritt zurücksetzen' ist ein kleiner, gemuteter Inline-Textlink am Seitenende (app.js:526, 14px). Geringe Affordanz, kleines Tap-Ziel und ungewohnte Platzierung für eine unwiderrufliche Aktion.  
  → _Reset als eigene Listenzeile in Sync & Sicherung (roter Text/roter Icon-Tile, min-height 44px) statt als Inline-Link auf Home; auf Home nur einen dezenten Hinweis belassen._
- 🟡 niedrig · **Micro-Interactions / Barrierefreiheit** (S)  
  Kein @media (prefers-reduced-motion): Score-Ring-Animation, .pop, xp-bar- und Progress-Transitions laufen immer. Nutzer mit aktivierter Bewegungsreduktion (iOS-Bedienungshilfe) bekommen keine Rücksicht.  
  → _prefers-reduced-motion:reduce-Block ergänzen, der Transitions/Animationen auf 0/none reduziert (Ring sofort auf Endwert)._
- 🟡 niedrig · **Zustände / Nutzerführung** (S)  
  Der Quiz-Fortschrittsbalken zeigt i/total (app.js:800), also 0% auf Frage 1 und nie 100% während des Quiz. Er misst 'erledigte' statt aktueller Position und wirkt dadurch verzögert/verwirrend.  
  → _Position abbilden: entweder (i+1)/total für 'aktuelle Frage' oder erst nach dem Prüfen hochzählen — konsistent zur Zählung 'i+1 / total'._
- 🟡 niedrig · **Konsistenz** (S)  
  Trotz der v0.4.0-Entscheidung Emoji->SVG bleiben Emoji an sichtbaren Stellen: Install-Tip 📲 (app.js:487), alle Toast-Texte (✅/🔔/⚠️) und die ungenutzten .ic-Emoji im BADGES-Array. Uneinheitliche Bildsprache.  
  → _Install-Tip und Toasts auf das SVG-Icon-System umstellen (kleines Leading-Icon im Toast); tote .ic-Felder entfernen. Dead-CSS .mode-btn .emoji / .topic-row .emoji ebenfalls aufräumen._
- 🟡 niedrig · **iOS-HIG** (S)  
  Der Custom-Alert modalChoice() hat keine dialog-Semantik (role=dialog/aria-modal), keine Fokusfalle und reagiert nicht auf Escape (app.js:1017). theme-color light #4a72e8 (index.html:10) weicht zudem vom App-Blau #007aff ab.  
  → _role=dialog + aria-modal, Fokus in den Dialog setzen und fangen, Escape=Abbrechen; theme-color an --primary angleichen._

**Top-Features:** Echter Prüfungsmodus (kein Sofort-Feedback, freie Navigation, Flaggen, Sammel-Auswertung) (P1) · Erststart-/Onboarding-Flow + prominentere Anleitung (P1) · Barrierefreiheits-Paket (Zoom aktivieren, ARIA-Rollen/Fokus, reduced-motion, focus-visible) (P2) · Native Zurück-Navigation via History (pushState/popstate) + In-Quiz-Zurück (P2) · Feinschliff der Feedback-Zustände (sichtbares Missed-Häkchen, Reset als Zeile, konsistente Icons/Toasts) (P3)

### Barrierefreiheit (WCAG 2.2, iOS VoiceOver, Dynamic Type)

_Die App hat ein sauberes iOS-Fundament (echte <button>-Elemente, aria-hidden auf dekorativen SVGs, 44pt-Ziele, lang="de"), ist für Screenreader und Tastatur aber noch nicht bedienbar. Zwei strukturelle Probleme stechen heraus: (1) das Quiz rendert bei jedem Klick das gesamte innerHTML neu, wodurch Fokus und VoiceOver-Position verloren gehen, und (2) Auswahl-/Richtig-/Falsch-Zustände sowie Toasts/Feedback werden rein visuell vermittelt (kein aria-pressed/aria-checked, keine Live-Region). Dazu sperrt maximum-scale=1 das Pinch-Zoom und px-basierte Schriftgrößen verhindern Dynamic Type. Die im Backlog geplante Zeile „Barrierefreiheit (P2)" unterschätzt den Umfang deutlich – hier sind mehrere P1-Blocker versteckt._

**Stärken:**
- Interaktive Zeilen sind echte <button>-Elemente (mode-btn, topic-row, opt), nicht angeklickte divs – gute Grundsemantik
- Dekorative SVG-Icons konsequent mit aria-hidden="true" (js/app.js:441); Back-Button hat aria-label="Zurück" (index.html:21)
- lang="de" gesetzt; Tap-Ziele durchgehend >=44px (back-btn 44x44, btn-primary min-height 52px, mode-btn 60px)
- Durchdachtes Light/Dark-Farbsystem mit OLED-Schwarz; Fortschritt textuell als "1 / 15" (q-count) verfügbar
- Native, barrierefreie Bausteine an kritischen Stellen: confirm() beim Quiz-Verlassen, <select> für Erinnerungs-Uhrzeit

**Befunde:**

- 🔴 hoch · **Zoom / Dynamic Type** (S)  
  index.html:5 setzt viewport auf 'maximum-scale=1' – das deaktiviert auf iOS Safari das Pinch-to-Zoom vollständig. Verstoß gegen WCAG 2.2 SC 1.4.4 (Resize Text) und 1.4.10 (Reflow). Nutzer mit Sehschwäche können den Fragentext nicht vergrößern.  
  → _maximum-scale=1 (und ggf. user-scalable=no) aus dem viewport-Tag entfernen. width=device-width, initial-scale=1, viewport-fit=cover reicht._
- 🔴 hoch · **Fokus-Management** (M)  
  renderQuiz() ersetzt bei JEDEM togglePick() und checkCurrent() das komplette app.innerHTML (js/app.js:340, 369, 798ff). Dadurch werden alle Buttons zerstört/neu erzeugt, der Tastatur-Fokus springt zurück zum <body> und VoiceOver verliert die Vorleseposition. Nach jedem Antippen einer Mehrfachauswahl-Option ist man wieder ganz oben – für Tastatur-/SR-Nutzer praktisch unbedienbar. Betrifft auch den geplanten Backlog-Punkt 'Tastatur-Steuerung'.  
  → _Options-Zustände in-place togglen (classList + aria-checked am bestehenden Button setzen) statt neu zu rendern; nach unvermeidbaren Re-Renders Fokus gezielt zurücksetzen (z. B. auf die zuletzt betätigte Option oder die Erklärung mit tabindex=-1 + focus())._
- 🔴 hoch · **Screenreader-Semantik** (M)  
  Die Antwort-Optionen (js/app.js:787) sind <button> ohne aria-pressed/role=radio/checkbox. Ausgewählt/richtig/falsch/verpasst wird nur über Rahmenfarbe, Hintergrund und ein Glyph (✓/✕/●) in einem <span class="box"> vermittelt. VoiceOver liest nur den Optionstext – ob eine Antwort gewählt, richtig oder falsch ist, bleibt unhörbar. Single- vs. Mehrfachauswahl ist ebenfalls nicht semantisch ausgezeichnet.  
  → _Options-Container als role=radiogroup (single) bzw. role=group mit role=checkbox-Buttons, aria-checked pro Option; nach dem Prüfen den Status per aria-label ergänzen (z. B. 'richtig, ausgewählt' / 'richtige Antwort, nicht gewählt'). Das Glyph als aria-hidden markieren._
- 🔴 hoch · **Live-Regionen** (S)  
  Kein einziges aria-live im Projekt. Nach 'Antwort prüfen' erscheinen Richtig/Falsch-Verdikt und Erklärung nur visuell (kein Announce). Der Toast (#toast, js/app.js:993) trägt kein role=status/aria-live – XP-Gewinne, Badge-Freischaltungen und Sync-Status ('Synchronisiert', 'Offline') sind für SR-Nutzer komplett stumm.  
  → _Toast-Element mit role=status und aria-live=polite versehen. Für das Quiz-Feedback eine visually-hidden aria-live-Region (assertive) einführen, in die nach checkCurrent() 'Richtig, +12 XP' bzw. das Verdikt geschrieben wird._
- 🔴 hoch · **Tastatur / Dialog** (M)  
  modalChoice() (js/app.js:1017) baut einen eigenen Overlay-Dialog ohne role=dialog/aria-modal, ohne Fokus in den Dialog zu setzen, ohne Fokusfalle, ohne Escape-Handling und ohne Fokus-Rückgabe beim Schließen. Der Reset- und der 'Verbindung trennen'-Dialog sind für Tastatur- und SR-Nutzer nicht zuverlässig bedienbar; der Fokus bleibt hinter dem Overlay im Seiteninhalt.  
  → _role=dialog + aria-modal=true + aria-labelledby (Titel) setzen, Fokus beim Öffnen auf den ersten Button, Tab-Zyklus im Dialog fangen, Escape = Abbrechen, beim Schließen Fokus auf das auslösende Element zurückgeben._
- 🔴 hoch · **Kontrast** (S)  
  --text-faint (#a3a3ab hell / #6a6a70 dunkel) ergibt auf Kartenweiß nur ~2,5:1 (hell) bzw. ~3,2:1 (dunkel) – klar unter WCAG AA 4,5:1. Betroffen ist u. a. der wichtige Prüfungs-Hinweis '.q-hint' „Es können mehrere Antworten richtig sein… (Prüfungsregel)" (styles.css:194) sowie Badge-Beschreibungen '.badge .bd' (styles.css:262). Auch die farbigen Themen-/Difficulty-Chips (color:${t.color} auf ${t.color}22, js/app.js:805) sind nicht kontrastgeprüft und können bei hellen Themenfarben durchfallen.  
  → _--text-faint auf mind. 4,5:1 anheben (z. B. hell ~#6d6d72, dunkel ~#98989f) oder q-hint/Badge-Text auf --text-dim umstellen. Chip-Textfarben auf einen abgedunkelten Ton der Themenfarbe festlegen und gegen den Tint-Hintergrund prüfen._
- 🟠 mittel · **Reduced Motion** (S)  
  Keine @media (prefers-reduced-motion)-Regel vorhanden. Zahlreiche Animationen laufen ungebremst: XP-Bar-Füllung, @keyframes pop (Ergebnis-Emoji), Ergebnis-Ring stroke-dashoffset 1s (js/app.js:854), Modal-Scale, Update-Banner-Slide, Toast-Slide. Für bewegungsempfindliche Nutzer (WCAG 2.3.3) unangenehm; iOS-Einstellung 'Bewegung reduzieren' wird ignoriert.  
  → _Globalen @media (prefers-reduced-motion: reduce)-Block ergänzen, der transition/animation auf ~0 setzt bzw. den Ring ohne Verlauf direkt füllt._
- 🟠 mittel · **Sichtbarer Fokus** (S)  
  '* { -webkit-tap-highlight-color: transparent }' entfernt das iOS-Highlight; es gibt keinerlei :focus-visible-Stile. Interaktive Elemente signalisieren nur :active (Scale/Opacity). Für die laut Workbook laptop-basierte Prüfung fehlt damit ein deutlicher Tastatur-Fokusring (WCAG 2.4.7).  
  → _Für Buttons/Optionen/Links einen kräftigen :focus-visible-Outline definieren (z. B. outline: 2px solid var(--primary); outline-offset: 2px), gern zusätzlich box-shadow-Ring für die Optionskarten._
- 🟠 mittel · **Überschriften-Struktur** (M)  
  Pro Ansicht existieren zwei H1: das statische Appbar-<h1> (index.html:22) und das Inhalts-<h1 class="large-title">. Im Quiz ist BAR_TITLES.quiz="" (js/app.js:457), sodass updateAppbar ein LEERES <h1> setzt (js/app.js:465) – eine leere Überschrift (WCAG 1.3.1). Zudem sind die Sektionsüberschriften '.section-title' (Üben/Prüfung/Fortschritt) reine <div>s und der Fragentext ist ein <p class="q-text">, keine Überschrift – SR-Nutzern fehlt jede Überschriften-Navigation.  
  → _Nur eine H1 pro View führen (Appbar-Titel als generisches Element ohne h1, oder leeres h1 vermeiden); section-title als <h2>, Fragentext als <h2>/<h3> auszeichnen._
- 🟠 mittel · **Semantik / Tastatur** (S)  
  'Fortschritt zurücksetzen' ist ein <span class="link" data-act="reset"> (js/app.js:526) – ein anklickbares span ohne button-Rolle, nicht per Tab fokussierbar und nicht mit Enter/Space auslösbar. Eine destruktive Aktion ist damit rein per Maus/Touch erreichbar.  
  → _In ein <button class="link"> umwandeln (oder role=button + tabindex=0 + keydown-Handler) und als destruktiv kennzeichnen._
- 🟠 mittel · **Dynamic Type / Skalierung** (L)  
  html/body font-size:17px und praktisch alle Größen sind fest in px (styles.css:56 u. v. m.). Web-Inhalte reagieren so nicht auf die iOS-Textgröße/Dynamic Type und – zusammen mit dem Zoom-Lock aus Finding 1 – auch nicht auf eine größere Browser-Standardschrift (WCAG 1.4.4). Der Backlog-Punkt 'größere Schrift wählbar' greift damit zu kurz, solange Basisgröße/Layout nicht relativ sind.  
  → _Basis auf rem umstellen (html { font-size: 100% }), Textgrößen in rem/em; optional font: -apple-system-body für echte Dynamic-Type-Kopplung. Layout mit min-height statt fixer Höhen prüfen, damit vergrößerter Text nicht abgeschnitten wird._
- 🟡 niedrig · **Statusanzeige** (S)  
  Fortschrittsbalken (.xp-bar, .progress-track) und der Ergebnis-Ring haben keine role=progressbar / aria-valuenow. Die Streak-Pille #streakVal rendert nur Flamme+Zahl; VoiceOver liest bloß '0' ohne Kontext ('Serie: 0 Tage').  
  → _Fortschrittsbalken mit role=progressbar/aria-valuenow/valuemin/valuemax oder einem visually-hidden Text versehen; Streak-Pille per aria-label='Tagesserie: N Tage' beschriften._

**Top-Features:** Quiz ohne Fokusverlust bedienbar machen (In-place-Toggle statt Full-Re-Render + Fokus-Handling) (P1) · Zoom-Sperre lösen + Optionen/Feedback screenreader-fähig (maximum-scale raus, aria-pressed/aria-checked, aria-live für Verdikt & Toasts) (P1) · Tastaturvollständigkeit: sichtbarer :focus-visible-Ring, Modal mit Fokusfalle/Escape, Reset-span zu Button (P2) · Kontrast- & Reduced-Motion-Feinschliff + Dynamic Type (rem, echte Skalierbarkeit) (P2)

### Software-Architektur & Code-Qualitäts-Review

_js/app.js ist ein 1176-Zeilen-Monolith, der Datenvalidierung, Persistenz, Sync-/Push-Client, Gamification, Quiz-Engine, komplettes UI-Rendering, Navigation und Bootstrap in einer Datei mit globalem Scope vermischt. Die Robustheit (Fehler-Boundary, Sanitisierung, Migrations-Gerüst, Sync-Retry) ist überdurchschnittlich sauber gelöst und verdient Lob. Die zentrale Wartbarkeits-Schwäche ist die fehlende Abstraktion der Fragetypen: die geplanten Rechen-/Freitext-Aufgaben (P1 im Backlog) lassen sich nicht additiv einbauen, sondern erzwingen Änderungen an fünf verstreuten Stellen (DATA_OK, buildSession, togglePick, checkCurrent, renderQuiz). Es gibt zudem keinerlei Testbarkeit für die Kernlogik, da diese fest an DOM-Globale gekoppelt und nicht exportiert ist._

**Stärken:**
- Vorbildliche Robustheit: Fehler-Boundary in go() (app.js:966) verhindert Weißbild-Absturz, sanitizeState/clampInt (app.js:66) härtet gegen defekten localStorage, Migrations-Gerüst (app.js:42) hält Lernstände zukunftssicher.
- Sync-Schicht (js/sync.js) ist sauber gekapselt, exportiert eine klare API über window.ADTSync und ist die einzige wirklich unit-testbare Einheit; mergeStates ist als reine Funktion isoliert.
- Durchdachte Sync-Härtung: Retry mit exponentiellem Backoff nur für transiente Fehler (sync.js:128), Pending-Flag für Offline, monotone verlustarme Merge-Strategie mit Neuberechnung der Gesamtzähler aus perQuestion.
- Konsequentes HTML-Escaping über esc() an den dynamischen Textstellen, saubere schemaVersion-Verwaltung, stabiler Storage-Key laut Entscheidungs-Log.
- Sofort-Speichern bei pagehide/visibilitychange (app.js:1122) sichert Fortschritt zuverlässig auch unter iOS-Timer-Einschränkungen.

**Befunde:**

- 🔴 hoch · **Erweiterbarkeit / Fragetypen** (L)  
  Der Fragetyp ist nicht abstrahiert. Die Annahme 'Frage = options[] + correct[]-Indizes + Alles-oder-Nichts' steckt hartcodiert in DATA_OK (app.js:14-17), buildSession/optionOrders (app.js:320), togglePick (app.js:334), checkCurrent (app.js:347-350) und renderQuiz (app.js:777). Der geplante Freitext/Zahl-Aufgabentyp (Backlog P1, workbook.md:80) hat gar kein options-Array – DATA_OK würde ihn sofort als ungültig ablehnen, und Eingabe/Bewertung/Rendering fehlen komplett.  
  → _Vor dem nächsten Inhalts-Ausbau ein Strategy-Muster einführen: pro type ein Handler-Objekt {validate(q), buildState(q), renderInput(q,state), grade(q,state)}. buildSession/checkCurrent/renderQuiz rufen nur noch den Handler des jeweiligen Typs auf. Das macht neue Typen (Freitext, Zahl, Zuordnung) additiv statt invasiv._
- 🟠 mittel · **Modularität / Monolith** (L)  
  js/app.js bündelt ~10 Verantwortlichkeiten in einer Datei ohne Modulgrenzen, alles im globalen Scope (S, SESSION, VIEW als Globale). Persistenz, Push-Client, Gamification, Quiz-Engine und das gesamte String-basierte UI sind eng verwoben; jede Änderung erfordert Navigation durch die ganze Datei.  
  → _In ES-Module aufteilen: state.js (Load/Save/Migrate/Sanitize), gamification.js (BADGES/XP/Level/Streak), quiz.js (Engine, DOM-frei), ui/*.js (Render-Funktionen), push.js, bootstrap.js. Über <script type="module"> laden (bleibt framework-frei). Ermöglicht gezieltes Testen und Review._
- 🟠 mittel · **Testbarkeit** (M)  
  Keine Testinfrastruktur für Kernlogik. levelForXp, sanitizeState, migrate, buildSession, checkCurrent, checkBadges, weakQuestions sind an DOM-Globale (app, actionbar, document.getElementById auf Modulebene, app.js:396) gekoppelt und werden nicht exportiert – rein logische Regeln lassen sich nicht ohne Browser prüfen. Backlog nennt nur einen Fragen-Konsistenz-Check (P3), aber keine Logik-Tests.  
  → _Reine Logik von DOM trennen und exportieren, dann Node-Tests (node:test) für Level-Kurve, Merge (bereits testbar), Sanitisierung, Alles-oder-Nichts-Bewertung und Badge-Auslöser. Zusätzlich das im Backlog geplante Fragen-Validierungsskript als CI-Schritt._
- 🟠 mittel · **Robustheit / Datenvalidierung** (S)  
  DATA_OK validiert difficulty nicht. difficulty fließt ungeprüft in XP (10 + (q.difficulty-1)*5, app.js:363) und in einen Array-Index (['','leicht','mittel','schwer'][q.difficulty], app.js:774). Fehlt oder ist es nicht-numerisch, wird S.xp zu NaN, sofort als 'NaN' auf der Startseite gerendert und beim nächsten Laden von clampInt auf 0 zurückgesetzt – realer XP-Verlust durch eine einzige fehlerhafte Frage.  
  → _In DATA_OK difficulty auf Integer 1-3 und type auf ['single','multi'] prüfen (auch explanation-Existenz). Zusätzlich in checkCurrent den XP-Gewinn defensiv über Number.isFinite absichern._
- 🟠 mittel · **Duplikation / Code-Smell** (S)  
  Das SESSION-Objektschema wird an drei Stellen inline dupliziert: buildSession (app.js:322) und der 'Falsche wiederholen'-Handler (app.js:875), der zuerst buildSession('mixed') aufruft und das Ergebnis sofort wegwirft ('Basis, dann überschreiben'). Ändert sich die Session-Struktur (z. B. für den geplanten Prüfungsmodus mit Timer/Flags), müssen alle Stellen synchron angepasst werden.  
  → _Eine Factory makeSession(mode, questions, opts) einführen, die das Session-Objekt an einer einzigen Stelle erzeugt. buildSession und der Wiederholen-Pfad rufen nur noch diese Factory._
- 🟠 mittel · **Zustandsverwaltung** (M)  
  Kein Persistieren der laufenden SESSION – Position, Antworten und Fortschritt im Quiz leben nur im Speicher. Ein Reload/App-Kill mitten im Quiz verwirft die Sitzung. Der geplante echte Prüfungsmodus (180-Min-Timer, Navigation/Flaggen, Backlog P1, workbook.md:85) setzt Session-Persistenz zwingend voraus, die die aktuelle Architektur nicht vorsieht.  
  → _SESSION als eigenen, serialisierbaren Sub-State (separater localStorage-Key, nicht in den geheiligten Fortschritts-Key mischen) entwerfen, sobald der Prüfungsmodus ansteht. Jetzt schon die Session-Erzeugung so kapseln, dass Serialisierung später leicht ergänzbar ist._
- 🟡 niedrig · **Rendering-Muster** (M)  
  Jede Interaktion löst ein vollständiges innerHTML-Neurendern samt erneutem Binden aller Event-Listener aus – renderQuiz() wird bei jedem Options-Tap komplett neu aufgebaut (app.js:340). Bei größerem Fragenbestand/komplexeren Typen skaliert das schlecht und kostet Fokus/Scrollposition; die Verflechtung von Logik und Markup erschwert Reviews.  
  → _Für Interaktions-Updates gezielte DOM-Mutation statt Voll-Rerender (z. B. nur die betroffene Option umklassen) und Event-Delegation auf dem Container statt Rebinding. Optional eine schlanke render()-Diff-Hilfe, framework-frei._
- 🟡 niedrig · **Konsistenz / Lesbarkeit** (S)  
  Der Badge-Test 'master' (app.js:263) ist unnötig verschachtelt: Object.values(TOPICS).some((_, i) => topicMastered(Object.keys(TOPICS)[i])) statt schlicht Object.keys(TOPICS).some(topicMastered). Zudem erschweren Ein-Buchstaben-Globale (S für den gesamten Zustand) Greppbarkeit; topicStats und topicMastered duplizieren die 'Fragen nach Thema filtern + correct>=1 zählen'-Logik.  
  → _master-Test vereinfachen; topicMastered auf Basis von topicStats formulieren (mastered === total); S in einen sprechenderen Namen (z. B. state) umbenennen, sobald Module eingeführt werden._
- 🟡 niedrig · **Konsistenz der Zähler** (S)  
  totalAnswered/totalCorrect werden lokal als laufende Zähler in checkCurrent inkrementiert (app.js:359), nach einem Sync-Merge jedoch aus max(perQuestion.seen) neu berechnet (sync.js:91-94). Die beiden Semantiken (Zahl der Versuche vs. Summe der Maxima) können nach einem Merge divergieren, wodurch die angezeigte Trefferquote leicht springt.  
  → _Eine Quelle der Wahrheit festlegen: totalAnswered/totalCorrect immer aus perQuestion ableiten (auch lokal nach checkCurrent), statt sie parallel zu führen. Beseitigt die Divergenz und eine Klasse subtiler Inkonsistenzen._

**Top-Features:** Fragetyp-Abstraktion (Strategy/Handler-Registry) vor dem Inhalts-Ausbau (P1) · Modul-Split von app.js + Export der reinen Logik (P1) · Test-Harness für Kernlogik + Fragen-CI-Check (P2)

### Performance- & PWA/Offline-Spezialist/in

_Die PWA ist offline-solide gebaut: atomarer Precache, durchdachte Fehler-Boundaries, nutzerbestätigtes Update und eine saubere network-first/cache-first-Trennung. Die zwei größten realen Risiken sind (1) cache-first für app.js/styles.css in Kombination mit manueller Cache-Versionierung – vergisst man das Hochzählen, bekommen Nutzer dauerhaft veralteten Code, und (2) network-first ohne Fetch-Timeout, wodurch der App-Start bei „lie-fi" (verbunden, aber kein Durchsatz) hängt statt sofort aus dem Cache zu liefern. Für die im Backlog geplante Fragen-Erweiterung (P1: offizielle Fragen einarbeiten) skalieren die wiederholten QUESTIONS.filter-Scans und der network-first-Blocking-Load von questions.js schlecht._

**Stärken:**
- Atomarer Precache via addAll + activate-Cleanup alter Caches: sauberer, klassischer PWA-Offline-Kern (sw.js:19-23, 57-61).
- Update-Fluss vorbildlich: kein automatisches skipWaiting, In-App-Banner, controllerchange-Reload nur nach Nutzerbestätigung (kein Reload-Loop) – app.js:1000-1014, 1170-1173.
- Durchdachte network-first/cache-first-Trennung: Konfig/Fragen frisch, App-Shell schnell (sw.js:70-90) – gut dokumentierte Entscheidung im workbook.
- Kein Framework/CDN-Zwang: reines Vanilla-JS lädt ohne externe Requests, gut für Offline und Langlebigkeit.
- Offline-Sync-Härtung: pending-Flag, Retry/Backoff nur bei transienten Fehlern, sofortiges flushSave bei pagehide/visibilitychange (app.js:1122-1123) – nichts geht beim Backgrounden verloren.
- Cross-Origin-Schutz im Cache: nur res.type === 'basic' wird nachgecacht (sw.js:85), verhindert Cache-Poisoning durch opaque Responses.

**Befunde:**

- 🔴 hoch · **Service Worker – Cache-Strategie** (M)  
  app.js (64KB) und styles.css sind cache-first ohne Revalidierung (sw.js:82-89). Ein cache-first-Treffer wird nie im Hintergrund aktualisiert – frischer Code erreicht Nutzer NUR, wenn CACHE manuell hochgezählt wird (aktuell v7, sw.js:3). Vergisst man das beim Deploy, laufen Nutzer dauerhaft auf altem JS/CSS. Das ist die klassische PWA-Update-Falle und die fragilste Stelle der App.  
  → _Auf stale-while-revalidate für App-Shell-Assets umstellen: cached sofort ausliefern UND parallel network holen, um den Cache für den nächsten Start zu aktualisieren. Dann entfällt das manuelle Versionieren als Fehlerquelle. Alternativ ein Mini-Build-Step mit content-hashed Dateinamen (app.[hash].js) – dann ist cache-first korrekt und ein Deploy invalidiert automatisch._
- 🔴 hoch · **Service Worker – Offline-Robustheit** (S)  
  network-first (Navigation, config.js, questions.js) nutzt fetch(e.request) ohne Timeout (sw.js:78-80). Bei 'lie-fi' (Handy zeigt Verbindung, aber kein Durchsatz – im Zug/Klinik häufig) blockiert der Fetch bis zum Browser-Default (zig Sekunden), bevor der Cache-Fallback greift. Der App-Start hängt, obwohl offline-Daten sofort verfügbar wären. Lie-fi ist praktisch schlimmer als sauberes Offline.  
  → _Im network-first-Zweig fetch gegen ein Timeout racen (Promise.race mit ~3-4s bzw. AbortController); bei Timeout auf caches.match zurückfallen. So ist der Start immer schnell und Updates greifen nur, wenn das Netz wirklich liefert._
- 🟠 mittel · **Rendering-Effizienz bei wachsender Fragenzahl** (M)  
  Abgeleitete Werte werden bei jedem Render per Voll-Scan neu berechnet: weakQuestions() (app.js:292-294) und topicStats()/topicMastered() filtern QUESTIONS bei jedem Aufruf. renderTopics ruft topicStats pro Thema (9× Voll-Filter), renderHome ruft weakQuestions(), checkBadges ruft topicMastered. Bei 55 Fragen egal – aber Backlog-P1 will offizielle Fragen einarbeiten (Richtung hunderte/1000). Dann werden Home/Themen zu wiederholten O(Themen×Fragen)-Scans bei jeder Interaktion.  
  → _Einmal beim Laden einen Index QUESTIONS_BY_TOPIC aufbauen (group-by topic) und weak-Set/Topic-Stats memoisieren, invalidiert nur bei saveState. topicStats/weakQuestions/topicMastered dann über den Index statt Voll-Filter._
- 🟠 mittel · **Service Worker – Startlatenz** (S)  
  questions.js ist network-first (sw.js:74-75) und wird als synchrones <script> geladen (index.html:32). Bei jedem Online-Start wartet die App auf den Netz-Download der 36KB (wächst mit dem geplanten Fragen-Ausbau stark), bevor gerendert wird – obwohl eine gecachte Version bereitläge. Freshness wird hier mit Startlatenz erkauft.  
  → _questions.js/config.js auf stale-while-revalidate umstellen: gecachte Version sofort ausliefern (schneller Start), im Hintergrund aktualisieren, Update greift beim nächsten Start. Für eine Lern-App ist Fragen-Frische bis zum nächsten Öffnen völlig ausreichend._
- 🟠 mittel · **Service Worker – Precache-Resilienz** (S)  
  install nutzt cache.addAll(ASSETS) (sw.js:22). addAll ist atomar: schlägt EINE einzige Ressource fehl (z.B. ein umbenanntes Icon, ein Tippfehler in der Liste, ein 404), scheitert die komplette Installation und es gibt gar keinen Offline-Cache. Die Liste enthält 12 fest verdrahtete Pfade – fragil bei künftigen Umbenennungen.  
  → _Kritische Shell (index.html, app.js, styles.css) atomar via addAll cachen; optionale/größere Assets (Icons) einzeln mit Promise.allSettled + cache.add nachladen, damit ein einzelner Fehler die Offline-Fähigkeit nicht komplett kippt._
- 🟠 mittel · **PWA – Update-Erkennung** (S)  
  Der SW prüft nur bei Registrierung/Navigation auf Updates; es gibt keinen periodischen reg.update()-Aufruf. Eine installierte Standalone-PWA (iOS hält sie lange am Leben) zeigt das Update-Banner erst nach vollständigem Neustart – bei tagelanger Nutzung sehen Nutzer neue Versionen verzögert.  
  → _Bei visibilitychange (App kommt in den Vordergrund) und/oder in einem längeren Intervall reg.update() aufrufen. Vorhandene updatefound/waiting-Logik (app.js:1157-1165) zeigt dann das Banner auch in langlebigen Sessions._
- 🟠 mittel · **Zugänglichkeit / Viewport** (S)  
  index.html:5 setzt maximum-scale=1 – das unterbindet Pinch-Zoom in Safari. Für eine Prüfungs-Lern-App mit viel Text und dem eigenen Backlog-Punkt 'Barrierefreiheit' (workbook Zeile 104) ist das Zoom-Verbot ein konkreter A11y-Regress.  
  → _maximum-scale=1 entfernen (viewport-fit=cover reicht für Safe-Areas). Zoom wieder zulassen; das iOS-Layout bleibt dank responsivem CSS stabil._
- 🟡 niedrig · **Rendering – Quiz-Interaktion** (M)  
  Jeder Options-Tap ruft renderQuiz(), das die komplette Quiz-Karte per app.innerHTML neu aufbaut und alle Event-Listener neu bindet (app.js:334-341, 767-830). Bei jeder Auswahl wird der gesamte Teilbaum verworfen und neu erzeugt – funktional ok bei kurzen Fragen, aber verschwenderisch und verliert bei langen Optionslisten kurz den Fokus/Scroll.  
  → _togglePick nur die betroffene Option-CSS-Klasse und den Prüfen-Button-Zustand umschalten lassen, statt der Voll-Render. Event-Delegation an .options-Container statt pro-Button-Listener._
- 🟡 niedrig · **Speicher – localStorage** (S)  
  persistLocal fängt QuotaExceeded ab und gibt false zurück (app.js:107-110), aber der Nutzer erfährt nie, dass sein Fortschritt gerade NICHT gespeichert wird. Bei wachsender perQuestion-Map (skaliert mit Fragenzahl) plus anderer Keys unwahrscheinlich, aber im Fehlerfall still.  
  → _Bei persistLocal-Fehlschlag einen dezenten toast('Speicher voll – Fortschritt evtl. nicht gesichert') zeigen und optional Export anbieten. Zusätzlich denkbar: perQuestion nur für gesehene Fragen speichern (ist bereits der Fall) – passt._
- 🟡 niedrig · **Service Worker – Fetch-Scope** (S)  
  Der fetch-Handler verarbeitet alle GET-Requests inkl. Cross-Origin (sw.js:70). Cross-Origin-GETs landen im cache-first-Zweig (caches.match-Miss → fetch), und der Offline-Fallback liefert bei jedem gescheiterten Nicht-Navigations-Request caches.match('./index.html') zurück (sw.js:87) – also HTML mit falschem Content-Type für z.B. ein fehlgeschlagenes Bild/Script.  
  → _Früh return, wenn url.origin !== self.location.origin (fremde Hosts nicht anfassen). Den index.html-Fallback nur für Navigations-Requests verwenden, nicht für beliebige Sub-Ressourcen._
- 🟡 niedrig · **PWA – iOS-Startdarstellung** (S)  
  Es sind keine apple-touch-startup-image / Splash-Screens definiert. Beim Start der installierten PWA auf iOS erscheint dadurch kurz ein weißer/leerer Bildschirm, bis JS gerendert hat – wirkt weniger nativ als das sonst sorgfältige iOS-Design.  
  → _Optional Launch-Screens hinterlegen oder wenigstens den body-Hintergrund per inline-CSS sofort auf background_color (#0f1320) setzen, damit kein weißer Blitz entsteht._

**Top-Features:** Stale-while-revalidate für App-Shell + periodischer reg.update() (P1) · Fragen-Index & memoisierte abgeleitete Werte (Skalierung) (P1) · Fetch-Timeout im network-first-Zweig (lie-fi-Resilienz) (P2) · Minimaler Build-Step (Minify + content-hashed Dateinamen) (P2)

### Security- & Datenschutz-Expertin (DSGVO, Gesundheits-/Prüfungsdaten)

_Die Architektur ist für eine No-Login-App überraschend solide: RLS ist auf beiden Tabellen aktiv, Direktzugriff ist gesperrt, der Zugriff läuft ausschließlich über SECURITY-DEFINER-Funktionen mit fixiertem search_path, und der Sync-Code hat mit ~74 Bit Entropie genug, dass reines Durchprobieren praktisch ausscheidet. Die realen Lücken liegen weniger in der Krypto als im Betrieb und in der DSGVO: es gibt keinerlei Datenschutzerklärung/Einwilligung, keine serverseitige Rate-Begrenzung, die Payload-/Code-Härtung ist nur „optional" dokumentiert, die Push-RPCs sind völlig ungebremst, und es existiert keine Lösch-/Aufbewahrungslogik. Für eine öffentlich gehostete Lernapp im Gesundheitskontext sind das die vordringlichen Baustellen._

**Stärken:**
- RLS auf progress und push_subscriptions aktiviert, keine Policies = kein Direktzugriff; Zugriff nur über RPCs (reminders-setup.sql:15, README:67).
- Alle RPCs sind SECURITY DEFINER mit 'set search_path = public' — schützt gegen search_path-Hijacking (reminders-setup.sql:20, README:71).
- Sync-Code kryptografisch via crypto.getRandomValues, 15 Zeichen aus 31er-Alphabet ohne Verwechsler = ~74 Bit Entropie; Brute-Force-Enumeration praktisch ausgeschlossen (sync.js:37-47).
- Trennung öffentlich/geheim ist korrekt verstanden: anon-/publishable-Key und VAPID-Public dürfen ins Repo, der private VAPID-Key nur als Edge-Function-Secret (config.js:18-23, index.ts:8).
- Client erzwingt HTTPS-Supabase-URL per Regex (sync.js:26).
- Edge Function ist per x-cron-secret gegen offenen Aufruf geschützt und räumt abgelaufene Endpunkte (404/410) selbst auf (index.ts:39,69-71).
- Defensive sanitizeState()/clampInt gegen manipulierte Remote-Zustände beim Merge (app.js:66-91) — reduziert Risiko aus fremdbeschriebenen Cloud-Daten.

**Befunde:**

- 🔴 hoch · **DSGVO / Transparenz & Einwilligung** (M)  
  Es gibt nirgends eine Datenschutzerklärung, kein Impressum und keinen Consent-Schritt. Vor dem ersten Cloud-Upload (createSyncCode/runSync, app.js:696) und vor Push-Aktivierung (enableReminders, app.js:176) werden personenbezogene Daten (Lernfortschritt, Geräte-Endpoint, Zeitzone) an Supabase übertragen, ohne Information nach Art. 13 DSGVO und ohne dokumentierte Einwilligung. Der einzige Treffer zu 'Datenschutz' im Code ist ironischerweise ein Quiz-Thema, keine Policy. Auch ein AVV-Hinweis (Auftragsverarbeitung Supabase) und die Info, dass GitHub Pages IPs loggt, fehlen. Im Backlog nicht adressiert.  
  → _Kurze Datenschutzerklärung + Impressum ergänzen (welche Daten, Zweck, Speicherort/Region, Aufbewahrung, Löschung, Rechtsgrundlage). Vor erstem Cloud-Sync und vor Push je einen expliziten Einwilligungs-Dialog (modalChoice ist vorhanden) mit Kurztext + Link zur Policy. AVV mit Supabase abschließen und im README vermerken._
- 🔴 hoch · **Supabase RPC / Missbrauch** (M)  
  sync_pull und sync_push sind an 'anon' granted und haben KEINE Rate-Begrenzung. Ein Angreifer kann beide Endpunkte beliebig oft aufrufen (Enumeration/Kostentreiben/Datenzerstörung). Die Größen- und Code-Längen-Härtung von sync_push ist in der README nur als 'Optionale Härtung (empfohlen)' beschrieben (README:112-133) — die im Haupt-Snippet (README:75-82) gezeigte und vermutlich deployte Variante validiert p_code/p_data überhaupt nicht. Zusätzlich exponiert die Client-API codeExists() (sync.js:201) ein Existenz-Orakel.  
  → _Härtung (Code-Längen-Check + pg_column_size-Limit) zur PFLICHT machen, nicht optional. Serverseitiges Rate-Limiting ergänzen (z. B. Zähltabelle pro Code/Zeitfenster in der Funktion, oder Supabase Edge/Gateway-Limit). codeExists nicht anbieten bzw. den Connect-Flow ohne Existenzprüfung belassen (tut er bereits — API entfernen)._
- 🟠 mittel · **Push-Endpunkte** (M)  
  push_save und push_remove sind an 'anon' granted, ohne jede Ratenbegrenzung, ohne Größenlimit auf p_sub (jsonb) und ohne Bindung an den Sync-Code/Besitzer. Der Push-Endpoint ist die einzige 'Capability': Wer einen Endpoint kennt, kann per push_remove fremde Erinnerungen löschen oder per push_save deren Uhrzeit/tz/sub überschreiben (reminders-setup.sql:19-41). Endpunkte sind zwar schwer zu erraten, aber es gibt keine zweite Schranke und keinen Schutz gegen massenhaftes Anlegen von Müll-Datensätzen.  
  → _In push_save Länge/Struktur von p_sub und p_endpoint validieren und pg_column_size begrenzen; Rate-Limiting pro Endpoint/IP-Fenster. Optional Endpoint an den Sync-Code koppeln (Spalte code), damit Löschen/Ändern eine zweite Kenntnis voraussetzt. Anzahl Subscriptions pro Zeitfenster deckeln._
- 🟠 mittel · **DSGVO / Datenminimierung & Speicherbegrenzung** (M)  
  Keinerlei Aufbewahrungs-/Löschlogik: progress-Datensätze verwaister Sync-Codes bleiben unbegrenzt (kein TTL trotz vorhandenem updated_at, README:63). push_subscriptions werden nur bei 404/410 bereinigt (index.ts:69); dauerhaft inaktive Geräte bleiben liegen. Gespeicherte tz (Zeitzone) ist ein Standort-/Personenbezugs-Indiz und wird zusammen mit stabilem Endpoint + created_at zu einem Geräte-Fingerabdruck. Verstoß gegen Art. 5(1)(e) Speicherbegrenzung / (c) Datenminimierung.  
  → _Retention-Job (pg_cron) der progress-Zeilen nach z. B. 12-24 Monaten Inaktivität löscht und stale push_subscriptions abräumt. tz auf das Nötigste reduzieren (Stunde+UTC-Offset statt voller IANA-Zone genügt für den Versand). In-App-Funktion 'Cloud-Daten endgültig löschen' (Recht auf Löschung, Art. 17) statt nur 'Verbindung trennen' (app.js:618, löscht nur lokal den Code)._
- 🟠 mittel · **DSGVO / Drittlandtransfer** (S)  
  Die Supabase-Region wird nicht erzwungen, README sagt nur 'Region z. B. Europe' (README:54). Wird das Projekt außerhalb der EU (z. B. us-east) angelegt, entsteht ein Drittlandtransfer personenbezogener Daten, der SCC/zusätzliche Garantien erfordert.  
  → _EU-Region verbindlich vorschreiben (README + Einrichtungs-Checkliste), Transfer/Region in der Datenschutzerklärung benennen. Falls je US-Region genutzt wird: SCC dokumentieren._
- 🟡 niedrig · **Sync-Code / Capability-Modell** (M)  
  Der Code ist reine Bearer-Capability ohne Read/Write-Trennung: Wer ihn kennt, kann via overwriteRemote()/Reset (sync.js:147, app.js:1052) den Cloud-Fortschritt eines anderen zerstören. Der Merge ist zwar monoton (max/Union, sync.js:59-104) und damit verlustarm, aber overwriteRemote umgeht den Merge. Zusätzlich akzeptiert der Client beim Verbinden bereits Codes ab 8 Zeichen (app.js:723), während generierte Codes 74 Bit haben — Inkonsistenz, die schwache/kurze Fremdcodes zulässt. Kleiner Nebenpunkt: bytes[i] % alphabet.length erzeugt minimalen Modulo-Bias (vernachlässigbar).  
  → _overwriteRemote nur nach ausdrücklicher Bestätigung und nicht ohne vorherigen Pull nutzen; Reset-Cloud klar als destruktiv kennzeichnen. Server-seitige Mindestlänge (>=16) im sync_push-Guard erzwingen, damit kurze Codes gar nicht erst angelegt werden. Modulo-Bias durch Rejection-Sampling entfernen (kosmetisch)._
- 🟡 niedrig · **Defense-in-Depth / Stored-Content** (S)  
  sanitizeState() clamped Zahlenwerte, übernimmt aber Objekt-KEYS (Badge-IDs, perQuestion-IDs) aus Remote-Daten unverändert (app.js:91: s.badges[k] = rawBg[k]). Aktuell werden diese Keys nur für Lookups/Counts genutzt, nicht per innerHTML gerendert — daher kein akuter XSS. Sobald aber je fremde Keys in innerHTML landen (die App nutzt innerHTML durchgängig), würde ein via fremdem Code überschriebener Cloud-Zustand zum Stored-XSS-Vektor.  
  → _Badge- und Frage-IDs beim Merge/Pull gegen die bekannten Whitelists (BADGES, QUESTIONS) filtern und unbekannte Keys verwerfen. Grundsätzlich beim Rendern von Remote-abgeleiteten Strings esc() konsequent einsetzen._
- 🟡 niedrig · **Betrieb / Edge Function** (S)  
  Die Edge Function ist mit --no-verify-jwt deployt (index.ts:14), also öffentlich aufrufbar; einzige Schranke ist der Header-Vergleich x-cron-secret (index.ts:39). Bei schwachem/geleaktem CRON_SECRET kann jeder den Versand anstoßen. Der VAPID_SUBJECT-Default 'mailto:reminders@adt-trainer.app' (index.ts:26) verweist auf eine evtl. nicht existente Domain, was Push-Provider zurückweisen können.  
  → _CRON_SECRET-Anforderung (hohe Entropie, geheim halten) im README explizit machen; Secret rotierbar dokumentieren. VAPID_SUBJECT auf eine reale, kontaktierbare mailto:-Adresse setzen._

**Top-Features:** Datenschutzerklärung + zweistufige Einwilligung (Cloud-Sync / Push) (P1) · Pflicht-Härtung + Rate-Limiting aller anon-RPCs (sync_pull/push, push_save/remove) (P1) · Lösch- & Aufbewahrungslogik (Retention-Job + In-App 'Cloud-Daten löschen') (P2) · EU-Region verbindlich + Datenminimierung der Push-Tabelle (tz reduzieren) (P3)

### Lernwissenschaft (Kognitionspsychologie & Instructional Design)

_Die App implementiert solide Grundlagen des Retrieval-Learnings mit sofortiger, elaborierter Rueckmeldung und interleavtem Mischtraining - eine gute Basis. Der entscheidende Schwachpunkt fuer echtes Behalten ist das Fortschritts- und Belohnungsmodell: "Gemeistert = einmal richtig erkannt" ueberschaetzt Koennen systematisch, es gibt keine verteilte Wiederholung (Spaced Repetition) und nur Wiedererkennen (MC) statt (Re-)Produktion - beides zusammen erzeugt eine Kompetenz-Illusion. Metakognition/Selbsteinschaetzung (Konfidenz, Kalibrierung) fehlt vollstaendig, und bei nur 55 statischen Items belohnt die Gamification reines Wiederholen derselben Fragen statt Verstehen._

**Stärken:**
- Elaborierte, kontrastierende Erklaerungen: fast jede Erklaerung sagt nicht nur WAS richtig ist, sondern WARUM und grenzt gegen die Distraktoren ab (z. B. tnm-005 R vs. r, ico-003 Verhaltenscodes, epi-003 Mortalitaet/Letalitaet). Didaktisch hochwertiges korrigierendes Feedback - echter Anker.
- Sofortiges korrektives Feedback nach jeder Frage (checkCurrent -> explain, app.js:792) - lernwirksam fuer die Fehlerkorrektur.
- Interleaving ist real umgesetzt: 'Gemischtes Training' zieht themenuebergreifend (buildSession('mixed')) - der lernwirksamere Default gegenueber Blocktraining.
- Antwortoptionen werden pro Frage gemischt (optionOrders, app.js:320) - verhindert Auswendiglernen von Positionen statt Inhalten.
- Fehlerfreundliche Belohnung: auch falsche Antworten geben +2 XP 'fuers Ueben' (app.js:363). Senkt die Huerde fuer Low-Stakes-Retrieval, stuetzt Fehlerkultur.
- Farbkodiertes Multi-Feedback (correct/missed/wrong, app.js:783-785) unterstuetzt die Selbstdiagnose einzelner Teilantworten.
- Alles-oder-nichts-Wertung bildet die reale Pruefungsregel authentisch ab (transferfoerdernd, weil pruefungsnah).

**Befunde:**

- 🔴 hoch · **Mastery-Definition / Metakognition** (M)  
  'Gemeistert' wird als ein einziges korrektes Wiedererkennen definiert (topicMastered/topicStats verlangen p.correct>=1, app.js:268 und 285). Ein einmaliger MC-Treffer - moeglicherweise geraten oder per Distraktor-Ausschluss - markiert eine Frage/ein Thema dauerhaft als beherrscht und ist irreversibel (der Zaehler sinkt nie). Das ueberschaetzt das Behalten massiv, verfaelscht Fortschrittsbalken, Themen-Prozente und das 'Themen-Meister'-Badge und gibt dem Lernenden ein falsches Sicherheitsgefuehl (Illusion of Knowing).  
  → _Koennens-Status mehrstufig modellieren statt binaer: z. B. Leitner-Box-Level pro Item; 'sitzt sicher' erst nach 2-3 korrekten Abrufen mit zeitlichem Abstand (nicht in derselben Session). Getrennt anzeigen: gesehen / geuebt / sicher. Bei einem spaeteren Fehler faellt das Item zurueck. So spiegelt der Fortschritt echte Retention._
- 🔴 hoch · **Spaced Repetition / Verteiltes Lernen** (L)  
  Es gibt keinerlei zeitlich gesteuerte Wiederholung. Der Modus 'Schwachstellen' (weakQuestions, app.js:293) ist nur ein statischer Filter (nie richtig ODER zuletzt falsch); sobald ein Item einmal richtig war, verschwindet es dauerhaft aus dem Uebungsfokus - genau entgegen der Vergessenskurve. Kein 'heute faellig', keine Abstands-Intervalle. Steht als P1 im Backlog; hier bestaetigt und geschaerft.  
  → _Leitner-/SM-2-artige Faelligkeitslogik einfuehren (naechstes Faelligkeitsdatum je Item, Intervall waechst bei Erfolg, faellt bei Fehler). Startseite zeigt 'X heute faellig'. Push-Erinnerungen an die Faelligkeit koppeln, nicht an blosse Uhrzeit. Direkt mit der neuen Mastery-Logik verzahnen._
- 🔴 hoch · **Aufgabenformat / Generation Effect** (L)  
  Ausschliesslich Wiedererkennen (Single/Multiple-Choice). Wiedererkennen erzeugt fluessige Vertrautheit, aber schwaechere Abrufpfade als freie (Re-)Produktion und foerdert Ueberkonfidenz. Fuer ein Kodier-/Doku-Berufsbild (TNM-Praefixe bilden, ICD-O-Verhaltenscode /x, Raten berechnen) ist aktive Produktion die eigentliche Zielkompetenz. Freitext/Zahl steht als P1 im Backlog - hier lernpsychologisch begruendet und priorisiert.  
  → _Produktions-/Cued-Recall-Items ergaenzen: Zahl-/Code-Eingabe (Inzidenzrate, /-Verhaltenscode, Praefix) mit Loesungsschluessel; oder 'erst selbst denken, dann aufdecken'-Karten. Nutzt den Generation Effect und bricht die MC-Kompetenz-Illusion._
- 🔴 hoch · **Metakognition / Kalibrierung** (M)  
  Es gibt keine Selbsteinschaetzung. Der Lernende gibt vor dem Aufdecken keine Konfidenz an, und es gibt kein Kalibrierungs-Feedback (Vorhersage vs. Trefferquote). Gerade MC-Formate erzeugen Overconfidence; ohne Kalibrierung lernt man nicht, WAS man noch nicht kann - der teuerste metakognitive Fehler vor einer Pruefung. Nicht im Backlog - echte Luecke.  
  → _Vor 'Antwort pruefen' ein kurzer Konfidenz-Tap ('sicher / unsicher'). Danach Kalibrierung anzeigen ('bei 'sicher' hattest du 72 % richtig'). Ueberkonfidente/geratene Treffer gezielt haeufiger wiederholen. Guenstiger, hoher Hebel fuer echtes Behalten._
- 🔴 hoch · **Itembank / Konzept- vs. Item-Lernen** (L)  
  Nur 55 feste Items, mehrere Themen mit sehr wenigen Fragen (Datenschutz 2, Metastasierung 2). Ausser Options-Shuffling gibt es keine Item-Varianten/Paraphrasen. Bei wiederholtem Ueben lernt man Item-Antwort-Paare (den konkreten Fragetext) auswendig statt das Konzept - der Testing-Effekt kollabiert auf das Memorieren von 55 Strings. Verstaerkt durch die volumenbasierten Badges (bis 1000 Antworten = jedes Item ~18x).  
  → _Item-Varianten/Paraphrasen-Pools je Lernziel; parametrisierte Rechenaufgaben (Zahlen zufaellig). Kurzfristig: mehr Items je Thema, um Item-Memorieren zu verwaessern. Fortschritt an Lernziele statt an Einzel-IDs binden._
- 🟠 mittel · **Gamification / Anreiz-Ausrichtung** (M)  
  Belohnungen sind primaer an Volumen gekoppelt: Badges bis '1000 Fragen beantwortet' (app.js:257), 'sharp' = 80 % kumulative Trefferquote (app.js:262, bleibt nach Erreichen praktisch dauerhaft, spiegelt nicht den aktuellen Stand). Streak zaehlt jede Aktivitaet - schon 1 Frage/Tag haelt die Serie (touchStreak, app.js:237). Das belohnt Wiederholen derselben Items und 'Abhaken' statt Verstehen/Behalten.  
  → _Anreize an Koennen ausrichten: Badges/XP fuer 'sicher beherrschte' Items, geleerte Faelligkeiten des Tages und gute Kalibrierung. Streak an ein sinnvolles Mindest-Tagesziel (z. B. alle faelligen Wiederholungen) koppeln statt an 1 Antwort._
- 🟠 mittel · **Distraktor-Qualitaet** (M)  
  Mehrere Distraktoren sind implausibel und per Ausschluss erkennbar, z. B. met-001 'neuronal-elektrisch ueber Nervenimpulse', reg-006 'Verwaltung von Medikamentenbestaenden', ds-002 'Veroeffentlichung von Klarnamen'. Zu leichte Distraktoren senken den diagnostischen Wert und den Abrufaufwand (Testing-Effekt). Gute Distraktoren sollten reale Fehlvorstellungen abbilden (z. B. N- vs. M-Verwechslung, /2 vs. /3, Inzidenz vs. Praevalenz).  
  → _Distraktoren aus typischen Verwechslungen/Fehlkodierungen bauen (nah beieinander liegende Codes, haeufige Praefix-Fehler). Offensichtliche 'Fantasie'-Optionen ersetzen. Erhoeht Schwierigkeit produktiv (desirable difficulty)._
- 🟠 mittel · **Selbst-Erklaerung / antwortspezifisches Feedback** (M)  
  Die Erklaerung ist identisch, egal welchen Distraktor der Lernende gewaehlt hat (ein fester explanation-Text). Es gibt keinen Selbst-Erklaerungs-/'Warum?'-Prompt. Damit erfaehrt der Lernende nicht gezielt, warum SEINE Fehlwahl falsch war, und die stark lernwirksame Selbsterklaerung wird nicht angestossen.  
  → _Kurze Begruendung je Schluessel-Distraktor hinterlegen und beim entsprechenden Fehlgriff einblenden; optional ein 'Warum ist das so?'-Reflexionsprompt vor dem Aufdecken. Nutzt den Self-Explanation-Effekt._
- 🟡 niedrig · **Wiederholungslogik (Feedback-Timing)** (S)  
  'Falsche wiederholen' baut sofort im Anschluss eine Session nur aus gerade falsch beantworteten Items (app.js:870-877). Massierte Sofort-Wiederholung erzeugt Fluency-Illusion (kurzfristig richtig, langfristig kaum behalten), weil der Abruf trivial aus dem Kurzzeitgedaechtnis erfolgt.  
  → _Falsche Items zusaetzlich fuer eine spaetere (z. B. naechsttaegige) Wiederholung einplanen statt nur sofort. Sofort-Retest beibehalten, aber nicht als Ersatz fuer verteilte Wiederholung werten._
- 🟡 niedrig · **Modus-Benennung / metakognitive Ehrlichkeit** (S)  
  'Schwachstellen wiederholen' enthaelt via weakQuestions auch NIE gesehene Items (!p, app.js:293). Auf einem frischen Stand sind das alle 55 Fragen. Die Bezeichnung 'Schwachstellen'/'Fragen zum Auffrischen' suggeriert dem Lernenden faelschlich, dies seien seine Schwaechen, und verzerrt die Selbsteinschaetzung.  
  → _Trennen in 'Neu' (noch nicht geuebt) und 'Schwach' (falsch/instabil). Nur echte Fehl-/Wackel-Items als Schwachstellen labeln._
- 🟡 niedrig · **Zielsetzung / Dosierung** (M)  
  Sessiongroesse ist fix (15 Uebung, 30 Pruefung, app.js:316); es gibt kein Tagesziel und keine Kopplung an faellige Wiederholungen. Ohne konkretes, erreichbares Ziel je Tag fehlt die Steuergroesse fuer verteiltes Lernen (Backlog P2 - bestaetigt).  
  → _Tagesziel definieren = heute faellige Wiederholungen + kleine Menge neuer Items, mit Fortschrittsring. Session-Umfang optional waehlbar._

**Top-Features:** Leitner-basierte Spaced Repetition mit echtem Koennens-Status und 'heute faellig' (P1) · Produktions-/Recall-Aufgaben (Zahl-/Code-/Praefix-Eingabe) mit Loesungsschluessel (P1) · Konfidenz-Tap + Kalibrierungs-Feedback (Metakognition) (P2) · Itembank-Ausbau mit Varianten/Paraphrasen und staerkeren Distraktoren (P2)

### Gamification- & Retention-Designer/in

_Die Basis ist solide und angenehm frei von Dark Patterns: XP fürs Üben (auch bei Falschantworten +2), eine früh belohnende Level-Kurve und dauerhaft sichtbarer Streak. Der größte Schwachpunkt ist das Belohnungs-Timing: Level-Ups passieren komplett unsichtbar (js/app.js:362-372 vergibt XP, prüft aber nie einen Levelwechsel). Zwei strukturelle Retention-Lücken: Die Streak-Mechanik ist gnadenlos (ein verpasster Tag = 0, ohne Warnung, Schutz oder Wiederherstellung, js/app.js:1141) und die Erfolge sind stark auf reines Mengen-Grinding ausgelegt (8 von 14 Badges sind „N Fragen beantwortet" bis 1000 – bei nur 55 Fragen ~18-facher Durchlauf), während das eigentliche Endziel (alle 9 Themen / alle Fragen gemeistert) gar kein Badge hat._

**Stärken:**
- Konsequent Dark-Pattern-frei: keine künstliche Dringlichkeit, keine manipulative Verlust-Rhetorik, ehrlicher Reset, kein Bezahldruck – ungewöhnlich sauber für eine Lern-App.
- Anti-Frust-Design: Falschantworten geben +2 XP „fürs Üben" (js/app.js:363), Badges werden nie aberkannt, Streak braucht nur 1 Antwort statt eines harten Ziels – niedrige Einstiegshürde.
- Früh belohnende Level-Kurve: Level 2 bereits bei 100 XP (~7-10 Antworten) liefert schnelles erstes Erfolgserlebnis, danach saubere quadratische Progression (xpFloor = 50*n*(n-1)).
- Schwierigkeits-gestaffelte XP (10/15/20 je Difficulty, js/app.js:363) belohnt anspruchsvollere Fragen korrekt stärker.
- Gute Rückkehr-Hooks vorhanden: „Schwachstellen wiederholen" mit Live-Zähler auf der Startseite (js/app.js:510) und optionale Tages-Erinnerung per Push.
- Streak dauerhaft in der Appbar sichtbar (setStreak, js/app.js:458) – hält das Ziel präsent.

**Befunde:**

- 🔴 hoch · **Belohnungs-Timing / Level-Up** (S)  
  Level-Ups werden nirgends gefeiert. checkCurrent (js/app.js:362-372) vergibt XP und prüft Badges, erkennt aber keinen Levelwechsel. Der wichtigste Belohnungsmoment der ganzen App (neues Level + neuer Titel wie „TNM-Kenner") passiert komplett unsichtbar – der Nutzer sieht es nur passiv beim nächsten Öffnen der Startseite.  
  → _In checkCurrent Level vor/nach der XP-Vergabe vergleichen (levelForXp(alt) vs levelForXp(neu)) und bei Aufstieg einen prominenten Moment auslösen: Level-Up-Toast/Modal mit neuem Titel, ggf. Konfetti. Das ist der stärkste Dopamin-Hebel und mit vorhandener toast()/modalChoice()-Infrastruktur billig zu bauen._
- 🔴 hoch · **Streak-Fairness / Wiederherstellung** (M)  
  Die Streak ist gnadenlos: ein einziger verpasster Tag setzt sie hart auf 0 (js/app.js:1141), ohne Vorwarnung, ohne Schutztag und ohne Wiederherstellung. Der Verlust wird nicht einmal quittiert – die Serie ist beim Öffnen einfach weg. Das ist klassische Streak-Angst und der häufigste Grund für Abbruch nach einem Ausrutscher.  
  → _Kulanz einbauen: (a) 1 Gnadentag – die Serie überlebt genau eine Lücke (daysBetween <= 2 statt Reset bei > 1); und/oder (b) ein „Streak-Schutz"-Kontingent (z.B. 1 pro Woche automatisch), das eine verlorene Serie einmalig rettet, mit Hinweis „Deine Serie wurde gerettet". Bei tatsächlichem Verlust den bisherigen Rekord anerkennen („Deine längste Serie: 12 Tage") statt stillem 0._
- 🔴 hoch · **Erfolge / Balance & Endgame** (M)  
  8 von 14 Badges sind reines Mengen-Grinding (answered 1/10/50/100/250/500/750/1000, js/app.js:250-257). Bei nur 55 Fragen bedeutet „1000 beantwortet" ~18-facher Durchlauf ohne neuen Inhalt – ein Laufband. Gleichzeitig hat das eigentliche Lernziel keine Belohnung: es gibt nur EINEN „master"-Badge fürs Meistern IRGENDEINES Themas (js/app.js:263), aber keinen für „alle 9 Themen gemeistert" bzw. „alle 55 Fragen mind. einmal korrekt" – also genau das Prüfungsziel.  
  → _Mengen-Leiter kürzen (Deckel z.B. bei 250) und die freiwerdenden Slots auf Meisterschaft umlegen: pro-Thema-Meilensteine (z.B. „3/6/9 Themen gemeistert"), ein „Alles gemeistert"-Gold-Badge (alle Fragen mind. 1x korrekt) und ein 100%-Prüfungs-Badge. So belohnt das System Lernabdeckung statt Wiederholungszahl._
- 🟠 mittel · **XP-Ökonomie / Inflation** (M)  
  XP für eine korrekte Antwort ist konstant (10-20), egal ob es die erste richtige Lösung oder die 30. Wiederholung derselben leichten Frage ist (js/app.js:363). Level misst damit vor allem verbrachte Zeit, nicht Können; eine Frage lässt sich beliebig für XP „farmen". Bei 55 Fragen und Level-10-Ziel (4500 XP) wird der obere Titelbereich reiner Grind – die Titel „Register-Meister"/„Tumordoku-Ass" sind ohne Content-Wiederholung praktisch unerreichbar.  
  → _Nicht bestrafen, sondern Abdeckung belohnen: einmaligen „Erstmeisterungs-Bonus" (z.B. +25 XP beim ERSTEN korrekten Lösen einer Frage) einführen, sodass XP mit Lernfortschritt statt mit Wiederholungen skaliert. Optional Wiederhol-XP innerhalb desselben Tages leicht senken. Titelanzahl an das realistische XP-Ceiling anpassen oder ab Level 10 einen Prestige-/„+"-Hinweis ergänzen._
- 🟠 mittel · **Tagesziel** (M)  
  Es gibt kein Tagesziel. Die Streak triggert bereits bei einer einzigen Antwort (touchStreak in checkCurrent) – „üben" heißt damit einmal tippen. Ohne konkretes Tagesziel fehlt der wichtigste tägliche Fortschrittsanker; im Backlog nur als P2 „Statistik & Tagesziel" geplant.  
  → _Kleines, editierbares Tagesziel (Default z.B. 10 Fragen) mit Fortschrittsring auf der Startseite, und die Streak an das ERREICHTE Tagesziel koppeln statt an eine einzelne Antwort. Das macht die Serie bedeutsamer und gibt einen klaren „heute geschafft"-Moment. Auf P1 hochziehen – höchster Retention-Hebel pro Aufwand._
- 🟠 mittel · **Rückkehr-Anreize / Erinnerungen** (M)  
  Die Push-Erinnerung ist generisch („So sieht deine Lern-Erinnerung aus", js/app.js:209 als Testtext; der reale Text ist serverseitig). Sie nutzt weder Streak-Stand noch fällige Schwachstellen. Genau der stärkste Rückkehr-Trigger – „Deine 6-Tage-Serie läuft heute ab" – wird nicht gespielt.  
  → _Erinnerungsinhalt personalisieren: bei aktiver Serie streak-erhaltende Formulierung, sonst „X Fragen warten zum Auffrischen". Da der Server Streak-Daten via Sync sehen kann, lässt sich das in send-reminders/index.ts staffeln, ohne neuen Client-Flow._
- 🟡 niedrig · **Streak-Anzeige-Konsistenz** (S)  
  Die Streak wird nur beim App-Start auf 0 korrigiert (js/app.js:1141). Eine über Nacht offen gebliebene/gecachte App zeigt weiter den alten (zu hohen) Streak-Wert, bis sie neu geladen wird – kleine Inkonsistenz, die das Vertrauen in den Zähler untergräbt.  
  → _setStreak() bzw. renderHome() eine „ist die Serie noch gültig?"-Prüfung gegen todayStr() voranstellen, damit die Anzeige auch ohne Neustart korrekt abläuft._
- 🟡 niedrig · **Code-Qualität Badge-Test** (S)  
  Der master-Badge-Test ist unnötig verschachtelt: Object.values(TOPICS).some((_, i) => topicMastered(Object.keys(TOPICS)[i])) (js/app.js:263) iteriert Values, nutzt aber den Index um in Keys nachzuschlagen – funktioniert, ist aber fehleranfällig bei künftigen Änderungen.  
  → _Vereinfachen zu Object.keys(TOPICS).some(topicMastered). Gleiche Logik, robust und lesbar._

**Top-Features:** Sichtbares Level-Up-Erlebnis (P1) · Faire Streak: Gnadentag + Schutz + Rekord-Anerkennung (P1) · Tagesziel mit Fortschrittsring, an die Streak gekoppelt (P1) · Badge-Rebalancing: weniger Mengen-Grind, mehr Meisterschaft (P2) · Erstmeisterungs-Bonus-XP (P2) · Streak-/Schwachstellen-bewusste Push-Erinnerungen (P2)

### Fachexpertin/Fachexperte für onkologische Tumordokumentation (Tumordokumentar/in)

_Die 55 Fragen in data/questions.js sind fachlich überwiegend korrekt, sauber formuliert und treffen viele prüfungsrelevante Grundlagen (TNM-Präfixe, ICD-O-3-Verhaltenscodes, R- vs. r-Klassifikation, Epidemiologie-Kennzahlen) gut. Es gibt jedoch einzelne veraltete/unscharfe Aussagen (u. a. pM0 nur bei Autopsie, Strahlentherapie unter systemisch) und, wichtiger, strukturelle Lücken: durchgehend fehlt die Angabe der TNM-Edition, der aktuelle Begriff oBDS sowie ganze prüfungsrelevante Kernbereiche (UICC-Stadiengruppierung, Sentinel-/ITC-Nodalnotation, Multiple-Tumor-Regeln, Meldewesen-Logistik). Für echte Prüfungsnähe sind diese Ergänzungen der größte Hebel._

**Stärken:**
- Saubere Trennung zweier klassischer Verwechslungsfallen: r-Präfix (Rezidiv, tnm-005) vs. R-Klassifikation (Residualtumor, gd-003/gd-004) wird explizit adressiert und in den Erklärungen gegengeschnitten.
- ICD-O-3-Verhaltenscodes vollständig und korrekt (/0, /1, /2, /3, /6, sogar /9 = maligne, unklar ob primär/metastatisch) inkl. plausibler Distraktoren in ico-003/ico-005.
- MX-Obsoleszenz korrekt abgebildet (tnm-009): MX soll nach aktueller UICC-Empfehlung nicht mehr verwendet werden - ein häufig übersehenes Aktualitäts-Detail.
- Epidemiologie-Block konzeptuell stark und korrekt: Inzidenz/Prävalenz, Mortalität vs. Letalität, relatives Überleben und Altersstandardisierung (epi-001 bis epi-006).
- Zusatzcodes L/V/Pn mit korrekten Wertebereichen (L0/L1, V0/V1/V2, Pn0/Pn1) und sauberer Abgrenzung zu G = Grading (gd-005).
- Register-/Rechtsfundament korrekt: 65c SGB V/KFRG 2013, ZfKD am RKI, ADT/GEKID als Herausgeber (reg-003/reg-005).

**Befunde:**

- 🔴 hoch · **Fehlende Kernthemen TNM-Detail** (L)  
  Keine Fragen zu prüfungszentralen Feinheiten: UICC-Stadiengruppierung (Stadium 0/I-IV aus TNM ableiten), Sentinel-/ITC-Notation (pN0(sn), N0(i+), N0(mol+)), sowie TNM-Ausnahmen (kein TNM für ZNS-Tumoren und hämatologische Neoplasien; Lymphome nach Ann-Arbor). Diese Themen sind klassisch prüfungsrelevant und dokumentationspraktisch bedeutsam.  
  → _Je 1-2 Fragen ergänzen: (a) TNM zu UICC-Stadium gruppieren, (b) Bedeutung isolierter Tumorzellen/Sentinel-Notation, (c) 'Für welche Entitäten gilt TNM nicht?' (ZNS, Leukämien; Lymphome = Ann-Arbor)._
- 🟠 mittel · **TNM / M-Kategorie (tnm-009, Zeile 195)** (S)  
  Die Erklärung behauptet 'pM0 gibt es faktisch nur bei Autopsie'. Nach aktueller UICC (8. Aufl.) sind pM0 und pMX KEINE gültigen Kategorien; jedes M0 ist klinisch (cM0), pathologisch existiert nur pM1 (mikroskopisch gesicherte Fernmetastase). Die Aussage ist eine veraltete Lehrmeinung und kann in der Prüfung falsch antrainiert werden.  
  → _Erklärung korrigieren zu: 'pM0/pMX sind keine gültigen Kategorien; ohne Metastasennachweis ist die Einstufung stets cM0. pM1 erfordert die mikroskopische (histologische/zytologische) Sicherung einer Fernmetastase.'_
- 🟠 mittel · **Fehlende TNM-Editionsangabe (gesamter TNM- und Grading-Block)** (M)  
  Nirgends wird die zugrunde gelegte TNM-Edition genannt. TNM ist editionsabhängig (aktuell 8. Auflage 2017, entitätsspezifisch bereits 9. Auflage z. B. Lunge 2024). Ohne Editionsbezug sind mehrere Aussagen (z. B. Stadiengrenzen, C-Faktor der in Aufl. 8 zurückgestuft wurde) nicht eindeutig verankert.  
  → _In den Erklärungen und im Datei-Header 'UICC/TNM 8. Auflage (2017)' als Referenzstand ausweisen; bei editionssensiblen Fragen (C-Faktor gd-006, M-Kategorie) den Editionsbezug direkt in der Erklärung nennen._
- 🟠 mittel · **Terminologie Basisdatensatz (reg-001/reg-004, Register-Block)** (S)  
  Durchgehend wird nur 'ADT/GEKID-Basisdatensatz' verwendet. Der aktuell rechtlich verbindliche Begriff ist der 'einheitliche onkologische Basisdatensatz (oBDS)', der den bisherigen ADT/GEKID-Basisdatensatz nach 65c SGB V fortführt/abgelöst hat. Prüfungsaktuelles Vokabular fehlt.  
  → _reg-001 um oBDS ergänzen (z. B. als korrekte Antwortoption oder in der Erklärung: 'heute als oBDS bezeichnet, hervorgegangen aus dem ADT/GEKID-Basisdatensatz') und mindestens eine Frage gezielt zur Begriffsumstellung aufnehmen._
- 🟠 mittel · **Therapiemodalitäten (the-004, Zeile 609 ff.)** (S)  
  Frage überschreibt Strahlentherapie unter 'systemische bzw. onkologische Therapiemodalitäten' und wertet sie als korrekt. Strahlentherapie ist fachlich eine lokoregionäre, KEINE systemische Therapie. Das 'bzw. onkologische' rettet die Wertung, ist aber unscharf und kann fachlich versierte Prüflinge zum Abwählen verleiten.  
  → _Frage schärfen: entweder Titel auf 'Säulen der Tumortherapie' ändern und die Systemtherapie-Abgrenzung in der Erklärung betonen, oder eine separate Frage 'Welche Verfahren wirken systemisch (nicht lokal)?' ergänzen (Chemo/endokrin/zielgerichtet/Immun = systemisch; OP/RT = lokal)._
- 🟠 mittel · **Meldewesen-Logistik (Register-Block)** (M)  
  Es fehlen dokumentarisch zentrale Meldeprozess-Themen: Meldeanlässe sind gut abgedeckt (reg-004), aber Meldefristen, Meldevergütung, Rolle der Vertrauensstelle im Datenfluss klinisch/epidemiologisch, sowie DCO-Fälle (Death Certificate Only) und Diagnosesicherung/most valid basis of diagnosis (histologisch/zytologisch/klinisch) kommen nicht vor.  
  → _Fragenblock ergänzen: Vertrauensstelle vs. Registerstelle (Datenfluss/Pseudonymisierung), Meldevergütung/Meldepflicht ohne Einwilligung + Widerspruchsrecht gegen Identitätsdaten, Diagnosesicherungs-Grade und DCO als Vollzähligkeitsindikator._
- 🟡 niedrig · **ICD-10 CUP-Beispiel (icd-004, Zeile 318)** (S)  
  Als CUP-Beispiel wird 'C80.9 = bösartige Neubildung ohne Angabe der Lokalisation (CUP)' genannt. In ICD-10-GM ist der spezifische CUP-Kode C80.0 (primäre Lokalisation unbekannt, so definiert); C80.9 ist die unspezifische 'nicht näher bezeichnet'. Der CUP-Bezug ist damit leicht falsch verankert.  
  → _Beispiel auf C80.0 für CUP umstellen und C80.9 als 'o. n. A.' abgrenzen._
- 🟡 niedrig · **Grading nur generisch (gd-001/gd-002)** (M)  
  Nur das klassische G1-G4/GX-Schema wird abgefragt. In oBDS/Praxis sind organspezifische Grading-Systeme und Sondercodes relevant (z. B. Borderline B bei Ovar, Gleason/ISUP bei Prostata, Nottingham/Elston-Ellis bei Mamma, WHO-Grade ZNS, L/H bei einigen Entitäten). Prüflinge müssen wissen, dass G nicht universell 4-stufig ist.  
  → _1-2 Fragen ergänzen, die auf organspezifisches Grading und die Grading-Sondercodes des Basisdatensatzes hinweisen._
- 🟡 niedrig · **Quellen-/Regelbezug je Frage (bereits P3 im Backlog)** (M)  
  Backlog listet 'Quellen-/Referenzangabe je Frage' nur als P3. Gerade wegen der Editionsabhängigkeit von TNM und der Begriffsdynamik (oBDS) ist ein Referenzstand pro Frage kein nice-to-have, sondern Voraussetzung für belastbare fachliche Korrektheit.  
  → _P3 auf P2 hochstufen; pro Frage optionales Feld 'source' (z. B. 'UICC TNM 8. Aufl.', 'ICD-O-3.2', 'oBDS v3', '65c SGB V') einführen und im Info-Reiter den Referenzstand global ausweisen._

**Top-Features:** TNM-Editionsstand fixieren + Stadiengruppierung/ITC-Nodalnotation als neue Fragen (P1) · Terminologie auf oBDS aktualisieren + Meldewesen-/Datenfluss-Fragenblock (P1) · Veraltete/unscharfe Einzelaussagen korrigieren (pM0, Strahlentherapie=systemisch, CUP-Kode C80.0) (P1) · Organspezifisches/oBDS-Grading und TNM-Ausnahmen (ZNS, Ann-Arbor) ergänzen (P2) · Referenzstand/Quelle je Frage (Feld 'source') einführen (P2)

### Assessment-/Prüfungsvorbereitungs-Expertin/Experte

_Die App setzt das Alles-oder-nichts-MC-Format sauber um und liefert fachlich korrekte, gut erklärte Items – als Vokabel-/Definitionstrainer funktioniert sie. Als Prüfungsvorbereitung greift sie aber zu kurz: Sie trainiert fast ausschließlich Faktenabruf, während die echte Prüfung anwendungs-/kodierlastig ist und Nachschlagewerke (ICD-10, ICD-O-3, OPS) erlaubt – die App lässt genau die Kompetenz (Fall → Code/Stadium) ungeübt und drillt stattdessen das Auswendiglernen nachschlagbarer Codes. Die „Prüfungssimulation" ist ohne Timer, ohne Blueprint (Themenabdeckung) und mit Sofort-Feedback keine belastbare Simulation; Distraktorqualität und Ratemuster mindern die diagnostische Aussagekraft._

**Stärken:**
- Alles-oder-nichts-Wertung bei Mehrfachauswahl ist korrekt implementiert (checkCurrent, js/app.js:348-351: exakte Mengengleichheit picks==correct) und entspricht der dokumentierten Prüfungsregel (kein Teilpunkt).
- Antwortoptionen werden zur Laufzeit pro Frage gemischt (buildSession, js/app.js:320) → keine Positionsverzerrung im Quellmaterial; Rateheuristik 'Antwort C ist meist richtig' greift nicht.
- Die 55 Items sind fachlich überwiegend korrekt und jede Frage hat eine didaktisch brauchbare Erklärung (z. B. R- vs. r-Präfix in tnm-005, cM0/pM0 in tnm-009) – gute Grundlage für formatives Lernen.
- Lernförderliche Schleifen vorhanden: 'Falsche wiederholen' am Ergebnisschirm (js/app.js:863-877) und Schwachstellenmodus (weakQuestions, js/app.js:292-294).
- Themenstruktur (9 Themen) orientiert sich sinnvoll am ADT/GEKID-Basisdatensatz und deckt die Kern-Domänen TNM/ICD-O/ICD-10/Register/Epidemiologie ab.

**Befunde:**

- 🔴 hoch · **Item-Qualität / kognitives Niveau** (L)  
  Praktisch alle 55 Items prüfen reinen Faktenabruf (Bloom 'Erinnern'): Definitionen und Codebedeutungen. Die echte Prüfung ist anwendungsorientiert und erlaubt ICD-10/ICD-O-3/OPS als Hilfsmittel – d. h. Codebedeutungen schlägt man nach, gefragt ist die Zuordnung Fall→Code. Die App drillt somit genau das (Auswendiglernen nachschlagbarer Codes wie 'C00–C97 = bösartig' in icd-001), was in der Prüfung nachschlagbar ist, und übt die eigentliche Prüfungskompetenz (Fallvignette → Kodierung) nicht.  
  → _Fallbasierte Items ergänzen: kurze Kasuistik (Histologiebefund/OP-Bericht) → Aufgabe 'Vergeben Sie Topografie C.., Morphologie ..../.., cTNM'. Bestehende Recall-Items als Einstiegsstufe behalten, aber Anwendungs-Items als eigene, prüfungsnahe Ebene priorisieren._
- 🔴 hoch · **Aufgabentypen** (L)  
  Es gibt nur type 'single'/'multi'. Kein Kodier-Aufgabentyp und keine echte Rechen-Eingabe. Die einzige Rechenaufgabe (epi-006, Inzidenzrate) ist Multiple-Choice und damit aus den Optionen rückrechenbar – der Rechenweg wird nicht geprüft. Freitext-/Zahl-/Code-Eingabe fehlt komplett.  
  → _Aufgabentyp 'numeric' (Zahl-Eingabe mit Toleranz/Einheit) und 'code' (strukturierte Eingabe C../..../.., mit Lösungsschlüssel) einführen. Backlog-P1 'Rechen-/Dokumentationsaufgaben' bestätigt – konkret: Inzidenz/Prävalenz-Rate, alters-/geschlechtsstandardisierte Rate, relatives Überleben, TNM-Stadiengruppierung als Rechen-/Regelanwendung._
- 🔴 hoch · **Prüfungssimulation** (M)  
  Der Exam-Modus zieht 30 Zufallsfragen aus allen 55 (buildSession, js/app.js:312-317) ohne Themen-Blueprint. Dadurch ist die Abdeckung der 9 Themen nicht garantiert (ein Durchlauf kann z. B. Datenschutz komplett auslassen), Schwierigkeitsmix ist zufällig, und zwei Läufe sind nicht vergleichbar. Eine Prüfungssimulation muss die Merkmalsstruktur der echten Prüfung nachbilden.  
  → _Blueprint-gesteuerte Zusammenstellung: feste Quote je Thema (proportional zur Prüfungsrelevanz) und definierter Leicht/Mittel/Schwer-Mix. Simulation reproduzierbar und diagnostisch vergleichbar machen._
- 🔴 hoch · **Content-Abdeckung** (M)  
  OPS kommt im gesamten Fragenbestand nicht vor – kein Thema, keine Frage –, obwohl der Info-Screen OPS explizit als zugelassenes Hilfsmittel nennt (js/app.js:928) und Prozeduren-/Therapiekodierung Prüfungsinhalt ist. Damit fehlt eine ganze Prüfungsdomäne.  
  → _Thema 'OPS / Prozeduren- und Therapiekodierung' anlegen (OP-, Strahlen-, systemische Therapie) und mit Kodier-/Anwendungsitems füllen; passt inhaltlich zu den Therapiemeldeanlässen (reg-004)._
- 🟠 mittel · **Prüfungslogik** (S)  
  Die Bestehensgrenze 50 % ist hartcodiert (finishSession, js/app.js:384; Info-Screen js/app.js:927) und treibt den Badge 'Prüfung bestanden' (BADGES 'exam', js/app.js:260). Der Wert ist nicht gegen die reale ADT-Prüfungsordnung belegt (im Entscheidungs-Log ist nur die Alles-oder-nichts-Regel referenziert, nicht die 50 %-Grenze). Eine zu niedrige/unverifizierte Grenze gaukelt Prüfungsreife vor.  
  → _Bestehensgrenze anhand der offiziellen Prüfungsordnung verifizieren und als Konstante konfigurierbar machen; ggf. getrennte Grenzen je Prüfungsteil. Badge-Text an tatsächliche Grenze koppeln._
- 🟠 mittel · **Prüfungssimulation** (M)  
  Der Exam-Modus nutzt denselben renderQuiz-Fluss mit Sofort-Feedback und Erklärung nach jeder Frage (checkCurrent → toast/Erklärung) und hat keinen Timer. Die echte Prüfung (180 Min) gibt kein Zwischenfeedback und erfordert Zeiteinteilung. So wird weder Prüfungsdruck noch Zeitmanagement geübt.  
  → _Echten Prüfungsmodus (Backlog-P1) bauen: Timer 180 Min, kein Sofort-Feedback, Frei-Navigation + Flaggen, 'Abgeben' → gesammelte Auswertung mit Erklärungen. Übungs- und Prüfungsmodus klar trennen._
- 🟠 mittel · **Item-Qualität / Distraktoren** (M)  
  In vielen Multi-Items ist die falsche Option trivial absurd erkennbar (met-001 'neuronal-elektrisch über Nervenimpulse'; gr-002 'grundsätzlich vollständig abgekapselt'; gd-005 'G = Gefäßinvasion'). Solche Nonsens-Distraktoren senken die Trennschärfe und untergraben die Alles-oder-nichts-Schwierigkeit – wer den Unsinn streicht, hat das Item.  
  → _Distraktoren nach Item-Writing-Standards überarbeiten: plausible, fachlich naheliegende Fehlvorstellungen statt Nonsens (z. B. echte Verwechslungspaare N-/M-Kategorie, L/V/Pn). Homogene Länge/Detailtiefe der Optionen._
- 🟠 mittel · **Item-Qualität / Rate-Cues** (M)  
  Systematische Test-Wiseness-Cues: Die längste, am stärksten qualifizierte Option ist auffällig oft die richtige (epi-003, epi-004, reg-006, ds-002, met-002). Zusätzlich haben zwei Multi-Items ALLE Optionen als korrekt (reg-004 correct [0,1,2,3]; the-004 correct [0,1,2,3]). Geübte Prüflinge lernen 'nimm die längste'/'nimm alle' statt des Inhalts.  
  → _Optionslängen angleichen; Anteil der 'alle richtig'-Items begrenzen und durchmischen mit Items, bei denen 1–2 von 4 falsch sind; korrekte Antworten über Länge/Position balancieren._
- 🟠 mittel · **Auswertung / Diagnostik** (M)  
  'Gemeistert' und Themenfortschritt basieren auf 'mindestens 1× richtig' (topicStats/topicMastered, js/app.js:265-286). Bei gemischten MC mit gemischten Optionen kann ein einzelner Glückstreffer 'gemeistert' auslösen; die Trefferquote überschätzt so die Prüfungsreife. Am Exam-Ende fehlt zudem eine Themen-Aufschlüsselung (renderResult zeigt nur Gesamt-% und falsche Fragen).  
  → _Mastery an stabileres Kriterium binden (z. B. 2–3 korrekte Antworten in Folge / je Frage) und im Exam-Ergebnis ein Kompetenzprofil je Thema plus einen kalibrierten 'Prüfungsbereit?'-Indikator ausgeben._
- 🟠 mittel · **Content** (M)  
  Die TNM→UICC-Stadiengruppierung (I–IV) wird nur definitorisch erwähnt (the-006), aber nirgends als Aufgabe geübt, obwohl das Ableiten des Stadiums aus gegebenen T/N/M eine Kernkompetenz der Tumordokumentation ist.  
  → _Aufgabenreihe 'Gegeben pT.. pN.. M.. → UICC-Stadium' als Regel-/Anwendungsitems ergänzen (ggf. je Entität mit Nachschlage-Hinweis)._
- 🟡 niedrig · **Item-Metadaten / Gamification** (S)  
  Die difficulty-Labels sind inkonsistent und koppeln direkt an XP (gained = 10 + (difficulty-1)*5, js/app.js:363): Reine Definitions-Items sind teils als 'schwer' (z. B. reg-003, ds-002) markiert, die einzige echte Rechenfrage epi-006 als 'leicht'. Die Belohnung folgt so einer willkürlichen Einstufung statt echter kognitiver Anforderung.  
  → _Difficulty anhand Aufgabentyp/kognitiver Stufe und – sobald Nutzungsdaten vorliegen – empirischer Lösungsquote neu kalibrieren; Anwendungs-/Kodieritems höher gewichten._
- 🟡 niedrig · **Content-Umfang** (L)  
  55 Items bei 30 gezogenen Exam-Fragen bedeuten hohe Überlappung/Rezirkulation; Lernende memorieren rasch konkrete Item-Texte samt Erklärung statt Konzepte. Für eine glaubwürdige Simulation ist der Pool zu klein und die Memorierungsgefahr hoch.  
  → _Itembank deutlich ausbauen (Ziel dreistellig), Item-Varianten je Konzept, und im Exam-Modus zuletzt gesehene Items depriorisieren, um reines Auswendiglernen zu erschweren._

**Top-Features:** Fallbasierte Kodieraufgaben mit Nachschlage-Workflow (ICD-10/ICD-O-3/OPS) (P1) · Echter Prüfungsmodus: Timer 180 Min, kein Sofort-Feedback, Blueprint-Zusammenstellung, Kompetenzprofil (P1) · Rechen- und Regelanwendungs-Items mit echter Eingabe (Raten, relatives Überleben, TNM→UICC-Stadium) (P1) · Distraktor- und Item-Überarbeitung nach Item-Writing-Standards (P2)

### Produkt- & Growth-Strategie

_Der ADT Trainer ist als robuste, offline-fähige Einzelnutzer-App technisch reif und ehrlich dokumentiert – aber bewusst auf genau eine Anwenderin zugeschnitten (pitch.md Z. 22-24, workbook.md §9a), wodurch praktisch jeder Wachstumshebel fehlt: keine App-Weitergabe/Empfehlung, kein Kurs-/Lerngruppen-Modell, kein Onboarding-Funnel und keine Nutzungs-Metriken. Der größte ungenutzte Hebel ist die natürliche Verbreitung innerhalb eines Lehrgangs-Jahrgangs (Kohorte) – dafür gibt es aktuell kein Produkt-Feature. Zusätzlich besteht ein realer Marken-/Rechtsrisiko-Punkt: „ADT" ist die reale Trägerorganisation; der Produktname suggeriert Offizialität. Content-Decke (55 Fragen, sehr ungleich verteilt) begrenzt Retention und Teilbarkeit._

**Stärken:**
- Extrem klare, ehrliche Positionierung und Dokumentation (pitch.md, README.md, workbook.md) – Entscheidungs-Log und Backlog sind vorbildlich nachvollziehbar; das ist eine seltene Growth-Grundlage.
- PWA-Wahl senkt die Akquise-Friktion maximal: ein Link genügt, kein App Store, kein Account – ideal für virale Weitergabe im Kurs, falls ein Share-Mechanismus ergänzt wird.
- Prüfungsformat-Treue als echtes Differenzierungsmerkmal: Multi-Select mit Alles-oder-nichts-Wertung (§5 PO) hebt die App klar von generischen Anki/Quizlet-Decks ab.
- Retention-Bausteine bereits angelegt: Streak, XP/Level mit Titeln, Badges (js/app.js), tägliche Web-Push-Erinnerung serverseitig verifiziert (changelog 0.5.0/0.6.0).
- Sync-Code-Modell ohne Login ist reibungsarm und datensparsam – eine gute Basis, die sich zu einem Kohorten-/Kurs-Code erweitern lässt.
- Network-first für questions.js/config.js (Entscheidungs-Log) erlaubt Content-Updates ohne App-Neuinstallation – wichtige Voraussetzung für Skalierung.

**Befunde:**

- 🔴 hoch · **Verbreitung / Weitergabe** (S)  
  Es gibt keinerlei Mechanismus, die App selbst zu teilen oder zu empfehlen. Grep über js/app.js zeigt: navigator.share wird nicht verwendet; clipboard.writeText (Z. 734) dient ausschließlich dem Kopieren des Sync-Codes. Verbreitung hängt vollständig an manuellem URL-Versand. Der stärkste organische Kanal (Mundpropaganda im Lehrgangs-Jahrgang) ist produktseitig nicht unterstützt.  
  → _Auf Startseite und im Info-Reiter einen 'App empfehlen'-Button mit navigator.share (Fallback: Link kopieren) ergänzen. Für die Präsenz-Verbreitung im Kurs zusätzlich einen QR-Code der App-URL generieren (rein clientseitig, offline). Kostet wenig, adressiert direkt den Haupt-Wachstumskanal._
- 🔴 hoch · **Zielgruppe / Skalierung (Lerngruppen & Kurse)** (L)  
  Das Nutzermodell ist bewusst auf isolierte Einzelpersonen begrenzt (workbook.md §9a, Entscheidungs-Log 2026-07-13: 'getrennte Nutzer = getrennte Codes', vollständig isoliert). Es gibt kein Konzept für eine gemeinsame Kohorte/Klasse, keinen geteilten Fortschritt, kein Ranking unter Peers und keine Rolle für Kursleitende. Der in der Aufgabe geforderte Ausbau Richtung Lerngruppen/Kurse ist im Backlog gar nicht vorgesehen – echter blinder Fleck.  
  → _Neben dem persönlichen Sync-Code einen optionalen 'Kurs-Code' einführen (read-only Beitritt): geteiltes, anonymisiertes Kohorten-Leaderboard (Vorname/Alias, opt-in) und aggregierter Kohorten-Fortschritt. Kursleitende können denselben Code nutzen, um offizielle/kurseigene Fragensets zu verteilen. Das schafft sozialen Druck (Retention) und einen B2B2C-Vertriebskanal über Kursanbieter._
- 🔴 hoch · **Positionierung / Recht (Markenname)** (M)  
  'ADT' ist die Abkürzung der realen Arbeitsgemeinschaft Deutscher Tumorzentren e. V. (in questions.js gr-001 sogar selbst so definiert). Produktname 'ADT Trainer' plus Prüfungsvorbereitungs-Claim kann Offizialität/Endorsement suggerieren und berührt Marken-/Wettbewerbsrecht (UWG-Irreführung), sobald die App öffentlich verbreitet wird. Der Disclaimer 'nicht die offiziellen Fragen' steht nur in README/Datei, nicht prominent in der App.  
  → _Vor jeder öffentlichen Verbreitung: Marken-/Rechts-Check und Umbenennung erwägen (z. B. 'Tumordok Trainer' / 'OnkoDok Prep'), 'ADT' nur beschreibend nutzen. Prominenten In-App-Disclaimer 'Inoffiziell – kein Produkt der ADT e. V.' ergänzen. Alternativ Kooperation/Genehmigung mit der ADT anstreben (wäre zugleich der stärkste Credibility-Hebel)._
- 🔴 hoch · **Retention / Inhalt** (L)  
  Nur 55 Fragen bei sehr ungleicher Verteilung (TNM 11, Datenschutz 2, ICD-10 5). Der Fragen-Pool ist schnell erschöpft: Sobald Fragen gemeistert sind, ist 'Schwachstellen wiederholen' leer (Home-Button disabled, js/app.js Z. 510) – die zentrale Wiederkehr-Schleife läuft ins Leere. Das begrenzt Langzeit-Retention und die wahrgenommene Wertigkeit, die man weiterempfiehlt.  
  → _Content-Ausbau priorisieren (Backlog P1 bestätigt): mindestens ~15-20 Fragen je Thema, Gewichtung an Prüfungsrelevanz. Datenschutz/Recht ist prüfungsrelevant und mit 2 Fragen unterrepräsentiert. Parallel Spaced Repetition (Leitner, Backlog P1) einführen, damit auch gemeisterte Fragen wiederkehren und die tägliche Rückkehr einen Sinn behält._
- 🟠 mittel · **Onboarding / Aktivierung** (M)  
  Kein First-Run-/Willkommens-Flow (kein firstRun/welcome in js/app.js). Neue Nutzer landen direkt auf der Startseite; die Erklärung 'So funktioniert's' ist unter 'Fortschritt' versteckt und opt-in (Z. 522). Der Aha-Moment (erste richtige Antwort + XP/Streak) wird nicht bewusst inszeniert; keine Aktivierungs-Metrik.  
  → _Einmaliger, überspringbarer Willkommens-Screen: 1 Satz Nutzenversprechen, direkte Aufforderung 'Erste Frage starten', optional Tagesziel + Erinnerung setzen. Ziel: erste beantwortete Frage in <30 Sek (Aktivierungs-Definition). Install-Tipp (Z. 484) ist gut – in den Flow integrieren._
- 🟠 mittel · **Growth-Analytik / Messbarkeit** (M)  
  Es existieren keinerlei Nutzungs-Metriken (bewusst datensparsam, aber vollständig funnel-blind). Aktivierung, D1/D7-Retention und Feature-Nutzung sind nicht messbar – Roadmap-Entscheidungen erfolgen ohne Evidenz.  
  → _Datenschutzfreundliche Aggregat-Zähler (kein Tracking-SDK): z. B. über die bestehende Supabase-Funktion anonyme Ereigniszahlen (aktive Codes/Tag, Fragen/Tag, Prüfungen bestanden) hochzählen, ohne personenbezogene Daten. Genügt, um Aktivierung/Retention grob zu steuern._
- 🟠 mittel · **Positionierung / Glaubwürdigkeit** (M)  
  Die (korrekte und ehrliche) Kennzeichnung 'nicht die offiziellen ADT-Prüfungsfragen' (README Z. 188-192) ist zugleich ein Conversion-/Vertrauens-Dämpfer: Prüfungskandidaten wollen prüfungsnahes, verlässliches Material. Ohne offizielle/Beispiel-Fragen bleibt der überzeugendste Kaufgrund unerfüllt.  
  → _Offizielle/alte/Beispiel-Fragen einarbeiten (Backlog P1) und Quellenangabe je Frage (Backlog P3) als Trust-Signal sichtbar machen ('nach ICD-O-3 Regel …'). Perspektivisch Kooperation mit Kursanbieter/ADT als Gütesiegel._
- 🟠 mittel · **Wettbewerb / Differenzierung** (S)  
  Der Wettbewerb (offizielles ADT-Prüfungsfragentool – in questions.js selbst als 'das echte' referenziert; generische Anki/Quizlet-Decks; Amboss/Meditricks im Medizinumfeld) wird nirgends adressiert. Anki bietet ausgereiftes Spaced Repetition und geteilte Decks – die aktuelle App ist dort schwächer.  
  → _Positionierung explizit auf die verteidigbaren Stärken zuspitzen: exakte Prüfungsformat-Treue (Multi-Select, Alles-oder-nichts), deutsches Tumordok-Nischen-Curriculum, sofort offline auf dem iPhone, null Setup. Diese drei Punkte in pitch.md/Landingpage als Alleinstellung klar gegen Anki/Quizlet stellen._
- 🟡 niedrig · **Akquise / Auffindbarkeit** (S)  
  Als reine PWA ohne App-Store-Präsenz gibt es keine organische Auffindbarkeit; es existiert keine öffentliche Landingpage (nur README im Repo). Interessenten, die 'Tumordokumentar Prüfung üben' suchen, finden nichts.  
  → _Eine schlanke, statische Landingpage (GitHub Pages, dasselbe Hosting) mit Nutzenversprechen, Screenshots, Install-Anleitung und Direkt-Link + QR. Auf einschlägige Begriffe optimiert. Minimaler Aufwand, schafft überhaupt erst einen Einstiegspunkt für Verbreitung über den Einzelfall hinaus._

**Top-Features:** Kurs-/Lerngruppen-Code mit Kohorten-Leaderboard (P1) · App-Weitergabe: Share-Button + QR-Code (P1) · Onboarding-Flow mit Aha-Moment und Tagesziel (P1) · Marken-/Rechts-Check und prominenter Inoffiziell-Hinweis (P2) · Content-Ausbau + Spaced Repetition als Retention-Motor (P2)
