import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Autenticação via API Key (N8N_API_KEY ou POLLO_API_KEY)
    const apiKey = req.headers.get("x-api-key");
    const validKeys = [
      Deno.env.get("N8N_API_KEY"),
      Deno.env.get("POLLO_API_KEY"),
    ].filter(Boolean);

    if (!apiKey || !validKeys.includes(apiKey)) {
      return new Response(
        JSON.stringify({ error: "API key inválida" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const records = body.vendedores || body;

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "Envie um array em 'vendedores'" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    console.log(`Recebidos ${records.length} registros de dimensao_vendedores`);

    // Map JSON fields to DB columns
    const mapped = records.map((r: any) => ({
      id_vnd: r.Id_Vnd,
      nomemapa_vnd: r.nomemapa_vnd?.trim() || "",
      equipe_vnd: r.equipe_vnd,
      nome_eqp: r.nome_eqp?.trim() || null,
      cnpj_par: r.cnpj_Par?.trim() || null,
      cliente_clivend: String(r.Cliente_CliVend).trim(),
      row_num: r.RowNum ? String(r.RowNum) : null,
    }));

    // Upsert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    let updated = 0;
    let errors: string[] = [];

    for (let i = 0; i < mapped.length; i += batchSize) {
      const batch = mapped.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("dimensao_vendedores")
        .upsert(batch, { onConflict: "id_vnd,cliente_clivend", ignoreDuplicates: false })
        .select("id");

      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize)}: ${error.message}`);
      } else {
        inserted += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        total_received: records.length,
        processed: inserted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro sync-dimensao-vendedores:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
