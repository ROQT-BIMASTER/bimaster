import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { formId } = await req.json();
    if (!formId) {
      return new Response(JSON.stringify({ error: "formId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch form
    const { data: form, error: formErr } = await supabase
      .from("dynamic_forms")
      .select("name, description")
      .eq("id", formId)
      .single();
    if (formErr) throw formErr;

    // Fetch fields
    const { data: fields } = await supabase
      .from("dynamic_form_fields")
      .select("id, label, field_type, options, required")
      .eq("form_id", formId)
      .order("order_index");

    // Fetch responses
    const { data: responses } = await supabase
      .from("dynamic_form_responses")
      .select("id, created_at")
      .eq("form_id", formId)
      .order("created_at", { ascending: false });

    const responseIds = (responses || []).map((r: any) => r.id);
    let answers: any[] = [];
    if (responseIds.length > 0) {
      const { data } = await supabase
        .from("dynamic_form_answers")
        .select("response_id, field_id, value")
        .in("response_id", responseIds);
      answers = data || [];
    }

    // Build distribution per field
    const fieldMap = new Map((fields || []).map((f: any) => [f.id, f]));
    const distributions: Record<string, Record<string, number>> = {};
    const numericValues: Record<string, number[]> = {};

    (fields || []).forEach((f: any) => {
      if (["select", "radio", "rating", "checkbox"].includes(f.field_type)) {
        distributions[f.id] = {};
      }
      if (["number", "price", "rating"].includes(f.field_type)) {
        numericValues[f.id] = [];
      }
    });

    answers.forEach((a: any) => {
      const field = fieldMap.get(a.field_id);
      if (!field) return;
      const val = a.value;
      if (distributions[a.field_id] !== undefined) {
        const key = typeof val === "object" ? JSON.stringify(val) : String(val);
        distributions[a.field_id][key] = (distributions[a.field_id][key] || 0) + 1;
      }
      if (numericValues[a.field_id] !== undefined) {
        const num = Number(val);
        if (!isNaN(num)) numericValues[a.field_id].push(num);
      }
    });

    // Build context for AI
    let context = `Formulário: "${form.name}"`;
    if (form.description) context += `\nDescrição: ${form.description}`;
    context += `\nTotal de respostas: ${responseIds.length}`;

    if (responses && responses.length > 0) {
      const first = responses[responses.length - 1].created_at;
      const last = responses[0].created_at;
      context += `\nPeríodo: ${first?.slice(0, 10)} a ${last?.slice(0, 10)}`;
    }

    context += `\n\nCampos do formulário:`;
    (fields || []).forEach((f: any) => {
      context += `\n- ${f.label} (tipo: ${f.field_type}${f.required ? ", obrigatório" : ""})`;
      if (f.options && Array.isArray(f.options)) {
        context += ` [opções: ${f.options.join(", ")}]`;
      }
    });

    context += `\n\nDistribuições:`;
    Object.entries(distributions).forEach(([fieldId, dist]) => {
      const field = fieldMap.get(fieldId);
      if (!field || Object.keys(dist).length === 0) return;
      context += `\n\n"${field.label}":`;
      Object.entries(dist)
        .sort((a, b) => b[1] - a[1])
        .forEach(([val, count]) => {
          context += `\n  ${val}: ${count} (${((count / responseIds.length) * 100).toFixed(1)}%)`;
        });
    });

    Object.entries(numericValues).forEach(([fieldId, vals]) => {
      if (vals.length === 0) return;
      const field = fieldMap.get(fieldId);
      if (!field) return;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      context += `\n\n"${field.label}" (numérico): média=${avg.toFixed(2)}, min=${min}, max=${max}`;
    });

    // Last 10 responses sample
    const last10 = responses?.slice(0, 10) || [];
    if (last10.length > 0) {
      context += `\n\nÚltimas ${last10.length} respostas (amostra):`;
      last10.forEach((r: any, i: number) => {
        const respAnswers = answers.filter((a: any) => a.response_id === r.id);
        context += `\n${i + 1}. (${r.created_at?.slice(0, 10)}): `;
        respAnswers.forEach((a: any) => {
          const field = fieldMap.get(a.field_id);
          if (field) {
            const val = typeof a.value === "object" ? JSON.stringify(a.value) : String(a.value);
            context += `${field.label}="${val}" | `;
          }
        });
      });
    }

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você é um analista de dados especializado em pesquisas e formulários. Analise os dados fornecidos e gere um relatório completo em Markdown com as seguintes seções:\n\n## 📊 Resumo Executivo\nVisão geral rápida dos principais números.\n\n## 🔍 Principais Insights\nPadrões, tendências e descobertas relevantes.\n\n## 📈 Análise por Campo\nDistribuição e observações para cada campo relevante.\n\n## ⚠️ Pontos de Atenção\nAnomalias, dados faltantes ou tendências preocupantes.\n\n## 💡 Recomendações\nSugestões acionáveis baseadas nos dados.\n\nSeja objetivo, use dados concretos e percentuais. Responda em português brasileiro.",
          },
          {
            role: "user",
            content: context,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const report = aiData.choices?.[0]?.message?.content || "Sem conteúdo gerado.";

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-form-responses error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
