
create table if not exists public._internal_cron_config (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on public._internal_cron_config from anon, authenticated;
grant all on public._internal_cron_config to service_role;
grant select, insert, update on public._internal_cron_config to postgres;
alter table public._internal_cron_config enable row level security;
-- sem policies = ninguém acessa via Data API. Só superuser/service_role bypass.

-- Placeholder (será sobrescrito por processo interno com o valor real)
insert into public._internal_cron_config(name, value) values ('windsor_cron_secret', '__PENDING__')
on conflict (name) do nothing;

-- Reagenda o job
do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'windsor-sync-diario';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

select cron.schedule(
  'windsor-sync-diario',
  '0 9 * * *',
  $body$
  select net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/windsor-sync',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2t5cmdhcWphcmhseXdoamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA0MjYsImV4cCI6MjA3NDc3NjQyNn0.PlGQQyGUwOZKITqjdWyk-PXo0duk8s2TsKm8uJSZJ7s',
      'x-cron-secret', (select value from public._internal_cron_config where name='windsor_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $body$
);
