// Pré-check de compatibilidade entre influenciador e perfil da empresa.
// Usa Lovable AI (sem custo Apify) para classificar o "fit" antes de gastar runs.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface FitResult {
  fit_score: number;
  fit_label: "compativel" | "parcial" | "divergente";
  reasons: string[];
  handle_mismatch: boolean;
  expected_handle: string | null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { influencer_id, override_handle } = body ?? {};
    if (typeof influencer_id !== "string") {
      return new Response(JSON.stringify({ error: "influencer_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: influencer } = await serviceClient
      .from("influencers")
      .select("id, platform, username, display_name, notes, category, bio, followers_count")
      .eq("id", influencer_id)
      .maybeSingle();
    if (!influencer) {
      return new Response(JSON.stringify({ error: "influencer não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: company } = await serviceClient
      .from("influencer_company_profile")
      .select("company_name, segment, target_audience, brand_values, products_services, brand_tone, campaign_goals")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const expectedHandle = (override_handle ?? "").toString().trim().replace(/^@/, "");
    const handleMismatch = expectedHandle.length > 0 && expectedHandle.toLowerCase() !== (influencer.username ?? "").toLowerCase();

    // Sem perfil da empresa, retorna neutro (compatível) — só lida com mismatch de handle
    if (!company) {
      const result: FitResult = {
        fit_score: 70,
        fit_label: "compativel",
        reasons: ["Perfil da empresa não preenchido — checagem de compatibilidade ignorada."],
        handle_mismatch: handleMismatch,
        expected_handle: handleMismatch ? expectedHandle : null,
      };
      return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `Você é um analista de marketing. Avalie a compatibilidade entre um influenciador e o perfil de uma empresa para decidir se vale a pena monitorá-lo.
Considere segmento, público-alvo, valores de marca, produtos/serviços e objetivos de campanha. Seja direto. Responda em português.`;

    const userPrompt = `EMPRESA:
- Nome: ${company.company_name || "(não informado)"}
- Segmento: ${company.segment || "(não informado)"}
- Público-alvo: ${company.target_audience || "(não informado)"}
- Valores: ${company.brand_values || "(não informado)"}
- Produtos/Serviços: ${company.products_services || "(não informado)"}
- Tom de marca: ${company.brand_tone || "(não informado)"}
- Objetivos: ${company.campaign_goals || "(não informado)"}

INFLUENCIADOR:
- Plataforma: ${influencer.platform}
- Handle: @${influencer.username}
- Nome: ${influencer.display_name || "(não informado)"}
- Categoria: ${(influencer as any).category || "(não informada)"}
- Bio: ${(influencer as any).bio || influencer.notes || "(não informada)"}
- Seguidores: ${influencer.followers_count ?? "?"}

Classifique o fit em: "compativel" (alinhado), "parcial" (relacionado mas com ressalvas) ou "divergente" (não alinhado).`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "report_fit",
            description: "Reporta a avaliação de compatibilidade",
            parameters: {
              type: "object",
              properties: {
                fit_score: { type: "number", description: "0 a 100" },
                fit_label: { type: "string", enum: ["compativel", "parcial", "divergente"] },
                reasons: { type: "array", items: { type: "string" }, description: "2 a 4 motivos curtos" },
              },
              required: ["fit_score", "fit_label", "reasons"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_fit" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Lovable AI error", aiRes.status, t);
      if (aiRes.status === 429 || aiRes.status === 402) {
        return new Response(JSON.stringify({ error: aiRes.status === 429 ? "rate_limited" : "no_credits" }), { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Fallback neutro: não bloqueia o fluxo
      const result: FitResult = {
        fit_score: 60,
        fit_label: "parcial",
        reasons: ["Não foi possível validar via IA — confirme manualmente."],
        handle_mismatch: handleMismatch,
        expected_handle: handleMismatch ? expectedHandle : null,
      };
      return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = {};
    try { parsed = JSON.parse(toolCall?.function?.arguments ?? "{}"); } catch { /* ignore */ }

    const result: FitResult = {
      fit_score: typeof parsed.fit_score === "number" ? Math.max(0, Math.min(100, parsed.fit_score)) : 60,
      fit_label: ["compativel", "parcial", "divergente"].includes(parsed.fit_label) ? parsed.fit_label : "parcial",
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 4) : [],
      handle_mismatch: handleMismatch,
      expected_handle: handleMismatch ? expectedHandle : null,
    };

    return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("validate-influencer-fit error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
