

# Fix: Contas a Receber Truncadas no DRE (Limite 1000 linhas)

## Diagnóstico Confirmado

A RPC `get_contas_receber_dre` retorna **45.118 linhas** (cliente × mês), mas o PostgREST **limita a 1.000 linhas** na resposta. Resultado: DRE mostra ~R$3,9M em vez de ~R$231M.

Valores reais no banco (2025):
- Janeiro: R$17M | Fevereiro: R$14,9M | ... | Novembro: R$30,2M | Dezembro: R$21M
- **Total anual: R$231M**

## Solução

Criar **2 RPCs** substituindo a atual:

### 1. `get_contas_receber_dre_totais` — Totais por mês (12 linhas max)

Agrega tudo por mês, sem detalhe de cliente. Usada para os **valores do DRE** (cálculos de receita bruta).

```sql
RETURNS TABLE(mes text, valor_original numeric, valor_recebido numeric, qtd_documentos bigint)
-- Retorna no máximo 12-13 linhas por ano = nunca atinge limite
```

### 2. `get_contas_receber_dre_clientes` — Top clientes para drill-down (limitada)

Agrega por cliente (total do período, sem mês), limitada aos **top 50 clientes** por valor. Usada apenas para expandir a árvore.

```sql
RETURNS TABLE(cliente_codigo text, cliente_nome text, valor_recebido numeric, qtd_documentos bigint)
LIMIT 50
```

### 3. Frontend (`DREAnalitico.tsx`)

- Usar `get_contas_receber_dre_totais` para popular `receitaBruta.valoresMensais` — garante totais corretos
- Usar `get_contas_receber_dre_clientes` apenas para os nós filhos da árvore (drill-down visual)
- Remover chamada atual à RPC `get_contas_receber_dre`

## Resultado

| Antes | Depois |
|---|---|
| 45.118 linhas → truncado em 1.000 | 12 linhas (totais) + 50 linhas (clientes) |
| R$3,9M exibido | R$231M exibido (valor real) |
| 1 RPC | 2 RPCs paralelas, ambas sub-segundo |

## Arquivos

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Criar 2 RPCs novas, dropar a antiga |
| `src/pages/DREAnalitico.tsx` | Substituir chamada RPC por 2 queries paralelas, ajustar construção da hierarquia |

