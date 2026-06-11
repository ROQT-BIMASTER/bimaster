---
name: China upload de documentos — hardening
description: Invariantes do fluxo de upload/cadastro/leitura de documentos em china_produto_documentos
type: feature
---
# China — Upload de Documentos (hardening)

Hook canônico: `src/hooks/useUploadChinaDocumento.ts`.

## Invariantes obrigatórias

1. **Coluna correta**: observação do documento grava em `china_produto_documentos.observacao`. NUNCA `observacoes_china` (essa coluna só existe em `china_produto_submissoes`). CI verifica via `audit/regression-greps.sh`.
2. **Validação local antes de tocar Storage**: sempre `validateFileForUpload` (extensão, MIME, magic bytes, double-extension, tamanho 20MB).
3. **Path sanitizado**: `${uid}/${submissaoId}/${sanitizeStorageSegment(tipo)}/${Date.now()}_${safeName}`. Storage rejeita não-ASCII (`Invalid key`).
4. **Sessão revalidada** a cada upload via `supabase.auth.getSession()`.
5. **Retry com backoff** (até 3 tentativas) apenas em erros transitórios (`STORAGE_NETWORK`, `STORAGE_TIMEOUT`, `STORAGE_UNKNOWN`). Timeout de 60s por tentativa.
6. **Rollback transacional**: se `insert/update` em `china_produto_documentos` falhar após o upload, deletar o objeto do Storage (`supabase.storage.from(BUCKET).remove([path])`).
7. **Reuso de placeholder**: se já existir registro `status='planejado'` para `(submissao_id, tipo_documento)`, atualizar em vez de inserir.
8. **Observação**: Zod `.trim().max(2000)`. String vazia vira `null`.
9. **Invalidação ampla**: `china-mailbox-dataset`, `china-ficha-docs`, `china-checklist`, `checklist-custom-items`, `china-inbox`, `china-docs-da-tarefa`.
10. **Logger estruturado** em todas as falhas: `china_upload_storage_fail`, `china_upload_db_fail`, `china_upload_retry`, `china_obs_save_fail`.

## Preview/Download

- `ChinaDocPreviewDialog`: estados `idle | loading | ready | error` com botão "Tentar novamente".
- Iframe de PDF SEMPRE com `sandbox="allow-same-origin allow-scripts allow-popups allow-forms"`.
- Download via `downloadStorageBlob` + `triggerBlobDownload` (bucket privado, bypass de ad-blocker). NUNCA `<a href download>` direto em signed URL para arquivos privados.
- Signed URLs do preview com TTL de 1h (renovação manual via botão).
- Signed URLs persistidas em `arquivo_url` na escrita usam TTL de 1 ano apenas como hint; sempre prefere `arquivo_path` para regenerar.

## Códigos de erro mapeados

| Origem | Códigos | UX |
|---|---|---|
| Validação | `INVALID_FILE` | Toast bloqueia upload |
| Sessão | `NO_SESSION` | Toast pede relogin |
| Storage | `STORAGE_PAYLOAD_TOO_LARGE` `STORAGE_INVALID_KEY` `STORAGE_DENIED` `STORAGE_NETWORK` `STORAGE_TIMEOUT` `STORAGE_UNKNOWN` | Retry quando transitório |
| DB | `DB_DENIED` `DB_CONFLICT` `DB_UNKNOWN` | Rollback Storage + toast |

## Testes

- `src/lib/china/__tests__/sanitizeTipoKey.test.ts` cobre edge cases do path.
- Regression grep `audit/regression-greps.sh` bloqueia `observacoes_china` em blocos `china_produto_documentos`.
