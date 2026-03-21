

# API Resumo Financeiro — Padronização Omie (4 endpoints)

## Resumo

Criar nova Edge Function `resumo-financeiro-api` com 4 rotas seguindo o padrão Omie: `ObterResumoFinancas`, `ObterListaEmAberto`, `ObterListaFinancas` e `ObterDetalhesLancamento`. Endpoints de dashboard financeiro que agregam dados de `contas_pagar`, `contas_receber` e `contas_bancarias` para fornecer resumos, listas de títulos em aberto e detalhes de lançamentos individuais. Sem nova tabela.

## 1. Nova Edge Function: `resumo-financeiro-api`

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/resumo` | ObterResumoFinancas | Resumo consolidado (saldo CC, totais CP/CR, atraso, fluxo caixa, por categoria) |
| POST | `/em-aberto` | ObterListaEmAberto | Lista paginada de títulos em aberto (CP ou CR) |
| POST | `/lista-financas` | ObterListaFinancas | Lista de lançamentos por data/categoria/tipo |
| POST | `/detalhes` | ObterDetalhesLancamento | Detalhes completos de um título por `nIdTitulo` |
| GET | `/status` | — | Health check |

### POST /resumo
- Params: `dDia`, `lApenasResumo`, `lExibirCategoria`
- Retorna: `contaCorrente` (saldo total), `contaPagar` (total/atraso), `contaReceber` (total/atraso), `fluxoCaixa`, arrays de categorias e títulos atrasados

### POST /em-aberto
- Params: `dDia`, `cTipo` (P/R), `nCodCliente`, `cNomeCliente`, `nPagina`, `nRegPorPagina`
- Retorna: `ListaEmEberto[]` paginada com dias de atraso calculados

### POST /lista-financas
- Params: `dDia`, `cCodCateg`, `cTipo` (P/R)
- Retorna: `listaDetalhesFinancas[]` com dados de conta corrente e documento fiscal

### POST /detalhes
- Params: `nIdTitulo`
- Retorna: detalhes completos do título incluindo `boletoInfo`, `pixInfo`, `listaAnexos`

**Lógica principal:**
1. `/resumo`: Agrega `contas_pagar` e `contas_receber` (status pendente/vencido), soma saldos de `contas_bancarias`, calcula fluxo de caixa, agrupa por categoria se `lExibirCategoria`
2. `/em-aberto`: Filtra títulos pendentes com `valor_aberto > 0`, calcula `nDiasAtraso` como diferença entre hoje e vencimento
3. `/detalhes`: Busca título em ambas tabelas, enriquece com dados de boleto/PIX dos campos existentes e anexos da tabela `anexos`

## 2. Documentação

Novo `docs/API_RESUMO_FINANCEIRO.md`.

## 3. API Tester & Portal

- Presets no `ApiTester.tsx` (Resumo, Em Aberto CP, Em Aberto CR, Detalhes)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/resumo-financeiro-api/index.ts` | Criar |
| `docs/API_RESUMO_FINANCEIRO.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

