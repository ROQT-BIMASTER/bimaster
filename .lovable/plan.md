
# Correcao: Visualizar como Usuario — Desatualizado

## Problemas Encontrados

| # | Problema | Detalhe |
|---|---|---|
| 1 | Role "gerente" sem badge | 6 usuarios com role gerente aparecem como "vendedor" (badge inexistente) |
| 2 | Usuarios inativos misturados | 30 inativos entre 123, sem filtro — lista poluida |
| 3 | Sem filtros de role ou status | Admin faz scroll manual em 120+ usuarios |
| 4 | Sem info de empresa | Multi-tenant ativo mas sem mostrar empresas vinculadas |
| 5 | Sem info de departamento inline | Departamento so aparece como badge lateral |
| 6 | Admin aparece na lista dele mesmo | Pode selecionar a si proprio |
| 7 | Banner tambem ignora "gerente" | Mesma inconsistencia na barra de impersonacao |

## Correcoes

### `ImpersonationSelector.tsx` — Reescrever
- Adicionar badge "Gerente" (cor laranja)
- Filtro por status (ativo/inativo) — default: apenas ativos
- Filtro por role (admin, gerente, supervisor, vendedor)
- Mostrar departamento e empresas vinculadas por usuario
- Excluir o admin logado da lista
- Contagem de resultados filtrados

### `ImpersonationBanner.tsx` — Ajustar
- Adicionar badge "Gerente" (laranja) no switch de roles
- Consistencia com o seletor

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/admin/ImpersonationSelector.tsx` | Reescrever |
| `src/components/admin/ImpersonationBanner.tsx` | Ajustar getRoleBadge |
