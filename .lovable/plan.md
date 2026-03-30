

# Auditoria Final — Configuracoes de Usuarios e Permissoes para Producao

## Problemas Encontrados

### 1. EditarPerfil — `tipo_usuario` nunca chega do banco (BUG VISIVEL)

`Configuracoes.tsx` busca `profiles.*` e passa como `profile` para `EditarPerfil`. Mas a tabela `profiles` nao tem coluna `tipo_usuario` — o role vem de `user_roles`. Resultado: `profile.tipo_usuario` e sempre `undefined`, e o badge mostra "Usuario" para TODOS, incluindo admins. O `Configuracoes.tsx` busca `userRole` separadamente (linha 106-111) mas **nunca injeta** no objeto `profile`.

**Correcao**: Passar `userRole` como prop para `EditarPerfil`, ou popular `profile.tipo_usuario` com o valor de `userRole` antes de passar.

### 2. EditarPerfil — `handleSave` ainda grava campo `departamento` texto livre (BUG RESIDUAL)

Linha 96: `departamento: formData.departamento?.trim() || null` grava no campo texto `profiles.departamento`. Embora o campo de exibicao agora mostre o nome correto via `departamento_id`, se o usuario edita e salva, o campo texto e atualizado indevidamente. Como o campo esta disabled, isso so ocorre se `formData.departamento` tiver valor residual.

**Correcao**: Remover `departamento` do objeto de update no `handleSave`.

### 3. update-user-password — validacao de senha fraca no server

A edge function valida apenas `length >= 8` (linha 72) mas nao aplica regex de complexidade. O client valida com regex, mas um atacante pode chamar a function diretamente.

**Correcao**: Adicionar regex `(?=.*[a-z])(?=.*[A-Z])(?=.*\d)` na edge function.

### 4. GerenciamentoUsuarios — admin pode se auto-deletar

O `handleDeleteUser` chama `delete-admin-user` edge function que previne auto-delecao (linha 76-81 da function). Porem, o UI nao desabilita o botao de delete para o proprio admin logado, gerando erro confuso.

**Correcao**: Ocultar botao de delete quando `usuario.id === currentUserId`.

### 5. GerenciamentoUsuarios — admin pode se auto-rebaixar

Na edicao, um admin pode mudar seu proprio role para "vendedor", perdendo acesso a tudo. Nao ha protecao client-side nem server-side contra isso.

**Correcao**: Desabilitar campo de role quando editando o proprio usuario.

### 6. GerenciamentoUsuarios — dialog de edicao nao limpa erros anteriores

Ao abrir o dialog para editar apos uma tentativa de criacao com erros, os `errors` permanecem visíveis do formulario anterior.

**Correcao**: Limpar `setErrors({})` em `handleEditUser` e no `onClick` de "Novo Usuario".

### 7. permissions-cache.ts vs PermissionsContext — duplicacao ativa

`permissions-cache.ts` (5min TTL) e usada em 3 componentes de configuracao, mas nao se comunica com o `PermissionsContext` (2min TTL + localStorage). Ao invalidar um, o outro permanece stale. O `PermissionsContext` nunca consulta `permissions-cache.ts`.

**Correcao**: Apos `permissionsCache.invalidate()` nos componentes, tambem disparar `window.dispatchEvent(new Event('permissions-updated'))` para forcar refresh do context.

### 8. Configuracoes.tsx — role query independente do PermissionsContext

`Configuracoes.tsx` faz query propria a `user_roles` (linha 106-111), ignorando o `PermissionsContext` que ja tem o role em cache. Redundancia de queries.

**Correcao**: Usar `usePermissions()` em vez de query manual.

### 9. GerenciamentoUsuarios — email editavel na criacao mas nao na edicao (OK), porem sem feedback

O campo email fica disabled na edicao mas nao ha indicacao visual (como um icone de cadeado) explicando que o email nao pode ser alterado.

**Correcao**: Adicionar icone de cadeado + tooltip no campo email na edicao.

## Plano de Correcao

### Fase 1 — Bugs criticos para producao

1. **EditarPerfil**: Receber `userRole` como prop e exibir corretamente o tipo de usuario
2. **EditarPerfil**: Remover `departamento` do objeto de update em `handleSave`
3. **update-user-password**: Adicionar validacao de regex de complexidade no server
4. **GerenciamentoUsuarios**: Ocultar botao delete e desabilitar campo role para o proprio usuario logado
5. **GerenciamentoUsuarios**: Limpar `errors` ao abrir dialog

### Fase 2 — Consistencia de cache

6. **Configuracoes.tsx**: Substituir query manual de role por `usePermissions()` hook
7. **Componentes de permissoes**: Disparar evento `permissions-updated` apos `permissionsCache.invalidate/clear`

### Fase 3 — UX polish

8. **GerenciamentoUsuarios**: Icone de cadeado no campo email em modo edicao
9. **GerenciamentoUsuarios**: Adicionar paginacao na tabela (usuarios > 50 ficam pesados)

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/components/configuracoes/EditarPerfil.tsx` | Receber `userRole` prop; remover `departamento` do update |
| `src/pages/Configuracoes.tsx` | Usar `usePermissions()` em vez de query; passar role para EditarPerfil |
| `src/components/configuracoes/GerenciamentoUsuarios.tsx` | Proteger auto-delete/rebaixamento; limpar erros; cadeado no email |
| `supabase/functions/update-user-password/index.ts` | Adicionar regex de complexidade |
| `src/components/configuracoes/GerenciamentoPermissoesTelas.tsx` | Disparar evento permissions-updated |
| `src/components/configuracoes/PermissoesDeAcesso.tsx` | Disparar evento permissions-updated |
| `src/components/configuracoes/GerenciamentoPermissoesModulos.tsx` | Disparar evento permissions-updated |

