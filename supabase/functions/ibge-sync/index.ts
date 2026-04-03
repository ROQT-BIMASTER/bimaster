import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";
const SIDRA_BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";

interface SyncProgress {
  step: string;
  current: number;
  total: number;
  message: string;
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

async function fetchEstados(): Promise<any[]> {
  const data = await fetchWithRetry(`${IBGE_BASE}/estados?orderBy=nome`);
  return data.map((e: any) => ({
    id: e.id,
    sigla: e.sigla,
    nome: e.nome,
    regiao_id: e.regiao.id,
    regiao_sigla: e.regiao.sigla,
    regiao_nome: e.regiao.nome,
  }));
}

async function fetchMicrorregioes(): Promise<any[]> {
  const data = await fetchWithRetry(`${IBGE_BASE}/microrregioes?orderBy=nome`);
  return data.map((m: any) => ({
    id: m.id,
    nome: m.nome,
    mesorregiao_id: m.mesorregiao.id,
    mesorregiao_nome: m.mesorregiao.nome,
    uf_id: m.mesorregiao.UF.id,
    regiao_nome: m.mesorregiao.UF.regiao.nome,
  }));
}

async function fetchMunicipios(): Promise<any[]> {
  const data = await fetchWithRetry(`${IBGE_BASE}/municipios?orderBy=nome&view=nivelado`);
  return data.map((m: any) => ({
    id: m["municipio-id"],
    nome: m["municipio-nome"],
    uf_id: m["UF-id"],
    uf_sigla: m["UF-sigla"],
    microrregiao_id: m["microrregiao-id"],
    microrregiao_nome: m["microrregiao-nome"],
    mesorregiao_id: m["mesorregiao-id"],
    mesorregiao_nome: m["mesorregiao-nome"],
    regiao_nome: m["regiao-nome"],
  }));
}

async function fetchPopulacao(): Promise<Map<number, { valor: number; ano: number }>> {
  // Tabela 6579, variável 9324 - População estimada
  // Pega último período disponível
  const url = `${SIDRA_BASE}/6579/periodos/-1/variaveis/9324?localidades=N6[all]`;
  const data = await fetchWithRetry(url);

  const map = new Map<number, { valor: number; ano: number }>();

  if (data && data.length > 0) {
    const variavel = data[0];
    if (variavel.resultados && variavel.resultados.length > 0) {
      for (const resultado of variavel.resultados) {
        for (const serie of resultado.series) {
          const codMunicipio = parseInt(serie.localidade.id);
          const periodos = Object.keys(serie.serie);
          if (periodos.length > 0) {
            const ultimoPeriodo = periodos[periodos.length - 1];
            const valor = parseInt(serie.serie[ultimoPeriodo]);
            if (!isNaN(valor) && valor > 0) {
              map.set(codMunicipio, { valor, ano: parseInt(ultimoPeriodo) });
            }
          }
        }
      }
    }
  }

  return map;
}

async function fetchPIB(): Promise<Map<number, { valor: number; ano: number }>> {
  // Tabela 5938, variável 37 - PIB municipal em Mil Reais
  // Pega último período disponível
  const url = `${SIDRA_BASE}/5938/periodos/-1/variaveis/37?localidades=N6[all]`;
  const data = await fetchWithRetry(url);

  const map = new Map<number, { valor: number; ano: number }>();

  if (data && data.length > 0) {
    const variavel = data[0];
    if (variavel.resultados && variavel.resultados.length > 0) {
      for (const resultado of variavel.resultados) {
        for (const serie of resultado.series) {
          const codMunicipio = parseInt(serie.localidade.id);
          const periodos = Object.keys(serie.serie);
          if (periodos.length > 0) {
            const ultimoPeriodo = periodos[periodos.length - 1];
            const valor = parseFloat(serie.serie[ultimoPeriodo]);
            if (!isNaN(valor) && valor > 0) {
              map.set(codMunicipio, { valor, ano: parseInt(ultimoPeriodo) });
            }
          }
        }
      }
    }
  }

  return map;
}

async function upsertBatch(supabase: any, table: string, data: any[], batchSize = 500) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`Error upserting batch ${i / batchSize + 1} to ${table}:`, error);
      throw error;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: SyncProgress[] = [];

    // Step 1: Fetch and save states
    console.log("Step 1: Fetching estados...");
    const estados = await fetchEstados();
    await upsertBatch(supabase, "ibge_estados", estados);
    results.push({ step: "estados", current: 1, total: 6, message: `${estados.length} estados salvos` });

    // Step 2: Fetch and save micro-regions
    console.log("Step 2: Fetching microrregiões...");
    const microrregioes = await fetchMicrorregioes();
    await upsertBatch(supabase, "ibge_microrregioes", microrregioes);
    results.push({ step: "microrregioes", current: 2, total: 6, message: `${microrregioes.length} microrregiões salvas` });

    // Step 3: Fetch municipalities
    console.log("Step 3: Fetching municípios...");
    const municipios = await fetchMunicipios();
    results.push({ step: "municipios_base", current: 3, total: 6, message: `${municipios.length} municípios carregados` });

    // Step 4: Fetch population data
    console.log("Step 4: Fetching população...");
    const populacaoMap = await fetchPopulacao();
    results.push({ step: "populacao", current: 4, total: 6, message: `População de ${populacaoMap.size} municípios carregada` });

    // Step 5: Fetch PIB data
    console.log("Step 5: Fetching PIB...");
    const pibMap = await fetchPIB();
    results.push({ step: "pib", current: 5, total: 6, message: `PIB de ${pibMap.size} municípios carregado` });

    // Step 6: Merge and save municipalities with population and PIB
    console.log("Step 6: Merging and saving...");
    const municipiosCompletos = municipios.map((m) => {
      const pop = populacaoMap.get(m.id);
      const pib = pibMap.get(m.id);
      const populacao = pop?.valor || null;
      const pibValor = pib?.valor || null;
      const pibPerCapita =
        populacao && pibValor ? Math.round((pibValor * 1000) / populacao * 100) / 100 : null;

      return {
        ...m,
        populacao_estimada: populacao,
        pib_mil_reais: pibValor,
        pib_per_capita: pibPerCapita,
        ano_populacao: pop?.ano || null,
        ano_pib: pib?.ano || null,
        updated_at: new Date().toISOString(),
      };
    });

    await upsertBatch(supabase, "ibge_municipios", municipiosCompletos);

    // Update estados with aggregated population and PIB
    const estadosAgg = new Map<number, { pop: number; pib: number }>();
    for (const m of municipiosCompletos) {
      if (!estadosAgg.has(m.uf_id)) {
        estadosAgg.set(m.uf_id, { pop: 0, pib: 0 });
      }
      const agg = estadosAgg.get(m.uf_id)!;
      if (m.populacao_estimada) agg.pop += m.populacao_estimada;
      if (m.pib_mil_reais) agg.pib += m.pib_mil_reais;
    }

    for (const [ufId, agg] of estadosAgg) {
      await supabase
        .from("ibge_estados")
        .update({
          populacao: agg.pop,
          pib_mil_reais: Math.round(agg.pib * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ufId);
    }

    results.push({
      step: "finalizado",
      current: 6,
      total: 6,
      message: `Sincronização concluída: ${estados.length} estados, ${microrregioes.length} microrregiões, ${municipiosCompletos.length} municípios`,
    });

    console.log("Sync completed successfully!");

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
