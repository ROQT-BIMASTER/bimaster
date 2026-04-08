

# Revisão Completa de APIs, Documentação e Segurança

## Diagnóstico

### Problemas Ativos de Segurança (2 findings críticos)

1. **`marketing_user_stats` — SELECT público para anônimos**
   - Policy `Users can view all stats` usa `USING(true)` com role `public`, expondo pontos, streaks e níveis de todos os usuários para qualquer pessoa sem autenticação.
   - **Fix**: Substituir por policy restrita a `authenticated`.

2. **`products` — Custo e margem expostos a todos os autenticados**
   - Policy `Usuários autenticados podem ver produtos` usa `USING(true)` para `authenticated`, tornando a policy restritiva `products_select_restricted` inútil (PERMISSIVE policies são OR-combined).
   - **Fix**: Dropar a policy permissiva genérica. A `products_select_restricted` já cobre os acessos legítimos (admin/supervisor + módulos fábrica/financeiro/trade + vendedores).

### Problemas na `contas-receber-api` (recém-criada)

3. **Sem validação Zod** — Nenhum schema de validação nos endpoints POST/PUT. Aceita qualquer campo sem sanitização.
4. **Sem WAF** — Não integra `wafCheck()`, diferente de 6 outras APIs críticas.
5. **Sem audit logging** — Operações de escrita (incluir, alterar, excluir, cancelar) não registram em `security_audit_log`.
6. **`cancelar-recebimento`, `conciliar`, `desconciliar` são stubs** — Retornam sucesso sem nenhuma operação real no banco.

### Linter Supabase

- Apenas 1 warning (`pg_net` em public schema) — limitação da plataforma, já ignorado.

### Documentação

- `docs/API_CONTAS_RECEBER.md` documenta rotas que agora existem e estão funcionais.
- Sem inconsistências de rota detectadas.

---

## Plano de Implementação

### Migração 1 — Corrigir RLS (2 tabelas)

```sql
-- 1. marketing_user_stats: restringir a authenticated
DROP POLICY "Users can view all stats" ON marketing_user_stats;
CREATE POLICY "Authenticated users can view stats"
  ON marketing_user_stats FOR SELECT TO authenticated USING (true);

-- 2. products: remover policy genérica (products_select_restricted já cobre)
DROP POLICY "Usuários autenticados podem ver produtos" ON products;
```

### Arquivo 1 — `contas-receber-api/index.ts`

Adicionar:
- Import e uso de `wafCheck` / `wafBlockResponse` no início do handler
- Schemas Zod para os endpoints `incluir`, `alterar`, `upsert`, `upsert-lote`, `lancar-recebimento` e `cancelar`
- Logging de auditoria em operações de escrita (insert em `security_audit_log`)

### Pós-implementação

- Deletar os 2 security findings resolvidos (`marketing_user_stats_anonymous_access`, `products_cost_margin_exposed`)
- Atualizar `SEGURANCA_PRODUCAO.md` com as correções

---

## Resumo de Impacto

| Item | Severidade | Ação |
|------|-----------|------|
| `marketing_user_stats` anon SELECT | **Crítico** | Drop policy, recriar para authenticated |
| `products` custo exposto | **Crítico** | Drop policy genérica |
| `contas-receber-api` sem Zod | Alto | Adicionar schemas de validação |
| `contas-receber-api` sem WAF | Alto | Integrar `wafCheck()` |
| `contas-receber-api` sem audit | Médio | Adicionar logging de escrita |
| Stubs sem implementação | Baixo | Documentar como "não implementado" |

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| Migração SQL | Corrigir 2 policies RLS |
| `supabase/functions/contas-receber-api/index.ts` | WAF + Zod + audit logging |

