

# API Contas Correntes — Padronização Omie

## Resumo

Criar uma API completa de Contas Correntes seguindo o padrão Omie (CRUD + Sync + Listagem paginada), expandir a tabela `contas_bancarias` com campos faltantes do modelo Omie, e documentar tudo no portal.

## 1. Expansão da tabela `contas_bancarias`

A tabela atual tem campos básicos. Faltam vários campos do modelo Omie. Migração para adicionar:

| Campo | Tipo | Descrição |
|---|---|---|
| `descricao` | VARCHAR(100) | Descrição da conta corrente |
| `tipo_conta_corrente` | VARCHAR(2) | Tipo: CC, CP, CX, CI, CM, PI |
| `codigo_banco` | VARCHAR(3) | Código do banco (Omie) |
| `valor_limite` | NUMERIC(15,2) | Limite de crédito |
| `nao_fluxo` | BOOLEAN | Não exibir no Fluxo de Caixa |
| `nao_resumo` | BOOLEAN | Não exibir no Resumo de Finanças |
| `observacao` | TEXT | Observação |
| `cobr_sn` | BOOLEAN | Realiza cobrança bancária |
| `per_juros` | NUMERIC(5,2) | % juros ao mês |
| `per_multa` | NUMERIC(5,2) | % multa |
| `bol_instr1..4` | VARCHAR(80) | Instruções do boleto |
| `bol_sn` | BOOLEAN | Emite boletos |
| `pix_sn` | BOOLEAN | Emite PIX |
| `cnab_esp` | VARCHAR(2) | Espécie remessa cobrança |
| `cobr_esp` | VARCHAR(3) | Espécie boleto |
| `dias_rcomp` | INTEGER | Dias compensação |
| `modalidade` | VARCHAR(3) | Modalidade cobrança |
| `cancinstr` | VARCHAR(3) | Instrução cancelamento |
| `importado_api` | BOOLEAN | Importado pela API |
| `bloqueado` | BOOLEAN | Bloqueado pela API |
| `cnpj_inst_financ` | VARCHAR(20) | CNPJ instituição financeira |
| `nome_gerente` | VARCHAR(40) | Gerente da conta |
| `ddd` | VARCHAR(5) | DDD do gerente |
| `telefone` | VARCHAR(15) | Telefone do gerente |
| `email` | VARCHAR(200) | E-mail do gerente |
| `endereco` | VARCHAR(50) | Endereço da agência |
| `numero_endereco` | VARCHAR(5) | Número |
| `bairro` | VARCHAR(60) | Bairro |
| `complemento` | VARCHAR(15) | Complemento |
| `estado` | VARCHAR(2) | Estado |
| `cidade` | VARCHAR(40) | Cidade |
| `cep` | VARCHAR(9) | CEP |
| `codigo_pais` | VARCHAR(4) | Código do país |
| `n_cod_cc` | BIGINT | Código numérico Omie |

Unique constraint: `(empresa_id, codigo_integracao)` para suportar upsert por código de integração.

## 2. Nova Edge Function: `contas-correntes-api`

Seguindo o padrão das demais APIs ERP, arquivo `supabase/functions/contas-correntes-api/index.ts` com as rotas:

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| GET | `/` | Listar contas correntes (paginado) | ListarContasCorrentes |
| GET | `/resumo` | Listagem resumida | ListarResumoContasCorrentes |
| GET | `/consultar` | Consultar por ID ou código integração | ConsultarContaCorrente |
| POST | `/incluir` | Incluir conta corrente | IncluirContaCorrente |
| PUT | `/alterar` | Alterar conta corrente | AlterarContaCorrente |
| DELETE | `/excluir` | Excluir (inativar) conta corrente | ExcluirContaCorrente |
| POST | `/upsert` | Upsert unitário | UpsertContaCorrente |
| POST | `/upsert-lote` | Upsert em lote | UpsertContaCorrentePorLote |
| POST | `/sync` | Sync legado (compatibilidade) | — |
| GET | `/status` | Health check | — |

Cada rota segue o padrão:
- Autenticação via `validateErpAuth`
- Rate limiting via `checkRateLimit`
- Logging em `erp_sync_log`
- Respostas com `jsonResponse` unificado
- Paginação com `pagina`, `registros_por_pagina`, `total_de_registros`, `total_de_paginas`
- Filtros: `apenas_importado_api`, `filtrar_apenas_ativo`, `filtrar_por_data_de/ate`, `ordenar_por`, `ordem_descendente`

## 3. Documentação da API

Novo arquivo `docs/API_CONTAS_CORRENTES.md` com a documentação completa de todos os endpoints, tipos, exemplos e códigos de erro — no mesmo formato do `API_CONTAS_PAGAR.md`.

## 4. Integração no API Tester

Adicionar presets no componente `ApiTester.tsx` para os novos endpoints:
- Listar Contas Correntes
- Consultar Conta Corrente
- Incluir Conta Corrente
- Alterar Conta Corrente
- Upsert Conta Corrente
- Upsert por Lote

## 5. Atualização da documentação no portal

Adicionar seção de Contas Correntes no `ApiDocumentation.tsx` com a referência completa das rotas.

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar — expandir `contas_bancarias` + unique constraint |
| `supabase/functions/contas-correntes-api/index.ts` | Criar — nova Edge Function |
| `docs/API_CONTAS_CORRENTES.md` | Criar — documentação |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

