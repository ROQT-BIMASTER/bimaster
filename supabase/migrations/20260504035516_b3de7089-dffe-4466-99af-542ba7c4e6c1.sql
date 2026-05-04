-- =============================================================
-- DB Performance Fase 2A (2/2): drop de 8 índices órfãos
-- =============================================================
-- Finding: 8 índices não-usados (idx_scan = 0) totalizando ~39 MB
-- Risco:   baixíssimo — sem uso há > 7 dias
-- Rollback: recriar com indexdef abaixo
--
-- Definições originais (rollback):
-- CREATE INDEX idx_car_cliente ON public.contas_receber USING btree (cliente_id);
-- CREATE INDEX idx_clientes_celular ON public.clientes USING btree (celular);
-- CREATE INDEX idx_clientes_email ON public.clientes USING btree (email);
-- CREATE INDEX idx_clientes_perfil_score ON public.clientes_perfil_credito USING btree (score_atual);
-- CREATE INDEX idx_clientes_telefone ON public.clientes USING btree (telefone);
-- CREATE INDEX idx_contas_pagar_classificado_em ON public.contas_pagar USING btree (classificado_em) WHERE (classificado_em IS NOT NULL);
-- CREATE INDEX idx_erp_estoque_nome_trgm ON public.erp_estoque_distribuidora USING gin (nome_prod gin_trgm_ops);
-- CREATE INDEX idx_vendas_union_cod_produto ON public."Union" USING btree (cod_produto);
-- =============================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_vendas_union_cod_produto;
DROP INDEX IF EXISTS public.idx_contas_pagar_classificado_em;
DROP INDEX IF EXISTS public.idx_car_cliente;
DROP INDEX IF EXISTS public.idx_clientes_email;
DROP INDEX IF EXISTS public.idx_clientes_telefone;
DROP INDEX IF EXISTS public.idx_clientes_perfil_score;
DROP INDEX IF EXISTS public.idx_erp_estoque_nome_trgm;
DROP INDEX IF EXISTS public.idx_clientes_celular;

COMMIT;