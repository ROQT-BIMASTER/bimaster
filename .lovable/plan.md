
# O Que Falta Para Nota 10 — Gap de 0.7 Pontos

## Score Atual: 9.3 / 10

As 6 migrações já aplicadas corrigiram as 5 vulnerabilidades ativas e os 4 alertas de search_path. Os **0.7 pontos restantes** se dividem em 3 categorias:

---

## 1. Criptografia de Tokens OAuth em Repouso (-0.3)

**Problema**: `social_media_credentials`, `social_media_accounts` e `ads_accounts` armazenam tokens OAuth em texto puro no banco. Mesmo com RLS restritivo, um dump do banco expõe tudo.

**Solução**: Criptografia server-side via `pgcrypto` (extensão já disponível no Cloud):

```text
┌─────────────────┐     ┌──────────────┐
│ Edge Function   │────▶│ pgp_sym_encrypt(token, vault_key) │
│ (grava token)   │     └──────────────┘
│                 │                │
│ Edge Function   │◀───── pgp_sym_decrypt(encrypted, vault_key) │
│ (lê token)      │     └──────────────┘
└─────────────────┘
```

**Implementação**:
- Migração: Adicionar coluna `access_token_encrypted BYTEA` nas 3 tabelas
- Edge function wrapper para encrypt/decrypt usando chave armazenada em Supabase Vault (ou secret)
- Migrar tokens existentes e dropar colunas plaintext
- Atualizar edge functions que leem/gravam tokens

**Dificuldade**: Alta — requer gestão de chave de criptografia (secret rotation) e migração de dados existentes.

---

## 2. Rate Limiting em Endpoints Públicos (-0.2)

**Problema**: Edge functions com `verify_jwt = false` (webhooks, crons) não têm proteção contra abuso de volume. Endpoints autenticados dependem apenas do rate limit padrão do Supabase.

**Solução**: Rate limiting customizado via tabela + middleware:

```text
security_rate_limits (tabela)
├── endpoint TEXT
├── ip TEXT
├── window_start TIMESTAMPTZ
├── request_count INT
└── max_requests INT (configurável por endpoint)
```

**Implementação**:
- Migração: Criar tabela `security_rate_limits`
- Middleware: Verificar contagem antes de processar request
- Configurar limites por endpoint (ex: webhook = 100/min, export = 10/hour)
- Cleanup automático via pg_cron (limpar registros > 1h)

**Dificuldade**: Média — o middleware de segurança já existe (`security-middleware.ts`), basta estender.

---

## 3. Rotação Automática de Secrets (-0.1)

**Problema**: API keys e tokens de integração (ERP, WhatsApp, redes sociais) não têm rotação automática. Dependem de ação manual trimestral.

**Solução**: Sistema de rotação + alerta:

**Implementação**:
- Migração: Tabela `secret_rotation_schedule` com campos `last_rotated`, `rotation_interval_days`, `next_rotation`
- Edge function cron (semanal): Verificar secrets próximos do vencimento
- Notificação via email/toast para admins quando secret está a 7 dias de expirar
- Log em `security_audit_log` a cada rotação

**Dificuldade**: Média — depende de integração com cada provedor para rotação efetiva dos tokens.

---

## 4. Alerta Residual do Linter (-0.1)

**Problema**: Ainda há 1 warning de "RLS Policy Always True" — provavelmente `security_audit_log` INSERT (policy com `WITH CHECK(true)` que já foi corrigida na migração, mas o linter pode estar cacheado).

**Ação**: Verificar se a migração 6 já resolveu. Se persistir, identificar a tabela exata e restringir.

---

## Resumo do Gap

| Item | Impacto | Dificuldade | Dependência |
|---|---|---|---|
| Criptografia OAuth (pgcrypto) | -0.3 | Alta | Gestão de chave |
| Rate Limiting customizado | -0.2 | Média | Extensão do middleware existente |
| Rotação automática de secrets | -0.1 | Média | Integração com provedores |
| Linter residual | -0.1 | Baixa | Verificação pós-migração |
| **TOTAL** | **-0.7** | | |

## Recomendação

Implementar na ordem: **Rate Limiting** (maior ROI, média dificuldade) → **Criptografia OAuth** (maior impacto, alta dificuldade) → **Rotação de Secrets** (complementar).

Os 3 itens podem ser implementados via migrações + edge functions. Deseja que eu implemente algum deles?
