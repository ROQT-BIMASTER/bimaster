

# Análise: Impacto do DDoS Shield na Fábrica China

## A preocupação é válida

Os usuários da fábrica na China têm cenários que poderiam ser afetados por rate limiting mal calibrado:

1. **Upload em massa** — Submissões com múltiplos arquivos (fotos de garrafa, cores, embalagem) geram várias requisições simultâneas
2. **NAT compartilhado** — Fábricas chinesas frequentemente usam um único IP público para vários funcionários, o que faria todos baterem o mesmo limite de IP
3. **Great Firewall** — A instabilidade de rede na China causa retries automáticos, inflando a contagem de requisições
4. **Latência alta** — Conexões lentas fazem o frontend repetir chamadas que parecem ter falhado

## Ajuste necessário no plano

O plano original precisa de 3 ajustes para proteger os usuários China:

### 1. Rate limiting baseado em `user_id`, não IP, para usuários autenticados
- Usuários logados: limite por `user_id` (ignora IP completamente)
- Apenas requisições anônimas (sem JWT) usam IP como identificador
- Isso elimina o problema de NAT compartilhado na fábrica

### 2. Limites mais generosos para uploads
- Requisições normais (queries, navegação): **120 req/min** por usuário
- Uploads de arquivos (Storage): **excluídos** do rate limiting (já controlados pelo Supabase Storage)
- Edge Functions específicas (analisar-planilha-ia): mantêm seus próprios limites internos

### 3. Whitelist por departamento China
- A Edge Function `ddos-shield` verificará o JWT e, se o usuário pertencer ao departamento "China" (via `useChinaUserContext` logic), aplicará limites **2x maiores** (240 req/min)
- Isso acomoda os fluxos intensivos de submissão com múltiplas fotos

## Resumo

| Cenário | Sem ajuste | Com ajuste |
|---------|-----------|-----------|
| 3 funcionários no mesmo IP enviando produtos | ⚠️ Poderiam ser bloqueados (60 req/min por IP) | ✅ Cada um tem 240 req/min por user_id |
| Upload de 20 fotos de uma vez | ⚠️ 20 requests contados | ✅ Uploads excluídos do rate limit |
| Retry por instabilidade de rede | ⚠️ Infla contador de IP | ✅ Contador por user_id, limite generoso |

## Implementação

O plano original será executado com estas modificações:
1. **Edge Function `ddos-shield`**: Rate limiting por `user_id` (autenticados) ou IP (anônimos), com whitelist para departamento China (2x limite)
2. **Tabela `ddos_rate_limits`**: Coluna `identifier` armazena `user_id` ou IP conforme o caso
3. **Exclusão de uploads**: Requisições ao Storage não passam pelo shield
4. **Relatório e projeto**: Atualizados como planejado anteriormente

A fábrica na China **continuará usando o sistema normalmente**. A proteção DDoS bloqueia apenas abuso real (bots, scrapers, ataques), não uso legítimo.

