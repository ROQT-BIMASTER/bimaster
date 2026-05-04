# Auditoria de Qualidade de Código — Bi Master (2026-05-04)

## Sumário executivo

| Dimensão | Estado atual | Status |
|---|---|---|
| Mistura PT/EN em function names | ~90 ocorrências em ~57 arquivos | Aceito como dívida — migração por módulo |
| `console.*` fora do `lib/logger.ts` | 0 (após esta rodada) | OK |
| TODOs sem categorização | 52 capturas → ver inventory (38 são falso-positivo) | Triagem humana pendente |
| ESLint warning gates (`no-console`, `no-explicit-any`, `ban-ts-comment`) | Ativados | OK |
| Style Guide oficial | Publicado em [`docs/STYLE-GUIDE.md`](./STYLE-GUIDE.md) | OK |
| `any` / `as any` no codebase | ~829 arquivos com pelo menos 1 ocorrência | Aceito como dívida — gate previne regressão |
| Cobertura de testes | 23 arquivos `*.test.*` | Backlog separado |

## Findings detalhados

### 1. Mistura PT/EN — DOCUMENTADA, NÃO MIGRADA

Muitas funções de domínio com prefixo PT (`buscar`, `obter`, `salvar`,
`carregar`, `criar`, `atualizar`, `listar`) coexistindo com `getX`/`fetchX`.

Lista completa pode ser extraída via:

```bash
rg "function (buscar|obter|carregar|salvar|criar|atualizar|listar)[A-Z]" \
  src/ -g "*.ts" -g "*.tsx"
```

**Decisão (alinhada com Style Guide):**
hooks e funções de **domínio** ficam em PT (`useClientes`, `salvarContaPagar`).
Helpers/utils **genéricos** em EN (`formatDate`, `parseLocalDate`). A "mistura"
é, na verdade, parcialmente intencional — seguindo o princípio
"Domínio reflete o negócio (PT). Infra reflete a stack (EN)."

Migração de casos genuinamente fora do padrão vira projeto separado por módulo
(financeiro → trade → fabrica → ...) quando houver dor real ou refactor
oportunístico.

### 2. Arquivos > 1500 linhas (top, excluindo `types.ts` auto-gerado)

| Linhas | Arquivo |
|---|---|
| 4505 | `src/components/erp/SdkDownloadButtons.tsx` |
| 3984 | `src/components/erp/ApiDocumentation.tsx` |
| 3489 | `src/components/configuracoes/DocumentacaoIntegracaoERP.tsx` |
| 2185 | `src/pages/DREAnalitico.tsx` |
| 1840 | `src/pages/ContasAPagar.tsx` |
| 1751 | `src/components/fabrica/FichaCustoProdutoEditor.tsx` |
| 1723 | `src/contexts/LanguageContext.tsx` |
| 1686 | `src/components/trade/QuickEntryDialog.tsx` |
| 1565 | `src/components/dashboard/AppSidebar.tsx` |
| 1556 | `src/components/marketing/influencers/InfluencerProfile360.tsx` |

`SdkDownloadButtons.tsx`, `ApiDocumentation.tsx` e `DocumentacaoIntegracaoERP.tsx`
são geradores de SDK / changelog histórico — tamanho é estrutural, não
necessariamente refatorável. `DREAnalitico`, `ContasAPagar`, `FichaCustoProdutoEditor`
são candidatos reais a quebra em subcomponentes.

### 3. `any` / `as any`

~829 arquivos com pelo menos uma ocorrência. Aceito como dívida histórica —
gate ESLint `@typescript-eslint/no-explicit-any: warn` previne regressão em
PRs novos sem bloquear deploy atual.

### 4. Cobertura de testes

23 arquivos de teste para projeto desse porte. Áreas cobertas:
formatters, prazoCalculator, projetoFilterUtils, debounce, memory-manager,
offline-manager, storage-helper, security-validation, AuthContext,
MarketingModule, tarefaRiskUtils.

Backlog: ampliar para rotas críticas (financeiro, trade workflows, edge
functions de IA, projeto-copilot, Asana sync).

### 5. Console / Logger

Após esta rodada: zero `console.*` fora de `src/lib/logger.ts`. Todos os
13 emissores migrados para `logger.debug/warn/error`. Gate ESLint sinaliza
regressão.

## Roadmap

### Esta rodada (entregue)

- Style Guide publicado em `docs/STYLE-GUIDE.md`
- 13 `console.*` migrados para `logger.*` (em 9 arquivos)
- ESLint warning gates ativados em `eslint.config.js` (`no-console`,
  `@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`,
  `@typescript-eslint/no-unused-vars` com prefixo `_`, `no-debugger` como erro)
- TODO inventory para triagem em `docs/CODE-QUALITY-TODO-INVENTORY.md`

### Próximas rodadas (sob demanda)

- Migração PT/EN no módulo `financeiro/` quando houver refactor oportunístico
- Migração no módulo `trade/`
- Refactor de 1 arquivo grande por sprint (alvos: `DREAnalitico`,
  `ContasAPagar`, `FichaCustoProdutoEditor`)
- Triagem dos TODOs `TECH-DEBT` (humano):
  - Props `@deprecated` em `ChinaDocumentSlot` → remover quando consumidores migrarem
  - `// TODO: Sentry` em `ErrorBoundary` e `lib/logger.ts` → integração observabilidade
- Aumentar cobertura de testes em rotas críticas
- Considerar `eslint-plugin-import` para ordenação automática

## Validação desta rodada

```bash
# 1. Lint roda com warnings tolerados, sem novos errors
bunx eslint src/ --max-warnings 9999

# 2. Tests não regrediram
bunx vitest run

# 3. console.* fantasmas zerados
rg "console\.(log|warn|error|info|debug)" src/ -g "*.ts" -g "*.tsx" \
  | rg -v "src/lib/logger.ts" | wc -l   # esperado: 0

# 4. Docs criados
test -f docs/STYLE-GUIDE.md && echo OK
test -f docs/CODE-QUALITY-AUDIT.md && echo OK
test -f docs/CODE-QUALITY-TODO-INVENTORY.md && echo OK

# 5. Smoke E2E continua verde
bash scripts/security/e2e-authenticated-sensitive-columns.sh
```

## Rollback

Por bloco, sem migration de DB:

1. **Style Guide / Audit / Inventory**: deletar os 3 arquivos em `docs/`
2. **console.* → logger**: reverter o commit específico
3. **ESLint gates**: reverter `eslint.config.js` ao estado anterior
   (apenas `no-unused-vars: off`)

Comportamento volta exatamente ao estado anterior. Nenhum dado é perdido.
