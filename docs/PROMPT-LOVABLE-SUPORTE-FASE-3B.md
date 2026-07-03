# Prompt Lovable — Suporte Help Desk · FASE 3B (IA por fila + transferência automática)

> **Cole este prompt no Lovable.** Depende das Fases 0–3A aplicadas. Cria a **IA de atendimento por departamento**: uma edge function nova (`suporte-agente-v2`) que atende cada chamado (conversa `tipo='suporte'`) com o prompt da fila, faz triagem/tabulação, busca a base de conhecimento, escala para líderes e — o principal — **transfere entre departamentos chamando `rpc_suporte_transferir` com `via_ia=true`**, notificando o solicitante. Não toca a `suporte-agente` legada (desk de TI atual segue intacto).
>
> São 3 partes: (1) migration mínima (bot + config de disparo), (2) a edge function nova, (3) o hook de disparo no frontend + habilitar IA nas filas piloto.

## Contexto para o Lovable
Fase 3B (`docs/ARQUITETURA-SUPORTE-HELPDESK-MULTIDEPARTAMENTO.md`, §7.2/§7.3). Modelo:
- 1 conversa `tipo='suporte'` por chamado (Fase 1). A IA responde nessa thread.
- A fila (`suporte_filas`) carrega `ia_habilitada` e `ia_prompt` (Fase 0). Fila com IA off → função sai sem responder.
- Bot único "Equipe Ruby Rose" (`BOT_USER_ID = 1ee5b9de-4864-475f-9602-ee039197e46e`), persona ajustada pelo `ia_prompt` da fila.
- Tools reaproveitam o padrão da `suporte-agente` + a nova `transferir_departamento` (usa `rpc_suporte_transferir`, `via_ia=true`).
- Idempotência: a função não responde 2× à mesma mensagem (checa `metadata.replies_to`).

---

## PARTE 1 — Migration (bot participante + garantia de config)

```sql
-- =====================================================================
-- FASE 3B — parte 1: suporte para a IA por fila
-- =====================================================================

-- Garante o bot como participante de toda conversa de suporte já existente
-- (novas conversas: o bot é adicionado no abrir_chamado — ver Parte 1b abaixo).
INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
SELECT c.id, '1ee5b9de-4864-475f-9602-ee039197e46e', 'membro'
FROM public.conversas c
WHERE c.tipo = 'suporte'
ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

-- 1b. rpc_suporte_abrir_chamado passa a incluir o bot como participante,
--     para a IA conseguir postar na thread. CREATE OR REPLACE mantendo tudo
--     da Fase 2 + a linha do bot.
CREATE OR REPLACE FUNCTION public.rpc_suporte_abrir_chamado(
  p_fila_id    uuid,
  p_titulo     text,
  p_descricao  text DEFAULT NULL,
  p_prioridade text DEFAULT 'media'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_conversa_id uuid;
  v_ticket_id   uuid;
  v_protocolo   text;
  v_titulo      text;
  v_prio        text := coalesce(p_prioridade,'media');
  v_bot         uuid := '1ee5b9de-4864-475f-9602-ee039197e46e';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suporte_filas WHERE id = p_fila_id AND ativo AND aceita_chamados) THEN
    RAISE EXCEPTION 'fila invalida ou nao aceita chamados';
  END IF;
  IF v_prio NOT IN ('baixa','media','alta','critica') THEN v_prio := 'media'; END IF;
  v_titulo := trim(coalesce(p_titulo,''));
  IF v_titulo = '' THEN RAISE EXCEPTION 'titulo obrigatorio'; END IF;
  IF length(v_titulo) > 200 THEN v_titulo := substr(v_titulo,1,200); END IF;

  INSERT INTO public.conversas (nome, tipo, criado_por)
  VALUES (left('Chamado: ' || v_titulo, 120), 'suporte', v_uid)
  RETURNING id INTO v_conversa_id;

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  VALUES (v_conversa_id, v_uid, 'membro'), (v_conversa_id, v_bot, 'membro')
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  SELECT v_conversa_id, fa.user_id, 'membro'
  FROM public.suporte_fila_agentes fa
  WHERE fa.fila_id = p_fila_id AND fa.ativo AND fa.user_id <> v_uid
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  INSERT INTO public.suporte_tickets (conversa_id, owner_id, requester_id, fila_id, canal, status, prioridade, titulo)
  VALUES (v_conversa_id, v_uid, v_uid, p_fila_id, 'chat_interno', 'novo', v_prio, v_titulo)
  RETURNING id INTO v_ticket_id;

  v_protocolo := 'RR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(v_ticket_id::text,'-',''),1,6));
  UPDATE public.suporte_tickets SET protocolo = v_protocolo WHERE id = v_ticket_id;

  PERFORM public.suporte_recalcular_sla(v_ticket_id, now());

  IF coalesce(trim(p_descricao),'') <> '' THEN
    INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade)
    VALUES (v_conversa_id, v_uid, p_descricao, 'texto', v_ticket_id, v_uid, 'broadcast');
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (v_ticket_id, 'abertura', jsonb_build_object('fila_id', p_fila_id, 'canal','chat_interno','prioridade', v_prio));

  RETURN jsonb_build_object('ticket_id', v_ticket_id, 'conversa_id', v_conversa_id, 'protocolo', v_protocolo);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) TO authenticated;
```

