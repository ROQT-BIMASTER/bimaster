
# Plano: Corrigir Acesso de Lucas Machado à Matriz Comparativa de Preços

## Problema Identificado

Lucas Machado tem as permissões corretas no banco de dados:
- **Módulo**: `precos` ✅
- **Tela**: `precos_matriz` ✅

Porém, existem dois problemas que impedem o acesso:

### Problema 1: Dashboard do Módulo exige tela errada
A página `TabelasPrecosModule.tsx` (dashboard do módulo de Preços) verifica a permissão da tela `fabrica_tabelas_preco`, que Lucas **não tem**. Isso causa redirecionamento imediato para `/dashboard`.

### Problema 2: Sidebar não mostra módulo sem acesso ao dashboard
Se o usuário não consegue acessar o dashboard do módulo, a navegação fica quebrada mesmo tendo acesso a sub-telas específicas.

## Solução Proposta

### 1. Ajustar verificação de permissão no TabelasPrecosModule
Alterar de verificar tela específica para verificar módulo ou qualquer tela do módulo:
- Verificar se tem acesso ao módulo `precos` **OU**
- Verificar se tem ao menos uma tela do módulo de preços

### 2. Adicionar tela `precos_dashboard` para Lucas (opcional)
Se quisermos que Lucas veja o dashboard completo, precisamos dar acesso a essa tela específica.

**OU**

### 3. Criar rota direta para Matriz (recomendado)
Como Lucas só precisa da Matriz Comparativa, podemos:
- Fazer o dashboard redirecionar para a primeira tela disponível do módulo
- Ou criar lógica que identifica a tela disponível e mostra apropriadamente

## Mudanças Técnicas

### Arquivo: `src/pages/modules/TabelasPrecosModule.tsx`
```typescript
// ANTES (linha 32-34):
if (!permissionsLoading && !hasPermission("fabrica_tabelas_preco")) {
  return <Navigate to="/dashboard" replace />;
}

// DEPOIS:
// Verificar se tem pelo menos uma tela do módulo de preços
const hasAnyPrecosPermission = hasPermission("precos_dashboard") || 
  hasPermission("precos_matriz") || 
  hasPermission("precos_tabelas") || 
  hasPermission("precos_aprovacao") || 
  hasPermission("precos_portal") || 
  hasPermission("precos_acesso");

if (!permissionsLoading && !hasAnyPrecosPermission) {
  return <Navigate to="/dashboard" replace />;
}
```

### Arquivo: `src/App.tsx`
Adicionar proteção de módulo na rota principal:
```typescript
// ANTES:
<Route path="/dashboard/precos" element={<ProtectedRoute><TabelasPrecosModule /></ProtectedRoute>} />

// DEPOIS:
<Route path="/dashboard/precos" element={
  <ProtectedRoute>
    <ModuleProtectedRoute moduleCode="precos">
      <TabelasPrecosModule />
    </ModuleProtectedRoute>
  </ProtectedRoute>
} />
```

## Resultado Esperado
Após as alterações:
1. O módulo "Tabelas de Preços" aparecerá no sidebar de Lucas Machado
2. Lucas poderá acessar o dashboard do módulo
3. Dentro do módulo, apenas a opção "Matriz Comparativa" estará visível (pois é a única tela que ele tem permissão)
4. A Matriz mostrará apenas as tabelas Deep, E-commerce e Clear conforme já configurado
