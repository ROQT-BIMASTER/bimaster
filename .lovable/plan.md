

# Plano: Controle de Permissões por Módulo

## Resumo
Criar um sistema complementar de gerenciamento de permissões focado em cada módulo individualmente, com página índice e página de detalhe por módulo. Apenas arquivos novos serão criados + adição de rotas e link no App.tsx.

## Estrutura de dados existente (não será alterada)
- `modulos_sistema`: id, codigo, nome, descricao, icone, ordem, ativo
- `telas_sistema`: id, codigo, nome, modulo_codigo (FK → modulos_sistema.codigo), rota, icone, ordem, ativo
- `usuario_permissoes_modulos`: id, usuario_id, modulo_id (FK → modulos_sistema.id)
- `usuario_permissoes_telas`: id, usuario_id, tela_id (FK → telas_sistema.id)
- `profiles`: id, nome, email, aprovado
- `user_roles`: user_id, role

## Arquivos a criar

### 1. `src/config/module-screens-map.ts`
Constante de mapeamento estático módulo → telas. Porém, como a tabela `telas_sistema` já tem `modulo_codigo` como FK, o componente principal buscará o mapeamento dinamicamente do banco. Este arquivo servirá como fallback/referência e para tipagem.

### 2. `src/components/configuracoes/permissoes-modulo/ModulePermissionsIndex.tsx`
Página índice (`/dashboard/configuracoes/permissoes-modulo`):
- Busca todos os módulos de `modulos_sistema` (ativo=true)
- Para cada módulo, faz count de `usuario_permissoes_modulos` para mostrar quantidade de usuários com acesso
- Cards com: nome, ícone, descrição, badge com contagem de usuários, link para `/dashboard/configuracoes/permissoes-modulo/:codigo`
- Filtro/busca por nome de módulo
- Apenas admins (verificado no componente + rota)

### 3. `src/components/configuracoes/permissoes-modulo/ModulePermissionsDetail.tsx`
Componente principal (`/dashboard/configuracoes/permissoes-modulo/:moduleCode`):

**Seção A — Usuários com acesso ao módulo:**
- Query: `usuario_permissoes_modulos` join `modulos_sistema` onde `modulos_sistema.codigo = moduleCode`, trazendo dados do `profiles`
- Lista tabular: avatar/nome, role, botão remover
- Botão "Adicionar Usuário" → Dialog com select de usuários que NÃO estão na lista
- Busca/filtro de usuários

**Seção B — Permissões de telas do módulo:**
- Query: `telas_sistema` onde `modulo_codigo = moduleCode`
- Para cada tela: lista de usuários com acesso (via `usuario_permissoes_telas`)
- Checkbox/Switch por usuário×tela
- Auto-grant do módulo pai ao conceder acesso a tela

**Seção C — Ações em lote:**
- "Dar acesso total" → insere módulo + todas as telas para usuários selecionados
- "Revogar acesso total" → deleta módulo + todas as telas do módulo
- Seleção múltipla de usuários via checkbox

**Regras de negócio:**
- Ao remover módulo: remove também todas as telas desse módulo para o usuário
- Ao conceder tela: verifica e concede módulo pai automaticamente
- `window.dispatchEvent(new Event("permissions-updated"))` após cada operação
- Toast de confirmação
- Loading states

### 4. `src/components/configuracoes/permissoes-modulo/AddUserDialog.tsx`
Dialog para adicionar usuário ao módulo. Select com busca, mostrando apenas usuários sem acesso.

### 5. `src/components/configuracoes/permissoes-modulo/BulkActionsSection.tsx`
Seção de ações em lote com seleção múltipla e botões de acesso total/revogação.

### 6. `src/pages/dashboard/configuracoes/PermissoesModulo.tsx`
Página wrapper com `DashboardLayout` que renderiza o índice ou detalhe baseado no param `:moduleCode`.

## Arquivos a modificar (apenas adições)

### 7. `src/App.tsx`
Adicionar 2 rotas (padrão existente com `ScreenRoute screenCode="admin"`):
```tsx
<Route path="/dashboard/configuracoes/permissoes-modulo" element={<ScreenRoute screenCode="admin"><PermissoesModulo /></ScreenRoute>} />
<Route path="/dashboard/configuracoes/permissoes-modulo/:moduleCode" element={<ScreenRoute screenCode="admin"><PermissoesModulo /></ScreenRoute>} />
```

### 8. `src/pages/Configuracoes.tsx`
Adicionar um card/link na seção admin apontando para "Permissões por Módulo" — visível apenas para `isAdmin`.

## Detalhes técnicos

- Queries usam `supabase.from("modulos_sistema")` com joins para contar permissões
- Para buscar usuários com acesso: primeiro busca o `modulo_id` via codigo, depois filtra `usuario_permissoes_modulos`
- Para telas: `telas_sistema.modulo_codigo` já faz a associação direta
- Badge verde = "Acesso Total" (módulo + todas as telas), amarelo = "Acesso Parcial" (módulo + algumas telas)
- Usa componentes shadcn/ui existentes: Card, Table, Badge, Dialog, Switch, Checkbox, Avatar

