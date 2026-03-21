# API Contas Correntes — Documentação Completa

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-correntes-api`

## Autenticação

Todas as requisições exigem **API Key** ou **JWT**:
- `x-api-key: SUA_CHAVE` (ERP/server-to-server)
- `Authorization: Bearer <token>` (usuários autenticados)

---

## Endpoints

### GET / — Listar Contas Correntes (Paginado)

Equivalente Huggs: `ListarContasCorrentes`

```
GET /contas-correntes-api/?pagina=1&registros_por_pagina=100
```

**Query Parameters:**
| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `pagina` | integer | 1 | Número da página |
| `registros_por_pagina` | integer | 100 | Registros por página (máx 500) |
| `apenas_importado_api` | string | N | Filtrar apenas importados pela API (S/N) |
| `filtrar_apenas_ativo` | string | S | Filtrar apenas contas ativas (S/N) |
| `ordenar_por` | string | nome | Campo de ordenação |
| `ordem_descendente` | string | N | Ordenação descendente (S/N) |

**Resposta:**
```json
{
  "pagina": 1,
  "total_de_paginas": 3,
  "registros": 100,
  "total_de_registros": 250,
  "ListarContasCorrentes": [
    {
      "nCodCC": 12345,
      "cCodCCInt": "MyCC0001",
      "tipo_conta_corrente": "CC",
      "codigo_banco": "341",
      "descricao": "Conta Principal Itaú",
      "codigo_agencia": "1234",
      "numero_conta_corrente": "56789-0",
      "saldo_inicial": 10000.00,
      "valor_limite": 50000.00,
      "pix_sn": "S",
      "bol_sn": "N"
    }
  ],
  "meta": { "duration_ms": 45, "processed_at": "2026-03-21T..." }
}
```

---

### GET /resumo — Listagem Resumida

Equivalente Huggs: `ListarResumoContasCorrentes`

```
GET /contas-correntes-api/resumo?pagina=1&registros_por_pagina=100
```

---

### GET /consultar — Consultar Conta Corrente

Equivalente Huggs: `ConsultarContaCorrente`

```
GET /contas-correntes-api/consultar?cCodCCInt=MyCC0001
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | UUID | ID interno |
| `cCodCCInt` | string | Código de integração |
| `nCodCC` | integer | Código numérico Huggs |

*Informe pelo menos um dos três.*

---

### POST /incluir — Incluir Conta Corrente

Equivalente Huggs: `IncluirContaCorrente`

```json
POST /contas-correntes-api/incluir
{
  "cCodCCInt": "MyCC0001",
  "tipo_conta_corrente": "CC",
  "codigo_banco": "341",
  "descricao": "Conta Principal Itaú",
  "codigo_agencia": "1234",
  "numero_conta_corrente": "56789-0",
  "saldo_inicial": 10000.00,
  "pix_sn": "S"
}
```

**Resposta:**
```json
{
  "nCodCC": null,
  "cCodCCInt": "MyCC0001",
  "cCodStatus": "0",
  "cDesStatus": "Conta corrente incluída com sucesso"
}
```

---

### PUT /alterar — Alterar Conta Corrente

Equivalente Huggs: `AlterarContaCorrente`

```json
PUT /contas-correntes-api/alterar
{
  "cCodCCInt": "MyCC0001",
  "descricao": "Conta Itaú Atualizada",
  "valor_limite": 75000.00
}
```

---

### DELETE /excluir — Excluir (Inativar) Conta Corrente

Equivalente Huggs: `ExcluirContaCorrente`

```
DELETE /contas-correntes-api/excluir?cCodCCInt=MyCC0001
```

*Soft delete: marca `ativo = false`.*

---

### POST /upsert — Upsert Unitário

Equivalente Huggs: `UpsertContaCorrente`

```json
POST /contas-correntes-api/upsert
{
  "cCodCCInt": "MyCC0001",
  "tipo_conta_corrente": "CC",
  "codigo_banco": "341",
  "descricao": "Conta Itaú",
  "saldo_inicial": 10000.00
}
```

Cria se não existir, atualiza se já existir (por `cCodCCInt`).

---

### POST /upsert-lote — Upsert em Lote

Equivalente Huggs: `UpsertContaCorrentePorLote`

```json
POST /contas-correntes-api/upsert-lote
{
  "lote": 1,
  "fin_conta_corrente_cadastro": [
    {
      "cCodCCInt": "MyCC0001",
      "tipo_conta_corrente": "CX",
      "codigo_banco": "999",
      "descricao": "Caixinha",
      "saldo_inicial": 0
    },
    {
      "cCodCCInt": "MyCC0002",
      "tipo_conta_corrente": "CC",
      "codigo_banco": "341",
      "descricao": "Conta Itaú",
      "saldo_inicial": 5000
    }
  ]
}
```

Máximo: **500 contas por lote**.

---

### POST /sync — Sync Legado

Compatibilidade com fluxo N8N.

```json
POST /contas-correntes-api/sync
{
  "contas": [
    { "cCodCCInt": "CC001", "descricao": "Bradesco", "codigo_banco": "237" }
  ]
}
```

---

### GET /status — Health Check

```
GET /contas-correntes-api/status
```

---

## Tipos de Conta Corrente

| Código | Descrição |
|--------|-----------|
| CC | Conta Corrente |
| CP | Conta Poupança |
| CX | Caixa |
| CI | Conta de Investimento |
| CM | Cartão de Crédito (Administradora) |
| PI | PIX |

---

## Códigos de Erro

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `CAMPO_OBRIGATORIO` | Campo obrigatório ausente |
| 400 | `PAYLOAD_INVALIDO` | Payload não é array válido |
| 400 | `ERRO_INCLUSAO` | Erro ao incluir conta |
| 400 | `ERRO_ALTERACAO` | Erro ao alterar conta |
| 400 | `ERRO_UPSERT` | Erro no upsert |
| 401 | `UNAUTHORIZED` | API key ou JWT inválido |
| 404 | `NAO_ENCONTRADO` | Conta não encontrada |
| 413 | `PAYLOAD_EXCEDIDO` | Lote excede 500 itens |
| 429 | `RATE_LIMIT` | Rate limit excedido |
| 500 | `INTERNAL_ERROR` | Erro interno |

---

## Mapa Completo de Rotas

| Método | Rota | Auth | Descrição | Equivalente Huggs |
|--------|------|------|-----------|------------------|
| GET | `/` | Key/JWT | Listar contas (paginado) | ListarContasCorrentes |
| GET | `/resumo` | Key/JWT | Listagem resumida | ListarResumoContasCorrentes |
| GET | `/consultar` | Key/JWT | Consultar por ID/código | ConsultarContaCorrente |
| POST | `/incluir` | Key/JWT | Incluir conta | IncluirContaCorrente |
| PUT | `/alterar` | Key/JWT | Alterar conta | AlterarContaCorrente |
| DELETE | `/excluir` | Key/JWT | Excluir (inativar) | ExcluirContaCorrente |
| POST | `/upsert` | Key/JWT | Upsert unitário | UpsertContaCorrente |
| POST | `/upsert-lote` | Key/JWT | Upsert em lote | UpsertContaCorrentePorLote |
| POST | `/sync` | Key | Sync legado | — |
| GET | `/status` | Key/JWT | Health check | — |
