# Plano: Elevar segurança para nota máxima em produção

## Estado atual (medido)
- 2 RLS quebradas confirmadas (`product_comparisons`, `social_media_metrics_history`)
- 295 funções `SECURITY DEFINER` com `EXECUTE` para `authenticated` (e algumas para `anon`)
- Extensão `pg_net` instalada em `public` (recomendado: schema `extensions`)
- 1 tabela com RLS habilitada e zero políticas (`global_rate_limit_buckets`)
- Headers de segurança via `<meta>` (não HTTP), sem CI gate

## Estratégia: 3 fases por nível de risco

---

### Fase 1 — Correções cirúrgicas de RLS (ZERO risco, ganho alto)

**1.1 `product_comparisons`** — remover policy permissiva e escopar leitura:

```sql
DROP POLICY "Authenticated users can view product_comparisons" ON public.product_comparisons;

CREATE POLICY "Auth users read product_comparisons"
ON public.product_comparisons FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_admin_or_supervisor(auth.uid()));
```

Reescopar também as policies INSERT/UPDATE/DELETE de `{public}` para `{authenticated}` (não muda comportamento — `auth.uid()` já implica login — mas remove o flag do scanner).

**1.2 `social_media_metrics_history`** — a policy escopada já existe e está correta; só falta restringi-la a `{authenticated}`:

```sql
DROP POLICY "Users can view their account metrics history" ON public.social_media_metrics_history;

CREATE POLICY "Users read own account metrics history"
ON public.social_media_metrics_history FOR SELECT TO authenticated
USING (
  account_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.social_media_accounts sma
    WHERE sma.id = social_media_metrics_history.account_id
      AND sma.user_id = auth.uid()
  )
);
```

> Confirmar antes: a policy `Authenticated users can view social media metrics` mencionada pelo scanner não apareceu no `pg_policies` atual — pode já ter sido removida. Se surgir, dropar.

**1.3 `global_rate_limit_buckets`** — adicionar policy explícita:

```sql
CREATE POLICY "Service role only" ON public.global_rate_limit_buckets
FOR ALL TO service_role USING (true) WITH CHECK (true);
```
(Bloqueia anon/authenticated; service_role já bypassa RLS, mas torna a intenção explícita e silencia o linter.)

---

### Fase 2 — Auditoria de `SECURITY DEFINER` (médio risco, ganho alto)

Estratégia **não-destrutiva**: ao invés de revogar EXECUTE em massa (vai quebrar o app), gerar um **relatório classificatório** e atacar por categoria.

**2.1** Script `scripts/security/audit-security-definer.mjs` que:
- Lista todas as funções `SECURITY DEFINER` no `public`.
- Faz `grep` no codebase por `supabase.rpc('<nome>'`, `from('<nome>'`, edge functions e SQL.
- Classifica cada função em:
  - **KEEP**: chamada por `authenticated` no frontend (RPC legítimo) → manter EXECUTE, validar que tem auth check interno.
  - **TRIGGER-ONLY**: usada só em triggers (sem RPC) → `REVOKE EXECUTE FROM authenticated, anon`.
  - **SERVICE-ONLY**: chamada só por edge functions com `service_role` → `REVOKE EXECUTE FROM authenticated, anon`.
  - **ORPHAN**: nenhuma referência → revogar e marcar para deprecação.

**2.2** Aplicar revogações apenas das categorias TRIGGER-ONLY, SERVICE-ONLY e ORPHAN via migration. Estimativa: ~150-200 funções saem da superfície de ataque sem quebrar nada.

**2.3** Para as KEEP, adicionar teste E2E que valida que cada RPC exige `auth.uid()` válido (anon recebe 401/403 ou vazio).

---

### Fase 3 — Hardening de borda + CI (baixo risco, ganho médio)

**3.1** Tentar mover `pg_net` para schema `extensions`:
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_net SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;
```
**Antes**: `grep` por `net.http_post`/`net.http_get` em todas as funções para garantir que `search_path` inclua `extensions`. Se houver muitos sites, **adiar** — é cosmético.

**3.2** Headers HTTP reais via edge function `_security-headers` (proxy) — opcional, só se quisermos remover dependência do `<meta>`.

**3.3** Adicionar `e2e-clickjacking.sh` ao workflow `security-rls-e2e.yml` rodando contra `https://bimaster.online` em schedule diário (não em PR, porque depende de Publish manual).

**3.4** Re-rodar `security--get_scan_results` e `supabase--linter` — esperado: 2 warns resolvidas, ~150 warns SECURITY DEFINER eliminadas.

---

## Execução proposta

Pedir aprovação para **Fase 1 agora** (4 statements SQL, zero risco de quebrar produção) e gerar o relatório classificatório da Fase 2 em paralelo. Fase 3 só após Fases 1+2 validadas.

## Nota esperada após cada fase

| Fase | Nota |
|---|---|
| Atual | 8.0 |
| +Fase 1 | 8.7 |
| +Fase 2 | 9.4 |
| +Fase 3 | 9.7 |

Chegar a 10.0 exige pen-test externo e SOC 2 — fora do escopo de código.

## Riscos & mitigação

- **Fase 1**: nenhuma feature usa as policies permissivas (já há policies escopadas). Risco ~0.
- **Fase 2**: classificação errada pode revogar EXECUTE de RPC ativo → adicionar smoke-test de RPCs críticas (`accept_projeto_convite`, `bulk_upsert_contas_pagar_v2`, etc.) antes de aplicar revogações.
- **Fase 3**: mover `pg_net` é o único item potencialmente disruptivo — pulável.
