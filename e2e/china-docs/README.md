# E2E — China: Upload → DB → Preview → Download

Spec: `upload-flow.spec.ts`. Cobre o fluxo hardenizado de
`useUploadChinaDocumento` (validação magic-bytes, retry, rollback, persistência
em `china_produto_documentos`, preview com `ChinaDocPreviewDialog`, download via
`downloadStorageBlob` + `triggerBlobDownload`).

## Matriz de papéis

A RLS de `china_produto_documentos` é:

```
EXISTS submissão s WHERE s.id = submissao_id
  AND (s.created_by = auth.uid() OR check_user_access(auth.uid(), 'fabrica'))
```

Cada papel é validado num `describe.serial` independente:

| Papel         | Esperado | Como o teste passa                                                       |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `admin`       | allow    | `check_user_access` → admin tem tudo                                     |
| `gerente`     | allow    | módulo `fabrica` habilitado no perfil                                    |
| `supervisor`  | allow    | módulo `fabrica` habilitado                                              |
| `china_owner` | allow    | é o `created_by` de `E2E_CHINA_OWNER_SUBMISSAO_ID`                       |
| `china_other` | allow    | módulo `china` habilitado → libera RLS + storage `china-documentos`     |
| `vendedor`    | **deny** | sem módulo `china`/`fabrica` → bloqueio no `ModuleProtectedRoute`/toast |

Casos `deny` são **pulados em produção** (poluiriam `security_audit_log`).
Quando faltam credenciais de um papel, o teste daquele papel é `skip`-ado, a
menos que `STRICT_E2E=1` (default em staging).

## Seed sugerida (staging)

Crie 6 usuários, todos no tenant alvo:

1. **admin** — `user_roles.role = 'admin'`.
2. **gerente** — `role = 'gerente'`, módulo `fabrica` em `usuario_permissoes_modulos`.
3. **supervisor** — `role = 'supervisor'` + módulo `fabrica`.
4. **china_owner** — usuário do depto China; criar uma submissão e gravar seu
   `id` em `E2E_CHINA_OWNER_SUBMISSAO_ID`.
5. **china_other** — usuário do depto China, **sem** `fabrica`, e que **não**
   criou a submissão acima.
6. **vendedor** — `role = 'vendedor'`, sem `fabrica`.

Use uma submissão de teste estável (`E2E_CHINA_SUBMISSAO_ID`) para admin/
gerente/supervisor — pode ser a mesma para os três.

## Pré-requisitos por ambiente (GitHub Environment secrets)

**Compartilhadas:**

- `E2E_BASE_URL`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`
- `E2E_CHINA_SUBMISSAO_ID`, `E2E_CHINA_OWNER_SUBMISSAO_ID`
- (var) `E2E_CHINA_CHECKLIST_TIPO` — default `outros`

**Por papel** (par email/senha):

```
E2E_ADMIN_EMAIL        / E2E_ADMIN_PASSWORD
E2E_GERENTE_EMAIL      / E2E_GERENTE_PASSWORD
E2E_SUPERVISOR_EMAIL   / E2E_SUPERVISOR_PASSWORD
E2E_CHINA_OWNER_EMAIL  / E2E_CHINA_OWNER_PASSWORD
E2E_CHINA_OTHER_EMAIL  / E2E_CHINA_OTHER_PASSWORD
E2E_VENDEDOR_EMAIL     / E2E_VENDEDOR_PASSWORD
```

Opcional: `E2E_ADMIN_TOKEN_EMAIL`/`_PASSWORD` se preferir uma conta de
verificação dedicada (default: reusa `E2E_ADMIN_*`).

## Rodar local

```bash
export E2E_BASE_URL=http://localhost:5173
export E2E_SUPABASE_URL=...
export E2E_SUPABASE_ANON_KEY=...
export E2E_CHINA_SUBMISSAO_ID=...
export E2E_CHINA_OWNER_SUBMISSAO_ID=...
# Exporte apenas os papéis que quer testar — o resto faz skip.
export E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=...
STRICT_E2E=0 bunx playwright test e2e/china-docs
```

`STRICT_E2E=1` força falha quando faltar qualquer credencial — use em CI staging.

## Rodar no CI

Workflow: `.github/workflows/e2e-china-docs.yml`.

- Disparo manual (`workflow_dispatch`) selecionando ambiente.
- Agendado diariamente (08:00 UTC).
- Matriz roda `dev | staging | production`, `fail-fast: false`.
- `STRICT_E2E` é `1` em staging, `0` em dev/prod.

## Cobertura por etapa (caso "allow")

| Etapa         | Verificação |
| ------------- | ----------- |
| Upload        | `input[type=file]` aceita `sample.pdf` (magic bytes válidos); toast de sucesso. |
| Persistência  | (papel allow): preview abre com o doc; (papel deny): conta REST = 0 linhas. |
| Preview       | `ChinaDocPreviewDialog` abre em estado `ready` (sem `erro|falha`). |
| Download      | `page.waitForEvent("download")` dispara com `suggestedFilename` original. |

## Caso "deny" — o que o teste valida

1. `tryUpload` navega para a Caixa de Entrada da submissão.
2. Se `ModuleProtectedRoute` bloqueia (papel sem `fabrica`) → marca `blockedAtRoute = true`.
3. Caso contrário, dispara o `setInputFiles` e espera:
   - toast de sucesso → **FALHA** (não deveria);
   - toast de erro de permissão/sessão → OK.
4. Verificação cruzada via REST com token do verificador (admin) garante
   `count(china_produto_documentos) = 0` para a janela do teste.

## Limitações conhecidas

- Não testa rollback (DB falha após Storage OK) — exige injeção de falha;
  coberto por unit test em `src/lib/china/__tests__/`.
- Não valida realtime entre abas — fora de escopo.
- Revogação ao vivo de permissão (sessão ativa perde `fabrica`) — fora de escopo.
