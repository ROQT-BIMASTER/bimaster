

# Fix: Filtro "Dia Pagamento" conflitando com filtro de Ano/Mês

## Problema

Quando o usuário seleciona uma data no filtro **"Dia Pagamento"**, a query adiciona `.eq('data_pagamento', '2026-03-19')` — mas o filtro de **ano/mês** continua sendo aplicado sobre `data_vencimento`. Isso significa que o sistema filtra por `data_pagamento = 19/03/2026` **E** `data_vencimento` dentro do mês/ano selecionado, retornando zero resultados quando a data de vencimento não cai no mesmo período.

A guarda `!filterDiaVencimento` na linha 226 só desativa o filtro de ano/mês quando "Dia Vencimento" está preenchido — mas ignora o cenário de "Dia Pagamento".

## Solução

**Arquivo**: `src/pages/ContasAPagar.tsx` — função `buildBaseFilters`

Alterar a condição na linha 226 de:

```
if (!filterDiaVencimento) {
```

Para:

```
if (!filterDiaVencimento && !filterDiaPagamento) {
```

Isso garante que quando qualquer filtro de data específica estiver ativo (vencimento **ou** pagamento), o filtro de range por ano/mês sobre `data_vencimento` seja desabilitado, evitando o conflito.

A mesma correção será aplicada na query de portadores únicos (linhas 404-417) que replica a mesma lógica de filtros.

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/ContasAPagar.tsx` | Corrigir guarda do filtro ano/mês em `buildBaseFilters` e query de portadores |

