
# Plano de Correção: Sistema de Impersonação

## Resumo da Análise

A análise do sistema de impersonação revelou **3 falhas críticas** que precisam ser corrigidas para garantir que a visualização "Como Usuário" funcione corretamente em todo o sistema.

---

## Falhas Identificadas

### 1. Violação das Regras de Hooks no DashboardLayout

**Arquivo:** `src/components/dashboard/DashboardLayout.tsx`

**Problema:** O hook `useImpersonation()` está sendo chamado **depois** de um retorno condicional (`if (!session) return null`), o que viola as regras do React que exigem que hooks sejam sempre chamados na mesma ordem.

```text
Código problemático (linha 69):
┌────────────────────────────────────────┐
│ if (!session) {                        │
│   return null;  ← retorno condicional  │
│ }                                      │
│                                        │
│ const { isImpersonating } = ...        │
│         ↑                              │
│   Hook chamado após return condicional │
└────────────────────────────────────────┘
```

**Risco:** Comportamento imprevisível, possível crash em certas situações.

---

### 2. Dashboard.tsx Ignora Impersonação

**Arquivo:** `src/pages/Dashboard.tsx`

**Problema:** O Dashboard usa `usePermissions()` diretamente em vez de usar os hooks que respeitam impersonação (`useModulePermissions` ou `useImpersonation`).

```text
Código atual:
const { hasModulePermission, isAdmin, ... } = usePermissions();
                              ↑
           isAdmin sempre será do usuário REAL (admin)
           não do usuário sendo visualizado
```

**Consequência:**
- `isAdmin` sempre reflete o admin real, não o usuário impersonado
- `hasModulePermission` também ignora impersonação
- O widget `MetricasDistribuicao` aparece mesmo quando visualizando como não-admin

---

### 3. ImpersonationSelector Usa isAdmin do Contexto Errado

**Arquivo:** `src/components/admin/ImpersonationSelector.tsx`

**Problema:** O componente verifica `isAdmin` de `usePermissions()` para decidir se mostra o botão. Isso está **correto** (apenas admins reais devem ver o botão), mas durante a impersonação pode haver inconsistência visual.

**Status:** Funcionando corretamente, mas vale documentar que é intencional.

---

## Plano de Correção

### Correção 1: Mover Hook para o Topo (DashboardLayout.tsx)

Mover a chamada de `useImpersonation()` para o início do componente, antes de qualquer retorno condicional:

```text
// ANTES (errado)
export const DashboardLayout = () => {
  const { session, ... } = useAuth();
  ...
  if (!session) return null;  
  const { isImpersonating } = useImpersonation(); // ❌ Após return
  ...
}

// DEPOIS (correto)
export const DashboardLayout = () => {
  const { session, ... } = useAuth();
  const { isImpersonating } = useImpersonation(); // ✅ Antes de returns
  ...
  if (!session) return null;
  ...
}
```

---

### Correção 2: Atualizar Dashboard.tsx para Usar Impersonação

Substituir o uso direto de `usePermissions()` pelos hooks que respeitam impersonação:

```text
// ANTES
const { hasModulePermission, isAdmin, ... } = usePermissions();

// DEPOIS  
const { hasModulePermission } = useModulePermissions();
const { impersonatedPermissions, isImpersonating } = useImpersonation();

// isAdmin efetivo: usa impersonação se ativo
const effectiveIsAdmin = isImpersonating && impersonatedPermissions 
  ? impersonatedPermissions.isAdmin 
  : realIsAdmin;
```

Isso garante que:
- `hasModulePermission` respeite a impersonação (já implementado no hook)
- `isAdmin` mostre corretamente se o usuário impersonado é admin
- `MetricasDistribuicao` só apareça quando o usuário efetivo for admin

---

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/components/dashboard/DashboardLayout.tsx` | Reordenar hooks |
| `src/pages/Dashboard.tsx` | Usar hooks com impersonação |

---

## Benefícios

1. **Conformidade com React:** Hooks sempre na mesma ordem
2. **Impersonação completa:** Dashboard reflete permissões do usuário visualizado
3. **Experiência consistente:** Admin vê exatamente o que cada usuário vê
4. **Sem breaking changes:** Comportamento normal (sem impersonação) permanece idêntico

---

## Seção Técnica

### Dependências Entre Arquivos

O sistema de impersonação segue esta hierarquia:

```text
PermissionsContext (base)
       ↓
ImpersonationContext (wrapper)
       ↓
┌──────────────────────────────────────┐
│ useModulePermissions (já atualizado) │
│ useScreenPermissions (já atualizado) │
└──────────────────────────────────────┘
       ↓
Componentes (precisam usar os hooks corretos)
```

### Teste de Validação

Após implementação, testar:
1. Fazer login como admin
2. Clicar em "Visualizar como Usuário" e selecionar um vendedor
3. Verificar que:
   - Sidebar mostra apenas módulos do vendedor
   - Dashboard NÃO mostra MetricasDistribuicao
   - Módulos corretos aparecem nos cards
4. Clicar em "Sair" e verificar que tudo volta ao normal
