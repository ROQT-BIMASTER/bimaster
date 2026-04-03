
# Revisao: Visualizar como Usuario — Problemas e Correcoes

## Problemas Identificados

| # | Problema | Impacto |
|---|---|---|
| 1 | Role "gerente" nao tem badge (6 usuarios com essa role) | Gerentes aparecem como "vendedor" no seletor e no banner |
| 2 | Usuarios inativos aparecem misturados (30 de 123) | Lista poluida, dificil encontrar usuarios ativos |
| 3 | Sem filtro por role ou status | Admin precisa scroll manual em 123+ usuarios |
| 4 | Sem indicacao de quantos modulos/telas o usuario tem | Admin nao sabe o que vai ver antes de selecionar |
| 5 | Sem empresa vinculada visivel | Em multi-tenant, nao se sabe a qual empresa o usuario pertence |
| 6 | Banner de impersonacao tambem ignora "gerente" | Mesma inconsistencia no topo da tela |

## Correcoes

### `ImpersonationSelector.tsx` — Reescrever
- Adicionar badge para role "gerente" (cor laranja)
- Filtro por **status** (ativo/inativo) — default: apenas ativos
- Filtro por **role** (admin, gerente, supervisor, vendedor)
- Mostrar contagem de modulos e telas por usuario (via `get_all_user_permissions` em batch ou exibir ao hover)
- Buscar e exibir empresas vinculadas (`user_empresas` + `empresas`)
- Separar visualmente ativos de inativos
- Excluir o proprio admin logado da lista

### `ImpersonationBanner.tsx` — Ajustar
- Adicionar badge "Gerente" (laranja)
- Mostrar empresa(s) do usuario impersonado
- Mostrar departamento

### `ImpersonationContext.tsx` — Ajustar
- Armazenar empresas e departamento do usuario impersonado no estado persistido

## Arquivos a Alterar

| Arquivo | Acao |
|---|---|
| `src/components/admin/ImpersonationSelector.tsx` | Reescrever — filtros, gerente, empresas |
| `src/components/admin/ImpersonationBanner.tsx` | Alterar — gerente badge, empresa, departamento |
| `src/contexts/ImpersonationContext.tsx` | Alterar — armazenar empresa/departamento |

## Resultado

- Lista de usuarios reflete a realidade (roles corretas, filtros uteis)
- Admin tem visibilidade completa antes de selecionar um usuario
- Banner mostra contexto completo do usuario impersonado
