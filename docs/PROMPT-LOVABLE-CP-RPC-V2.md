# Prompt Lovable — RPCs de Contas a Pagar v2 (complemento da Fase B do frontend)

> O frontend da Fase B (tela `/dashboard/financeiro/contas-a-pagar`) já consome as RPCs e está **tolerante**:
> funciona com a v1 atual, mas 3 coisas só completam com esta v2:
> 1. **Filtros de Centro de Custo / Plano de Contas nos agregados** (hoje só filtram a tabela; o frontend já
>    tenta a assinatura estendida e cai para a base se a v2 não existir).
> 2. **Gráfico "Por Departamento"** (hoje mostra estado vazio — falta `por_departamento` no payload).
> 3. **Gráfico "Por Status" com valor original** (hoje usa valor_aberto → barra "Pago" fica zerada; falta
>    `valor_original` em `por_status`).
>
> ⚠️ **IMPORTANTE — sem overload:** adicionar parâmetros com DEFAULT via `CREATE OR REPLACE` cria uma
> SEGUNDA função (overload) e o PostgREST passa a dar erro de ambiguidade. É preciso **DROP da assinatura
> antiga** e criar só a estendida.

```
-- 1) fn_cp_dashboard v2: + p_centro_custo_id/p_plano_contas_id + por_departamento + valor_original em por_status
DROP FUNCTION IF EXISTS public.fn_cp_dashboard(integer[],date,date,uuid,text[]);
CREATE OR REPLACE FUNCTION public.fn_cp_dashboard(
  p_empresa_ids  integer[] DEFAULT NULL,
  p_data_de      date DEFAULT NULL,
  p_data_ate     date DEFAULT NULL,
  p_departamento uuid DEFAULT NULL,
  p_portadores   text[] DEFAULT NULL,
  p_centro_custo_id uuid DEFAULT NULL,
  p_plano_contas_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT * FROM public.contas_pagar cp
    WHERE cp.status <> 'cancelado'
      AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
      AND (p_data_de   IS NULL OR cp.data_vencimento >= p_data_de)
      AND (p_data_ate  IS NULL OR cp.data_vencimento <= p_data_ate)
      AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)
      AND (p_portadores IS NULL OR cp.portador = ANY(p_portadores))
      AND (p_centro_custo_id IS NULL OR cp.centro_custo_id = p_centro_custo_id)
      AND (p_plano_contas_id IS NULL OR cp.plano_contas_id = p_plano_contas_id)
  )
  SELECT jsonb_build_object(
    -- (todos os campos da v1, inalterados)
    'provisionado_aberto', (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE natureza_lancamento='provisionado' AND valor_aberto>0),
    'lancado_aberto',      (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE natureza_lancamento='lancado' AND valor_aberto>0),
    'total_aberto',        (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE valor_aberto>0),
    'qtd_aberto',          (SELECT count(*) FROM base WHERE valor_aberto>0),
    'vence_hoje',          (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento=current_date),
    'vence_7d',            (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento BETWEEN current_date AND current_date+7),
    'vence_30d',           (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento BETWEEN current_date AND current_date+30),
    'vencido_30_mais',     (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento < current_date-30),
    'vencido_total',       (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento < current_date),
    'por_status',          (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT status, count(*) qtd, COALESCE(sum(valor_aberto),0) valor, COALESCE(sum(valor_original),0) valor_original FROM base GROUP BY status) x),
    'por_natureza',        (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT natureza_lancamento, count(*) qtd, COALESCE(sum(valor_aberto),0) valor FROM base WHERE valor_aberto>0 GROUP BY natureza_lancamento) x),
    'top_fornecedores',    (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT fornecedor_nome, COALESCE(sum(valor_original),0) valor, count(*) qtd FROM base WHERE fornecedor_nome IS NOT NULL GROUP BY fornecedor_nome ORDER BY 2 DESC LIMIT 10) x),
    'evolucao_mensal',     (SELECT COALESCE(jsonb_agg(x ORDER BY mes),'[]'::jsonb) FROM (SELECT to_char(date_trunc('month',data_vencimento),'YYYY-MM') mes, COALESCE(sum(valor_pago),0) pago, COALESCE(sum(valor_aberto),0) aberto, COALESCE(sum(valor_original),0) original FROM base GROUP BY 1) x),
    -- NOVOS v2:
    'por_departamento',    (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT departamento_nome, COALESCE(sum(valor_original),0) valor FROM base GROUP BY departamento_nome ORDER BY 2 DESC LIMIT 8) x),
    'pago_mes_atual',      (SELECT COALESCE(sum(valor_pago),0) FROM base WHERE valor_aberto <= 0.005 AND data_pagamento BETWEEN date_trunc('month',current_date)::date AND (date_trunc('month',current_date) + interval '1 month - 1 day')::date)
  );
$$;
GRANT EXECUTE ON FUNCTION public.fn_cp_dashboard(integer[],date,date,uuid,text[],uuid,uuid) TO authenticated;

-- 2) fn_cp_kpis_avancados v2: mesmos 2 parâmetros novos no WHERE da base (corpo idêntico ao atual)
DROP FUNCTION IF EXISTS public.fn_cp_kpis_avancados(integer[],date,date,uuid,text[]);
-- Recriar com a mesma lógica atual, acrescentando p_centro_custo_id uuid DEFAULT NULL e
-- p_plano_contas_id uuid DEFAULT NULL na assinatura e as 2 cláusulas no WHERE da CTE base:
--   AND (p_centro_custo_id IS NULL OR cp.centro_custo_id = p_centro_custo_id)
--   AND (p_plano_contas_id IS NULL OR cp.plano_contas_id = p_plano_contas_id)
-- GRANT EXECUTE ... (integer[],date,date,uuid,text[],uuid,uuid) TO authenticated;
```

> O frontend detecta a v2 automaticamente (tenta a assinatura estendida quando os filtros de centro/plano
> estão ativos; usa `valor_original`/`por_departamento`/`pago_mes_atual` se presentes no payload). Nada a
> mudar no código do app após aplicar. `fn_cp_calendario` não muda.
