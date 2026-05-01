## Pentest interno + camadas adicionais de segurança (v3.4.70)

### Estado atual (linha de base)
- WAF v2 em **shadow mode** há horas, **0 infrações** logadas — engine OK, sem tráfego malicioso visível ainda.
- MFA enrolled: **0 / 10 admins+gerentes** (todos em grace de 7 dias). 123 vendedores fora do escopo.
- **3 buckets públicos**: `trade-assets`, `trade-banners`, `creative-studio`. Precisam de validação de upload e listagem.
- ~200 edge functions sob `secureHandler` com quarentena, MFA gate, step-up, rate limit, WAF, SSRF guard e audit hash-chain já ativos.
- 1 ponto crítico: `dangerouslySetInnerHTML` em `WhatsAppAgentFlow.tsx` (revisar sanitização).

### Estratégia
Em vez de pentest manual contra produção (risco), montamos um **pentest automatizado em código** que roda contra a própria stack via edge function `pentest-runner` (admin only, step-up obrigatório). Os resultados alimentam um painel novo no Hardening Center. Em paralelo, implementamos 6 camadas que ainda não existem.

---

### Parte 1 — Pentest interno automatizado (`pentest-runner`)

Edge function admin-only que executa **45 checks ofensivos** organizados por categoria OWASP, mais 12 checks de **lógica de negócio** específicos do Bimaster. Cada check produz `pass | fail | skip` com evidência. Resultados gravados em nova tabela `pentest_runs` + `pentest_findings`.

Categorias dos 57 checks:

| Categoria | Quantidade | Exemplos |
|---|---|---|
| **A01 Broken Access Control** | 8 | tentar SELECT em tabela sem RLS via anon; cross-tenant leak (user A acessa empresa B); IDOR em `/projetos/{id}` com id de outra empresa; bypass via `?role=admin` query param |
| **A02 Cryptographic Failures** | 4 | secrets em respostas JSON; tokens MFA reaproveitados após validação; cookies sem `Secure`/`HttpOnly`; recovery codes em texto claro nos logs |
| **A03 Injection** | 6 | SQLi nos params de busca (`'; DROP--`); XSS em campos textuais persistidos; LDAP/NoSQL injection nos filtros; command injection em uploads CSV |
| **A04 Insecure Design** | 4 | criar conta com `email_confirmed=true` direto; pular step-up via header forjado; race condition em quarentena |
| **A05 Misconfig** | 6 | endpoints sem `secureHandler`; CORS `*` em rotas autenticadas; debug headers vazando; storage buckets públicos com listagem permitida |
| **A06 Vulnerable Components** | 3 | dependências desatualizadas via `npm audit`; libs com CVEs conhecidos |
| **A07 Auth/Session** | 5 | brute-force login (200 req); reuso de step-up token; MFA bypass via concorrência; session fixation |
| **A08 Integrity** | 3 | tentar UPDATE em `audit_log_immutable`; alterar `prev_hash`; verificar cadeia inteira |
| **A09 Logging** | 3 | ações sensíveis sem audit; PII em logs; `security_event_record` falhando silenciosamente |
| **A10 SSRF** | 3 | ssrf-guard contra `169.254.169.254`, `localhost`, redirect chain |
| **Lógica de negócio** | 12 | exportar dados financeiros sem `step-up`; aprovar projeto pulando workflow; alterar valor de conta a pagar paga; impersonar admin; criar role admin via API; rebaixar próprio supervisor; deletar processo aprovado; manipular saldo após sync ERP; etc. |

Modo de execução:
- **Dry run** (default): apenas leitura/tentativa, nada é gravado destrutivamente. Usa contas-teste já existentes.
- **Full** (requer step-up `pentest.execute`): inclui tentativas de gravação que devem ser bloqueadas — qualquer sucesso = vulnerabilidade real.

Saída: `pentest_findings` com `cwe_id`, `severity`, `evidence_hash`, `remediation`. Painel no Hardening Center mostra histórico, gráfico de pass/fail e CWE top 10.

---

### Parte 2 — 6 camadas adicionais de segurança

**Camada 1 — Anti-abuso comportamental (anti-bot adaptativo)**
- Tabela `user_behavior_baseline` (média de req/min, horários típicos, IPs/ASNs frequentes, user agents) por usuário, atualizada por job diário.
- Engine `behavior-anomaly` em `secureHandler`: quando request foge do baseline (>3σ ou IP/ASN novo + horário fora), eleva o usuário para **shadow watch** por 24h e cria `security_event` `anomaly_detected`. Após 3 anomalias em 1h, **quarentena automática** com notificação para admin.
- Sem CAPTCHA — usamos sinais existentes (UA, geo, ASN, fingerprint).

**Camada 2 — Cofre de segredos com rotação automática**
- Tabela `secret_rotation_policy` (secret_name, rotation_interval_days, last_rotated_at, owner).
- Edge function `secret-rotation-monitor` (cron diário) detecta segredos vencidos e alerta admin.
- RPC `secret_audit_access(name)` — toda leitura de secret crítico (Stripe, ERP, AI Gateway) passa por wrapper que loga em `secret_access_log`.
- Painel mostra: idade de cada secret, último uso, top consumidores.

