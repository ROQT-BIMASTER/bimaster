import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(messages: { role: string; content: string }[]) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("AI error", res.status, t);
    throw new Error(`AI error: ${res.status}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const {
      processo_id,
      documentos,
      modulos_destino,
      workflow_nome,
      observacao,
      prazo_horas,
      usuario_nome,
      etapa_atual,
      produto_nome,
    } = await req.json();

    // Build context for AI
    const docsDesc = (documentos || [])
      .map((d: any, i: number) => `${i + 1}. ${d.nome || d.tipo || "Documento"}`)
      .join("\n");

    const modulosDesc = (modulos_destino || []).join(", ");

    const hoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const prompt = `Você é o sistema de gestão documental e processos de uma empresa. 
Gere um DESPACHO OFICIAL formal, no estilo judiciário brasileiro (TJSP), para registrar uma movimentação processual.

CONTEXTO:
- Produto/Processo: ${produto_nome || "N/I"}
- Etapa atual do processo: ${etapa_atual || "N/I"}
- Documentos despachados:
${docsDesc || "N/I"}
- Módulo(s) de destino: ${modulosDesc || "N/I"}
- Workflow aplicado: ${workflow_nome || "Nenhum"}
- Prazo para ciência: ${prazo_horas || 48} horas
- Observação do remetente: ${observacao || "Nenhuma"}
- Despachado por: ${usuario_nome || "Usuário do sistema"}
- Data: ${hoje}

REGRAS:
1. Use linguagem formal e concisa, no padrão de despachos processuais
2. Referencie os documentos como "fls." (folhas) ou "anexos"
3. Mencione o encaminhamento aos módulos/departamentos de destino
4. Indique o prazo para ciência e manifestação
5. Inclua "Cumpra-se." ou "Intime-se." ao final
6. NÃO invente dados que não foram fornecidos
7. O texto deve ter entre 3 e 8 linhas
8. NÃO inclua cabeçalho, brasão ou assinatura — apenas o corpo do despacho

Gere APENAS o texto do despacho, sem formatação markdown.`;

    const textoDespacho = await callAI([
      { role: "system", content: "Você gera despachos oficiais formais no padrão processual brasileiro." },
      { role: "user", content: prompt },
    ]);

    // Save as official process event
    if (processo_id) {
      await supabase.from("process_events").insert({
        process_id: processo_id,
        tipo_evento: "despacho_oficial",
        descricao: textoDespacho.trim(),
        modulo_origem: "despacho",
        usuario_id: null,
        usuario_nome: `IA — em nome de ${usuario_nome || "Usuário"}`,
        metadata: {
          documentos: documentos || [],
          modulos_destino: modulos_destino || [],
          workflow_nome: workflow_nome || null,
          prazo_horas: prazo_horas || 48,
          observacao: observacao || null,
          gerado_por_ia: true,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, despacho: textoDespacho.trim() }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
