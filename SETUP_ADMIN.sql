-- Foundational Edge Admin — RPCs for the internal admin site
-- (foundational-edge-admin repo). Run this in the Supabase SQL editor for
-- project wwmbpgtddsyettfdakbe, AFTER the main site's SETUP_QUIZZES.sql
-- has already run.
--
-- IMPORTANT SECURITY NOTE: the admin site has no login. These functions
-- are granted to `anon` (the same public API key already embedded in
-- every page of the public site), exactly like every other RPC in this
-- project. That means anyone who finds the admin site's URL and reads
-- its JavaScript can call these functions directly, without needing the
-- admin UI at all — there is no server-side check distinguishing "the
-- admin" from anyone else with the anon key. This is a deliberate
-- trade-off requested (no login for v1), not an oversight. If/when this
-- matters more, consider putting the admin site behind Cloudflare Access,
-- a shared-passphrase gate, or an IP allowlist — none of which require
-- rewriting these functions.
--
-- Safe to run multiple times.

-- =========================================================
-- 1. admin_list_quizzes(grade) — every quiz for a grade (active or not,
--    expired or not), with a live question count. Used to render the
--    grade-filtered, type-sectioned quiz list in the admin UI.
-- =========================================================
create or replace function public.admin_list_quizzes(p_grade text)
returns table (
  id uuid,
  quiz_type text,
  grade text,
  skill text,
  max_attempts integer,
  publish_date date,
  expiry_date date,
  title text,
  active boolean,
  created_at timestamptz,
  question_count bigint
)
language sql
security definer
set search_path = public
as $$
  select z.id, z.quiz_type, z.grade, z.skill, z.max_attempts, z.publish_date,
         z.expiry_date, z.title, z.active, z.created_at,
         (select count(*) from questions q where q.quiz_id = z.id) as question_count
  from quizzes z
  where z.grade = p_grade
  order by z.quiz_type, z.publish_date desc;
$$;

revoke all on function public.admin_list_quizzes(text) from public;
grant execute on function public.admin_list_quizzes(text) to anon;

-- =========================================================
-- 2. admin_create_quiz(...) — creates a new quiz row, returns its id
--    (needed immediately so the admin can upload questions/images
--    against the right quiz_id / Quiz/<id>/ Storage path).
-- =========================================================
create or replace function public.admin_create_quiz(
  p_quiz_type text,
  p_grade text,
  p_skill text,
  p_max_attempts integer,
  p_publish_date date,
  p_expiry_date date,
  p_title text
)
returns table (id uuid)
language sql
security definer
set search_path = public
as $$
  insert into quizzes (quiz_type, grade, skill, max_attempts, publish_date, expiry_date, title)
  values (p_quiz_type, p_grade, p_skill, p_max_attempts, p_publish_date, p_expiry_date, p_title)
  returning quizzes.id;
$$;

revoke all on function public.admin_create_quiz(text, text, text, integer, date, date, text) from public;
grant execute on function public.admin_create_quiz(text, text, text, integer, date, date, text) to anon;

-- =========================================================
-- 3. admin_expire_quiz(quiz_id) — soft-delete: sets active = false.
--    Existing attempts/questions are untouched and stay reviewable.
-- =========================================================
create or replace function public.admin_expire_quiz(p_quiz_id uuid)
returns table (success boolean)
language sql
security definer
set search_path = public
as $$
  update quizzes set active = false where id = p_quiz_id
  returning true;
$$;

revoke all on function public.admin_expire_quiz(uuid) from public;
grant execute on function public.admin_expire_quiz(uuid) to anon;

-- =========================================================
-- 4. admin_get_questions(quiz_id) — full question detail (including
--    correct_answer/explanation, unlike the public get_quiz_questions)
--    for the admin's question list, editing, and CSV export.
-- =========================================================
create or replace function public.admin_get_questions(p_quiz_id uuid)
returns table (
  id uuid,
  section text,
  difficulty text,
  order_num integer,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text,
  explanation text,
  image_url text,
  active boolean
)
language sql
security definer
set search_path = public
as $$
  select q.id, q.section, q.difficulty, q.order_num, q.question_text,
         q.option_a, q.option_b, q.option_c, q.option_d,
         q.correct_answer, q.explanation, q.image_url, q.active
  from questions q
  where q.quiz_id = p_quiz_id
  order by q.order_num;
$$;

revoke all on function public.admin_get_questions(uuid) from public;
grant execute on function public.admin_get_questions(uuid) to anon;

-- =========================================================
-- 5. admin_bulk_insert_questions(quiz_id, questions) — inserts many
--    questions at once from the admin's parsed Excel upload.
--    p_questions is a jsonb array of objects, one per question:
--    { "section": "...", "difficulty": "...", "order_num": 1,
--      "question_text": "...", "option_a": "...", "option_b": "...",
--      "option_c": "...", "option_d": "...", "correct_answer": "A",
--      "explanation": "...", "image_url": null }
-- =========================================================
create or replace function public.admin_bulk_insert_questions(
  p_quiz_id uuid,
  p_questions jsonb
)
returns table (inserted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_count integer := 0;
begin
  for v_item in select * from jsonb_array_elements(p_questions)
  loop
    insert into questions (
      quiz_id, section, difficulty, order_num, question_text,
      option_a, option_b, option_c, option_d, correct_answer, explanation, image_url
    ) values (
      p_quiz_id,
      v_item ->> 'section',
      v_item ->> 'difficulty',
      (v_item ->> 'order_num')::integer,
      v_item ->> 'question_text',
      v_item ->> 'option_a',
      v_item ->> 'option_b',
      v_item ->> 'option_c',
      v_item ->> 'option_d',
      v_item ->> 'correct_answer',
      v_item ->> 'explanation',
      nullif(v_item ->> 'image_url', '')
    );
    v_count := v_count + 1;
  end loop;

  return query select v_count;
end;
$$;

revoke all on function public.admin_bulk_insert_questions(uuid, jsonb) from public;
grant execute on function public.admin_bulk_insert_questions(uuid, jsonb) to anon;

-- =========================================================
-- 6. admin_set_question_image(question_id, image_url) — used after the
--    admin manually uploads an image to Quiz/<quiz_id>/<filename> in the
--    Storage dashboard and pastes the filename into the admin UI; the
--    admin site builds the full URL and saves it via this function.
-- =========================================================
create or replace function public.admin_set_question_image(
  p_question_id uuid,
  p_image_url text
)
returns table (success boolean)
language sql
security definer
set search_path = public
as $$
  update questions set image_url = nullif(p_image_url, '') where id = p_question_id
  returning true;
$$;

revoke all on function public.admin_set_question_image(uuid, text) from public;
grant execute on function public.admin_set_question_image(uuid, text) to anon;