**Camada 3 — Supply chain & dependency guard**
- Job `dependency-scan` (semanal): roda `npm audit --json`, grava em `dependency_findings`, alerta no painel.
- Lockfile integrity check no boot: hash do `bun.lockb` registrado em `app_integrity_baseline`; mismatch dispara `security_event` `lockfile_drift`.
- Lista negra de packages (typosquatting de `@supabase`, `lovable`, `react`).

**Camada 4 — Proteção L7 anti-DoS por padrão**
- Hoje rate-limit é por função+identificador. Adicionar **cota global por usuário/IP** (1000 req/min total, qualquer função) via tabela `global_rate_limit_buckets` (sliding window).
- **Slow-loris guard**: timeout agressivo de 30s no `secureHandler` para qualquer body parsing.
- **Adaptive throttling**: quando `security_events` críticos > N por min globalmente, reduz limites em 50% por 10min automaticamente.

**Camada 5 — DLP (Data Loss Prevention) em respostas e exports**
- Helper `dlpScan(payload)` que detecta CPF, CNPJ, email, telefone, cartão, JWT, secrets em qualquer response > 50 KB de exports/relatórios.
- Se detectar PII fora do esperado para o role, **mascara automaticamente** (`mask_cpf`/`mask_email` já existem) e loga `dlp_redaction` em `security_events`.
- Aplicado em `secureHandler` como pós-processador opt-in via `config.dlp: 'redact' | 'block' | 'log'`.

**Camada 6 — Forense & resposta a incidente**
- Tabela `incident_timeline` agregando eventos correlacionados (audit + security + waf + sessions) em ordem cronológica por usuário/IP.
- RPC `incident_snapshot(user_id, window)` retorna pacote forense completo (todas as ações, IPs, devices, exports) — admin only + step-up.
- Botão "Snapshot forense" no Hardening Center para qualquer usuário em quarentena.

---

### Parte 3 — Hardening Center v2 (UI)

Adicionar 4 abas na página `/dashboard/admin/security/hardening`:
- **Pentest** — disparar runs (dry/full), histórico, findings com CWE e remediação sugerida.
- **Anomalias** — usuários sob shadow watch, eventos `anomaly_detected` recentes.
- **Segredos** — idade, próxima rotação, consumidores.
- **Forense** — busca por usuário/IP, snapshot exportável (JSON com hash).

Métricas no topo: **MFA adoption rate** (0/10 hoje, meta 100%), **WAF shadow blocks 24h**, **Pentest score** (% checks passando), **Anomalias 24h**.

---

### Detalhes técnicos

```text
Novas tabelas (migração aditiva, zero downtime):
  pentest_runs, pentest_findings
  user_behavior_baseline, anomaly_events
  secret_rotation_policy, secret_access_log
  dependency_findings, app_integrity_baseline
  global_rate_limit_buckets
  incident_timeline

Novas edge functions:
  pentest-runner (admin + step-up 'pentest.execute')
  behavior-anomaly-job (cron horário)
  secret-rotation-monitor (cron diário)
  dependency-scan (cron semanal)
  forensic-snapshot (admin + step-up)

secure-handler.ts ganha:
  - dlp: 'redact' | 'block' | 'log'
  - globalRateLimit (cota cross-function)
  - behavior anomaly hook pós-auth
  - body timeout 30s

Frontend:
  src/pages/admin/security/PentestRunner.tsx
  src/pages/admin/security/AnomaliesPage.tsx
  src/pages/admin/security/SecretsVault.tsx
  src/pages/admin/security/ForensicsPage.tsx
  src/components/security/PentestFindingCard.tsx
  src/hooks/useDlpRedaction.ts (cliente)

Versão: APP_VERSION 3.4.69 → 3.4.70
Sem mudança de SDK ou OpenAPI público.
Sem breaking change — todas as camadas começam em modo "log only" por 48h.
```

### Rollout em 3 ondas

1. **Onda 1 (imediata)**: Migração + edge functions em modo log-only. Pentest disponível em dry-run.
2. **Onda 2 (após 48h analisando logs)**: Ativar enforcement de anomaly→quarentena, DLP redact, global rate limit.
3. **Onda 3 (semana seguinte)**: Pentest full mode agendado mensalmente; rotação de segredos vencidos; integração com SIEM existente.

### Critérios de aceitação
- Pentest runner executa os 57 checks em < 5 min, todos os checks de RLS/IDOR retornam `pass`.
- WAF v2 promovido para `enforce` ao final da onda 1 (já está há horas em shadow sem falsos positivos).
- 100% admins/gerentes com MFA antes da onda 2 (lockout ativo após grace).
- Buckets públicos `trade-*` ganham validação de upload (magic bytes, tamanho, sem listagem).
- Painel mostra Pentest Score ≥ 95%.
