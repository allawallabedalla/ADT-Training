-- =====================================================================
--  Ablage für direkt angelegte GitHub-Issues (im SQL Editor ausführen).
--  Zweck: Dublettenschutz (je Frage höchstens EIN Issue) und Mengen-
--  begrenzung für die Edge Function `create-issue`.
--  Gefahrlos wiederholbar.
-- =====================================================================

create table if not exists public.feedback_issues (
  question_id  text primary key,
  issue_number integer not null,
  issue_url    text not null,
  created_at   timestamptz not null default now()
);

-- Für die Stunden-Zählung der Mengenbegrenzung.
create index if not exists feedback_issues_created_at_idx
  on public.feedback_issues (created_at desc);

-- RLS an, KEINE Policies → über die anon-API nicht lesbar/schreibbar.
-- Die Edge Function greift mit dem Service-Role-Key zu und umgeht RLS bewusst.
alter table public.feedback_issues enable row level security;

-- Aufräumen (optional): Ein Eintrag verhindert dauerhaft ein zweites Issue zur
-- selben Frage. Wurde ein Issue in GitHub gelöscht und soll neu angelegt werden:
--   delete from public.feedback_issues where question_id = 'tnm-012';
