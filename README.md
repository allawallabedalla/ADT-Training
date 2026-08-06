# ADT Trainer – Prüfungsvorbereitung Tumordokumentar/in

Eine kleine, robuste **Lern-App fürs iPhone** zur Vorbereitung auf die
ADT-Prüfung **„Tumordokumentar/in"**. Sie läuft als **PWA** (Progressive
Web App) direkt in Safari, lässt sich zum Home-Bildschirm hinzufügen und
funktioniert danach **komplett offline** – ganz ohne App Store.

## Was die App kann

- **Gemischtes Training** – zufällige Fragen aus allen Themen
- **Nach Thema lernen** – gezielt einzelne Themengebiete üben, mit Fortschrittsbalken je Thema
- **Schwachstellen wiederholen** – automatisch die noch nicht sicher beherrschten Fragen
- **Prüfungssimulation** – 30 Fragen, bestanden ab 50 % (wie in der echten Prüfung)
- **Prüfungsgetreues Format** – Multiple-Choice mit *mehreren* richtigen Antworten; nur *vollständig* richtig zählt (kein Teilpunkt, § 5 der Prüfungsordnung)
- **Erklärung zu jeder Frage** – der Lerninhalt wird vermittelt, nicht nur abgefragt
- **Gamification** – XP, Level, Tages-Serie (Streak) und Erfolge/Badges
- **Fragen als „fragwürdig" melden** – ein Tipp unter der Frage öffnet einen kleinen Dialog: melden mit oder ohne Kommentar, ohne die Frage zu verlassen (am Laptop: Taste **M**). Gesammelt unter *Einstellungen → Gemeldete Fragen* und als Text/Datei exportierbar
- **Meldungen als Backlog** – der Export ist eine Liste zum Abhaken; `node tools/reports-to-backlog.mjs <export.md>` pflegt daraus [`docs/fragen-backlog.md`](docs/fragen-backlog.md)
- **Updates ohne Neuinstallieren** – *Einstellungen → App-Version → „Nach Updates suchen"* holt die neueste Fassung von GitHub Pages
- **Fortschritt bleibt gespeichert** (lokal auf dem Gerät, kein Konto, kein Server)

## Auf dem iPhone installieren

1. Die App-URL in **Safari** öffnen (siehe Abschnitt *Hosting*).
2. Unten auf das **Teilen-Symbol** tippen.
3. **„Zum Home-Bildschirm"** wählen → *Hinzufügen*.
4. Fertig – die App startet im Vollbild und läuft offline.

## Hosting (z. B. kostenlos über GitHub Pages)

Der komplette App-Code liegt im **Repository-Root** (`index.html` usw.). Zum
Bereitstellen genügt ein beliebiger statischer Webserver (HTTPS erforderlich,
damit der Offline-Modus/Service Worker funktioniert). Mit **GitHub Pages**:
Repository-Einstellungen → *Pages* → *Deploy from a branch* → gewünschten
Branch und Ordner `/(root)` wählen → *Save*. Danach ist die App unter der
Pages-URL erreichbar.

