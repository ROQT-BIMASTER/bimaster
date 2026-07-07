// Instantiates an execution of an operational process:
//  1) creates `processo_execucoes` row (data_ref = hoje SP)
//  2) creates `processo_execucao_etapas` for every etapa
//  3) creates `processo_tarefa_espelho` rows and matching `projeto_tarefas`
//     inside the department's fixed operational project (via `ensure_projeto_operacional`)
//  4) copies `processo_etapa_responsaveis` into projeto_tarefa_responsaveis / _seguidores

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z
  .object({
    processo_id: z.string().uuid(),
    data_ref: z.string().optional(),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 10, rateLimitPrefix: "processo-instanciar" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const parsed = Body.safeParse(await req.json());
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const { processo_id, data_ref } = parsed.data;
      const userId = ctx.userId!;

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // 1) load etapas + rotinas + filas
      const { data: etapas, error: e1 } = await sb
        .from("processo_etapas")
        .select("id, rotina_fixa_id, nome_override, ordem, sla_minutos, parecer_administrativo")
        .eq("processo_id", processo_id)
        .order("ordem", { ascending: true });
      if (e1) return json(500, { error: e1.message }, cors);
      if (!etapas || etapas.length === 0) return json(400, { error: "Processo sem etapas" }, cors);

      const rotinaIds = etapas.map((e) => e.rotina_fixa_id).filter(Boolean);
      const { data: rotinas } = await sb
        .from("suporte_rotinas_fixas")
        .select("id, titulo, fila_id")
        .in("id", rotinaIds);
      const rotinaById = new Map((rotinas ?? []).map((r) => [r.id, r]));
      const filaIds = Array.from(new Set((rotinas ?? []).map((r: any) => r.fila_id)));
      const { data: filas } = await sb
        .from("suporte_filas")
        .select("id, departamento_id")
        .in("id", filaIds);
      const filaById = new Map((filas ?? []).map((f) => [f.id, f]));

      // 2) create execucao
      const dataRef = data_ref ?? new Date().toISOString().slice(0, 10);
      const { data: exec, error: e2 } = await sb
        .from("processo_execucoes")
        .insert({ processo_id, data_ref, status: "em_andamento", iniciado_em: new Date().toISOString() })
        .select()
        .single();
      if (e2) return json(500, { error: e2.message }, cors);

      // 3) execucao_etapas
      const execEtapas = etapas.map((e) => ({
        execucao_id: exec.id,
        etapa_id: e.id,
        status: "pendente",
      }));
      const { error: e3 } = await sb.from("processo_execucao_etapas").insert(execEtapas);
      if (e3) return json(500, { error: e3.message }, cors);

      // 4) papéis por etapa
      const { data: papeis } = await sb
        .from("processo_etapa_responsaveis")
        .select("etapa_id, user_id, papel")
        .in("etapa_id", etapas.map((e) => e.id));
      const papeisByEtapa = new Map<string, { user_id: string; papel: string }[]>();
      for (const p of papeis ?? []) {
        const arr = papeisByEtapa.get(p.etapa_id) ?? [];
        arr.push({ user_id: p.user_id, papel: p.papel });
        papeisByEtapa.set(p.etapa_id, arr);
      }

      // 5) for each etapa: ensure projeto operacional, create tarefa + espelho + responsaveis/seguidores
      const criadas: any[] = [];
      for (const e of etapas) {
        const r = rotinaById.get(e.rotina_fixa_id) as any;
        const fila = r ? filaById.get(r.fila_id) : null;
        const depId = (fila as any)?.departamento_id ?? null;
        if (!depId) continue;

        const { data: projetoId, error: eEns } = await sb.rpc("ensure_projeto_operacional", {
          _departamento_id: depId,
        });
        if (eEns || !projetoId) continue;

        const slaMin = (e as any).sla_minutos ?? 60;
        const slaLimite = new Date(Date.now() + slaMin * 60_000).toISOString();
        const titulo = `${(e as any).nome_override ?? r?.titulo ?? "Etapa"} — ${dataRef}`;
        const descricao =
          [(e as any).parecer_administrativo].filter(Boolean).join("\n\n") ||
          "Tarefa gerada por processo operacional.";

        const responsavelId =
          (papeisByEtapa.get(e.id) ?? []).find((p) => p.papel === "responsavel")?.user_id ?? null;

        const dataPrazo = new Date(Date.now() + slaMin * 60_000).toISOString().slice(0, 10);
        const { data: tarefa, error: eT } = await sb
          .from("projeto_tarefas")
          .insert({
            projeto_id: projetoId,
            titulo,
            descricao,
            status: "pendente",
            prioridade: "alta",
            data_inicio: dataRef,
            data_prazo: dataPrazo,
            responsavel_id: responsavelId,
            criador_id: userId,
            origem: "processo_operacional",
            tipo_tarefa: "operacional",
          })
          .select()
          .single();
        if (eT || !tarefa) continue;

        // Espelho
        await sb.from("processo_tarefa_espelho").insert({
          etapa_id: e.id,
          projeto_tarefa_id: tarefa.id,
          projeto_id: projetoId,
          departamento_id: depId,
          execucao_id: exec.id,
          sla_limite: slaLimite,
          status: "pendente",
          created_by: userId,
        });

        // Responsáveis / seguidores (co-responsáveis são criados posteriormente pelo escalador)
        const papeisEtapa = papeisByEtapa.get(e.id) ?? [];
        const respAdicionais = papeisEtapa.filter(
          (p) => p.papel === "responsavel" && p.user_id !== responsavelId,
        );
        if (respAdicionais.length > 0) {
          await sb.from("projeto_tarefa_responsaveis").insert(
            respAdicionais.map((p) => ({ tarefa_id: tarefa.id, user_id: p.user_id, papel: "colaborador", criado_por: userId })),
          );
        }
        const seguidores = papeisEtapa.filter((p) => p.papel === "seguidor");
        if (seguidores.length > 0) {
          await sb.from("projeto_tarefa_seguidores").insert(
            seguidores.map((p) => ({ tarefa_id: tarefa.id, user_id: p.user_id })),
          );
        }

        criadas.push({ etapa_id: e.id, tarefa_id: tarefa.id, projeto_id: projetoId });
      }

      return json(200, { execucao_id: exec.id, tarefas_criadas: criadas.length, criadas }, cors);
    },
  ),
);

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
