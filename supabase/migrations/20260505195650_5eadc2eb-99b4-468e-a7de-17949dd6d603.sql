
-- Read state per user/document
create table if not exists public.china_inbox_read_state (
  usuario_id uuid not null,
  documento_id uuid not null references public.china_produto_documentos(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (usuario_id, documento_id)
);
alter table public.china_inbox_read_state enable row level security;

drop policy if exists "own_read_state_select" on public.china_inbox_read_state;
create policy "own_read_state_select" on public.china_inbox_read_state
  for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "own_read_state_ins" on public.china_inbox_read_state;
create policy "own_read_state_ins" on public.china_inbox_read_state
  for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists "own_read_state_upd" on public.china_inbox_read_state;
create policy "own_read_state_upd" on public.china_inbox_read_state
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists "own_read_state_del" on public.china_inbox_read_state;
create policy "own_read_state_del" on public.china_inbox_read_state
  for delete to authenticated using (usuario_id = auth.uid());

-- User flags / starred submissions
create table if not exists public.china_submissao_user_flags (
  usuario_id uuid not null,
  submissao_id uuid not null references public.china_produto_submissoes(id) on delete cascade,
  flagged_at timestamptz not null default now(),
  primary key (usuario_id, submissao_id)
);
alter table public.china_submissao_user_flags enable row level security;

drop policy if exists "own_flags_select" on public.china_submissao_user_flags;
create policy "own_flags_select" on public.china_submissao_user_flags
  for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "own_flags_ins" on public.china_submissao_user_flags;
create policy "own_flags_ins" on public.china_submissao_user_flags
  for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists "own_flags_del" on public.china_submissao_user_flags;
create policy "own_flags_del" on public.china_submissao_user_flags
  for delete to authenticated using (usuario_id = auth.uid());

create index if not exists idx_china_inbox_read_state_user on public.china_inbox_read_state(usuario_id);
create index if not exists idx_china_submissao_user_flags_user on public.china_submissao_user_flags(usuario_id);
