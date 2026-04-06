

# Enriquecer Plano de Redução com Métricas por Fornecedor

## Objetivo

Adicionar 3 informações calculadas para cada fornecedor na tela de redução de gastos:
1. **Média mensal de gasto** — soma total ÷ meses com pagamentos
2. **Histórico de pagamentos** — últimos 6 meses com valores (mini sparkline ou lista)
3. **Status Ativo/Inativo** — Inativo se último pagamento > 60 dias atrás

## Abordagem

Criar uma **RPC no banco** que, dado uma lista de `fornecedor_codigo`, retorna para cada um:
- `media_mensal`: média de gasto/mês (últimos 12 meses)
- `ultimo_pagamento`: data do último pagamento registrado
- `historico_mensal`: JSON com valores dos últimos 6 meses `[{mes, valor}]`
- `ativo`: boolean (último pagamento ≤ 60 dias)
- `total_12m`: total gasto nos últimos 12 meses

Isso evita N+1 queries no frontend e é performático.

## Alterações

### 1. Migração SQL — RPC `get_fornecedor_metricas_reducao`

```sql
CREATE OR REPLACE FUNCTION get_fornecedor_metricas_reducao(p_codigos text[])
RETURNS TABLE(
  fornecedor_codigo text,
  media_mensal numeric,
  ultimo_pagamento date,
  total_12m numeric,
  ativo boolean,
  historico_mensal jsonb
) ...
```

A função consulta `contas_pagar` agrupando por `fornecedor_codigo` e mês, calculando média, último pagamento e flag de atividade.

### 2. `src/components/financeiro/PlanoReducaoGastos.tsx`

- **Query adicional**: Após carregar `revisoes`, extrair os `fornecedor_codigo` únicos e chamar a RPC para buscar métricas.
- **Colunas novas na tabela** (visão fornecedor):
  - **Média/Mês**: valor formatado em R$
  - **Último Pgto**: data formatada
  - **Status**: Badge "Ativo" (verde) ou "Inativo" (vermelho) com tooltip mostrando dias desde último pagamento
- **Histórico**: No detalhe expandido do fornecedor, mostrar mini-tabela ou badges com os valores dos últimos 6 meses

## Arquivos

| Arquivo | Alteração |
|---|---|
| 1 migração SQL | Criar RPC `get_fornecedor_metricas_reducao` |
| `src/components/financeiro/PlanoReducaoGastos.tsx` | Query RPC + colunas Média/Mês, Último Pgto, Ativo/Inativo, histórico expandido |

