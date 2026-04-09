import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

function arredondamentoFiscal(v: number): number {
  return Math.round(v * 100) / 100;
}

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 60,
  rateLimitPrefix: "fiscal-iva",
}, async (req, _ctx) => {

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";
    const periodo = url.searchParams.get("periodo") || "";

    // GET /resumo
    if (req.method === "GET" && path === "resumo") {
      const [ano, mes] = periodo.split("-").map(Number);
      if (!ano || !mes) {
        return new Response(JSON.stringify({ error: "Parâmetro periodo=YYYY-MM obrigatório" }), {
          status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const inicioMes = new Date(ano, mes - 1, 1).toISOString();
      const fimMes = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      // Créditos de entrada
      const { data: itens } = await supabase
        .from("fabrica_itens_nf")
        .select("valor_cbs, valor_ibs, elegivel_credito_iva")
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes)
        .not("valor_cbs", "is", null);

      // Débitos de saída
      const { data: itensSaida } = await supabase
        .from("fabrica_itens_nf_saida" as any)
        .select("valor_cbs, valor_ibs")
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes);

      const creditos_cbs = arredondamentoFiscal(
        (itens || []).filter((i: any) => i.elegivel_credito_iva !== false).reduce((s: number, i: any) => s + (i.valor_cbs || 0), 0)
      );
      const creditos_ibs = arredondamentoFiscal(
        (itens || []).filter((i: any) => i.elegivel_credito_iva !== false).reduce((s: number, i: any) => s + (i.valor_ibs || 0), 0)
      );

      const debitos_cbs = arredondamentoFiscal(
        ((itensSaida as any[]) || []).reduce((s: number, i: any) => s + (i.valor_cbs || 0), 0)
      );
      const debitos_ibs = arredondamentoFiscal(
        ((itensSaida as any[]) || []).reduce((s: number, i: any) => s + (i.valor_ibs || 0), 0)
      );

      const result = {
        periodo,
        total_debitos_cbs: debitos_cbs,
        total_debitos_ibs: debitos_ibs,
        total_creditos_cbs: creditos_cbs,
        total_creditos_ibs: creditos_ibs,
        cbs_a_recolher: arredondamentoFiscal(debitos_cbs - creditos_cbs),
        ibs_a_recolher: arredondamentoFiscal(debitos_ibs - creditos_ibs),
        saldo_iva: arredondamentoFiscal(
          (debitos_cbs - creditos_cbs) + (debitos_ibs - creditos_ibs)
        ),
      };

      return new Response(JSON.stringify(result), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // GET /debitos
    if (req.method === "GET" && path === "debitos") {
      const [ano, mes] = periodo.split("-").map(Number);
      const inicioMes = new Date(ano, mes - 1, 1).toISOString();
      const fimMes = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      const { data } = await supabase
        .from("fabrica_itens_nf_saida" as any)
        .select("*, nota_saida_id")
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes);

      return new Response(JSON.stringify({ debitos: data || [] }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // GET /creditos
    if (req.method === "GET" && path === "creditos") {
      const { data } = await supabase
        .from("fabrica_creditos_tributarios")
        .select("*")
        .eq("periodo_apuracao", periodo)
        .in("tipo_credito", ["CBS", "IBS"]);

      return new Response(JSON.stringify({ creditos: data || [] }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // GET /saidas
    if (req.method === "GET" && path === "saidas") {
      const { data } = await supabase
        .from("fabrica_notas_fiscais_saida" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ notas: data || [] }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // POST /simular
    if (req.method === "POST" && path === "simular") {
      const body = await req.json();
      const simItens = body.itens || [];
      const debitos: any[] = [];
      const creditos: any[] = [];

      for (const item of simItens) {
        const base = item.base_calculo || 0;
        const cbs = item.aliquota_cbs || 0;
        const ibs = item.aliquota_ibs || 0;

        if (base < 0) {
          return new Response(JSON.stringify({ error: "Base de cálculo não pode ser negativa" }), {
            status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }

        if (item.tipo_operacao === "SAIDA") {
          debitos.push({
            valor_cbs: arredondamentoFiscal(base * cbs / 100),
            valor_ibs: arredondamentoFiscal(base * ibs / 100),
          });
        } else if (item.elegivel_credito !== false) {
          creditos.push({
            credito_cbs: arredondamentoFiscal(base * cbs / 100),
            credito_ibs: arredondamentoFiscal(base * ibs / 100),
          });
        }
      }

      const total_debitos_cbs = arredondamentoFiscal(debitos.reduce((s, d) => s + d.valor_cbs, 0));
      const total_debitos_ibs = arredondamentoFiscal(debitos.reduce((s, d) => s + d.valor_ibs, 0));
      const total_creditos_cbs = arredondamentoFiscal(creditos.reduce((s, c) => s + c.credito_cbs, 0));
      const total_creditos_ibs = arredondamentoFiscal(creditos.reduce((s, c) => s + c.credito_ibs, 0));

      return new Response(JSON.stringify({
        total_debitos_cbs,
        total_debitos_ibs,
        total_creditos_cbs,
        total_creditos_ibs,
        cbs_a_recolher: arredondamentoFiscal(total_debitos_cbs - total_creditos_cbs),
        ibs_a_recolher: arredondamentoFiscal(total_debitos_ibs - total_creditos_ibs),
        saldo_iva: arredondamentoFiscal(
          (total_debitos_cbs - total_creditos_cbs) + (total_debitos_ibs - total_creditos_ibs)
        ),
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Endpoint não encontrado" }), {
      status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
}));
