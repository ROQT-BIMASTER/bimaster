

# API Anexos de Documentos — Padronização Omie

## Resumo

Criar a API de Anexos de Documentos seguindo o padrão Omie, com operações de inclusão (base64), consulta, obtenção (link download), listagem e exclusão de anexos vinculados a qualquer tabela (contas_pagar, contas_receber, etc.). Inclui nova tabela `documento_anexos`, Edge Function dedicada, storage bucket e documentação.

## 1. Nova tabela `documento_anexos`

Tabela genérica para anexos vinculados a qualquer entidade (como o Omie usa `cTabela` + `nId`):

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | ID interno |
| `empresa_id` | TEXT NOT NULL | Empresa |
| `c_cod_int_anexo` | VARCHAR(20) | Código de integração do anexo |
| `c_tabela` | VARCHAR(100) | Tabela de origem (contas_pagar, contas_receber, etc.) |
| `n_id` | BIGINT | ID do documento na tabela de origem |
| `n_id_anexo` | BIGINT | ID do anexo no Omie |
| `c_nome_arquivo` | VARCHAR(100) | Nome do arquivo |
| `c_tipo_arquivo` | VARCHAR(10) | Tipo/extensão do arquivo |
| `c_md5` | VARCHAR(32) | MD5 do arquivo |
| `storage_path` | TEXT | Caminho no Storage bucket |
| `file_size` | BIGINT | Tamanho em bytes |
| `importado_api` | BOOLEAN | Importado pela API |
| `created_at` | TIMESTAMPTZ | Criação |
| `updated_at` | TIMESTAMPTZ | Última alteração |

Indexes: `(empresa_id, c_tabela, n_id)` para listagem, `(empresa_id, c_cod_int_anexo)` unique para upsert.

Storage bucket: `documento-anexos` (privado), com RLS para usuários autenticados.

## 2. Nova Edge Function: `anexos-api`

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| POST | `/incluir` | Upload de anexo (base64 zip) | IncluirAnexo |
| GET | `/consultar` | Consultar metadados do anexo | ConsultarAnexo |
| GET | `/obter` | Obter link de download (signed URL) | ObterAnexo |
| GET | `/listar` | Listar anexos de um documento (paginado) | ListarAnexo |
| DELETE | `/excluir` | Excluir anexo | ExcluirAnexo |
| GET | `/status` | Health check | — |

Fluxo do `/incluir`: recebe `cArquivo` (conteúdo base64 do ZIP), valida MD5, salva no Storage bucket `documento-anexos`, registra metadados na tabela.

Fluxo do `/obter`: gera signed URL (expiração 1h) e retorna com `cLinkDownload` e `dDtExpiracao`.

Respostas seguem o padrão Omie com `cCodStatus`/`cDesStatus`.

## 3. Documentação

Novo `docs/API_ANEXOS.md` com endpoints, tipos, exemplos e notas sobre formato base64/zip.

## 4. API Tester & Portal

- Presets no `ApiTester.tsx` (Incluir, Consultar, Obter, Listar, Excluir)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar — tabela `documento_anexos` + RLS + storage bucket |
| `supabase/functions/anexos-api/index.ts` | Criar — nova Edge Function |
| `docs/API_ANEXOS.md` | Criar — documentação |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

