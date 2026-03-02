

## Diagnóstico: Tela de "Carregando..." infinita após login

### Causa raiz

O problema **não está mais no AuthContext** (já corrigido). Agora o gargalo é o **PermissionsContext**, conforme confirmam os logs:

```
[PermissionsContext] Safety timeout triggered - forcing loading to false
```

Isso aparece 12 segundos após o carregamento da página — o safety timeout do PermissionsContext é de 12s.

#### Sequência do problema:

1. Página carrega → `fetchPermissions()` é chamado no mount
2. `onAuthStateChange` dispara `SIGNED_IN` (restauração de sessão) quase ao mesmo tempo
3. No handler, `initialFetchDone` é `false` (variável local, nunca foi setada porque o fetch do passo 1 ainda não terminou), então cai no `else` → **`setLoading(true)` novamente** + nova chamada `fetchPermissions(true)`
4. Agora há **duas chamadas** ao RPC `get_all_user_permissions` correndo em paralelo
5. Se o RPC estiver lento ou falhar, `loading` fica `true` por **12 segundos** até o safety timeout disparar
6. Durante esses 12s, `ProtectedRoute` mostra spinner (espera `permLoading` ficar `false`), e `DashboardLayout` **também** mostra spinner (espera `authLoading` via `useAuth`)

O resultado: usuário vê spinner por 12 segundos ou mais, dando a impressão de que o sistema travou.

### Plano de correção

#### 1. PermissionsContext — Nunca bloquear UI no SIGNED_IN/TOKEN_REFRESHED

No `onAuthStateChange`, **nunca** chamar `setLoading(true)`. A atualização de permissões deve ser feita em background sem bloquear a interface:

- Se já tem cache (localStorage ou memória), mostrar dados do cache imediatamente
- Fazer refresh silencioso em background
- Só atualizar o state quando os novos dados chegarem

#### 2. PermissionsContext — Evitar fetch duplicado

O `fetchPermissions()` do mount e o do `onAuthStateChange` rodam quase simultaneamente. Adicionar um flag `fetchInProgressRef` para evitar chamadas duplicadas — se já há um fetch em andamento, ignorar a nova chamada.

#### 3. Reduzir safety timeout

12 segundos é muito longo para o usuário esperar. Com as correções acima o timeout raramente será atingido, mas reduzi-lo para 5 segundos garante uma experiência melhor caso ocorra.

### Arquivos a modificar

- `src/contexts/PermissionsContext.tsx` — Remover `setLoading(true)` do handler de SIGNED_IN, evitar fetch duplicado, reduzir timeout

