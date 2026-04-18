

## Diagnóstico

Recebi um documento de QA externo listando **21 bugs P0/P1** baseados em uma bateria de teste de 169 endpoints com 59% de sucesso. **Antes de aprovar qualquer correção, preciso validar os achados contra a realidade do código atual** — porque vários sintomas descritos contradizem o que sei do estado pós PR-7/PR-8.

Vou explorar o codebase para confirmar/refutar cada bug e só então propor um plano cirúrgico.

### Validação dos achados (necessária antes de planejar)

Preciso confirmar:

1. **P0-1** (`.catch is not a function`): grep global por `.catch(` em edge functions. Se o pattern não existir, bug é falso positivo. Se existir, listar arquivos.
2. **P0-2/P0-3** (colunas `ativo` e `nome` em `contas_bancarias`): consultar `information_schema` para ver schema real. Pode ser que a tabela se chame `contas_correntes` e o QA testou com nome errado.
3. **P0-4** (`Cannot coerce`): verificar se `fornecedores-api` existe (vi `erp-fornecedores-query` e `erp-fornecedores-sync`, não `fornecedores-api` puro). Pode ser endpoint inexistente.
4. **P0-5** (`codigo_dre_gerencial` em `trade_chart_of_accounts`): consultar schema. `categorias-api` provavelmente usa outra tabela (`plano_contas` ou `dre_cadastros`).
5. **P1-1** (501 `/conciliar` `/desconciliar`): conferir `contas-receber-api/index.ts` — o `docs/API_CONTAS_RECEBER.md` que tenho diz que essas rotas EXISTEM. Pode ser que o teste rodou contra versão antiga ou caminho errado.
6. **P1-2** (401 em `fornecedores-sync-api`): functions são `erp-fornecedores-sync`, não `fornecedores-sync-api`. Provavelmente teste com path errado.
7. **P1-3** (`varchar(1)` em `empresas`): consultar `information_schema`.
8. **P1-4** (UUID literal "uuid"): essa é falha do TESTE (mandar string `"uuid"` literal), não do servidor. Mas validação 400 vs 500 é melhoria legítima — confirmar se já temos `requireUuid` no `_shared/validate.ts` (sei que temos Zod `.uuid()`).
9. **P1-5** (X-Request-ID ausente): grep por `X-Request-ID` no `_shared/secure-handler.ts` e `error-handler.ts`. Sei que temos `secureHandler` wrapper — provavelmente já cobre.
10. **P2-1/P2-3** (ETag, RateLimit headers): grep — sei que `rate-limit.ts` já emite (PR-6) e ApiDocumentation menciona ETag.

### Ações de exploração (read-only)

- `code--search_files query="\.catch\("` em `supabase/functions/` — confirmar P0-1.
- `supabase--read_query` em `information_schema.columns WHERE table_name IN ('contas_bancarias','contas_correntes','trade_chart_of_accounts','empresas','fornecedores')` — confirmar P0-2/3/5/P1-3.
- `code--list_dir supabase/functions/contas-receber-api/` + `code--view index.ts` (router) — confirmar P1-1.
- `code--list_dir supabase/functions/` — confirmar nomes reais de fornecedores-sync.
- `code--view supabase/functions/_shared/secure-handler.ts` — confirmar X-Request-ID middleware (P1-5).
- `code--view supabase/functions/_shared/validate.ts` (já tenho parcial) — confirmar `isUuid`/`requireUuid`.
- `code--search_files query="\"4.1.0\""` em `ApiDocumentation.tsx` — confirmar versão atual.

## Plano de execução — PR-9 (apenas bugs CONFIRMADOS após validação)

A estratégia é **validar primeiro, corrigir depois**. Não vou criar migrations ou refatorar código baseado em laudo externo sem confirmar contra o estado real. O documento do QA tem 4 sinais de defasagem (path `fornecedores-sync-api` não existe, conciliar/desconciliar já documentados em CR, request-id provavelmente já emitido pelo `secureHandler`, validação Zod já presente).

### Fase 1 — Auditoria de validação (2 minutos, read-only)

Para cada bug do laudo, classificar em uma das 4 categorias:

