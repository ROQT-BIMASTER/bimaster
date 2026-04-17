

# Correções v2.7.0 → v2.8.0: Equalizar CR com CP + Lote + TypedDicts de Escrita

## Diagnóstico

Parecer subiu 8.0 → 8.5. Restam 3 ajustes acionáveis para fechar paridade CP/CR e completar tipagem Python. Testes unitários continuam fora de escopo (debt consciente já reconhecido).

## Escopo

### 1. Equalizar Contas a Receber com Contas a Pagar (item #1 do parecer — maior dívida)

**Problema:** Toda a evolução v2.6/v2.7 foi para CP. CR ficou estagnado em v2.5.0 — mesma criticidade financeira, sem retry idempotente, sem família moderna, com bug de URL encoding já corrigido em CP.

**Correção (TS/JS/Python):**

a) **Promover retry público nos métodos financeiros CR** — mesma assinatura de CP:
- `crIncluir`, `crAlterar`, `crUpsert`, `crExcluir`
- `crLancarRecebimento`, `crCancelarRecebimento`
- TS/JS: `options?: { retry?: boolean; idempotencyKey?: string }`
- Python: `*, retry: bool = False, idempotency_key: Optional[str] = None`

b) **Adicionar família moderna CR** (paridade com cpConsultar/cpQuery/etc):
- `crConsultar(params)` → busca por id/código integração/código huggs
- `crQuery(filtros)` → query flexível de títulos
- `crGetRecebimentos(crId)` → lista baixas de um título
- `crGetParcelas(crId)` → lista parcelas

c) **Corrigir URL encoding no Python CR** — aplicar `urllib.parse.quote`/`urlencode` em:
- `cr_listar` (atual `qs += f"&{k}={v}"` quebra com `/` ou `&`)
- `cr_consultar`, `cr_query`, `cr_excluir`, `cr_get_recebimentos`, `cr_get_parcelas`
- `clientes_consultar` se passar CPF/CNPJ formatado

### 2. Promover retry no `cpUpsertLote` e `crUpsertLote` (item #2)

**Problema:** Lote de até 500 títulos é onde timeout é mais provável e retry não-idempotente mais perigoso (pode duplicar centenas de registros).

**Correção:**
- Adicionar `options { retry, idempotencyKey }` em `cpUpsertLote`
- Criar/promover `crUpsertLote` com mesmo padrão
- Documentar no guia inline: "para lotes >100 registros, usar `retry=true` + `idempotencyKey` derivada de `lote_id` ou hash do payload"

### 3. TypedDicts para respostas de mutation Python (item #3)

**Problema:** `cp_incluir`, `cp_upsert`, `cp_lancar_pagamento`, `cp_upsert_lote` retornam `Dict[str, Any]`. TS já tem `MutationResponse`, `PagamentoResponse`, `LoteResponse` como interfaces.

**Correção:** Adicionar TypedDicts em Python (espelhando TS):
- `CpMutationResponse` (codigo_lancamento_huggs, codigo_lancamento_integracao, codigo_status, descricao_status)
- `CpPagamentoResponse` (codigo_baixa, liquidado, valor_baixado, codigo_status, descricao_status)
- `CpLoteResponse` (lote, total_processados, sucesso, falhas, detalhes)
- Espelhar para CR: `CrMutationResponse`, `CrRecebimentoResponse`, `CrLoteResponse`
- Atualizar assinaturas de retorno em todos os métodos correspondentes

### 4. Nota OpenAPI sobre idempotência (item #5 — recomendação leve)

**Correção:** Adicionar nota explícita na descrição dos endpoints financeiros (`/lancar-pagamento`, `/lancar-recebimento`, `/upsert`, `/upsert-lote`) na geração do OpenAPI: *"Strongly recommended: enviar `X-Idempotency-Key` para evitar processamento duplicado em caso de timeout."*

### 5. Bump versão e changelog

- SDKs: **v2.7.0 → v2.8.0**
- OpenAPI: **3.3.0 → 3.4.0** (apenas notas descritivas, sem mudança de contrato)
- Changelog em `ApiDocumentation.tsx`: paridade CP/CR completa, retry em lote, TypedDicts de escrita

## Não-escopo (debt consciente)

- **Testes unitários** (item #4): mantém fora — gerador de SDK em string não comporta suíte de teste real sem infra dedicada.
- **Deprecation formal família CP duplicada**: timeline ainda não acordado.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | TS/JS/Python: retry público em CR (incluir/alterar/upsert/excluir/lancar/cancelar), família moderna CR (consultar/query/get_recebimentos/get_parcelas), URL encoding Python CR, retry em cp/cr_upsert_lote, TypedDicts de mutation Python, guia inline atualizado, bump v2.8.0 |
| `src/components/erp/ApiDocumentation.tsx` | Nota "strongly recommended" sobre X-Idempotency-Key nos endpoints financeiros, changelog v3.4.0 |

## Impacto esperado

Parecer subir de 8.5 → ~9.0 (GA com escopo completo). Faltariam só testes unitários e deprecation plan formal — itens explicitamente fora de rodada.

