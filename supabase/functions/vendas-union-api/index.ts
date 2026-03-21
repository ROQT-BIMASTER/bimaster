import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const BATCH_SIZE = 1000;

// Mapeamento SQL Server → snake_case
const FIELD_MAP: Record<string, string> = {
  "ID Empresa": "id_empresa",
  "Empresa": "empresa",
  "Pedido": "pedido",
  "Data": "data",
  "Nota": "nota",
  "Operação": "operacao",
  "Operacao": "operacao",
  "Cod.Cliente": "cod_cliente",
  "Cliente": "cliente",
  "IDRAMO": "id_ramo",
  "Ramo": "ramo",
  "Cidade": "cidade",
  "UF": "uf",
  "TP VENDA": "tp_venda",
  "TP NFE": "tp_nfe",
  "Cod.Produto": "cod_produto",
  "Descrição": "descricao",
  "Descricao": "descricao",
  "Marca": "marca",
  "Quantidade": "quantidade",
  "Preço Venda": "preco_venda",
  "Preco Venda": "preco_venda",
  "Vl.Desconto": "vl_desconto",
  "Vl.Icm Subst.": "vl_icm_subst",
  "Vl.CMV": "vl_cmv",
  "Vl.Outros custos": "vl_outros_custos",
  "Tabela": "tabela",
  "Cod.Vend": "cod_vend",
  "Vendedor": "vendedor",
  "Cod.Equipe": "cod_equipe",
  "Nome Equipe": "nome_equipe",
  "Supervisor": "supervisor",
  "NomeLinha": "nome_linha",
};

// Campos que já estão em snake_case (fallback)
const VALID_COLUMNS = new Set(Object.values(FIELD_MAP));

function mapRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const col = FIELD_MAP[key] || (VALID_COLUMNS.has(key) ? key : null);
    if (col) {
      mapped[col] = value ?? null;
    }
  }
  return mapped;
}

function parseNumeric(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function sanitize(rec: Record<string, unknown>): Record<string, unknown> {
  return {
    id_empresa: parseNumeric(rec.id_empresa),
    empresa: rec.empresa ? String(rec.empresa).trim() : null,
    pedido: parseNumeric(rec.pedido),
    data: parseDate(rec.data),
    nota: parseNumeric(rec.nota),
    operacao: rec.operacao ? String(rec.operacao).trim() : null,
    cod_cliente: parseNumeric(rec.cod_cliente),
    cliente: rec.cliente ? String(rec.cliente).trim() : null,
    id_ramo: parseNumeric(rec.id_ramo),
    ramo: rec.ramo ? String(rec.ramo).trim() : null,
    cidade: rec.cidade ? String(rec.cidade).trim() : null,
    uf: rec.uf ? String(rec.uf).trim().toUpperCase() : null,
    tp_venda: rec.tp_venda ? String(rec.tp_venda).trim() : null,
    tp_nfe: rec.tp_nfe ? String(rec.tp_nfe).trim() : null,
    cod_produto: parseNumeric(rec.cod_produto),
    descricao: rec.descricao ? String(rec.descricao).trim() : null,
    marca: rec.marca ? String(rec.marca).trim() : null,
    quantidade: parseNumeric(rec.quantidade),
    preco_venda: parseNumeric(rec.preco_venda),
    vl_desconto: parseNumeric(rec.vl_desconto),
    vl_icm_subst: parseNumeric(rec.vl_icm_subst),
    vl_cmv: parseNumeric(rec.vl_cmv),
    vl_outros_custos: parseNumeric(rec.vl_outros_custos),
    tabela: rec.tabela ? String(rec.tabela).trim() : null,
    cod_vend: parseNumeric(rec.cod_vend),
    vendedor: rec.vendedor ? String(rec.vendedor).trim() : null,
    cod_equipe: parseNumeric(rec.cod_equipe),
    nome_equipe: rec.nome_equipe ? String(rec.nome_equipe).trim() : null,
    supervisor: rec.supervisor ? String(rec.supervisor).trim() : null,
    nome_linha: rec.nome_linha ? String(rec.nome_linha).trim() : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  // Only /sync route
  if (req.method !== "POST" || (path !== "sync" && path !== "vendas-union-api")) {
    return new Response(
      JSON.stringify({ error: "Use POST /sync" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    const validKeys = [
      Deno.env.get("VENDAS_UNION_API_KEY"),
      Deno.env.get("N8N_API_KEY"),
      Deno.env.get("POLLO_API_KEY"),
    ].filter(Boolean);

    if (!apiKey || !validKeys.includes(apiKey)) {
      return new Response(
        JSON.stringify({ error: "API key inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    // Accept { vendas: [...] } or raw array or N8N $items() format
    let records: any[];
    if (Array.isArray(body)) {
      records = body;
    } else if (Array.isArray(body.vendas)) {
      records = body.vendas;
    } else {
      return new Response(
        JSON.stringify({ error: "Envie um array em 'vendas' ou array direto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted: 0, message: "Nenhum registro enviado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[vendas-union-api] Recebidos ${records.length} registros`);

    const startTime = Date.now();

    // Unwrap N8N $items() format: { json: { ... } }
    const unwrapped = records.map((r: any) => (r.json ? r.json : r));

    // Map and sanitize
    const mapped = unwrapped.map((r: any) => sanitize(mapRecord(r)));

    // Insert in batches
    let totalInserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("vendas_union")
        .insert(batch)
        .select("id");

      if (error) {
        console.error(`[vendas-union-api] Erro batch ${Math.floor(i / BATCH_SIZE)}:`, error.message);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
      } else {
        totalInserted += data?.length || 0;
      }
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        received: records.length,
        inserted: totalInserted,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: duration,
        rate_per_second: duration > 0 ? Math.round((totalInserted / duration) * 1000) : 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[vendas-union-api] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
