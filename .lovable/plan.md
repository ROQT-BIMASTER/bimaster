

## Diagnóstico: Tela branca no carregamento inicial

### Causa raiz identificada

Existe uma **race condition** entre `AuthContext` e `PermissionsContext` durante a restauração da sessão existente:

1. `checkAuth()` executa, obtém sessão, faz fetch, seta `loading = false`
2. `onAuthStateChange` dispara `SIGNED_IN` (restauração automática do Supabase)
3. **AuthContext seta `loading = true` novamente** (linha 208)
4. **PermissionsContext seta `loading = true` novamente** (linha 225)
5. `ProtectedRoute` depende de `authLoading || permLoading` — ambos voltam a `true`
6. A tela mostra o spinner ou fica branca até os fetches assíncronos completarem de novo
7. Com rede lenta, isso pode demorar vários segundos

O F5 funciona porque o `sessionStorage` e caches já estão populados, tornando o ciclo mais rápido.

### Plano de correção

#### 1. AuthContext — evitar re-loading na restauração de sessão

- Adicionar flag `initialCheckDoneRef` que rastreia se o `checkAuth()` inicial já completou
- No handler de `SIGNED_IN`, **não setar `loading = true`** se o `checkAuth` inicial já terminou para o **mesmo usuário** (é apenas restauração de sessão, não login novo)
- Só setar `loading = true` quando for um login genuinamente novo (userId diferente ou `initialCheckDoneRef === false`)

#### 2. PermissionsContext — mesma proteção

- Adicionar flag `initialFetchDoneRef` 
- No handler de `SIGNED_IN`, verificar se já temos permissões carregadas para o mesmo usuário no cache global
- Se sim, não resetar `loading = true` — apenas fazer refresh silencioso em background (sem bloquear UI)

#### 3. ProtectedRoute — fallback com timeout

- Adicionar safety timeout de 5s: se loading persistir, usar dados do cache e liberar a tela
- Isso garante que mesmo em cenários extremos o usuário não fique preso na tela branca

### Arquivos a editar
- `src/contexts/AuthContext.tsx`
- `src/contexts/PermissionsContext.tsx`  
- `src/components/auth/ProtectedRoute.tsx` (safety timeout)

