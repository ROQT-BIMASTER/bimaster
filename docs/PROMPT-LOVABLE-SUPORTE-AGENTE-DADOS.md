# Prompt Lovable — Suporte · Agente de Dados (autoatendimento de vendas com segurança por identidade)

> **Objetivo (visão do usuário):** hoje o vendedor pede "vendas dos últimos 6 meses do cliente X" a uma pessoa interna, que gera relatório no ERP e manda por WhatsApp. Os dados **já estão no sistema** (módulo de vendas Futura). Esta entrega faz o **bot do chamado responder na hora** — com a segurança ancorada na cadeia de identidade: *usuário → vendedor vinculado → vendas/pedidos/clientes dele*.
>
> **Como se encaixa:** a demanda continua sendo um **chamado** (fila com IA). O `suporte-agente-v2` ganha **tools de consulta de dados** — escopadas pela identidade de quem pergunta, auditadas, e disponíveis só em filas marcadas. Se o pedido foge do que as tools cobrem, o fluxo normal continua (triagem → humano → kanban).
>
> **Modelo de segurança (4 camadas):**
> 1. **Identidade resolvida no banco** — o vínculo usuário↔vendedor vem de tabela administrada por admin (`usuario_vendedores`), NUNCA da conversa. Pedir "vendas do vendedor Y" só funciona se Y for o próprio (ou o chamador for admin/supervisor).
> 2. **Consulta com o JWT do usuário** (padrão `pedidos-copilot`, já consagrado no repo) — RLS por empresa aplica automaticamente (SECURITY INVOKER).
> 3. **Whitelist de tools** — nada de SQL livre gerado por IA; só as 4 consultas abaixo, com o filtro de vendedor **injetado pelo código**, ignorando qualquer valor sugerido pelo modelo/usuário.
> 4. **Auditoria total** — cada entrega de dado vira `suporte_tickets_audit` (`acao='ia_dados_<tool>'`, payload com o que foi consultado).
>
> **Honestidade sobre o estado atual:** as telas de vendas hoje mostram tudo da empresa para quem tem o módulo (RLS por empresa, filtro de vendedor é conveniência de UI). O bot será **mais restrito** que as telas. Endurecer a RLS de `erp_vendas` por vendedor é hardening futuro opcional (quebraria telas de gestão se feito sem bypass por papel) — fora desta entrega.

São 3 partes: **D0 = migration do elo de identidade**, **D1 = tools no suporte-agente-v2**, **D2 = UI de vinculação + fila**.

---

## PARTE D0 — Migration: o elo usuário ↔ vendedor (pré-requisito)

Não existe hoje nenhum de-para entre `profiles` e `vendedores.futura_id` (verificado). Criar no padrão do `usuario_prospects`:

```sql
-- =====================================================================
-- AGENTE DE DADOS — D0: vínculo usuário ↔ vendedor (ERP Futura)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.usuario_vendedores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendedor_futura_id  int  NOT NULL REFERENCES public.vendedores(futura_id),
  ativo               boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vendedor_futura_id)
);
CREATE INDEX IF NOT EXISTS idx_usuario_vendedores_user ON public.usuario_vendedores(user_id) WHERE ativo;

GRANT SELECT ON public.usuario_vendedores TO authenticated;
GRANT ALL ON public.usuario_vendedores TO service_role;

ALTER TABLE public.usuario_vendedores ENABLE ROW LEVEL SECURITY;
-- cada um vê os próprios vínculos; admin vê/gerencia tudo
DROP POLICY IF EXISTS uv_sel ON public.usuario_vendedores;
CREATE POLICY uv_sel ON public.usuario_vendedores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS uv_adm ON public.usuario_vendedores;
CREATE POLICY uv_adm ON public.usuario_vendedores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- resolvedor canônico da identidade comercial (para edge functions e RLS futura)
CREATE OR REPLACE FUNCTION public.get_vendedor_ids(_user_id uuid)
RETURNS int[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(array_agg(vendedor_futura_id), '{}')
  FROM public.usuario_vendedores
  WHERE user_id = _user_id AND ativo;
$$;
REVOKE ALL ON FUNCTION public.get_vendedor_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendedor_ids(uuid) TO authenticated;

-- flag por fila: tools de dados só onde o departamento habilitar
ALTER TABLE public.suporte_filas
  ADD COLUMN IF NOT EXISTS ia_tools_dados boolean NOT NULL DEFAULT false;
```

**Smoke D0:** tabela com RLS on; `SELECT public.get_vendedor_ids(auth.uid())` retorna `{}` para usuário sem vínculo; coluna `ia_tools_dados` presente.

---

## PARTE D1 — Tools de dados no `suporte-agente-v2`

**Editar `supabase/functions/suporte-agente-v2/index.ts` (ler a versão vigente antes; mudanças aditivas):**

1. **Client com o JWT do usuário** (padrão exato do `pedidos-copilot/index.ts` linhas ~419-422):
```ts
const authHeader = req.headers.get("Authorization") ?? "";
const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  global: { headers: { Authorization: authHeader } },
});
```
O client `admin()` continua para a mecânica do ticket; **toda consulta de dados usa `userClient`** (RLS por empresa aplica).

