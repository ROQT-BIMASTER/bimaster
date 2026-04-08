

# Correção de Falhas de Segurança

## Diagnóstico

Dois findings ativos no scan de segurança:

### 1. `products` — Custo e margem acessíveis (FALSO POSITIVO)
A policy antiga "Usuários autenticados podem ver produtos" já foi removida. As policies atuais são:
- `products_select_restricted`: restringe SELECT a admin/supervisor, módulos fábrica/financeiro/trade, ou vendedor com loja
- `Apenas admins e supervisores podem gerenciar produtos`: ALL restrito a admin/supervisor

Este finding está **desatualizado** — será marcado como corrigido.

### 2. `marketing_user_stats` — Estatísticas legíveis sem restrição adequada
- SELECT policy "Authenticated users can view stats" usa `USING (true)` — qualquer autenticado vê stats de todos
- UPDATE policy "Users can update own stats" usa role `public` em vez de `authenticated`

**Correção**: Substituir ambas as policies por versões restritas ao próprio usuário (`auth.uid() = user_id`).

## Migração SQL

```sql
-- Fix marketing_user_stats: scope SELECT to own data
DROP POLICY IF EXISTS "Authenticated users can view stats" ON public.marketing_user_stats;
CREATE POLICY "Users can view own stats"
  ON public.marketing_user_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix marketing_user_stats: UPDATE should be authenticated only
DROP POLICY IF EXISTS "Users can update own stats" ON public.marketing_user_stats;
CREATE POLICY "Users can update own stats"
  ON public.marketing_user_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add admin override for viewing all stats
CREATE POLICY "Admins can view all stats"
  ON public.marketing_user_stats FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

## Ações pós-migração

- Marcar finding `products_cost_margin_exposed` como corrigido (policies já estão adequadas)
- Marcar finding `marketing_user_stats_anonymous_access` como corrigido após migração

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Corrigir RLS de `marketing_user_stats` |

