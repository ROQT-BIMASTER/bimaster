

## Diagnóstico: Permissões Excessivas para Lucas Machado

### Problema Identificado

O problema **não foi causado pelas alterações recentes** (Pasta Digital, Processo Unificado, Orquestração). Essas mudanças apenas adicionaram componentes dentro de páginas já protegidas por `ModuleRoute`.

O problema está na **configuração do banco de dados**: a tabela `role_permissoes_modulos` concede automaticamente 3 módulos a **todos** os usuários com role `vendedor`:

| Fonte | Módulo |
|---|---|
| role `vendedor` | `dashboard` |
| role `vendedor` | `prospects` |
| role `vendedor` | `comercial` |
| individual | `precos` (correto) |

Lucas deveria ver **apenas `precos`**, mas herda `prospects`, `comercial` e `dashboard` porque é `vendedor`.

### Solução

Remover as permissões de módulo da role `vendedor` na tabela `role_permissoes_modulos`, mantendo apenas as permissões individuais por usuário (via `usuario_permissoes_modulos`).

**Ação**: Executar migration para remover os registros de `role_permissoes_modulos` onde `role = 'vendedor'` para os módulos `prospects` e `comercial`.

> **Nota**: `dashboard` provavelmente deve permanecer para que vendedores possam acessar a tela inicial. Mas `prospects` e `comercial` devem ser atribuídos individualmente.

### Impacto

Todos os usuários `vendedor` que **dependem** dessas permissões de role perderão acesso a `prospects` e `comercial`. Será necessário verificar quais vendedores realmente precisam desses módulos e atribuir individualmente.

### Arquivos

| Arquivo | Ação |
|---|---|
| 1 migration SQL | Remover `prospects` e `comercial` de `role_permissoes_modulos` para role `vendedor` |

### Alternativa Mais Segura

Se não quiser impactar outros vendedores, a opção é **remover a permissão de role para Lucas especificamente** criando uma regra de exceção, ou migrar o Lucas para uma role diferente (ex: `consultor_precos`).

