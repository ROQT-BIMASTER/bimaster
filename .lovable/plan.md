

# Plano — Restaurar `Painel Central — Contas a Pagar`

## Causa raiz

A tela `src/pages/financeiro/PainelCentralAP.tsx` chama 3 endpoints **removidos** na v4.0.0 do `contas-pagar-api` (PR-7, sunset em produção). O backend devolve 404 e o React Query expõe `isError = true`, renderizando o card "Erro ao carregar títulos".

| Chamada atual | Situação | Substituto canônico (já em produção) |
|---|---|---|
| `GET /listar` (carga principal) | 404 — router não conhece a rota | `GET /query` |
| `POST /registrar-pagamento` | 404 | `POST /lancar-pagamento` |
| `POST /cancelar-pagamento` | 404 | `POST /estornar` (com `motivo` obrigatório) |

Confirmado em três fontes: o roteador `supabase/functions/contas-pagar-api/index.ts` (linhas 137–163 — só `query:GET`, `lancar-pagamento:POST`, `estornar:POST`), o changelog em `ApiDocumentation.tsx` (PR-7 BREAKING removeu `/listar`, `/registrar-pagamento`, `/cancelar-pagamento`) e os logs (`function_edge_logs` mostra apenas chamadas a `/query`; nenhuma a `/listar`). Em paralelo, o contrato de resposta também mudou: `/listar` devolvia `{ conta_pagar_cadastro, total_de_paginas, total_de_registros }`; `/query` devolve `{ data: ContaPagar[], meta: { total, has_more, next_cursor } }` (ver `src/types/financeiro/contas-pagar.ts` e `src/hooks/useContasPagar.ts`).

## O que será feito

### 1. Migrar a query principal para `/query`
- Substituir `path: "/listar"` por `path: "/query"`.
- Trocar parâmetros legados pelos do schema `QueryParams`:
  - `pagina` + `registros_por_pagina` → `limit` + `offset` (offset = `(pagina-1) * porPagina`).
  - `filtrar_por_status` → `status`.
  - `filtrar_por_data_de` / `_ate` → `vencimento_de` / `vencimento_ate` (manter `dateToApi`).
  - `filtrar_por_emissao_de` / `_ate` → `emissao_de` / `emissao_ate`.
  - `filtrar_cliente` → `fornecedor_codigo` (a busca textual por nome de fornecedor não existe em `/query`; ver item 5).
  - `filtrar_empresa_id` → `empresa_id` (string).
  - `order_by: "data_vencimento"`, `order_dir: "desc"` por padrão.
- Adaptar leitura da resposta: `list = titulos?.data ?? titulos?.rows ?? []`, `total = titulos?.meta?.total ?? 0`, `totalPaginas = Math.max(1, Math.ceil(total / porPagina))`.
- Ajustar a tabela aos campos canônicos do `ContaPagar` (`numero_documento`, `valor_original`, `categoria_nome`) com fallback aos nomes antigos para não quebrar enquanto o backend popula ambos.

### 2. Migrar o pagamento para `/lancar-pagamento`
- Trocar `path: "/registrar-pagamento"` por `path: "/lancar-pagamento"`.
- Ajustar o body ao `LancarPagamentoInput`: enviar `codigo_lancamento` (id ou `erp_id` do título), `valor`, `data`, `forma_pagamento` (enum em minúsculas: `pix`, `boleto`, `transferencia`, `dinheiro`, `cartao`, `cheque`), `codigo_conta_corrente` (do select de portador) e `codigo_pix` quando aplicável.
- Mesma migração no `src/pages/financeiro/ConciliacaoManualAP.tsx` (linhas 81 e 123) para evitar regressão na tela de conciliação.

### 3. Migrar o "Cancelar Pagamento" para `/estornar`
- A ação "Cancelar pagamento" do menu vira **Estorno** (já existe a confirmação `estornoConfirmItem` na tela). Reaproveitar o modal existente para coletar `motivo` (obrigatório) e enviar `{ id, motivo, valor_estorno? }` para `/estornar`.
- A ação "Cancelar título" (já em `/cancelar`) continua igual — é um endpoint diferente e está vivo.

### 4. Atualizar a fila ERP pós-mutação
- Manter `enqueueErpSync` após sucesso para preservar a integração com o ERP.
- Trocar `operacao: "cancelamento_pagamento"` por `operacao: "estorno"` quando a ação for estorno (consistente com o que o `cancelMutation` já faz para `/cancelar`).

### 5. Filtro de fornecedor por texto
- `/query` aceita `fornecedor_codigo` exato, não busca textual. Manter o input de fornecedor mas, quando o usuário digitar texto livre, **resolver localmente** via `categorias`/cadastro de fornecedor (já carregado em outras telas) ou simplesmente remover o input enquanto o backend não expõe `fornecedor_nome ILIKE`. Solução escolhida: manter o input visível mas só aplicar o filtro quando o valor for um código numérico/exato; se for texto, exibir tooltip "Use código exato do fornecedor". Evita expectativa quebrada no usuário.

### 6. Higienização documental
- Atualizar `src/pages/financeiro/RelatorioAPxERP.tsx` (linhas 20, 27, 29) para remover `/listar`, `/registrar-pagamento`, `/cancelar-pagamento` da matriz de telas × APIs e apontar para `/query`, `/lancar-pagamento`, `/estornar`.
- Remover `/listar` do `METHOD_MAP` em `src/lib/utils/api-helpers.ts` para impedir reincidência (qualquer nova chamada a `/listar` cairá em `POST` por default e quebrará no code review).

### 7. Verificação
- Após salvar, abrir a tela e confirmar:
  - KPIs carregam (`resumo-financeiro-api` continua intacto).
  - Tabela exibe títulos (resposta de `/query`).
  - "Registrar Pagamento" persiste e dispara `enqueueErpSync` com `operacao: "provisao"`/`pagamento`.
  - "Estornar Pagamento" exige motivo e baixa o pagamento.
- Conferir `function_edge_logs` para garantir 200 nas chamadas a `/query`, `/lancar-pagamento`, `/estornar`.

## Detalhes técnicos

**Arquivos editados:**
- `src/pages/financeiro/PainelCentralAP.tsx` — 3 trocas de endpoint + adaptação do unwrap (`data`/`meta`).
- `src/pages/financeiro/ConciliacaoManualAP.tsx` — `/registrar-pagamento` → `/lancar-pagamento` (2 ocorrências).
- `src/pages/financeiro/RelatorioAPxERP.tsx` — atualizar matriz documental.
- `src/lib/utils/api-helpers.ts` — remover `"/listar": "GET"` do `METHOD_MAP`.

**Não será alterado:**
- `supabase/functions/contas-pagar-api/*` — backend já está correto; a remoção foi intencional (PR-7, mem://finance/contas-pagar-governance-and-audit-standard).
- `useContasPagar` em `src/hooks/useContasPagar.ts` — já usa `/query`. Pode-se opcionalmente migrar `PainelCentralAP` para esse hook num PR seguinte (refactor maior, fora do escopo do hotfix).

**Changelog obrigatório (mem://process/release-changelog-discipline):** adicionar entrada em `ApiDocumentation.tsx` registrando o hotfix do consumer (`PainelCentralAP` + `ConciliacaoManualAP`) com invariante grep negativo: `grep -rn "/registrar-pagamento\|/cancelar-pagamento\|path: \"/listar\"" src/` deve retornar 0 ocorrências fora de docs.

**Risco:** baixo. Endpoints alvos já estão em produção, o `useContasPagar` canônico prova que `/query` funciona, e a mudança é localizada a 4 arquivos client-side.

