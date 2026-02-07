

# Adicionar Despesas de Eventos na Central de Aprovacoes

## Situacao Atual

A Central de Aprovacoes de Eventos (`EventsApprovalHub`) atualmente **so mostra eventos pendentes de aprovacao de verba** (status `pending_approval`). Nao existe nenhuma visao para o gestor aprovar **despesas individuais** lancadas apos a aprovacao da verba.

O fluxo desejado e:
1. Usuario cria o evento (status `draft`)
2. Envia para aprovacao (status `pending_approval`)
3. Gestor aprova a verba (status `approved`)
4. Usuario lanca despesas (status `pending`)
5. **Despesas voltam para o gestor aprovar na Central de Aprovacoes**
6. Apos aprovacao da despesa, usuario envia ao financeiro

## O que sera feito

### 1. Novo hook: buscar despesas de eventos pendentes de aprovacao

Criar um hook `usePendingEventExpenses` que busca todas as despesas de eventos com status `pending`, agrupando por evento. Isso permitira que o gestor veja, na Central de Aprovacoes, quais eventos tem despesas aguardando revisao.

### 2. Expandir a Central de Aprovacoes de Eventos

A pagina `EventsApprovalHub` sera ampliada com **duas secoes**:

- **Secao 1** (ja existente): Eventos aguardando aprovacao de verba (`pending_approval`)
- **Secao 2** (nova): Eventos com despesas pendentes de aprovacao

A nova secao mostrara:
- Nome do evento, codigo, quantidade de despesas pendentes e valor total
- Botao "Revisar Despesas" que abre um dialog com a lista de despesas pendentes do evento
- No dialog, o gestor pode aprovar ou rejeitar cada despesa individualmente (reaproveitando a logica ja existente em `useEventExpenses`: `approveExpense` e `rejectExpense`)

### 3. Novo componente: Dialog de aprovacao de despesas de evento

Criar `AprovarDespesasEventoDialog` -- um dialog que:
- Recebe o ID do evento
- Lista todas as despesas pendentes desse evento
- Permite aprovar/rejeitar cada uma, com campo de motivo obrigatorio para rejeicao
- Mostra informacoes da despesa (categoria, valor, descricao, comprovantes)

## Secao Tecnica

### Arquivos a criar

1. **`src/hooks/usePendingEventExpenses.ts`**
   - Query que busca `corporate_event_expenses` com `status = 'pending'`
   - Faz join com `corporate_events` para trazer nome/codigo do evento
   - Agrupa por `event_id` para exibir por evento
   - So mostra eventos com status `approved` ou `in_progress`

2. **`src/components/events/AprovarDespesasEventoDialog.tsx`**
   - Dialog que lista despesas pendentes de um evento
   - Botoes de aprovar/rejeitar por despesa
   - Campo de motivo obrigatorio ao rejeitar
   - Reutiliza `approveExpense` e `rejectExpense` de `useEventExpenses`

### Arquivos a modificar

1. **`src/pages/EventsApprovalHub.tsx`**
   - Importar `usePendingEventExpenses`
   - Adicionar KPI "Despesas Pendentes" no grid de metricas
   - Adicionar nova secao/tabela "Eventos com Despesas Pendentes"
   - Integrar o novo `AprovarDespesasEventoDialog`

### Fluxo visual na tela

```text
Central de Aprovacoes de Eventos
================================

[KPI: Eventos Pendentes]  [KPI: Despesas Pendentes]  [KPI: Valor Total]

--- Eventos Aguardando Aprovacao de Verba ---
(tabela existente com botao "Revisar")

--- Eventos com Despesas Pendentes ---
| Codigo | Evento       | Despesas Pendentes | Valor Total | Acoes          |
| EV-001 | Evento TNT   | 3 despesas         | R$ 5.000    | [Revisar]      |
| EV-002 | Workshop ABC | 1 despesa          | R$ 800      | [Revisar]      |

Ao clicar "Revisar" -> abre dialog com lista de despesas para aprovar/rejeitar
```

### Nenhuma mudanca no banco de dados

O fluxo de dados ja existe -- despesas de eventos ja nascem com status `pending` e ja existem as mutations `approveExpense` e `rejectExpense` no hook `useEventExpenses`. So falta a **visao na Central de Aprovacoes** para o gestor.

