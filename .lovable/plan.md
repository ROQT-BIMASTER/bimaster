

# Revisão Completa do Sistema de Permissões

## Diagnóstico Detalhado

### Problema Principal Identificado
O trigger `on_user_role_change` na tabela `user_roles` chama automaticamente a função `sincronizar_permissoes_usuario` que **DELETA TODAS as permissões individuais de telas** do usuário e as substitui pelas permissões padrão do role.

**Fluxo problemático atual:**
1. Admin edita um usuário no `GerenciamentoUsuarios.tsx`
2. O código faz `DELETE` + `INSERT` na tabela `user_roles` (linhas 299-311)
3. O trigger `on_user_role_change` dispara
4. Função `sincronizar_permissoes_usuario` é executada
5. Todas as permissões individuais são deletadas e substituídas pelas permissões padrão do role

### Impacto no caso do Ricardo
Quando você salvou uma alteração no usuário Ricardo (mesmo sendo apenas a senha ou nome), o código também fez delete/insert do role, o que disparou o trigger e resetou todas as permissões personalizadas dele para o padrão de "vendedor" (apenas "Dashboard" e "Instalar App").

---

## Problemas de Arquitetura Identificados

### 1. Trigger Destrutivo Automático
**Localização:** Trigger `on_user_role_change` em `user_roles`
**Problema:** A função `sincronizar_permissoes_usuario` deleta todas as permissões individuais sem verificar se o role realmente mudou.
**Risco:** Qualquer UPDATE na tabela `user_roles` (mesmo sem mudar o role) causa perda de permissões personalizadas.

### 2. Lógica de Edição Destrutiva no Frontend
**Localização:** `src/components/configuracoes/GerenciamentoUsuarios.tsx` (linhas 298-313)
**Problema:** O código sempre faz DELETE + INSERT do role, mesmo quando não há mudança no tipo de usuário.
**Impacto:** Força disparo do trigger mesmo desnecessariamente.

### 3. Permissões de Módulos Não Sincronizadas
**Problema:** A função `sincronizar_permissoes_usuario` só sincroniza TELAS, não módulos.
**Inconsistência:** Permissões de módulos individuais (`usuario_permissoes_modulos`) são preservadas, mas telas são perdidas.

### 4. Edge Function de Senha Não Utilizada
**Localização:** `supabase/functions/update-user-password/`
**Observação:** A edge function para atualizar senha existe mas não está sendo usada no frontend do admin.

---

## Plano de Correções

### Fase 1: Correção Crítica do Trigger (Banco de Dados)

**1.1. Modificar a função `sincronizar_permissoes_usuario`**
- Adicionar parâmetro opcional `force_sync` (default: false)
- Quando chamada pelo trigger, NÃO deletar permissões existentes
- Apenas ADICIONAR permissões do role que estão faltando (sem deletar)

```sql
-- Nova lógica proposta:
CREATE OR REPLACE FUNCTION sincronizar_permissoes_usuario(
  p_user_id uuid,
  p_force_sync boolean DEFAULT false
)
RETURNS void AS $$
DECLARE
  v_role app_role;
BEGIN
  SELECT role INTO v_role
  FROM user_roles WHERE user_id = p_user_id LIMIT 1;

  IF v_role = 'admin' THEN RETURN; END IF;

  IF p_force_sync THEN
    -- Sincronização forçada: deleta e recria
    DELETE FROM usuario_permissoes_telas WHERE usuario_id = p_user_id;
    INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
    SELECT p_user_id, tela_id FROM role_permissoes_telas WHERE role = v_role;
  ELSE
    -- Sincronização suave: apenas adiciona o que falta
    INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
    SELECT p_user_id, rpt.tela_id
    FROM role_permissoes_telas rpt
    WHERE rpt.role = v_role
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
```

**1.2. Modificar o trigger para detectar mudança real**
```sql
-- O trigger só deve sincronizar quando o ROLE realmente muda
CREATE OR REPLACE FUNCTION trigger_sincronizar_permissoes()
RETURNS trigger AS $$
BEGIN
  -- Só sincroniza se:
  -- 1. É INSERT (novo usuário)
  -- 2. Ou é UPDATE e o role realmente mudou
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role) THEN
    PERFORM sincronizar_permissoes_usuario(NEW.user_id, false);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fase 2: Correção do Frontend

**2.1. Modificar `GerenciamentoUsuarios.tsx`**
- Verificar se o role realmente mudou antes de fazer DELETE/INSERT
- Se o role não mudou, não mexer na tabela `user_roles`

```typescript
// Antes de fazer DELETE/INSERT, verificar se mudou
if (novoUsuario.tipo_usuario !== editingUser.tipo_usuario) {
  // Só atualiza role se realmente mudou
  await supabase.from("user_roles").delete().eq("user_id", editingUser.id);
  await supabase.from("user_roles").insert({ 
    user_id: editingUser.id, 
    role: novoUsuario.tipo_usuario 
  });
}
```

**2.2. Adicionar botão "Restaurar para Role" explícito**
- Mover a sincronização forçada para uma ação manual consciente
- Adicionar confirmação antes de executar

### Fase 3: Melhorias de UX e Auditoria

**3.1. Log de alterações de permissões**
- Registrar na tabela `audit_logs` quando permissões são alteradas
- Incluir quem alterou, quando e quais permissões

**3.2. Notificação em tempo real**
- Quando permissões são alteradas, emitir evento para atualizar cache
- Evitar necessidade de logout/login para ver novas permissões

### Fase 4: Testes e Validação

**4.1. Casos de teste críticos:**
- Editar usuário sem mudar role: permissões devem ser preservadas
- Editar usuário mudando role: permissões do novo role devem ser adicionadas
- Botão "Restaurar para Role": deve substituir todas as permissões
- Alterar senha: permissões não devem ser afetadas

---

## Resumo das Alterações

| Componente | Ação | Prioridade |
|------------|------|------------|
| Função `sincronizar_permissoes_usuario` | Modificar para ter modo "suave" | CRÍTICA |
| Trigger `trigger_sincronizar_permissoes` | Detectar mudança real de role | CRÍTICA |
| `GerenciamentoUsuarios.tsx` | Verificar se role mudou | ALTA |
| `PermissoesDeAcesso.tsx` | Adicionar confirmação explícita | MÉDIA |
| `audit_logs` | Registrar alterações de permissões | BAIXA |

---

## Observação sobre o Caso do Ricardo

As permissões do Ricardo foram corrigidas na mensagem anterior (10 telas + 2 módulos). Ele deveria conseguir acessar:
- Dashboard
- Instalar App
- Dashboard Preços
- Gerenciar Tabelas
- Matriz Comparativa
- Aprovação
- Portal Cliente
- Simulador de Preços
- Dashboard Comercial
- Calendário de Lançamentos

**Ação recomendada:** Pedir para o Ricardo fazer logout, limpar cache do navegador/PWA, e fazer login novamente para que as novas permissões sejam carregadas do banco.

