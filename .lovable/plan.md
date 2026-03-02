

## Diagnóstico: Login fica processando infinitamente

### Causa raiz identificada

Há uma **race condition** no fluxo de login com múltiplos pontos de falha:

1. **Auth.tsx — dupla navegação conflitante**: O `LoginForm` navega para `/dashboard` após `signInWithPassword`, mas o `onAuthStateChange` do `Auth.tsx` **também** tenta navegar via `redirectBasedOnRole`. Se a query `user_roles` demorar, o `checkUser` trava e o safety timeout de 5s é acionado. Enquanto isso, o usuário já foi para `/dashboard`.

2. **AuthContext — `setLoading(true)` após login**: Quando o evento `SIGNED_IN` dispara no `AuthContext` (linhas 216-217), `isSessionRestore` é `false` para logins novos (porque `initialCheckDoneRef.current` ainda não foi setado). Isso força `loading = true`. Se `fetchApprovalStatus` demorar ou falhar silenciosamente, o loading fica `true` indefinidamente no dashboard — o `ProtectedRoute` mostra spinner por 5s, depois força render, mas o `DashboardLayout` **também** mostra seu próprio spinner baseado em `loading`.

3. **Sem timeout nas queries do Auth.tsx**: O `redirectBasedOnRole` faz query ao `user_roles` e potencialmente chama `registrar_acesso_portal` (RPC) sem timeout. Se qualquer uma travar, o fluxo inteiro para.

Os logs confirmam: `[Auth] Safety timeout triggered - forcing checking to false` — o checkUser nunca termina normalmente.

### Plano de correção

#### 1. Remover lógica duplicada de redirecionamento do Auth.tsx
- Remover o `onAuthStateChange` de `Auth.tsx` que chama `redirectBasedOnRole` — o `LoginForm` já faz a navegação. O `Auth.tsx` deve apenas verificar sessão existente no mount e redirecionar se já logado.
- Simplificar `checkUser` para não chamar `redirectBasedOnRole` com suas queries pesadas — usar apenas o redirecionamento simples baseado no `session` existente.

#### 2. Corrigir a race condition do `loading` no AuthContext
- No handler de `SIGNED_IN`, **não** chamar `setLoading(true)` se o `checkAuth` inicial já completou com sucesso. Usar o `initialCheckDoneRef` corretamente.
- Adicionar um safety timeout no AuthContext: se loading ficar true por mais de 8s após SIGNED_IN, forçar `setLoading(false)`.

#### 3. Tornar o LoginForm mais resiliente
- Após `signInWithPassword` com sucesso, navegar imediatamente sem esperar pelo `redirectBasedOnRole`.
- Consultar o role de forma assíncrona e redirecionar para a rota correta (portal vs dashboard) diretamente no LoginForm, com timeout de 3s como fallback para `/dashboard`.

#### 4. Adicionar timeout nas queries críticas de auth
- Usar `AbortController` ou `Promise.race` com timeout de 3s nas queries de `user_roles` e `registrar_acesso_portal` no Auth.tsx.

### Arquivos a modificar
- `src/pages/Auth.tsx` — simplificar, remover onAuthStateChange duplicado
- `src/components/auth/LoginForm.tsx` — adicionar redirecionamento baseado em role com timeout
- `src/contexts/AuthContext.tsx` — corrigir loading state e adicionar safety timeout

