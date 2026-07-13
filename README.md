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
└── icons/                  App-Icons (PNG)
```

## Grundlage

Basiert auf der Prüfungsordnung „Tumordokumentar/in" der Arbeitsgemeinschaft
Deutscher Tumorzentren e. V. (ADT), Stand 08/2022 (siehe PDF im Repo):
schriftliche Prüfung, MC-Fragen mit mehrfach richtigen Antworten sowie
Dokumentations-/Rechenaufgaben, 180 Minuten, bestanden ab 50 %.
