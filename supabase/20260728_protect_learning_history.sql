-- Keep account learning history append/update-only for signed-in browser clients.
-- Deployments never run destructive data migrations, and only the project
-- administrator/service role can deliberately remove these records.
revoke delete on table public.user_progress from authenticated;
revoke delete on table public.exam_records from authenticated;
revoke delete on table public.user_state from authenticated;

drop policy if exists progress_delete_self on public.user_progress;
drop policy if exists exams_delete_self on public.exam_records;
drop policy if exists state_delete_self on public.user_state;
