

# Profissionalização do Plano de Contas e DRE — Análise e Melhorias

## Diagnóstico Atual

### Distribuição DRE (146 contas ativas)

| Categoria DRE | Analíticas | Grupos | % do total |
|---|---|---|---|
| `despesas_fixas` | 93 | 23 | **79%** |
| `custo_vendas` | 12 | 5 | 12% |
| `receita_bruta` | 5 | 1 | 4% |
| `deducoes` | 4 | 1 | 3% |
| `impostos_lucro` | 2 | 0 | 1% |

**Problema central**: 79% das contas estão em `despesas_fixas`. Isso "achata" o DRE — marketing, despesas financeiras, resultado não-operacional e retiradas de sócios aparecem todos na mesma linha.

---

## FALHAS IDENTIFICADAS (7 problemas)

### 1. Falta categoria `despesas_variaveis`

Marketing (`3.3.x`) e Trade (`2.6.x`) são despesas que variam com campanhas e sazonalidade. Estão classificadas como `despesas_fixas`, distorcendo a margem de contribuição.

**Correção**: Criar `despesas_variaveis` no enum e reclassificar `3.3.x` e `2.6.x`.

### 2. Falta categoria `despesas_financeiras`

Contas `3.4.1` (Despesas Bancárias), `3.4.2` (Receitas Bancárias), `4.3.3` (Juros Antecipação), `4.3.6` (Juros pagos) estão como `despesas_fixas`. No DRE profissional, resultado financeiro é uma linha separada entre EBITDA e Lucro Antes do IR.

**Correção**: Criar `resultado_financeiro` no enum e reclassificar.

### 3. Falta categoria `resultado_nao_operacional`

Contas `4.1.1` (Receitas não operacionais) e `4.1.2` (Despesas não operacionais) estão misturadas com despesas fixas. Profissionalmente, ficam **abaixo** do lucro operacional.

**Correção**: Criar `resultado_nao_operacional` no enum.

### 4. Grupo 4 inteiro classificado errado

Investimentos (`4.2.x`), empréstimos (`4.3.x`) e atividades com sócios (`4.4.x`) **não pertencem ao DRE**. São movimentações patrimoniais/fluxo de caixa. Marcar como `despesas_fixas` infla artificialmente as despesas.

**Correção**: Criar `nao_dre` ou setar `categoria_dre = NULL` para contas que não devem aparecer no DRE (investimentos, empréstimos, aportes, retiradas).

### 5. Pró-labore (`3.5.1`) como `despesas_fixas`

Pró-labore é despesa operacional, mas deveria ter uma sub-linha específica no DRE para transparência com os sócios. Está correto como `despesas_fixas`, porém sem distinção visual no DRE.

### 6. Receitas Financeiras (`4.3.5`) como `despesas_fixas`

Receita financeira é receita, não despesa fixa. Deveria ser `resultado_financeiro` com sinal positivo.

### 7. `Devolução (Clientes)` em `custo_vendas`

A conta `2.1.2 Devolução (Clientes)` deveria ser `deducoes` (abatimento da receita bruta), não custo de vendas.

---

## ESTRUTURA DRE PROFISSIONAL PROPOSTA

```text
(+) RECEITA BRUTA                          → receita_bruta
(-) Deduções (impostos s/ vendas, devol.)  → deducoes
(=) RECEITA LÍQUIDA

(-) Custos Variáveis (CMV, fretes, embal.) → custo_vendas
(=) LUCRO BRUTO

(-) Despesas Fixas (admin, pessoal)        → despesas_fixas
(-) Despesas Variáveis (marketing, trade)  → despesas_variaveis   ← NOVO
(=) EBITDA

(+/-) Resultado Financeiro                 → resultado_financeiro ← NOVO
(=) LUCRO ANTES DO IR

(-) Impostos sobre Lucro (IRPJ, CSLL)     → impostos_lucro
(=) LUCRO LÍQUIDO

(+/-) Resultado Não Operacional            → resultado_nao_operacional ← NOVO
(=) RESULTADO FINAL
```

Contas patrimoniais (investimentos, empréstimos, aportes, retiradas) ficam **fora do DRE** com `categoria_dre = NULL`.

---

## PLANO DE IMPLEMENTAÇÃO

### Etapa 1: Migração SQL — Novas categorias e reclassificações

1. **Adicionar 3 valores ao enum** `categoria_dre`:
   - `despesas_variaveis`
   - `resultado_financeiro`
   - `resultado_nao_operacional`

2. **Reclassificar contas**:
   - `3.3.x` (Marketing) → `despesas_variaveis`
   - `2.6.x` (Trade/Comissões) → `despesas_variaveis`
   - `3.4.1`, `3.4.2` → `resultado_financeiro`
   - `4.3.3`, `4.3.5`, `4.3.6` → `resultado_financeiro`
   - `4.1.1`, `4.1.2` → `resultado_nao_operacional`
   - `2.1.2` (Devoluções) → `deducoes`
   - `4.2.x`, `4.3.1`, `4.3.2`, `4.3.4`, `4.3.7-9`, `4.4.x` → `NULL` (fora do DRE)

### Etapa 2: Atualizar validação Zod

Adicionar os 3 novos valores no enum `categoria_dre` em `chart-of-accounts.ts`.

### Etapa 3: Atualizar DRE frontend

Ajustar o componente DRE para renderizar as novas linhas (EBITDA, Resultado Financeiro, Resultado Não Operacional) na ordem correta.

### Etapa 4: Atualizar edge functions

Atualizar `classificar-categoria-dre` e `dre-cadastro-api` para reconhecer as novas categorias.

| Prioridade | Ação | Impacto |
|---|---|---|
| Alta | Adicionar 3 categorias ao enum + reclassificar | DRE profissional com EBITDA |
| Alta | Remover grupo 4 patrimonial do DRE | Despesas deixam de ser infladas |
| Média | Atualizar frontend DRE | Visualização com linhas corretas |
| Média | Atualizar validações e edge functions | Consistência do sistema |

| Arquivo | Mudança |
|---|---|
| Migração SQL | ALTER TYPE + UPDATE ~40 contas |
| `src/lib/validations/chart-of-accounts.ts` | Adicionar 3 valores ao enum Zod |
| Componente DRE (frontend) | Novas linhas de subtotal |
| `supabase/functions/classificar-categoria-dre/index.ts` | Novas categorias no prompt |
| `supabase/functions/dre-cadastro-api/index.ts` | Novo sinal para `resultado_financeiro` |

