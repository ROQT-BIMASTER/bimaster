

# Plano — Status "Vencido" não aparece nas listagens do Contas a Pagar

## Diagnóstico

O backend persiste apenas dois valores em `contas_pagar.status`: **`pendente`** e **`pago`** (mais raramente `cancelado`). O status **`vencido` é derivado** em runtime via `calculateFinancialStatus(data_vencimento, data_pagamento, status)` (`src/hooks/useFinancialStatus.ts:5-49`).

Os KPIs no topo da página já fazem isso certo (`ContasAPagar.tsx:479-482`), por isso o card "Vencidas" mostra valores corretos. **Mas as listagens consomem o status cru do banco em 3 pontos**, então tudo que está vencido aparece como "pendente":

1. **Tabela "Contas a Pagar" (aba principal)** — `ContasPagarTabContent.tsx:475`:
   ```tsx
   <TableCell>{statusBadge(c.status)}</TableCell>
   ```
   `c.status` chega como `"pendente"` mesmo em títulos com vencimento em 2025/início 2026 → badge "Pendente" (cinza) em vez de "Vencido" (vermelho).

2. **Filtro "Status" da página principal** — `ContasAPagar.tsx:433-436`:
   ```tsx
   list = list.filter(c => (c.status || '').toLowerCase() === status);
   ```
   Selecionar **"Vencido"** retorna lista vazia, porque nenhum título tem `status = 'vencido'` no banco.

3. **Coluna de data de vencimento** — `ContasPagarTabContent.tsx:469`: a regra de cor vermelha usa `isOverdue()` direto, sem checar `data_pagamento`. Funciona, mas é inconsistente com o helper canônico.

## Fix

### 1. `src/components/financeiro/ContasPagarTabContent.tsx`
- Importar `calculateFinancialStatus` de `@/hooks/useFinancialStatus`.
- Substituir `statusBadge(c.status)` por `statusBadge(calculateFinancialStatus(c.data_vencimento, c.data_pagamento, c.status))` na coluna de status (linha 475).
- Trocar a checagem de cor da coluna de vencimento (linha 469) para usar o status calculado: vermelho quando `calc === 'vencido'`.
- Adicionar suporte a `vencido` e `parcial` no `map` interno do `statusBadge` (linhas 78-89), caso ainda não cubra.

### 2. `src/pages/ContasAPagar.tsx`
- Substituir o filtro raw (linhas 433-436) por:
  ```tsx
  if (filterStatus !== 'all') {
    const target = filterStatus.toLowerCase();
    list = list.filter(c => 
      calculateFinancialStatus(c.data_vencimento, c.data_pagamento, c.status) === target
    );
  }
  ```
  Assim "Vencido", "Pendente", "Pago" e "Parcial" no Select passam a refletir a mesma regra dos KPIs e do calendário (já corrigido).

- Pequena consistência no `vencendoHoje` (linhas 473-477): usar o helper para excluir títulos parciais já zerados.

## Detalhes técnicos

- 2 arquivos alterados: `src/pages/ContasAPagar.tsx`, `src/components/financeiro/ContasPagarTabContent.tsx`.
- Sem mudança de schema, RLS, edge function, hook ou SDK.
- `calculateFinancialStatus` já é o padrão canônico do projeto — nenhuma nova convenção introduzida.
- Bump de `APP_VERSION` (`3.2.3 → 3.2.4`) em `src/lib/version.ts` + entrada de changelog em `ApiDocumentation.tsx`, conforme `mem://process/release-changelog-discipline`, para invalidar o bundle PWA dos usuários.

### Invariantes verificáveis
- `grep -n "calculateFinancialStatus(c.data_vencimento" src/components/financeiro/ContasPagarTabContent.tsx` → ≥1 ocorrência
- `grep -n "(c.status || '').toLowerCase() === status" src/pages/ContasAPagar.tsx` → 0 ocorrências (invariante negativo)
- `grep -n "APP_VERSION = '3.2.4'" src/lib/version.ts` → 1 ocorrência

## Risco

Baixo. Mudança puramente apresentacional/lógica de filtro, sem tocar persistência. Mesma regra que já vigora nos KPIs e no calendário — alinha as 3 superfícies que mostram status.

## Verificação após o deploy

1. Aba **Contas a Pagar** → filtro "Status" = **Vencido**: deve listar títulos com `data_vencimento < hoje` e `data_pagamento` vazia.
2. Coluna **Status** da tabela: títulos vencidos passam a exibir badge vermelho "Vencido" em vez de "Pendente".
3. Soma da coluna "Valor Aberto" dos itens com badge "Vencido" deve bater com o KPI "Vencidas" do topo.

