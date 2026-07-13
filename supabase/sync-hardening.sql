-- Pflicht-Härtung der anon-Funktionen (im Supabase SQL Editor ausführen).
-- Ersetzt die Funktionen per create-or-replace – gefahrlos wiederholbar.
-- Prüft Code-Länge und begrenzt die Datensatzgröße (Schutz vor Missbrauch/Kostentreiben).

-- Sync: Lesen (Code-Länge prüfen)
create or replace function public.sync_pull(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_code is null or length(p_code) < 16 or length(p_code) > 64 then
    raise exception 'invalid code';
  end if;
  return (select data from public.progress where code = p_code);
end;
$$;

-- Sync: Schreiben (Code-Länge + max. ~200 KB Fortschritt)
create or replace function public.sync_push(p_code text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_code is null or length(p_code) < 16 or length(p_code) > 64 then
    raise exception 'invalid code';
  end if;
  if pg_column_size(p_data) > 200000 then
    raise exception 'payload too large';
  end if;
  insert into public.progress(code, data, updated_at)
  values (p_code, p_data, now())
  on conflict (code) do update set data = excluded.data, updated_at = now();
end;
$$;

-- Push-Abo: Endpoint-/Stunde-Prüfung + max. ~8 KB Subscription
create or replace function public.push_save(p_endpoint text, p_sub jsonb, p_hour int, p_tz text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint is null or length(p_endpoint) < 10 or length(p_endpoint) > 1000 then
    raise exception 'invalid endpoint';
  end if;
  if p_hour is null or p_hour < 0 or p_hour > 23 then raise exception 'invalid hour'; end if;
  if pg_column_size(p_sub) > 8000 then raise exception 'subscription too large'; end if;
  insert into public.push_subscriptions(endpoint, sub, hour, tz, enabled, last_sent_date)
  values (p_endpoint, p_sub, p_hour, coalesce(p_tz, 'Europe/Berlin'), true, null)
  on conflict (endpoint) do update
    set sub = excluded.sub, hour = excluded.hour, tz = excluded.tz, enabled = true, last_sent_date = null;
end;
$$;

-- Hinweis: Die App erzeugt Sync-Codes mit 19 Zeichen (>= 16), Prüfung greift also nicht bei echten Codes.