| Categoria | Ação |
|---|---|
| **CONFIRMADO** (existe no código, sintoma reproduzível) | Entra na fila de correção |
| **JÁ CORRIGIDO** (cobertura prévia em PR-1..PR-8) | Marcar como N/A no relatório |
| **PATH ERRADO** (function/endpoint não existe com esse nome) | Devolver ao QA com nome correto |
| **TESTE INVÁLIDO** (mandar `"uuid"` literal é erro do teste, não do server — mas hardening 400 vs 500 ainda vale) | Aceitar como melhoria de robustez |

Output desta fase: tabela `Bug × Status × Evidência (linha de código ou query SQL)`.

### Fase 2 — Plano de correção (só após Fase 1)

Para cada bug **CONFIRMADO**, abrir sub-item neste plano com:
- Arquivo exato a editar
- Diff conceitual
- Migration SQL se aplicável
- Invariante de regression para `audit/regression-greps.sh`

Suspeita prévia (a confirmar):
- **P0-1, P0-4**: provavelmente confirmados (padrão `.catch()` é easy slip).
- **P0-2, P0-3, P0-5**: provavelmente schema drift real OU nome de tabela errado no laudo. Migration só se confirmado por SQL real.
- **P1-1**: provavelmente já implementado (documentado em CR docs).
- **P1-2**: provavelmente path errado no teste.
- **P1-3**: precisa SQL para confirmar varchar(1).
- **P1-4**: hardening legítimo — adicionar `validateUuidParam` helper antes de `safeParse`, retornar 400 estruturado.
- **P1-5**: provavelmente já coberto pelo `secureHandler`. Se sim, só adicionar invariante de regression.

### Fase 3 — Execução cirúrgica (só CONFIRMADOS)

- Criar migrations apenas para schema drift comprovado (não inventar colunas baseado em laudo).
- Refatorar edge functions apenas onde grep confirma `.catch()` ou `.single()` problemático.
- Adicionar `requireUuid` em `_shared/validate.ts` se não existir.
- Implementar `/conciliar` `/desconciliar` em CR **somente se confirmado que estão 501** (já há doc dizendo que existem).

### Fase 4 — Versionamento e regression

- Bump APP `3.1.0 → 3.1.1` (patch — bugfix sem breaking).
- OpenAPI permanece `4.1.0` (sem mudança de contrato).
- SDKs permanecem `3.1.0` (a menos que P1-1 force novo método).
- Adicionar invariantes negativos em `audit/regression-greps.sh`:
  - `grep -c "\.catch(" supabase/functions/` deve ser 0 nos handlers (não em testes).
  - `grep -c "X-Request-ID" supabase/functions/_shared/` ≥ 1.
- Atualizar `mem://process/release-changelog-discipline` se padrão novo (validation hard 400) virar regra.

### Fase 5 — Re-validação

- `audit/regression-greps.sh` verde.
- `api-health-check` 38/38 OK.
- Smoke nos endpoints corrigidos (CR/CP/Empresas/Fornecedores) via `supabase--curl_edge_functions`.
- Documento `docs/fixes-abr26/IMPLEMENTATION_REPORT.md` listando: bugs corrigidos, bugs reclassificados (path errado/teste inválido/já corrigido), migrations aplicadas, invariantes novos.

## Não-escopo

- Aceitar cegamente os 21 bugs do laudo sem validar — risco de migration destrutiva (ex: criar coluna `nome` em tabela que já tem `descricao`).
- Implementar `/conciliar` se já existir (duplicação).
- Mudanças P2 (ETag/rate-limit headers) que já estão implementadas (PR-6).
- Bater % de sucesso "≥95%" antes de validar quais "falhas" são reais.

## Impacto

Plano em duas etapas: **validação primeiro (zero código), correção cirúrgica depois (só bugs reais)**. Evita o risco do laudo externo desalinhar com 8 PRs de evolução já entregues. Tempo Fase 1: ~3 min de SQL+grep. Tempo Fase 2-5 (estimativa otimista, supondo 50% dos bugs serem confirmados): 6-10 arquivos editados, 2-3 migrations, ~5 invariantes novos. Bump `3.1.0 → 3.1.1`. Sem breaking change. Risco de regressão: baixo (correções localizadas em handlers específicos).

