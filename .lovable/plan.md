

## Diagnóstico — auditoria pós PR-7 do ponto de vista de um dev integrador novo

Fiz varredura completa do que um dev externo enxerga ao tentar integrar com Contas a Pagar (e por simetria CR). O backend e SDKs estão limpos, mas existem **6 pontos de informação descasada** que vão fazer um integrador escrever código contra endpoints que retornam 404. Cada um é localizado, sem efeito em runtime, mas todos quebram a "API magra" prometida.

### Achados (ordenados por dano ao integrador)

**P1 — CRÍTICO: Tabela "Quando usar cada método" no Portal ERP ainda recomenda métodos removidos**
`src/components/erp/ApiDocumentation.tsx` linhas 2223-2230. A tabela é o primeiro lugar que o dev olha. Mostra como recomendação ATIVA:
- `cpListar / crListar` (linha 2229) → método não existe mais no SDK v3.0.0, endpoint retorna 404.
- `cpRegistrarPagamento` (linhas 2226-2227) → idem.
- "cpListar (sem cursor)" como contraponto (linha 2230) → método inexistente.

Dev novo copia da tabela, importa do SDK, recebe erro de compilação. Pior: a coluna "Use" recomenda os removidos, não os substitutos.

**P2 — CRÍTICO: Quick Start em `docs/API_CONTAS_PAGAR.md` ensina endpoint inexistente**
- Linha 19: `curl ... /contas-pagar-api/listar?filtrar_por_status=pendente` → 404.
- Linha 37: tabela "Quando usar" lista `cpListar / GET /listar` como recomendação para "Listar para UI".
- Linha 40-41: lista `cpRegistrarPagamento` e `cpCancelarPagamento` como métodos recomendados.
- Linha 98: Idempotência marca `/registrar-pagamento` como "Obrigatório".
- Linhas 214-222: bloco completo PUT `/alterar` com exemplo.
- Linhas 285-289: bloco POST `/cancelar-pagamento`.
- Linhas 291-326: bloco completo GET `/listar` com 14 parâmetros documentados.
- Linhas 409-427: bloco POST `/registrar-pagamento` com 5 campos.
- Linhas 491-520: tabela "Mapa Completo de Rotas" lista os 4 endpoints removidos como ativos.

Mesma situação em `docs/API_CONTAS_RECEBER.md`:
- Linhas 51-59: PUT `/alterar` documentado.
- Linhas 119-123: POST `/cancelar-recebimento` documentado.
- Linhas 175-206: bloco completo GET `/listar`.
- Linhas 264, 273, 279: tabela "Mapa Completo de Rotas" lista os 3 endpoints removidos.

**P3 — MÉDIO: `docs/MANUAL_NOVAS_TELAS_AP.md` linha 217** instrui a salvar via `contas-pagar-api/alterar`. Documento interno, mas qualquer dev que abrir o repo vê a referência.

**P4 — MÉDIO: Exemplo cURL de autenticação no Portal aponta para `/listar`**
`ApiDocumentation.tsx` linha 785: tabela de autenticação mostra `curl -H "x-api-key: SUA_CHAVE" .../contas-pagar-api/listar` como exemplo padrão. Dev copia o exemplo, recebe 404 no primeiro request — pior introdução possível à API.

**P5 — BAIXO: Comentário `cpRegistrarPagamento` em endpoint `/lancar-pagamento`**
`ApiDocumentation.tsx` linha 144 e 192-193: comentários explicam removido, mas a tabela P1 contradiz. Linhas 247 (CR) similar.

**P6 — INFORMACIONAL: Changelog histórico v3.7.0 (linha 3632)** menciona POST `/cancelar-pagamento` em texto descritivo de release passada — não é instrução, é histórico. Manter intocado por convenção de changelog (regra `mem://process/release-changelog-discipline`).

### Pontos verificados que estão OK

- Backend (`contas-pagar-api/index.ts`, `contas-receber-api/index.ts`): rotas removidas, retornam 404 corretamente.
- SDKs TS/JS/Python (`SdkDownloadButtons.tsx`): métodos deletados, sem `@deprecated`.
- `ApiTester.tsx`: menu de presets já limpo (verificado linhas 64-90).
- `RelatorioAPModule.tsx`: já migrou para `/query`.
- `api-support-ai/index.ts`: prompts já usam `/query` e `/upsert`.
- Onboarding Wizard: usa `/status`, intacto.
- `EndpointSupportChat`: lê endpoint dinâmico, não hardcoded.
- `audit/regression-greps.sh`: 32/32 invariantes passam.

### Plano de ação — 4 edits, 1 release patch

**Etapa 1 — Portal ERP (alto impacto, fácil)**

`src/components/erp/ApiDocumentation.tsx`:
1. Linhas 2223-2230 — reescrever tabela "Quando usar cada método" para v4.0.0:
   - Remover linha "Listagem para tela/UI: cpListar/crListar".
   - Substituir por "Listagem unificada (UI + ETL)": `cpQuery / crQuery (cursor + offset)` na coluna Use; coluna "Não use" passa a "—" (não há alternativa removida).
   - Linha "Baixa unitária com idempotência forte": coluna "Não use" muda de `cpRegistrarPagamento (legado por UUID)` para `—`.
   - Deletar linha "Compatibilidade família legada (UUID): cpRegistrarPagamento" (não há mais método legado).
   - Linha "ETL/relatórios com cursor": coluna "Não use" muda de `cpListar (sem cursor)` para `—`.
