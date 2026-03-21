

# API ListarMovimentos — Movimentação Financeira Unificada (Omie)

## Resumo

Criar nova Edge Function `movimentos-financeiros-api` seguindo o padrão Omie `ListarMovimentos`. Endpoint unificado que consolida Contas a Pagar, Contas a Receber e Lançamentos de Conta Corrente em uma única listagem paginada com filtros extensivos. Diferente do `PesquisarLancamentos` (que retorna títulos com baixas), este retorna **movimentos** (cada baixa/lançamento CC como linha individual).

## 1. Nova Edge Function: `movimentos-financeiros-api`

Sem nova tabela — consulta `contas_pagar`, `contas_receber`, `lancamentos_conta_corrente` e `pagamentos` existentes.

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| POST | `/listar` | Listagem unificada de movimentos financeiros | ListarMovimentos |
| GET | `/status` | Health check | — |

**POST /listar** — Body com filtros `mfListarRequest`:

Filtros principais (mesmos do PesquisarLancamentos) + adicionais:
- `cTpLancamento` — Tipo de registro: "CP" (Contas a Pagar), "CR" (Contas a Receber), "CC" (Conta Corrente), ou vazio para todos
- `cExibirDepartamentos` — "S" para incluir distribuição por departamentos
- `nCodMovCC` — Filtro por código do movimento de conta corrente
- `lDadosCad` — Incluir dados cadastrais (datas inclusão/alteração, observações)

**Lógica:**
1. Conforme `cTpLancamento`, consultar as tabelas relevantes (CP, CR, CC ou todas)
2. Para CP/CR: buscar títulos + seus pagamentos (cada pagamento = 1 movimento)
3. Para CC: buscar lançamentos diretos da `lancamentos_conta_corrente`
4. Unificar em array `movimentos[]` com estrutura `{ detalhes, resumo, departamentos, categorias }`
5. Aplicar paginação sobre o resultado unificado

**Resposta:**
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
        "cNatureza": "P",
        "nValorTitulo": 500.00,
        "nCodMovCC": 456,
        "nValorMovCC": 500.00,
        "nCodBaixa": 789,
        "cGrupo": "CP",
        "dDtPagamento": "15/03/2026"
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

## 2. Documentação

Novo `docs/API_MOVIMENTOS_FINANCEIROS.md`.

## 3. API Tester & Portal

- Presets no `ApiTester.tsx` (Listar CP, Listar CR, Listar CC, Listar Todos)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/movimentos-financeiros-api/index.ts` | Criar — nova Edge Function |
| `docs/API_MOVIMENTOS_FINANCEIROS.md` | Criar — documentação |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

