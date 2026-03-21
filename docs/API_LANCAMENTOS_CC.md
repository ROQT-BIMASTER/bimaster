# API Lançamentos de Conta Corrente

API REST para gestão de lançamentos de conta corrente, seguindo o padrão Huggs.

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/lancamentos-cc-api`

**Autenticação:** Header `x-api-key` com chave válida do Portal de Integração.

---

## Endpoints

### GET / — ListarLancCC

Lista lançamentos de conta corrente com paginação e filtros.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nPagina` | integer | Não | Número da página (default: 1) |
| `nRegPorPagina` | integer | Não | Registros por página (default: 20, máx: 500) |
| `cOrdenarPor` | string | Não | Campo de ordenação: `created_at`, `data_lancamento`, `valor`, `n_cod_lanc` |
| `cOrdemDecrescente` | string | Não | "S" para ordem decrescente |
| `cOrigem` | string | Não | Filtro por origem: MANU, CONP, CONR, TRAN, etc. |
| `nCodCC` | integer | Não | Filtro por código da conta corrente (Huggs) |
| `dDtIncDe` | date | Não | Data de inclusão inicial |
| `dDtIncAte` | date | Não | Data de inclusão final |
| `dDtAltDe` | date | Não | Data de alteração inicial |
| `dDtAltAte` | date | Não | Data de alteração final |
| `dtPagInicial` | date | Não | Data do lançamento inicial |
| `dtPagFinal` | date | Não | Data do lançamento final |

**Exemplo de Request:**
```bash
curl -H "x-api-key: SUA_CHAVE" \
  "BASE_URL/?nPagina=1&nRegPorPagina=20"
```

**Resposta:**
```json
{
  "nPagina": 1,
  "nTotPaginas": 5,
  "nRegistros": 20,
  "nTotRegistros": 95,
  "listaLancamentos": [
    {
      "nCodLanc": 12345,
      "cCodIntLanc": "LANC001",
      "cabecalho": { "nCodCC": 427619317, "dDtLanc": "2026-03-21", "nValorLanc": 123.46 },
      "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN", "nCodCliente": 2485994, "cObs": "..." },
      "transferencia": { "nCodCCDestino": null },
      "departamentos": [],
      "diversos": { "cOrigem": "MANU", "cNatureza": "D" },
      "info": { "dInc": "2026-03-21", "cImpAPI": "S" }
    }
  ]
}
```

---

### GET /consultar — ConsultaLancCC

Consulta um lançamento específico.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid | Condicional | ID interno |
| `cCodIntLanc` | string | Condicional | Código de integração |
| `nCodLanc` | integer | Condicional | Código numérico Huggs |

Pelo menos um dos três parâmetros é obrigatório.

**Resposta:**
```json
{
  "lancamento": {
    "nCodLanc": 12345,
    "cCodIntLanc": "LANC001",
    "cabecalho": { ... },
    "detalhes": { ... },
    "transferencia": { ... },
    "departamentos": [],
    "diversos": { ... },
    "info": { ... }
  }
}
```

---

### POST /incluir — IncluirLancCC

Inclui um novo lançamento.

**Body:**
```json
{
  "cCodIntLanc": "1774116398",
  "cabecalho": {
    "nCodCC": 427619317,
    "dDtLanc": "21/03/2026",
    "nValorLanc": 123.46
  },
  "detalhes": {
    "cCodCateg": "1.01.02",
    "cTipo": "DIN",
    "nCodCliente": 2485994,
    "cObs": "Referente a jardinagem executada na matriz"
  }
}
```

**Resposta (201):**
```json
{
  "nCodLanc": null,
  "cCodIntLanc": "1774116398",
  "cCodStatus": "0",
  "cDesStatus": "Lançamento incluído com sucesso"
}
```

---

### PUT /alterar — AlterarLancCC

Altera um lançamento existente.

**Body:**
```json
{
  "cCodIntLanc": "1774116398",
  "cabecalho": {
    "nCodCC": 427619317,
    "dDtLanc": "22/03/2026",
    "nValorLanc": 200.00
  },
  "detalhes": {
    "cObs": "Valor corrigido"
  }
}
```

**Resposta:**
```json
{
  "nCodLanc": 12345,
  "cCodIntLanc": "1774116398",
  "cCodStatus": "0",
  "cDesStatus": "Lançamento alterado com sucesso"
}
```

---

### DELETE /excluir — ExcluirLancCC

Exclui (inativa) um lançamento.

**Query Parameters:** `id`, `cCodIntLanc` ou `nCodLanc` (pelo menos um obrigatório).

