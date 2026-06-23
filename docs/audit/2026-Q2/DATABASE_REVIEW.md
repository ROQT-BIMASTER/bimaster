# DATABASE_REVIEW — Auditoria 2026-Q2

> Snapshot descritivo do schema `public`. Junho/2026.
> Apoio para o refresh de `docs/DATABASE.md` no PR-4 (automação).

## 1. Totais

| Métrica | Valor |
| --- | ---: |
| Tabelas (`information_schema.tables`, `BASE TABLE`) | **858** |
| Views (`information_schema.views`) | 52 |
| Tabelas com RLS habilitado | **858 (100%)** |
| Tabelas sem RLS | 0 |
| Policies (`pg_policies`) | **2.341** |
| Funções no schema `public` (`information_schema.routines`) | 879 |
| Funções `SECURITY DEFINER` | **673** |
| Triggers | 568 |
| Migrations em `supabase/migrations/` | 1.489 |
| Buckets de storage | 50 |
| Buckets `public = true` | **0** |

## 2. Avaliação

### 2.1 🟢 [FORTE] Cobertura RLS de 100%
Todas as 858 tabelas em `public` têm RLS habilitado. 2.341 policies (média
~2,7/tabela) sugerem políticas distintas para SELECT/INSERT/UPDATE/DELETE.

### 2.2 🟢 [FORTE] Storage sem bucket público
Nenhum dos 50 buckets é público — todo acesso passa por policy + (quando
necessário) por edge function com `triggerBlobDownload`.

### 2.3 🔴 [CRÍTICO — scanner ativo] Achado de storage individual
O scanner reporta o bucket `pasta-digital` permitindo SELECT a qualquer usuário
autenticado cuja referência apareça em `produto_brasil_pasta_digital` ou
`china_pasta_digital`, **sem** verificar se o usuário tem acesso ao registro.
**Não corrigido neste ciclo** (auditoria descritiva). Documentado para PR de
remediação:

```sql
-- pseudo-policy alvo
CREATE POLICY "pasta-digital select via record ownership"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pasta-digital' AND (
    EXISTS (SELECT 1 FROM public.produto_brasil_pasta_digital p
            WHERE p.storage_path = name
              AND p.created_by = auth.uid())  -- ou política de equipe
    OR
    EXISTS (SELECT 1 FROM public.china_pasta_digital c
            WHERE c.storage_path = name
              AND <regra de visibilidade vigente>)
  )
);
```

### 2.4 🔴 [CRÍTICO — scanner ativo] `SECURITY DEFINER` view
O linter Supabase aponta pelo menos 1 view `SECURITY DEFINER`. **Não
identificada nominalmente neste relatório** — listar com:

```sql
SELECT n.nspname, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v' AND n.nspname = 'public'
  AND EXISTS (
    SELECT 1 FROM pg_rewrite r WHERE r.ev_class = c.oid
  );
-- complementar com pg_proc.prosecdef para funções de apoio
```

A correção padrão é re-emitir a view sem `SECURITY DEFINER` ou converter em
função explicitamente nomeada.

### 2.5 🟠 [ALTO — scanner ativo] Policy `USING (true)` em escrita
Linter aponta pelo menos uma policy UPDATE/INSERT/DELETE com `USING (true)`
ou `WITH CHECK (true)`. Identificar:

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT','UPDATE','DELETE')
  AND (qual = 'true' OR with_check = 'true');
```

### 2.6 🟠 [ALTO — scanner ativo] `dynamic_forms*` legíveis por `anon`
`dynamic_forms`, `dynamic_form_fields`, `dynamic_form_attachments` expõem
linhas com `status = 'active'` ao role `anon`, incluindo `created_by` e dados
de contato. Decisão pendente: ou (a) restringir a `authenticated` e mover a
parte pública para uma RPC `get_public_form(slug)` que retorne apenas campos
necessários, ou (b) manter `anon` com colunas explicitamente mascaradas via
view + policy.

### 2.7 🟡 [MÉDIO] Volume de `SECURITY DEFINER` (673 funções)
673 funções definer é alto, mas justificável (RLS bypass controlado para
RPCs cross-tenant, `has_role`, etc.). Recomendação para PR-4:
- Gerar inventário `scripts/audit/list-definer-functions.ts`;
- Marcar cada função com tag de motivo (`# reason: cross-tenant aggregate`);
- Quem não tiver motivo, candidato a mover para `SECURITY INVOKER`.

### 2.8 🟡 [MÉDIO] 1.489 migrations sem CHANGELOG de schema
Inviável diff manual entre releases. Recomenda-se script `scripts/audit/db-changelog.ts`
(PR-4) que gere markdown sumarizando, por mês, tabelas criadas/alteradas e
policies alteradas.

## 3. Domínios mais densos (recorte por contagem de tabelas)

Aproximações (filtrando por prefixo):

| Domínio | Prefixo | Tabelas aprox. |
| --- | --- | ---: |
| Fábrica/PLM | `fabrica_*`, `produto_*`, `produtos_brasil*` | ~80 |
| Projetos | `projeto_*`, `tarefa*` | ~50 |
| China | `china_*` | ~50 |
| Trade Marketing | `trade_*`, `store_*`, `shelf_*`, `gondola_*` | ~50 |
| Financeiro | `contas_*`, `lancamentos_*`, `parcelas*`, `plano_*`, `trade_chart_of_accounts`, `transacoes_*` | ~50 |
| Marketing | `marketing_*`, `roteirista_*`, `roteiros_*`, `creative_studio_*`, `huggs_*` | ~40 |
| CRM | `crm_*`, `clientes*`, `prospects*` | ~40 |
| Segurança/Auditoria | `security_*`, `audit_*`, `siem_*`, `mfa_*`, `pentest_*` | ~30 |
| Copilot | `copilot_*`, `*_copilot_*` | ~15 |
| Estoque | `estoque_*`, `erp_estoque_*`, `fornecedor_estoque_*` | ~15 |

## 4. Itens a executar em PRs futuros

| Prioridade | Item | Onde |
| --- | --- | --- |
| **Crítica** | Reforçar SELECT do bucket `pasta-digital` (ownership/membership) | PR remediação |
| **Crítica** | Remover ou justificar a view `SECURITY DEFINER` | PR remediação |
| **Alta** | Resolver policy `USING (true)` em escrita | PR remediação |
| **Alta** | Decisão `anon` em `dynamic_forms*` (restringir ou mascarar) | PR remediação |
| **Média** | Inventário com motivo de cada `SECURITY DEFINER` | PR-4 |
| **Média** | DB CHANGELOG mensal automatizado | PR-4 |

## 5. Como reproduzir

```sql
-- Tabelas em public
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- RLS habilitado vs desabilitado
SELECT rowsecurity, count(*) FROM pg_tables
WHERE schemaname = 'public' GROUP BY rowsecurity;

-- Policies
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';

-- SECURITY DEFINER functions
SELECT count(*) FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true;

-- Buckets públicos
SELECT id FROM storage.buckets WHERE public = true;
```
