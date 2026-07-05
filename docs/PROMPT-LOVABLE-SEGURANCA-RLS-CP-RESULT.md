# PROMPT LOVABLE — Fechar gaps de segurança da carga Contas a Pagar (Result/RubySP)

Auditoria de 05/07/2026 nos objetos criados nesta leva (integração Result → `contas_pagar`).
O padrão canônico do projeto (`docs/AUDITORIA_SEGURANCA.md`, `docs/security/RLS-AUDIT.md`) exige:
RLS por comando, gate por módulo via `public.check_user_access(auth.uid(),'financeiro')`, funções
`SECURITY DEFINER` com EXECUTE só pra quem precisa. Os objetos abaixo estão mais abertos que a
própria tabela canônica `contas_pagar` (cujo SELECT é restrito a financeiro/admin/supervisor).

**Aplicar como UMA migration.** Antes, confirme os nomes reais das policies/assinaturas com
`SELECT ... FROM pg_policies` / `pg_proc` — os nomes abaixo vêm da auditoria mas ajuste se divergir.

---

## FIX A — CRÍTICO: funções de dashboard furam a RLS do financeiro

`fn_cp_dashboard`, `fn_cp_kpis_avancados` e `fn_cp_calendario` são `SECURITY DEFINER`, têm
`GRANT EXECUTE ... TO authenticated` e leem `public.contas_pagar` **sem checar o papel do chamador**.
Como são DEFINER, ignoram a RLS da tabela → qualquer usuário logado (inclusive vendedor/promotor,
que NÃO podem `SELECT` em `contas_pagar`) recebe os agregados financeiros de todas as empresas.

**Correção:** adicionar um guard de permissão no início de CADA função, **preservando exatamente a
assinatura, o tipo de retorno e o corpo/agregação atuais**. Aplicar a TODAS as assinaturas vivas
(há overloads de 5 e de 7 parâmetros de `fn_cp_dashboard`/`fn_cp_kpis_avancados` — se a antiga de 5
params ainda existir, guardá-la também, ou fazer `DROP` dela se já estiver órfã).

Para cada função, converter para `LANGUAGE plpgsql` (mantendo `STABLE SECURITY DEFINER SET search_path = public`)
e envelopar a query atual assim:

```sql
-- Exemplo para fn_cp_dashboard(integer[],date,date,uuid,text[],uuid,uuid).
-- REPETIR o mesmo guard para as outras assinaturas e para fn_cp_kpis_avancados e fn_cp_calendario,
-- trocando só a assinatura e mantendo o corpo/return de cada uma.
CREATE OR REPLACE FUNCTION public.fn_cp_dashboard(
  p_empresa_ids integer[], p_data_ini date, p_data_fim date,
  p_departamento_id uuid, p_portadores text[],
  p_centro_custo_id uuid, p_plano_contas_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Guard: só quem pode ver o financeiro (mesmo gate da RLS de contas_pagar).
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  RETURN ( /* ... COLAR AQUI a MESMA expressão/SELECT jsonb_build_object(...) que a versão atual já retorna ... */ );
END;
$$;
```

Observação de alinhamento: use o **mesmo predicado que a policy de SELECT ativa de `public.contas_pagar`**.
Se hoje ela usa `is_admin_or_supervisor(auth.uid())` em vez de `check_user_access(...,'financeiro')`,
use o mesmo — o objetivo é que a função entregue dados exatamente à mesma população que já pode ler a tabela.
(`check_user_access(...,'financeiro')` é o helper canônico atual e cobre admin/supervisor/gerente + permissão explícita.)

Manter `GRANT EXECUTE ... TO authenticated` (o guard interno é que faz o controle).

---

## FIX B — ALTO: staging cru aberto a qualquer authenticated

As tabelas de staging guardam a cópia CRUA (com PII bancária / todos os títulos do grupo) e hoje têm
`SELECT ... USING(true)` — mais aberto que a tabela canônica. O frontend NÃO lê staging (lê as tabelas
canônicas e as RPCs), então basta restringir ao financeiro. **NÃO** mexer em `sync_control_rubysp`
(metadado lido pelo header) nem em `financeiro_status_erp` (lookup).

