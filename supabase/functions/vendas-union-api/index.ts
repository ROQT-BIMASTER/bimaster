import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const API_VERSION = '1.0.0';
const INSERT_BATCH_SIZE = 2000;
const BATCH_DELAY_MS = 5;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =====================================================
// EXTRAÇÃO DE DADOS - SUPORTA QUALQUER FORMATO N8N
// =====================================================
function extractRecords(input: any): any[] {
  if (Array.isArray(input)) {
    return input.map(item => {
      if (item && typeof item === 'object' && item.json && typeof item.json === 'object') {
        return item.json;
      }
      return item;
    });
  }

  if (input && typeof input === 'object') {
    const possibleArrays = ['vendas', 'data', 'items', 'records', 'rows'];
    for (const key of possibleArrays) {
      if (input[key] && Array.isArray(input[key])) {
        return extractRecords(input[key]);
      }
    }

    // Single record
    if (input['Pedido'] || input.pedido) {
      return [input];
    }
  }

  return [];
}

// =====================================================
// MAPEAMENTO SQL Server → snake_case
// =====================================================
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
  "Preço": "preco_venda",
  "Preco": "preco_venda",
  "Venda": "venda",
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

const VALID_COLUMNS = new Set(Object.values(FIELD_MAP));

// =====================================================
// TRANSFORMAÇÃO
// =====================================================
function parseNumeric(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  const str = String(v).trim();
  if (!str || str.length < 8) return null;

  // DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (y.length === 4) {
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }

  // ISO or other
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function transformRecord(raw: Record<string, unknown>): Record<string, unknown> {
  // Map keys
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const col = FIELD_MAP[key] || (VALID_COLUMNS.has(key) ? key : null);
    if (col) {
      mapped[col] = value ?? null;
    }
  }

  // Sanitize types
  return {
    id_empresa: parseNumeric(mapped.id_empresa),
    empresa: mapped.empresa ? String(mapped.empresa).trim() : null,
    pedido: parseNumeric(mapped.pedido),
    data: parseDate(mapped.data),
    nota: parseNumeric(mapped.nota),
    operacao: mapped.operacao ? String(mapped.operacao).trim() : null,
    cod_cliente: parseNumeric(mapped.cod_cliente),
    cliente: mapped.cliente ? String(mapped.cliente).trim() : null,
    id_ramo: parseNumeric(mapped.id_ramo),
    ramo: mapped.ramo ? String(mapped.ramo).trim() : null,
    cidade: mapped.cidade ? String(mapped.cidade).trim() : null,
    uf: mapped.uf ? String(mapped.uf).trim().toUpperCase() : null,
    tp_venda: mapped.tp_venda ? String(mapped.tp_venda).trim() : null,
    tp_nfe: mapped.tp_nfe ? String(mapped.tp_nfe).trim() : null,
    cod_produto: parseNumeric(mapped.cod_produto),
    descricao: mapped.descricao ? String(mapped.descricao).trim() : null,
    marca: mapped.marca ? String(mapped.marca).trim() : null,
    quantidade: parseNumeric(mapped.quantidade),
    preco_venda: parseNumeric(mapped.preco_venda),
    vl_desconto: parseNumeric(mapped.vl_desconto),
    vl_icm_subst: parseNumeric(mapped.vl_icm_subst),
    vl_cmv: parseNumeric(mapped.vl_cmv),
    vl_outros_custos: parseNumeric(mapped.vl_outros_custos),
    tabela: mapped.tabela ? String(mapped.tabela).trim() : null,
    cod_vend: parseNumeric(mapped.cod_vend),
    vendedor: mapped.vendedor ? String(mapped.vendedor).trim() : null,
    cod_equipe: parseNumeric(mapped.cod_equipe),
    nome_equipe: mapped.nome_equipe ? String(mapped.nome_equipe).trim() : null,
    supervisor: mapped.supervisor ? String(mapped.supervisor).trim() : null,
    nome_linha: mapped.nome_linha ? String(mapped.nome_linha).trim() : null,
  };
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const pathClean = path.replace('/vendas-union-api', '');

  console.log(`[vendas-union-api v${API_VERSION}] ${req.method} ${path} (clean: ${pathClean})`);

  // ============ POST /sync ============
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Use POST /sync', api_version: API_VERSION }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate API key
  const apiKey = req.headers.get('x-api-key');
  const validKey = Deno.env.get('VENDAS_UNION_API_KEY');

  if (!apiKey || !validKey || apiKey !== validKey) {
    return new Response(
      JSON.stringify({ error: 'API key inválida' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const records = extractRecords(body);

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, received: 0, inserted: 0, message: 'Nenhum registro enviado', api_version: API_VERSION }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[vendas-union-api] Recebidos ${records.length} registros`);
    const startTime = Date.now();

    // Transform all records
    const transformed = records.map(r => transformRecord(r));

    // Insert in batches
    let totalInserted = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < transformed.length; i += INSERT_BATCH_SIZE) {
      const batch = transformed.slice(i, i + INSERT_BATCH_SIZE);
      const batchNum = Math.floor(i / INSERT_BATCH_SIZE);

      const { data, error } = await supabase
        .from('vendas_union')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`[vendas-union-api] Erro batch ${batchNum}:`, error.message);
        errors.push(`Batch ${batchNum}: ${error.message}`);
        errorCount += batch.length;
      } else {
        totalInserted += data?.length || 0;
      }

      if (i + INSERT_BATCH_SIZE < transformed.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[vendas-union-api] Concluído: ${totalInserted} inseridos em ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        received: records.length,
        transformed: transformed.length,
        inserted: totalInserted,
        errors: errorCount,
        error_details: errors.length > 0 ? errors : undefined,
        duration_ms: duration,
        rate_per_second: duration > 0 ? Math.round((totalInserted / duration) * 1000) : 0,
        api_version: API_VERSION,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[vendas-union-api] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message, api_version: API_VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
