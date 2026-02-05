

# Correção: Isolamento de Dados da Equipe no Dashboard "Minha Equipe"

## Problema Identificado

A tabela `photos` possui **múltiplas políticas RLS conflitantes** que dão a supervisores acesso a **TODAS** as fotos do sistema, em vez de restringir apenas aos subordinados diretos. A tabela `visits` tem o mesmo problema.

### Políticas Problemáticas em `photos` (SELECT)

| Politica | Condição | Problema |
|---|---|---|
| "Admins e supervisores podem ver todas as fotos" | `is_admin_or_supervisor(auth.uid())` | Supervisores veem TUDO |
| "Usuários veem fotos permitidas" | inclui `is_admin_or_supervisor(auth.uid())` | Redundante e permissiva |
| "Usuários gerenciam próprias fotos" (ALL) | inclui `is_admin_or_supervisor(auth.uid())` | Cobre SELECT tambem |
| "visits_select_restricted" (visits) | inclui `is_admin_or_supervisor(auth.uid())` | Mesmo problema |

Como as políticas RLS funcionam com lógica OR (qualquer uma verdadeira libera o acesso), a política "Admins e supervisores" anula todas as restrições mais granulares.

## Plano de Correção

### Passo 1 -- Limpar e corrigir RLS da tabela `photos`

Remover as políticas excessivamente permissivas e recriar com isolamento correto:

- **DROP**: "Admins e supervisores podem ver todas as fotos", "Usuários veem fotos permitidas", "Usuários gerenciam próprias fotos"
- **CRIAR**: 
  - "Admins veem todas as fotos" (apenas role = admin)
  - "Supervisores veem fotos de subordinados" (usar `is_supervisor_of` -- ja existe, manter)
  - "Vendedores veem suas fotos" (ja existe, manter)
  - "Fotos vinculadas a visitas acessiveis" (manter acesso via visita)

### Passo 2 -- Limpar e corrigir RLS da tabela `visits`

Mesma abordagem -- remover politicas duplicadas que usam `is_admin_or_supervisor` e manter apenas:

- **DROP**: "Users can view visits based on role", "Usuários veem visitas conforme hierarquia", "visits_select_restricted" 
- **MANTER**: "Admin vê todas visitas" (apenas admin), "Supervisor vê visitas de subordinados" (ja usa `get_subordinados`), "Vendedor vê suas visitas"

### Passo 3 -- Atualizar versão do app

Incrementar `APP_VERSION` em `src/lib/version.ts` de `1.1.1` para `1.1.2` para forcar a limpeza de cache nos dispositivos dos usuarios, garantindo que Michele e a equipe recebam o codigo mais recente.

## Detalhes Tecnicos

### Novas politicas RLS para `photos` (SELECT)

```text
1. Admins veem tudo:
   USING (is_admin())

2. Supervisores veem subordinados (existente):  
   USING (is_supervisor_of(vendedor_id, auth.uid()))

3. Vendedores veem proprias (existente):
   USING (vendedor_id = auth.uid())

4. Via visita acessivel:
   USING (EXISTS(SELECT 1 FROM visits v WHERE v.id = visit_id AND (v.user_id = auth.uid() OR is_supervisor_of(v.user_id, auth.uid()))))
```

### Politicas RLS para `photos` (UPDATE/DELETE)

- UPDATE: vendedor_id = auth.uid() OR is_admin()
- DELETE: is_admin()

### Politicas RLS para `visits` (SELECT)

```text
1. Admin ve todas: USING (is_admin())
2. Supervisor ve subordinados (existente com get_subordinados)
3. Vendedor ve suas: USING (user_id = auth.uid())
```

### Arquivos alterados

- Nova migracao SQL para corrigir RLS de `photos` e `visits`
- `src/lib/version.ts` -- incremento de versao

