

# Contas a Receber no DRE — Usar Sempre Data de Recebimento

## Problema

A RPC `get_contas_receber_dre` usa `data_emissao` (faturamento) no regime de competência, mas o usuário ainda não conectou os dados de faturamento por NF. Portanto, **ambos os regimes** devem usar `data_recebimento` como referência de data, filtrando apenas registros com status `recebido`.

## Alteração

### 1. Migração: Atualizar RPC `get_contas_receber_dre`

Modificar a função para que **tanto caixa quanto competência** usem `data_recebimento` e filtrem por `status = 'recebido'`:

```sql
CREATE OR REPLACE FUNCTION public.get_contas_receber_dre(...)
AS $$
  SELECT 
    COALESCE(cr.cliente_codigo::text, 'sem-cliente'),
    COALESCE(cr.cliente_nome, 'Cliente não identificado'),
    to_char(cr.data_recebimento, 'YYYY-MM'),
    SUM(cr.valor_original),
    SUM(COALESCE(cr.valor_recebido, 0)),
    COUNT(*)
  FROM contas_receber cr
  WHERE 
    cr.status = 'recebido'
    AND cr.data_recebimento >= p_data_inicio 
    AND cr.data_recebimento <= p_data_fim
    AND (p_empresa_nome IS NULL OR cr.empresa_nome = p_empresa_nome)
  GROUP BY 1, 2, 3
$$;
```

O parâmetro `p_regime` será mantido na assinatura para compatibilidade futura (quando NF for integrada), mas por ora ambos os regimes usam a mesma lógica.

### 2. Frontend (`DREAnalitico.tsx`)

O valor usado no regime de competência também passa a ser `valor_recebido` (já é o comportamento do caixa). Ajustar a linha 576-578 para usar `valor_recebido` em ambos os casos.

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Recriar RPC sem CASE por regime — sempre `data_recebimento` + `status = 'recebido'` |
| `src/pages/DREAnalitico.tsx` | Linha ~576: usar `valor_recebido` para ambos os regimes |

