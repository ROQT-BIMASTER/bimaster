# API PesquisarLancamentos — Documentação

Pesquisa avançada unificada de títulos financeiros (Contas a Pagar e Receber) com filtros extensivos.

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/pesquisar-lancamentos-api`

**Autenticação:** `x-api-key` ou `Authorization: Bearer <token>`

---

## POST /pesquisar — PesquisarLancamentos

Pesquisa avançada com filtros, retornando títulos com lançamentos e resumo financeiro.

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
| `nCodCtr` | integer | Código do contrato |
| `cNumCtr` | string(20) | Número do contrato |
| `nCodOS` | integer | Código do Pedido de Venda / Ordem de Serviço |
| `cNumOS` | string(15) | Número do pedido de venda / Ordem de Serviço |
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
| `lDadosCad` | boolean | Incluir dados cadastrais (dInc, hInc, uInc, dAlt, hAlt, uAlt) |

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
        "cNumTitulo": "001",
        "dDtEmissao": "01/03/2026",
        "dDtVenc": "21/03/2026",
        "dDtPrevisao": "",
        "dDtPagamento": "",
        "nCodCliente": 4214850,
        "cCPFCNPJCliente": "12.345.678/0001-90",
        "nCodCtr": null,
        "cNumCtr": "",
        "nCodOS": null,
        "cNumOS": "",
        "nCodCC": 427619317,
        "cStatus": "pendente",
        "cNatureza": "R",
        "cTipo": "BOL",
        "cOperacao": "",
        "cNumDocFiscal": "",
        "cCodCateg": "1.01.02",
        "aCodCateg": [{ "cCodCateg": "1.01.02", "nValor": 500, "nPerc": 100 }],
        "cNumParcela": "1/3",
        "nValorTitulo": 500.00,
        "nValorPIS": 0, "cRetPIS": "N",
        "nValorCOFINS": 0, "cRetCOFINS": "N",
        "nValorCSLL": 0, "cRetCSLL": "N",
        "nValorIR": 0, "cRetIR": "N",
        "nValorISS": 0, "cRetISS": "N",
        "nValorINSS": 0, "cRetINSS": "N",
        "observacao": "",
        "cCodProjeto": null,
        "cCodVendedor": null,
        "nCodComprador": null,
        "cCodigoBarras": "",
        "cNSU": "",
        "nCodNF": null,
        "dDtRegistro": "",
        "cNumBoleto": "12345",
        "cChaveNFe": "",
        "cOrigem": "API",
        "nCodTitRepet": null,
        "dDtCanc": "",
        "departamentos": [],
        "info": {
          "dInc": "01/03/2026",
          "hInc": "10:30:00",
          "uInc": "admin",
          "dAlt": "15/03/2026",
          "hAlt": "14:20:00",
          "uAlt": "admin",
          "cImpAPI": "S"
        }
      },
      "lancamentos": [
        {
          "nCodLanc": "uuid-123",
          "cCodIntLanc": "",
          "nIdLancCC": null,
          "dDtLanc": "15/03/2026",
          "nValLanc": 200.00,
          "nMulta": 0,
          "nJuros": 5.00,
          "nDesconto": 0,
          "nCodCC": null,
          "cNatureza": "R",
          "cObsLanc": ""
        }
      ],
      "resumo": {
        "cLiquidado": "N",
        "nValPago": 200.00,
        "nValAberto": 300.00,
        "nDesconto": 0,
        "nJuros": 5.00,
        "nMulta": 0,
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
| `cCPFCNPJCliente` | string(20) | CPF/CNPJ do cliente |
| `nCodCtr` | integer | Código do contrato |
| `cNumCtr` | string(20) | Número do contrato |
| `nCodOS` | integer | Código do Pedido de Venda / OS |
| `cNumOS` | string(15) | Número do pedido / OS |
| `nCodCC` | integer | Código da conta corrente |
| `cStatus` | string | Status do título |
| `cNatureza` | string(1) | R = Receber, P = Pagar |
| `cTipo` | string(5) | Tipo de documento |
| `cOperacao` | string(2) | Operação do título |
| `cNumDocFiscal` | string(20) | Número do documento fiscal |
| `cCodCateg` | string(20) | Código da categoria |
| `aCodCateg` | array | Rateio de categorias |
| `cNumParcela` | string(7) | Número da parcela (999/999) |
| `nValorTitulo` | decimal | Valor do título |
| `nValorPIS` | decimal | Valor do PIS |
| `cRetPIS` | string(1) | Retém PIS (S/N) |
| `nValorCOFINS` | decimal | Valor do COFINS |
| `cRetCOFINS` | string(1) | Retém COFINS (S/N) |
| `nValorCSLL` | decimal | Valor do CSLL |
| `cRetCSLL` | string(1) | Retém CSLL (S/N) |
| `nValorIR` | decimal | Valor do IR |
| `cRetIR` | string(1) | Retém IR (S/N) |
| `nValorISS` | decimal | Valor do ISS |
| `cRetISS` | string(1) | Retém ISS (S/N) |
| `nValorINSS` | decimal | Valor do INSS |
| `cRetINSS` | string(1) | Retém INSS (S/N) |
| `observacao` | text | Observações |
| `cCodProjeto` | integer | Código do projeto |
| `cCodVendedor` | integer | Código do vendedor |
| `nCodComprador` | integer | Código do comprador |
| `cCodigoBarras` | string(70) | Código de barras |
| `cNSU` | string(100) | Número Sequencial Único |
| `nCodNF` | integer | Código da Nota Fiscal |
| `dDtRegistro` | string(10) | Data de registro da NF |
| `cNumBoleto` | string(30) | Número do boleto |
| `cChaveNFe` | string(44) | Chave NF-e/CT-e |
| `cOrigem` | string(4) | Origem do lançamento |
| `nCodTitRepet` | integer | Código do título original (repetição) |
| `dDtCanc` | string(10) | Data de cancelamento |
| `departamentos` | array | Distribuição por departamentos |
| `info` | object | Dados cadastrais (quando lDadosCad=true) |

### aCodCateg (Rateio de categorias)

| Campo | Tipo | Descrição |
|---|---|---|
| `cCodCateg` | string(20) | Código da categoria |
| `nValor` | decimal | Valor da categoria |
| `nPerc` | decimal | Percentual da categoria |

### departamentos

| Campo | Tipo | Descrição |
|---|---|---|
| `cCodDepartamento` | string(40) | Código do departamento |
| `nDistrPercentual` | decimal | Percentual da distribuição |
| `nDistrValor` | decimal | Valor da distribuição |
| `nValorFixo` | string(1) | Valor fixado (S/N) |

### info

| Campo | Tipo | Descrição |
|---|---|---|
| `dInc` | string(10) | Data da inclusão |
| `hInc` | string(8) | Hora da inclusão |
| `uInc` | string(10) | Usuário da inclusão |
| `dAlt` | string(10) | Data da alteração |
| `hAlt` | string(8) | Hora da alteração |
| `uAlt` | string(10) | Usuário da alteração |
| `cImpAPI` | string(1) | Importado pela API (S/N) |

### lancamentos

| Campo | Tipo | Descrição |
|---|---|---|
| `nCodLanc` | integer/uuid | Código do lançamento |
| `cCodIntLanc` | string(20) | Código de integração do lançamento |
| `nIdLancCC` | integer | Código do lançamento na conta corrente |
| `dDtLanc` | string(10) | Data do lançamento |
| `nValLanc` | decimal | Valor do lançamento |
| `nMulta` | decimal | Valor da multa |
| `nJuros` | decimal | Valor dos juros |
| `nDesconto` | decimal | Valor do desconto |
| `nCodCC` | integer | Código da conta corrente |
| `cNatureza` | string(1) | Natureza (R/P) |
| `cObsLanc` | text | Observação do lançamento |

### resumo

| Campo | Tipo | Descrição |
|---|---|---|
| `cLiquidado` | string(1) | Liquidado (S/N) |
| `nValPago` | decimal | Total pago |
| `nValAberto` | decimal | Valor em aberto |
| `nDesconto` | decimal | Total de descontos |
| `nJuros` | decimal | Total de juros |
| `nMulta` | decimal | Total de multas |
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
**Versão:** 2.0.0
