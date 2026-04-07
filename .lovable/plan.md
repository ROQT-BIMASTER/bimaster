

# Painel de Segurança Admin — Exportações, Acessos Negados e Violações

## Objetivo

Expandir o Painel de Segurança existente (`SecurityDashboard.tsx`) com 3 novos cards/seções dedicados a:
1. **Dados exportados por usuário** (quem exportou, que tipo, quantos registros)
2. **Tentativas de acesso não autorizado** (acessos negados a projetos, telas, módulos)
3. **Violações de regras de segurança** (IPs bloqueados, brute force, anomalias)

## Fontes de Dados Existentes

- `audit_logs` — registra exportações via `auditExport()` (campos: `action`, `entity_type`, `metadata.export_type`, `metadata.record_count`)
- `security_audit_log` — registra `project_access_denied`, `blocked_request`, alertas
- `access_audit_log` — registra acessos a telas com campo `success` (false = negado)
- `security_incidents` — incidentes de segurança com status e severidade

## Alterações

### 1. Novo componente `SecurityExportAuditCard.tsx`
- Consulta `audit_logs` filtrando `action LIKE 'EXPORT:%'`
- JOIN com `profiles` para mostrar nome do usuário
- Tabela: Usuário | Tipo (Excel/CSV/PDF) | Entidade | Qtd Registros | Data
- Filtro por período (7/30/90 dias)
- Totalizador por tipo de exportação no topo

### 2. Novo componente `SecurityAccessDeniedCard.tsx`
- Consulta `security_audit_log` filtrando ações `project_access_denied`, `project_access_denied_client`, `blocked_request`
- Consulta `access_audit_log` onde `success = false`
- Tabela: Usuário | Ação | Recurso | Severidade | Data
- Badge de alerta para reincidentes (3+ negações)

### 3. Novo componente `SecurityViolationsCard.tsx`
- Consulta `security_incidents` com status `open`/`investigating`
- Consulta `security_ip_blocklist` para IPs bloqueados ativos
- Lista consolidada: tipo de violação, IP, usuário, ação tomada, data
- Indicadores visuais por severidade

### 4. Integração no `SecurityDashboard.tsx`
- Adicionar os 3 novos componentes abaixo dos existentes em grid responsivo
- Nova seção "Governança de Dados" com os cards de exportação + acessos negados
- Nova seção "Violações Ativas" com o card de violações

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/security/SecurityExportAuditCard.tsx` | Novo — card de exportações por usuário |
| `src/components/security/SecurityAccessDeniedCard.tsx` | Novo — card de acessos negados |
| `src/components/security/SecurityViolationsCard.tsx` | Novo — card de violações de segurança |
| `src/pages/SecurityDashboard.tsx` | Adicionar 3 novos componentes |