2. **Resolver a identidade comercial** logo após carregar a fila (só se `fila.ia_tools_dados`):
```ts
const { data: vendCodes } = await userClient.rpc("get_vendedor_ids", { _user_id: requester });
const isGestor = /* userClient.rpc has_role admin OU is_admin_or_supervisor(requester) */;
// vendedorEscopo: gestor → null (sem restrição, espelha o que já vê nas telas);
// vendedor comum → seus códigos; sem vínculo → tools de dados retornam orientação de vínculo.
```

3. **Novas tools** (adicionar ao array `tools` **apenas quando `fila.ia_tools_dados === true`**; executar no `execTool` com o padrão de auditoria existente — `acao: 'ia_dados_<tool>'` e payload com os parâmetros usados + contagem retornada):

| Tool | O que faz | Como (via `userClient`) |
|---|---|---|
| `minhas_vendas_kpis` | "meu faturamento no período" | `rpc("vendas_kpis", { p_de, p_ate, p_vendedor: <escopo> })` — se escopo tiver N códigos, somar as chamadas ou usar o 1º + informar |
| `vendas_cliente` | "vendas do cliente X nos últimos N meses" | resolve o cliente por nome/código **dentro das vendas do escopo** (`erp_vendas` `ilike` em `cliente_nome` + `vendedor_futura_id = ANY(escopo)`; ambíguo → pedir para escolher); série via `rpc("vendas_serie_mensal", { p_cliente, p_vendedor })` |
| `meus_top_clientes` | "meus maiores clientes" | `rpc("vendas_top_clientes", { p_de, p_ate, p_vendedor, p_limit })` |
| `status_pedidos_cliente` | "como estão os pedidos do cliente X" | `v_pedidos` filtrando `vendedor_futura_id = ANY(escopo)` + cliente; retornar etapa + dias na etapa |

**Regras invioláveis no código das tools:**
- O parâmetro de vendedor **nunca** vem do modelo/usuário: é sempre o `vendedorEscopo` resolvido (ou `null` para gestor). Se o modelo mandar outro, **ignorar**.
- Vendedor comum **sem vínculo** em `usuario_vendedores`: a tool responde com instrução ("seu usuário ainda não está vinculado a um código de vendedor — peça ao administrador") e o bot **escala para o líder** — nunca responde dado sem escopo.
- Resposta na thread: resumo + tabela markdown compacta (máx ~15 linhas); valores em BRL formatados; sempre citar o período consultado.
- Truncar tool results em 60k chars (padrão pedidos-copilot); considerar subir o cap do loop agentico de 4 → 6 (consultas encadeadas: resolver cliente → série).

4. **Prompt**: quando a fila tiver tools de dados, acrescentar system message: *"Você pode consultar DADOS DE VENDAS do solicitante pelas tools. Os dados já vêm limitados ao que ele pode ver — nunca prometa dados de outros vendedores. Cite sempre o período. Se a tool retornar orientação de vínculo, explique e escale."*

---

## PARTE D2 — Frontend (vinculação + fila)

1. **UI de vinculação usuário↔vendedor** (admin): nova seção em Configurações — **"Vínculo Usuário × Vendedor (ERP)"** — espelhando `VinculacaoUsuarioProspects.tsx`: seleciona usuário (diretório) → marca um ou mais vendedores (`vendedores`: nome + futura_id, busca) → grava em `usuario_vendedores`. Mostrar aviso quando um vendedor já está vinculado a outro usuário (permitido, mas destacado).
2. **Fila "Comercial — Dados de Vendas"**: no dialog **Fluxo/Config do departamento**, expor o switch **"IA pode consultar dados de vendas"** (`ia_tools_dados`, update direto — policy admin). Criar a fila pela UI de Novo departamento e ligar IA + tools nela (ou ligar na fila Comercial existente).
3. **Transparência**: no `ChamadoListItem`/thread nada muda — as respostas do bot chegam como mensagens normais; a auditoria fica em `suporte_tickets_audit`.

## Aceite
1. Admin vincula o usuário do vendedor João ao código Futura dele; fila Comercial com `ia_habilitada` + `ia_tools_dados`.
2. João abre chamado "vendas dos últimos 6 meses do cliente ACME" → bot resolve ACME **dentro da carteira dele**, responde série mensal + total, cita o período; audit `ia_dados_vendas_cliente` registrado.
3. João pede "vendas do cliente do vendedor Pedro" → bot responde apenas com dados do escopo do João (não acha o cliente de Pedro) e explica a limitação.
4. Usuária do RH (sem vínculo) pergunta vendas na fila Comercial → bot orienta sobre vínculo e escala; **nenhum dado entregue**.
5. Admin pergunta → sem restrição de vendedor (espelha o que já vê nas telas), com audit.
6. Fila com `ia_tools_dados=false` → as tools nem aparecem para o modelo.

## Evoluções (fora desta entrega)
- **Supervisor → subordinados** (via `profiles.supervisor_id`/`get_subordinates` → códigos dos subordinados) em vez de tudo.
- **Hardening da RLS de `erp_vendas`** por vendedor com bypass por papel (mexe nas telas de gestão — decisão própria).
- **WhatsApp (Fase 4)**: tools de dados só para contatos verificados mapeados a `profiles` (wa_id↔usuário interno); cliente externo **nunca** acessa tools de dados.
- Mais domínios: estoque ("tem o produto X?"), comissões, títulos — mesma receita (tool whitelisted + escopo por identidade + audit).
