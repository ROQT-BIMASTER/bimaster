
# Correcao: Visualizar como Usuario

## Problemas Encontrados

| # | Problema | Detalhe |
|---|---|---|
| 1 | Role "gerente" sem badge | 6 usuarios com role gerente aparecem sem badge propria (cai no default) |
| 2 | Usuarios inativos misturados | 30 inativos entre 123 usuarios, sem filtro — lista poluida |
| 3 | Sem filtros de role ou status | Admin faz scroll manual em 120+ usuarios |
| 4 | Sem info de empresa vinculada | Multi-tenant ativo mas sem mostrar empresas |
| 5 | Admin aparece na propria lista | Pode selecionar a si mesmo |
| 6 | Banner tambem ignora "gerente" | Mesma inconsistencia na barra superior |

## Correcoes

### `src/components/admin/ImpersonationSelector.tsx` — Reescrever
- Adicionar badge "Gerente" (cor laranja) e "Cliente" (ciano)
- Filtro dropdown por **status** (ativo/inativo/todos) — default: ativos
- Filtro dropdown por **role** (dinamico conforme roles existentes)
- Buscar e exibir empresas vinculadas (`user_empresas` + `empresas.nome_fantasia`) inline
- Mostrar departamento e empresas como tags compactas abaixo do email
- Excluir o admin logado da lista
- Contagem de resultados filtrados

### `src/components/admin/ImpersonationBanner.tsx` — Ajustar
- Adicionar case "gerente" no `getRoleBadge` com badge laranja
- Manter consistencia visual com o seletor

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/admin/ImpersonationSelector.tsx` | Reescrever com filtros, roles corretas, empresas |
| `src/components/admin/ImpersonationBanner.tsx` | Adicionar badge gerente |
