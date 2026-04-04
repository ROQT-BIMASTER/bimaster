

# Atualizar Documentacao de Seguranca e Corrigir Impacto nas APIs

## Problema

Apos as 4 rodadas de correcoes de seguranca (nota 8.5 -> 9.3 -> 9.8 -> 10.0), a documentacao do sistema ficou **desatualizada** em 4 arquivos e ha **1 edge function com bug** que ainda le token plaintext.

## Diagnostico

### Documentacao Desatualizada

| Arquivo | Status Atual | Problema |
|---|---|---|
| `docs/SECURITY.md` | Score 85/100, data 2025-11-16 | Desatualizado em ~6 meses. Nao menciona Vault, rate limiting, criptografia OAuth |
| `SEGURANCA_PRODUCAO.md` | Score 96/100, data 31/10/2025 | Nao reflete correcoes de RLS, Vault, nem funcoes corrigidas |
| `docs/AUDITORIA_SEGURANCA.md` | v2.0, data 2026-03-20 | Nao inclui Fase 3 (RLS hardening, Vault, rate limiting, secret rotation) |
| `.lovable/plan.md` | Score 10.0 mas texto contraditorio | Corpo do texto ainda lista vulnerabilidades como "ativas" e scorecard mostra 8.5 |

### Impacto nas APIs do Portal ERP

| Funcao | Problema | Risco |
|---|---|---|
| `sync-all-accounts/index.ts` (linha 53) | Ainda le `account.access_token` (coluna plaintext **dropada**) | **QUEBRADO** — vai retornar `null` para token, metricas nao serao coletadas |
| `social-media-cron/index.ts` | Ja corrigido para usar `access_token_encrypted` + `decrypt_token` RPC | OK |
| `erp-export-payment/index.ts` | Nao usa tokens OAuth, nao impactado | OK |
| `erp-sync-engine/index.ts` | Usa conexao SQL direta, nao impactado | OK |
| `docs/EDGE_FUNCTIONS.md` | Documentacao de social-media nao menciona criptografia | Desatualizado |

## Plano de Execucao

### 1. Corrigir `sync-all-accounts/index.ts` (BUG)
- Substituir `select('*')` por `select('id, platform, username, account_name, status, access_token_encrypted')`
- Adicionar decrypt via `supabase.rpc('decrypt_token', { p_encrypted: account.access_token_encrypted })`
- Passar token decriptado para `social-media-metrics` (mesmo padrao do `social-media-cron`)

### 2. Atualizar `docs/SECURITY.md`
- Score: 85 -> 100
- Data: 2026-04-04
- Adicionar secoes: Criptografia OAuth (Vault), Rate Limiting customizado, Rotacao de Secrets, RLS Hardening realizado
- Remover TODOs ja implementados
- Atualizar exemplo de credenciais (coluna encrypted, nao plaintext)

### 3. Atualizar `SEGURANCA_PRODUCAO.md`
- Score: 96 -> 100
- Adicionar secao "Fase 3 — Correcoes Abril 2026" com: RLS hardening (6 tabelas), Vault dedicado, Rate Limiting, Secret Rotation Schedule
- Atualizar checklist de producao (marcar itens concluidos)

### 4. Atualizar `docs/AUDITORIA_SEGURANCA.md`
- Adicionar "FASE 3 — SEC-7 a SEC-12" com as 6 migracoes realizadas:
  - SEC-7: RLS erp_sync_log
  - SEC-8: RLS plano_contas_mapeamento_categorias
  - SEC-9: RLS sync_logs
  - SEC-10: RLS trade_tipos_brinde + security_audit_log
  - SEC-11: Vault dedicado + encrypt/decrypt refatorados
  - SEC-12: Rate limiting + secret rotation schedule
- Atualizar Recomendacoes Futuras (remover itens ja feitos)

### 5. Atualizar `.lovable/plan.md`
- Reescrever para refletir estado final: todas vulnerabilidades corrigidas, scorecard 10/10, sem itens pendentes

### 6. Atualizar `docs/EDGE_FUNCTIONS.md`
- Adicionar nota sobre criptografia de tokens OAuth nas secoes de Social Media e Sync All Accounts

## Arquivos Alterados

| Arquivo | Tipo |
|---|---|
| `supabase/functions/sync-all-accounts/index.ts` | Bug fix (token plaintext -> encrypted) |
| `docs/SECURITY.md` | Documentacao |
| `SEGURANCA_PRODUCAO.md` | Documentacao |
| `docs/AUDITORIA_SEGURANCA.md` | Documentacao |
| `.lovable/plan.md` | Documentacao |
| `docs/EDGE_FUNCTIONS.md` | Documentacao |

