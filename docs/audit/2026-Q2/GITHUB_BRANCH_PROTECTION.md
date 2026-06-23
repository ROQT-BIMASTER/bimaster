# Branch Protection — `main`

Configuração de referência para o repositório `ROQT-BIMASTER/Roqt-Bimaster`,
branch `main`. Aplicar manualmente pelo admin do org em
**Settings → Branches → Branch protection rules → Add rule** (ou via API
`PUT /repos/{owner}/{repo}/branches/{branch}/protection`).

> Estado atual: regras vivem só no GitHub, não há `repository ruleset` versionado.
> Este documento é o **source of truth declarado**; qualquer divergência é bug.

## Regra recomendada

| Item | Valor |
| --- | --- |
| Branch name pattern | `main` |
| Restrict deletions | ✅ |
| Require linear history | ✅ |
| Require signed commits | ⚪️ opcional (atrito alto com Lovable bot — manter desligado por enquanto) |
| Require pull request before merging | ✅ |
| ↳ Required approving reviews | **1** |
| ↳ Dismiss stale reviews on new commit | ✅ |
| ↳ Require review from Code Owners | ✅ |
| ↳ Restrict who can dismiss reviews | apenas `@ROQT/eng` |
| Require status checks to pass before merging | ✅ |
| ↳ Require branches to be up to date | ✅ |
| Required status checks | ver lista abaixo |
| Require conversation resolution before merging | ✅ |
| Require deployments to succeed before merging | ⚪️ opcional |
| Lock branch | ❌ |
| Do not allow bypassing the above settings | ✅ (inclusive admins) |
| Allow force pushes | ❌ |
| Allow deletions | ❌ |

### Status checks obrigatórios (nomes exatos como aparecem no GitHub)

Cada nome abaixo precisa estar marcado em **Require status checks to pass**.
Os nomes correspondem a `jobs.<id>.name` (ou ao `job_id` quando `name` ausente)
nos workflows em `.github/workflows/`:

- `lint-and-build / lint`
- `lint-and-build / typecheck-strict`
- `lint-and-build / build`
- `typecheck / typecheck`
- `tests / vitest`
- `security-rls-e2e / anonymous-lockdown`
- `regression-greps / greps`
- `guard-destructive-migrations / guard`
- `e2e-aprovacoes / e2e`
- `e2e-china-docs / e2e`
- `e2e-datepicker-tz / e2e`
- `codeql / Analyze (javascript-typescript)`
- `dependency-review / review`

Checks marcados como `continue-on-error: true` no YAML (`lint-and-build / lint-edge`,
`security-rls-e2e / authenticated-access`) **não** entram na lista bloqueante.

## Como sincronizar

Sempre que adicionar/remover workflow ou renomear job:

1. Edite este documento na **mesma PR** que mexe no workflow.
2. Após merge, peça ao admin do org para atualizar a regra real no GitHub.
3. O CI `regression-greps` pode receber uma checagem opcional que valida que
   todo workflow novo aparece nesta lista (TODO — ver roadmap em
   `08-ROADMAP.md`).

## Permissões do repositório

| Setting | Valor |
| --- | --- |
| Default branch | `main` |
| Allow merge commits | ❌ (preserva linear history) |
| Allow squash merging | ✅ (default) |
| ↳ Default commit message | "Pull request title and description" |
| Allow rebase merging | ✅ (alternativa) |
| Auto-delete head branches | ✅ |
| Allow auto-merge | ✅ (com required reviews protege) |

## Segurança do repositório

Ativar em **Settings → Code security and analysis**:

- Dependency graph: ✅
- Dependabot alerts: ✅
- Dependabot security updates: ✅
- Dependabot version updates: ⚪️ via `.github/dependabot.yml` (proposto no roadmap)
- Secret scanning: ✅
- Secret scanning push protection: ✅
- Code scanning (CodeQL): ✅ — workflow `codeql.yml` já versionado
- Private vulnerability reporting: ✅
