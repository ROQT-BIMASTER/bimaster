

# API PesquisarLancamentos — Padronização Omie

## Resumo

Criar a rota `POST /pesquisar` como nova Edge Function `pesquisar-lancamentos-api`, seguindo o padrão Omie `PesquisarLancamentos`. Endpoint unificado de pesquisa avançada de títulos financeiros (Contas a Pagar e Receber) com filtros extensivos, retornando títulos com seus lançamentos (baixas) e resumo financeiro. Endpoints deprecated (`ObterURLBoleto`, `PesquisarExcluidos`) não serão implementados.

## 1. Nova Edge Function: `pesquisar-lancamentos-api`

Sem nova tabela — consulta `contas_pagar` e `contas_receber` existentes + tabelas de pagamentos/recebimentos.

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| POST | `/pesquisar` | Pesquisa avançada de títulos com lançamentos e resumo | PesquisarLancamentos |
| GET | `/status` | Health check | — |

**POST /pesquisar** — Body JSON com filtros:

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

**Lógica:**
1. Determinar tabela-alvo via `cNatureza`: "R" → `contas_receber`, "P" → `contas_pagar`, sem filtro → ambas
2. Aplicar todos os filtros (data emissão, vencimento, pagamento, previsão, registro, cliente, status, tipo, categoria, NF-e, projeto, vendedor, comprador, código barras, etc.)
3. Para cada título, buscar lançamentos (pagamentos/recebimentos) e calcular resumo (`nValPago`, `nValAberto`, `cLiquidado`)
4. Retornar no formato Omie com `titulosEncontrados[]`

**Resposta:**
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
        "aCodCateg": [{ "cCodCateg": "1.01.02", "nValor": 500, "nPerc": 100 }],
        "departamentos": [],
        "info": { "dInc": "01/03/2026", "cImpAPI": "S" }
      },
      "lancamentos": [
        { "nCodLanc": 1, "dDtLanc": "15/03/2026", "nValLanc": 200.00 }
      ],
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

Autenticação: `validateAnyAuth` (JWT + API Key) — mesmo padrão.

## 2. Documentação

Novo `docs/API_PESQUISAR_LANCAMENTOS.md` com todos os filtros, tipos complexos e exemplos.

## 3. API Tester & Portal

- Presets no `ApiTester.tsx` (Pesquisar CR, Pesquisar CP, Pesquisar com filtros)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/pesquisar-lancamentos-api/index.ts` | Criar — nova Edge Function |
| `docs/API_PESQUISAR_LANCAMENTOS.md` | Criar — documentação |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

