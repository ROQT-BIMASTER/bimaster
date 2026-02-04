

# Plano: Implementar Interface de Aprovação para Eventos Corporativos

## Contexto

O módulo de Eventos Corporativos foi criado, mas atualmente quando um evento é enviado para aprovação (status `pending_approval`), não existe uma interface onde administradores/supervisores possam aprová-lo. O hook `approveEvent` já existe em `useCorporateEvents.ts`, mas não há UI para utilizá-lo.

## Solução Proposta

Criar uma **Central de Aprovações de Eventos** seguindo o mesmo padrão da Central de Aprovações do Trade Marketing, com:

1. Uma tela dedicada para listar eventos pendentes de aprovação
2. Um dialog de aprovação com seleção obrigatória de verba
3. Integração com o sidebar do módulo de Eventos

---

## Implementação Técnica

### 1. Criar Hook para Eventos Pendentes

**Arquivo:** `src/hooks/usePendingEvents.ts`

```typescript
// Query para buscar eventos com status 'pending_approval'
// Retorna lista de eventos com joins de budget, responsible e creator
```

### 2. Criar Dialog de Aprovação de Evento

**Arquivo:** `src/components/events/AprovarEventoDialog.tsx`

- Exibir detalhes do evento (nome, tipo, data, local, orçamento solicitado)
- Dropdown obrigatório para seleção de verba (usando `useEventBudgets`)
- Validação de saldo disponível na verba vs. orçamento do evento
- Campo de observações
- Botões: Aprovar / Rejeitar
- Usar o `approveEvent` mutation existente

### 3. Criar Página de Aprovações de Eventos

**Arquivo:** `src/pages/EventsApprovalHub.tsx`

- Header com título "Central de Aprovações de Eventos"
- KPIs: Total pendentes, Valor total de orçamentos pendentes
- Tabela com eventos pendentes (código, nome, tipo, data, orçamento, solicitante)
- Botão "Revisar" que abre o `AprovarEventoDialog`
- Acesso restrito a admin/supervisor via `useUserRole`

### 4. Adicionar Rota

**Arquivo:** `src/App.tsx`

```text
Adicionar rota: /dashboard/eventos/aprovacoes → EventsApprovalHub
```

### 5. Atualizar Navegação

**Arquivo:** `src/pages/CorporateEvents.tsx`

- Adicionar botão "Aprovações" no header (visível apenas para admin/supervisor)
- Exibir badge com contagem de pendentes

### 6. Atualizar Hook useCorporateEvents

**Arquivo:** `src/hooks/useCorporateEvents.ts`

- Adicionar mutation `rejectEvent` para rejeitar eventos
- O `approveEvent` já existe e funcionará perfeitamente

---

## Fluxo do Usuário (Após Implementação)

```text
1. Funcionário cria evento → status: draft
2. Funcionário clica "Enviar para Aprovação" → status: pending_approval
3. Admin/Supervisor acessa "Aprovações" no módulo de Eventos
4. Visualiza lista de eventos pendentes
5. Clica "Revisar" no evento
6. Seleciona verba obrigatoriamente (com validação de saldo)
7. Aprova ou rejeita com observação
8. Evento aprovado → status: approved, pode lançar despesas
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/usePendingEvents.ts` | Hook para buscar eventos pendentes |
| `src/components/events/AprovarEventoDialog.tsx` | Dialog de aprovação |
| `src/pages/EventsApprovalHub.tsx` | Página central de aprovações |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/dashboard/eventos/aprovacoes` |
| `src/pages/CorporateEvents.tsx` | Botão de navegação para aprovações |
| `src/hooks/useCorporateEvents.ts` | Adicionar `rejectEvent` mutation |

