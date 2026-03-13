

# Adicionar acesso aos Relatórios Técnicos no Sidebar

## Problema
Os relatórios existem e funcionam, mas não há link para eles em nenhum menu. A equipe não consegue encontrá-los sem digitar a URL manualmente.

## Solução
Adicionar dois links no footer do sidebar (junto a LGPD e Configurações), visíveis apenas para admins:

- **Rel. Segurança** → `/dashboard/relatorio-seguranca`
- **Rel. Desenvolvimento** → `/dashboard/relatorio-desenvolvimento`

## Implementação

### Arquivo: `src/components/dashboard/AppSidebar.tsx`

Adicionar dois `SidebarMenuItem` dentro do bloco `{isAdmin && (...)}` existente (linhas 1128-1145), logo após o link LGPD:

1. Link "Rel. Segurança" com ícone `Shield` → `/dashboard/relatorio-seguranca`
2. Link "Rel. Desenvolvimento" com ícone `Package` → `/dashboard/relatorio-desenvolvimento`

Ambos seguem o mesmo padrão visual já usado (NavLink + cn + bg-sidebar-accent).

### Impacto
- Apenas 1 arquivo modificado
- Sem migração de BD
- Visível somente para admins

