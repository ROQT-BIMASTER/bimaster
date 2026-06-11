# E2E — China: Upload → DB → Preview → Download

Spec: `upload-flow.spec.ts`. Cobre o fluxo hardenizado de
`useUploadChinaDocumento` (validação magic-bytes, retry, rollback, persistência
em `china_produto_documentos`, preview com `ChinaDocPreviewDialog`, download via
`downloadStorageBlob` + `triggerBlobDownload`).

## Pré-requisitos por ambiente

Em cada ambiente (**dev**, **staging**, **production**) é necessário:

1. Um usuário de teste com acesso ao módulo China → Caixa de Entrada.
2. Uma submissão China (`china_produto_submissoes`) com checklist disponível e
   pelo menos um tipo de documento aceitando upload (default: `outros`).
3. Secrets configurados no GitHub Environment correspondente:
   - `E2E_BASE_URL` — URL pública (preview/staging/produção).
   - `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`.
   - `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY`.
   - `E2E_CHINA_SUBMISSAO_ID` — UUID da submissão seed.
   - (opcional) variável `E2E_CHINA_CHECKLIST_TIPO`.

## Rodar local

```bash
export E2E_BASE_URL=http://localhost:5173
export E2E_TEST_EMAIL=...
export E2E_TEST_PASSWORD=...
export E2E_SUPABASE_URL=...
export E2E_SUPABASE_ANON_KEY=...
export E2E_CHINA_SUBMISSAO_ID=...
bunx playwright test e2e/china-docs
```

## Rodar no CI

Workflow: `.github/workflows/e2e-china-docs.yml`.

- Disparo manual (`workflow_dispatch`) selecionando ambiente.
- Agendado diariamente (08:00 UTC) em staging.
- Matriz roda `dev | staging | production` em paralelo, com `fail-fast: false`.

## Cobertura

| Etapa | Verificação |
|---|---|
| Upload | `input[type=file]` aceita `sample.pdf` (magic bytes válidos), toast de sucesso aparece. |
| Persistência | REST `GET /china_produto_documentos` retorna registro com `arquivo_path` e `created_at` recente. |
| Preview | `ChinaDocPreviewDialog` abre em estado `ready` (sem `erro|falha`). |
| Download | `page.waitForEvent("download")` dispara com `suggestedFilename` preservando nome original. |

## Limitações conhecidas

- Não testa rollback (DB falha após Storage OK) — exige injeção de falha; coberto
  por unit test em `src/lib/china/__tests__/`.
- Não valida realtime entre abas — fora de escopo deste spec.
