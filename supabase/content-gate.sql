-- =====================================================================
--  Zugangsschutz für die Lerninhalte (im Supabase SQL Editor ausführen).
--  Ziel: Die Fragen liegen NICHT mehr öffentlich im Code, sondern in der
--  Datenbank und werden nur mit korrektem Zugangscode herausgegeben.
--  Gefahrlos wiederholbar (create-or-replace / if not exists).
-- =====================================================================

-- 1) Hash-Funktionen (bcrypt)
create extension if not exists pgcrypto;

-- 2) Inhalte: genau EIN Datensatz, Struktur { "TOPICS": {...}, "QUESTIONS": [...] }
create table if not exists public.app_content (
  id         int primary key default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_content_one_row check (id = 1)
);

-- 3) Zugangscode – nur als bcrypt-HASH gespeichert (Klartext steht nirgends)
create table if not exists public.content_gate (
  id        int primary key default 1,
  code_hash text not null,
  constraint content_gate_one_row check (id = 1)
);

-- 4) RLS an, KEINE Policies  →  beide Tabellen sind über die anon-API NICHT direkt lesbar.
alter table public.app_content   enable row level security;
alter table public.content_gate  enable row level security;

-- 5) Einzige Ausgabe: diese Funktion liefert die Inhalte NUR bei korrektem Code.
--    security definer = läuft mit Rechten des Eigentümers und umgeht damit RLS,
--    gibt aber ausschließlich nach bestandener Code-Prüfung etwas zurück.
create or replace function public.get_content(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if p_code is null or length(p_code) < 8 then
    raise exception 'unauthorized';
  end if;
  select (code_hash = crypt(p_code, code_hash)) into ok
    from public.content_gate where id = 1;
  if not coalesce(ok, false) then
    raise exception 'unauthorized';
  end if;
  return (select data from public.app_content where id = 1);
end;
$$;

revoke all on function public.get_content(text) from public;
grant execute on function public.get_content(text) to anon, authenticated;

-- =====================================================================
--  EINMALIG: Zugangscode setzen  (Klartext hier eintragen → wird gehasht)
--  Nimm einen LANGEN, zufälligen Code (z. B. 24+ Zeichen). Bei Verlust/
--  Weitergabe einfach erneut ausführen – alte Geräte müssen dann neu
--  freischalten.
-- =====================================================================
-- insert into public.content_gate(id, code_hash)
-- values (1, crypt('HIER-DEINEN-LANGEN-GEHEIMEN-CODE', gen_salt('bf')))
-- on conflict (id) do update set code_hash = excluded.code_hash;

-- =====================================================================
--  Inhalte einspielen  (macht Claude, sobald dein Material aufbereitet ist)
-- =====================================================================
-- insert into public.app_content(id, data, updated_at)
-- values (1, '{ "TOPICS": { ... }, "QUESTIONS": [ ... ] }'::jsonb, now())
-- on conflict (id) do update set data = excluded.data, updated_at = now();

-- Schnelltest (sollte die Inhalte zurückgeben bzw. bei falschem Code Fehler):
-- select public.get_content('HIER-DEINEN-LANGEN-GEHEIMEN-CODE');