```sql
-- Gate das staging financeiras atrás do módulo financeiro. Ajuste os nomes de policy se divergirem.
DROP POLICY IF EXISTS erp_contas_pagar_rubysp_sel ON public.erp_contas_pagar_rubysp;
CREATE POLICY erp_contas_pagar_rubysp_sel ON public.erp_contas_pagar_rubysp
  FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS erp_forn_rubysp_sel ON public.erp_fornecedores_rubysp;
CREATE POLICY erp_forn_rubysp_sel ON public.erp_fornecedores_rubysp
  FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS erp_cp_enriq_rubysp_sel ON public.erp_cp_enriq_rubysp;
CREATE POLICY erp_cp_enriq_rubysp_sel ON public.erp_cp_enriq_rubysp
  FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS cliente_financeiro_select ON public.cliente_financeiro;
CREATE POLICY cliente_financeiro_select ON public.cliente_financeiro
  FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(), 'financeiro'));

-- Catálogos de baixa sensibilidade (centro de custo / plano de contas cru): mesmo gate por consistência.
DROP POLICY IF EXISTS erp_ccusto_rubysp_sel ON public.erp_ccusto_rubysp;
CREATE POLICY erp_ccusto_rubysp_sel ON public.erp_ccusto_rubysp
  FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS erp_plano_contas_rubysp_sel ON public.erp_plano_contas_rubysp;
CREATE POLICY erp_plano_contas_rubysp_sel ON public.erp_plano_contas_rubysp
  FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(), 'financeiro'));
```

(Alternativa mais dura, se preferir: `REVOKE SELECT ON <tabela> FROM authenticated` — staging só
precisa de `service_role`. Escolhi manter SELECT gated pra não quebrar eventual tela de monitor.)

---

## FIX C — ALTO (latente): funções de transform/enrich executáveis por PUBLIC

`fn_transform_*_rubysp` e `fn_enriquecer_contas_pagar_rubysp` são `SECURITY DEFINER` e fazem
INSERT/UPDATE em massa nas tabelas canônicas (`contas_pagar`, `fornecedores`, `centros_custo`,
`trade_chart_of_accounts`). Por default do Postgres, toda função nova concede EXECUTE a `PUBLIC` —
ou seja, hoje qualquer authenticated pode dispará-las. Revogar e conceder só a `service_role`
(quem as chama é a edge de ingestão via service role).

```sql
REVOKE ALL ON FUNCTION public.fn_transform_fornecedores_rubysp()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_transform_ccusto_rubysp()            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_transform_plano_contas_rubysp()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_transform_contas_pagar_rubysp()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_enriquecer_contas_pagar_rubysp()     FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_transform_fornecedores_rubysp()   TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_transform_ccusto_rubysp()         TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_transform_plano_contas_rubysp()   TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_transform_contas_pagar_rubysp()   TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_enriquecer_contas_pagar_rubysp()  TO service_role;
```

---

## FIX D — MÉDIO: solicitar_sync_rubysp(text) disparável por qualquer authenticated

`solicitar_sync_rubysp(text)` (grava o timestamp de "solicitar sync agora") tem EXECUTE pra todo
authenticated. Não vaza dado, mas deixa qualquer logado disparar sync. Guardar **por alvo** — porque
a mesma função atende pedidos/historico (comercial) e contas_pagar (financeiro). NÃO gate a função
inteira só em 'financeiro', senão quebra o botão "atualizar" de pedidos pra usuário comercial.

Adicionar no início do corpo (preservando a assinatura e o resto):

```sql
-- dentro de solicitar_sync_rubysp(p_alvo text):
IF p_alvo = 'contas_pagar' AND NOT public.check_user_access(auth.uid(), 'financeiro') THEN
  RAISE EXCEPTION 'acesso negado: sync financeiro' USING ERRCODE = '42501';
END IF;
-- (opcional) exigir modulo 'vendas'/'comercial' para p_alvo IN ('pedidos','historico').
```

---

## Verificação (rodar após aplicar)

```sql
-- 1) As 3 funções de dashboard agora negam quem não é financeiro?
--    (rodar autenticado como usuário SEM financeiro deve dar erro 42501; como financeiro, retorna dados.)

-- 2) Grants das transform/enrich: só service_role
SELECT p.proname, r.rolname
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
LEFT JOIN LATERAL aclexplode(p.proacl) a ON true
LEFT JOIN pg_roles r ON r.oid=a.grantee
WHERE p.proname LIKE 'fn_transform_%_rubysp' OR p.proname='fn_enriquecer_contas_pagar_rubysp'
ORDER BY 1,2;   -- esperado: service_role (e nada de PUBLIC/authenticated)

-- 3) Policies de SELECT das staging agora usam check_user_access
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname='public' AND tablename LIKE 'erp_%_rubysp' OR tablename IN ('cliente_financeiro')
ORDER BY 1,2;   -- esperado: qual contém check_user_access(..., 'financeiro'); nenhum 'true'
```
