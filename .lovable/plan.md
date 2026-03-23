

# Auditor IA — Análise Contextual + Chave de Acesso NF-e

## Problemas

1. **IA não analisa contexto**: O prompt atual só pede extração de dados do documento — não recebe os dados do lançamento para confronto contextualizado. A comparação é feita no backend com lógica hardcoded, mas a IA não "vê" o que está sendo comparado.
2. **Falta campo de Chave de Acesso NF-e**: Não há como informar a chave de acesso da nota fiscal no fluxo de revisão de pagamento.
3. **IA deveria auto-preencher a chave**: Se a IA detectar uma chave de acesso no documento, deve sugerir o preenchimento com confirmação do operador.

## Plano

### 1. Melhorar o prompt da IA com contexto do lançamento

No `expense-ai-assistant/index.ts`, função `handleAuditDocument`:
- Incluir os dados esperados (CNPJ, nome, valor, nº documento) diretamente no prompt para a IA
- Pedir à IA que faça a comparação e aponte divergências (em vez de apenas extrair e comparar via código)
- Adicionar extração de `chave_acesso_nfe` (44 dígitos) ao tool schema

Isso permite que a IA interprete o contexto visual (ex: WhatsApp images de boletos, comprovantes) de forma mais inteligente.

### 2. Expandir o tool schema para incluir chave de acesso

No schema `audit_document_result`, adicionar:
- `extracted_chave_acesso` (string) — chave de acesso NF-e detectada no documento
- `ai_divergences` (array) — divergências identificadas pela própria IA com justificativa

### 3. Adicionar campo de Chave de Acesso NF-e no `DocumentAuditCard`

No componente `DocumentAuditCard.tsx`:
- Adicionar input para "Chave de Acesso NF-e" (44 dígitos) com máscara
- Se a IA extrair uma chave, exibir sugestão com botão "Aplicar" (padrão `FiscalSuggestionBadge`)
- O operador revisa e confirma antes de persistir
- Callback `onChaveAcessoChange` para propagar o valor ao componente pai

### 4. Propagar chave de acesso ao `PaymentReviewDialog`

No `PaymentReviewDialog.tsx`:
- Receber a chave de acesso do `DocumentAuditCard` via callback
- Exibir badge com a chave confirmada
- Persistir na tabela `payment_queue` (campo `chave_acesso_nfe` — nova coluna)

### 5. Migração SQL

Adicionar coluna `chave_acesso_nfe` à tabela `payment_queue`:

```sql
ALTER TABLE payment_queue ADD COLUMN chave_acesso_nfe text;
```

### 6. Atualizar `DocumentAuditResult` no hook

Em `useDocumentAudit.ts`, expandir a interface:
- `extracted_chave_acesso?: string`
- Retornar o campo no resultado

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/expense-ai-assistant/index.ts` | Melhorar prompt com contexto + extrair chave de acesso |
| `src/components/financeiro/payments/DocumentAuditCard.tsx` | Input de chave de acesso + sugestão IA |
| `src/hooks/useDocumentAudit.ts` | Expandir interface com `extracted_chave_acesso` |
| `src/components/financeiro/payments/PaymentReviewDialog.tsx` | Receber/persistir chave de acesso |
| Migração SQL | Coluna `chave_acesso_nfe` em `payment_queue` |

