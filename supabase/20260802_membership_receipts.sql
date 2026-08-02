-- Offer Fawn membership receipts and manual review workflow.
-- Submitted screenshots remain private. The signed-in user can only insert and
-- read their own receipt rows/files; only dashboard/service-role review can
-- change status or membership authority.

create schema if not exists private;

create table if not exists public.membership_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  email text not null,
  receipt_path text not null unique,
  amount numeric not null check (amount > 0),
  currency text not null default 'CNY' check (currency = 'CNY'),
  status text not null default 'provisional'
    check (status in ('provisional', 'approved', 'rejected', 'revoked')),
  membership_started_at timestamptz not null,
  membership_expiry timestamptz not null
    check (membership_expiry > membership_started_at),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_note text
);

alter table public.users
  add column if not exists membership_receipt_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_membership_receipt_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_membership_receipt_id_fkey
      foreign key (membership_receipt_id)
      references public.membership_receipts(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists membership_receipts_user_submitted_idx
  on public.membership_receipts (user_id, submitted_at desc);
create index if not exists membership_receipts_status_submitted_idx
  on public.membership_receipts (status, submitted_at desc);

create index if not exists users_membership_receipt_id_idx
  on public.users (membership_receipt_id)
  where membership_receipt_id is not null;

alter table public.membership_receipts enable row level security;

drop policy if exists membership_receipts_select_self
  on public.membership_receipts;
create policy membership_receipts_select_self
  on public.membership_receipts
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists membership_receipts_insert_self
  on public.membership_receipts;
create policy membership_receipts_insert_self
  on public.membership_receipts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.membership_receipts from anon, authenticated;
grant select, insert on public.membership_receipts to authenticated;
grant all on public.membership_receipts to service_role;

create or replace function private.prepare_membership_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_renewal_start timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if exists (
    select 1 from public.membership_receipts
    where user_id = v_user_id and status = 'provisional'
  ) then
    raise exception 'You already have a receipt awaiting review';
  end if;

  if new.receipt_path is null
     or split_part(new.receipt_path, '/', 1) <> v_user_id::text then
    raise exception 'Receipt path does not belong to the signed-in user';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'membership-receipts'
      and name = new.receipt_path
      and owner_id = v_user_id::text
  ) then
    raise exception 'Receipt image was not uploaded';
  end if;

  select case
    when is_member = true and membership_expiry > v_now
      then membership_expiry
    else v_now
  end
  into v_renewal_start
  from public.users
  where id = v_user_id;

  if v_renewal_start is null then
    raise exception 'User profile does not exist';
  end if;

  new.id := coalesce(new.id, gen_random_uuid());
  new.user_id := v_user_id;
  new.email := coalesce(auth.jwt() ->> 'email', '');
  new.amount := case
    when v_now < timestamptz '2026-09-01 00:00:00+08' then 12.99
    else 19.99
  end;
  new.currency := 'CNY';
  new.status := 'provisional';
  new.membership_started_at := v_renewal_start;
  new.membership_expiry := v_renewal_start + interval '30 days';
  new.submitted_at := v_now;
  new.reviewed_at := null;
  new.reviewer_note := null;
  return new;
end;
$$;

create or replace function private.activate_submitted_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set
    is_member = true,
    membership_started_at = case
      when is_member = true and membership_expiry > new.submitted_at
        then membership_started_at
      else new.submitted_at
    end,
    membership_expiry = new.membership_expiry,
    membership_receipt_id = new.id
  where id = new.user_id;
  return new;
end;
$$;

create or replace function private.prepare_membership_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected', 'revoked') then
    new.reviewed_at := coalesce(new.reviewed_at, clock_timestamp());
  end if;
  return new;
end;
$$;

create or replace function private.apply_membership_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('rejected', 'revoked') then
    update public.users
    set is_member = false
    where id = new.user_id and membership_receipt_id = new.id;
  elsif new.status = 'approved' then
    update public.users
    set is_member = (new.membership_expiry > clock_timestamp())
    where id = new.user_id and membership_receipt_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_membership_receipt() from public;
revoke all on function private.activate_submitted_membership() from public;
revoke all on function private.prepare_membership_review() from public;
revoke all on function private.apply_membership_review() from public;

drop trigger if exists membership_receipts_prepare
  on public.membership_receipts;
create trigger membership_receipts_prepare
before insert on public.membership_receipts
for each row execute function private.prepare_membership_receipt();

drop trigger if exists membership_receipts_activate
  on public.membership_receipts;
create trigger membership_receipts_activate
after insert on public.membership_receipts
for each row execute function private.activate_submitted_membership();

drop trigger if exists membership_receipts_prepare_review
  on public.membership_receipts;
create trigger membership_receipts_prepare_review
before update of status on public.membership_receipts
for each row execute function private.prepare_membership_review();

drop trigger if exists membership_receipts_apply_review
  on public.membership_receipts;
create trigger membership_receipts_apply_review
after update of status on public.membership_receipts
for each row execute function private.apply_membership_review();

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'membership-receipts',
  'membership-receipts',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists membership_receipt_files_insert_own
  on storage.objects;
create policy membership_receipt_files_insert_own
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'membership-receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists membership_receipt_files_select_own
  on storage.objects;
create policy membership_receipt_files_select_own
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'membership-receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
