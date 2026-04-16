

# Correção Completa — 13 Issues de Qualidade SDK/OpenAPI/Documentação

## Escopo

Todos os 13 problemas diagnosticados no SDK, OpenAPI e documentação do Portal ERP.

## Alterações por Arquivo

### 1. `src/components/erp/SdkDownloadButtons.tsx`

**Issue 1 — Paridade JS/PY**: Adicionar os 6 metodos faltantes no JS (`cpConsultar`, `cpQuery`, `cpEstornar`, `cpRegistrarPagamento`, `cpGetPagamentos`, `cpGetParcelas`) e os 6 equivalentes no PY (`cp_consultar`, `cp_query`, `cp_estornar`, `cp_registrar_pagamento`, `cp_get_pagamentos`, `cp_get_parcelas`). Copiar a mesma logica do TS adaptada para cada linguagem.

**Issue 2 — Idempotency JS/PY**: No JS, adicionar `X-Idempotency-Key` via `crypto.randomUUID()` no `_request` para POST/PUT. No PY, adicionar `import uuid` e `str(uuid.uuid4())` no `_request` para POST/PUT.

**Issue 3 — Tipos com `number` errado**: Corrigir `ClienteResponse.codigo_cliente`, `ContaCorrenteResponse.id`, `EmpresaResponse.codigo_empresa` de `number` para `string | number` no TS SDK.

**Issue 6 — Documentar diferença entre metodos**: Adicionar bloco de JSDoc/comentario em cada SDK explicando:
- `cpListar` = paginacao Huggs (pagina/registros) vs `cpQuery` = paginacao REST (limit/offset/cursor)
- `cpLancarPagamento` = baixa estilo Huggs (codigo_lancamento_integracao + valor + data) vs `cpRegistrarPagamento` = registro direto por UUID (conta_pagar_id + valor_pago)
- `cpCancelarPagamento` = desfazer baixa vs `cpEstornar` = estorno parcial/total com motivo

**Issue 10 — Responses tipadas**: Criar interfaces `CpConsultarResponse`, `CpPagamentosResponse`, `CpParcelasResponse` no TS. Substituir `Record<string, unknown>` nos retornos dos 6 novos metodos.

**Issue 11 — Validacoes locais**: Adicionar `_validate` em `cpConsultar` (ao menos 1 param obrigatorio), `cpEstornar` (ja tem no TS mas falta no JS/PY), `cpRegistrarPagamento` (ja tem no TS mas falta no JS/PY).

**Issue 12 — Idioma consistente**: Padronizar todas as mensagens de validacao e erro para portugues (BR) em todos os 3 SDKs. O SDK e brasileiro, mensagens em PT-BR.

**Issue 13 — Formato de datas**: Adicionar comentario JSDoc em cada campo de data: "Entrada aceita DD/MM/AAAA ou YYYY-MM-DD. Respostas sempre retornam YYYY-MM-DD (ISO 8601)."

**Issue 8 — Exemplos de payload completo**: Expandir o bloco de exemplo no rodape de cada SDK com payloads completos para `cpIncluir`, `cpUpsert`, `cpLancarPagamento`, mostrando todos os campos opcionais.

**Issue 9 — Quick Start**: Adicionar bloco "QUICK START — 5 MINUTOS" no topo de cada SDK com: 1) Instanciar, 2) Health check, 3) Incluir titulo, 4) Listar, 5) Lancar pagamento.

### 2. `src/components/erp/ApiDocumentation.tsx`

**Issue 4 — Exemplos com number**: Substituir nos body examples:
- `codigo_cliente_fornecedor: 12345` → `"2d3d20ef-..."`
- `codigo_cliente_fornecedor: 67890` → `"a1b2c3d4-..."`
- `empresa_id: 5` → `"abc12345-..."`
Linhas afetadas: ~161, 181, 188, 282, 283, e endpoints de fornecedores-sync.

**Issue 5 — Response como string**: No `erpExportPushCrud` (linha ~523), garantir que o campo `response` use JSON valido que sera parseado como objeto, nao string.

**Issue 7 — Documentar quando usar cada metodo**: Adicionar secao "Guia de Uso" no header da API de Contas a Pagar com tabela comparativa dos metodos.

### 3. `docs/API_CONTAS_PAGAR.md`

**Issue 7/8/9/13**: Adicionar secoes "Quick Start", "Quando usar cada metodo", "Exemplos completos de payload", "Formato de datas (ISO 8601)".

## Impacto

- Paridade 100% entre TS, JS e Python — zero impressao de SDK de segunda classe
- Idempotencia funciona em todas as linguagens
- Tipos corretos previnem bugs de integracao
- Dev senior abre qualquer SDK e tem experiencia identica
- Quick Start reduz tempo de onboarding de horas para 5 minutos

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | Issues 1-3, 6, 8-13 |
| `src/components/erp/ApiDocumentation.tsx` | Issues 4, 5, 7 |
| `docs/API_CONTAS_PAGAR.md` | Issues 7, 8, 9, 13 |

