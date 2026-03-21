

# API Clientes (CRUD Completo) — Padronização Omie

## Resumo

Criar Edge Function `clientes-api` com rotas CRUD completas seguindo o padrão Omie. Usa tabela `clientes` existente (50+ colunas). Endpoints obsoletos (`IncluirClientesPorLote`, `UpsertClientesPorLote`) não serão implementados.

## 1. Nova Edge Function: `clientes-api`

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/incluir` | IncluirCliente | Inclui cliente |
| POST | `/alterar` | AlterarCliente | Altera cliente |
| POST | `/consultar` | ConsultarCliente | Consulta por código |
| POST | `/excluir` | ExcluirCliente | Exclui (inativa) cliente |
| POST | `/listar` | ListarClientes | Lista completa paginada |
| POST | `/listar-resumido` | ListarClientesResumido | Lista resumida paginada |
| POST | `/upsert` | UpsertCliente | Inclui ou altera |
| POST | `/upsert-cpfcnpj` | UpsertClienteCpfCnpj | Upsert por CPF/CNPJ |
| POST | `/associar` | AssociarCodIntCliente | Associa código integração |
| GET | `/status` | — | Health check |

## 2. Mapeamento de Campos (cadastro → clientes)

| Campo Omie | Coluna DB | Observação |
|---|---|---|
| `codigo_cliente_omie` | `id` (ou gerado) | UUID interno |
| `codigo_cliente_integracao` | `codigo` | Código legado |
| `razao_social` | `nome` | Nome/Razão Social |
| `nome_fantasia` | `nome_abreviado` | Nome fantasia |
| `cnpj_cpf` | `cnpj` | CNPJ ou CPF |
| `email` | `email` | E-mail |
| `telefone1_numero` | `telefone` | Telefone |
| `celular` | `celular` | — |
| `contato` | `comprador` | Nome contato |
| `endereco` | `endereco` | — |
| `bairro` | `bairro` | — |
| `cidade` | `cidade` | — |
| `estado` | `uf` | — |
| `cep` | `cep` | — |
| `inscricao_estadual` | `inscricao_estadual` | — |
| `observacao` | `observacoes` | — |
| `valor_limite_credito` | `limite_credito` | — |
| `inativo` | `status_bloqueio` → `"S"/"N"` | Mapeado |
| `bloquear_faturamento` | `status_bloqueio` | — |
| `pessoa_fisica` | Derivado do `cnpj` (11 dígitos = S) | — |
| `importado_api` | — | Sempre `"S"` via API |

Campos Omie sem correspondência direta (retornados vazios/default): `telefone1_ddd`, `telefone2_*`, `fax_*`, `homepage`, `inscricao_municipal`, `inscricao_suframa`, `optante_simples_nacional`, `tipo_atividade`, `cnae`, `produtor_rural`, `contribuinte`, `exterior`, `codigo_pais`, `nif`, `documento_exterior`.

## 3. Lógica por Endpoint

### POST /incluir e /upsert
- Valida campos obrigatórios: `codigo_cliente_integracao`, `razao_social`
- Mapeia body Omie → insert na tabela `clientes`
- Retorna `clientes_status` com `codigo_status` e `descricao_status`

### POST /alterar
- Requer `codigo_cliente_integracao` ou `codigo_cliente_omie`
- Update parcial dos campos fornecidos

### POST /consultar
- Busca por `codigo_cliente_integracao` (= `codigo`) ou `codigo_cliente_omie` (= `id`)
- Retorna `clientes_cadastro` completo

### POST /excluir
- Soft delete: marca `status_bloqueio = 'INATIVO'`
- Retorna `clientes_status`

### POST /listar
- Paginação: `pagina`, `registros_por_pagina`
- Filtros: `clientesFiltro` (cnpj_cpf, razao_social, cidade, estado, email, inativo)
- Filtro por data: `filtrar_por_data_de/ate`
- Retorna `clientes_listfull_response` com array `clientes_cadastro`

### POST /listar-resumido
- Mesma paginação e filtros
- Retorna apenas: `codigo_cliente`, `codigo_cliente_integracao`, `razao_social`, `nome_fantasia`, `cnpj_cpf`

### POST /upsert-cpfcnpj
- Busca por `cnpj_cpf` ao invés de `codigo_cliente_integracao`
- Insert se não existe, update se existe

### POST /associar
- Vincula `codigo_cliente_omie` a `codigo_cliente_integracao`

Autenticação: `validateApiKey` em todas as rotas (exceto `/status`).

## 4. Documentação

Novo `docs/API_CLIENTES.md`.

## 5. API Tester & Portal

- Presets no `ApiTester.tsx`: Listar Clientes, Consultar Cliente, Incluir Cliente, Alterar Cliente, Excluir Cliente, Upsert Cliente
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/clientes-api/index.ts` | Criar |
| `docs/API_CLIENTES.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

