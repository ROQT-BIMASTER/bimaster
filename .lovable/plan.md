

## Diagnóstico: Bug de Cache de Permissões

O módulo China está protegido corretamente no banco — Lucas Machado (vendedor) **não tem** permissão ao módulo "china" em nenhuma das 3 fontes (role, usuário, departamento). O problema é um **bug de cache no localStorage**.

### Causa Raiz

Em `src/contexts/PermissionsContext.tsx`, a função `restoreFromLocalStorage` (linha 32-44) restaura permissões cacheadas **sem verificar o `userId`**:

```text
Admin faz logout → Lucas faz login no mesmo navegador
  ↓
localStorage ainda tem cache do Admin (válido por 5 min)
  ↓
PermissionsProvider inicia com isAdmin=true, modules=[todos]
  ↓
Lucas vê TODOS os módulos (incluindo China) por alguns segundos
  ↓
Fetch real completa → corrige para vendedor
```

Se o fetch falhar (timeout, rede lenta) ou o safety timeout (5s) disparar antes, o cache do admin persiste e Lucas mantém acesso indevido.

### Correção

**Arquivo: `src/contexts/PermissionsContext.tsx`**

1. **`restoreFromLocalStorage`** — Adicionar verificação do `userId` atual antes de aceitar o cache. Como no momento do boot não temos o userId imediatamente, a solução é:
   - Salvar o `userId` no localStorage junto com o cache (já é salvo no objeto)
   - No `PermissionsProvider`, NÃO usar o cache restaurado como estado inicial — iniciar sempre com `loading=true` e arrays vazios
   - Usar o cache apenas como otimização DEPOIS de confirmar que o `userId` da sessão confere

2. **Remover pré-população do estado inicial** — As linhas 54-59 que usam `initialCache` para pré-popular `modules`, `screens`, `role`, `isAdmin` devem ser removidas. O estado inicial deve ser sempre vazio/false.

3. **No `fetchPermissions`** — Antes de usar o cache do localStorage como fallback no safety timeout (linhas 69-76), verificar se o `userId` do cache confere com a sessão atual.

4. **No `SIGNED_OUT`** — Já limpa o localStorage (linha 238). Correto.

### Impacto

- Corrige vazamento de permissões entre sessões de usuários diferentes no mesmo navegador
- Usuários não-admin não verão mais módulos restritos temporariamente após login
- O loading spinner aparecerá por ~1-2s no boot (comportamento correto e seguro)

### Arquivo Modificado
- `src/contexts/PermissionsContext.tsx`

