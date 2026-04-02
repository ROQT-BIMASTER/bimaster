

# Fix: Botão Voltar Redireciona para Tela de Bloqueio

## Causa Raiz

O `ProtectedRoute.tsx` tem um **safety timeout de 5s** que força a renderização mesmo quando os dados de autenticação ainda não carregaram. Quando o timeout dispara e `loading` ainda é `true`, o guard avalia `isActive` e `approved` com valores potencialmente desatualizados ou padrão, causando redirecionamento incorreto para `/usuario-bloqueado`.

Fluxo do bug:
```text
1. Usuário clica "Voltar" (navigate(-1))
2. React Router navega para rota anterior
3. AuthContext/PermissionsContext entram brevemente em loading=true
4. Safety timeout dispara → timedOut=true
5. Guard avalia isActive com valor stale → false
6. Redireciona para /usuario-bloqueado ❌
```

## Correção

Modificar `ProtectedRoute.tsx` para que, quando o timeout disparar durante loading, **só faça o check de sessão** (redirect para login se não há sessão). Os checks de `approved` e `isActive` devem ser ignorados durante o timeout, pois os valores não são confiáveis. O guard real será avaliado assim que `loading` se tornar `false` normalmente.

## Alteração

| Arquivo | Ação |
|---------|------|
| `src/components/auth/ProtectedRoute.tsx` | Quando `timedOut && loading`: verificar apenas sessão, não `approved`/`isActive`. Permitir passagem temporária até dados carregarem de fato. |

Lógica proposta:
```tsx
// Se timeout mas ainda loading - apenas verificar sessão
if (timedOut && loading) {
  if (!session) {
    return <Navigate to="/auth/login" replace />;
  }
  // Permitir acesso temporário - guards reais avaliam quando loading=false
  return <>{children}</>;
}

// Guards normais (quando loading=false)
if (!session) return <Navigate to="/auth/login" replace />;
if (!approved) return <Navigate to="/aguardando-aprovacao" replace />;
if (!isActive) return <Navigate to="/usuario-bloqueado" replace />;
if (isCliente) return <Navigate to="/portal/precos" replace />;
```

Zero migrations. Uma única alteração de ~10 linhas.