**Resposta:**
```json
{
  "nCodLanc": 12345,
  "cCodIntLanc": "1774116398",
  "cCodStatus": "0",
  "cDesStatus": "Lançamento excluído com sucesso"
}
```

---

### POST /upsert — UpsertLancCC

Cria ou atualiza um lançamento pelo `cCodIntLanc`.

**Body:** Mesmo formato do `/incluir`. `cCodIntLanc` é obrigatório.

---

### POST /upsert-lote — UpsertLancCCPorLote

Upsert em lote (máx 500 lançamentos).

**Body:**
```json
{
  "lote": 1,
  "lancamentos": [
    {
      "cCodIntLanc": "LANC001",
      "cabecalho": { "nCodCC": 427619317, "dDtLanc": "21/03/2026", "nValorLanc": 100 },
      "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN", "cObs": "Pagamento" }
    }
  ]
}
```

**Resposta:**
```json
{
  "lote": 1,
  "cCodStatus": "0",
  "cDesStatus": "1 processado(s), 0 erro(s)",
  "total_processados": 1,
  "total_erros": 0
}
```

---

### POST /sync — Sync Legado (N8N)

Sincroniza lançamentos vindos de integração N8N.

**Body:**
```json
{
  "lancamentos": [
    { "cCodIntLanc": "LANC001", "cabecalho": { ... }, "detalhes": { ... } }
  ]
}
```

---

### GET /status — Health Check

Retorna status da API.

```json
{ "status": "online", "service": "lancamentos-cc-api", "empresa_id": "8" }
```

---

## Tipos Complexos

### cabecalho
| Campo | Tipo | Descrição |
|---|---|---|
| `nCodCC` | integer | Código da conta corrente (Huggs) |
| `dDtLanc` | string(10) | Data do lançamento (dd/mm/yyyy ou yyyy-mm-dd) |
| `nValorLanc` | decimal | Valor do lançamento |

### detalhes
| Campo | Tipo | Descrição |
|---|---|---|
| `cCodCateg` | string(20) | Código da categoria |
| `aCodCateg` | array | Rateio de categorias |
| `cTipo` | string(5) | Tipo de documento (DIN, CHQ, DOC, TED, PIX) |
| `cNumDoc` | string(20) | Número do documento |
| `nCodCliente` | integer | Código do cliente/favorecido |
| `nCodProjeto` | integer | Código do projeto |
| `cObs` | text | Observações |

### transferencia
| Campo | Tipo | Descrição |
|---|---|---|
| `nCodCCDestino` | integer | Código da conta corrente destino |

### departamentos (array)
| Campo | Tipo | Descrição |
|---|---|---|
| `cCodDep` | string(40) | Código do departamento |
| `nValDep` | decimal | Valor do departamento |
| `nPerDep` | decimal | Percentual do departamento |

### diversos
| Campo | Tipo | Descrição |
|---|---|---|
| `cOrigem` | string(4) | Origem: MANU, CONP, CONR, TRAN, DEVO, AJUR |
| `dDtConc` | string(10) | Data da conciliação |
| `cHrConc` | string(8) | Hora da conciliação |
| `cUsConc` | string(10) | Usuário da conciliação |
| `nCodVendedor` | integer | Código do vendedor |
| `nCodComprador` | integer | Código do comprador |
| `cNatureza` | string(1) | Natureza: C (Crédito) ou D (Débito) |
| `cIdentLanc` | string(40) | Identificação do extrato importado |
| `nCodLancCP` | integer | Código do lançamento de Contas a Pagar vinculado |
| `nCodLancCR` | integer | Código do lançamento de Contas a Receber vinculado |

### info
| Campo | Tipo | Descrição |
|---|---|---|
| `dInc` | string(10) | Data de inclusão |
| `hInc` | string(8) | Hora de inclusão |
| `uInc` | string(10) | Usuário de inclusão |
| `dAlt` | string(10) | Data de alteração |
| `hAlt` | string(8) | Hora de alteração |
| `uAlt` | string(10) | Usuário de alteração |
| `cImpAPI` | string(1) | Importado pela API (S/N) |

---

## Códigos de Erro

| Código | Descrição |
|---|---|
| 400 | Parâmetros inválidos ou obrigatórios ausentes |
| 401 | Chave API inválida ou ausente |
| 404 | Lançamento ou rota não encontrada |
| 429 | Rate limit excedido (60 req/min) |
| 500 | Erro interno do servidor |

---

**Última atualização:** 2026-03-21  
**Versão:** 1.0.0
