-- Supabase SQL Editor 一次性初始化脚本
-- 仅前端 public/anon key + RLS；不需要 service_role key。

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  phone text unique,
  full_name text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  is_member boolean not null default false,
  membership_started_at timestamptz,
  membership_expiry timestamptz
);

alter table public.users add column if not exists phone text unique;
alter table public.users
  add column if not exists membership_started_at timestamptz;

create table if not exists public.questions (
  id text primary key,
  question_number text not null,
  question_text text,
  image text,
  options jsonb not null default '{}'::jsonb,
  option_images jsonb not null default '{}'::jsonb,
  option_count integer not null check (option_count between 2 and 8),
  correct_answer text not null,
  explanation text,
  method text,
  difficulty text not null check (difficulty in ('入门', '提高', '强化')),
  question_type text not null check (question_type in ('图形推理', '材料分析', '文字推理')),
  category text not null,
  fine_points jsonb not null default '[]'::jsonb,
  source text,
  original_number integer,
  source_occurrence integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists questions_type_idx on public.questions(question_type);
create index if not exists questions_category_idx on public.questions(category);
create index if not exists questions_difficulty_idx on public.questions(difficulty);

create table if not exists public.user_progress (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  question_id text not null references public.questions(id) on delete restrict,
  user_answer text,
  is_correct boolean,
  attempts integer not null default 1 check (attempts > 0),
  correct_attempts integer not null default 0 check (correct_attempts >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);

alter table public.user_progress
  add column if not exists correct_attempts integer not null default 0;
update public.user_progress
set correct_attempts = case when is_correct then 1 else 0 end
where correct_attempts = 0;

create index if not exists user_progress_question_id_idx
  on public.user_progress(question_id);

create table if not exists public.exam_records (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  exam_id text not null,
  score integer not null default 0,
  total_questions integer not null check (total_questions > 0),
  correct_count integer not null default 0,
  time_used integer not null default 0,
  details jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, exam_id)
);

alter table public.exam_records add column if not exists exam_id text;
update public.exam_records set exam_id = id::text where exam_id is null;
alter table public.exam_records alter column exam_id set not null;
create unique index if not exists exam_records_user_exam_idx
  on public.exam_records(user_id, exam_id);

create table if not exists public.user_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  question_id text not null references public.questions(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists user_favorites_active_idx
  on public.user_favorites(user_id, is_active);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    phone,
    full_name,
    created_at,
    last_sign_in_at,
    is_member,
    membership_started_at,
    membership_expiry
  )
  values (
    new.id,
    new.email,
    new.phone,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.created_at, now()),
    new.last_sign_in_at,
    false,
    null,
    null
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    last_sign_in_at = excluded.last_sign_in_at;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, last_sign_in_at on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- 未来支付回调专用：仅 service_role 可开通 30 天会员。
-- 请勿从浏览器或 public/anon key 调用。
create or replace function public.activate_membership_30_days(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
  set
    is_member = true,
    membership_started_at = now(),
    membership_expiry = now() + interval '30 days'
  where id = p_user_id;
$$;

revoke all on function public.activate_membership_30_days(uuid) from public;
revoke all on function public.activate_membership_30_days(uuid) from anon;
revoke all on function public.activate_membership_30_days(uuid) from authenticated;
grant execute on function public.activate_membership_30_days(uuid) to service_role;

alter table public.users enable row level security;
alter table public.questions enable row level security;
alter table public.user_progress enable row level security;
alter table public.exam_records enable row level security;
alter table public.user_state enable row level security;
alter table public.user_favorites enable row level security;

drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions
  for select to anon, authenticated using (true);

drop policy if exists users_select_self on public.users;
drop policy if exists users_insert_self on public.users;
drop policy if exists users_update_self on public.users;
create policy users_select_self on public.users
  for select to authenticated using ((select auth.uid()) = id);
create policy users_insert_self on public.users
  for insert to authenticated with check ((select auth.uid()) = id);
create policy users_update_self on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists progress_select_self on public.user_progress;
drop policy if exists progress_insert_self on public.user_progress;
drop policy if exists progress_update_self on public.user_progress;
drop policy if exists progress_delete_self on public.user_progress;
create policy progress_select_self on public.user_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy progress_insert_self on public.user_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy progress_update_self on public.user_progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists exams_select_self on public.exam_records;
drop policy if exists exams_insert_self on public.exam_records;
drop policy if exists exams_update_self on public.exam_records;
drop policy if exists exams_delete_self on public.exam_records;
create policy exams_select_self on public.exam_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy exams_insert_self on public.exam_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy exams_update_self on public.exam_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists state_select_self on public.user_state;
drop policy if exists state_insert_self on public.user_state;
drop policy if exists state_update_self on public.user_state;
drop policy if exists state_delete_self on public.user_state;
create policy state_select_self on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy state_insert_self on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy state_update_self on public.user_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists favorites_select_self on public.user_favorites;
drop policy if exists favorites_insert_self on public.user_favorites;
drop policy if exists favorites_update_self on public.user_favorites;
drop policy if exists favorites_delete_self on public.user_favorites;
create policy favorites_select_self on public.user_favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy favorites_insert_self on public.user_favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy favorites_update_self on public.user_favorites
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.questions to anon, authenticated;
revoke insert, update on public.users from authenticated;
grant select on public.users to authenticated;
grant insert (id, email, phone, full_name, created_at, last_sign_in_at)
  on public.users to authenticated;
grant update (email, phone, full_name, last_sign_in_at)
  on public.users to authenticated;
grant select, insert, update on public.user_progress to authenticated;
grant select, insert, update on public.exam_records to authenticated;
grant select, insert, update on public.user_state to authenticated;
grant select, insert, update on public.user_favorites to authenticated;
revoke delete, truncate
  on public.user_progress, public.exam_records, public.user_state, public.user_favorites
  from authenticated;
grant usage, select on sequence public.user_progress_id_seq to authenticated;
grant usage, select on sequence public.exam_records_id_seq to authenticated;
