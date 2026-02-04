
# Plano: Log de Auditoria para Alterações de Permissões

## Objetivo
Adicionar logging de auditoria sempre que permissões de usuário forem alteradas, facilitando o diagnóstico de problemas como o que ocorreu com o Ricardo (perda de permissões customizadas).

## Arquitetura Atual

### Tabela Existente: `audit_logs`
A tabela `audit_logs` já existe e possui estrutura adequada:
- `user_id`: quem fez a alteração
- `action`: tipo de ação (ex: "permission_update")
- `entity_type`: tipo de entidade (ex: "user_permission")
- `entity_id`: ID do usuário afetado
- `old_data` / `new_data`: dados em JSONB para before/after
- `metadata`: informações adicionais

### Pontos de Alteração de Permissões
1. **GerenciamentoPermissoesTelas.tsx** - Salva permissões individuais de telas
2. **GerenciamentoPermissoesModulos.tsx** - Alterna permissões de módulos
3. **TradeAdminUsers.tsx** - Concede/revoga acesso ao Trade Admin
4. **PermissoesDeAcesso.tsx** - Sincroniza permissões por role
5. **GerenciamentoUsuarios.tsx** - Altera role do usuário (trigger)
6. **Função SQL `sincronizar_permissoes_usuario`** - Sincronização automática

---

## Implementação

### Fase 1: Criar Função de Log de Permissões

Adicionar em `src/lib/auditLog.ts`:

```text
Novas funções:
- logPermissionChange(): Log genérico de alteração de permissão
- logScreenPermissionsUpdate(): Log de alteração de telas
- logModulePermissionToggle(): Log de alteração de módulo
- logRoleChange(): Log de alteração de role de usuário
- logPermissionSync(): Log de sincronização forçada
```

**Interface proposta:**
```typescript
interface PermissionAuditEntry {
  targetUserId: string;
  targetUserName?: string;
  action: 'grant' | 'revoke' | 'sync' | 'role_change';
  permissionType: 'screen' | 'module' | 'role';
  permissionIds?: string[];
  permissionNames?: string[];
  oldRole?: string;
  newRole?: string;
  source: 'manual' | 'trigger' | 'sync';
}
```

### Fase 2: Integrar nos Componentes

**2.1 GerenciamentoPermissoesTelas.tsx**
- Na função `handleSave()`, registrar:
  - Quais telas foram adicionadas
  - Quais telas foram removidas
  - Usuário afetado e admin responsável

**2.2 GerenciamentoPermissoesModulos.tsx**
- Na função `toggleUserPermission()`, registrar:
  - Módulo concedido/revogado
  - Usuário afetado

- Na função `toggleRolePermission()`, registrar:
  - Alteração de permissão padrão do role

**2.3 TradeAdminUsers.tsx**
- Na mutation `toggleAdminMutation`, registrar:
  - Concessão/revogação de acesso Trade Admin

**2.4 PermissoesDeAcesso.tsx**
- Na função `handleSync()`, registrar:
  - Sincronização em massa de permissões
  - Quantidade de usuários afetados

**2.5 GerenciamentoUsuarios.tsx**
- Na função `handleSaveEdit()`, quando role mudar:
  - Registrar role antigo e novo

### Fase 3: Adicionar Trigger SQL (Opcional)

Criar trigger no banco para capturar alterações via SQL diretamente:

```sql
CREATE OR REPLACE FUNCTION log_permission_changes()
RETURNS trigger AS $$
BEGIN
  -- Inserir log na tabela audit_logs
  INSERT INTO audit_logs (
    user_id, action, entity_type, entity_id, 
    old_data, new_data, metadata
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.usuario_id, OLD.usuario_id),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    jsonb_build_object('trigger', 'permission_audit')
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar nas tabelas de permissões
CREATE TRIGGER audit_usuario_permissoes_telas
  AFTER INSERT OR UPDATE OR DELETE ON usuario_permissoes_telas
  FOR EACH ROW EXECUTE FUNCTION log_permission_changes();

CREATE TRIGGER audit_usuario_permissoes_modulos
  AFTER INSERT OR UPDATE OR DELETE ON usuario_permissoes_modulos
  FOR EACH ROW EXECUTE FUNCTION log_permission_changes();
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/auditLog.ts` | Adicionar funções de log de permissões |
| `src/components/configuracoes/GerenciamentoPermissoesTelas.tsx` | Integrar log em `handleSave()` |
| `src/components/configuracoes/GerenciamentoPermissoesModulos.tsx` | Integrar log em `toggleUserPermission()` e `toggleRolePermission()` |
| `src/components/configuracoes/PermissoesDeAcesso.tsx` | Integrar log em `handleSync()` |
| `src/components/configuracoes/GerenciamentoUsuarios.tsx` | Integrar log em `handleSaveEdit()` quando role mudar |
| `src/pages/TradeAdminUsers.tsx` | Integrar log em `toggleAdminMutation` |
| **Banco de dados (migração)** | Criar triggers de auditoria nas tabelas de permissões |

---

## Benefícios

1. **Diagnóstico Fácil**: Quando permissões "desaparecem", basta consultar `audit_logs` para ver quem/quando/como foram alteradas
2. **Rastreabilidade**: Saber quem alterou permissões de quem
3. **Prevenção**: Identificar padrões problemáticos (ex: muitas sincronizações automáticas)
4. **Conformidade**: Histórico completo de alterações de acesso

---

## Seção Técnica

### Consulta de Exemplo para Diagnóstico
```sql
SELECT 
  al.created_at,
  p.nome as admin_responsavel,
  al.action,
  al.entity_type,
  al.old_data,
  al.new_data,
  al.metadata
FROM audit_logs al
LEFT JOIN profiles p ON p.id = al.user_id
WHERE al.entity_id = 'UUID_DO_USUARIO_AFETADO'
  AND al.entity_type IN ('user_permission', 'screen_permission', 'module_permission', 'role_change')
ORDER BY al.created_at DESC;
```

### Estrutura do Log de Permissões
```json
{
  "action": "permission_update",
  "entity_type": "screen_permission", 
  "old_data": {
    "screens": ["dashboard", "instalar_app"]
  },
  "new_data": {
    "screens": ["dashboard", "instalar_app", "comercial_dashboard", "precos_dashboard"]
  },
  "metadata": {
    "source": "manual",
    "screens_added": ["comercial_dashboard", "precos_dashboard"],
    "screens_removed": [],
    "target_user_name": "Ricardo Flausino"
  }
}
```
