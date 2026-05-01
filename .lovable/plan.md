## Objetivo

Reduzir o risco de **ameaças internas** (insider threat) — colaborador legítimo cedendo seu acesso a terceiros, ou usuário sem permissão pedindo para outro com permissão executar a ação por ele. Como o atacante já passou pela autenticação, as defesas perimetrais (WAF, MFA, rate-limit) não bastam: precisamos de **detecção comportamental, vínculo identidade↔dispositivo, controles compensatórios e dissuasão**.

## Princípios

1. Toda ação sensível precisa provar **três coisas**: quem é (MFA), de onde (device+IP coerentes) e por quê (motivo registrado).
2. Privilégio é **temporário e justificado** (JIT), não perpétuo.
3. Tudo que sai do sistema (export, print, screenshot) carrega **identidade rastreável**.
4. Quem aprova não é quem executa quando o impacto é alto (segregação de funções).

---

## Camada 1 — Vínculo identidade ↔ dispositivo (anti-compartilhamento de credenciais)

**Device fingerprint persistente** (canvas + WebGL + UA + timezone + fontes) gerado no login e armazenado em `user_trusted_devices` (user_id, fingerprint_hash, label, first_seen, last_seen, trusted_at, revoked_at).

**Política configurada (resposta do usuário): bloquear sessão antiga + exigir MFA na nova.**

- No `onAuthStateChange`, edge function `device-bind` compara fingerprint atual vs. dispositivos confiáveis do usuário.
- Se desconhecido → exige MFA imediato + nome do dispositivo + envia e-mail "Novo acesso detectado em X" com botão "Não fui eu" (revoga sessão e bloqueia conta).
- Se 2 sessões ativas simultâneas em fingerprints distintos → invalida a mais antiga via `session_invalidation_queue`, força re-login com MFA na mais nova, gera anomaly `concurrent_session` severidade `high`.
- Detecção de **impossible travel**: cidades distintas em <2h via geo-IP → mesma ação acima + alerta P1.

Tela admin: **Dispositivos confiáveis por usuário** (revogar, ver histórico).

## Camada 2 — Just-in-Time Access (JIT) + 4-eyes para ações de altíssimo impacto

Substituir privilégios permanentes em escopos críticos por **acesso temporário com justificativa**.

- Nova tabela `jit_access_requests` (requester_id, scope, justification, requested_minutes, approver_id, status, granted_at, expires_at, revoked_at).
- Escopos JIT: `finance.export_full`, `users.role_change_admin`, `municipios.bulk_reassign`, `dre.recalculate`, `pentest.execute`, `forensic.snapshot`.
- Workflow: usuário solicita → admin aprova → token válido por N minutos (default 30) → após expirar, permissão volta automaticamente.
- **4-eyes obrigatório (resposta do usuário)** apenas para:
  - Promoção/rebaixamento de role `admin` ou `gerente`.
  - Exportação massiva (>1.000 registros) de municípios, usuários, financeiro.
  - Reset de MFA de outro usuário.
  - Quem solicita ≠ quem aprova; ambos passam por step-up MFA.

Tela admin: **JIT Access Console** (pendentes / ativos / histórico).

## Camada 3 — Watermark e rastreabilidade de exports

Como o usuário não respondeu a essa pergunta, adoto o padrão **mais defensivo e menos invasivo**: watermark **invisível em telas sensíveis** + **cabeçalho/rodapé visível em todos os exports**.

- Exports CSV/XLSX/PDF recebem header com `user_id`, `e-mail`, `IP`, `timestamp ISO`, `request_id` e um **token único** persistido em `export_receipts` (user_id, scope, row_count, file_hash_sha256, token).
- PDFs ganham watermark visível diagonal "CONFIDENCIAL — {email} — {timestamp}".
- Telas de Financeiro / Usuários / Municípios renderizam um watermark CSS sutil (5% opacidade) com e-mail+timestamp para desencorajar print/screenshot.
- Toda export aciona `security_audit_log` com `severity=info` quando ≤1.000 linhas e `high` quando acima — alimenta detecção de exfiltração (Camada 5).

## Camada 4 — Honeytokens e canários

**Resposta do usuário: alerta crítico ao acessar.**

- Plantar registros-isca:
  - 3 municípios fictícios marcados `is_honeytoken=true` (coluna nova, default false, oculta da UI por RLS).
  - 2 contas a pagar honeypot.
  - 1 usuário honeypot com e-mail monitorado.
  - 1 cliente honeypot com CNPJ inválido reservado.
- Trigger `before select` (via view) ou wrapper RPC: qualquer leitura/export que **inclua** um honeytoken dispara:
  - `anomaly_events` severidade `critical` tipo `honeytoken_touched`.
  - Quarentena automática do usuário (1h) via `account_quarantine`.
  - Alerta P1 para todos os admins (e-mail + UI) com `incident_snapshot` automático.
- Honeytokens nunca aparecem em UI normal (filtro `is_honeytoken=false` em todas as queries de listagem).

## Camada 5 — Detecção comportamental (UEBA)

Edge function `behavioral-baseline` (cron 1h) calcula por usuário:

