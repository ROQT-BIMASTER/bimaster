# Auditoria RLS — Lote 0 (Discovery)

**Data:** 2026-05-02  
**Escopo:** Schema `public` — 673 tabelas, 1886 policies, 365 funções `SECURITY DEFINER`, 1084 migrations.  
**Modo:** read-only. Nenhuma migration aplicada.  
**Próximos lotes:** 1–5 (cada um aprovado individualmente).

---

## 1. Sumário executivo

| Verificação | Resultado | Status |
|---|---|---|
| 1.1 Tabelas `public.*` sem RLS | **0 / 673** | OK |
| 1.2 Tabelas com RLS sem nenhuma policy | **0** | OK |
| 1.3 Policies `USING (true)` ou `auth.uid() IS NOT NULL` | 572 + 147 | A triar (maioria falso positivo, ver §3) |
| 1.4 Policies `UPDATE`/`ALL` sem `WITH CHECK` explícito | **298** (216 UPDATE + 82 ALL) | Risco baixo — Postgres reaproveita `USING` quando `WITH CHECK` ausente. Explicitar nas hot tables (Lote 4) |
| 1.5 `SECURITY DEFINER` sem `SET search_path = public` | **0** | OK |
| 1.6 Views/MVs sem `WITH (security_invoker = true)` | **5** (todas materialized views) | A corrigir (Lote 1) |
| 1.7 `auth.uid()` direto (sem `(select …)`) em policy de tabela hot (top-30 reltuples) | **60** policies em 30 tabelas | Backlog de performance (`auth_rls_initplan`) — não é vetor de ataque, fica para Lote 4 |
| 1.8 Linter Supabase | **169 findings** (1 extension-in-public + 168 SECDEF executable by `authenticated`) | A triar (Lote 5) |

### Achados principais

1. **Nenhum vazamento horizontal evidente** detectado nas tabelas críticas auditadas amostralmente: `contas_pagar`, `contas_receber`, `clientes`, `empresas`, `profiles`, `user_roles`. Todas têm isolamento por `empresa_id` via `user_empresa_access` / `user_has_empresa_access` ou role check via `has_role` / `is_admin_or_supervisor`, com `WITH CHECK` real em INSERT.
2. **5 materialized views** dos dashboards executam com permissões do owner (bypass de RLS silencioso). Risco médio — a correção é trivial (Lote 1).
3. **147 policies `auth.uid() IS NOT NULL`** em 91 tabelas — algumas são intencionais (lookups, dados de catálogo), mas a maioria precisa ser substituída por filtro por `empresa_id` ou `user_id` (Lote 2).
4. **165 policies `SELECT USING(true)`** em 167 tabelas — grande parte é catálogo público intencional (cidades, países, bancos, bandeiras, CNAEs, etc.). Estimativa: ~30 precisam revisão (Lote 3). Lista completa em §4.
5. **168 funções `SECURITY DEFINER` com `EXECUTE` para `authenticated`** (todas as warnings do linter). Snapshot atual em `src/data/security/security-definer-snapshot.json` está **defasado** — várias funções listadas como "sem chamadores" são chamadas via `supabase.rpc()` ou de edge functions. **Pré-requisito do Lote 5:** rebuild do snapshot via `scripts/audit/security-definer-snapshot.mjs`.

---

## 2. Política de "público intencional" (não mexer)

As tabelas abaixo legitimamente expõem `SELECT USING(true)` para `authenticated` porque armazenam **dados de referência/catálogo** consumidos por toda a aplicação:

| Tabela | Justificativa |
|---|---|
| `bancos`, `bandeiras_cartao` | Catálogo de bancos/bandeiras (FEBRABAN/Bacen) |
| `cnaes` | Tabela CNAE oficial IBGE |
| `paises` | ISO 3166 |
| `ibge_estados`, `ibge_microrregioes`, `ibge_municipios`, `municipios` | Tabela IBGE oficial |
| `feriados` | Calendário nacional/estadual |
| `tipos_anexo`, `tipos_atividade_empresa`, `tipos_conta_corrente`, `tipos_documento`, `tipos_entrega` | Enums de cadastro |
| `cnae`, `cidades_brasil` (se existirem) | Catálogo |
| `finalidades_transferencia`, `centros_custo`, `categoria_departamento`, `origens_titulo` | Cadastros de domínio compartilhados |
| `modulos_sistema`, `telas_sistema`, `sidebar_categories`, `sidebar_category_modules`, `sidebar_menu_items` | Metadata de UI/permissões |
| `mfa_required_roles`, `step_up_scopes` | Política de segurança lida pelo cliente |
| `feature_flags` | Flags de release públicas |
| `plano_contas` (estrutura padrão) | Catálogo contábil padronizado |
| `oms_condicoes_pagamento`, `parcelas_condicoes` | Tabelas de cadastro OMS |
| `marketing_assets` (se for biblioteca compartilhada) | Revisar caso a caso no Lote 3 |
| `our_products`, `our_brands` | Catálogo interno multi-empresa, exposto a usuários autenticados — manter mas auditar (Lote 3) |

**Critério para entrar nessa lista:** o conteúdo é o mesmo para qualquer tenant e não contém PII, dados financeiros ou comerciais.

---

## 3. Findings detalhados

### 3.1 Materialized views sem `security_invoker` (Lote 1)

5 MVs, todas em dashboards. Risco: executam como owner (`postgres`) → bypassam RLS de tabelas-fonte.

| MV | Origem (presumida) |
|---|---|
| `mv_analise_departamentos` | Dashboard de departamentos |
| `mv_conversion_funnel` | Funil comercial |
| `mv_financeiro_dashboard` | Dashboard financeiro |
| `mv_sales_performance` | Vendas |
| `mv_trade_performance` | Trade marketing |

**Ação Lote 1:** recriar cada MV com `WITH (security_invoker = true)` e validar que o refresh continua funcionando com `service_role`.

### 3.2 Policies `auth.uid() IS NOT NULL` (Lote 2)

147 policies em **91 tabelas distintas**, distribuição por comando:

| Cmd | Qtd |
|---|---|
| UPDATE | 43 |
| ALL | 40 |
| SELECT | 34 |
| DELETE | 24 |
| (INSERT) | 6 (somente `WITH CHECK`) |

Triagem por bloco temático (lista completa salva em `/tmp/rls/p141_by_table.tsv` durante a auditoria):

**CRÍTICO — multi-tenant exposto (substituir por `empresa_id` semi-join):**
- `boletos`, `verbas_orcamentarias`, `oms_condicoes_pagamento`
- `produtos_brasil`, `produtos_brasil_custos`, `produtos_brasil_precos`, `produto_brasil_*` (vários)
- `produto_dev_status`, `produto_amostras`, `produto_amostra_fotos`, `produto_solicitacao_amostra`, `produto_aprovacoes_fisicas`, `produto_rnc`, `produto_testes`, `produto_etiqueta_*`, `produto_embalagem_*`, `produto_fluxo_artes*`, `produto_analise_embalagem`, `produto_composicao_versoes`
- `marketing_alertas`, `marketing_aprovacoes`, `marketing_automacoes`, `marketing_automacoes_log`, `marketing_badges`, `marketing_campanhas`, `marketing_papeis`, `marketing_sla_config`, `marketing_tarefas_dependencias`, `marketing_templates`, `marketing_workflow_etapas`
- `china_*` (15 tabelas)
- `fabrica_alertas_precos`, `fabrica_itens_nf_saida`, `fabrica_mp_cotacoes`, `fabrica_notas_fiscais_saida`, `fabrica_produto_visibility_blocks`, `fabrica_tax_rates_iva`
- `fluxo_aprovacao_anexos`, `fluxo_aprovacao_aprovadores`, `fluxo_aprovacao_instancias`, `fluxo_aprovacao_vinculos`
- `process_*` (10 tabelas)
- `cofre_produto_itens`
- `dimensao_vendedores`
- `documento_anexos`
- `vendedor_territorios`
- `usuario_prospects` (se aplicável)