Lokal testen:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen
```

## Geräteübergreifende Synchronisation (Cloud-Sync)

Standardmäßig speichert die App den Fortschritt **lokal** auf dem Gerät. Damit
der Fortschritt **auf allen Geräten gleich** ist (und weiterlernen auf iPhone,
iPad, Laptop … möglich wird), kann optional ein kostenloses **Supabase**-Projekt
angebunden werden. GitHub Pages bleibt der Host; Supabase speichert nur den
Fortschritt. Identifiziert wird über einen geheimen **Sync-Code** – kein
Passwort/Login nötig.

**Einmalige Einrichtung (einmal für das Projekt):**

1. Kostenloses Konto auf [supabase.com](https://supabase.com) anlegen und ein
   **neues Projekt** erstellen (Region z. B. Europe, „Enable Data API" an).
   Das Datenbank-Passwort wird für die App **nicht** benötigt.
2. Im Projekt links **SQL Editor** öffnen, folgendes Snippet einfügen und **Run**:

   ```sql
   -- Tabelle für den Lernfortschritt (ein Datensatz je Sync-Code)
   create table if not exists public.progress (
     code       text primary key,
     data       jsonb not null,
     updated_at timestamptz not null default now()
   );

   -- Direktzugriff sperren (RLS an, keine Policies) …
   alter table public.progress enable row level security;

   -- … Zugriff nur über zwei Funktionen, die den Sync-Code kennen müssen:
   create or replace function public.sync_pull(p_code text)
   returns jsonb language sql security definer set search_path = public as $$
     select data from public.progress where code = p_code;
   $$;

   create or replace function public.sync_push(p_code text, p_data jsonb)
   returns void language plpgsql security definer set search_path = public as $$
   begin
     insert into public.progress(code, data, updated_at)
     values (p_code, p_data, now())
     on conflict (code) do update set data = excluded.data, updated_at = now();
   end;
   $$;

   grant execute on function public.sync_pull(text)        to anon;
   grant execute on function public.sync_push(text, jsonb)  to anon;
   ```

3. **Project-URL** und **anon public key** kopieren: Projekt → *Settings* →
   *API* (bzw. *Data API*). Beide Werte dürfen öffentlich sein – die Daten
   schützt der geheime Sync-Code + die Funktionen oben.
4. In **[`config.js`](config.js)** eintragen und committen/pushen:

   ```js
   window.ADT_CONFIG = {
     supabaseUrl: "https://DEINPROJEKT.supabase.co",
     supabaseAnonKey: "eyJhbGciOi… (langer anon-Key)",
   };
   ```

**Nutzung (in der App, unter „Geräte-Sync"):**

- **Gerät 1:** „Neuen Sync-Code erstellen" → der Code wird angezeigt (aufschreiben/kopieren).
- **Gerät 2:** „Mit vorhandenem Code verbinden" → Code eingeben. Der Fortschritt
  wird zusammengeführt und ab dann automatisch abgeglichen (beim Öffnen, bei
  Änderungen und sobald wieder online).

> **Robustheit:** Die App bleibt voll **offline-fähig** – lokal wird immer
> gespeichert, der Cloud-Abgleich passiert im Hintergrund und stört nie den
> Lernfluss. Zusammengeführt wird verlustarm (Fortschrittswerte wachsen nur,
> gehen nie verloren).

### Härtung der Funktionen (empfohlen ausführen)

Damit die offenen `anon`-Funktionen nicht missbraucht werden können (Code-Länge prüfen,
Datensatzgröße begrenzen), einmal **[`supabase/sync-hardening.sql`](supabase/sync-hardening.sql)**
im **SQL Editor** ausführen. Ersetzt `sync_pull`, `sync_push` und `push_save` per
`create or replace` – gefahrlos wiederholbar. Empfohlen für den laufenden Betrieb.

## Lern-Erinnerungen (Web Push, optional)

Tägliche Push-Erinnerung ans Üben. Auf dem **iPhone** funktioniert Web Push nur,
wenn die App **zum Home-Bildschirm hinzugefügt** ist (iOS 16.4+) und die Nutzerin
Benachrichtigungen erlaubt. Der Versand läuft über eine **Supabase Edge Function**,
die stündlich per Zeitplan prüft, wer zur eingestellten Uhrzeit dran ist.

**Bausteine:** VAPID-Schlüssel · Tabelle + Funktionen · Edge Function · Zeitplan.

1. **VAPID-Schlüssel** (Signatur für Web Push). Einmal erzeugen, z. B.:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Den **öffentlichen** Schlüssel in [`config.js`](config.js) bei `vapidPublicKey`
   eintragen (darf öffentlich sein). Den **privaten** gut aufbewahren – der kommt
   nur als Secret in die Edge Function, **nie** ins Repo.

2. **Datenbank**: [`supabase/reminders-setup.sql`](supabase/reminders-setup.sql)
   im **SQL Editor** ausführen (Tabelle `push_subscriptions` + Funktionen
   `push_save` / `push_remove`).

3. **Edge Function** deployen – Code liegt in
   [`supabase/functions/send-reminders/index.ts`](supabase/functions/send-reminders/index.ts):
   ```bash
   supabase functions deploy send-reminders --no-verify-jwt
   ```
   (oder im Dashboard unter *Edge Functions* neu anlegen und den Code einfügen).
   Dann **Secrets** setzen (Dashboard → Edge Functions → *Manage secrets*):
   - `VAPID_PUBLIC` = öffentlicher Schlüssel
   - `VAPID_PRIVATE` = privater Schlüssel
   - `CRON_SECRET` = frei gewähltes Geheimnis
   - `VAPID_SUBJECT` = optional, z. B. `mailto:du@example.com`

4. **Zeitplan**: Extensions **pg_cron** und **pg_net** aktivieren
   (Database → Extensions), dann den `cron.schedule`-Block am Ende der
   `reminders-setup.sql` (URL + `CRON_SECRET` anpassen) ausführen.

**Testen:** In der App → *Sync & Sicherung* → *Lern-Erinnerungen* → Uhrzeit wählen
→ *Erinnerung aktivieren* (Benachrichtigung erlauben). Der Button **„Test senden"**
zeigt sofort eine lokale Beispiel-Benachrichtigung. Den echten Serverversand kannst
du prüfen, indem du die Edge Function einmal manuell mit dem `x-cron-secret`-Header
aufrufst.

> Solange `vapidPublicKey` in `config.js` leer ist oder die Server-Teile fehlen,
> zeigt die App im Erinnerungs-Bereich einen Hinweis – der Rest funktioniert normal.

## Fragen ergänzen oder anpassen

Alle Fragen stehen in **[`data/questions.js`](data/questions.js)**.
Jede Frage hat ein einfaches Format (Thema, Schwierigkeit, Typ, Optionen,
richtige Antworten, Erklärung). Neue Fragen einfach an das Array anhängen –
die App validiert das Format beim Start und meldet Fehler in der Konsole.

> **Wichtig zum Inhalt:** Die aktuell enthaltenen Fragen sind sorgfältig nach
> stabilen Fachstandards (UICC/TNM, ICD-O-3, ICD-10, ADT/GEKID-Basisdatensatz,
> § 65c SGB V) formuliert und dienen dem Üben. Sie sind **nicht** die offiziellen
> ADT-Prüfungsfragen. Für maximale Passgenauigkeit sollten die offiziellen
> Kursunterlagen/Beispielfragen eingearbeitet werden (siehe unten).

## Fragen-Feedback: von der Meldung zur korrigierten Frage

Beim Üben fällt am ehesten auf, wenn eine Frage falsch, unklar oder fehlerhaft ist.
Dafür sitzt unter **jeder** Frage (Übung und Prüfungs-Auswertung) der Knopf
**„Frage melden"** 🚩 – am Laptop auch Taste **M**. Ein Tipp öffnet einen kleinen
Dialog über der Frage: melden mit oder ohne Kommentar, danach geht es dort weiter,
wo man war. Der komplette Weg:

1. **Melden** (in der App, beim Üben) – optionaler Kommentar, z. B. „Antwort B ist auch richtig".
2. **Sammeln**: *Einstellungen → Fragen-Feedback → Gemeldete Fragen*. Dort ist jede
   Meldung mit Fragetext, Thema, ID und Datum aufgelistet, die Notiz bleibt änderbar.
3. **Exportieren**: „Als Datei" (Markdown) oder „Alle kopieren". Der Export ist bereits
   ein **Backlog zum Abhaken** – je Frage ein Kästchen, darunter Notiz, Fragetext,
   Antwortmöglichkeiten (richtige markiert), Lösung und Erklärung.
4. **Als GitHub-Issue** – ein Issue je Frage, damit jeder Vorgang für sich geschlossen
   werden kann. Zwei Wege, die App nimmt automatisch den besseren:
   - **Direkt** (wenn die Edge Function eingerichtet ist, siehe unten): Tipp auf „Als Issue",
     das Issue entsteht sofort, man **bleibt in der App**. Danach steht „Issue #12 angelegt"
     mit Link am Eintrag.
   - **Über das Formular** (ohne Serverteil): GitHub öffnet sich mit fertig ausgefülltem
     Titel und Text – dort nur noch „Create" tippen. Der Eintrag ist dann als
     „Issue vorbereitet am …" markiert.

   Zielrepo für den Formular-Weg ist `feedbackRepo` in [`config.js`](config.js).

   > **Das Zielrepo muss privat sein.** Der Issue-Text enthält den Fragetext, und die
   > Lerninhalte sind zugangsgeschützt (`contentGated: true`). Voreingestellt ist deshalb das
   > private `allawallabedalla/Secret` – nicht das öffentliche App-Repo. Ist `feedbackRepo`
   > leer, erscheinen die Knöpfe gar nicht.

5. **Oder als Datei ins Repo übernehmen**:

   ```bash
   node tools/reports-to-backlog.mjs ~/Downloads/adt-trainer-gemeldete-fragen-2026-08-06.md
   ```

   Das pflegt **[`docs/fragen-backlog.md`](docs/fragen-backlog.md)**: neue IDs kommen
   unter *Offen* dazu, **abgehakte Einträge bleiben abgehakt** (unter *Erledigt*),
   **vorhandene Einträge werden nie überschrieben** – Notizen von Hand bleiben stehen.
   Denselben Export mehrfach einspielen ändert nichts.
6. **Korrigieren**: Die Frage in der Inhalts-Quelle anpassen und neu ausliefern – bei
   `contentGated: true` liegen die Fragen **nicht** im Repo, sondern in Supabase
   (gebaut über die Pipeline im `Secret`-Repo, siehe `supabase/content-gate.sql`).
   Ohne Zugangsschutz: direkt in [`data/questions.js`](data/questions.js).
7. **Abhaken** im Backlog – erledigt wird nur durchs Häkchen, nichts verschwindet von allein.

> **Wo liegen die Meldungen?** Lokal im `localStorage` (im selben Datensatz wie der
> Lernfortschritt) und – falls Geräte-Sync aktiv ist – zusätzlich in Supabase. **Nicht**
> in git: Erst der Export bringt sie ins Repo. „Fortschritt zurücksetzen" löscht sie
> bewusst nicht (Feedback ist kein Lernfortschritt).

### Issues direkt anlegen (optional, ohne GitHub-Umweg)

Damit die App das Issue **selbst** anlegen kann, braucht es einen kleinen Serverteil: Ein
GitHub-Token darf **niemals** in eine öffentlich ausgelieferte Web-App, deshalb hält ihn eine
**Supabase Edge Function**. Die App schickt nur die Meldung dorthin und bekommt die
Issue-Nummer zurück.

1. **Tabelle anlegen**: [`supabase/feedback-issues.sql`](supabase/feedback-issues.sql) im
   SQL Editor ausführen (Dublettenschutz + Mengenbegrenzung).
2. **Token erzeugen**: GitHub → Settings → Developer settings → **Fine-grained personal access
   token**. *Repository access:* nur das Ziel-Repo. *Permissions:* **Issues: Read and write** –
   sonst nichts. Kurze Laufzeit wählen und im Kalender vermerken (abgelaufene Tokens sind der
   häufigste Grund, warum es später „plötzlich nicht mehr geht").
3. **Function deployen**:

   ```bash
   supabase functions deploy create-issue --no-verify-jwt
   ```

4. **Secrets setzen** (Dashboard → Edge Functions → *Manage secrets*):
   - `GITHUB_TOKEN` = der Token aus Schritt 2
   - `GITHUB_REPO` = `owner/repo` des **privaten** Ziel-Repos

**Schutz:** Der Endpunkt ist – wie alle anon-Endpunkte – offen erreichbar. Er verlangt deshalb
den **Zugangscode** der Lerninhalte (Prüfung serverseitig gegen `content_gate`, gleiche Quelle
wie `get_content`), legt **je Frage höchstens ein Issue** an (ein zweiter Aufruf liefert das
vorhandene zurück) und deckelt auf **30 neue Issues pro Stunde**.

**Ohne diese Einrichtung** funktioniert alles weiter – die App fällt dann automatisch auf den
Formular-Weg zurück und sagt in einem Satz, warum.

## Updates ausliefern (GitHub Pages)

Ein Push auf den Pages-Branch **ist** das Deployment – eine Neuinstallation auf dem
iPhone ist nie nötig. Bei den Nutzerinnen kommt die neue Fassung so an:

- **Von allein**: Der Service Worker lädt die neue Shell im Hintergrund; spätestens beim
  übernächsten Start läuft sie. Liegt ein neuer Service Worker bereit, erscheint zusätzlich
  das In-App-Banner „Neue Version verfügbar".
- **Sofort auf Wunsch**: *Einstellungen → App-Version → „Nach Updates suchen"*. Die App holt
  die Shell frisch, vergleicht die ausgelieferte mit der laufenden `APP_VERSION` und bietet
  das Neuladen an. Der Lernfortschritt bleibt dabei erhalten.

> **Einmaliger Sonderfall:** Ein Gerät, auf dem noch eine Version **vor 0.31.0** läuft, kennt
> den Knopf naturgemäß nicht. Für diesen einen Sprung: App aus dem App-Umschalter wischen und
> zweimal öffnen (erster Start lädt im Hintergrund, zweiter startet die neue Fassung). Danach
> genügt immer der Knopf.

**Beim Ausliefern zu beachten:** `APP_VERSION` in [`js/app.js`](js/app.js) erhöhen – die App
und `sw.js` vergleichen genau diesen Wert (`sw.js` liest die Deklarationszeile per Regex aus
der ausgelieferten Datei). Ohne Erhöhung meldet die Update-Prüfung „bereits aktuell",
obwohl die Dateien frisch geholt wurden.

## Struktur

```
(Repository-Root)
├── index.html              App-Grundgerüst
├── manifest.webmanifest    PWA-Manifest (Name, Icons, Standalone)
├── sw.js                   Service Worker (Offline-Cache)
├── config.js               Cloud-Sync-Konfiguration (Supabase-Werte)  ← für Sync eintragen
├── css/styles.css          Design (Light/Dark, iOS-optimiert)
├── js/app.js               App-Logik (Quiz-Engine, Gamification)
├── js/sync.js              Cloud-Sync (Merge-Logik, Supabase-Anbindung)
├── data/questions.js       Fragen-Datenbank  ← hier Inhalte pflegen
├── docs/fragen-backlog.md  Arbeitsliste der gemeldeten Fragen (per Werkzeug gepflegt)
├── tools/                  Werkzeuge (u. a. reports-to-backlog.mjs)
├── tests/                  Testnetz – `bash tests/run.sh`
└── icons/                  App-Icons (PNG)
```

## Grundlage

Basiert auf der Prüfungsordnung „Tumordokumentar/in" der Arbeitsgemeinschaft
Deutscher Tumorzentren e. V. (ADT), Stand 08/2022 (siehe PDF im Repo):
schriftliche Prüfung, MC-Fragen mit mehrfach richtigen Antworten sowie
Dokumentations-/Rechenaufgaben, 180 Minuten, bestanden ab 50 %.
