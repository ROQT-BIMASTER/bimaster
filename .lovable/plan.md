

# Melhorias no Dialog de Membros do Projeto

## Problema
1. A lista de membros não tem scroll adequado quando há muitos membros
2. Qualquer coordenador pode gerenciar membros — Luana precisa ter papel de "gerente" com permissão de configurar acessos, enquanto outros membros não-autorizados não devem poder fazer alterações

## Plano

### 1. Scroll — `ProjetoMembrosDialog.tsx`
A ScrollArea já existe (linha 175) com `h-[60vh]`, mas o DialogContent tem `max-h-[90vh]`. Vou garantir que o overflow funcione corretamente ajustando o layout flex para que a ScrollArea ocupe o espaço restante de forma consistente.

### 2. Permissão de gerenciamento — `useProjetoMembros.ts`
Expandir a lógica de `isCoordinator` para incluir verificação de role global (admin ou gerente via `useUserRole`), permitindo que Luana (que é gerente/supervisora) tenha acesso de configuração mesmo sem ser coordenadora do projeto específico.

**Lógica atual:**
```ts
const isCoordinator = membros.some(
  m => m.user_id === user?.id && ["coordenador", "gestor_produto"].includes(m.papel)
);
```

**Nova lógica:**
```ts
const isCoordinator = membros.some(
  m => m.user_id === user?.id && ["coordenador", "gestor_produto"].includes(m.papel)
) || isAdmin || isGerente;
```

Isso garante que apenas admin, gerentes (Luana) e coordenadores do projeto possam adicionar/remover membros e configurar seções visíveis.

### Arquivos

| Componente | Alteração |
|-----------|-----------|
| `src/hooks/useProjetoMembros.ts` | Importar `useUserRole`, incluir admin/gerente no `isCoordinator` |
| `src/components/projetos/ProjetoMembrosDialog.tsx` | Ajustar ScrollArea e layout para scroll consistente |