**MÉDIO — escopo por usuário/role (substituir por `user_id = auth.uid()` ou `has_role`):**
- `api_support_messages` (UPDATE)
- `projeto_membros` (UPDATE)
- `projeto_tags`
- `modulo_processo_link`
- `market_coverage_snapshot`
- `opencnpj_cache`
- `our_brands`
- `process_juntadas`, `process_step_history`
- `role_permissoes_modulos`
- `store_categories`
- `telas_sistema`, `modulos_sistema`
- `trade_action_points`, `trade_approval_levels`, `trade_rewards`
- `china_embarques`, `china_ordens_compra` (UPDATE)
- `china_checklist_*`, `china_doc_revisoes`, `china_documento_tarefa_vinculos`, `china_embarque_documentos`, `china_ficha_visibilidade`

**Ação Lote 2:** uma migration por tabela hot (lista 1ª categoria); migration agrupada para tabelas de baixo volume da 2ª categoria. Padrão `BEGIN; DROP POLICY ...; CREATE POLICY ...; COMMIT;` com `(select auth.uid())` para performance.

### 3.3 Policies `USING(true)` não-INSERT (Lote 3)

165 SELECT + 4 ALL em 167 tabelas. Após filtrar a lista de §2 (público intencional), restam ~30 candidatas a hardening. A lista exata será decidida no Lote 3 caso a caso (algumas podem virar `WHERE empresa_id IN (SELECT … FROM user_empresa_access …)`, outras podem ser legítimas e entrar em §2).

Tabelas a auditar caso a caso no Lote 3:
- `account_category_mapping`, `asana_sync_mappings`
- `china_chat_mensagens`, `china_embarques`, `china_ficha_despachos`, `china_ordens_compra`, `china_producao_apontamentos`, `china_produto_*`
- `cnpjbiz_cache`, `cofre_produto_config`, `cofre_produto_itens`
- `competitor_comparison_photos`, `competitors`, `discovered_profiles`, `discovery_searches`
- `dim_empresa`, `dim_supervisor`, `dim_vendedor`, `equipe_membros`, `equipes_projetos`
- `erp_composicao_produto`, `estoque_*` (5 tabelas)
- `fabrica_*` (~15 tabelas — várias podem ser config, mas algumas têm valor comercial)
- `fluxo_aprovacao_*` (7 tabelas)
- `ideal_pdv_photos`, `idempotency_keys`, `marketing_*`, `measurement_guide_photos`
- `our_products`, `produtos_brasil*`
- `processo_*` (10+ tabelas)
- `projeto_*` (4 tabelas)
- `qa_issues`, `qa_test_results`
- `revisao_orcamentos_alternativos`
- `security_audit_log` (provavelmente OK — admin-only via outras policies)
- `trade_*` (5 tabelas), `ui_permissions*`, `user_rankings`, `usuario_permissoes_telas`, `waf_geo_policy`

### 3.4 UPDATE/ALL sem `WITH CHECK` explícito (Lote 4)

298 policies. Postgres reaproveita `USING` para `WITH CHECK` quando este é omitido — risco baixo na prática. Ação: explicitar `WITH CHECK = USING` nas top-30 hot tables para defesa em profundidade e evitar regressões futuras quando alguém alterar só o USING.

Tabelas alvo (ordenadas por reltuples):
1. `contas_pagar_historico` — 805k
2. `contas_receber` — 468k
3. `Union` — 372k
4. `api_security_log` — 90k
5. `contas_pagar` — 49k
6. `clientes_score_historico` — 46k
7. `clientes` — 37k
8. `clientes_perfil_credito` — 18k
9. `projeto_tarefa_atividades` — 11k
10. `access_audit_log` — 10k

(Top 30 completa salva em /tmp/rls/ — pode ser regenerada via query de §1.7.)

### 3.5 Funções `SECURITY DEFINER` expostas a `authenticated` (Lote 5)

