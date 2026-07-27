-- 补齐普通刷题正确次数、独立收藏夹和学习数据防误删。
-- 可重复执行；不会清空现有用户、模考、进度或学习状态。

alter table public.user_progress
  add column if not exists correct_attempts integer not null default 0;

update public.user_progress
set correct_attempts = case when is_correct then 1 else 0 end
where correct_attempts = 0;

alter table public.user_progress
  drop constraint if exists user_progress_question_id_fkey;
alter table public.user_progress
  add constraint user_progress_question_id_fkey
  foreign key (question_id) references public.questions(id) on delete restrict;

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

-- 把旧 user_state 里的收藏迁移到独立表，保留已有收藏。
with favorite_ids as (
  select
    state.user_id,
    jsonb_array_elements_text(
      case
        when jsonb_typeof(state.payload #> '{favorites,graphic}') = 'array'
          then state.payload #> '{favorites,graphic}'
        else '[]'::jsonb
      end
    ) as question_id
  from public.user_state as state
  union
  select
    state.user_id,
    jsonb_array_elements_text(
      case
        when jsonb_typeof(state.payload #> '{favorites,material}') = 'array'
          then state.payload #> '{favorites,material}'
        else '[]'::jsonb
      end
    ) as question_id
  from public.user_state as state
  union
  select
    state.user_id,
    jsonb_array_elements_text(
      case
        when jsonb_typeof(state.payload #> '{favorites,verbal}') = 'array'
          then state.payload #> '{favorites,verbal}'
        else '[]'::jsonb
      end
    ) as question_id
  from public.user_state as state
)
insert into public.user_favorites (
  user_id,
  question_id,
  is_active,
  created_at,
  updated_at
)
select
  favorite_ids.user_id,
  favorite_ids.question_id,
  true,
  now(),
  now()
from favorite_ids
join public.questions
  on public.questions.id = favorite_ids.question_id
on conflict (user_id, question_id) do update set
  is_active = true,
  updated_at = excluded.updated_at;

alter table public.user_favorites enable row level security;

drop policy if exists favorites_select_self on public.user_favorites;
drop policy if exists favorites_insert_self on public.user_favorites;
drop policy if exists favorites_update_self on public.user_favorites;
drop policy if exists favorites_delete_self on public.user_favorites;

create policy favorites_select_self on public.user_favorites
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy favorites_insert_self on public.user_favorites
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy favorites_update_self on public.user_favorites
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_favorites to authenticated;

revoke delete, truncate
  on public.user_progress, public.exam_records, public.user_state, public.user_favorites
  from authenticated;
