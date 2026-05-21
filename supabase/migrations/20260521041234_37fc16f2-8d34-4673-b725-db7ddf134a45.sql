
create table public.notion_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null,
  workspace_name text,
  workspace_icon text,
  bot_id text not null,
  access_token text not null,
  notion_user_id text,
  notion_user_name text,
  briefings_database_id text,
  briefings_database_url text,
  parent_page_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

alter table public.notion_connections enable row level security;

create policy "notion_connections_own_select" on public.notion_connections
  for select using (auth.uid() = user_id);
create policy "notion_connections_own_insert" on public.notion_connections
  for insert with check (auth.uid() = user_id);
create policy "notion_connections_own_update" on public.notion_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notion_connections_own_delete" on public.notion_connections
  for delete using (auth.uid() = user_id);

create index idx_notion_connections_user on public.notion_connections(user_id);

create trigger trg_notion_connections_updated_at
  before update on public.notion_connections
  for each row execute function public.update_updated_at_column();

create table public.notion_oauth_states (
  state uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table public.notion_oauth_states enable row level security;
-- No policies = only service_role (edge functions) can access.

create index idx_notion_oauth_states_expires on public.notion_oauth_states(expires_at);

create table public.notion_export_log (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  user_id uuid not null,
  notion_page_id text,
  notion_page_url text,
  status text not null check (status in ('success','error')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.notion_export_log enable row level security;

create policy "notion_export_log_own_select" on public.notion_export_log
  for select using (auth.uid() = user_id);

create index idx_notion_export_log_user on public.notion_export_log(user_id, created_at desc);
create index idx_notion_export_log_briefing on public.notion_export_log(briefing_id, created_at desc);
