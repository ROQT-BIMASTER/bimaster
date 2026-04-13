
# Correção Total v2.3.0 — Deploy de Produção

## Escopo: 3 arquivos

| Arquivo | Alterações |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Blocos 1-3, 7, 9 — glossários, pré-condições, badges "Em Desenvolvimento", changelog |
| `src/components/erp/SdkDownloadButtons.tsx` | Blocos 4-5, 8 — warnings, campos, retry, paridade, botões npm/pip |
| `supabase/functions/api-sandbox/index.ts` | Bloco 6 — mocks mais realistas com campos exatos da produção |

## Bloco 1 — Documentação (já parcialmente correto)

### 1.1 Versionamento
Ambas as seções (linha ~1228 e ~2163) já dizem "90 dias + 6 meses". Confirmarei e padronizarei o texto idêntico incluindo "Campos novos podem ser adicionados a qualquer momento".

### 1.2 Webhooks FAQ
Linha ~2249 já usa `conta_pagar.criado`. Atualizarei para incluir `/incluir` em vez de `/subscribe` e mencionar "25 eventos".

### 1.3 Formato de data
Linhas 1471 e 1505 já têm a nota bidirecional. Adicionarei "ATENÇÃO: O formato de entrada e saída são diferentes".

## Bloco 2 — 4 Novos Glossários no Portal

Após o glossário de Fornecedores (linha ~1559), adicionar:
- **Clientes /incluir** — 10 campos com nota sobre cnpj_cpf para upsert
- **Empresas /incluir** — 16 campos com badges "recomendado" e nota sobre estado parcial
- **Categorias /incluir** — 4 campos com nota sobre diferença vs Plano de Contas
- **Contas Correntes /incluir** — 6 campos com nota sobre dados bancários

## Bloco 3 — Pré-condições nos Endpoints

Após os glossários, adicionar box de atenção para:
- CP /lancar-pagamento — status pendente/vencido, id_conta_corrente, pagamentos parciais
- CR /lancar-recebimento — mesmas pré-condições
- Boletos /gerar — CR pendente, CC com dados bancários, portador configurado
- Fornecedores /incluir — nota sobre empresa_ids

## Bloco 4 — Warnings nos SDKs (SdkDownloadButtons.tsx)

### TypeScript
- `WebhookSubscribePayload.secret`: JSDoc warning HMAC
- `EmpresaIncluirPayload`: warnings em cnpj, regime_apuracao, tipo_empresa
- `FornecedorPayload.empresa_ids`: warning funcional
- `ClientePayload.cnpj_cpf`: warning upsert
- `CpLancarPagamentoPayload`: adicionar `id_conta_corrente`
- `CrRecebimentoPayload`: adicionar `id_conta_corrente`
- Criar `CategoriaPayload` tipado, alterar `categoriasIncluir`

### Python
- Mesmos warnings nos docstrings de cada dataclass
- `CpPagamentoPayload` e `CrRecebimentoPayload`: adicionar `id_conta_corrente`
- Criar `CategoriaPayload` dataclass, alterar `categorias_incluir`

### JavaScript
- JSDoc expandido com warnings em `cpLancarPagamento`, `webhookIncluir`, `empresasIncluir`, `fornecedoresIncluir`, `categoriasIncluir`, `boletoGerar`

## Bloco 5 — Paridade Final

- **Python**: adicionar `clientes_alterar` (falta, TS/JS já têm)
- **TypeScript**: adicionar `_requestWithRetry` (Python já tem)
- **JavaScript**: adicionar `_requestWithRetry` (Python já tem)
- Exemplos de uso atualizados nos 3 SDKs

## Bloco 6 — Sandbox Melhorado (api-sandbox/index.ts)

O sandbox já tem mocks endpoint-specific. Melhorias:
- `mockContasPagar`: campos mais realistas (empresa_id, codigo_categoria, created_at, datas ISO)
- `mockContasReceber`: adicionar numero_pedido, campos de data ISO
- `mockEmpresas`: adicionar incluir/alterar com campos completos
- `mockFornecedores`: diferenciar mock para `fornecedores-sync/incluir`, `alterar`, `upsert`, `listar`
- `mockPortadores`: retornar estrutura com banco_codigo, agencia, conta
- Mock de fallback genérico: retornar path e method explícitos

## Bloco 7 — Badge "Em Desenvolvimento"

Não será possível alterar badges individuais de APIs offline sem identificar quais 7 APIs são — o sistema usa health-check live. Em vez disso, adicionarei uma nota no catálogo explicando que APIs offline estão em desenvolvimento.

## Bloco 8 — Botões npm/pip

Atualizar o componente `SdkDownloadButtons` para exibir instruções de instalação:
```
npm install @bimaster/huggs-erp-sdk
pip install huggs-erp-sdk
```

## Bloco 9 — Changelog v2.3.0

Adicionar entrada completa ao array de changelog com todas as mudanças.

## Detalhes Técnicos

- `SDK_VERSION` atualizado para `"2.3.0"`
- Header dos SDKs: "7 em desenvolvimento"
- Nenhum arquivo fora dos 3 listados será alterado
- Nenhuma lógica de negócio existente será modificada
