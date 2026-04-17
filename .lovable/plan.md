

## Diagnóstico

Pedido: reformatar a saída da auditoria de **matriz por endpoint** para **pattern findings agrupados por causa-raiz**. Mesmos 20 dados (FAIL+MISSING), nova lente: cada padrão vira 1 PR potencial em vez de 20 fixes isolados.

Material já consolidado nos ciclos anteriores. Trabalho é puramente de reorganização — sem novas leituras de código necessárias.

## Escopo

### Estrutura por padrão (P1..PN)

Cada bloco contém:
- **ID + severidade rollup** (ALTA/MÉDIA, derivado do max dos endpoints afetados)
- **Causa-raiz** (1 frase apontando arquivo:linha do pivô, quando aplicável)
- **Esforço de fix** (BAIXO ≤30min / MÉDIO ≤4h / ALTO >4h) + estimativa de PRs e linhas
- **Endpoints afetados** (lista enumerada, não só contagem — agrupada por módulo)
- **Verificação pós-fix grep-friendly** (alinhado com `mem://process/release-changelog-discipline`)

### Padrões consolidados a partir das matrizes anteriores

Mapeando os 20 findings ALTA+MÉDIA:

| Padrão | Severidade | Endpoints | Causa-raiz |
|---|---|---|---|
| **P1 X_REQUEST_ID_MISSING** | ALTA | 14 (CR×7, CC×4, parcelas×1, erp-export×1, +cancelar/conciliar) | `_shared/response.ts:8-32` não emite header nem `meta.request_id` |
| **P2 IDEMPOTENCY_MISSING** | ALTA | 11 (CR×9 escrita, CC×2 escrita) | Ausência de `_shared/idempotency.ts` reutilizável; só CP tem implementação local |
| **P3 HANDLER_NOT_FOUND** | ALTA | 1 (`/contas-receber-api/estornar`) | Paridade CR↔CP incompleta; handler nunca portado |
| **P4 DEPRECATION_HEADER_MISSING** | MÉDIA | 2 (CR alterar, CR excluir) | Spec marca sunset mas handlers não emitem RFC 8594 (`Deprecation:` / `Sunset:`) |
| **P5 PAGINATION_HEADERS_MISSING** | MÉDIA | 2 (CR listar, CC listar) | Listagens não emitem `X-Total-Count` / `Link` |
| **P6 CACHE_HEADERS_MISSING** | MÉDIA | 1 (CR consultar) | GET sem `ETag` / `Cache-Control` |
| **P7 RESPONSE_SCHEMA_DRIFT** | MÉDIA | 1 (`erp-export-payment`) | OpenAPI declara objeto, response real omite `request_id` correlacionável |
| **P8 QUERY_BUILDER_DUPLICATED** | MÉDIA | 1 (parcelas listar) | `parcelas-api/index.ts:117-126` reconstrói query inteira em vez de aplicar `.order` condicional |

Sub-total endpoints únicos cobertos: 20 (alguns aparecem em ≥2 padrões — ex: `CR/upsert-lote` está em P1 e P2).

### Bloco final

Após os 8 padrões:
- **Resumo de esforço total**: PRs estimados (~6-8), linhas (~150-250), ROI por padrão (P1 destrava 14 endpoints com 20 linhas → maior alavancagem).
- **Ordem recomendada de execução**: P3 → P1 → P2 → P4..P8 (P3 é isolado e crítico; P1 é alavancagem máxima; P2 é volume mas exige design de middleware).
- **Changelog v3.8.5 grep-verificável**: bloco pronto para colar em `ApiDocumentation.tsx` quando os fixes forem aplicados.

## Não-escopo

- Re-auditoria dos endpoints (dados já consolidados nas matrizes anteriores).
- Aplicar correções (auditoria continua read-only).
- Reformatar Matriz 2 EXTRA (já entregue no ciclo anterior, lente diferente).

## Impacto

Time vê backlog em **8 PRs** em vez de **20 endpoints**. P1 sozinho fecha 70% dos findings ALTA com edição única em `_shared/response.ts`. Releva alavancagem por causa-raiz — exatamente o ângulo que matriz por endpoint não mostra.

