-- Foundational Edge Admin — RPCs for managing per-child quiz assignments.
-- Run this in the Supabase SQL editor for project wwmbpgtddsyettfdakbe,
-- AFTER SETUP_ADMIN.sql (this repo) and SETUP_CHILD_ASSIGNMENTS.sql (the
-- main foundational-edge repo, which creates the `assignments` table)
-- have both already run.
--
-- Same no-login trade-off as every other function in SETUP_ADMIN.sql —
-- see that file's header for the full explanation. These functions are
-- granted to anon with no password/session check, consistent with the
-- rest of this admin site for now.
--
-- Safe to run multiple times.

-- =========================================================
-- 7. admin_get_assignments(quiz_id) — everyone currently assigned to a
--    quiz, with their latest attempt if any. Powers the assignments list
--    + completed/not-attempted filter on the admin's quiz detail screen.
-- =========================================================
create or replace function public.admin_get_assignments(p_quiz_id uuid)
returns table (
  assignment_id uuid,
  reg_id text,
  child_name text,
  parent_name text,
  whatsapp text,
  assigned_at timestamptz,
  attempts_used bigint,
  latest_score integer,
  latest_total integer,
  latest_attempt_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    a.id, a.reg_id, r.child_name, r.parent_name, r.whatsapp, a.assigned_at,
    coalesce(c.attempts_used, 0), la.score, la.total, la.submitted_at
  from assignments a
  join registrations r on r.id = a.reg_id
  left join lateral (
    select count(*) as attempts_used from quiz_attempts qa
    where qa.reg_id = a.reg_id and qa.quiz_id = a.quiz_id
  ) c on true
  left join lateral (
    select qa.score, qa.total, qa.submitted_at from quiz_attempts qa
    where qa.reg_id = a.reg_id and qa.quiz_id = a.quiz_id
    order by qa.attempt_number desc limit 1
  ) la on true
  where a.quiz_id = p_quiz_id
  order by r.child_name;
$$;

revoke all on function public.admin_get_assignments(uuid) from public;
grant execute on function public.admin_get_assignments(uuid) to anon;


-- =========================================================
-- 8. admin_get_eligible_registrations(quiz_id) — every registered child
--    in this quiz's grade who ISN'T already assigned to it. Powers the
--    "assign more kids" picker, correctly scoped to the quiz's own grade.
-- =========================================================
create or replace function public.admin_get_eligible_registrations(p_quiz_id uuid)
returns table (
  reg_id text,
  child_name text,
  parent_name text,
  whatsapp text,
  grade text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grade text;
begin
  select z.grade into v_grade from quizzes z where z.id = p_quiz_id;

  return query
  select r.id, r.child_name, r.parent_name, r.whatsapp, r.grade
  from registrations r
  where r.grade = v_grade
    and not exists (
      select 1 from assignments a where a.quiz_id = p_quiz_id and a.reg_id = r.id
    )
  order by r.child_name;
end;
$$;

revoke all on function public.admin_get_eligible_registrations(uuid) from public;
grant execute on function public.admin_get_eligible_registrations(uuid) to anon;


-- =========================================================
-- 9. admin_assign_quiz(quiz_id, reg_ids[]) — assign a quiz to one or many
--    children at once. A single-element array covers "assign one at a
--    time" through the exact same function as bulk assign — the admin
--    UI's per-row "Assign" button and "Assign selected" button both call
--    this, just with a shorter or longer array.
-- =========================================================
create or replace function public.admin_assign_quiz(p_quiz_id uuid, p_reg_ids text[])
returns table (assigned_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into assignments (quiz_id, reg_id)
  select p_quiz_id, x from unnest(p_reg_ids) as x
  on conflict (quiz_id, reg_id) do nothing;

  get diagnostics v_count = row_count;
  return query select v_count;
end;
$$;

revoke all on function public.admin_assign_quiz(uuid, text[]) from public;
grant execute on function public.admin_assign_quiz(uuid, text[]) to anon;
