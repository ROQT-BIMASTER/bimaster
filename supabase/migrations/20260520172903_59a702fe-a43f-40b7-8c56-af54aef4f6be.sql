-- Push subscriptions para Web Push (estilo WhatsApp em background)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Usuário lê/escreve só as próprias subscriptions
create policy "Usuário lê suas subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Usuário insere suas subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Usuário atualiza suas subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Usuário remove suas subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

-- Service role (edge functions) faz tudo via JWT bypass; sem policy adicional necessária.