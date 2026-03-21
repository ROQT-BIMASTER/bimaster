

# API Empresas (Consultar + Listar) — Padronização Omie

## Resumo

Criar Edge Function `empresas-api` com 2 rotas read-only seguindo o padrão Omie. Usa tabela `empresas` existente (id, nome, cnpj, uf, ativa, created_at). Sem migration necessária — os campos Omie sem correspondência retornam vazio/default.

## 1. Nova Edge Function: `empresas-api`

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/consultar` | ConsultarEmpresa | Consulta por código |
| POST | `/listar` | ListarEmpresas | Lista paginada |
| GET | `/status` | — | Health check |

## 2. Mapeamento de Campos (empresas → Omie)

| Campo Omie | Coluna DB | Observação |
|---|---|---|
| `codigo_empresa` | `id` | SERIAL |
| `codigo_empresa_integracao` | — | Vazio (não existe) |
| `cnpj` | `cnpj` | — |
| `razao_social` | `nome` | — |
| `nome_fantasia` | `nome` | Mesmo que razao_social |
| `estado` | `uf` | — |
| `inativa` | `ativa` → `"S"/"N"` | Invertido: `ativa=true` → `inativa="N"` |
| `inclusao_data` | `created_at` | Formatado |
| Demais campos Omie | — | Retornados como string vazia |

## 3. Lógica por Endpoint

### POST /consultar
- Requer `codigo_empresa` (integer = id)
- Retorna `empresas_cadastro` com todos os campos Omie (maioria vazia)

### POST /listar
- Paginação: `pagina`, `registros_por_pagina`
- Filtros deprecados no Omie — implementamos apenas paginação básica
- Retorna `empresas_list_response` com array `empresas_cadastro`

Autenticação: `validateApiKey`.

## 4. Documentação & UI

- Novo `docs/API_EMPRESAS.md`
- Presets no `ApiTester.tsx` (Consultar Empresa, Listar Empresas)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/empresas-api/index.ts` | Criar |
| `docs/API_EMPRESAS.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

