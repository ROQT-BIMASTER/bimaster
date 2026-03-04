

## Plano: Endurecimento de Segurança para Auditoria

### Análise de Vulnerabilidades Encontradas

Após investigação detalhada do banco de dados, identifiquei **2 vulnerabilidades reais** que precisam de correção:

---

### Vulnerabilidade 1: Acesso excessivamente amplo a dados financeiros

**Gravidade: ALTA**

As tabelas `contas_receber` e `contas_pagar` usam a função `check_user_access(uid, 'financeiro')` nas políticas RLS. O problema: essa função concede acesso automático a **todos os supervisores e gerentes**, independentemente do departamento. Um supervisor do Comercial, por exemplo, consegue ler todos os títulos financeiros.

**Correção**: Criar uma função dedicada `can_access_financeiro_strict(user_id)` que verifica **somente**:
- Admin (via `has_role`)
- Permissão explícita ao módulo "financeiro" (via `usuario_permissoes_modulos`, `departamento_permissoes_modulos` ou `role_permissoes_modulos`)

Sem o bypass automático de supervisor/gerente.

Depois, atualizar as 4 políticas RLS de `contas_receber` e `contas_pagar` para usar essa nova função.

---

### Vulnerabilidade 2: Profiles — gerentes veem todos os perfis

**Gravidade: MÉDIA**

A função `can_view_profile()` permite que **gerentes vejam TODOS os perfis** (mesma regra do admin). Isso expõe dados pessoais (email, departamento, vínculos) de usuários que não são subordinados do gerente.

**Correção**: Alterar `can_view_profile()` para que gerentes vejam apenas seus subordinados diretos (via `gerente_id`), da mesma forma que supervisores veem apenas via `supervisor_id`. Admins continuam vendo tudo.

---

### Alterações (somente migração SQL)

**1 migração** contendo:

1. **`can_access_financeiro_strict(uuid)`** — nova função `SECURITY DEFINER`, `SET search_path = ''`, que verifica admin ou módulo financeiro explícito (sem bypass supervisor/gerente)

2. **Políticas de `contas_receber`** — recriar `cr_select_strict`, `cr_update_strict` usando `can_access_financeiro_strict`

3. **Políticas de `contas_pagar`** — recriar `cp_select`, `cp_update` usando `can_access_financeiro_strict`

4. **`can_view_profile(uuid, uuid)`** — recriar com gerentes restritos aos subordinados diretos (WHERE `gerente_id = viewer_id`)

**Nenhum arquivo de código precisa mudar** — as correções são todas no banco de dados.

### Impacto

- Supervisores/gerentes que **não têm** permissão explícita ao módulo financeiro perderão acesso a contas a receber/pagar (comportamento correto)
- Gerentes verão apenas perfis de seus subordinados diretos em vez de todos os perfis
- Admins e usuários do financeiro não são afetados

