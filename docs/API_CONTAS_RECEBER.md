# API Contas a Receber — Documentação Completa v4.3.0

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api`

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 4.3.0 | 2026-04-18 | **PR-17**: 3 handlers reais adicionados — `/query` (cursor+offset), `/parcelas`, `/recebimentos`. Antes retornavam 404 para chamadas dos SDKs. CR API_VERSION 1.3.0 → 1.4.0. Paridade total com CP API. |
| 4.0.0 | 2026-04-17 | **BREAKING**: removidos `/listar`, `/alterar`, `/cancelar-recebimento`. Use `/query`, `/upsert`, `/estornar` |
| 2.4.0 | 2026-04 | Idempotência, transações atômicas, rate limiting global, cursor pagination |
| 2.0.0 | 2026-02 | Endpoints de integração Huggs |

---

## Autenticação

Todas as requisições exigem **API Key** ou **JWT**:
- `x-api-key: SUA_CHAVE` (ERP/server-to-server)
- `Authorization: Bearer <token>` (usuários autenticados)

---

## Rotas Integração

### GET /consultar — ConsultarContaReceber

```
GET /contas-receber-api/consultar?codigo_lancamento_integracao=INT-001
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | UUID | ID interno |
| `codigo_lancamento_integracao` | string | Código de integração |
| `codigo_lancamento_huggs` | integer | Código numérico Huggs |

### POST /incluir — IncluirContaReceber

```json
{
  "codigo_lancamento_integracao": "CR-001",
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "1.01.02",
  "data_previsao": "21/03/2026",
  "id_conta_corrente": 4243124
}
```

**Resposta:**
```json
{
  "codigo_lancamento_huggs": null,
  "codigo_lancamento_integracao": "CR-001",
  "codigo_status": "0",
  "descricao_status": "Cadastro incluído com sucesso!"
}
```

### DELETE /excluir — ExcluirContaReceber

```
DELETE /contas-receber-api/excluir?codigo_lancamento_integracao=CR-001
```

### POST /upsert — UpsertContaReceber

Substitui o legado `PUT /alterar` removido em v4.0.0. Use sempre `/upsert` para criar ou atualizar idempotentemente.

```json
{
  "codigo_lancamento_integracao": "CR-001",
  "empresa_id": 8,
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "1.01.02"
}
```

### POST /upsert-lote — UpsertContaReceberPorLote

```json
{
  "lote": 1,
  "conta_receber_cadastro": [
    { "codigo_lancamento_integracao": "CR-001", "empresa_id": 8, "valor_documento": 100 }
  ]
}
```

Máximo: **500 registros por lote**.

### POST /lancar-recebimento — LancarRecebimento

```json
{
  "codigo_lancamento_integracao": "CR-001",
  "valor": 100.20,
  "desconto": 0,
  "juros": 0,
  "multa": 0,
  "data": "21/03/2026",
  "observacao": "Baixa via API"
}
```

**Resposta:**
```json
{
  "codigo_lancamento_integracao": "CR-001",
  "codigo_baixa": "uuid",
  "liquidado": "S",
  "valor_baixado": 100.20,
  "codigo_status": "0",
  "descricao_status": "Recebimento registrado com sucesso!"
}
```

### POST /conciliar — ConciliarRecebimento

```json
{ "codigo_baixa": 0 }
```

### POST /desconciliar — DesconciliarRecebimento

```json
{ "codigo_baixa": 0 }
```

### POST /cancelar — CancelarContaReceber

```json
{ "chave_lancamento": 0 }
```

### POST /estornar — EstornarContaReceber

Estorna um título (reversão lógica). Substitui o legado `POST /cancelar-recebimento` removido em v4.0.0.
Registra motivo de auditoria e marca status como `Estornado`. Não permitido para títulos `Liquidado`,
`Cancelado` ou já `Estornado`.

```json
{
  "nCodTitulo": "uuid-do-titulo",
  "cMotivo": "Devolução solicitada pelo cliente"
}
```

Aceita também `codigo_lancamento_integracao` no lugar de `nCodTitulo`.

**Resposta 200:**
```json
{
  "codigo_lancamento_integracao": "CR-001",
  "nCodTitulo": "uuid",
  "codigo_status": "0",
  "descricao_status": "Título estornado com sucesso!"
}
```

**Códigos de erro:**
| HTTP | codigo_status | Cenário |
|------|---------------|---------|
| 400  | 3             | Título Liquidado / Cancelado / já Estornado |
| 404  | 1             | Título não encontrado |
| 400  | —             | Payload inválido (Zod) |

### GET /query — Consulta unificada (substitui /listar)

Único método de listagem em v4.0.0. Suporta cursor pagination + offset.

