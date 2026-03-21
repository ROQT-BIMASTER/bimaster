# API Extrato de Conta Corrente

Rota `/extrato` dentro da Edge Function `lancamentos-cc-api`, seguindo o padrão Omie `ListarExtrato`.

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/lancamentos-cc-api`

**Autenticação:** Header `x-api-key` com chave válida do Portal de Integração.

---

## GET /extrato — ListarExtrato

Retorna extrato de uma conta corrente com saldos calculados e lista de movimentos.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nCodCC` | integer | Condicional | Código Omie da conta corrente |
| `cCodIntCC` | string | Condicional | Código de integração da conta |
| `dPeriodoInicial` | string(10) | Não | Período inicial (dd/mm/yyyy ou yyyy-mm-dd) |
| `dPeriodoFinal` | string(10) | Não | Período final (dd/mm/yyyy ou yyyy-mm-dd) |
| `cExibirApenasSaldo` | string(1) | Não | "S" para retornar apenas saldos sem movimentos |

Pelo menos `nCodCC` ou `cCodIntCC` é obrigatório.

**Exemplo de Request:**
```bash
curl -H "x-api-key: SUA_CHAVE" \
  "BASE_URL/extrato?nCodCC=427619317&dPeriodoInicial=01/03/2026&dPeriodoFinal=21/03/2026"
```

**Resposta:**
```json
{
  "nCodCC": 427619317,
  "cCodIntCC": "CC001",
  "nCodAgencia": "1234",
  "nCodBanco": "237",
  "nNumConta": "56789-0",
  "cDescricao": "Conta Bradesco",
  "cCodTipo": "CC",
  "cDesTipo": null,
  "cFluxoCaixa": "S",
  "cResumoExecutivo": "S",
  "dPeriodoInicial": "01/03/2026",
  "dPeriodoFinal": "21/03/2026",
  "nSaldoAnterior": 10000.00,
  "nSaldoAtual": 15230.50,
  "nSaldoConciliado": 15230.50,
  "nSaldoProvisorio": 15230.50,
  "nLimiteCreditoTotal": 50000.00,
  "nSaldoDisponivel": 65230.50,
  "listaMovimentos": [
    {
      "nCodLancamento": 123,
      "nCodLancRelac": null,
      "cSituacao": null,
      "dDataLancamento": "05/03/2026",
      "cDesCliente": "Fornecedor XYZ",
      "cTipoDocumento": "DIN",
      "cNumero": "001",
      "nValorDocumento": 500.00,
      "nSaldo": 10500.00,
      "cCodCategoria": "2.04.01",
      "cDesCategoria": "Serviços Terceiros",
      "cDocumentoFiscal": null,
      "cParcela": null,
      "cNossoNumero": null,
      "cOrigem": "CONP",
      "cVendedor": null,
      "cProjeto": null,
      "nCodCliente": 2485994,
      "cRazCliente": "XYZ Ltda",
      "cDocCliente": "12345678000190",
      "cObservacoes": "Pagamento ref NF 001",
      "cDataInclusao": "05/03/2026",
      "cHoraInclusao": null,
      "cNatureza": "D",
      "cBloqueado": "N",
      "dDataConciliacao": null
    }
  ]
}
```

---

## Lógica de Cálculo de Saldos

1. **nSaldoAnterior**: Saldo inicial da conta + soma dos movimentos anteriores ao `dPeriodoInicial`
2. **nSaldoAtual**: Saldo anterior + movimentos do período
3. **listaMovimentos**: Cada movimento inclui `nSaldo` (saldo acumulado corrente)

---

## Tipos — listaMovimentos

| Campo | Tipo | Descrição |
|---|---|---|
| `nCodLancamento` | integer | Código do lançamento |
| `nCodLancRelac` | integer | Código do lançamento relacionado (parcelamento) |
| `cSituacao` | string(40) | Situação do lançamento |
| `dDataLancamento` | string(10) | Data do lançamento (dd/mm/yyyy) |
| `cDesCliente` | string(100) | Cliente ou fornecedor (Nome Fantasia) |
| `cTipoDocumento` | string(50) | Tipo de documento |
| `cNumero` | string(20) | Número do documento |
| `nValorDocumento` | decimal | Valor do documento |
| `nSaldo` | decimal | Saldo acumulado |
| `cCodCategoria` | string(20) | Código da categoria |
| `cDesCategoria` | string(350) | Descrição da categoria |
| `cOrigem` | string(50) | Origem do lançamento |
| `cNatureza` | string(1) | Natureza: C (Crédito) ou D (Débito) |
| `cObservacoes` | text | Observações |
| `dDataConciliacao` | string(10) | Data da conciliação |

---

## Códigos de Erro

| Código | Descrição |
|---|---|
| 400 | Parâmetros obrigatórios ausentes (nCodCC ou cCodIntCC) |
| 401 | Chave API inválida ou ausente |
| 404 | Conta corrente não encontrada |
| 429 | Rate limit excedido (60 req/min) |
| 500 | Erro interno do servidor |

---

**Última atualização:** 2026-03-21
**Versão:** 1.0.0