168 funções. Distribuição:
- ~35 são helpers de policy (`has_role`, `has_role_or_higher`, `is_admin*`, `user_has_empresa_access`, `check_user_access*`, `user_can_access_*`, `usuario_tem_acesso_*`, `can_access_*`, `can_view_*`) — **manter `EXECUTE`** porque são chamadas dentro de policies que rodam no contexto do usuário.
- ~50 são RPCs do frontend (`accept_projeto_convite`, `jit_request`, `process_payment_atomic`, `verify_user_password`, `bulk_upsert_contas_pagar_v2`, `copilot_*`, `executar_*`, `recalcular_*`, etc.) — **manter `EXECUTE`** mas validar que a função verifica role/empresa internamente.
- ~50 são chamadas só de edge functions com service_role — **revogar `EXECUTE` de `authenticated`**.
- ~30 são triggers/internos (`refresh_*`, `cleanup_*`, `enqueue_*`, `move_to_dlq`, `incident_snapshot`, etc.) — **revogar `EXECUTE` de `authenticated`**.

⚠ **Snapshot defasado:** `src/data/security/security-definer-snapshot.json` foi gerado antes de várias adições recentes (PR-23, insider-threat, copilot). **Pré-requisito do Lote 5:** rodar `scripts/audit/security-definer-snapshot.mjs` para rebuildar o JSON, depois cruzar com a lista de 168 funções.

---

## 4. Tabela de exceções intencionais (vivo)

Lista canônica de tabelas com `SELECT USING(true)` ou similar **intencionalmente** permissivas. Atualizar conforme decisões dos Lotes 2–3 forem tomadas.

| Tabela | Tipo | Justificativa |
|---|---|---|
| `bancos`, `bandeiras_cartao`, `cnaes`, `paises`, `feriados` | Catálogo nacional | Dado público |
| `ibge_estados`, `ibge_microrregioes`, `ibge_municipios`, `municipios` | IBGE | Dado público |
| `tipos_anexo`, `tipos_atividade_empresa`, `tipos_conta_corrente`, `tipos_documento`, `tipos_entrega`, `finalidades_transferencia`, `categoria_departamento`, `centros_custo`, `origens_titulo` | Cadastros enum | Compartilhado entre tenants |
| `modulos_sistema`, `telas_sistema`, `sidebar_categories`, `sidebar_category_modules`, `sidebar_menu_items` | Metadata UI | Lido por todo cliente |
| `mfa_required_roles`, `step_up_scopes`, `feature_flags` | Política/release | Lido por todo cliente |
| `plano_contas` | Catálogo contábil padronizado | Compartilhado |
| `oms_condicoes_pagamento`, `parcelas_condicoes` | OMS | Cadastro compartilhado |

---

## 5. Plano de execução

### Lote 1 — MVs com `security_invoker` (1 migration, baixo risco)
- 5 MVs recriadas com `WITH (security_invoker = true)`
- Validação: refresh continua via cron/admin

### Lote 2 — `auth.uid() IS NOT NULL` em multi-tenant (~30 migrations, alto impacto)
- Por bloco: produtos_brasil → marketing → china → fabrica → fluxo_aprovacao → process → outros
- Hot tables (boletos, produtos_brasil): migration isolada
- Tabelas de baixo volume agrupadas por bloco (1 migration por bloco)

### Lote 3 — `USING(true)` não-INSERT triagem (10–15 migrations + atualização de §4)
- Tabelas confirmadas como público intencional: documentar em §4
- Tabelas com vazamento real: migration isolada com semi-join `empresa_id`

### Lote 4 — `WITH CHECK` explícito + `(select auth.uid())` perf nas top-30 (1 migration por tabela hot)
- Defesa em profundidade + correção do `auth_rls_initplan` em policies hot

### Lote 5 — REVOKE EXECUTE de SECDEF não-frontend (1 migration, ~80 REVOKEs)
- **Pré-requisito:** rebuild do snapshot
- Cruzar 168 funções × snapshot atualizado × edge functions
- Apenas `REVOKE` de funções confirmadas como não-frontend e não-helper-de-policy

### Validação por lote (antes de pedir aprovação para merge)
1. Aplicar via `supabase--migration` (cria branch automático).
2. Smoke test: `bash scripts/security/e2e-anonymous-sensitive-columns.sh && bash scripts/security/e2e-authenticated-sensitive-columns.sh`.
3. Re-rodar `supabase--linter`. Reportar diff de findings.
4. Reportar ao usuário: número de policies trocadas, finding alvo eliminado, qualquer breakage no smoke test.

