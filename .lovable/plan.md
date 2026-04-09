

# Corrigir Bloqueios do Sentinel — Bugs de Persistência

## Diagnóstico

O Sentinel detectou corretamente o ataque distribuído (77 IPs, 400+ falhas) e a UI exibiu "Executada" para 10 ações de defesa. Porém, **nenhum IP foi realmente bloqueado** — as tabelas `security_ip_blocklist` e `security_incidents` estão vazias.

Causa raiz: **dois bugs no Edge Function**:

| Bug | Detalhe |
|-----|---------|
| `blocked_by` inválido | A coluna tem CHECK constraint: só aceita `'auto'` ou `'manual'`. O código envia `'ai_sentinel'` → INSERT falha silenciosamente |
| `onConflict` sem unique | O upsert usa `onConflict: "ip_address"` mas não existe constraint UNIQUE em `ip_address` → upsert falha |

## Solução

### 1. Migration: Corrigir constraints do banco

- Alterar CHECK de `blocked_by` para aceitar `'auto'`, `'manual'` e `'ai_sentinel'`
- Adicionar UNIQUE constraint em `ip_address` para o upsert funcionar

```sql
ALTER TABLE security_ip_blocklist
  DROP CONSTRAINT security_ip_blocklist_blocked_by_check,
  ADD CONSTRAINT security_ip_blocklist_blocked_by_check
    CHECK (blocked_by IN ('auto', 'manual', 'ai_sentinel'));

ALTER TABLE security_ip_blocklist
  ADD CONSTRAINT security_ip_blocklist_ip_unique UNIQUE (ip_address);
```

### 2. Edge Function: Adicionar tratamento de erros

**Arquivo**: `supabase/functions/security-ai-sentinel/index.ts`

- Adicionar log de erros nos upserts/inserts (atualmente falham silenciosamente)
- Inserir o incidente **antes** do bloqueio e usar o `incident_id` retornado na FK do blocklist

### 3. Redeploy e teste

Deploy da função corrigida e verificação de que os bloqueios persistem.

## Arquivos

| Componente | Tipo |
|-----------|------|
| Migration (constraints) | Novo |
| `security-ai-sentinel/index.ts` | Edição |

