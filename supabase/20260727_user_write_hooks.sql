-- 在 Supabase Dashboard → SQL Editor → New query 中执行本文件。
-- 此补丁可重复执行，不会清空现有用户、进度或模考数据。

alter table public.users
  add column if not exists last_sign_in_at timestamptz;

alter table public.users
  alter column is_member set default false;

update public.users
set is_member = false
where is_member is null;

alter table public.users
  alter column is_member set not null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    full_name,
    created_at,
    last_sign_in_at,
    is_member,
    membership_expiry
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.created_at, now()),
    new.last_sign_in_at,
    false,
    null
  )
  on conflict (id) do update set
    email = excluded.email,
    last_sign_in_at = excluded.last_sign_in_at;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, last_sign_in_at on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.activate_membership_30_days(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
  set
    is_member = true,
    membership_expiry = now() + interval '30 days'
  where id = p_user_id;
$$;

revoke all on function public.activate_membership_30_days(uuid) from public;
revoke all on function public.activate_membership_30_days(uuid) from anon;
revoke all on function public.activate_membership_30_days(uuid) from authenticated;
grant execute on function public.activate_membership_30_days(uuid) to service_role;

revoke insert, update on public.users from authenticated;
grant select on public.users to authenticated;
grant insert (id, email, full_name, created_at, last_sign_in_at)
  on public.users to authenticated;
grant update (email, full_name, last_sign_in_at)
  on public.users to authenticated;
