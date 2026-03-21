

# Bloquear Acesso: Central de Inteligência + Tela de Endpoints (Portal ERP)

## Situação Atual

1. **Central de Inteligência** (sidebar lines 1110-1143): Renderizada **sem nenhuma verificação de permissão** — visível para todos os usuários. As rotas no `App.tsx` usam `ModuleRoute moduleCode="comercial"`, mas o sidebar não verifica `hasModulePermission`.

2. **Portal ERP / Integração ERP** (sidebar line 1308): Já está dentro do bloco `{isAdmin && (...)}`, visível apenas para admins. A rota usa `ScreenRoute screenCode="admin"`.

## Plano

### 1. Sidebar — Ocultar Central de Inteligência para todos

Envolver o bloco da Central de Inteligência (linhas 1110-1143 do `AppSidebar.tsx`) com uma verificação de permissão de módulo:

```tsx
{hasModulePermission("central_inteligencia") && (
  <SidebarGroup>... Central de Inteligência ...</SidebarGroup>
)}
```

Como nenhum usuário terá a permissão `central_inteligencia` atribuída inicialmente, o módulo ficará oculto para todos.

### 2. Sidebar — Ocultar Portal ERP para todos (inclusive admins)

O Portal ERP (linha 1305-1318) está dentro do bloco `{isAdmin && ...}`. Adicionar uma condição extra para ocultá-lo:

```tsx
{isAdmin && hasModulePermission("integracao_erp") && (
  <SidebarMenuItem>... Portal ERP ...</SidebarMenuItem>
)}
```

### 3. App.tsx — Proteger rotas da Central de Inteligência

Alterar as 8 rotas da Central de Inteligência (linhas 501-508) de `moduleCode="comercial"` para `moduleCode="central_inteligencia"`:

```tsx
<Route path="/dashboard/painel-executivo" 
  element={<ModuleRoute moduleCode="central_inteligencia"><PainelExecutivo /></ModuleRoute>} />
```

### 4. App.tsx — Proteger rota do Portal ERP

A rota `/dashboard/integracao-erp` (linha 621) já usa `screenCode="admin"`. Adicionaremos também verificação de módulo:

```tsx
<Route path="/dashboard/integracao-erp" 
  element={<ModuleRoute moduleCode="integracao_erp"><ScreenRoute screenCode="admin"><IntegracaoERP /></ScreenRoute></ModuleRoute>} />
```

### 5. Registrar módulos na tabela `modulos_sistema` (migration)

Inserir os novos módulos para que possam ser atribuídos futuramente via painel de permissões:

```sql
INSERT INTO modulos_sistema (codigo, nome, descricao, ativo) VALUES
  ('central_inteligencia', 'Central de Inteligência', 'Dashboards analíticos de vendas', true),
  ('integracao_erp', 'Integração ERP', 'Portal de APIs e endpoints ERP', true)
ON CONFLICT (codigo) DO NOTHING;
```

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `src/components/dashboard/AppSidebar.tsx` | Ocultar Central de Inteligência + Portal ERP |
| `src/App.tsx` | Trocar moduleCode das 8 rotas + proteger integracao-erp |
| Migration SQL | Registrar módulos `central_inteligencia` e `integracao_erp` |

## Resultado

- Nenhum usuário verá a Central de Inteligência ou o Portal ERP no sidebar
- Acesso direto via URL será bloqueado (ModuleRoute nega)
- Quando quiser liberar, basta atribuir a permissão do módulo ao usuário desejado

