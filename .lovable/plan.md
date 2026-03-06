

## Próximas Melhorias de Segurança — Recomendações

Baseado nos scans atuais, nas memórias do sistema e na análise do código, há **3 camadas** de aprofundamento possíveis:

---

### Camada 1 — Correções Pendentes do Scan Atual

Estes itens aparecem como **ainda abertos** no scanner de segurança e precisam ser resolvidos ou marcados:

| # | Finding | Status no Scanner | Ação |
|---|---------|-------------------|------|
| 1 | AI Extraction sem auth (`extrair-materia-prima-ia`, `extrair-produto-ia`) | 🔴 Erro (aberto) | Já corrigimos no último ciclo — **deletar o finding** |
| 2 | datawarehouse-api aceita qualquer tabela | 🔴 Erro (aberto) | Já corrigimos com allowlist — **deletar o finding** |
| 3 | Status endpoints sem auth | ⚠️ Warning (aberto) | Já corrigimos — **deletar o finding** |
| 4 | `search_path` mutable | ⚠️ Warning (aberto) | Já corrigimos 100+ funções — **verificar se há novas funções** criadas depois da correção |
| 5 | RLS Policy Always True | ⚠️ Warning (aberto) | 29 políticas identificadas — já aceitamos como risco com justificativa |
| 6 | Ads credentials sem criptografia real | ⚠️ Warning (aberto) | **Implementar criptografia server-side** com WebCrypto na edge function |

---

### Camada 2 — Funcionalidades de Segurança Ainda Não Implementadas

| # | Feature | Impacto | Complexidade |
|---|---------|---------|-------------|
| 1 | **Autenticação Multi-Fator (MFA/2FA)** | Alto — protege contra roubo de credenciais | Média — usar TOTP nativo do auth do backend |
| 2 | **Rotação Automática de API Keys** | Alto — elimina risco de chaves estáticas compromidas | Média — cron job que regenera e notifica |
| 3 | **Alertas de Segurança em Tempo Real** | Médio — detecta anomalias como login de IP desconhecido | Média — trigger no `access_audit_log` + notificação |
| 4 | **Dashboard de Segurança Consolidado** | Médio — visibilidade centralizada para admins | Baixa — página que agrega audit logs, tentativas de login, e findings |
| 5 | **Bloqueio de Conta por Tentativas Falhas** | Alto — previne brute force | Baixa — já existe rate limiting parcial, completar com lockout temporário |
| 6 | **Detecção de Sessão Duplicada** | Médio — impede uso simultâneo da mesma conta | Baixa — verificar sessions ativas no login |

---

### Camada 3 — Hardening Avançado

| # | Feature | Descrição |
|---|---------|-----------|
| 1 | **Content Security Policy dinâmica** | Migrar CSP de meta tag para header HTTP via edge function proxy |
| 2 | **Honeypot de SQL Injection** | Tabela-armadilha que loga tentativas de acesso não autorizado |
| 3 | **Expiração de Convites/Links** | Links de reset de senha com TTL curto + invalidação após uso |
| 4 | **Geo-fencing de Login** | Bloquear ou alertar logins de fora do Brasil (todos os 15 usuários são BR) |
| 5 | **Backup de Audit Logs** | Exportação automática mensal para storage externo |

---

### Recomendação de Implementação

**Prioridade imediata (esta sessão):**
1. Atualizar os findings do scanner (deletar os 3 já corrigidos)
2. Implementar **MFA/2FA com TOTP** — maior impacto de segurança real
3. Implementar **bloqueio de conta por tentativas falhas** (account lockout)

**Próximo ciclo:**
4. Dashboard de segurança consolidado
5. Criptografia real das credenciais de Ads
6. Alertas de segurança em tempo real

Posso começar pela implementação do MFA e account lockout, ou prefere outra priorização?

