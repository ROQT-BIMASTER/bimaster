## Auditoria e endurecimento de RLS

### Estado atual (discovery executada agora no banco)

| Check | Resultado | Status |
|---|---|---|
| Tabelas `public.*` sem RLS | **0 / 673** | ✅ |
| Tabelas com RLS sem nenhuma policy | **0** | ✅ |
| `SECURITY DEFINER` sem `search_path` | **0** | ✅ |
| Policies `USING(true)` (qual literal `true`) | **572** | ⚠ majoritariamente em policies INSERT (onde Postgres ignora USING — falso positivo). Real: ~30 SELECT/UPDATE/DELETE precisam triagem |
| Policies `auth.uid() IS NOT NULL` (sem isolamento por tenant) | **141** | ⚠ alvo principal de hardening |
| UPDATE/ALL sem `WITH CHECK` explícito | **298** | ℹ Postgres reaproveita USING para WITH CHECK quando ausente — risco baixo, mas explicitar nas hot evita acidentes futuros |
| Views/MVs sem `security_invoker=true` | **5** (todas materialized views de dashboard) | ⚠ corrigir |
| Linter Supabase | **169 findings** (predominantemente `0029_authenticated_security_definer_function_executable` — ~150 funções SECDEF com EXECUTE para `authenticated`) | ⚠ revisar grants |

Tabelas críticas já auditadas e **OK**: `contas_pagar`, `contas_receber`, `clientes`, `empresas`, `profiles`, `user_roles` (todas com isolamento por `empresa_id` ou `has_role`, INSERT com `WITH CHECK` real).

### Estratégia: 5 lotes incrementais, **um lote por mensagem futura**, cada migration isolada com rollback documentado e smoke test em branch antes de merge.

---

### Lote 0 — Discovery & relatório (SEM migrations)

1. Rodar todas as queries da Fase 1 do prompt e snapshotar resultados em `docs/SECURITY-RLS-AUDIT.md`:
   - Lista completa das 141 policies `auth.uid() IS NOT NULL` com tabela, comando, e classificação (público intencional vs precisa hardening).
   - Lista das 572 `USING(true)` filtrando INSERT (onde é semanticamente ok) → restando ~30 SELECT/UPDATE/DELETE para triagem.
   - Top 30 tabelas por volume + suas policies (para detectar `auth.uid()` direto que cause `auth_rls_initplan`).
   - Lista nominal das ~150 funções SECDEF executáveis por `authenticated` (linter 0029) com filename de origem em `supabase/migrations/` quando rastreável.
   - Tabela de exceções intencionais (lookups: `bancos`, `bandeiras_cartao`, `cidades`, `paises`, `cnae`, `feriados`, `tipos_anexo`, etc.).
2. Critério de classificação por finding:
   - **Crítico**: SELECT/UPDATE/DELETE com `USING(true)` ou `auth.uid() IS NOT NULL` em tabela com PII/financeiro.
   - **Médio**: UPDATE sem `WITH CHECK` explícito em tabela multi-tenant.
   - **Médio**: MV/view sem `security_invoker=true`.
   - **Baixo**: SECDEF executável por authenticated quando função é genuinamente helper (ex.: `has_role`, `user_has_empresa_access`) — manter; revogar quando função expõe dados cross-tenant.
   - **Performance**: `auth.uid()` direto em policy de tabela hot → `(select auth.uid())`.
   - **OK**: lookups públicos.
3. **Entregável do Lote 0**: `docs/SECURITY-RLS-AUDIT.md` com tabela completa de findings + classificação + lote alvo. Nenhuma alteração de schema.

### Lote 1 — Materialized views (rápido e isolado)

Recriar as 5 MVs com `security_invoker=true` (ou trocar para views regulares quando a MV não for performance-crítica). Migration única com rollback (recriar MV sem opt).

MVs alvo:
- `mv_analise_departamentos`
- `mv_financeiro_dashboard`
- `mv_trade_performance`
- `mv_conversion_funnel`
- `mv_sales_performance`

### Lote 2 — Policies `auth.uid() IS NOT NULL` em tabelas multi-tenant (CRÍTICO)

Apenas as policies classificadas como críticas no Lote 0 (estimativa: 30–60 policies). Uma migration por tabela hot, agrupadas (uma migration) para tabelas de baixo volume. Padrão:
- `DROP POLICY ... CREATE POLICY ...` no mesmo `BEGIN/COMMIT`.
- USING e WITH CHECK com semi-join em `user_empresa_access` ou `user_empresas` (fontes de verdade já existentes no projeto).
- Usar `(select auth.uid())` para performance.

### Lote 3 — Policies `USING(true)` reais (não-INSERT) em tabelas com dados não-públicos

Após filtrar INSERT (que são corretas), substituir as ~30 restantes por policy hardened ou marcar como exceção em `docs/SECURITY-RLS-AUDIT.md`.

### Lote 4 — `WITH CHECK` explícito em UPDATE/ALL nas hot tables

Adicionar `WITH CHECK` explícito (igual ao USING) em UPDATE policies das tabelas top-30 por volume. Migration por tabela.

### Lote 5 — SECURITY DEFINER overexposed (linter 0029)

Para cada função listada no linter:
- Se é helper interno (chamado por outras funções/policies) e **não retorna dados sensíveis**: `REVOKE EXECUTE ON FUNCTION ... FROM authenticated, anon;` mantendo `service_role`.
- Se é RPC chamada do frontend: manter o grant, mas validar que tem checagem interna de role/empresa (`has_role`, `user_has_empresa_access`).
- Snapshot de chamadores já existe em `src/data/security/security-definer-snapshot.json` — usar como guia.

### Validação obrigatória por lote (Fase 4 do prompt)

1. `supabase--migration` aplica a migration → harness cria branch automaticamente.
2. Rodar smoke test E2E existente (`scripts/security/e2e-anonymous-sensitive-columns.sh` + `e2e-authenticated-sensitive-columns.sh`).
3. Re-rodar `supabase--linter` no branch — finding alvo deve sumir.
4. Reportar diff de findings (antes/depois) ao usuário **antes** de pedir merge.

### Critério de aceitação final

- ✅ Linter Supabase: 0 finding crítico em SECURITY (warnings de `auth_rls_initplan` aceitos como backlog de performance).
- ✅ Toda MV/view com `security_invoker=true`.
- ✅ Toda policy SELECT/UPDATE/DELETE em tabela com PII/financeiro tem isolamento por `empresa_id`.
- ✅ `docs/SECURITY-RLS-AUDIT.md` completo e versionado.
- ✅ Suite E2E de RLS continua verde.

### Regras invioláveis (do prompt + AGENTS.md)

- Nunca `DROP POLICY` sem `CREATE POLICY` substituto no mesmo `BEGIN/COMMIT`.
- Nunca desabilitar RLS.
- Nunca trocar SECDEF→INVOKER em função usada por frontend sem checar `security-definer-snapshot.json`.
- Cada migration tem header com `Finding`, `Antes`, `Depois`, `Rollback`.
- `supervisor_id` é fonte de verdade (não `gerente_id`).
- Não tocar em `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.

### Próximo passo neste loop

Executar **apenas o Lote 0** (discovery + documento). Os Lotes 1–5 viram tasks separadas que você aprova individualmente — cada lote toca dezenas de migrations e merece review isolada. Ao final do Lote 0, apresento findings completos + número exato de policies alvo por lote, e você decide ordem/prioridade.
