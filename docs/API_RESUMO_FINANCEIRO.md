# API Resumo Financeiro — Documentação Completa

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/resumo-financeiro-api`

## Autenticação

Todas as requisições exigem **API Key** ou **JWT**:
- `x-api-key: SUA_CHAVE` (ERP/server-to-server)
- `Authorization: Bearer <token>` (usuários autenticados)

---

## Rotas

### GET /status — Health Check

```
GET /resumo-financeiro-api/status
```

### POST /resumo — ObterResumoFinancas

Resumo consolidado: saldo das contas correntes, totais CP/CR, atrasos, fluxo de caixa e categorias.

```json
{
  "dDia": "21/03/2026",
  "lApenasResumo": false,
  "lExibirCategoria": true
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `dDia` | string(10) | Data de referência (dd/mm/aaaa) |
| `lApenasResumo` | boolean | Exibir apenas resumo (sem listas de atraso) |
| `lExibirCategoria` | boolean | Incluir totais por categoria |

**Resposta:**
```json
{
  "dDia": "21/03/2026",
  "contaCorrente": { "vTotal": 150000, "vLimiteCredito": 200000, "cIcone": "🏦", "cCor": "#3B82F6" },
  "contaPagar": { "nTotal": 45, "vTotal": 85000, "vAtraso": 12000, "cIcone": "📤", "cCor": "#EF4444" },
  "contaReceber": { "nTotal": 30, "vTotal": 120000, "vAtraso": 5000, "cIcone": "📥", "cCor": "#22C55E" },
  "fluxoCaixa": { "dDia": "21/03/2026", "vPagar": 85000, "vReceber": 120000, "vSaldo": 150000 },
  "contaPagarAtraso": [...],
  "contaReceberAtraso": [...],
  "contaPagarCategoria": [...],
  "contaReceberCategoria": [...]
}
```

---

### POST /em-aberto — ObterListaEmAberto

Lista paginada de títulos em aberto (CP ou CR).

```json
{
  "dDia": "21/03/2026",
  "cTipo": "P",
  "nPagina": 1,
  "nRegPorPagina": 50
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `dDia` | string(10) | Data de referência |
| `cTipo` | string(1) | "P" (Pagar) ou "R" (Receber) |
| `nCodCliente` | integer | Filtrar por cliente/fornecedor |
| `cNomeCliente` | string | Busca parcial por nome |
| `nPagina` | integer | Página (default: 1) |
| `nRegPorPagina` | integer | Registros/página (máx 500) |

**Resposta:**
```json
{
  "ListaEmEberto": [
    {
      "nIdTitulo": "uuid",
      "nIdCliente": 4214850,
      "cNomeCliente": "Empresa ABC",
      "vDoc": 1500.00,
      "dVencimento": "15/03/2026",
      "dEmissao": "01/03/2026",
      "cCodCateg": "2.04.01",
      "cDescCateg": "Serviços",
      "nDiasAtraso": 6,
      "nQtdeAnexos": 0,
      "cBolGerado": "N",
      "cBolPodeGerar": "N",
      "cPixGerado": "N",
      "cPixPodeGerar": "N"
    }
  ],
  "nRegistros": 50,
  "nPagina": 1,
  "nTotPaginas": 3,
  "nTotRegistros": 125
}
```

---

### POST /lista-financas — ObterListaFinancas

Lista de lançamentos por data, categoria e tipo.

```json
{
  "dDia": "21/03/2026",
  "cCodCateg": "1.01.01",
  "cTipo": "R"
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `dDia` | string(10) | Data de referência (filtro vencimento ≤) |
| `cCodCateg` | string(20) | Filtrar por categoria |
| `cTipo` | string(1) | "P" ou "R" |

**Resposta:**
```json
{
  "listaDetalhesFinancas": [
    {
      "nIdTitulo": "uuid",
      "nIdCliente": 4214850,
      "cNomeCliente": "Empresa ABC",
      "vDoc": 1500.00,
      "dVencimento": "15/03/2026",
      "dEmissao": "01/03/2026",
      "dPrevisao": "20/03/2026",
      "nIdConta": 427619317,
      "cNomeConta": "",
      "cNumDocumentoFiscal": "NF-001",
      "cNumDocumento": "DOC-001"
    }
  ]
}
```

---

### POST /detalhes — ObterDetalhesLancamento

Detalhes completos de um título por ID.

```json
{
  "nIdTitulo": "uuid-do-titulo"
}
```

**Resposta:**
```json
{
  "cTipoLanc": "R",
  "nIdTitulo": "uuid",
  "nIdCliente": 4214850,
  "cNomeCliente": "Empresa ABC",
  "cCodCateg": "1.01.02",
  "cDescCateg": "Vendas",
  "cDescCtaCorr": "",
  "dEmissao": "01/03/2026",
  "dVencimento": "21/03/2026",
  "dPrevisao": "21/03/2026",
  "nDiasAtraso": 0,
  "vDoc": 1500.00,
  "cSituacao": "A vencer",
  "nQtdeAnexos": 2,
  "listaAnexos": [
    { "nIdAnexo": "uuid", "cCodIntAnexo": "ANX-001", "cNomeArquivo": "comprovante.pdf", "cTipoArquivo": "pdf", "cTabela": "contas_receber" }
  ],
  "cBolGerado": "S",
  "boletoInfo": {
    "cNumBoleto": "00001",
    "cNumBancario": "23793.38128 60000.000001 00001.401044 1 85250000150000",
    "cCodBarras": "23791852500001500...",
    "cLinkBoleto": "https://...",
    "dEmissao": "01/03/2026",
    "dVencimento": "21/03/2026",
    "nPerJuros": 1.0,
    "nPerMulta": 2.0
  },
  "cPixGerado": "N",
  "pixInfo": null
}
```

---

## Tipos Complexos

### contaCorrente
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `vTotal` | decimal | Saldo total |
| `vLimiteCredito` | decimal | Saldo + limite de crédito |

### contaPagar / contaReceber
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nTotal` | decimal | Quantidade de lançamentos |
| `vTotal` | decimal | Valor total |
| `vAtraso` | decimal | Valor em atraso |

### fluxoCaixa
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `dDia` | string | Data referência |
| `vPagar` | decimal | Total a pagar |
| `vReceber` | decimal | Total a receber |
| `vSaldo` | decimal | Saldo bancário |

### boletoInfo
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cNumBoleto` | string(30) | Nosso número |
| `cNumBancario` | string(30) | Nosso número formatado |
| `cCodBarras` | string(70) | Código de barras |
| `cLinkBoleto` | string(500) | Link do boleto |
| `nPerJuros` | decimal | % juros/mês |
| `nPerMulta` | decimal | % multa |

### pixInfo
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nIdPix` | integer | ID do PIX |
| `cCopiaECola` | text | Código copia e cola |
| `cUrlPix` | text | Link QR Code |
| `cStatus` | string(20) | Status do PIX |
| `vValor` | decimal | Valor |

---

## Mapa de Rotas

| Método | Rota | Auth | Equivalente Omie |
|--------|------|------|------------------|
| GET | `/status` | JWT/Key | — |
| POST | `/resumo` | JWT/Key | ObterResumoFinancas |
| POST | `/em-aberto` | JWT/Key | ObterListaEmAberto |
| POST | `/lista-financas` | JWT/Key | ObterListaFinancas |
| POST | `/detalhes` | JWT/Key | ObterDetalhesLancamento |
