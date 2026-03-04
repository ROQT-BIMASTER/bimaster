

## Plano: Comunicação In-line entre Solicitantes e Financeiro nas Despesas

### Conceito

Criar um sistema de mensagens embutido em cada item da fila de pagamentos (`financial_payment_queue`), onde:
- **Solicitantes** veem apenas as mensagens dos seus próprios itens
- **Financeiro** vê todas as mensagens de todos os itens, consolidadas
- Formato visual inspirado no chat da Fábrica (WhatsApp-style), com lados fixos: solicitante à esquerda, financeiro à direita

### 1. Migração de banco: tabela de mensagens

```sql
CREATE TABLE financial_payment_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_queue_id uuid NOT NULL REFERENCES financial_payment_queue(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id),
  usuario_nome text NOT NULL,
  conteudo text NOT NULL,
  tipo text NOT NULL DEFAULT 'solicitante', -- 'solicitante' | 'financeiro'
  anexos jsonb DEFAULT '[]',
  lida_por uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE financial_payment_messages ENABLE ROW LEVEL SECURITY;

-- Solicitantes veem mensagens dos seus próprios itens
-- Financeiro vê tudo
CREATE POLICY "..." ON financial_payment_messages FOR ALL TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM financial_payment_queue q WHERE q.id = payment_queue_id AND q.requested_by = auth.uid()
    )
    OR public.check_user_access(auth.uid(), 'financeiro')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE financial_payment_messages;
```

### 2. Componente `PaymentChatPanel`

Novo componente `src/components/financeiro/payments/PaymentChatPanel.tsx`:
- Chat compacto embeddable (não fullscreen) — painel lateral ou seção dentro do `PaymentReviewDialog`
- Mensagens com bolhas coloridas: solicitante (cinza/esquerda), financeiro (azul/direita)
- Suporte a anexos inline (reutilizando padrão JSONB de arquivos)
- Indicador de leitura (check/double-check)
- Realtime via `postgres_changes` filtrado por `payment_queue_id`
- Badge de mensagens não lidas no item da fila

### 3. Integração no `PaymentReviewDialog`

Adicionar aba ou seção "Comunicação" no dialog de revisão do financeiro, com o `PaymentChatPanel` embutido. O financeiro pode enviar mensagens de devolução, pedidos de documentos, etc.

### 4. Visão do solicitante: badge + painel nas páginas de despesas

Nas tabelas de despesas (Trade, Eventos, Departamentos):
- Ícone de balão com badge de não-lidas quando há mensagens do financeiro
- Ao clicar, abre um dialog/drawer com o `PaymentChatPanel` filtrado para aquele item
- O solicitante pode responder, enviar novos anexos

### 5. Visão consolidada do Financeiro

Na Central de Pagamentos:
- Badge de mensagens não lidas por item na tabela principal
- Indicador visual (ponto colorido) para itens com comunicação ativa
- Possibilidade de filtrar "itens com mensagens pendentes"

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar `financial_payment_messages` + RLS + realtime |
| `src/components/financeiro/payments/PaymentChatPanel.tsx` | **Novo** — componente de chat reutilizável |
| `src/components/financeiro/payments/PaymentReviewDialog.tsx` | Adicionar seção de comunicação |
| `src/components/financeiro/payments/PaymentQueueTable.tsx` | Badge de mensagens não lidas |
| `src/pages/TradeLancamentos.tsx` | Ícone de comunicação nos itens enviados ao financeiro |
| `src/components/events/EventsExpensesTable.tsx` | Ícone de comunicação |
| `src/components/departments/DepartmentExpensesTable.tsx` | Ícone de comunicação |
| `src/hooks/usePaymentMessages.ts` | **Novo** — hook para CRUD + realtime das mensagens |

