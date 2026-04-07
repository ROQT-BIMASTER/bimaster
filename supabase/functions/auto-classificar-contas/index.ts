import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = new Date().toISOString();
  let totalGroups = 0;
  let successCount = 0;
  let errorCount = 0;
  const details: any[] = [];

  try {
    // Buscar grupos não classificados
    const { data: contas, error: fetchErr } = await supabase
      .from("contas_pagar")
      .select("categoria_nome, fornecedor_nome, tipo_documento")
      .eq("classificado_automaticamente", false)
      .or("classificacao_manual.is.null,classificacao_manual.eq.false");

    if (fetchErr) throw fetchErr;
    if (!contas || contas.length === 0) {
      console.log("Nenhuma conta para classificar");
      await supabase.from("classification_auto_logs").insert({
        executed_at: startedAt,
        total_groups: 0,
        success_count: 0,
        error_count: 0,
        details: { message: "Nenhuma conta pendente" },
      });
      return new Response(JSON.stringify({ message: "Nenhuma conta pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Agrupar
    const gruposMap = new Map<string, { categoria_nome: string; fornecedor_nome: string | null; tipo_documento: string | null; count: number }>();
    contas.forEach((g) => {
      const key = `${g.categoria_nome}|${g.fornecedor_nome}|${g.tipo_documento}`;
      const existing = gruposMap.get(key);
      if (existing) existing.count++;
      else gruposMap.set(key, { categoria_nome: g.categoria_nome, fornecedor_nome: g.fornecedor_nome, tipo_documento: g.tipo_documento, count: 1 });
    });

    const grupos = Array.from(gruposMap.values());
    totalGroups = grupos.length;
    console.log(`Auto-classificação: ${totalGroups} grupos, ${contas.length} contas`);

    // Processar em lotes de 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < grupos.length; i += BATCH_SIZE) {
      const batch = grupos.slice(i, i + BATCH_SIZE);

      const resp = await fetch(`${supabaseUrl}/functions/v1/classificar-contas-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ groups: batch }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`Batch ${i} erro: ${resp.status} ${errText}`);
        errorCount += batch.length;
        details.push({ batch: i, error: errText });
        continue;
      }

      const data = await resp.json();
      if (!data?.results) {
        errorCount += batch.length;
        details.push({ batch: i, error: "Resposta inválida" });
        continue;
      }

      for (const result of data.results) {
        if (result.success === true && result.departamento_id) {
          // Atualizar contas
          let updateQ = supabase
            .from("contas_pagar")
            .update({
              departamento_id: result.departamento_id,
              departamento_nome: result.departamento_nome,
              plano_contas_id: result.plano_contas_id,
              plano_contas_codigo: result.plano_contas_codigo,
              plano_contas_nome: result.plano_contas_nome,
              confianca_classificacao: result.confianca_classificacao,
              classificacao_justificativa: result.classificacao_justificativa,
              classificado_automaticamente: true,
              classificado_em: new Date().toISOString(),
            })
            .eq("categoria_nome", result.categoria_nome)
            .eq("classificado_automaticamente", false)
            .or("classificacao_manual.is.null,classificacao_manual.eq.false");

          if (result.fornecedor_nome) updateQ = updateQ.eq("fornecedor_nome", result.fornecedor_nome);
          else updateQ = updateQ.is("fornecedor_nome", null);
          if (result.tipo_documento) updateQ = updateQ.eq("tipo_documento", result.tipo_documento);
          else updateQ = updateQ.is("tipo_documento", null);

          const { error: updErr } = await updateQ;
          if (updErr) {
            errorCount++;
            details.push({ categoria: result.categoria_nome, error: updErr.message });
          } else {
            successCount++;
          }
        } else {
          errorCount++;
          details.push({ categoria: result.categoria_nome, error: result.error || "Falha" });
        }
      }

      // Delay entre lotes para evitar rate limit
      if (i + BATCH_SIZE < grupos.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Registrar log
    await supabase.from("classification_auto_logs").insert({
      executed_at: startedAt,
      total_groups: totalGroups,
      success_count: successCount,
      error_count: errorCount,
      details: { results: details.slice(0, 50) },
    });

    const msg = `Auto-classificação: ${successCount} sucesso, ${errorCount} erros de ${totalGroups} grupos`;
    console.log(msg);
    return new Response(JSON.stringify({ message: msg, totalGroups, successCount, errorCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro auto-classificação:", error);
    await supabase.from("classification_auto_logs").insert({
      executed_at: startedAt,
      total_groups: totalGroups,
      success_count: successCount,
      error_count: errorCount,
      details: { fatal_error: error instanceof Error ? error.message : "Desconhecido" },
    }).catch(() => {});
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
