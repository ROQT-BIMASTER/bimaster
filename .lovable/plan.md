
# Plano: Destacar Valor Pago na Tabela de Lançamentos Financeiros

## Contexto
A tela "Detalhes de Lançamentos por Cliente" está exibindo o campo `valor_pedido` (valor do pedido). Por ser uma tela financeira, faz mais sentido destacar o **valor efetivamente pago** (que está na tabela `trade_campaign_expenses.valor_realizado`) e manter o ROI em destaque.

## Estrutura de Dados Identificada
- **Lançamento** (`trade_campaign_lancamentos`): Contém `valor_pedido`, `roi_percentual`, `roi_valor`
- **Despesa** (`trade_campaign_expenses`): Contém `valor_realizado` (valor pago) vinculado ao lançamento via `lancamento_id`

## Alterações Propostas

### 1. Atualizar Hook de Dados (`useTradeFinanceiroDashboard.ts`)
- Modificar a query de lançamentos para fazer JOIN com a tabela de despesas
- Buscar o campo `valor_realizado` da despesa vinculada
- Adicionar novo campo `valorPago` à interface `Lancamento`

### 2. Atualizar Interface da Tabela (`TradeLancamentosTable.tsx`)

#### Colunas da Tabela
| Atual | Proposto |
|-------|----------|
| Valor (valor_pedido) | **Valor Pago** (destacado, verde) |
| ROI | ROI (mantido) |

#### Mudanças Específicas
- Renomear coluna "Valor" para "Valor Pago"
- Aplicar destaque visual ao valor pago (cor verde, fundo sutil, fonte maior)
- Exibir tooltip com valor do pedido original para referência
- No rodapé, alterar "Total" para "Total Pago"

#### Dialog de Detalhes
- Reorganizar para mostrar ambos valores (pedido e pago) lado a lado
- Destacar visualmente o valor pago com cor de sucesso
- Manter ROI em posição de destaque

---

## Seção Técnica

### Modificações no Hook
```typescript
// Query atualizada para incluir despesas
.select(`
  id, customer_id, campaign_id, valor_pedido, status, roi_percentual, roi_valor,
  data_lancamento, sell_out_anterior, sell_out_atual, tipo_brinde, acoes_manuais, evidencias,
  prospect:prospects(nome_empresa),
  campaign:trade_campaigns(name),
  expense:trade_campaign_expenses!trade_campaign_expenses_lancamento_id_fkey(valor_realizado, status)
`)

// Novo mapeamento
valorPago: l.expense?.[0]?.valor_realizado || null
```

### Modificações na Interface
```typescript
interface Lancamento {
  // ... campos existentes
  valorPedido: number;  // renomear de "valor"
  valorPago: number | null;  // novo campo
}
```

### Estilização do Valor Pago
```tsx
<TableCell className="text-right">
  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
    {formatCurrency(lancamento.valorPago || 0)}
  </span>
</TableCell>
```

## Resultado Esperado
A tabela exibirá o valor pago em destaque (verde), mantendo o ROI visível. Usuários financeiros verão imediatamente quanto foi efetivamente gasto, com acesso ao valor original do pedido nos detalhes.
