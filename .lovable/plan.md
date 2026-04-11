

# Correções Portal Integração ERP + SDKs

## Escopo

Alterações em **2 arquivos** apenas:
- `src/components/erp/ApiDocumentation.tsx` (documentação)
- `src/components/erp/SdkDownloadButtons.tsx` (SDKs TS/JS/Python)

## Bloco 1 — Documentação (ApiDocumentation.tsx)

### 1.1 Versionamento conflitante
- Linha ~2163: trocar "30 dias" para "90 dias" e "90 dias" para "6 meses"
- Alinhar com a seção de Início Rápido (linha ~1228) que já está correta

### 1.2 Nomes de eventos webhook no FAQ
- Linha ~2249: trocar `cp.created, cp.updated, cr.created` para `conta_pagar.criado, conta_pagar.alterado, conta_receber.criado`

### 1.3 Formato de data bidirecional
- Linhas ~1471, ~1505, ~2199: adicionar nota "Entrada: DD/MM/AAAA ou YYYY-MM-DD. Saida (listagens/webhooks): ISO 8601"
- Linha ~1818 FAQ: atualizar resposta com a nota bidirecional

### 1.4 Changelog v2.2.0
- Adicionar entrada no array de changelog com todas as mudanças

## Bloco 2 — SDK TypeScript (generateTsSDK)

### 2.1 Classes de erro tipadas
Adicionar `HuggsAPIError`, `HuggsValidationError`, `HuggsAuthError`, `HuggsConflictError`, `HuggsRateLimitError` antes da classe

### 2.2 _request com erros tipados + timeout 30s
Reescrever com `AbortController`, switch por status code

### 2.3 Campos faltantes
- `CpIncluirPayload`: adicionar `chave_nfe`
- `CrIncluirPayload`: adicionar `observacao`, `numero_pedido`, `numero_contrato`, `numero_ordem_servico`

### 2.4 PaginatedResponse separado
Criar `PaginatedCpResponse` e `PaginatedCrResponse`

### 2.5 Interfaces de resposta tipadas
Adicionar `ClienteResponse`, `ContaCorrenteResponse`, `BoletoResponse`, `EmpresaResponse`, `WebhookSubscriptionResponse`. Eliminar `Promise<any>`

### 2.6 fetchAllPages
Adicionar metodo de paginacao automatica

### 2.7 Endpoints faltantes
Fornecedores, Categorias, Plano de Contas, Portadores, Departamentos, Projetos + `FornecedorPayload`

### 2.8 Comentarios de convencao POST + versao/metadata no cabecalho

## Bloco 3 — SDK Python (generatePySDK)

### 3.1 Campos faltantes
- `CpIncluirPayload`: `numero_documento_fiscal`, `chave_nfe`
- `CrIncluirPayload`: `observacao`, `numero_pedido`, `numero_contrato`, `numero_ordem_servico`

### 3.2 Dataclasses para CR
`CrAlterarPayload`, `CrUpsertPayload`, `CrRecebimentoPayload`, `CrCancelarRecebimentoPayload`

### 3.3 Campo webhook: `eventos` -> `events`

### 3.4 Retry com backoff exponencial (`_request_with_retry`)

### 3.5 Endpoints faltantes (mesmos do TS)

### 3.6 Versao/metadata no cabecalho

## Bloco 4 — SDK JavaScript (generateJsSDK)

### 4.1 _request com tratamento de erro + timeout 30s
### 4.2 JSDoc em todos os metodos
### 4.3 fetchAllPages
### 4.4 Endpoints faltantes (Fornecedores, Categorias, Portadores, etc.)
### 4.5 Empresas (ausente no JS)
### 4.6 Versao/metadata no cabecalho

## Detalhes Tecnicos

- Todo o codigo dos SDKs e gerado como string dentro de funcoes JS no `SdkDownloadButtons.tsx`
- As funcoes `generateTsSDK()`, `generateJsSDK()`, `generatePySDK()` serao reescritas com o conteudo completo
- A data de geracao e a versao do SDK serao inseridas dinamicamente
- Nenhum arquivo fora dos 2 listados sera modificado

