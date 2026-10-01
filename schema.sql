-- Skye Performance Hub — schema + row-level security
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- against a fresh Supabase project, before deploying the app.
--
-- Design notes (read this before changing policies):
--   * There is no "sign-up" step that grants access on its own. Anyone can
--     request a magic link, but signing in only yields visible data once
--     their email matches a row in `staff` that an admin created — that
--     match is what "allocates viewing rights" (current_staff_id() below).
--   * Every access rule lives in Postgres row-level security, not in the
--     Next.js app. The app can only show what a query actually returns.
--   * The sign-off cap (a single "not met" Performance Standard forces the
--     overall score to 1, regardless of dimension ratings) is enforced by
--     a trigger (compute_overall / manager_reviews_set_overall) so it
--     can't be bypassed by calling the API directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------

create table if not exists departments (
  id         text primary key,
  name       text not null,
  sort_order int  not null default 0
);

create table if not exists scorecards (
  key        text primary key,
  title      text not null,
  note       text,
  dimensions jsonb not null default '[]'::jsonb,
  standards  jsonb not null default '[]'::jsonb,
  sort_order int   not null default 0
);

create table if not exists cycles (
  id         text primary key,
  label      text not null,
  due_date   date,
  sort_order int  not null default 0
);

-- ---------------------------------------------------------------------
-- Staff roster — editable by admins from the app's Staff Admin screen
-- ---------------------------------------------------------------------

create table if not exists staff (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  role_title     text not null,
  department_id  text references departments(id) on delete set null,
  manager_id     uuid references staff(id) on delete set null,
  scorecard_key  text references scorecards(key) on delete set null,
  email          text unique,
  is_admin       boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists staff_manager_id_idx on staff(manager_id);
create index if not exists staff_email_idx on staff(lower(email));

-- ---------------------------------------------------------------------
-- Review cycle data
-- ---------------------------------------------------------------------

create table if not exists self_ratings (
  staff_id         uuid not null references staff(id) on delete cascade,
  cycle_id         text not null references cycles(id) on delete cascade,
  scores           jsonb not null default '{}'::jsonb,
  standards_check  jsonb not null default '{}'::jsonb,
  comment          text,
  submitted_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (staff_id, cycle_id)
);

create table if not exists manager_reviews (
  staff_id         uuid not null references staff(id) on delete cascade,
  cycle_id         text not null references cycles(id) on delete cascade,
  scores           jsonb not null default '{}'::jsonb,
  standards_check  jsonb not null default '{}'::jsonb,
  comment          text,
  overall          int,
  published        boolean not null default false,
  submitted_at     timestamptz,
  updated_at       timestamptz not null default now(),
  reviewed_by      uuid references staff(id),
  primary key (staff_id, cycle_id)
);

create table if not exists feedback (
  id             uuid primary key default gen_random_uuid(),
  from_staff_id  uuid not null references staff(id) on delete cascade,
  to_staff_id    uuid not null references staff(id) on delete cascade,
  type           text not null check (type in ('Recognition','Constructive','Peer note')),
  message        text not null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helper functions (security definer so they can read `staff` to answer
-- "who is the signed-in person" without recursing into staff's own RLS)
-- ---------------------------------------------------------------------

create or replace function current_staff_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from staff
  where email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create or replace function is_admin_user()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from staff where id = current_staff_id()), false);
$$;

create or replace function is_manager_of(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff where id = target and manager_id = current_staff_id()
  );
$$;

create or replace function is_manager()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where manager_id = current_staff_id());
$$;

-- Overall sign-off score. Majority tier across rated dimensions (ties
-- resolve to the lower tier); forced to 1 if any Performance Standard is
-- marked "notmet". Mirrors src/lib/scoring.ts computeOverall() exactly —
-- keep both in sync if this ever changes.
create or replace function compute_overall(p_scores jsonb, p_standards_check jsonb)
returns int
language plpgsql immutable as $$
declare
  rec record;
  counts int[] := array[0,0,0,0];
  val int;
  majority int := 1;
  best int := -1;
  all_met boolean := true;
  has_any boolean := false;
  t int;
begin
  for rec in select value from jsonb_each_text(coalesce(p_standards_check, '{}'::jsonb)) loop
    if rec.value = 'notmet' then
      all_met := false;
    end if;
  end loop;

  for rec in select value from jsonb_each_text(coalesce(p_scores, '{}'::jsonb)) loop
    begin
      val := rec.value::int;
    exception when others then
      val := null;
    end;
    if val is not null and val between 1 and 4 then
      counts[val] := counts[val] + 1;
      has_any := true;
    end if;
  end loop;

  if not has_any then
    return null;
  end if;

  for t in 1..4 loop
    if counts[t] > best then
      best := counts[t];
      majority := t;
    end if;
  end loop;

  if not all_met then
    return 1;
  end if;
  return majority;