```
GET /contas-receber-api/query?status=pendente&limit=20
```

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `status` | string | — | Status (vírgula para múltiplos) |
| `vencimento_de` | date | — | Vencimento inicial (YYYY-MM-DD) |
| `vencimento_ate` | date | — | Vencimento final (YYYY-MM-DD) |
| `cliente_codigo` | string | — | Código do cliente |
| `limit` | integer | 100 | Máx registros (1-1000) |
| `offset` | integer | 0 | Paginação offset |
| `cursor` | uuid | — | ID para cursor pagination |
| `order_by` | string | data_vencimento | Campo de ordenação |
| `order_dir` | string | — | `asc` ou `desc` |

**Resposta 200:**
```json
{
  "data": [ /* títulos */ ],
  "pagination": { "total": 100, "limit": 20, "offset": 0, "has_more": true },
  "meta": { "processed_at": "...", "request_id": "..." }
}
```

### GET /parcelas — Parcelas de um título CR (PR-17)

Consulta as parcelas de um título a receber. Retorna `[]` quando o título ainda não tem parcelas registradas.

```
GET /contas-receber-api/parcelas?conta_receber_id=<uuid>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `conta_receber_id` | uuid | sim | ID do título CR |
| `limit` | integer | não | 1-1000 (default 100) |
| `offset` | integer | não | default 0 |

**Resposta 200:** `{ data: [], pagination: { total, limit, offset, has_more }, meta: {...} }`

### GET /recebimentos — Histórico de recebimentos (PR-17)

Lista as baixas (recebimentos) registradas para um título CR.

```
GET /contas-receber-api/recebimentos?conta_receber_id=<uuid>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `conta_receber_id` | uuid | sim | ID do título CR |
| `limit` | integer | não | 1-1000 (default 100) |
| `offset` | integer | não | default 0 |

**Resposta 200:** `{ data: [], pagination: { total, limit, offset, has_more }, meta: {...} }`

---

## Endpoints Legados (Sync)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/sync` | Sync legado (compatibilidade N8N) |
| POST | `/bulk-sync` | Sync em massa |
| POST | `/sync-chunk` | Sync chunk |
| GET | `/sync-status` | Status da sync |
| POST | `/delete-old` | Limpar registros antigos |

---

## Campos Tributários (Impostos Retidos)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `valor_pis` | decimal | Valor do PIS |
| `retem_pis` | boolean | Reter PIS |
| `valor_cofins` | decimal | Valor do COFINS |
| `retem_cofins` | boolean | Reter COFINS |
| `valor_csll` | decimal | Valor CSLL |
| `retem_csll` | boolean | Reter CSLL |
| `valor_ir` | decimal | Valor IR |
| `retem_ir` | boolean | Reter IR |
| `valor_iss` | decimal | Valor ISS |
| `retem_iss` | boolean | Reter ISS |
| `valor_inss` | decimal | Valor INSS |
| `retem_inss` | boolean | Reter INSS |

## Campos Boleto

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `boleto_gerado` | boolean | Gerou boleto |
| `boleto_numero` | string(30) | Número do boleto |
| `boleto_numero_bancario` | string(30) | Número bancário |
| `boleto_per_juros` | decimal | % juros |
| `boleto_per_multa` | decimal | % multa |

## Rateios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rateio_categorias` | JSONB | Rateio por categorias |
| `rateio_departamentos` | JSONB | Distribuição por departamentos |

---

## Mapa Completo de Rotas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/` | JWT | Listar últimos 100 títulos |
| GET | `/consultar` | JWT/Key | Consultar por ID/código integração (Huggs) |
| GET | `/query` | JWT/Key | Consulta unificada (cursor + offset) |
| GET | `/parcelas` | JWT/Key | Parcelas de um título (PR-17) |
| GET | `/recebimentos` | JWT/Key | Histórico de recebimentos (PR-17) |
| GET | `/sync-status` | Key | Status da sync |
| POST | `/sync` | Key | Sync legado |
| POST | `/bulk-sync` | Key | Sync em massa |
| POST | `/sync-chunk` | Key | Sync chunk |
| POST | `/incluir` | JWT/Key | Incluir título (Huggs) |
| POST | `/upsert` | JWT/Key | Upsert unitário (substitui /alterar) |
| POST | `/upsert-lote` | JWT/Key | Upsert em lote (Huggs) |
| POST | `/lancar-recebimento` | JWT/Key | Baixa Integração |
| POST | `/conciliar` | JWT/Key | Conciliar recebimento |
| POST | `/desconciliar` | JWT/Key | Desconciliar recebimento |
| POST | `/cancelar` | JWT/Key | Cancelar título |
| POST | `/estornar` | JWT/Key | Estornar título (substitui /cancelar-recebimento) |
| POST | `/delete-old` | Key | Limpar antigos |
| DELETE | `/excluir` | JWT/Key | Excluir título (Huggs) |