2. Linha 785 — trocar exemplo cURL de autenticação: `/contas-pagar-api/listar` → `/contas-pagar-api/query?limit=10`.

**Etapa 2 — Documentação MD (fonte da verdade externa)**

`docs/API_CONTAS_PAGAR.md`:
3. Quick Start linha 19: substituir `/listar?filtrar_por_status=pendente` por `/query?status=pendente&limit=20`.
4. Tabela "Quando usar cada método" linhas 35-43: remover linhas `cpListar`, `cpRegistrarPagamento`, `cpCancelarPagamento`. Manter cpUpsert, cpQuery, cpLancarPagamento, cpEstornar.
5. Tabela Idempotência linha 98: remover linha `/registrar-pagamento`.
6. Deletar bloco PUT `/alterar` (linhas 214-222).
7. Deletar bloco POST `/cancelar-pagamento` (linhas 285-289).
8. Deletar bloco GET `/listar` (linhas 291-326).
9. Deletar bloco POST `/registrar-pagamento` (linhas 409-427).
10. Tabela "Mapa Completo de Rotas" linhas 491-520: remover linhas `/listar`, `/cancelar-pagamento`, `/registrar-pagamento`, `/alterar`.
11. Header: bump versão `v2.4.0` → `v4.0.0` na linha 1, atualizar changelog.

`docs/API_CONTAS_RECEBER.md`:
12. Deletar bloco PUT `/alterar` (linhas 51-59).
13. Deletar bloco POST `/cancelar-recebimento` (linhas 119-123).
14. Deletar bloco GET `/listar` (linhas 175-206).
15. Tabela "Mapa Completo de Rotas" (linhas 258-280): remover linhas `/listar`, `/cancelar-recebimento`, `/alterar`.
16. Adicionar header de versão (atualmente sem) e bloco de changelog v4.0.0.

**Etapa 3 — Manual interno**

17. `docs/MANUAL_NOVAS_TELAS_AP.md` linha 217: trocar `contas-pagar-api/alterar` por `contas-pagar-api/upsert` (semântica equivalente, idempotente).

**Etapa 4 — Regression script (defesa permanente)**

`audit/regression-greps.sh`: adicionar 6 invariantes negativos para os arquivos de doc:
```
checkExact "API_CONTAS_PAGAR.md sem /listar"      "$(grep -c '/contas-pagar-api/listar\|cpListar\|cpRegistrarPagamento' docs/API_CONTAS_PAGAR.md)" 0
checkExact "API_CONTAS_PAGAR.md sem /alterar"     "$(grep -c '/contas-pagar-api/alterar\|cpAlterar' docs/API_CONTAS_PAGAR.md)" 0
checkExact "API_CONTAS_RECEBER.md sem /listar"    "$(grep -c '/contas-receber-api/listar\|crListar' docs/API_CONTAS_RECEBER.md)" 0
checkExact "API_CONTAS_RECEBER.md sem /alterar"   "$(grep -c '/contas-receber-api/alterar\|crAlterar' docs/API_CONTAS_RECEBER.md)" 0
checkExact "Tabela 'Quando usar' sem cpListar"    "$(grep -c 'cpListar\|crListar' src/components/erp/ApiDocumentation.tsx | head -1)" 0  # exclui changelog histórico via sed antes
checkExact "Auth example sem /listar"             "$(grep -c 'contas-pagar-api/listar' src/components/erp/ApiDocumentation.tsx | head -1)" 0
```
Nota: a regra `mem://process/release-changelog-discipline` permite menções em changelogs históricos. Refinar greps com `grep -v 'changes:\|changelog\|releases'` para não pegar entries históricos legítimos.

**Etapa 5 — Release**

18. `src/lib/version.ts`: bump `APP_VERSION` 3.0.0 → **3.0.1** (patch — alinhamento documental, sem mudança de código de runtime).
19. `ApiDocumentation.tsx`: nova entry de changelog v4.0.1 (OpenAPI patch) descrevendo o cleanup de docs descritivos.
20. Validar: `bash audit/regression-greps.sh` → 38/38 OK (32 atuais + 6 novos).

## Não-escopo

- Backend, SDKs, edge functions: já limpos no PR-7, sem alteração.
- Outras APIs (clientes, projetos, contas correntes, lançamentos-cc): mantêm `/listar` e `/alterar` legitimamente — fora do PR-7.
- Republicação de SDKs em registries.
- Bump major (4.0.1 patch, não 5.0.0): runtime inalterado.

## Impacto

Fecha o último ponto cego do PR-7: a documentação descritiva. Hoje um dev integrador que entra pelo Portal ERP ou clona o repo para ler `docs/` é instruído a usar 7 endpoints que retornam 404. Após esse patch, o caminho do dev novo é monocoerente: tabela do Portal, MD da pasta `docs/` e SDK contam a mesma história — só `upsert`, `query`, `lancar-pagamento`, `estornar`. ~80 linhas removidas de docs, ~30 adicionadas (changelog + greps). Nota: **9.8 → 9.85** (alinhamento documental sem mudança de superfície técnica).

