## Auditoria Multi-Tenant: contestar a defesa "single-tenant intencional"

### Por que a defesa anterior cai

Discovery executada agora no banco real:

| Sinal | Valor | Implicação |
|---|---|---|
| Empresas em `public.empresas` | **11** | Multi-tenant é fato no banco |
| Usuários em `auth.users` | 139 | |
| Usuários com vínculo em `user_empresas` | **3** | **136 usuários hoje "veem tudo" em qualquer policy fraca** |
| Tabelas com coluna `empresa_id` | **~40** | Modelo multi-tenant é muito mais amplo do que se admitiu |
| `default` automático em `empresa_id` | **2** (`clientes`, `sync_metrics`) | INSERT em todas as outras 38 tabelas pode entrar com `NULL` ou `empresa_id` arbitrário |

### A descoberta crítica

Tabelas que **TÊM `empresa_id`** mas ainda estão com policy `auth.uid() IS NOT NULL`:

- `boletos` (INSERT)
- `corporate_events`, `corporate_event_expenses`
- `department_budgets`, `department_expenses`
- `api_support_messages`
- `centros_custo`, `departamentos` (verificar)

Estas **não** são "single-tenant intencional". São **multi-tenant esquecidas** — exatamente o vetor de vazamento horizontal que você suspeitou.

### Reclassificação dos 219 findings residuais

Em vez de aceitar "single-tenant" como bloco único, separar por evidência objetiva:

```text
Categoria A — Multi-tenant esquecida (CRÍTICO, hardening obrigatório)
  Critério: tabela tem coluna empresa_id E policy é auth.uid() IS NOT NULL
  Ação: USING/CHECK com empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid())

Categoria B — Ownership não enforçado (CRÍTICO p/ DELETE/UPDATE)
  Critério: tabela tem created_by/user_id E policy DELETE/UPDATE é auth.uid() IS NOT NULL
  Risco: qualquer usuário deleta/altera registro de outro
  Ação: USING (created_by = auth.uid() OR has_role(admin/supervisor))

Categoria C — Vínculo via projeto/processo (CRÍTICO)
  Critério: tabela tem projeto_id/processo_id (ex.: china_*_tarefa_vinculos, fluxo_aprovacao_instancias)
  Ação: EXISTS no projeto/processo + check de membership

Categoria D — Lookup interno do módulo (precisa documentar)
  Critério: nenhuma coluna de tenancy/ownership; conteúdo é metadado de módulo
  Ex.: marketing_papeis, marketing_workflow_etapas, china_checklist_templates
  Ação: ou (a) restringir SELECT a usuários com acesso ao módulo via check_user_access,
         ou (b) documentar como "lookup compartilhado intencional"

Categoria E — Lookup público real (OK)
  Critério: dado é público por natureza (cnaes, paises, modulos_sistema)
  Ação: documentar em docs/SECURITY-RLS-AUDIT.md como exceção explícita
```

### Lotes de execução (uma migration por lote, com rollback)

**Lote A — Multi-tenant esquecidas** (impacto máximo, escopo claro):
Tabelas: `boletos`, `corporate_events`, `corporate_event_expenses`, `department_budgets`, `department_expenses`, `api_support_messages`, `centros_custo`, `departamentos` e demais tabelas confirmadas no cruzamento `empresa_id × policy fraca`.
Padrão da policy:
```sql
USING (
  empresa_id IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = (select auth.uid()))
  OR has_role((select auth.uid()), 'admin'::app_role)
)
WITH CHECK (mesma expressão)
```
Pré-requisito: backfill em `user_empresas` para os 136 usuários sem vínculo (senão tudo quebra).

**Lote B — Ownership em DELETE/UPDATE**:
Endurecer DELETE/UPDATE em tabelas com `created_by`/`user_id` (~30 tabelas, ex.: `china_ordens_compra`, `china_embarques`, `china_recebimentos_carga`, `dynamic_forms`, `marketing_campanhas`, `marketing_templates`, `marketing_automacoes`, `lead_activity_logs`, `process_juntadas`, etc.).
Padrão:
```sql
USING (created_by = (select auth.uid()) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'supervisor'::app_role))
```
SELECT/INSERT pode permanecer "qualquer membro" se o módulo é colaborativo, mas DELETE/UPDATE de registro alheio é sempre vetor de sabotagem.

**Lote C — Vínculo por projeto/processo**:
`china_documento_tarefa_vinculos`, `china_submissao_projetos`, `china_submissao_tarefa_vinculos`, `fluxo_aprovacao_instancias`, `fluxo_aprovacao_anexos`, `fluxo_aprovacao_vinculos`, `process_juntadas`, `process_step_history`, `process_doc_workflow_*`.
Padrão: `EXISTS (SELECT 1 FROM projeto_membros WHERE projeto_id = X AND user_id = auth.uid())` ou equivalente.

**Lote D — Restringir lookups de módulo** (decisão por módulo):
`marketing_*` (papéis, workflow, templates, sla_config) e `china_checklist_templates/categorias/itens`: trocar `auth.uid() IS NOT NULL` por `check_user_access(auth.uid(), 'marketing'/'fabrica')`.

**Lote E — Documentar lookups públicos** (sem migration):
`cnaes`, `paises`, `modulos_sistema`, `marketing_badges`, `dimensao_vendedores`, `our_brands` → marcar exceção formal em `docs/SECURITY-RLS-AUDIT.md`.

### Validação por lote (regra inviolável)

1. `supabase--migration` para o lote → harness aprova/aplica.
2. Smoke test E2E: `scripts/security/e2e-authenticated-sensitive-columns.sh` (precisa cobrir as novas tabelas — ampliar suite no Lote A).
3. Diff do `supabase--linter` antes/depois reportado ao usuário.
4. Sanity query: `SELECT count(*)` da tabela como usuário não-admin de duas empresas distintas — resultados devem diferir.

### Pré-requisito do Lote A — backfill `user_empresas`

Sem isso, ativar isolation por `empresa_id` quebra acesso de 136 usuários. Opções:

- (preferida) Migration que insere em `user_empresas` cada usuário ↔ empresa primária, derivada de `profiles.empresa_id` (se existir) ou da única empresa "operacional".
- (alternativa) Ativar policies só para tabelas onde o backfill for seguro; deixar as demais sob policy ampla com TODO explícito.

### Entregáveis

- `docs/SECURITY-RLS-AUDIT.md` reescrito com tabela A/B/C/D/E listando cada uma das ~219 policies residuais com sua categoria + lote alvo + justificativa.
- Migrations dos Lotes A–D, cada uma com header `Finding / Antes / Depois / Rollback`.
- CI: estender `scripts/security/` com casos cross-empresa para tabelas dos Lotes A e C.

### Próximo passo (este loop é apenas plano)

Aguardo decisão sobre:
1. Backfill de `user_empresas` antes do Lote A (preferida) ou começar pelo Lote B (ownership de DELETE/UPDATE) que não depende de backfill.
2. Se `marketing_*` e `china_checklist_templates` devem virar "qualquer usuário com módulo" (Lote D) ou ficar globais como hoje.