> **Nota:** o trigger `trg_suporte_on_mensagem` (Fase 2) carimba "primeira resposta" quando **um agente/staff** responde. O bot **não** é agente de fila nem staff, então respostas da IA **não** contam como primeira resposta humana de SLA — correto: SLA de 1ª resposta mede resposta de gente. (Se quiser que a IA "segure" o SLA, tratamos numa fase futura.)

---

## PARTE 2 — Edge function `suporte-agente-v2`

Crie a function `suporte-agente-v2` (Deno). Reusa os módulos compartilhados já existentes (`_shared/secure-handler.ts`, `_shared/cors.ts`, `_shared/ai-gateway-call.ts`), no mesmo padrão da `suporte-agente`.

```ts
// suporte-agente-v2 — IA de atendimento multi-departamento (conversa por chamado).
// Disparada pelo front quando o usuário envia mensagem numa conversa tipo='suporte'
// cuja fila tem ia_habilitada=true. NÃO toca o canal legado da suporte-agente.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway } from "../_shared/ai-gateway-call.ts";

const BOT_USER_ID = "1ee5b9de-4864-475f-9602-ee039197e46e";

const Body = z.object({ mensagem_id: z.string().uuid() }).strict();

const CATEGORIAS = [
  "bug","duvida_uso","solicitacao_acesso","solicitacao_funcionalidade",
  "integracao","financeiro","performance","dados_inconsistentes","outro",
] as const;

const PERSONA_BASE = `Você é o atendimento da Ruby Rose no canal interno de Suporte.
- Apresente-se como "Equipe Ruby Rose". Nunca diga que é IA, bot ou robô.
- Tom profissional, cordial, direto, PT-BR, sem emojis, sem jargão.
- Conversa real entre pessoas: NÃO repita saudações/agradecimentos/fechos usados antes nesta conversa; releia o histórico e varie.
- Uma pergunta por mensagem, resposta curta (máx. 5 linhas). Nunca peça senha/token/CPF completo.

TABULAÇÃO (obrigatória): no 1º ou 2º turno em que entender o problema, chame definir_titulo_categoria (titulo até 80 chars; categoria; prioridade).

ROTEAMENTO: se o problema pertence a OUTRO departamento, use transferir_departamento com o slug do destino e um motivo curto — o solicitante é avisado automaticamente. Não transfira por suposição fraca; na dúvida, pergunte 1 coisa antes.

