

# Revisao Completa de Seguranca — Pos-Ataque

## Problemas Identificados

### A. Bugs Criticos no Sentinel (Bloqueios nao persistem)

| Bug | Impacto |
|-----|---------|
| `source_ip` e do tipo `inet` mas o Sentinel insere `"56.125.x.x"` (string invalida) | 100% dos incidentes de subnet falham com `22P02: invalid input syntax for type inet` |
| `security_ip_blocklist.ip_address` tambem e `inet` — IPs reais funcionam, mas subnet labels nao | Bloqueios de subnet podem falhar dependendo do formato |

### B. `securityCheck` Middleware Nunca Usado

O middleware `_shared/security-middleware.ts` existe mas **nenhuma Edge Function o importa** (0 matches). Mesmo que IPs estejam na blocklist, nenhuma funcao verifica. O bloqueio e decorativo.

### C. 136+ Edge Functions sem `secureHandler`

De 156 Edge Functions, apenas 20 usam `secureHandler`. As outras 136 nao tem WAF, rate limiting nem security headers.

### D. 20 funcoes com `secureHandler` usam `auth: "none"`

Todas as 20 funcoes migradas para `secureHandler` configuram `auth: "none"`, delegando auth ao codigo interno. O envelope de seguranca (WAF + rate limit) funciona, mas a auth centralizada nao e aproveitada.

### E. RLS: 4 vulnerabilidades detectadas pelo scan

1. **Trade campaigns**: 4 tabelas com `SELECT: true` — dados financeiros visiveis a qualquer autenticado
2. **China product submissions**: Dados de P&D visiveis a todos
3. **Storage buckets**: INSERT sem path ownership em 10+ buckets
4. **Extension in public schema**: Risco menor

## Plano de Correcao (Priorizado por Risco)

### 1. Corrigir Sentinel — source_ip inet (Migration)

Mudar coluna `source_ip` de `inet` para `text` em `security_incidents`, ou converter o valor inserido para um IP valido do subnet (ex: primeiro IP real da lista em vez de `"56.125.x.x"`).

**Recomendacao**: Usar o primeiro IP real do subnet como `source_ip` e guardar o label `"56.125.x.x"` no campo `description` ou `metadata`. Sem migracao de schema.

**Arquivo**: `supabase/functions/security-ai-sentinel/index.ts` — Linhas 363-373, trocar `source_ip: defense.target` por `source_ip: ipsToBlock[0]` e incluir o prefix no campo description.

### 2. Integrar `securityCheck` no `secureHandler` (Critico)

**Arquivo**: `supabase/functions/_shared/secure-handler.ts`

Adicionar chamada a `securityCheck(req)` no pipeline, entre WAF e auth. Se o IP estiver bloqueado (hard), retornar 403. Se soft, continuar mas com rate limit mais agressivo.

Isso faz com que as 20 funcoes que ja usam `secureHandler` ganhem automaticamente protecao por blocklist.

### 3. Corrigir RLS — Trade Campaigns (Migration)

Remover policies `SELECT: true` das 4 tabelas:
- `trade_campaign_orders`
- `trade_campaign_expenses`
- `trade_campaign_products`
- `trade_campaign_sellout_entries`

Substituir por policies baseadas em ownership ou role.

### 4. Corrigir RLS — China Submissions (Migration)

Remover `SELECT: true` de `china_produto_submissoes`. Restringir a criador + modulo fabrica + admin.

### 5. Marcar findings corrigidos no security scanner

Atualizar status dos findings apos correcoes.

## Resumo de Arquivos

| Arquivo | Tipo | Correcao |
|---------|------|----------|
| `security-ai-sentinel/index.ts` | Edicao | source_ip com IP real em vez de label |
| `_shared/secure-handler.ts` | Edicao | Integrar securityCheck no pipeline |
| Migration SQL | Novo | RLS para 5 tabelas (trade + china) |

## Fora de Escopo (Proxima Fase)

- Migrar as 136 Edge Functions restantes para `secureHandler` (esforco grande, priorizar as mais expostas)
- Storage bucket policies (requer analise por bucket)

