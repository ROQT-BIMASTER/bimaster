
create or replace function public._set_internal_cron_secret(p_name text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public._internal_cron_config(name, value)
  values (p_name, p_value)
  on conflict (name) do update set value = excluded.value, updated_at = now();
end;
$$;

revoke all on function public._set_internal_cron_secret(text, text) from public, anon, authenticated;
grant execute on function public._set_internal_cron_secret(text, text) to service_role;
grant execute on function public._set_internal_cron_secret(text, text) to sandbox_exec;