end;
$$;

create or replace function manager_reviews_set_overall()
returns trigger
language plpgsql as $$
begin
  new.overall := compute_overall(new.scores, new.standards_check);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_manager_reviews_overall on manager_reviews;
create trigger trg_manager_reviews_overall
before insert or update on manager_reviews
for each row execute function manager_reviews_set_overall();

create or replace function self_ratings_touch()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_self_ratings_touch on self_ratings;
create trigger trg_self_ratings_touch
before insert or update on self_ratings
for each row execute function self_ratings_touch();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------

alter table departments     enable row level security;
alter table scorecards      enable row level security;
alter table cycles          enable row level security;
alter table staff           enable row level security;
alter table self_ratings    enable row level security;
alter table manager_reviews enable row level security;
alter table feedback        enable row level security;

-- Reference data: readable by any signed-in, invited person; writable by admins only.
drop policy if exists departments_select on departments;
create policy departments_select on departments for select
  using (current_staff_id() is not null);

drop policy if exists departments_admin_write on departments;
create policy departments_admin_write on departments for all
  using (is_admin_user()) with check (is_admin_user());

drop policy if exists scorecards_select on scorecards;
create policy scorecards_select on scorecards for select
  using (current_staff_id() is not null);

drop policy if exists scorecards_admin_write on scorecards;
create policy scorecards_admin_write on scorecards for all
  using (is_admin_user()) with check (is_admin_user());

drop policy if exists cycles_select on cycles;
create policy cycles_select on cycles for select
  using (current_staff_id() is not null);

drop policy if exists cycles_admin_write on cycles;
create policy cycles_admin_write on cycles for all
  using (is_admin_user()) with check (is_admin_user());

-- Staff roster: organisational info (name, title, department, manager,
-- scorecard) is visible to any invited, signed-in person — this is not
-- performance data. Only admins can add, edit or remove staff.
drop policy if exists staff_select on staff;
create policy staff_select on staff for select
  using (current_staff_id() is not null);

drop policy if exists staff_admin_write on staff;
create policy staff_admin_write on staff for all
  using (is_admin_user()) with check (is_admin_user());

-- Self-ratings: a staff member reads and writes only their own; their
-- manager and admins can read (not write) so a manager can see what was
-- self-assessed while writing the official review.
drop policy if exists self_ratings_select on self_ratings;
create policy self_ratings_select on self_ratings for select
  using (
    staff_id = current_staff_id()
    or is_manager_of(staff_id)
    or is_admin_user()
  );

drop policy if exists self_ratings_write on self_ratings;
create policy self_ratings_write on self_ratings for insert
  with check (staff_id = current_staff_id());

drop policy if exists self_ratings_update on self_ratings;
create policy self_ratings_update on self_ratings for update
  using (staff_id = current_staff_id())
  with check (staff_id = current_staff_id());

-- Manager reviews: this is where the mirrored-collection workaround used
-- in the earlier Claude Artifact prototype is no longer needed — Postgres
-- RLS can express "this manager's own reports" directly.
--   * Unpublished (draft) rows are visible only to the manager (or admin).
--   * Published rows are additionally visible to the staff member reviewed.
--   * Only the manager of that staff member (or an admin) can write.
drop policy if exists manager_reviews_select on manager_reviews;
create policy manager_reviews_select on manager_reviews for select
  using (
    is_admin_user()
    or is_manager_of(staff_id)
    or (published = true and staff_id = current_staff_id())
  );

drop policy if exists manager_reviews_insert on manager_reviews;
create policy manager_reviews_insert on manager_reviews for insert
  with check (is_admin_user() or is_manager_of(staff_id));

drop policy if exists manager_reviews_update on manager_reviews;
create policy manager_reviews_update on manager_reviews for update
  using (is_admin_user() or is_manager_of(staff_id))
  with check (is_admin_user() or is_manager_of(staff_id));

-- Feedback: visible to the people involved (sender, recipient), the
-- recipient's manager, and admins. Anyone invited can post feedback
-- about someone else (not themselves).
drop policy if exists feedback_select on feedback;
create policy feedback_select on feedback for select
  using (
    is_admin_user()
    or from_staff_id = current_staff_id()
    or to_staff_id = current_staff_id()
    or is_manager_of(to_staff_id)
  );

drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert
  with check (
    from_staff_id = current_staff_id()
    and to_staff_id <> current_staff_id()
  );
