# API Orçamento de Caixa (Previsto x Realizado)

Edge Function `orcamentos-caixa-api`, seguindo o padrão Huggs `ListarOrcamentos`.

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/orcamentos-caixa-api`

**Autenticação:** Header `x-api-key` com chave válida do Portal de Integração.

---

## GET /listar — ListarOrcamentos

Retorna orçamento previsto x realizado por categoria para um mês/ano.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nAno` | integer | Sim | Ano do orçamento |
| `nMes` | integer | Sim | Mês (1-12) |

**Exemplo:**
```bash
curl -H "x-api-key: SUA_CHAVE" \
  "BASE_URL/listar?nAno=2026&nMes=3"
```

**Resposta:**
```json
{
  "nAno": 2026,
  "nMes": 3,
  "ListaOrcamentos": [
    {
      "cCodCateg": "2.04.01",
      "cDesCateg": "Serviços Terceiros",
      "nValorPrevisto": 5000.00,
      "nValorRealizado": 3200.50
    }
  ]
}
```

---

## POST /incluir

Cadastra ou atualiza orçamento previsto para uma categoria/mês.

**Body:**
```json
{
  "nAno": 2026,
  "nMes": 3,
  "cCodCateg": "2.04.01",
  "cDesCateg": "Serviços Terceiros",
  "nValorPrevisto": 5000.00
}
```

**Resposta:**
```json
{
  "cCodStatus": "0",
  "cDesStatus": "Orçamento cadastrado/atualizado com sucesso",
  "nAno": 2026,
  "nMes": 3,
  "cCodCateg": "2.04.01",
  "nValorPrevisto": 5000.00
}
```

---

## POST /incluir-lote

Upsert em lote de orçamentos previstos (máx 500 por lote).

**Body:**
```json
{
  "nAno": 2026,
  "nMes": 3,
  "orcamentos": [
    { "cCodCateg": "2.04.01", "cDesCateg": "Serviços Terceiros", "nValorPrevisto": 5000.00 },
    { "cCodCateg": "1.01.02", "cDesCateg": "Vendas de Produtos", "nValorPrevisto": 25000.00 }
  ]
}
```

**Resposta:**
```json
{
  "cCodStatus": "0",
  "cDesStatus": "2 orçamento(s) cadastrado(s)/atualizado(s)",
  "nAno": 2026,
  "nMes": 3,
  "nTotal": 2
}
```

---

## Tipos — ListaOrcamentos

| Campo | Tipo | Descrição |
|---|---|---|
| `cCodCateg` | string(20) | Código da categoria |
| `cDesCateg` | text | Descrição da categoria |
| `nValorPrevisto` | decimal | Valor orçado |
| `nValorRealizado` | decimal | Valor realizado (calculado dos lançamentos) |

---

## Códigos de Erro

| Código | Descrição |
|---|---|
| 400 | Parâmetros obrigatórios ausentes |
| 401 | Chave API inválida ou ausente |
| 429 | Rate limit excedido (60 req/min) |
| 500 | Erro interno do servidor |

---

**Última atualização:** 2026-03-21
**Versão:** 1.0.0