ESCALONAMENTO: sentimento negativo, pedido de humano, ou 2 turnos sem evoluir → escalar_para_lider.
RESOLUÇÃO: quando o usuário sinalizar que resolveu → marcar_resolvido.
CONHECIMENTO: dúvida de uso → buscar_conhecimento_base antes de responder.
LGPD: mencione UMA vez por ticket, curto, que a conversa pode ser revisada para melhoria.`;

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 20, rateLimitPrefix: "suporte-agente-v2" },
  async (req, _ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = admin();

    // 1) mensagem + conversa de suporte + ticket ativo
    const { data: msg } = await sb.from("mensagens")
      .select("id, conversa_id, remetente_id, conteudo, tipo").eq("id", parsed.data.mensagem_id).single();
    if (!msg) return new Response(JSON.stringify({ error: "msg nao encontrada" }), { status: 404, headers: cors });
    if (msg.remetente_id === BOT_USER_ID || msg.tipo === "sistema")
      return new Response(JSON.stringify({ ok: true, skip: "bot/sistema" }), { headers: cors });

    const { data: conv } = await sb.from("conversas").select("id, tipo").eq("id", msg.conversa_id).single();
    if (!conv || conv.tipo !== "suporte")
      return new Response(JSON.stringify({ ok: true, skip: "nao-suporte" }), { headers: cors });

    const { data: ticket } = await sb.from("suporte_tickets")
      .select("id, fila_id, requester_id, owner_id, status, protocolo, titulo, prioridade, assignee_id")
      .eq("conversa_id", msg.conversa_id).neq("status", "resolvido")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ticket) return new Response(JSON.stringify({ ok: true, skip: "sem-ticket" }), { headers: cors });

    // só responde a mensagem do solicitante (não a de agente humano)
    const requester = ticket.requester_id ?? ticket.owner_id;
    if (msg.remetente_id !== requester)
      return new Response(JSON.stringify({ ok: true, skip: "nao-requester" }), { headers: cors });

    // 2) fila + IA habilitada?
    const { data: fila } = await sb.from("suporte_filas")
      .select("id, nome, slug, ia_habilitada, ia_prompt, ia_pode_transferir").eq("id", ticket.fila_id).single();
    if (!fila || !fila.ia_habilitada)
      return new Response(JSON.stringify({ ok: true, skip: "ia-off" }), { headers: cors });

    // idempotência: já respondi a esta mensagem?
    const { data: ja } = await sb.from("mensagens").select("id")
      .eq("conversa_id", msg.conversa_id).eq("remetente_id", BOT_USER_ID)
      .contains("metadata", { replies_to: msg.id }).limit(1).maybeSingle();
    if (ja) return new Response(JSON.stringify({ ok: true, skip: "ja-respondida" }), { headers: cors });

    // 3) filas destino disponíveis (para a tool de transferência)
    const { data: filasDestino } = await sb.from("suporte_filas")
      .select("slug, nome").eq("ativo", true).eq("aceita_chamados", true).neq("id", fila.id);
    const slugs = (filasDestino ?? []).map((f) => f.slug);

    // 4) histórico da thread
    const { data: hist } = await sb.from("mensagens")
      .select("remetente_id, conteudo").eq("conversa_id", msg.conversa_id)
      .neq("tipo", "sistema").order("created_at", { ascending: true }).limit(30);
    const history = (hist ?? []).map((m) => ({
      role: m.remetente_id === BOT_USER_ID ? "assistant" : "user", content: m.conteudo,
    }));

    const contexto = [
      `FILA ATUAL: ${fila.nome} (${fila.slug}).`,
      `PROTOCOLO: ${ticket.protocolo ?? "-"}.`,
      fila.ia_pode_transferir && slugs.length
        ? `DEPARTAMENTOS para transferir (slug): ${slugs.join(", ")}.`
        : `Transferência desabilitada nesta fila.`,
    ].join("\n");

    const tools: any[] = [
      { type: "function", function: { name: "definir_titulo_categoria",
        description: "Define/refina título, categoria e prioridade do chamado (tabulação).",
        parameters: { type: "object", properties: {
          titulo: { type: "string" }, categoria: { type: "string", enum: [...CATEGORIAS] },
          prioridade: { type: "string", enum: ["baixa","media","alta","critica"] },
        }, required: ["titulo","categoria"] } } },
      { type: "function", function: { name: "buscar_conhecimento_base",
        description: "Busca artigos na base de conhecimento interna por palavra-chave.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
      { type: "function", function: { name: "escalar_para_lider",
        description: "Escala o chamado para atendimento humano (líderes da fila).",
        parameters: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] } } },
      { type: "function", function: { name: "marcar_resolvido",
        description: "Marca o chamado como resolvido.", parameters: { type: "object", properties: {} } } },
    ];
    if (fila.ia_pode_transferir && slugs.length) {
      tools.push({ type: "function", function: { name: "transferir_departamento",
        description: "Transfere o chamado para outro departamento. O solicitante é avisado.",
        parameters: { type: "object", properties: {
          slug: { type: "string", enum: slugs },
          motivo: { type: "string", description: "Motivo curto do encaminhamento." },
        }, required: ["slug","motivo"] } } });
    }

    const messages: any[] = [
      { role: "system", content: PERSONA_BASE },
      fila.ia_prompt ? { role: "system", content: `INSTRUÇÕES DO DEPARTAMENTO ${fila.nome}:\n${fila.ia_prompt}` } : null,
      { role: "system", content: contexto },
      ...history,
    ].filter(Boolean);

    async function execTool(name: string, args: any): Promise<unknown> {
      await sb.from("suporte_tickets_audit").insert({ ticket_id: ticket.id, acao: `ia_${name}`, payload: args, modelo_ia: "gemini-3-flash" });
      if (name === "definir_titulo_categoria") {
        const patch: any = {};
        if (args.titulo) patch.titulo = String(args.titulo).slice(0, 200);
        if (args.categoria) patch.categoria = String(args.categoria);
        if (args.prioridade) patch.prioridade = String(args.prioridade);
        if (Object.keys(patch).length) await sb.from("suporte_tickets").update(patch).eq("id", ticket.id);
        return { ok: true, ...patch };
      }
      if (name === "buscar_conhecimento_base") {
        const q = String(args.query ?? "").toLowerCase();
        const { data } = await sb.from("suporte_kb").select("modulo,titulo,conteudo").eq("ativo", true).limit(20);
        const hits = (data ?? []).filter((r) => !q || r.titulo.toLowerCase().includes(q) || r.conteudo.toLowerCase().includes(q));
        return { resultados: hits.slice(0, 3) };
      }
      if (name === "escalar_para_lider") {
        await sb.from("suporte_tickets").update({ status: "escalado", escalado_em: new Date().toISOString() }).eq("id", ticket.id);
        const { data: lideres } = await sb.from("suporte_fila_agentes").select("user_id").eq("fila_id", fila.id).eq("ativo", true).eq("papel", "lider");
        for (const l of lideres ?? []) {
          await sb.from("notifications").insert({ user_id: l.user_id, type: "suporte_escalado",
            title: "Chamado escalado", message: `${ticket.protocolo ?? ""} — ${args.motivo ?? ""}`, action_url: "/dashboard/suporte/desk" });
        }
        return { ok: true };
      }
      if (name === "transferir_departamento") {
        const destino = (filasDestino ?? []).find((f) => f.slug === args.slug);
        if (!destino) return { erro: "slug invalido" };
        const { data: df } = await sb.from("suporte_filas").select("id").eq("slug", args.slug).single();
        const { error } = await sb.rpc("rpc_suporte_transferir", {
          p_ticket_id: ticket.id, p_para_fila_id: df!.id, p_motivo: String(args.motivo ?? "Transferência automática"), p_via_ia: true,
        });
        if (error) return { erro: error.message };
        return { ok: true, transferido_para: destino.nome };
      }
      if (name === "marcar_resolvido") {
        await sb.rpc("rpc_suporte_mudar_status", { p_ticket_id: ticket.id, p_status: "resolvido" });
        return { ok: true };
      }
      return { erro: "tool desconhecida" };
    }

    // 5) loop de tools (máx 4)
    let finalText = "";
    let transferiu = false;
    for (let i = 0; i < 4; i++) {
      const r = await callAIGateway({ model: "google/gemini-3-flash-preview", messages, tools });
      if (r.kind !== "ok") break;
      const choice = r.data.choices?.[0]?.message;
      if (!choice) break;
      messages.push(choice);
      const calls = choice.tool_calls ?? [];
      if (calls.length === 0) { finalText = String(choice.content ?? "").trim(); break; }
      for (const tc of calls) {
        let args: any = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* noop */ }
        const res = await execTool(tc.function.name, args);
        if (tc.function.name === "transferir_departamento" && (res as any)?.ok) transferiu = true;
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(res) });
      }
    }
    if (!finalText) {
      finalText = transferiu
        ? "Encaminhei seu chamado para o departamento responsável — eles vão dar sequência por aqui mesmo."
        : "Recebi sua mensagem e já estou verificando. Retorno em instantes.";
    }

    // 6) posta a resposta da IA na thread
    await sb.from("mensagens").insert({
      conversa_id: msg.conversa_id, remetente_id: BOT_USER_ID, conteudo: finalText, tipo: "texto",
      ticket_id: ticket.id, ticket_owner_id: requester, visibilidade: "broadcast",
      metadata: { tipo: "resposta_ia", replies_to: msg.id },
    });
    await sb.from("suporte_tickets").update({ ultima_interacao_em: new Date().toISOString() }).eq("id", ticket.id);

    return new Response(JSON.stringify({ ok: true, ticket_id: ticket.id, transferiu }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
```

