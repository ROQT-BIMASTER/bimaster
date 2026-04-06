

# Auditoria de Acessos a Projetos por Departamento

## Objetivo

Registrar automaticamente no `security_audit_log` todas as tentativas de acesso a projetos — especialmente as **negadas** — para monitoramento de segurança. Implementar tanto no backend (função SQL) quanto no frontend (interceptação de erros de acesso).

## Implementação

### 1. Migração SQL — Função com logging de auditoria

Recriar `user_can_access_projeto` como uma função **PL/pgSQL** (em vez de SQL puro) para poder registrar tentativas negadas no `security_audit_log` antes de retornar `false`.

```sql
CREATE OR REPLACE FUNCTION user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _has_access boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM projetos WHERE id = _projeto_id AND criador_id = _user_id)
    OR EXISTS (SELECT 1 FROM projeto_membros WHERE projeto_id = _projeto_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM projeto_departamentos pd
      JOIN profiles pr ON pr.departamento_id = pd.departamento_id
      WHERE pd.projeto_id = _projeto_id AND pr.id = _user_id
    )
  INTO _has_access;

  IF NOT _has_access THEN
    INSERT INTO security_audit_log (action, severity, user_id, metadata)
    VALUES (
      'project_access_denied',
      'medium',
      _user_id,
      jsonb_build_object(
        'projeto_id', _projeto_id,
        'user_departamento_id', (SELECT departamento_id FROM profiles WHERE id = _user_id),
        'projeto_departamentos', (SELECT array_agg(departamento_id) FROM projeto_departamentos WHERE projeto_id = _projeto_id)
      )
    );
  END IF;

  RETURN COALESCE(_has_access, false);
END;
$$;
```

### 2. Frontend — Interceptação no hook de detalhe do projeto

No hook que carrega o detalhe do projeto (quando o usuário navega para `/projetos/:id`), se a query retornar vazio ou erro de RLS, registrar no `security_audit_log` via client e redirecionar com mensagem.

Criar utilitário `src/lib/auditProjectAccess.ts`:
- `logProjectAccessDenied(projetoId)` — insere no `security_audit_log` com action `project_access_denied_client`
- Usado no componente de detalhe do projeto quando dados voltam vazios

### 3. Dashboard de Segurança — Widget de acessos negados

Adicionar ao `SecurityActivityFeed` a exibição de eventos `project_access_denied` com detalhes do usuário e projeto.

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | Recriar `user_can_access_projeto` em PL/pgSQL com logging de negações |
| `src/lib/auditProjectAccess.ts` | Novo utilitário para log client-side de acesso negado |
| `src/pages/ProjetoDetalhe.tsx` (ou equivalente) | Interceptar acesso negado e chamar audit |
| `src/components/security/SecurityActivityFeed.tsx` | Exibir eventos `project_access_denied` |

