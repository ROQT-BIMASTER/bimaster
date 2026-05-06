// Edge Function: china-sla-monitor
// Gera/atualiza alertas de SLA porto→CD e atrasos de entrega para OCs ativas.
// Roda diariamente via pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Carrega config SLA
    const { data: cfg } = await supabase
      .from("china_sla_config")
      .select("sla_porto_cd_dias_alvo, sla_porto_cd_dias_critico, dias_atraso_alerta")
      .limit(1)
      .maybeSingle();
    const slaCritico = cfg?.sla_porto_cd_dias_critico ?? 15;
    const slaAlvo = cfg?.sla_porto_cd_dias_alvo ?? 7;
    const diasAtraso = cfg?.dias_atraso_alerta ?? 1;

    // 2. Carrega KPIs
    const { data: kpis, error: kpiErr } = await supabase
      .from("vw_china_oc_recebimento_kpis")
      .select("ordem_compra_id, numero_oc, produto_codigo, data_chegada_porto, data_recebimento_cd, data_entrega_prevista, data_entrega_real, oc_status");
    if (kpiErr) throw kpiErr;

    // 3. Carrega responsáveis (created_by da OC)
    const ocIds = (kpis || []).map((k: any) => k.ordem_compra_id);
    const { data: ocs } = ocIds.length
      ? await supabase
          .from("china_ordens_compra")
          .select("id, created_by")
          .in("id", ocIds)
      : { data: [] as any[] };
    const respMap = new Map<string, string | null>(
      (ocs || []).map((o: any) => [o.id, o.created_by]),
    );

    const today = new Date();
    const upserts: any[] = [];
    const resolvidas: string[] = []; // ids a marcar resolvido (par oc+tipo)

    for (const k of (kpis || []) as any[]) {
      const isFinalizada = k.data_recebimento_cd || ["encerrada", "recebida"].includes(k.oc_status);

      // SLA porto→CD estourado
      if (k.data_chegada_porto && !k.data_recebimento_cd) {
        const chegou = new Date(k.data_chegada_porto);
        const dias = Math.floor((today.getTime() - chegou.getTime()) / 864e5);
        if (dias > slaCritico) {
          upserts.push({
            ordem_compra_id: k.ordem_compra_id,
            tipo: "sla_estourado",
            severidade: dias > slaCritico * 2 ? "critica" : "alta",
            mensagem: `OC ${k.numero_oc} (${k.produto_codigo}): ${dias} dias desde chegada no porto, sem recebimento no CD (SLA crítico ${slaCritico}d).`,
            responsavel_id: respMap.get(k.ordem_compra_id) || null,
            metadata: { dias, sla_alvo: slaAlvo, sla_critico: slaCritico },
            criado_em: new Date().toISOString(),
            resolvido_em: null,
          });
        }
      }

      // Entrega atrasada
      if (k.data_entrega_prevista && !k.data_entrega_real && !isFinalizada) {
        const prev = new Date(k.data_entrega_prevista);
        const atraso = Math.floor((today.getTime() - prev.getTime()) / 864e5);
        if (atraso >= diasAtraso) {
          upserts.push({
            ordem_compra_id: k.ordem_compra_id,
            tipo: "entrega_atrasada",
            severidade: atraso > 14 ? "alta" : "media",
            mensagem: `OC ${k.numero_oc} (${k.produto_codigo}): ${atraso} dias de atraso vs. entrega prevista.`,
            responsavel_id: respMap.get(k.ordem_compra_id) || null,
            metadata: { atraso_dias: atraso, prevista: k.data_entrega_prevista },
            criado_em: new Date().toISOString(),
            resolvido_em: null,
          });
        }
      }

      // Resolver alertas se a condição não vale mais
      if (isFinalizada) {
        resolvidas.push(k.ordem_compra_id);
      }
    }

    let inseridos = 0;
    if (upserts.length) {
      // Upsert por (ordem_compra_id, tipo): preserva criado_em via DO NOTHING ao mesmo dia
      const { error: upErr } = await supabase
        .from("china_recebimento_alertas")
        .upsert(upserts, { onConflict: "ordem_compra_id,tipo", ignoreDuplicates: false });
      if (upErr) throw upErr;
      inseridos = upserts.length;
    }

    let marcadasResolvidas = 0;
    if (resolvidas.length) {
      const { error: resErr, count } = await supabase
        .from("china_recebimento_alertas")
        .update({ resolvido_em: new Date().toISOString() }, { count: "exact" })
        .in("ordem_compra_id", resolvidas)
        .is("resolvido_em", null);
      if (resErr) throw resErr;
      marcadasResolvidas = count || 0;
    }

    return new Response(
      JSON.stringify({ ok: true, alertas_processados: inseridos, alertas_resolvidos: marcadasResolvidas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
