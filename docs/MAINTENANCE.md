# Maintenance — Repositório GitHub

Operações de manutenção do repositório `ROQT-BIMASTER/Roqt-Bimaster` que ficam
fora do fluxo de desenvolvimento normal. Tudo aqui é executado **manualmente
por um humano com permissão admin/write no repo** — o agent Lovable não tem
acesso à API do GitHub.

---

## 1. PR hygiene

### Quando rodar

- Mensalmente, ou sempre que a lista de PRs no GitHub passar de ~30 abertos.
- Antes de auditorias de segurança/code review.

### Script

```bash
# Dry-run (apenas lista, não altera nada).
bash scripts/gh/cleanup-stale-prs.sh

# Aplica as deleções de branches órfãos (com confirmação interativa).
bash scripts/gh/cleanup-stale-prs.sh --apply

# Customizar janelas.
bash scripts/gh/cleanup-stale-prs.sh --days-closed 14 --days-stale 30
```

### O que o script faz

- **Lista** PRs **fechados** há mais de `--days-closed` dias (default 30)
  cujo head branch **ainda existe** no repo — são candidatos a deletar o branch.
- **Lista** PRs **abertos** sem atividade há mais de `--days-stale` dias
  (default 60) **sem label `keep-open`** — apenas aviso, fechar é decisão
  humana.
- Branches protegidos por convenção (`main`, `master`, `dev`, `develop`,
  `release/*`, `hotfix/*`) são **ignorados** mesmo sem branch protection.

### Política de labels

| Label | Significado |
|---|---|
| `keep-open` | PR aberto longo prazo (ex.: epic em andamento); script ignora. |
| `stale` | Aplicada manualmente para sinalizar revisão pendente; não tem efeito automático. |
| `do-not-merge` | Bloqueia merge mesmo com checks verdes; aplicação manual. |

### Fechar PR aberto antigo manualmente

Critérios sugeridos para fechar sem merge:

1. Sem atividade há > 90 dias **e** sem label `keep-open`.
2. Conflitos com `main` que o autor não resolveu em > 30 dias após pedido.
3. Funcionalidade obsoleta (módulo descontinuado, requisito mudou).

Comentário sugerido antes de fechar:

> Fechando por inatividade prolongada. Reabra ou abra novo PR se ainda for
> relevante — não há prejuízo.

---

## 2. Branch protection no `main`

### Aplicar

```bash
bash scripts/gh/setup-branch-protection.sh
```

Requer permissão **admin** no repo. O payload aplicado está em
[`scripts/gh/branch-protection-main.json`](../scripts/gh/branch-protection-main.json).

### Regras aplicadas

| Regra | Valor |
|---|---|
| Required PR reviews | 1 aprovação |
| Dismiss stale reviews | Sim (nova push invalida review anterior) |
| Required status checks | `lint`, `typecheck`, `typecheck-strict`, `build`, `vitest` |
| Strict status checks | Sim (PR precisa estar atualizado com `main`) |
| Required conversation resolution | Sim |
| Allow force push | Não |
| Allow deletions | Não |
| Enforce on admins | **Não** (permite hotfix admin — promover para `Sim` quando time estiver maduro) |
| Linear history | Não (sync Lovable↔GitHub usa merge commits) |

### Mapeamento workflow → context

Os nomes em `required_status_checks.contexts` precisam coincidir **exatamente**
com o `name:` do job no YAML:

| Context | Workflow | Job |
|---|---|---|
| `typecheck` | `.github/workflows/typecheck.yml` | `typecheck` |
| `typecheck-strict` | `.github/workflows/lint-and-build.yml` | `typecheck-strict` |
| `lint` | `.github/workflows/lint-and-build.yml` | `lint` |
| `build` | `.github/workflows/lint-and-build.yml` | `build` |
| `vitest` | `.github/workflows/tests.yml` | `vitest` |

Se renomear um job, atualize `scripts/gh/branch-protection-main.json` e
rode o script novamente.

### Adicionar novo status check

Um status check só pode ser **exigido** depois de ter rodado ao menos uma vez
no branch protegido. Fluxo:

1. Adicionar o job no workflow correspondente, fazer merge na `main`.
2. Confirmar que o job apareceu ao menos uma vez em `https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions`.
3. Adicionar o nome do job em `branch-protection-main.json` → `contexts`.
4. Rodar `scripts/gh/setup-branch-protection.sh` novamente.

### Recriar proteção pela UI (fallback)

Se o script falhar e você precisar recriar manualmente:

1. `https://github.com/ROQT-BIMASTER/Roqt-Bimaster/settings/branches`
2. **Add branch protection rule** → Branch name pattern: `main`
3. Marcar:
   - Require a pull request before merging → Require approvals: **1**
   - Dismiss stale pull request approvals when new commits are pushed
   - Require conversation resolution before merging
   - Require status checks to pass before merging → Require branches to be up to date
   - Adicionar os 5 contexts da tabela acima.
   - Do not allow bypassing the above settings (opcional, equivale a `enforce_admins: true`)
4. **Save changes**.

---

## 3. Lovable ↔ GitHub sync

O sync é **bidirecional automático**:

- Commit feito no editor Lovable → push imediato em `main` no GitHub.
- Commit/merge feito no GitHub em `main` → reflete no Lovable em segundos.

**Importante**: a branch protection do `main` **também se aplica** aos pushes
vindos do Lovable. Se um workflow falhar, o estado pode divergir até alguém
corrigir. Sintomas:

- "Houve commits feitos no Lovable que não aparecem no GitHub" → status check
  vermelho rejeitando o push. Resolver no editor Lovable até CI ficar verde.
- "PRs aparecem do nada com autor `lovable-app[bot]`" → comportamento normal
  para mudanças que o Lovable não consegue aplicar direto em `main` (raro).

### Limitação conhecida

O agent Lovable **não pode**:

- Abrir, fechar ou mergear PRs no GitHub.
- Configurar branch protection (este doc + scripts são o workaround).
- Rodar `git push/pull/rebase/reset` manualmente.
- Gerenciar branches além do `main`.

Para tudo isso, use a UI do GitHub ou os scripts em `scripts/gh/`.
