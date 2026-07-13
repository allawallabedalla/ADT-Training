-- Lern-Erinnerungen (Web Push) – Datenbank-Setup
-- Im Supabase SQL Editor ausführen. Ergänzt die bestehende Sync-Einrichtung.

-- 1) Tabelle für Push-Anmeldungen
create table if not exists public.push_subscriptions (
  endpoint       text primary key,
  sub            jsonb not null,          -- vollständige PushSubscription (endpoint + keys)
  hour           int   not null default 18,   -- gewünschte Stunde (0–23) in lokaler Zeit
  tz             text  not null default 'Europe/Berlin',
  enabled        boolean not null default true,
  last_sent_date date,                     -- verhindert Mehrfachversand pro Tag
  created_at     timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
-- Kein Direktzugriff: nur über die Funktionen unten (bzw. service_role in der Edge Function).

-- 2) Anmeldung speichern/aktualisieren (vom Client per anon-Key aufgerufen)
create or replace function public.push_save(p_endpoint text, p_sub jsonb, p_hour int, p_tz text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint is null or length(p_endpoint) < 10 then raise exception 'invalid endpoint'; end if;
  if p_hour is null or p_hour < 0 or p_hour > 23 then raise exception 'invalid hour'; end if;
  insert into public.push_subscriptions(endpoint, sub, hour, tz, enabled, last_sent_date)
  values (p_endpoint, p_sub, p_hour, coalesce(p_tz, 'Europe/Berlin'), true, null)
  on conflict (endpoint) do update
    set sub = excluded.sub, hour = excluded.hour, tz = excluded.tz,
        enabled = true, last_sent_date = null;
end;
$$;

-- 3) Abmeldung
create or replace function public.push_remove(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

grant execute on function public.push_save(text, jsonb, int, text) to anon;
grant execute on function public.push_remove(text)                  to anon;

-- 4) Stündlicher Zeitplan (benötigt Extensions pg_cron + pg_net:
--    Dashboard → Database → Extensions → pg_cron und pg_net aktivieren).
--    URL an dein Projekt anpassen und DEIN_CRON_SECRET wie im Edge-Function-Secret setzen.
--
-- select cron.schedule('adt-reminders-hourly', '0 * * * *', $CRON$
--   select net.http_post(
--     url     := 'https://DEINPROJEKT.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','DEIN_CRON_SECRET'),
--     body    := '{}'::jsonb
--   );
-- $CRON$);
--
-- Zum Entfernen: select cron.unschedule('adt-reminders-hourly');
