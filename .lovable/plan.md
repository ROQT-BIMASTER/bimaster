

# API Orçamento de Caixa (Previsto x Realizado) — Padronização Omie

## Resumo

Criar a API de Orçamento de Caixa seguindo o padrão Omie `ListarOrcamentos`, que retorna valores previstos e realizados por categoria para um dado mês/ano. Inclui nova tabela `orcamentos_caixa`, Edge Function dedicada e documentação.

## 1. Nova tabela `orcamentos_caixa`

Armazena orçamento previsto por categoria/mês. O realizado será calculado em runtime a partir dos lançamentos existentes (contas_pagar, contas_receber, lancamentos_cc).

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | ID interno |
| `empresa_id` | TEXT NOT NULL | Empresa |
| `ano` | INTEGER NOT NULL | Ano do orçamento |
| `mes` | INTEGER NOT NULL | Mês (1-12) |
| `codigo_categoria` | VARCHAR(20) NOT NULL | Código da categoria (ex: 2.04.01) |
| `descricao_categoria` | TEXT | Descrição da categoria |
| `valor_previsto` | NUMERIC(15,2) DEFAULT 0 | Valor orçado |
| `importado_api` | BOOLEAN DEFAULT false | Importado pela API |
| `created_at` | TIMESTAMPTZ DEFAULT now() | Criação |
| `updated_at` | TIMESTAMPTZ DEFAULT now() | Última alteração |

Unique constraint: `(empresa_id, ano, mes, codigo_categoria)`.
RLS: service_role + usuários autenticados da mesma empresa.

## 2. Nova Edge Function: `orcamentos-caixa-api`

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| GET | `/listar` | Lista orçamento previsto x realizado por mês/ano | ListarOrcamentos |
| POST | `/incluir` | Cadastra/atualiza orçamento previsto para uma categoria | — |
| POST | `/incluir-lote` | Upsert em lote de orçamentos previstos | — |
| GET | `/status` | Health check | — |

**GET /listar** — Parâmetros: `nAno`, `nMes`.

Lógica:
1. Buscar orçamentos previstos da tabela `orcamentos_caixa` para o mês/ano
2. Calcular realizado consultando `lancamentos_conta_corrente` (ou contas a pagar/receber) agrupados por categoria no período
3. Retornar no formato Omie com `ListaOrcamentos[]`

Resposta:
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

## 3. Documentação

Novo `docs/API_ORCAMENTOS_CAIXA.md`.

## 4. API Tester & Portal

- Presets no `ApiTester.tsx` (Listar, Incluir, Incluir Lote)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar — tabela `orcamentos_caixa` + RLS |
| `supabase/functions/orcamentos-caixa-api/index.ts` | Criar — nova Edge Function |
| `docs/API_ORCAMENTOS_CAIXA.md` | Criar — documentação |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

