

# Auditor IA de Documentos vs Lançamento

## Problema
Funcionários lançam contas a pagar com CNPJ/fornecedor diferente do que consta no documento anexado. Não há validação cruzada entre o documento fiscal e os dados digitados.

## Solução
Criar um **Auditor IA** que, ao revisar um pagamento na Central de Pagamentos, analisa automaticamente os documentos anexados (imagens/PDFs) e confronta os dados extraídos com os dados do lançamento, exibindo alertas visuais de divergência.

## Arquitetura

```text
┌──────────────────────────────────────────────┐
│  PaymentReviewDialog (financeiro abre)        │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ DocumentAuditCard (novo componente)      │  │
│  │  • Botão "Auditar Documento com IA"      │  │
│  │  • Envia attachment_url + dados do item  │  │
│  │  • Exibe resultado: ✅ ou ⚠️ divergências│  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Edge Function: expense-ai-assistant          │
│  action: "audit_document"                     │
│  • Baixa o arquivo via Storage                │
│  • Envia imagem/PDF para IA (Gemini Vision)   │
│  • Confronta: CNPJ, nome, valor, nº doc       │
│  • Retorna lista de divergências              │
└──────────────────────────────────────────────┘
```

## Implementação

### 1. Nova action `audit_document` na Edge Function `expense-ai-assistant`

Recebe: `attachmentUrl`, `supplierName`, `supplierDocument`, `amount`, `documentNumber`, `documentType`

Fluxo:
- Baixa o arquivo do Supabase Storage (converte para base64)
- Envia para Gemini 2.5 Flash (multimodal) com tool calling
- Tool `audit_document_result` retrai: CNPJ extraído, nome extraído, valor extraído, nº documento extraído
- Compara cada campo com os dados do lançamento
- Retorna: `{ matches: boolean, divergences: [{field, expected, found, severity}], confidence: number }`

### 2. Novo componente `DocumentAuditCard.tsx`

Localização: `src/components/financeiro/payments/DocumentAuditCard.tsx`

- Recebe o `PaymentQueueItem`
- Botão "Auditar com IA" (ícone ShieldCheck + Sparkles)
- Ao clicar, chama `expense-ai-assistant` com action `audit_document`
- Exibe resultados:
  - ✅ **Dados consistentes** (badge verde) se sem divergências
  - ⚠️ **Divergências encontradas** (badge vermelho/amarelo) com lista detalhada:
    - "CNPJ do documento: 12.345.678/0001-90 ≠ Lançamento: 98.765.432/0001-10"
    - "Valor do documento: R$ 1.500,00 ≠ Lançamento: R$ 1.200,00"
  - Nível de confiança da extração

### 3. Integração no `PaymentReviewDialog.tsx`

- Renderizar `DocumentAuditCard` quando houver `attachment_url` ou `attachments`
- Posicionar logo abaixo dos documentos anexados
- Se houver divergências graves (CNPJ diferente), exibir Alert vermelho antes dos botões de ação

### 4. Hook `useDocumentAudit.ts`

- Encapsula a chamada à edge function
- Estados: `isAuditing`, `auditResult`, `audit()`
- Reutilizável em outros contextos futuros

## Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/expense-ai-assistant/index.ts` | Nova action `audit_document` com download do storage + confronto via IA |
| Novo: `src/hooks/useDocumentAudit.ts` | Hook para chamar auditoria |
| Novo: `src/components/financeiro/payments/DocumentAuditCard.tsx` | Card com botão + resultados visuais |
| `src/components/financeiro/payments/PaymentReviewDialog.tsx` | Integrar DocumentAuditCard |

