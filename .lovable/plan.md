

# API Lançamentos de Conta Corrente — Padronização Omie

## Resumo

Criar a API completa de Lançamentos de Conta Corrente (CRUD + Listagem paginada) seguindo o padrão Omie, expandir a tabela `lancamentos_conta_corrente` com campos faltantes, criar a Edge Function e documentar.

## 1. Expansão da tabela `lancamentos_conta_corrente`

A tabela já existe com campos básicos. Faltam campos do modelo Omie:

| Campo | Tipo | Descrição |
|---|---|---|
| `n_cod_lanc` | BIGINT | Código do lançamento no Omie |
| `c_cod_int_lanc` | VARCHAR(20) | Código de integração do lançamento |
| `n_cod_agrup` | BIGINT | Código do agrupamento |
| `c_tipo_documento` | VARCHAR(5) | Tipo de documento (DIN, CHQ, DOC, TED, PIX, etc.) |
| `n_cod_cliente` | BIGINT | Código do cliente/favorecido |
| `n_cod_projeto` | INTEGER | Código do projeto |
| `n_cod_vendedor` | INTEGER | Código do vendedor |
| `n_cod_comprador` | INTEGER | Código do comprador |
| `c_natureza` | VARCHAR(1) | Natureza do lançamento (C/D) |
| `c_origem_lanc` | VARCHAR(4) | Origem Omie (MANU, CONP, CONR, TRAN, etc.) |
| `data_conciliacao` | DATE | Data da conciliação |
| `hora_conciliacao` | TIME | Hora da conciliação |
| `usuario_conciliacao` | VARCHAR(10) | Usuário da conciliação |
| `c_ident_lanc` | VARCHAR(40) | Identificação do extrato importado |
| `n_cod_lanc_cp` | BIGINT | Código do lançamento de contas a pagar vinculado |
| `n_cod_lanc_cr` | BIGINT | Código do lançamento de contas a receber vinculado |
| `conta_destino_n_cod_cc` | BIGINT | Conta corrente destino (transferência) |
| `importado_api` | BOOLEAN | Importado pela API |
| `bloqueado` | BOOLEAN | Bloqueado pela API |
| `rateio_categorias` | JSONB | Array de rateio por categorias |
| `rateio_departamentos` | JSONB | Array de rateio por departamentos |

Unique constraint: `(empresa_id, c_cod_int_lanc)` para upsert por código de integração.

## 2. Nova Edge Function: `lancamentos-cc-api`

Seguindo o padrão do `contas-correntes-api`:

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| GET | `/` | Listar lançamentos (paginado) | ListarLancCC |
| GET | `/consultar` | Consultar por ID ou código integração | ConsultaLancCC |
| POST | `/incluir` | Incluir lançamento | IncluirLancCC |
| PUT | `/alterar` | Alterar lançamento | AlterarLancCC |
| DELETE | `/excluir` | Excluir (inativar) lançamento | ExcluirLancCC |
| POST | `/upsert` | Upsert unitário | — |
| POST | `/upsert-lote` | Upsert em lote | — |
| POST | `/sync` | Sync legado (compatibilidade N8N) | — |
| GET | `/status` | Health check | — |

Filtros: `nCodCC` (conta corrente), `cOrigem`, `dDtIncDe/Ate`, `dDtAltDe/Ate`, `dtPagInicial/Final`, `cOrdenarPor`, `cOrdemDecrescente`.

Estrutura de request/response segue o padrão Omie com `cabecalho`, `detalhes`, `transferencia`, `departamentos`, `diversos`, `info`.

## 3. Documentação

Novo arquivo `docs/API_LANCAMENTOS_CC.md` com todos os endpoints, tipos e exemplos.

## 4. API Tester & Docs Portal

- Adicionar presets no `ApiTester.tsx` para os novos endpoints
- Adicionar seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar — expandir `lancamentos_conta_corrente` |
| `supabase/functions/lancamentos-cc-api/index.ts` | Criar — nova Edge Function |
| `docs/API_LANCAMENTOS_CC.md` | Criar — documentação |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

