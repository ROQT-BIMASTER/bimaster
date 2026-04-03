

# Corrigir Carregamento de Contas a Receber no DRE

## Problemas Identificados

1. **Performance crítica**: O DRE busca ~44.000 registros de `contas_receber` via `fetchAllRows`, fazendo ~44 chamadas sequenciais de API (batches de 1.000). Isso é extremamente lento e frequentemente falha por timeout.

2. **Regime de Caixa usa data errada**: O filtro e o `getDataRefReceber` usam `data_vencimento` como proxy para caixa, mas os registros TÊM `data_recebimento` preenchida (44.649 de 44.649 recebidos). Deveria usar `data_recebimento`.

3. **Competência não filtra status**: Inclui registros "vencido" (1.608) junto com pendentes e recebidos sem distinção — pode distorcer a receita se houver registros cancelados futuramente.

## Solução

Criar uma **RPC server-side** que agrega os dados de contas a receber diretamente no banco, retornando apenas os totais por mês e cliente (~200-500 linhas em vez de 44.000).

### 1. Migração: Criar RPC `get_contas_receber_dre`

```sql
CREATE OR REPLACE FUNCTION public.get_contas_receber_dre(
  p_data_inicio date,
  p_data_fim date,
  p_regime text DEFAULT 'competencia',
  p_empresa_nome text DEFAULT NULL
)
RETURNS TABLE(
  cliente_codigo text,
  cliente_nome text,
  mes text,
  valor_original numeric,
  valor_recebido numeric,
  qtd_documentos bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(cr.cliente_codigo::text, 'sem-cliente'),
    COALESCE(cr.cliente_nome, 'Cliente não identificado'),
    to_char(
      CASE WHEN p_regime = 'caixa' THEN cr.data_recebimento 
           ELSE cr.data_emissao END, 
      'YYYY-MM'
    ),
    SUM(cr.valor_original),
    SUM(cr.valor_recebido),
    COUNT(*)
  FROM contas_receber cr
  WHERE 
    CASE WHEN p_regime = 'caixa' THEN
      cr.status = 'recebido' 
      AND cr.data_recebimento >= p_data_inicio 
      AND cr.data_recebimento <= p_data_fim
    ELSE
      cr.data_emissao >= p_data_inicio 
      AND cr.data_emissao <= p_data_fim
    END
    AND (p_empresa_nome IS NULL OR cr.empresa_nome = p_empresa_nome)
  GROUP BY 1, 2, 3
$$;
```

### 2. Atualizar `DREAnalitico.tsx`

| Mudança | Detalhe |
|---|---|
| Substituir `fetchAllRows('contas_receber')` | Usar `supabase.rpc('get_contas_receber_dre', {...})` — 1 chamada em vez de ~44 |
| Corrigir `getDataRefReceber` | Caixa usa `data_recebimento`; Competência usa `data_emissao` |
| Adaptar `construirHierarquiaDRE` | Trabalhar com dados agregados (por cliente/mês) em vez de registros individuais. Lançamentos individuais não estarão mais disponíveis no nível mais baixo da árvore — serão exibidos totais por cliente |

### Resultado Esperado

- **1 query SQL** em vez de ~44 chamadas REST
- Tempo de carregamento: de ~30-60s para <1s
- Dados corretos no regime de caixa (usando `data_recebimento`)
- Receita agrupada por cliente com totais mensais precisos

