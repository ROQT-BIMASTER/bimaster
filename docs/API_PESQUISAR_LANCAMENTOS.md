# API PesquisarLancamentos — Documentação

Pesquisa avançada unificada de títulos financeiros (Contas a Pagar e Receber) com filtros extensivos.

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/pesquisar-lancamentos-api`

**Autenticação:** `x-api-key` ou `Authorization: Bearer <token>`

---

## POST /pesquisar — PesquisarLancamentos

Pesquisa avançada com filtros, retornando títulos com resumo financeiro.

**Body (JSON):**

```json
{
  "nPagina": 1,
  "nRegPorPagina": 20,
  "cNatureza": "R",
  "cStatus": "pendente",
  "dDtVencDe": "01/01/2026",
  "dDtVencAte": "31/03/2026",
  "nCodCliente": 4214850,
  "cCodCateg": "1.01.02",
  "cOrdenarPor": "data_vencimento",
  "cOrdemDecrescente": "S"
}
```

### Filtros disponíveis

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `nPagina` | integer | Página (default: 1) |
| `nRegPorPagina` | integer | Registros por página (máx 500) |
| `cNatureza` | string(1) | "R" = Receber, "P" = Pagar, vazio = ambos |
| `cOrdenarPor` | string | Campo de ordenação (default: data_vencimento) |
| `cOrdemDecrescente` | string(1) | "S" para ordem decrescente |
| `nCodTitulo` | integer | Código do título |
| `cCodIntTitulo` | string(60) | Código de integração |
| `cNumTitulo` | string(20) | Número do título |
| `dDtEmisDe` / `dDtEmisAte` | string(10) | Filtro por data de emissão |
| `dDtVencDe` / `dDtVencAte` | string(10) | Filtro por data de vencimento |
| `dDtPagtoDe` / `dDtPagtoAte` | string(10) | Filtro por data de pagamento |
| `dDtPrevDe` / `dDtPrevAte` | string(10) | Filtro por data de previsão |
| `dDtRegDe` / `dDtRegAte` | string(10) | Filtro por data de registro |
| `dDtIncDe` / `dDtIncAte` | string(10) | Filtro por data de inclusão |
| `dDtAltDe` / `dDtAltAte` | string(10) | Filtro por data de alteração |
| `dDtCancDe` / `dDtCancAte` | string(10) | Filtro por data de cancelamento |
| `nCodCliente` | integer | Código do cliente/fornecedor |
| `cCPFCNPJCliente` | string(20) | CPF/CNPJ do cliente |
| `nCodCC` | integer | Código da conta corrente |
| `cStatus` | string(100) | Status (vírgula para múltiplos) |
| `cTipo` | string(5) | Tipo de documento |
| `cOperacao` | string(2) | Operação do título |
| `cNumDocFiscal` | string(20) | Número do documento fiscal |
| `cCodCateg` | string(20) | Código da categoria |
| `cCodigoBarras` | string(70) | Código de barras |
| `nCodProjeto` | integer | Código do projeto |
| `nCodVendedor` | integer | Código do vendedor |
| `nCodComprador` | integer | Código do comprador |
| `cChaveNFe` | string(44) | Chave NF-e/CT-e |
| `lDadosCad` | boolean | Incluir dados cadastrais (dInc, dAlt) |

### Resposta

```json
{
  "nPagina": 1,
  "nTotPaginas": 5,
  "nRegistros": 20,
  "nTotRegistros": 100,
  "titulosEncontrados": [
    {
      "cabecTitulo": {
        "nCodTitulo": 123,
        "cCodIntTitulo": "CR-001",
        "dDtVenc": "21/03/2026",
        "nValorTitulo": 500.00,
        "cStatus": "pendente",
        "cNatureza": "R",
        "cCodCateg": "1.01.02",
        "aCodCateg": [],
        "departamentos": [],
        "info": { "dInc": "01/03/2026", "cImpAPI": "S" }
      },
      "lancamentos": [],
      "resumo": {
        "cLiquidado": "N",
        "nValPago": 200.00,
        "nValAberto": 300.00,
        "nValLiquido": 500.00
      }
    }
  ]
}
```

---

## Tipos Complexos

### cabecTitulo

| Campo | Tipo | Descrição |
|---|---|---|
| `nCodTitulo` | integer | Código do título |
| `cCodIntTitulo` | string(60) | Código de integração |
| `cNumTitulo` | string(20) | Número do título |
| `dDtEmissao` | string(10) | Data de emissão (dd/mm/yyyy) |
| `dDtVenc` | string(10) | Data de vencimento |
| `dDtPrevisao` | string(10) | Data de previsão |
| `dDtPagamento` | string(10) | Data de pagamento |
| `nCodCliente` | integer | Código do cliente/fornecedor |
| `nCodCC` | integer | Código da conta corrente |
| `cStatus` | string | Status do título |
| `cNatureza` | string(1) | R = Receber, P = Pagar |
| `nValorTitulo` | decimal | Valor do título |
| `cCodCateg` | string(20) | Código da categoria |
| `aCodCateg` | array | Rateio de categorias |
| `departamentos` | array | Rateio por departamentos |
| `info` | object | Dados cadastrais (quando lDadosCad=true) |

### resumo

| Campo | Tipo | Descrição |
|---|---|---|
| `cLiquidado` | string(1) | Liquidado (S/N) |
| `nValPago` | decimal | Total pago |
| `nValAberto` | decimal | Valor em aberto |
| `nValLiquido` | decimal | Valor líquido |

---

## GET /status — Health Check

```json
{ "status": "online", "service": "pesquisar-lancamentos-api" }
```

---

## Códigos de Erro

| Código | Descrição |
|---|---|
| 400 | Parâmetros inválidos |
| 401 | Autenticação inválida |
| 404 | Rota não encontrada |
| 429 | Rate limit excedido (60 req/min) |
| 500 | Erro interno |

---

**Última atualização:** 2026-03-21
**Versão:** 1.0.0
