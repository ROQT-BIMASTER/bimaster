

# API Extrato de Conta Corrente — Padronização Omie

## Resumo

Adicionar a rota `/extrato` na Edge Function `lancamentos-cc-api` existente, seguindo o padrão Omie `ListarExtrato`. A rota consulta a view `vw_extrato_conta_corrente` já existente e retorna saldos + lista de movimentos no formato Omie. Sem nova tabela — usa infraestrutura existente.

## 1. Nova rota na Edge Function `lancamentos-cc-api`

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| GET | `/extrato` | Extrato de conta corrente com saldos e movimentos | ListarExtrato |

**Parâmetros (query string):**
- `nCodCC` — código Omie da conta corrente
- `cCodIntCC` — código de integração da conta
- `dPeriodoInicial` / `dPeriodoFinal` — filtro de período (dd/mm/yyyy ou yyyy-mm-dd)
- `cExibirApenasSaldo` — "S" para retornar apenas saldos sem movimentos

**Resposta Omie-style:**
```json
{
  "nCodCC": 427619317,
  "cCodIntCC": "CC001",
  "cDescricao": "Conta Bradesco",
  "nCodBanco": "237",
  "nCodAgencia": "1234",
  "nNumConta": "56789-0",
  "cCodTipo": "CC",
  "dPeriodoInicial": "01/03/2026",
  "dPeriodoFinal": "21/03/2026",
  "nSaldoAnterior": 10000.00,
  "nSaldoAtual": 15230.50,
  "nSaldoConciliado": 14800.00,
  "listaMovimentos": [
    {
      "nCodLancamento": 123,
      "dDataLancamento": "05/03/2026",
      "cDesCliente": "Fornecedor XYZ",
      "cTipoDocumento": "DIN",
      "nValorDocumento": 500.00,
      "nSaldo": 10500.00,
      "cCodCategoria": "2.04.01",
      "cOrigem": "CONP",
      "cNatureza": "D"
    }
  ]
}
```

**Lógica:**
1. Localizar a conta corrente (`contas_bancarias`) por `nCodCC` ou `cCodIntCC`
2. Consultar `vw_extrato_conta_corrente` filtrando por `conta_bancaria_id` e período
3. Calcular saldo anterior (soma de movimentos antes do período inicial)
4. Calcular saldo atual (anterior + movimentos do período)
5. Mapear campos para nomenclatura Omie (`listaMovimentos`)

## 2. Documentação

Atualizar `docs/API_LANCAMENTOS_CC.md` com a nova rota `/extrato`.

## 3. API Tester & Portal

- Preset no `ApiTester.tsx` para "Extrato de Conta Corrente"
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/lancamentos-cc-api/index.ts` | Editar — adicionar rota `/extrato` |
| `docs/API_LANCAMENTOS_CC.md` | Editar — documentar rota |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar preset |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