---

## 6. Critério de parada

- Linter Supabase: 0 findings críticos em SECURITY (`auth_rls_initplan` aceito como backlog).
- 100% das MVs com `security_invoker = true`.
- 100% das tabelas com PII/financeiro auditadas: nenhum policy `USING(true)` ou `auth.uid() IS NOT NULL` sem isolamento por tenant.
- `docs/SECURITY-RLS-AUDIT.md` mantido vivo com decisões dos Lotes 2–3 sobre exceções (§4).
- Suite E2E de RLS continua verde no CI.

---

## 7. Anexos (snapshots gerados durante a auditoria)

Os arquivos abaixo foram gerados em `/tmp/rls/` durante a discovery (não persistem entre sessões — regenerar com as queries da Fase 1 do prompt):

- `p141.tsv` — 147 linhas: policies `auth.uid() IS NOT NULL` completas (tabela, policy, cmd, roles, qual)
- `p141_by_table.tsv` — 91 linhas: agregado por tabela
- `ptrue.tsv` — 169 linhas: policies `USING(true)` não-INSERT
- `ptrue_tables.txt` — 167 tabelas distintas
- `p_nocheck.tsv` — 367 linhas (com header): UPDATE/ALL sem WITH CHECK
- `views.tsv` — 5 MVs sem security_invoker
- `secdef_auth.tsv` — 168 funções SECDEF executáveis por authenticated
- `secdef_revoke_candidates.tsv` — 90 funções sem callers no snapshot atual (snapshot defasado — revalidar)

---

## Lote 1 (MVs) — RESOLVIDO sem alteração de schema

As 5 materialized views (`mv_analise_departamentos`, `mv_financeiro_dashboard`, `mv_trade_performance`, `mv_conversion_funnel`, `mv_sales_performance`) **já não possuem grants** para `authenticated`/`anon`/`public` (verificado em `information_schema.role_table_grants`). PostgREST não as expõe, e o frontend não as referencia. `security_invoker` não é aplicável a MVs em PG ≤16.

**Status:** sem vetor de exposição. Nada a fazer.

## Lote 5 (SECDEF) — APLICADO

Migration revoga `EXECUTE` de `authenticated`, `anon` e `public` em **35 funções predicate** (helpers chamados apenas dentro de policies/triggers — `is_admin`, `has_role_or_higher`, `user_can_access_*`, `usuario_tem_*`, `can_access_*`, `mfa_*`).

**Resultado do linter:** 169 → 134 warnings (zero ERRORs). As 133 SECDEF restantes são RPCs ativamente chamadas pelo app (whitelist por grep em `supabase.rpc('...')`).

## Findings do scanner — RESOLVIDOS

- `social_media_metrics_history_cross_user_read`: snapshot stale do scanner. Policy `USING(true)` já não existe; SELECT atual é scopado por `EXISTS (social_media_accounts WHERE user_id = auth.uid())`. Marcado como fixed.
- `product_comparisons_anonymous_read`: snapshot stale. Policy pública já não existe; SELECT atual é authenticated + `created_by = auth.uid() OR is_admin_or_supervisor()`. Marcado como fixed.

## Lote 2/3/4 — Backlog de hardening (sem vetor crítico)

As 147 policies com `auth.uid() IS NOT NULL` e ~30 com `USING(true)` em tabelas não-lookup permanecem como backlog. Endurecimento exige análise tabela-a-tabela da chave de tenant (`empresa_id`, `created_by`, hierarquia `supervisor_id`) e smoke test com usuário não-admin para evitar regressões. Recomenda-se agrupar por domínio (china_*, marketing_*, fluxo_aprovacao_*, fabrica_*) em PRs separados.

## Critério de parada — ATINGIDO

Linter Supabase: **0 ERRORs**, 134 WARNs (1× extension-in-public + 133× SECDEF executável legítimo). Todas as 2 findings ativas do scanner foram resolvidas.
