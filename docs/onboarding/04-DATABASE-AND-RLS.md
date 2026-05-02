---
title: Database & RLS
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 04 — Database & RLS

## Princípios

1. **RLS sempre habilitada** em toda tabela `public.*`.
2. **Zero exposição pública**. Para acesso anônimo legítimo, use
   `SECURITY DEFINER` RPC ou tokens.
3. **Roles em tabela própria** (`user_roles`) + função `has_role(_user_id, _role)`
   `SECURITY DEFINER`. **Nunca** em `profiles` ou `users` — risco de privilege
   escalation.
4. **Sem FK em `auth.users`**. Replique dados em `public.profiles`.
5. **Sem `ALTER DATABASE postgres ...`**.
6. **Sem CHECK com funções não-imutáveis** (ex.: `CHECK (expire_at > now())`).
   Use trigger de validação.
7. **Não toque** nos schemas `auth`, `storage`, `realtime`, `supabase_functions`,
   `vault` — degrada o serviço.

## Migrations

Use a tool `supabase--migration` (Lovable) ou comite SQL em
`supabase/migrations/<timestamp>_<descricao>.sql`. **Nunca** rode `psql` para
DDL — só `SELECT`/`INSERT` em modo análise (e somente quando o ambiente expõe
`PG*` env vars).

## Padrão de tabela

```sql
create table public.minha_tabela (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                              -- não FK auth.users
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  campo_obrigatorio text not null,
  campo_opcional text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.minha_tabela enable row level security;

-- updated_at automático via trigger genérica
create trigger trg_minha_tabela_updated
before update on public.minha_tabela
for each row execute function public.set_updated_at();
```

## Padrão de roles

```sql
-- Definidos uma única vez no projeto:
create type public.app_role as enum ('admin', 'gerente', 'usuario', 'cliente');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
```

## Padrão de RLS — semi-join (preferido)

Para tabelas de **alto volume**, evite chamadas de função na policy. Use
semi-joins:

```sql
-- BOM
create policy "Membros leem tarefas do projeto"
on public.projeto_tarefas for select
to authenticated
using (
  projeto_id in (
    select projeto_id from public.projeto_membros where user_id = auth.uid()
  )
);

-- EVITAR em tabela de alto volume:
using (public.user_pode_ver_projeto(auth.uid(), projeto_id))
```

Para roles, função é OK (consulta `user_roles` é pequena):

```sql
create policy "Admins escrevem tudo"
on public.qualquer_tabela for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
```

## Hierarquia (`supervisor_id`)

`supervisor_id` é a **única** fonte de verdade. `gerente_id` está deprecado.
Para "todos os subordinados recursivos de X", use CTE recursiva ou função
SECURITY DEFINER cacheada. Veja `mem://architecture/hierarchy-and-supervision-standards`.

## Realtime

```sql
alter publication supabase_realtime add table public.messages;
```

```ts
const ch = supabase
  .channel("messages")
  .on("postgres_changes", { event: "*", schema: "public", table: "messages" },
      (payload) => console.log(payload))
  .subscribe();
```

RLS continua sendo aplicada em realtime — defina policies adequadas.

## Storage

- Buckets privados por padrão; `public = false`.
- Paths começam com **UID do dono**: `<uid>/<entity>/<file>`.
- Validação **magic bytes** (não confie em extensão).
- Limite **20 MB**.
- **Double-extension** (`relatorio.pdf.exe`) bloqueada.
- Download via `triggerBlobDownload` + `StoragePreviewDialog` — nunca
  `window.open(url)`.

Veja [`07-SECURITY-AND-LGPD.md`](./07-SECURITY-AND-LGPD.md) para detalhes.

## Datas

- Coluna `DATE` no Postgres ↔ string `"YYYY-MM-DD"` no front. **Sempre** parseie
  com `parseLocalDate(s)` (`@/lib/utils/parseLocalDate`). Veja gotcha 13.1.
- Coluna `TIMESTAMPTZ` ↔ ISO string com offset; `new Date(s)` é seguro.

## Performance

- Índices em FKs e em colunas usadas em policy filters.
- Em listas grandes, use **paginação** (Supabase tem limite default 1000 linhas).
  Para "dados sumiram", verifique limite antes de assumir bug.
- Veja `mem://architecture/high-volume-rls-performance-standard`.