---

## PARTE 3 — Frontend (disparo) + habilitar IA nas filas piloto

**3a. Hook de disparo** — crie `src/hooks/suporte/useSuporteIaTrigger.ts` (dispara a IA ao enviar mensagem numa conversa de chamado; espelha o padrão do `useSuporteAgenteTrigger` legado, mas por `conversaId` e chamando `suporte-agente-v2`):

```ts
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Dispara a IA da fila ao enviar mensagem no chamado aberto. Montar na página do chamado. */
export function useSuporteIaTrigger(conversaId: string | null | undefined, currentUserId: string | null | undefined) {
  useEffect(() => {
    if (!conversaId || !currentUserId) return;
    const ch = supabase
      .channel(`suporte-ia-${conversaId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${conversaId}` },
        async (payload) => {
          const m = payload.new as { id: string; remetente_id: string; tipo: string };
          if (m.remetente_id !== currentUserId || m.tipo === "sistema") return;
          try { await supabase.functions.invoke("suporte-agente-v2", { body: { mensagem_id: m.id } }); }
          catch (e) { console.warn("[suporte-ia] invoke", e); }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversaId, currentUserId]);
}
```

Monte-o nas páginas de chamado (`SuporteMeusChamados.tsx` e `SuporteDesk.tsx`), passando o `conversa_id` do chamado selecionado e o `user.id`:
```ts
useSuporteIaTrigger(selecionado?.conversa_id, user?.id);
```

**3b. Habilitar IA nas filas piloto** (config — ajuste os departamentos que terão IA e o tom de cada um):

```sql
UPDATE public.suporte_filas SET ia_habilitada = true,
  ia_prompt = 'Você atende o Fiscal. Domínio: notas, impostos (ICMS/ICMS-ST, IBS/CBS), SPED, apuração. Peça nº da nota/CNPJ quando fizer sentido. Se for problema de sistema/acesso, transfira para o TI.'
WHERE slug = 'fiscal';

UPDATE public.suporte_filas SET ia_habilitada = true,
  ia_prompt = 'Você atende o TI/Sistema. Bugs, acessos, dúvidas de uso do sistema. Se a demanda for de outra área de negócio (fiscal, RH, compras...), transfira.'
WHERE slug = 'ti';
-- repita para as demais filas que quiser com IA; as sem UPDATE ficam 100% humanas.
```

---

## Smoke test / validação
```sql
-- (a) função nova existe no runtime? (checar no painel de Edge Functions do Lovable: suporte-agente-v2 deployada)
-- (b) filas com IA ligada
SELECT slug, nome, ia_habilitada, ia_pode_transferir FROM public.suporte_filas ORDER BY ordem;
-- (c) bot é participante das conversas de suporte
SELECT count(*) AS conversas_suporte,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM public.conversas_participantes cp
         WHERE cp.conversa_id = c.id AND cp.usuario_id = '1ee5b9de-4864-475f-9602-ee039197e46e')) AS com_bot
FROM public.conversas c WHERE c.tipo = 'suporte';
```

**Teste funcional (app, flag ligada):**
1. Abrir chamado numa fila com IA ligada (ex.: Fiscal) descrevendo um problema → a **IA responde** na thread em segundos e chama `definir_titulo_categoria` (confira `titulo/categoria` preenchidos no ticket).
2. Descreva algo claramente de outra área (ex.: "não consigo logar no sistema") → a IA usa `transferir_departamento` → chamado vai para TI, mensagem 🔁 na thread e **notificação ao solicitante**.
3. Peça "quero falar com uma pessoa" → `escalar_para_lider` (status escalado + notificação ao líder da fila).

## Depois de aplicar
1. Me mande (b) e (c) + confirmação de que a `suporte-agente-v2` deployou.
2. Reviso a `main` (hook montado nas páginas) e validamos o ciclo com IA.
3. Fase 4: canal **WhatsApp via Blip** — a mesma `suporte-agente-v2` passa a ser disparada também pelo webhook da Blip (não só pelo front).
