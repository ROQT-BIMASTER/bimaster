
# Revisão Completa OpenAPI Spec v3.0.0

## Escopo

**1 arquivo**: `src/components/erp/ApiDocumentation.tsx` — reescrever a função `generateOpenAPISpec` (linhas 905-974).

## O que será feito

### Função `generateOpenAPISpec` — Reescrita completa

A função atual (70 linhas) gera um spec sem schemas tipados. Será expandida para ~400 linhas com:

**1. `components.schemas`** — 40+ schemas tipados organizados por módulo:
- Reutilizáveis: `PaginatedBase`, `PaginatedRequest`, `ErrorValidation`, `ErrorAuth`, `ErrorRateLimit`, `MutationResponse`, `LoteResponse`, `HealthCheckResponse`
- Clientes: `ClienteInput`, `ClienteResponse`, `ClienteResumido`, `ClienteListarRequest`
- CP: `ContaPagarInput`, `ContaPagarResponse`, `PagamentoInput`, `PagamentoResponse`
- CR: `ContaReceberInput`, `RecebimentoInput`
- Empresas: `EmpresaInput`, `EmpresaResponse`
- Fornecedores: `FornecedorQuery`, `FornecedorSyncInput`
- Contas Correntes: `ContaCorrenteInput`, `ContaCorrenteResponse`
- Boletos: `BoletoGerarInput`, `BoletoResponse`
- Categorias: `CategoriaInput`
- Projetos: `ProjetoInput`, `ProjetoResponse`
- Departamentos: `DepartamentoInput`
- Webhooks: `WebhookSubscribeInput`, `WebhookSubscriptionResponse`
- Referência: `PaisResponse`, `CidadeResponse`, `BancoResponse`
- Exportação: `ExportPendingResponse`, `ExportConfirmInput`
- Lançamentos CC: `LancamentoCCInput`

**2. Mapeamento automático path→schema** — Lógica que associa cada endpoint ao seu `$ref` correto baseado no path e método. Exemplo: `POST /contas-pagar-api/incluir` → requestBody `$ref: ContaPagarInput`, response `$ref: ContaPagarResponse`.

**3. Respostas de erro padronizadas** — Todos os endpoints terão 400/401/429 com `$ref` para schemas de erro. Endpoints de criação (`/incluir`) terão 409 adicional.

**4. `operationId`** — Gerado automaticamente: `{módulo}{Ação}` (ex: `clientesListar`, `cpIncluir`).

**5. Metadados atualizados:**
- Versão: `3.0.0`
- Contato com email
- Licença
- Server de sandbox adicionado
- Tags com descrições completas (36 tags)

**6. Correções de exemplos** — O loop que processa endpoints converterá `example` de string para objeto JSON onde necessário.

**7. Nomenclatura legada** — Endpoints com campos `nPagina`/`cCodStatus` receberão nota `x-legacy: true`.

## Detalhes técnicos

- A lógica dinâmica existente (loop sobre `modules`) será mantida — os schemas serão injetados via um mapa `PATH_SCHEMA_MAP` que associa patterns de path a schemas
- Os 185 endpoints existentes serão preservados intactos
- Nenhum outro arquivo será alterado
