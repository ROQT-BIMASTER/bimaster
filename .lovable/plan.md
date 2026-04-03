

# Seguranca Enterprise: De "Seguro" para "Inteligente"

## Nota Atual: 85/100 — Meta: 98/100

O sistema ja possui seguranca avancada (RLS, RBAC, rate limiting, SSRF protection). O que falta sao 4 pilares de maturidade enterprise que transformam seguranca passiva em seguranca ativa e inteligente.

---

## Visao Geral da Arquitetura

```text
Eventos de Seguranca (5 tabelas de audit)
         |
    [Correlacao + Scoring]  ← NOVO
         |
    ┌────┴────────────────┐
    |                     |
[Auto-Resposta]     [Dashboard SIEM]  ← UPGRADE
    |                     |
[Bloqueio IP]        [Event Explorer]  ← NOVO
[Lock User]          [Filtros Empresa/IP/User]
[Revoke Session]     [Drill-down]
[Force Password]     [Risk Score]
```

---

## PILAR 1: Tabelas de Infraestrutura (Migracao)

Criar 3 novas tabelas para suportar a engine inteligente:

### `security_incidents`
Armazena incidentes correlacionados (nao eventos individuais):
- `id`, `incident_type` (brute_force, cross_tenant, mass_export, suspicious_ip)
- `severity` (critical/high/medium/low), `status` (open/investigating/mitigated/resolved)
- `risk_score` (0-100), `source_ip`, `user_id`, `empresa_id`
- `auto_action_taken` (blocked_ip, locked_user, revoked_session, forced_password_reset, none)
- `related_events` (jsonb — array de IDs dos eventos correlacionados)
- `resolved_at`, `resolved_by`, `notes`
- RLS: apenas admins

### `security_ip_blocklist`
Controle de IPs bloqueados automatica ou manualmente:
- `id`, `ip_address` (inet), `reason`, `blocked_by` (auto/manual)
- `incident_id` (FK security_incidents), `expires_at`, `is_active`
- RLS: apenas admins

### `security_user_risk_score`
Score de risco por usuario, recalculado pela engine:
- `id`, `user_id`, `score` (0-100), `risk_level` (low/medium/high/critical)
- `factors` (jsonb — detalhamento dos fatores), `last_calculated_at`
- RLS: apenas admins

---

## PILAR 2: Edge Function `security-correlation-engine`

Engine de correlacao e auto-resposta. Chamada via cron a cada 5 minutos.

**Regras de correlacao:**
1. **Brute Force**: 5+ login_failed do mesmo IP em 5min → incidente + bloqueia IP 1h
2. **Cross-Tenant Probe**: Mesmo user_id acessando 3+ empresas sem vinculo → incidente critical
3. **Mass Export**: 10+ exports do mesmo user em 1h → incidente + alerta
4. **IP Anomalo**: Mesmo IP em 3+ contas diferentes em 1h → incidente high
5. **Horario Anomalo**: Acesso entre 00h-05h com acao sensivel → incidente medium

**Auto-respostas:**
- `block_ip`: Insere em `security_ip_blocklist` com TTL
- `lock_user`: Atualiza metadata do usuario (locked = true)
- `revoke_sessions`: Chama `auth.admin.signOut(userId, 'global')`
- `force_password_reset`: Envia email de reset + flag no perfil

**Calculo de Risk Score por usuario:**
- Failed logins (peso 3), Horarios anomalos (peso 2), IPs multiplos (peso 2), Acoes sensíveis sem MFA (peso 4), Incidentes anteriores (peso 5)

---

## PILAR 3: Upgrade do Security Dashboard

Transformar o dashboard atual em mini-SIEM operacional.

### 3a. `SecurityDashboard.tsx` — Upgrade
- Adicionar **Security Score dinamico** (0-100) calculado em tempo real:
  - % tabelas com RLS, eventos criticos recentes, cobertura MFA, incidentes abertos
- Adicionar **Incidentes Abertos** como KPI card
- Adicionar **Risk Score medio** dos usuarios
- Adicionar filtros por empresa, periodo, tipo de evento
- Adicionar botao "Investigar" que navega ao Event Explorer

### 3b. `SecurityEventExplorer.tsx` — NOVO (Mini SIEM)
Pagina de investigacao com:
- **Tabela paginada** de todos os eventos (security_audit_log + access_audit_log)
- **Filtros**: empresa, usuario, IP, tipo de evento, severidade, periodo
- **Drill-down**: clicar em evento mostra metadata completa + eventos relacionados
- **Correlacao visual**: Mesmo IP em multiplas empresas destacado em vermelho
- **Timeline**: Visualizar sequencia de eventos por usuario/IP
- **Acoes diretas**: Bloquear IP, Lockout usuario, Revogar sessoes

### 3c. `SecurityIncidentPanel.tsx` — NOVO
Painel de gestao de incidentes:
- Lista de incidentes com status (open/investigating/mitigated/resolved)
- Detalhes do incidente com eventos correlacionados
- Workflow de resolucao (investigar → mitigar → resolver)
- Notas/comentarios por incidente

### 3d. `SecurityRiskScoreCard.tsx` — NOVO
Widget de risk score:
- Score geral do sistema (gauge chart)
- Top 5 usuarios com maior risco
- Breakdown dos fatores de risco

---

## PILAR 4: Integracao com Rate Limiting Existente

Upgrade do `_shared/rate-limit.ts` para registrar bloqueios em `security_ip_blocklist` e verificar blocklist antes de processar requests.

Criar `_shared/security-middleware.ts`:
- Verifica `security_ip_blocklist` antes de processar qualquer request
- Verifica se usuario esta locked
- Registra em `security_audit_log` se bloqueado

---

## Arquivos a Criar/Alterar

| Arquivo | Acao |
|---|---|
| **Migracoes SQL** | 3 tabelas novas + RLS + indices |
| `supabase/functions/security-correlation-engine/index.ts` | Criar — engine de correlacao + auto-resposta |
| `supabase/functions/_shared/security-middleware.ts` | Criar — middleware de verificacao de blocklist |
| `supabase/functions/_shared/rate-limit.ts` | Alterar — integrar com blocklist |
| `supabase/functions/security-alerts/index.ts` | Alterar — usar dados da correlation engine |
| `src/pages/SecurityDashboard.tsx` | Alterar — upgrade com score, filtros, incidentes |
| `src/pages/SecurityEventExplorer.tsx` | Criar — mini SIEM |
| `src/components/security/SecurityKPICards.tsx` | Alterar — novos KPIs |
| `src/components/security/SecurityIncidentPanel.tsx` | Criar — gestao de incidentes |
| `src/components/security/SecurityRiskScoreCard.tsx` | Criar — widget risk score |
| `src/components/security/SecurityScoreGauge.tsx` | Criar — gauge visual do score |
| `src/components/security/EventDetailDrawer.tsx` | Criar — drawer de drill-down |
| `src/App.tsx` | Alterar — rota do Event Explorer |

---

## Resultado Esperado

- **Deteccao**: Correlacao automatica de eventos suspeitos (brute force, cross-tenant, anomalias)
- **Resposta**: Bloqueio automatico de IP, lockout de usuario, revogacao de sessoes
- **Visibilidade**: Dashboard SIEM com drill-down, filtros por empresa/usuario/IP
- **Risk Score**: Score dinamico por usuario e score geral do sistema
- **Governanca**: Workflow de incidentes (open → investigate → mitigate → resolve)
- **Nota estimada: 98/100**

