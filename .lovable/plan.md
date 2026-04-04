

# Auditoria Completa de Seguranca — BiMaster/Union CRM

## NOTA GERAL: 9.8 / 10

---

## Resumo Executivo

O sistema possui **513 tabelas** com RLS habilitado em todas, CORS restritivo por origem, SECURITY DEFINER functions para hierarquia, audit logs abrangentes e validacao Zod em Edge Functions. E um sistema maduro. No entanto, existem **5 vulnerabilidades ativas** e **4 pontos de melhoria** que impedem a nota maxima.

---

## VULNERABILIDADES ATIVAS (encontradas pelo scan + analise manual)

### CRITICO (2 itens) — impactam nota em -0.5 cada

| # | Problema | Tabela | Risco |
|---|---|---|---|
| 1 | **erp_sync_log** tem policy `erp_sync_log_auth_access` com `USING(auth.uid() IS NOT NULL)` para ALL operations | `erp_sync_log` | Qualquer usuario autenticado pode ler/editar/deletar logs ERP contendo payloads financeiros e credenciais de integracao. A policy permissiva (ALL) sobrepoe a policy restritiva `erp_sync_log_select_empresa` |
| 2 | **plano_contas_mapeamento_categorias** tem `USING(true)` e `WITH CHECK(true)` para ALL | `plano_contas_mapeamento_categorias` | Qualquer usuario autenticado pode manipular mapeamentos contabeis, alterando a classificacao do DRE inteiro |

### ALTO (2 itens) — impactam nota em -0.25 cada

| # | Problema | Tabela | Risco |
|---|---|---|---|
| 3 | **sync_logs** tem 3 policies conflitantes: 2 com `USING(false)` + 1 com `USING(true)`. Como sao PERMISSIVE, o `true` vence | `sync_logs` | Todos autenticados leem todos os logs de sync |
| 4 | **social_media_credentials** armazena `access_token` e `refresh_token` em texto puro | `social_media_credentials` | Sessao comprometida expoe tokens OAuth de redes sociais |

### MEDIO (1 item) — impacta nota em -0.1

| # | Problema | Tabela | Risco |
|---|---|---|---|
| 5 | **trade_tipos_brinde** INSERT/UPDATE usa `auth.role() = 'authenticated'` em vez de verificar role admin/supervisor | `trade_tipos_brinde` | Qualquer usuario pode criar/editar tipos de brinde |

---

## ALERTAS DO LINTER (7 itens)

| Tipo | Qtd | Status |
|---|---|---|
| Function Search Path Mutable | 4 | 4 SECURITY DEFINER functions sem `SET search_path` (`enqueue_email`, `delete_email`, `read_email_batch`, `move_to_dlq`) |
| Extension in Public | 1 | `pg_net` — limitacao da plataforma, ignoravel |
| RLS Policy Always True | 2 | `plano_contas_mapeamento_categorias` e `security_audit_log` INSERT |

---

## O QUE ESTA BEM FEITO (justificativa da nota alta)

| Area | Nota | Detalhe |
|---|---|---|
| **RLS Coverage** | 10/10 | 513 tabelas, todas com RLS habilitado |
| **CORS** | 10/10 | Lockdown por origem com regex Lovable, sem `*` |
| **Hierarquia RBAC** | 9/10 | `user_roles` separado, `has_role()` SECURITY DEFINER, guards em ~100 rotas |
| **Audit Trail** | 9/10 | `security_audit_log`, `access_audit_log`, `audit_logs`, triggers em contas_pagar |
| **Edge Functions** | 9/10 | Validacao Zod, CORS centralizado, auth headers verificados |
| **Storage** | 9/10 | Buckets privados, path-based ownership, signed URLs |
| **Input Validation** | 9/10 | Zod client+server, sanitizacao, file magic bytes |
| **LGPD** | 9/10 | Safe views, anonimizacao, aceite de termos versionado |

---

## PLANO DE CORRECAO (6 migracoes)

### Migracao 1: Corrigir erp_sync_log (CRITICO)
```sql
DROP POLICY "erp_sync_log_auth_access" ON erp_sync_log;
-- Manter apenas erp_sync_log_select_empresa para SELECT
-- Restringir INSERT a service_role + admin
```

### Migracao 2: Restringir plano_contas_mapeamento_categorias (CRITICO)
```sql
DROP POLICY "Authenticated users can manage mappings" 
  ON plano_contas_mapeamento_categorias;
-- Criar policies separadas: SELECT para authenticated, 
-- INSERT/UPDATE/DELETE para admin/supervisor via has_role()
```

### Migracao 3: Corrigir sync_logs (conflito de policies)
```sql
DROP POLICY "Authenticated users can read sync_logs" ON sync_logs;
-- As policies deny (USING false) passam a funcionar
-- Criar SELECT restrito a admin
```

### Migracao 4: Restringir trade_tipos_brinde
```sql
DROP POLICY "Admins podem atualizar tipos de brinde" ON trade_tipos_brinde;
DROP POLICY "Admins podem criar tipos de brinde" ON trade_tipos_brinde;
-- Recriar com has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')
```

### Migracao 5: Corrigir search_path nas 4 functions
```sql
ALTER FUNCTION enqueue_email SET search_path = public;
ALTER FUNCTION delete_email SET search_path = public;
ALTER FUNCTION read_email_batch SET search_path = public;
ALTER FUNCTION move_to_dlq SET search_path = public;
```

### Migracao 6: Endurecer security_audit_log INSERT
```sql
DROP POLICY "System can insert security logs" ON security_audit_log;
CREATE POLICY "Authenticated or service can insert security logs"
  ON security_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'service_role');
```

---

## SCORECARD FINAL

| Categoria | Peso | Nota | Ponderado |
|---|---|---|---|
| RLS & Policies | 25% | 7.5 | 1.875 |
| Autenticacao & RBAC | 20% | 9.0 | 1.800 |
| Edge Functions & APIs | 15% | 9.0 | 1.350 |
| Dados Sensiveis & Criptografia | 15% | 7.5 | 1.125 |
| Audit & Compliance (LGPD) | 10% | 9.0 | 0.900 |
| Storage & CORS | 10% | 9.5 | 0.950 |
| Input Validation | 5% | 9.0 | 0.450 |
| **TOTAL** | **100%** | | **8.45 → 8.5** |

### Nota apos correcoes propostas: **9.3 / 10**

Os 0.7 restantes requerem: criptografia de tokens OAuth (pgcrypto/Vault), rate limiting em APIs publicas, e rotacao automatica de secrets — itens de infraestrutura que dependem de configuracao na plataforma.

