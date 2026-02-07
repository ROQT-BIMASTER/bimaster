
# Correcao do Erro 404 nos Anexos + Comprovante de Pagamento

## Problema 1: Erro 404 ao abrir arquivo anexo (causa raiz identificada)

A investigacao no banco revelou a causa exata do erro:

- **Arquivo no storage esta em**: `6055d5a4-.../1770306048759-cjhjy.pdf`
- **URL armazenada no banco aponta para**: `a23aa106-.../1770306048759-cjhjy.pdf`

O problema esta no `NovaDespesaEventoDialog.tsx`:
1. Ao abrir o formulario, um UUID temporario e gerado: `tempExpenseId = crypto.randomUUID()` (ex: `6055d5a4...`)
2. O arquivo e enviado ao storage usando esse UUID temporario como diretorio
3. Apos salvar a despesa, o sistema recebe o ID real da despesa (ex: `a23aa106...`)
4. O codigo **substitui o UUID na URL** (`attachment.url.replace(tempExpenseId, expenseData.id)`) mas **nao move o arquivo no storage**
5. Resultado: a URL salva aponta para um caminho que nao existe

**Solucao em duas partes:**

**Parte A - Corrigir o fluxo de upload (novos envios):**
- Usar `supabase.storage.from('event-expense-docs').move(oldPath, newPath)` para realmente mover o arquivo no storage apos criar a despesa
- Assim a URL substituida vai apontar para o caminho correto

**Parte B - Corrigir a leitura de arquivos existentes (dados ja quebrados):**
- Melhorar o `resolveStorageUrl` com um fallback: se a signed URL falhar no caminho original, extrair apenas o nome do arquivo e tentar listar/buscar no bucket
- Isso garante que arquivos ja salvos com caminhos incorretos ainda possam ser abertos

---

## Problema 2: Anexar comprovante de pagamento e enviar ao solicitante

Apos o financeiro realizar o pagamento no banco, ele precisa:
1. Anexar o comprovante de pagamento no sistema
2. Enviar esse comprovante ao solicitante original

**Solucao:**

1. **Nova coluna no banco**: Adicionar `receipt_url` (text) e `receipt_sent_at` (timestamp) na tabela `financial_payment_queue`
2. **Upload de comprovante**: Na tela do dialog, quando o status for "aceito" ou "pago", mostrar uma area de upload para o comprovante
3. **Botao "Enviar ao Solicitante"**: Apos anexar o comprovante, exibir um botao que cria uma notificacao na tabela `notifications` para o usuario que solicitou (`requested_by`), com link para visualizar o comprovante

---

## Secao Tecnica

### Migracao de banco de dados

Adicionar duas colunas a tabela `financial_payment_queue`:

```text
ALTER TABLE financial_payment_queue
  ADD COLUMN receipt_url TEXT,
  ADD COLUMN receipt_sent_at TIMESTAMPTZ;
```

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/events/NovaDespesaEventoDialog.tsx` | Usar `storage.move()` para mover arquivos do diretorio temporario para o diretorio real apos criar a despesa |
| `src/lib/utils/storage-url.ts` | Adicionar fallback que busca o arquivo pelo nome se o caminho direto falhar, usando `storage.list()` |
| `src/components/financeiro/payments/PaymentReviewDialog.tsx` | Adicionar secao de upload de comprovante (para status "aceito"/"pago") e botao "Enviar Comprovante ao Solicitante" |
| `src/hooks/useFinancialPaymentQueue.ts` | Adicionar campos `receipt_url`/`receipt_sent_at` na interface e mutation para atualizar comprovante e enviar notificacao |

### Detalhes da implementacao

**1. Correcao do move de arquivos (`NovaDespesaEventoDialog.tsx`):**
- Apos `createExpense.mutateAsync()`, para cada attachment, chamar `supabase.storage.from('event-expense-docs').move(tempPath, realPath)` onde:
  - `tempPath` = `{tempExpenseId}/{filename}`
  - `realPath` = `{expenseData.id}/{filename}`
- Manter a substituicao de URL atual (que ja funciona se o arquivo for movido)
- Tratar erros silenciosamente (se o move falhar, manter a URL original sem substituir)

**2. Fallback na resolucao de URLs (`storage-url.ts`):**
- Se `createSignedUrl` falhar para o caminho original, extrair o nome do arquivo (parte apos o ultimo `/`)
- Listar os objetos do bucket com prefix parcial para encontrar o arquivo
- Se encontrar, gerar a signed URL com o caminho correto
- Isso resolve arquivos ja salvos com caminho incorreto

**3. Upload de comprovante (`PaymentReviewDialog.tsx`):**
- Nova secao visivel quando status e "aceito" ou "pago"
- Input file para PDF/imagens (max 10MB)
- Upload para bucket `event-expense-docs` com path `receipts/{paymentQueueId}/{filename}`
- Salvar `receipt_url` na tabela `financial_payment_queue`
- Botao "Enviar Comprovante ao Solicitante" que:
  - Gera signed URL do comprovante
  - Insere registro na tabela `notifications` com `user_id = requested_by`, titulo e link
  - Atualiza `receipt_sent_at` no registro da fila
  - Mostra confirmacao visual de que o comprovante foi enviado

### O que NAO sera alterado

- Nenhum fluxo de aprovacao/rejeicao existente
- Dashboard e Calendario de Contas a Pagar
- Componentes de upload de outros modulos (departamentos, trade)
- Estrutura geral do dialog de revisao
