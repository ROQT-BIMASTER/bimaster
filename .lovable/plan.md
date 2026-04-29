# Painel de Auditoria — Funções SECURITY DEFINER

## Objetivo

Tela admin-only que lista todas as funções SECURITY DEFINER do banco (365 hoje, ~361 em `public`), mostrando para cada uma se é chamada pelo frontend, seus chamadores (arquivos), o status de governança (mantida / ajustada / revogada) e quem revisou. Permite editar status, anotar e exportar CSV.

## Arquitetura

```text
┌─────────────────────────┐    snapshot.json     ┌──────────────────────┐
│ scripts/audit/          │  ───────────────►    │ src/data/security/   │
│  security-definer-      │  (versionado em git) │  security-definer-   │
│  snapshot.ts            │                      │  snapshot.json       │
└──────────┬──────────────┘                      └──────────┬───────────┘
           │ pg_proc + grep src/                            │
           │ supabase.rpc('nome')                           │ import direto
           ▼                                                ▼
   roda manual (npm script)                  ┌──────────────────────────┐
                                             │ /dashboard/admin/        │
   ┌─────────────────────────────┐           │  security/security-      │
   │ tabela security_definer_    │ ◄──RLS──► │  definer (React page)    │
   │ overrides (status + nota)   │           │  - lista virtualizada    │
   └─────────────────────────────┘           │  - filtros + busca       │
                                             │  - drawer drill-down     │
                                             │  - export CSV            │
                                             └──────────────────────────┘
```

### Origem dos dados

**Snapshot estático** gerado por script Node executado manualmente (`npm run audit:security-definer`):
1. Conecta ao banco via `pg` usando `DATABASE_URL` local e consulta `pg_proc + pg_namespace` para listar todas as funções com `prosecdef = true`. Para cada função extrai: `schema`, `name`, `args`, `return_type`, `language`, `volatility`, `created_at` (heurística via `pg_depend`), grants (`has_function_privilege('authenticated', oid, 'EXECUTE')` e `'anon'`), `last_modified` aproximado por `obj_description`.
2. Faz grep recursivo em `src/**/*.{ts,tsx}` por padrões `\.rpc\(['"]<name>['"]` para descobrir chamadores e arquivos.
3. Escreve `src/data/security/security-definer-snapshot.json` com o array de `{schema, name, signature, args, return_type, granted_to_authenticated, granted_to_anon, callers: [{file, line}], last_modified_at}` e metadados `{generated_at, total, by_status_inferred}`.

O snapshot é versionado. Reexecutar é responsabilidade do mantenedor (instrução documentada).

### Status híbrido

Status inferido em runtime na própria página, a partir do snapshot + overrides:

- **revogada**: `granted_to_anon = false` E `granted_to_authenticated = false`.
- **ajustada**: modificada nos últimos 30 dias OU possui override com status manual `ajustada`.
- **mantida**: caso contrário.
- **override**: tabela `security_definer_overrides` permite admin sobrescrever status final e anexar nota.

### Banco

Migration nova:

```sql
create table public.security_definer_overrides (
  id uuid primary key default gen_random_uuid(),
  schema_name text not null,
  function_name text not null,
  function_signature text not null,           -- desambigua sobrecargas
  status_override text check (status_override in ('mantida','ajustada','revogada')),
  nota text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (schema_name, function_name, function_signature)
);

alter table public.security_definer_overrides enable row level security;

create policy "Admin lê overrides" on public.security_definer_overrides
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admin grava overrides" on public.security_definer_overrides
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger trg_sec_def_overrides_audit
  before update on public.security_definer_overrides
  for each row execute function public.set_updated_at();
```

Mudanças relevantes são auditadas via `security_audit_log` (insert manual no hook ao salvar).

## Frontend

### Rota e proteção

- Nova rota em `src/App.tsx`: `/dashboard/admin/security/security-definer` envolto em `<ScreenRoute screenCode="admin">`.
- Página `src/pages/admin/security/SecurityDefinerAudit.tsx`.
- Item adicional no menu admin (sidebar) — descobrir arquivo via `useSidebarMenuItems`/config existente; se sidebar admin é configurada por dados, atualizar o config; se hard-coded, adicionar entrada.

### Componentes

```text
src/pages/admin/security/SecurityDefinerAudit.tsx
src/components/admin/security/
  ├─ SecurityDefinerHeader.tsx        (título, KPIs: total, % usadas, % revogadas, última geração do snapshot)
  ├─ SecurityDefinerFilters.tsx       (busca por nome, filtros: status, usado no frontend, schema, anon=true)
  ├─ SecurityDefinerTable.tsx         (react-virtuoso, colunas: schema.name, args, callers count, status badge, ação)
  ├─ SecurityDefinerRowActions.tsx    (editar status, abrir drill-down)
  ├─ SecurityDefinerDrawer.tsx        (detalhe: assinatura, grants, lista de arquivos chamadores com link, link p/ SQL via supabase dashboard, histórico de override, editor de status + nota)
  └─ SecurityDefinerExportButton.tsx  (export CSV com filtros aplicados)
src/hooks/admin/useSecurityDefinerAudit.ts   (carrega snapshot + overrides, faz merge, expõe lista filtrada)
src/hooks/admin/useSecurityDefinerOverride.ts (mutation upsert override)
src/lib/security/securityDefinerStatus.ts    (função pura: deriva status final)
```

### UX

- Header com 4 KPIs em cards (Total, Usadas pelo frontend, Sem grant público, Revisadas).
- Tabela virtualizada (react-virtuoso) usando os primitives `Table` do projeto. Linhas com badge colorido por status (verde mantida, âmbar ajustada, cinza revogada) e badge "usada" quando `callers.length > 0`.
- Click na linha abre Drawer (Sheet shadcn) com: assinatura completa, grants, lista de chamadores (arquivo + linha; clicáveis copiam path), nota atual, editor de override (Select status + Textarea nota + botão salvar), histórico de revisões.
- Export CSV respeita filtros ativos.
- Empty states e skeletons consistentes.

## Script de snapshot

Arquivo `scripts/audit/security-definer-snapshot.ts` + entrada em `package.json`:

```json
"scripts": {
  "audit:security-definer": "tsx scripts/audit/security-definer-snapshot.ts"
}
```

Documentação curta no topo do arquivo explicando: requer `DATABASE_URL` local, gera `src/data/security/security-definer-snapshot.json`, deve ser reexecutado após migrations que criem/alterem funções SECURITY DEFINER. Adicionar nota em `docs/SECURITY.md`.

## Aceitação

- Acessar `/dashboard/admin/security/security-definer` como admin lista as ~365 funções com filtros e busca operacionais.
- Linha mostra status derivado correto e indica se é chamada pelo frontend (com contagem de callers).
- Drawer mostra arquivos do frontend que chamam a função.
- Admin altera status e nota e a mudança persiste; refresh mantém o override.
- Export CSV produz arquivo com colunas: schema, name, signature, used_in_frontend, callers_count, status_final, status_override, nota, reviewed_by, reviewed_at, granted_authenticated, granted_anon.
- Não-admin é bloqueado pela `ScreenRoute` e pela RLS.

## Fora de escopo

- Revogação automática de grants (continua manual via migration).
- Aviso em tempo real quando uma nova função SECURITY DEFINER aparece (ficaria para uma onda futura com cron).
- Cobertura de funções fora do schema `public` é incluída (4 funções), mas drill-down de uso ignora schemas internos do Supabase.
