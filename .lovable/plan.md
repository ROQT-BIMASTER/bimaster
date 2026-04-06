

# Opção de Desabilitar Conta do DRE

## Objetivo

Adicionar no dialog de "Reclassificar Conta" uma opção para **excluir a conta do DRE**, fazendo com que seus lançamentos não apareçam no demonstrativo. Útil para contas patrimoniais ou itens que não devem compor o resultado.

## Implementação

### 1. Migração SQL — Campo `excluir_dre` na tabela `trade_chart_of_accounts`

Adicionar coluna booleana `excluir_dre` (default `false`) à tabela de plano de contas:

```sql
ALTER TABLE trade_chart_of_accounts 
ADD COLUMN excluir_dre BOOLEAN DEFAULT false;
```

### 2. Atualizar `ReclassificarContaDREDialog.tsx`

- Adicionar opção **"Não exibir no DRE"** como primeiro item no Select de categorias (valor especial `"excluir"`)
- Quando selecionado, esconder o seletor de conta destino e mostrar aviso explicativo
- Na mutation: se `novaCategoriaDre === "excluir"`, setar `excluir_dre = true` e `categoria_dre = null` na `trade_chart_of_accounts`
- Mostrar badge visual diferenciado quando a conta já está excluída (ex: badge cinza "Excluída do DRE")

### 3. Atualizar `DREAnalitico.tsx` — Filtrar contas excluídas

No processamento dos lançamentos (linha ~692), adicionar verificação:

```typescript
if (conta.excluir_dre) return; // Pular contas excluídas do DRE
```

Incluir `excluir_dre` na query do plano de contas.

### 4. Atualizar `PlanoContas.tsx` — Indicador visual

Mostrar badge "Excluída do DRE" nas contas com `excluir_dre = true` na tela de Plano de Contas.

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | Adicionar coluna `excluir_dre` |
| `src/components/financeiro/ReclassificarContaDREDialog.tsx` | Adicionar opção "Não exibir no DRE" + lógica de exclusão |
| `src/pages/DREAnalitico.tsx` | Filtrar contas com `excluir_dre = true` + incluir campo na query |
| `src/pages/PlanoContas.tsx` | Badge indicativo de conta excluída do DRE |

