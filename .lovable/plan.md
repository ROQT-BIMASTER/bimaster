

# Correções v2.5.0 → v2.6.0: Patches do Parecer Técnico

## Diagnóstico

O parecer subiu a nota de 6.0 → 7.5 e identificou **1 blocker crítico** + **5 ajustes finos** para chegar a GA (9.0).

## Escopo das correções

### Blocker (resolver antes de qualquer pagamento real)

**1. `X-Idempotency-Key` regenerada a cada retry** — destrói a propriedade de idempotência justamente quando ela mais importa (timeout/5xx onde o servidor já processou).

**Correção:** mover a geração da chave para fora do loop de retry. Nos 3 SDKs (TS/JS/Python):
- `_request_with_retry` gera UUID **uma vez** e passa para `_request` como parâmetro.
- `_request` aceita `idempotency_key` opcional; só gera novo se não vier.
- Permitir que o usuário passe chave externa (ex: derivada de `codigo_lancamento_integracao`) para idempotência cross-session.

### Ajustes finos

**2. URL encoding ausente no SDK Python** — CNPJ formatado `12.345.678/0001-90` quebra o path. Aplicar `urllib.parse.quote` / `urlencode` em:
- `cp_excluir`, `cp_consultar`, `cp_listar`, `cp_query`
- `fornecedores_consultar` (caso crítico do CNPJ)

**3. Tipo de retorno do `cpQuery` em TS errado** — declara `CpPagamentosResponse` mas retorna títulos. Criar `CpQueryResponse` dedicado com shape correto.

**4. Exemplos de data inconsistentes** — intro diz "ISO 8601 preferencial", mas exemplos de `/incluir`, `/alterar`, `/upsert`, `/lancar-pagamento` usam `21/03/2026`. Padronizar exemplos canônicos para ISO `2026-03-21`.

**5. Enums declarados mas não usados** — `WebhookSubscribePayload.events` continua `List[str]`. Tipar como `List[WebhookEvent]`. Mesmo para `CategoriaPayload.tipo` → `TipoCategoria`.

**6. Ambiguidade do `empresa_id` em `/upsert`** — OpenAPI declara como query `required: true` e também no body. Resolver: remover do query (o backend já aceita no body via `UpsertSchema`). Ajustar OpenAPI para refletir comportamento real.

### Não-escopo (debt arquitetural, manter como está)

- Duplicação semântica CP (`lancar` vs `registrar`, `cancelar` vs `estornar`): já documentada no guia inline, deprecar formal exige timeline acordado com clientes.
- Suíte de testes unitários: trabalho separado, não cabe nesta rodada.
- `CpUpsertPayload` herdando com default `""`: validação runtime já pega; reescrever exigiria pydantic.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | TS/JS/Python SDKs: idempotency key fora do retry, aceitar chave externa, URL encoding Python, tipo `CpQueryResponse`, enums tipados |
| `src/components/erp/ApiDocumentation.tsx` | Exemplos de data → ISO 8601, remover `empresa_id` query do `/upsert`, bump versão 3.2.0 → 3.3.0, changelog |

## Versão final

SDKs: **v2.5.0 → v2.6.0** • OpenAPI: **3.2.0 → 3.3.0**

Esperado pelo parecer: subir de 7.5 → ~8.5 (faltariam só testes unitários e deprecation formal de família CP para chegar a GA 9.0).

