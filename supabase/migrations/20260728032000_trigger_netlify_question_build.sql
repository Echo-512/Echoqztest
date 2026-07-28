-- Rebuild the Netlify question snapshot after the Supabase bank changes.
-- The private build-hook URL lives in Vault under
-- `netlify_question_build_hook`; it is intentionally not stored in GitHub.

create extension if not exists pg_net;

create or replace function public.queue_netlify_question_build()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url text;
begin
  select decrypted_secret
  into hook_url
  from vault.decrypted_secrets
  where name = 'netlify_question_build_hook'
  order by updated_at desc
  limit 1;

  if hook_url is null or hook_url = '' then
    raise warning 'Netlify question build hook is not configured';
    return null;
  end if;

  perform net.http_post(
    url := hook_url,
    body := pg_catalog.jsonb_build_object(
      'source', 'supabase',
      'schema', tg_table_schema,
      'table', tg_table_name,
      'operation', tg_op,
      'changed_at', pg_catalog.clock_timestamp()
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  return null;
end;
$$;

drop trigger if exists questions_trigger_netlify_build on public.questions;
create trigger questions_trigger_netlify_build
after insert or update or delete on public.questions
for each statement
execute function public.queue_netlify_question_build();

revoke all on function public.queue_netlify_question_build() from public;
revoke all on function public.queue_netlify_question_build() from anon;
revoke all on function public.queue_netlify_question_build() from authenticated;
