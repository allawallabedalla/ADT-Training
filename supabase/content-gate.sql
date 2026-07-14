-- =====================================================================
--  Zugangsschutz für die Lerninhalte (im Supabase SQL Editor ausführen).
--  Ziel: Die Fragen liegen NICHT mehr öffentlich im Code, sondern in der
--  Datenbank und werden nur mit korrektem Zugangscode herausgegeben.
--  Gefahrlos wiederholbar (create-or-replace / if not exists).
-- =====================================================================

-- 1) Inhalte: genau EIN Datensatz, Struktur { "TOPICS": {...}, "QUESTIONS": [...] }
create table if not exists public.app_content (
  id         int primary key default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_content_one_row check (id = 1)
);

-- 2) Zugangscode – SHA256-HASH gespeichert (Supabase-kompatibel, kein pgcrypto nötig)
create table if not exists public.content_gate (
  id        int primary key default 1,
  code_hash text not null,
  constraint content_gate_one_row check (id = 1)
);

-- 3) RLS an, KEINE Policies  →  beide Tabellen sind über die anon-API NICHT direkt lesbar.
alter table public.app_content   enable row level security;
alter table public.content_gate  enable row level security;

-- 4) Einzige Ausgabe: diese Funktion liefert die Inhalte NUR bei korrektem Code.
--    security definer = läuft mit Rechten des Eigentümers und umgeht damit RLS,
--    gibt aber ausschließlich nach bestandener Code-Prüfung etwas zurück.
create or replace function public.get_content(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  stored_code text;
begin
  if p_code is null or length(p_code) < 4 then
    raise exception 'unauthorized';
  end if;

  select code_hash into stored_code from public.content_gate where id = 1;

  if stored_code is null or p_code != stored_code then
    raise exception 'unauthorized';
  end if;

  return (select data from public.app_content where id = 1);
end;
$$;

revoke all on function public.get_content(text) from public;
grant execute on function public.get_content(text) to anon, authenticated;

-- =====================================================================
--  EINMALIG: Zugangscode setzen
--  Nimm einen LANGEN, zufälligen Code (z. B. 12+ Zeichen). Bei Verlust/
--  Weitergabe einfach erneut ausführen – alte Geräte müssen dann neu
--  freischalten.
-- =====================================================================
-- update public.content_gate
-- set code_hash = 'HIER-DEINEN-LANGEN-GEHEIMEN-CODE'
-- where id = 1;

-- =====================================================================
--  Inhalte einspielen  (macht Claude, sobald dein Material aufbereitet ist)
-- =====================================================================
-- insert into public.app_content(id, data, updated_at)
-- values (1, '{ "TOPICS": { ... }, "QUESTIONS": [ ... ] }'::jsonb, now())
-- on conflict (id) do update set data = excluded.data, updated_at = now();

-- Schnelltest (sollte die Inhalte zurückgeben bzw. bei falschem Code Fehler):
-- select public.get_content('HIER-DEINEN-LANGEN-GEHEIMEN-CODE') is not null;
