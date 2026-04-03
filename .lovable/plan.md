

# Upgrade de Segurança: Nível Enterprise Inteligente

## Nota Atual: 92/100 — Meta: 98/100

O sistema já possui correlação, auto-resposta e SIEM básico. Os refinamentos abaixo adicionam inteligência, granularidade e métricas executivas sem interferir no que está em produção.

---

## 1. Migração: Novos Campos nas Tabelas Existentes

### `security_incidents` — adicionar:
- `confidence_score` (numeric 0-1, default 0.8) — grau de confiança da detecção
- `detection_method` (text, default 'rule_based') — valores: rule_based, anomaly, manual

### `security_ip_blocklist` — adicionar:
- `block_level` (text, default 'hard') — valores: soft (rate limit apenas), hard (bloqueio total)

Estes campos eliminam decisões binárias e reduzem falsos positivos.

---

## 2. Correlation Engine — 2 Novas Regras

### Regra: Behavioral Anomaly
- Detecta usuário acessando de 3+ regiões/IPs distintos em 1h quando seu padrão é estável
- Gera incidente medium com confidence_score 0.6 e detection_method "anomaly"

### Regra: Privilege Abuse
- Admin com 15+ ações sensíveis (export, delete, permission_change) em 1h
- Gera incidente high — detecta potencial fraude interna

### Ajuste nas regras existentes:
- Todas passam a incluir `confidence_score` e `detection_method` nos inserts
- Brute force 5-10 = confidence 0.7, 10-20 = 0.9, 20+ = 1.0

---

## 3. Security Middleware — Cache em Memória

O `security-middleware.ts` atualmente consulta o banco a cada request. Adicionar:
- Cache in-memory da blocklist com TTL de 30 segundos (Map + timestamp)
- Diferenciar `block_level`: soft → aplicar rate limit agressivo; hard → rejeitar 403
- Evita gargalo de DB em cenários de alto tráfego

---

## 4. Dashboard — KPIs Executivos

### Novos KPIs no `SecurityDashboard.tsx`:
- **MTTR** (Mean Time To Resolve): tempo médio entre `created_at` e `resolved_at` dos incidentes resolvidos
- **Incidentes por Empresa**: query agrupada por `empresa_id` com mini-bar chart
- **Top 5 IPs Suspeitos**: IPs com mais incidentes/bloqueios na última semana

### `SecurityScoreGauge.tsx`:
- Incorporar `confidence_score` médio dos incidentes abertos no cálculo do score

---

## 5. Event Explorer — Session View + Attack Chain

### Session View:
- Agrupar eventos por `user_id` + janela de tempo (30min) como "sessão"
- Exibir timeline visual de ações dentro de cada sessão

### Attack Chain:
- Quando um incidente tem `related_events`, exibir sequência cronológica como "cadeia de ataque"
- Badge visual para cadeia completa (reconnaissance → exploit → exfiltration)

### Ações diretas no Explorer:
- Botão "Bloquear IP" → insere em `security_ip_blocklist` com block_level selecionável
- Botão "Lockout Usuário" → atualiza metadata do user via edge function

---

## Arquivos a Criar/Alterar

| Arquivo | Ação |
|---|---|
| **Migração SQL** | ALTER TABLE: 3 novos campos (confidence_score, detection_method, block_level) |
| `supabase/functions/security-correlation-engine/index.ts` | Alterar — 2 novas regras + confidence_score em todas |
| `supabase/functions/_shared/security-middleware.ts` | Alterar — cache in-memory + block_level soft/hard |
| `src/pages/SecurityDashboard.tsx` | Alterar — MTTR, incidentes por empresa, top IPs |
| `src/components/security/SecurityKPICards.tsx` | Alterar — novos cards MTTR + Top IPs |
| `src/components/security/SecurityScoreGauge.tsx` | Alterar — incluir confidence no cálculo |
| `src/pages/SecurityEventExplorer.tsx` | Alterar — session view, attack chain, ações diretas |
| `src/components/security/EventDetailDrawer.tsx` | Alterar — mostrar confidence_score + detection_method |
| `src/components/security/SecurityIncidentPanel.tsx` | Alterar — mostrar confidence + detection_method |

---

## Resultado Esperado

- Falsos positivos reduzidos via confidence_score
- Fraude interna detectável via privilege_abuse
- Anomalias comportamentais detectadas
- Cache elimina gargalo de middleware
- Métricas executivas (MTTR, por empresa, top IPs)
- Session view e attack chain para investigação real
- **Nota estimada: 98/100**

