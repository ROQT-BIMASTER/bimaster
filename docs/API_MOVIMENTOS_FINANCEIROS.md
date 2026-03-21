# API Movimentos Financeiros — ListarMovimentos (Huggs)

API unificada de movimentação financeira consolidando Contas a Pagar, Contas a Receber e Lançamentos de Conta Corrente.

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/movimentos-financeiros-api`

**Autenticação:** `x-api-key` ou `Authorization: Bearer <JWT>`

---

## Endpoints

### POST /listar — ListarMovimentos

Listagem unificada e paginada de movimentos financeiros.

**Body (JSON):**

```json
{
  "nPagina": 1,
  "nRegPorPagina": 20,
  "cTpLancamento": "CP",
  "cNatureza": "P",
  "cExibirDepartamentos": "S",
  "lDadosCad": true,
  "dDtVencDe": "01/01/2026",
  "dDtVencAte": "31/03/2026"
}
```

#### Filtros (mfListarRequest)

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `nPagina` | integer | Página (default: 1) |
| `nRegPorPagina` | integer | Registros por página (máx 500) |
| `cOrdenarPor` | string | Campo de ordenação: `data_vencimento`, `data_emissao`, `data_pagamento`, `valor` |
| `cOrdemDecrescente` | string | "S" para decrescente |
| `cTpLancamento` | string | Tipo: "CP", "CR", "CC" ou vazio para todos |
| `cExibirDepartamentos` | string | "S" para incluir departamentos |
| `lDadosCad` | boolean | Incluir dados cadastrais (datas inclusão/alteração, observações) |
| `nCodMovCC` | integer | Filtro por código do movimento CC |
| `nCodTitulo` | integer | Código do título |
| `cCodIntTitulo` | string | Código de integração |
| `cNumTitulo` | string | Número do título |
| `dDtEmisDe` / `dDtEmisAte` | string | Filtro por emissão |
| `dDtVencDe` / `dDtVencAte` | string | Filtro por vencimento |
| `dDtPagtoDe` / `dDtPagtoAte` | string | Filtro por pagamento |
| `dDtPrevDe` / `dDtPrevAte` | string | Filtro por previsão |
| `dDtRegDe` / `dDtRegAte` | string | Filtro por registro |
| `dDtIncDe` / `dDtIncAte` | string | Filtro por inclusão |
| `dDtAltDe` / `dDtAltAte` | string | Filtro por alteração |
| `nCodCliente` | integer | Código do cliente/fornecedor |
| `cCPFCNPJCliente` | string | CPF/CNPJ |
| `nCodCC` | integer | Código da conta corrente |
| `cStatus` | string | Status (vírgula para múltiplos) |
| `cNatureza` | string | "R" ou "P" |
| `cTipo` | string | Tipo de documento |
| `cOperacao` | string | Operação |
| `cNumDocFiscal` | string | Número doc fiscal |
| `cCodCateg` | string | Código da categoria |
| `cCodigoBarras` | string | Código de barras |
| `nCodProjeto` | integer | Código do projeto |
| `nCodVendedor` | integer | Código do vendedor |
| `nCodComprador` | integer | Código do comprador |
| `nCodCtr` | integer | Código do contrato |
| `cNumCtr` | string | Número do contrato |
| `nCodOS` | integer | Código da OS |
| `cNumOS` | string | Número da OS |

#### Resposta (mfListarResponse)

```json
{
  "nPagina": 1,
  "nTotPaginas": 5,
  "nRegistros": 20,
  "nTotRegistros": 100,
  "movimentos": [
    {
      "detalhes": {
        "nCodTitulo": 123,
        "cCodIntTitulo": "CP-001",
        "cNatureza": "P",
        "nValorTitulo": 500.00,
        "nCodMovCC": 456,
        "nValorMovCC": 500.00,
        "nCodBaixa": 789,
        "cGrupo": "CP",
        "dDtPagamento": "15/03/2026",
        "nDesconto": 0,
        "nJuros": 0,
        "nMulta": 0
      },
      "resumo": {
        "cLiquidado": "S",
        "nValPago": 500.00,
        "nValAberto": 0,
        "nDesconto": 0,
        "nJuros": 0,
        "nMulta": 0,
        "nValLiquido": 500.00
      },
      "departamentos": [],
      "categorias": []
    }
  ]
}
```

---

## Tipos Complexos

### detalhes

| Campo | Tipo | Descrição |
|---|---|---|
| `nCodTitulo` | integer | Código do título |
| `cCodIntTitulo` | string(60) | Código de integração |
| `cNumTitulo` | string(20) | Número do título |
| `dDtEmissao` | string(10) | Data de emissão |
| `dDtVenc` | string(10) | Data de vencimento |
| `dDtPrevisao` | string(10) | Data de previsão |
| `dDtPagamento` | string(10) | Data de pagamento |
| `nCodCliente` | integer | Código do cliente/fornecedor |
| `cCPFCNPJCliente` | string(20) | CPF/CNPJ |
| `nCodCtr` | integer | Código do contrato |
| `cNumCtr` | string(20) | Número do contrato |
| `nCodOS` | integer | Código da OS |
| `cNumOS` | string(15) | Número da OS |
| `nCodCC` | integer | Código da conta corrente |
| `cStatus` | string(100) | Status |
| `cNatureza` | string(1) | Natureza: P ou R |
| `cTipo` | string(5) | Tipo de documento |
| `cOperacao` | string(2) | Operação |
| `cNumDocFiscal` | string(20) | Número doc fiscal |
| `cCodCateg` | string(20) | Código da categoria |
| `cNumParcela` | string(7) | Parcela (999/999) |
| `nValorTitulo` | decimal | Valor do título |
| `nValorPIS..nValorINSS` | decimal | Valores tributários |
| `cRetPIS..cRetINSS` | string(1) | Flags de retenção |
| `cCodProjeto` | integer | Código do projeto |
| `cCodVendedor` | integer | Código do vendedor |
| `nCodComprador` | integer | Código do comprador |
| `cCodigoBarras` | string(70) | Código de barras |
| `cNSU` | string(100) | NSU |
| `nCodNF` | integer | Código da NF |
| `dDtRegistro` | string(10) | Data de registro |
| `cNumBoleto` | string(30) | Número do boleto |
| `cChaveNFe` | string(44) | Chave NF-e |
| `cOrigem` | string(4) | Origem |
| `nCodTitRepet` | integer | Código título repetição |
| `cGrupo` | string(20) | Grupo: CP, CR, CC |
| `nCodMovCC` | integer | Código do movimento CC |
| `nValorMovCC` | decimal | Valor do movimento CC |
| `nCodMovCCRepet` | integer | Código repetição CC |
| `nDesconto` | decimal | Desconto |
| `nJuros` | decimal | Juros |
| `nMulta` | decimal | Multa |
| `nCodBaixa` | integer | Código da baixa |
| `dDtCredito` | string(10) | Data de crédito |
| `dDtConcilia` | string(10) | Data conciliação |
| `cHrConcilia` | string(8) | Hora conciliação |
| `cUsConcilia` | string(10) | Usuário conciliação |

Campos adicionais quando `lDadosCad = true`:

| Campo | Tipo | Descrição |
|---|---|---|
| `observacao` | text | Observações |
| `dDtInc` | string(10) | Data inclusão |
| `cHrInc` | string(8) | Hora inclusão |
| `cUsInc` | string(10) | Usuário inclusão |
| `dDtAlt` | string(10) | Data alteração |
| `cHrAlt` | string(8) | Hora alteração |
| `cUsAlt` | string(10) | Usuário alteração |

### resumo

| Campo | Tipo | Descrição |
|---|---|---|
| `cLiquidado` | string(1) | Liquidado (S/N) |
| `nValPago` | decimal | Valor pago |
| `nValAberto` | decimal | Valor em aberto |
| `nDesconto` | decimal | Desconto |
| `nJuros` | decimal | Juros |
| `nMulta` | decimal | Multa |
| `nValLiquido` | decimal | Valor líquido |

### departamentos (array)

| Campo | Tipo | Descrição |
|---|---|---|
| `cCodDepartamento` | string(40) | Código do departamento |
| `nDistrPercentual` | decimal | Percentual |
| `nDistrValor` | decimal | Valor |
| `nValorFixo` | string(1) | Valor fixado (S/N) |

### categorias (array)

| Campo | Tipo | Descrição |
|---|---|---|
| `cCodCateg` | string(20) | Código da categoria |
| `nDistrPercentual` | decimal | Percentual |
| `nDistrValor` | decimal | Valor |
| `nValorFixo` | string(1) | Valor fixado (S/N) |

---

## Códigos de Erro

| Código | Descrição |
|---|---|
| 400 | Parâmetros inválidos |
| 401 | Chave API inválida ou ausente |
| 404 | Rota não encontrada |
| 429 | Rate limit excedido (60 req/min) |
| 500 | Erro interno |

---

**Última atualização:** 2026-03-21
**Versão:** 1.0.0
