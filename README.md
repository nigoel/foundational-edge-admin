# Foundational Edge — Admin

Internal admin site for managing quizzes and questions on the
[Foundational Edge](https://github.com/nigoel/foundational-edge) public
site. Plain static HTML/JS talking directly to the same Supabase project
— no build step, no framework, no login.

## ⚠️ No login — treat the URL as private

This site has **no authentication**. Every write operation (create quiz,
expire quiz, upload questions, set an image) goes through a Supabase RPC
function granted to the `anon` role — the same public API key already
embedded in the public site's HTML. There is no server-side check that
distinguishes "the admin" from anyone else who knows this key and these
function names.

This was a deliberate choice for v1 (simplicity over auth), not an
oversight. Practical implications:

- Don't link to this site from anywhere public.
- Anyone with the URL (and a browser console) could create, edit, or
  retire quizzes.
- If this becomes a real concern, consider putting the site behind
  [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/),
  a shared-passphrase gate, or an IP allowlist — none of which require
  changing the RPC functions themselves.

## One-time setup

Run `SETUP_ADMIN.sql` in the Supabase SQL editor for project
`wwmbpgtddsyettfdakbe`, **after** the main site's `SETUP_QUIZZES.sql` has
already run (this depends on the `quizzes`/`questions`/`quiz_attempts`
schema it creates).

For the assignments feature (see below), also run `SETUP_ADMIN_ASSIGNMENTS.sql`
**after** the main site's `SETUP_CHILD_ASSIGNMENTS.sql` has run (that's
where the `assignments` table itself comes from).

## Deploying

This is a static site — same deployment pattern as the public
`foundational-edge` repo (e.g. a Cloudflare Worker/Pages project pointed
at this repo, serving the files as-is). No build step.

## What it does

- **Grade filter** across the top — pick a grade, see every quiz for it,
  grouped into three sections: Free Skill Test, Weekly Practice, Monthly
  Competition.
- Each quiz shows its id, title, publish/expiry dates, question count,
  max attempts, and a status pill (**Active** / **Expired** / **Retired**).
- Per quiz: **Preview** (opens the exact quiz as a student would see it,
  via `previewQuizId` on the public site — works even for a draft or
  retired quiz, not just whichever one the site currently picks as
  "active" for that grade), **Download CSV** (full question + answer key
  export), **Manage questions**, **Assignments** (see below), **Expire**
  (soft-delete — sets `active = false`; past attempts and the quiz's
  history stay intact).
- **Assignments screen**: who's currently assigned to this quiz (child
  name, parent, WhatsApp, and completed/not-attempted status with their
  latest score), filterable by **All / Completed / Not attempted**. Below
  that, every registered child in the quiz's own grade who *isn't* already
  assigned — check individual boxes and **Assign selected**, or use each
  row's own **Assign** button for one at a time. Note: this is layered on
  top of the main site's existing grade-wide broadcast model (every quiz
  is already shown to its whole grade) — assigning here targets specific
  kids individually, in addition to that.
- **+ New quiz** — a form for grade, quiz type, skill focus, max
  attempts, publish/expiry dates, and an optional title. Creating one
  drops you straight into its (empty) question list.
- **Manage questions** screen: shows this quiz's exact Storage upload
  path (`Quiz/<quiz_id>/`), an Excel upload box, and a table of current
  questions with a **Set image** action per row (paste the filename you
  uploaded to that quiz's Storage folder; the admin site builds the full
  URL and saves it).

## Excel upload format

The first sheet of the uploaded `.xlsx`/`.xls` file needs these column
headers (row 1):

| Column | Required? | Notes |
|---|---|---|
| `section` | Yes | e.g. `Logical Reasoning` |
| `difficulty` | No | free text, for your own reference |
| `order_num` | Yes | controls display order within the quiz |
| `question_text` | Yes | |
| `option_a` / `option_b` / `option_c` / `option_d` | Yes | |
| `correct_answer` | Yes | `A`, `B`, `C`, or `D` (case-insensitive) |
| `explanation` | No | shown to the student after they submit |
| `image_filename` | No | just the filename — **not** a full URL. Upload the actual image file separately to `Quiz/<quiz_id>/<filename>` in Supabase Storage (the storage path box on the quiz's page shows the exact folder); the admin site builds the full public URL from the filename you put here. |

Rows missing a required column, with an invalid `correct_answer`, or a
non-numeric `order_num` are skipped (with an on-screen error listing
which rows and why) — everything else still uploads.
