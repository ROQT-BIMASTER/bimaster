

# Corrigir Dados Desatualizados no SIEM

## Problema

A tabela `security_audit_log` está **completamente vazia** (0 registros), assim como `security_incidents` (0 registros). O Event Explorer e o Painel de Seguranca consultam essas tabelas, por isso mostram "nenhum evento".

A unica tabela com dados e a `access_audit_log` (8.072 registros ate agora).

## Causa Raiz

Os eventos de seguranca nunca foram populados porque:
1. O Sentinel nunca executou com sucesso (sem logs)
2. As funcoes client-side que inserem em `security_audit_log` dependem de `auth.uid()`, mas muitos eventos de seguranca (bloqueios, rate limits) acontecem em edge functions com service_role que nao geram registros nessa tabela

## Plano

### 1. Migration SQL — Seed security_audit_log a partir do access_audit_log

Derivar eventos de seguranca dos dados existentes:
- Logins falhados → severidade `high`
- Logins com sucesso → severidade `low`
- Acessos negados → severidade `medium`
- Multiplos logins falhados do mesmo user em 1h → severidade `critical`

Tambem gerar `security_incidents` a partir de padroes de ataque detectados (clusters de falhas).

### 2. Migration SQL — Criar trigger para auto-popular security_audit_log

Trigger em `access_audit_log` que insere automaticamente em `security_audit_log` para eventos relevantes (login_failed, access_denied), garantindo que dados futuros sejam registrados.

### 3. Codigo — Adicionar realtime subscription no Event Explorer

Adicionar `supabase_realtime` para `security_audit_log` e subscription no componente para atualizar automaticamente quando novos eventos chegam.

## Resultado

- SIEM populado com eventos historicos derivados dos 8.072 registros existentes
- Novos eventos inseridos automaticamente via trigger
- Interface atualiza em tempo real

## Arquivos

| Componente | Tipo |
|-----------|------|
| Migration SQL (seed + trigger) | Novo |
| `src/pages/SecurityEventExplorer.tsx` | Edicao — realtime subscription |

