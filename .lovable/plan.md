

## Auditoria Completa do Sistema de Permissões

### Status do Banco de Dados
Verificado: **0 permissões** para China e Projetos para não-admins. O banco está limpo.

### Vulnerabilidades Encontradas no Frontend

Todas em `src/contexts/PermissionsContext.tsx`:

#### 1. Troca de Usuário sem Reset de Estado (CRÍTICO)
Quando um usuário faz logout e outro faz login sem recarregar a página, o handler `SIGNED_IN` (linha 233) chama `fetchPermissions(true)` **sem limpar o estado React primeiro**. Durante os ~1-2s do fetch, o novo usuário herda os módulos/screens/isAdmin do usuário anterior.

**Correção**: No handler `SIGNED_IN`, resetar estado imediatamente antes de buscar:
```typescript
if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
  // Reset state immediately to prevent permission leakage
  globalPermissionsCache = null;
  setModules([]);
  setScreens([]);
  setRole(null);
  setIsAdmin(false);
  setLoading(true);
  fetchPermissions(true);
}
```

#### 2. `fetchInProgressRef` Bloqueia Refresh Forçado (MÉDIO)
A flag `fetchInProgressRef` (linha 87) impede fetches concorrentes, mas também bloqueia chamadas com `forceRefresh=true`. Se um fetch inicial estava em andamento quando o `SIGNED_IN` dispara, a busca forçada é descartada silenciosamente e o estado fica estagnado.

**Correção**: Permitir que `forceRefresh` ignore o guard:
```typescript
if (fetchInProgressRef.current && !forceRefresh) {
  return;
}
```

#### 3. Safety Timeout Mantém Estado Antigo (BAIXO)
Se o safety timeout (5s) dispara e não encontra cache válido para o userId atual, ele apenas seta `loading=false` sem limpar o estado. Se havia dados de outro usuário no React state, eles permanecem visíveis.

**Correção**: Resetar estado explicitamente quando não há fallback válido:
```typescript
if (fallback && currentUserId && fallback.userId === currentUserId) {
  // use cached data
} else {
  // Clear any stale state
  setModules([]);
  setScreens([]);
  setRole(null);
  setIsAdmin(false);
}
setLoading(false);
```

### Arquivo Modificado
- `src/contexts/PermissionsContext.tsx` — 3 correções pontuais

### Arquivos Já Seguros (sem ação necessária)
- **App.tsx**: Todas as rotas de China e Projetos protegidas com `ModuleRoute`
- **AppSidebar.tsx**: `showModule()` já valida permissões automaticamente
- **ImpersonationContext.tsx**: Já corrigido na sessão anterior
- **permissions-optimizer.ts**: Não importado em nenhum lugar (código morto)
- **Banco de dados**: 0 permissões para não-admins em china/projetos

