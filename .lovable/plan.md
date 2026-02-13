
# Migracao Segura: Storage Buckets Publicos para Privados

## Estrategia de 3 Fases (Zero Downtime)

A migracao sera feita em 3 fases sequenciais para garantir que nenhum usuario em producao seja impactado:

```text
Fase 1: Uploads geram signed URLs (codigo novo)
Fase 2: Exibicao converte URLs antigas para signed URLs
Fase 3: SQL torna buckets privados (so apos Fases 1 e 2 publicadas)
```

---

## Fase 1 - Migrar Uploads para Signed URLs

Criar helper centralizado e atualizar todos os componentes que fazem upload para gerar signed URLs em vez de URLs publicas.

### 1.1 Adicionar `uploadAndGetSignedUrl` em `src/lib/utils/storage-helper.ts`

Nova funcao que faz upload e retorna signed URL (expiracao de 1 ano = 31536000s) em vez de URL publica. Todos os componentes de upload passam a usar esta funcao.

### 1.2 Atualizar 16 pontos de upload (getPublicUrl -> signed URL)

Arquivos que chamam `getPublicUrl()` e precisam ser migrados:

| Arquivo | Bucket |
|---|---|
| `src/components/events/ExpenseAttachments.tsx` | event-expense-docs |
| `src/components/departments/DepartmentExpenseAttachments.tsx` | department-expense-docs |
| `src/components/trade/NovoLancamentoDialog.tsx` | trade-expense-docs |
| `src/components/trade/budgets/BudgetDocumentUpload.tsx` | trade-budget-docs |
| `src/components/trade/QuickEntryDialog.tsx` | campaign-evidence |
| `src/components/trade/campaigns/CampaignLancamentoForm.tsx` | campaign-evidence |
| `src/components/trade/campaigns/LancamentoPhotoCapture.tsx` | trade-photos |
| `src/components/trade/OfflinePhotoCapture.tsx` | trade-photos |
| `src/components/trade/AdicionarEvidenciaDialog.tsx` | attachments |
| `src/components/fabrica/FichaCustoProdutoEditor.tsx` | fabrica-custo-evidencias |
| `src/components/fabrica/CotacoesInsumoPanel.tsx` | fabrica-cotacoes |
| `src/components/marketing/mission-control/CreativeHub.tsx` | marketing-assets |
| `src/components/marketing/mission-control/task-detail/TaskFiles.tsx` | marketing-files |
| `src/components/financeiro/payments/ReceiptUploadSection.tsx` | event-expense-docs |
| `src/hooks/useSyncOfflineData.ts` | trade-photos |
| `src/lib/offline/syncManager.ts` | photos |
| `src/pages/TradeFinanceiro.tsx` | trade-budget-docs |

**Nota:** `src/components/shared/ProfileAvatarUpload.tsx` (bucket `avatars`) permanece com `getPublicUrl()` pois avatars continuara publico.

---

## Fase 2 - Migrar Exibicao para Signed URLs

Todos os componentes que exibem arquivos usando URLs armazenadas no banco precisam converter a URL publica para signed URL antes de abrir/exibir.

### 2.1 Usar `resolveStorageUrl()` nos pontos de exibicao

`resolveStorageUrl()` ja existe em `src/lib/utils/storage-url.ts` e faz exatamente isso: recebe uma URL publica, extrai bucket/path, e gera uma signed URL. Ja inclui fallback de busca por nome.

Arquivos que exibem arquivos e precisam de migracao:

| Arquivo | Como exibe | Migracao |
|---|---|---|
| `ExpenseAttachments.tsx` | `window.open(attachment.url)` e `<a href={url}>` | Converter via `resolveStorageUrl` antes de abrir |
| `DepartmentExpenseAttachments.tsx` | `window.open(attachment.url)` | Idem |
| `AprovarDespesaDepartamentoDialog.tsx` | `<a href={attachment.url}>` | Idem |
| `AprovarLancamentoDialog.tsx` | `window.open(entry.document_url)` | Idem |
| `CotacoesInsumoPanel.tsx` | `window.open(c.arquivo_url)` | Idem |
| `FichaCustoProdutoEditor.tsx` | `window.open(ev.url_arquivo)` | Idem |
| `CreativeHub.tsx` | `window.open(previewAsset.url_publica)` e `<img src>` | Idem |
| `StoreDetailDialog.tsx` | `<a href={investment.evidence_url}>` | Idem |
| `VisitDetailDialog.tsx` | `window.open(photo.photo_url)` | Idem |
| `PaymentReviewDialog.tsx` | `<a href={item.attachment_url}>` | Idem |
| `NovaDespesaEventoDialog.tsx` | Move files entre paths | Atualizar para signed URL apos move |

**Ja migrados (nao precisam de alteracao):**
- `ReceiptUploadSection.tsx` - ja usa `resolveStorageUrl`
- `AttachmentAcknowledgement.tsx` - ja usa `resolveStorageUrl`

### 2.2 Criar hook `useSignedUrl` para componentes que exibem imagens

Para componentes que mostram imagens inline (como fotos de visita), criar um hook React que converte a URL publica para signed URL de forma reativa, com cache em memoria.

---

## Fase 3 - Tornar Buckets Privados (SQL)

**Executar SOMENTE apos as Fases 1 e 2 estarem publicadas em producao.**

Migracao SQL:

```text
UPDATE storage.buckets 
SET public = false 
WHERE id IN (
  'event-expense-docs', 
  'department-expense-docs', 
  'trade-expense-docs', 
  'trade-budget-docs',
  'campaign-evidence', 
  'fabrica-custo-evidencias', 
  'fabrica-cotacoes', 
  'marketing-assets', 
  'attachments', 
  'email-assets'
);
```

O bucket `avatars` permanece publico.

---

## Resumo de Arquivos Modificados

- **1 arquivo novo/atualizado de utils**: `storage-helper.ts` (nova funcao + hook)
- **~17 arquivos de upload**: substituir `getPublicUrl` por `uploadAndGetSignedUrl`
- **~11 arquivos de exibicao**: adicionar `resolveStorageUrl` antes de abrir/exibir URLs
- **1 migracao SQL**: executada manualmente apos deploy (Fase 3)

## Ordem de Execucao

1. Atualizar `storage-helper.ts` com nova funcao e hook
2. Migrar todos os uploads (Fase 1)
3. Migrar todas as exibicoes (Fase 2)
4. Publicar em producao
5. Executar SQL da Fase 3 (eu avisarei quando for seguro)
