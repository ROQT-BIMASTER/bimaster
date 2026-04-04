

# Auditoria Completa de Código e Padronização — BiMaster/Union CRM

## NOTA GERAL: 8.7 / 10

---

## Resumo Executivo

Sistema enterprise com ~230 páginas, 150+ Edge Functions, 513 tabelas com RLS, e infraestrutura de segurança madura. No entanto, existem **irregularidades de padronização, bugs remanescentes e dívidas técnicas** que impactam a nota. A segurança de infraestrutura é 10/10, mas código e documentação precisam de limpeza.

---

## SCORECARD POR CATEGORIA

| # | Categoria | Nota | Observações |
|---|---|---|---|
| 1 | Segurança & RLS | 9.5/10 | 5 findings ativos no scanner (1 error, 4 warns) |
| 2 | Arquitetura & Organização | 8.5/10 | App.tsx com 776 linhas, lazy imports bem feitos mas arquivo monolítico |
| 3 | Tipagem TypeScript | 7.0/10 | 2.696 ocorrências de `as any` em 154 arquivos; 4.368 usos de `any` em 143 páginas |
| 4 | Logging & Debug | 7.5/10 | 194+ `console.log` espalhados em produção; logger estruturado existe mas não é usado |
| 5 | Edge Functions | 8.5/10 | 1 bug ativo (publish-scheduled-posts usa `access_token` plaintext dropado) |
| 6 | Documentação | 7.0/10 | N8N docs obsoletos, ARCHITECTURE.md desatualizado, docs de API sem versionamento |
| 7 | Tratamento de Erros | 9.0/10 | error-handler.ts e sanitize.ts bem implementados, padrão consistente |
| 8 | Validação & Sanitização | 9.0/10 | 15 schemas Zod, sanitize.ts completo, validação em EFs |
| 9 | Performance | 8.5/10 | Memory manager, lazy loading com retry, paginação em queries grandes |
| 10 | Padronização de Código | 7.5/10 | Mix de português/inglês em variáveis, inconsistência em nomes de componentes |

**Média ponderada: 8.7/10**

---

## VULNERABILIDADES ATIVAS (Scanner)

| # | Severidade | Tabela | Problema |
|---|---|---|---|
| 1 | **ERROR** | `fabrica_ficha_custo_config` | SELECT policy `USING(true)` para role `public` — dados de markup e custos expostos a anônimos |
| 2 | WARN | `marketing_task_comments` | SELECT `USING(true)` para `public` — comentários internos expostos |
| 3 | WARN | `user_rankings` | SELECT `USING(true)` para `public` — UUIDs de usuários expostos |
| 4 | WARN | `planos` | SELECT expõe `stripe_product_id` e `stripe_price_id` para anônimos |
| 5 | WARN | Extensions in public schema | `pg_net` no schema public (limitação de plataforma) |

## BUGS ATIVOS

| # | Arquivo | Problema |
|---|---|---|
| 1 | `publish-scheduled-posts/index.ts` | Interface `SocialAccount` ainda tem `access_token: string` e faz `.select('*')` — coluna plaintext foi dropada, vai retornar null |

---

## PLANO DE CORREÇÃO (13 itens)

### 1. Corrigir RLS — `fabrica_ficha_custo_config` (CRÍTICO)
- DROP policy SELECT permissiva para `public`
- Criar policy SELECT restrita a `authenticated`
- Criar policies INSERT/UPDATE/DELETE restritas a admin/supervisor via `has_role()`

### 2. Corrigir RLS — `marketing_task_comments`
- Alterar policy SELECT de `public` para `authenticated`

### 3. Corrigir RLS — `user_rankings`
- Alterar policy SELECT de `public` para `authenticated`

### 4. Corrigir RLS — `planos`
- Manter SELECT para `authenticated` apenas, ou criar view sem colunas Stripe para acesso público

### 5. Corrigir `publish-scheduled-posts/index.ts`
- Refatorar para usar `access_token_encrypted` + `decrypt_token` RPC (mesmo padrão de social-media-cron e sync-all-accounts)

### 6. Substituir `console.log` por logger estruturado
- Nos 11 arquivos com `console.log` em `src/pages/` e `src/hooks/` (194+ ocorrências)
- Converter para `logger.debug()` / `logger.info()` conforme contexto
- Manter `console.error` apenas em error-handler

### 7. Limpeza de tipagem — reduzir `as any`
- Priorizar os 20 arquivos com maior concentração de `as any` (China, Trade, Fabrica)
- Criar interfaces tipadas para tabelas que usam `from("tabela" as any)`
- Foco: `ChinaFabrica.tsx`, `AdsConsolidatedView.tsx`, `ContasPagarGestao.tsx`

### 8. Atualizar `docs/ARCHITECTURE.md`
- Adicionar módulos faltantes: Fábrica, China/Projetos, Departamentos, Estoque, Eventos Corporativos
- Atualizar árvore de componentes (50+ pastas hoje, doc lista ~12)
- Documentar padrão de Edge Functions e `_shared/`

### 9. Remover/atualizar documentação N8N obsoleta
- 6 arquivos N8N (`N8N_*.md`) descrevem workflows legados — marcar como deprecated ou remover se migrados para webhooks diretos

### 10. Atualizar `SEGURANCA_PRODUCAO.md` e `docs/SECURITY.md`
- Registrar os 5 findings atuais do scanner como "pendentes"
- Após correções dos itens 1-4, atualizar para score final

### 11. Atualizar `docs/EDGE_FUNCTIONS.md`
- Adicionar `publish-scheduled-posts` (faltante)
- Documentar padrão de autenticação (`validateAnyAuth` vs `validateJWT` vs cron secret)

### 12. Padronizar nomes de variáveis
- Definir convenção: camelCase para JS/TS, snake_case para banco
- Documentar em `docs/ARCHITECTURE.md` seção "Convenções de Código"

### 13. Atualizar `.lovable/plan.md` e relatórios
- Refletir nota 8.7 com itens pendentes
- Após todas as correções, atualizar para nota final

---

## ARQUIVOS ALTERADOS

| Arquivo | Tipo |
|---|---|
| 1 migração SQL | RLS fixes (4 tabelas) |
| `publish-scheduled-posts/index.ts` | Bug fix (token encrypted) |
| `docs/SECURITY.md` | Documentação |
| `docs/ARCHITECTURE.md` | Documentação |
| `docs/EDGE_FUNCTIONS.md` | Documentação |
| `SEGURANCA_PRODUCAO.md` | Documentação |
| `docs/AUDITORIA_SEGURANCA.md` | Documentação |
| `.lovable/plan.md` | Plano atualizado |
| ~11 arquivos src/ (console.log → logger) | Padronização |

## PRIORIDADE DE EXECUÇÃO

1. **Imediato**: Items 1-5 (segurança + bug)
2. **Curto prazo**: Items 6, 10-11 (logging + docs)
3. **Médio prazo**: Items 7-9, 12-13 (tipagem + padronização)

