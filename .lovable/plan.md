# Restringir a Central de Aprovações de Projetos

## Contexto

Hoje o item "Central de Aprovações" do submenu **Projetos** (`AppSidebar.tsx:1160`) é renderizado para **todos** os usuários que veem o módulo. A rota `/dashboard/central/aprovacoes` (`App.tsx:677`) também não tem nenhum guard — qualquer usuário autenticado consegue entrar digitando a URL.

A página atual (`src/pages/CentralAprovacoes.tsx`) é a fila unificada baseada em `CentralTrabalhoModulo` (origem `aprovacoes`).

A regra desejada é: a Central de Aprovações deve aparecer apenas para **Gerentes**, **Coordenadores** (mapeado no sistema como `supervisor`) ou para usuários a quem o Gerente liberou explicitamente o acesso (permissão individual de tela).

O sistema já tem o mecanismo certo para isso:

- `telas_sistema` (catálogo de telas)
- `role_permissoes_telas` (libera por perfil)
- `usuario_permissoes_telas` (libera por usuário individual)
- `ScreenProtectedRoute` + `hasScreenPermission` (guard de rota e leitura no UI)

## O que será feito

### 1. Cadastrar a tela no catálogo (migration)

Criar uma nova tela no catálogo dedicada à Central de Aprovações:

- `codigo`: `projetos_aprovacoes_central`
- `nome`: `Central de Aprovações`
- `modulo_codigo`: `projetos`
- `ativo`: `true`

Liberar por padrão para os perfis `gerente` e `supervisor` em `role_permissoes_telas` (admin já passa por bypass). Vendedor **não recebe por role** — ganha acesso só via `usuario_permissoes_telas` quando o Gerente decidir.

A tela administrativa para o Gerente liberar por usuário (Configurações → Acessos) já existe e usa `usuario_permissoes_telas` como fonte; ela passará a listar `projetos_aprovacoes_central` automaticamente.

### 2. Proteger a rota (`src/App.tsx`, linha 677)

Envolver a rota `/dashboard/central/aprovacoes` com `ModuleScreenRoute` apontando para a nova tela:

```tsx
<Route
  path="/dashboard/central/aprovacoes"
  element={
    <ModuleScreenRoute moduleCode="projetos" screenCode="projetos_aprovacoes_central">
      <CentralAprovacoes />
    </ModuleScreenRoute>
  }
/>
```

Isso garante que digitar a URL diretamente também é bloqueado para quem não tem permissão.

### 3. Esconder o item no sidebar (`src/components/dashboard/AppSidebar.tsx`, linha 1160)

Envolver o `MenuItemLink` da Central de Aprovações com a checagem de `hasScreenPermission` (já disponível no AppSidebar via `useImpersonation()`):

```tsx
{hasScreenPermission("projetos_aprovacoes_central") && (
  <MenuItemLink to="/dashboard/central/aprovacoes" icon={Shield} title="Central de Aprovações" />
)}
```

Assim:
- Admin → vê (bypass admin já existente).
- Gerente → vê (role).
- Supervisor / Coordenador → vê (role).
- Vendedor / outros → só vê se o Gerente cadastrar liberação individual em `usuario_permissoes_telas`.

A impersonação continua funcionando: `hasScreenPermission` do `ImpersonationContext` já consulta as permissões do usuário impersonado.

## Detalhes técnicos (SQL da migration)

```sql
-- 1) Cadastrar a tela
INSERT INTO public.telas_sistema (codigo, nome, modulo_codigo, ativo)
VALUES ('projetos_aprovacoes_central', 'Central de Aprovações', 'projetos', true)
ON CONFLICT (codigo) DO NOTHING;

-- 2) Liberar por role para gerente e supervisor
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT r::app_role, t.id
FROM unnest(ARRAY['gerente','supervisor']) r
CROSS JOIN public.telas_sistema t
WHERE t.codigo = 'projetos_aprovacoes_central'
ON CONFLICT DO NOTHING;
```

## Validação

- Conferir no banco que a tela foi criada e que `role_permissoes_telas` tem linhas para `gerente` e `supervisor`.
- Como admin: o item aparece e a rota abre.
- Impersonando um vendedor sem liberação: o item some e a URL direta cai em `AccessDenied`.
- Liberando individualmente esse vendedor em Configurações → Acessos: o item passa a aparecer e a rota abre.
