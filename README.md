# Skye Performance Hub (standalone web app)

A real, multi-user version of the Skye Performance Hub: per-staff
scorecards, Q2/Q4 self-ratings and manager sign-off, feedback, due dates,
and whole-school dashboards — built as a Next.js app with Supabase as the
database and sign-in provider, ready to deploy to Vercel.

Compared with the earlier Claude Artifact prototype, this version:

- Lets an administrator **edit staff names and add new staff** from a
  Staff Admin screen (Staff Admin -> roster table and "Add a staff
  member" form).
- **Requires sign-in** (an email magic link — no password) before anyone
  sees anything. Signing in on its own grants nothing: a person only sees
  data once an administrator has added their email to a staff record.
  That link between "signed in" and "allowed to see this" is enforced in
  the database itself (Postgres row-level security), not just in the
  page code, so it holds even if someone calls the API directly.
- Uses real per-manager access rules. A manager genuinely only sees
  their own reports' in-progress reviews; the Claude Artifact platform
  this was prototyped in could only approximate that. See
  `supabase/schema.sql` for the policies themselves.

Finance and Thrive Pastoral Care were left out of the starter data, per
your instruction — add them back from Staff Admin at any time if that
changes.

## What you need before you start

- A free [Supabase](https://supabase.com) account.
- A free [Vercel](https://vercel.com) account.
- A GitHub account, to hold this code so Vercel can deploy it (Vercel can
  deploy from a GitHub repo with every future change you push).

Nothing here needs you to run anything on your own computer, though you
can if you prefer (`npm install && npm run dev`).

## 1. Create the Supabase project

1. At [supabase.com](https://supabase.com), create a new project (any
   name, e.g. "skye-performance-hub"). Pick a region close to South
   Africa if offered. Save the database password it asks you to set
   somewhere safe — you won't need it for this app, but Supabase wants it set.
2. Once the project is ready, open **SQL Editor** (left sidebar) ->
   **New query**.
3. Open `supabase/schema.sql` from this project, paste its entire
   contents into the query, and run it. This creates all the tables and
   the access rules.
4. Open `supabase/seed.sql`, check the email near the top
   (`claudia.pienaar@skyecollege.co.za`) is the address you want to sign
   in with, paste its contents into a new query, and run it. This loads
   the 24 role scorecards, the Q2/Q4 2026 cycles with their due dates,
   the department list, and a starter staff roster with you marked as
   the first administrator. Nobody else gets an email yet — add real
   people and their emails from the Staff Admin screen once the app is
   live.
5. Go to **Authentication -> Providers** and confirm **Email** is
   enabled (it is by default). Go to **Authentication -> URL
   Configuration** and leave it for now — you'll come back and set the
   Site URL once you know your Vercel address (step 3 below).
6. Go to **Project Settings -> API**. You'll need two values from this
   page in step 2: the **Project URL** and the **anon public** key. Do
   not use the `service_role` key anywhere in this app — it isn't used.

## 2. Push this code to GitHub

1. Create a new, empty repository on GitHub (e.g. `skye-performance-hub`).
   Do not let GitHub add a README or .gitignore — this project already
   has them.
2. From a terminal in this folder:
   ```
   git init
   git add .
   git commit -m "Skye Performance Hub"
   git branch -M main
   git remote add origin https://github.com/<your-username>/skye-performance-hub.git
   git push -u origin main
   ```
   (If you're not comfortable with git, GitHub's "uploading an existing
   folder" web flow works too — drag this folder's contents in.)

## 3. Deploy to Vercel

1. At [vercel.com](https://vercel.com), **Add New -> Project**, and
   import the GitHub repository you just created.
2. Before clicking Deploy, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` — the Project URL from Supabase step 1.6
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon public key from the same page
   - `NEXT_PUBLIC_SITE_URL` — leave blank for now; you'll add it after
     the first deploy once Vercel gives you a URL, then redeploy
3. Click **Deploy**. Once it finishes, Vercel shows you a URL like
   `https://skye-performance-hub.vercel.app`. Copy it.
4. Go back to Vercel -> your project -> **Settings -> Environment
   Variables**, set `NEXT_PUBLIC_SITE_URL` to that URL, and redeploy
   (Deployments tab -> ⋯ on the latest -> Redeploy).
5. Back in Supabase -> **Authentication -> URL Configuration**, set
   **Site URL** to the same Vercel URL, and add
   `https://<your-vercel-url>/auth/callback` under **Redirect URLs**.
   Without this step, the magic-link emails will redirect to the wrong
   place.

## 4. Sign in and take it from there

Open your Vercel URL, enter the email you set in `seed.sql`, and follow
the link that arrives by email. You'll land on the Dashboard as the
first administrator. From **Staff admin**, replace the sample staff
(Amanda Botha, Nomvula Dlamini, and so on) with your real staff list and
their real email addresses — each person can only sign in and see their
own data once you've added them there.

## Project structure, if you want to change anything

```
supabase/schema.sql   Tables and row-level security policies — the real access control
supabase/seed.sql     Starter data: departments, scorecards, cycles, sample staff
src/lib/scoring.ts    The sign-off scoring rule (majority tier, capped at 1 if any
                      Performance Standard is marked "not met") — also mirrored as a
                      Postgres trigger in schema.sql so it can't be bypassed
src/lib/actions.ts    Server actions: every write the app makes (ratings, reviews,
                      feedback, due dates, staff roster changes)
src/app/(app)/        Every page behind sign-in (dashboard, my team, my performance,
                      feedback, standards, cycles, staff admin)
```

## A known gap carried over from the prototype

Finance and Thrive Pastoral Care have no scorecard in the source
documents the scorecards were built from, so if you add staff back into
those functions they will show "no scorecard assigned" until a scorecard
is written and added to `scorecards` for them.

## Changing the sign-in method or database later

This was built with email magic links (no separate account system) and
Supabase. If you later want Microsoft 365 sign-in instead, Supabase
supports adding a Microsoft (Azure) OAuth provider under
**Authentication -> Providers** without changing any of this app's code
— only the sign-in page would need a button added for it. Ask for that
whenever you're ready.
