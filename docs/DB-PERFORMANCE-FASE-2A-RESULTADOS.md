# DB Performance Fase 2A — Resultados

**Data**: 2026-05-04
**Escopo**: Otimização de RLS initplan + drop de índices órfãos nas top-30 tabelas.

## Migrations aplicadas

1. `perf_auth_uid_initplan_top30` — reescreveu **76 policies** em 22 tabelas, substituindo `auth.uid()` por `(select auth.uid())` (inclusive dentro de funções como `has_role`, `check_user_access`, `user_has_empresa_access`, `user_can_access_projeto`, etc).
2. `perf_drop_orphan_indexes` — dropou **8 índices** com `idx_scan = 0`, liberando ~39 MB.

## Validação pós-merge

| Métrica | Esperado | Observado |
|---|---|---|
| Policies não-otimizadas em top-30 (regex `auth.uid()` fora de `SELECT auth.uid()`) | 0 | **0** ✅ |
| Índices órfãos remanescentes | 0 | **0** ✅ |
| `pg_stat_statements_reset()` | executado | **2026-05-04 03:56:08 UTC** ✅ |
| Advisor `ERROR` novos | 0 | **0** ✅ (170 WARN pré-existentes mantidos) |

> Nota: a query de validação do prompt original (`NOT LIKE '%(select auth.uid())%'`) retorna 76 falsos-positivos porque o Postgres normaliza a expressão para `( SELECT auth.uid() AS uid)`. A validação correta usa regex `~ 'auth\.uid\(\)' AND !~ 'SELECT auth\.uid\(\)'` — resultado real: **0 pendentes**.

## Tabelas e policies migradas (76 total)

| Tabela | Tamanho | Policies migradas |
|---|---|---|
| Union | 1030 MB | 4 |
| contas_receber | 546 MB | 4 |
| contas_pagar | 195 MB | 4 |
| contas_pagar_historico | 188 MB | 2 |
| clientes | 52 MB | 7 |
| clientes_score_historico | — | 4 |
| clientes_alertas_credito | — | 4 |
| clientes_perfil_credito | — | 4 |
| projeto_tarefas | — | 6 |
| projeto_tarefa_colaboradores | — | 4 |
| projeto_tarefa_seguidores | — | 3 |
| projeto_tarefa_atividades | — | 2 |
| notifications | — | 4 |
| influencer_comments | — | 5 |
| usuario_permissoes_telas | — | 5 |
| access_audit_log | — | 3 |
| erp_estoque_distribuidora | — | 2 |
| bom_edges | — | 2 |
| api_security_log / sync_logs / etl_changelog / fabrica_historico_precos / dynamic_form_answers / erp_composicao_produto / estoque_produto_nivel / security_ip_blocklist | — | 8 (1 cada) |

## Índices dropados (rollback)

```sql
CREATE INDEX idx_vendas_union_cod_produto      ON public."Union"                  USING btree (cod_produto);
CREATE INDEX idx_contas_pagar_classificado_em  ON public.contas_pagar             USING btree (classificado_em) WHERE (classificado_em IS NOT NULL);
CREATE INDEX idx_car_cliente                   ON public.contas_receber           USING btree (cliente_id);
CREATE INDEX idx_clientes_email                ON public.clientes                 USING btree (email);
CREATE INDEX idx_clientes_telefone             ON public.clientes                 USING btree (telefone);
CREATE INDEX idx_clientes_perfil_score         ON public.clientes_perfil_credito  USING btree (score_atual);
CREATE INDEX idx_erp_estoque_nome_trgm         ON public.erp_estoque_distribuidora USING gin   (nome_prod gin_trgm_ops);
CREATE INDEX idx_clientes_celular              ON public.clientes                 USING btree (celular);
```

Total liberado: **~39 MB**.

## Validação 24h depois (a fazer manualmente)

Re-rodar query do Bloco 2 do `DB-PERFORMANCE-AUDIT.md` e comparar `mean_exec_time` das queries que tocam `Union`, `contas_receber`, `contas_pagar`. Esperado: queda de **20–40%** no tempo médio.

```sql
SELECT substring(query, 1, 200) AS q, calls, ROUND(mean_exec_time::numeric, 2) AS media_ms
FROM pg_stat_statements
WHERE query ILIKE '%Union%' OR query ILIKE '%contas_receber%' OR query ILIKE '%contas_pagar%'
ORDER BY mean_exec_time DESC LIMIT 20;
```

## Riscos detectados

- **Lock momentâneo** em DROP+CREATE policy nas tabelas grandes (`Union` 1 GB, `contas_receber` 546 MB): aplicado em transação única, sem evidência de timeout/contenção nos logs.
- **170 warnings de linter pré-existentes** (Function Search Path Mutable, Public Can Execute SECURITY DEFINER, etc.) — **não introduzidos** por esta rodada. Endereçados em projetos de hardening anteriores; cauda restante fora de escopo.

## Fora de escopo (próximas rodadas)

- Finding 2: sync row-by-row em `contas_receber` (956h CPU cumulativo) → projeto separado.
- Finding 3: `OFFSET` → cursor pagination → projeto separado.
- 1.176 policies fora das top-30 (cauda longa, ROI marginal) → Fase 2B opcional.
- `clientes_score_historico` 93% seq scan → avaliar índice em Fase 2B.
- VACUUM / REINDEX → janela de manutenção.
