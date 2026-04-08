

# Restringir Visibilidade do Sidebar para Usuário ERP

## Problema

O usuário Daniel Vilanova vê **todo o menu de administração** (Segurança, Auditoria, Permissões, Governança Financeira, etc.) porque a condição do sidebar é:

```
isAdmin || hasModulePermission("integracao_erp")
```

Isso abre o grupo inteiro de administração para quem tem apenas permissão ERP.

Além disso, seções como "Geral" (Relatórios, Chat) e os módulos por categoria também aparecem sem restrição de permissão.

## Solução

### 1. `src/components/dashboard/AppSidebar.tsx` — Isolar o Portal ERP do bloco admin

**Separar** o item "Portal ERP" do grupo de Administração:

- O grupo "Administração" volta a ser `isAdmin` only
- Criar um bloco independente para o Portal ERP, visível apenas com `hasModulePermission("integracao_erp")` e **sem** ser admin (admins já veem dentro do bloco admin)

```tsx
// Grupo Admin — somente admins
{isAdmin && (
  <SidebarGroup>
    {/* ... todo o conteúdo admin como está, incluindo Portal ERP dentro */}
  </SidebarGroup>
)}

// Portal ERP independente — para não-admins com permissão
{!isAdmin && hasModulePermission("integracao_erp") && (
  <SidebarGroup>
    <SidebarMenu>
      <MenuItemLink to="/dashboard/integracao-erp" icon={Key} title="Portal ERP" />
    </SidebarMenu>
  </SidebarGroup>
)}
```

### 2. `src/components/dashboard/AppSidebar.tsx` — Ocultar seções irrelevantes

Os módulos por categoria já são filtrados por `showModule(m)` que verifica permissão. Preciso confirmar que a seção "Geral" (Relatórios, Chat) respeita permissões — caso contrário, ocultar para usuários que só têm acesso ERP.

Verificar `showModule` e a lógica de categorias para garantir que o usuário sem permissões a outros módulos veja apenas o Portal ERP.

## Resultado

- Daniel verá **apenas** o link "Portal ERP" no sidebar
- Admins continuam vendo tudo normalmente
- Sem impacto em outros usuários

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/dashboard/AppSidebar.tsx` | Separar Portal ERP do bloco admin; ocultar "Geral" para usuários sem módulos |

