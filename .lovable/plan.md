
# Central de Pagamentos - Correção do Filtro de Departamentos

## Resumo do Diagnóstico

A Central de Pagamentos está **parcialmente preparada** para receber despesas de todos os departamentos. A estrutura de dados e fluxo de envio estão corretos, porém há uma lacuna na interface de filtragem.

## Problema Encontrado

O filtro de "Origem" na tabela de pagamentos não inclui a opção para filtrar por despesas de Departamentos, embora o sistema suporte esse tipo de dado.

## Alteração Necessária

**Arquivo:** `src/components/financeiro/payments/PaymentQueueTable.tsx`

Adicionar a opção `department_expense` no Select de filtro de origens:

```text
Antes:
┌─────────────────────────────┐
│ Todas Origens              ▼│
├─────────────────────────────┤
│ Trade - Lançamento          │
│ Trade - Investimento        │
│ Trade - Campanha            │
│ Evento                      │
└─────────────────────────────┘

Depois:
┌─────────────────────────────┐
│ Todas Origens              ▼│
├─────────────────────────────┤
│ Trade - Lançamento          │
│ Trade - Investimento        │
│ Trade - Campanha            │
│ Evento                      │
│ Departamento          ← NOVO│
└─────────────────────────────┘
```

## Detalhes Técnicos

A modificação será feita na linha 76 do arquivo, adicionando:

```typescript
<SelectItem value="department_expense">Departamento</SelectItem>
```

## Validação Completa

Outros componentes já estão preparados:
- Hook `useFinancialPaymentQueue` - tipos corretos definidos
- `PaymentReviewDialog` - label "Departamento - Despesa" configurado
- `useDepartmentExpenses` - envia com `source_type: 'department_expense'`
- Políticas RLS - acesso configurado para equipe financeira

## Impacto

- Zero impacto em funcionalidades existentes
- Melhora a usabilidade para a equipe financeira filtrar por origem
- Nenhuma alteração no banco de dados necessária