- Janela típica de horário de trabalho (p5–p95 dos últimos 30 dias).
- Volume médio de ações por hora; volume médio de exports/dia.
- IPs/cidades/dispositivos habituais.
- Módulos típicos acessados.

Edge function `behavioral-detect` (cron 5min) gera anomalias quando o desvio é estatisticamente significativo (z-score > 3):

- `off_hours_activity` (acesso fora da janela em ação sensível).
- `volume_spike_export` (exports >5× a média).
- `lateral_movement` (acesso a 3+ módulos não habituais em <10 min).
- `mass_read` (>500 SELECTs em janela de 1 min — capturado via contadores em `api_security_log`).
- `permission_probing` (>10 negações de permissão em 5 min — sinal clássico de quem está testando o que pode acessar).

Cada anomalia eleva o `security_user_risk_score`. Score alto (>70) força step-up adicional em qualquer ação sensível e notifica admin.

## Camada 6 — Segregação de funções e contenção de admin

- **Nenhum admin** pode alterar a própria role, próprio MFA, nem conceder JIT a si mesmo. Constraint via RPC `with_security_definer` que valida `requester_id ≠ target_id`.
- **Admin não vê senhas/tokens em texto claro** em tela alguma — apenas mascarados (`•••• 1234`) com botão "Revelar" que exige step-up + grava `secret_revealed` em audit.
- **Reset de MFA de outro usuário** vira ação 4-eyes (Camada 2).
- **Impersonation** já existe; reforçar: sessão impersonada exibe banner persistente vermelho, todas ações ganham flag `impersonated_by` em `security_audit_log`, e algumas ações (financeiro sensível, exports massivos, alteração de roles) ficam **bloqueadas durante impersonation**.

## Camada 7 — Painel de Insider Threat e revisão periódica

Nova aba no `SecurityHardeningCenterV2` → **"Insider Threat"**:

- KPIs: usuários com risk_score >70, dispositivos não confiáveis ativos, JIT pendentes, honeytokens tocados (30d), exports massivos (7d), permission_probing recentes.
- **Top 10 usuários por risco** com drill-down (timeline de ações, dispositivos, exports, anomalias).
- **Access Review trimestral**: workflow que lista todos com role admin/gerente e força admin a confirmar/revogar — quem não for revisado em 90 dias é rebaixado automaticamente.
- Botão "Quarentenar usuário" e "Revogar todos os dispositivos" com step-up.

---

## Tabelas / RPCs / Edge Functions a criar

**Tabelas:**
- `user_trusted_devices`, `jit_access_requests`, `export_receipts`, `behavioral_baselines`, `access_review_cycles`
- Coluna `is_honeytoken boolean default false` em `municipios`, `clientes`, `contas_pagar`, `profiles`

**RPCs (SECURITY DEFINER):**
- `device_register_or_verify`, `device_revoke`
- `jit_request`, `jit_approve` (4-eyes onde aplicável), `jit_active_token`
- `honeytoken_check_and_quarantine`
- `risk_score_recalc`
- `access_review_open_cycle`, `access_review_confirm`

**Edge Functions:**
- `device-bind` (no login)
- `behavioral-baseline` (cron 1h) e `behavioral-detect` (cron 5min)
- `export-watermark` (intercepta exports, gera receipt)
- `insider-threat-metrics` (KPIs do painel)

**UI:**
- `InsiderThreatPanel.tsx` (nova aba)
- `TrustedDevicesManager.tsx`
- `JitAccessConsole.tsx`
- `AccessReviewWizard.tsx`
- `WatermarkOverlay.tsx` (CSS overlay sutil em telas sensíveis)

**Config:**
- Adicionar a `step_up_scopes`: `device.trust`, `jit.approve`, `mfa.reset_other`, `secret.reveal`
- `APP_VERSION → 3.4.73` + entry no changelog em `ApiDocumentation.tsx`

## Detalhes técnicos relevantes

```text
Login flow com device binding:
 ┌─────────┐   ┌──────────────┐   ┌─────────────────┐
 │ Sign-in │──▶│ device-bind  │──▶│ trusted? ──Sim─▶│ session OK
 └─────────┘   └──────────────┘   └─────┬───────────┘
                                        │ Não
                                        ▼
                          MFA + nome do dispositivo
                          + e-mail "novo acesso"
                          + invalida sessões antigas
```

```text
JIT 4-eyes (role change admin):
 Solicitante (step-up) ──▶ jit_request ──▶ Admin aprovador (step-up, ≠ solicitante)
   ──▶ token 30min ──▶ ação executada ──▶ token expira ──▶ permissão revogada
```

## Métricas de sucesso

- ≥95% das sessões em dispositivos confiáveis em 30d.
- 0 ações sensíveis executadas sem step-up nos últimos 7d.
- 100% dos exports massivos com receipt e justificativa.
- MTTD (mean time to detect) honeytoken < 5min; permission_probing < 15min.
- 100% dos admins/gerentes revisados a cada 90 dias.

## Fora do escopo desta fase

- DLP de rede (não controlamos rede do usuário).
- Bloqueio de print de tela do SO (impossível em browser; watermark é a mitigação).
- Integração com SIEM externo (pode entrar em fase posterior se houver demanda).
