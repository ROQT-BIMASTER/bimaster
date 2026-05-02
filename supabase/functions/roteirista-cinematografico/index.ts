// Roteirista IA Cinematográfico — converte fontes (texto/PDF/URLs) em roteiro estruturado.
// Inspirado no NotebookLM. Usa Gemini 2.5 Pro com tool calling para garantir JSON válido.
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface FonteInput {
  tipo: "texto" | "pdf" | "url" | "imagem";
  titulo?: string;
  conteudo: string; // Texto extraído (ou URL para tipo=imagem)
}

interface BriefingInput {
  tema: string;
  objetivo?: string; // ex: "vender produto X", "educar sobre Y"
  publico_alvo?: string;
  tom?: string; // cinematográfico, documental, comercial, ugc, energético
  duracao_total?: number; // segundos (5-60)
  numero_cenas?: number; // 3-8
  formato?: "9:16" | "16:9" | "1:1";
  paleta_cores?: string[];
}

const ROTEIRO_TOOL = {
  type: "function" as const,
  function: {
    name: "gerar_roteiro_cinematografico",
    description: "Retorna um roteiro cinematográfico estruturado, com cenas detalhadas prontas para geração de vídeo IA.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título do roteiro (max 80 chars)" },
        sinopse: { type: "string", description: "Resumo de 2-3 frases do conceito do vídeo" },
        conceito_visual: { type: "string", description: "Direção de arte geral: estética, paleta, mood, referências" },
        cenas: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              numero: { type: "integer" },
              titulo: { type: "string", description: "Título curto da cena (max 50 chars)" },
              duracao_segundos: { type: "integer", minimum: 3, maximum: 10 },
              tipo_plano: {
                type: "string",
                enum: ["wide", "medium", "close-up", "macro", "drone", "pov", "over-the-shoulder"],
              },
              movimento_camera: {
                type: "string",
                description: "Movimento: dolly in, pan left, tracking shot, static, crane up, etc",
              },
              descricao_visual: {
                type: "string",
                description: "PROMPT DETALHADO em INGLÊS pronto para o gerador de vídeo IA. Inclua: ambiente, personagens, ações, iluminação, atmosfera. Min 30 palavras.",
              },
              narracao: {
                type: "string",
                description: "Texto de narração/locução em PT-BR para esta cena (pode ser vazio)",
              },
              audio_ambiente: {
                type: "string",
                description: "Sugestão de trilha/SFX (ex: 'música cinematográfica épica', 'silêncio + passos')",
              },
            },
            required: [
              "numero",
              "titulo",
              "duracao_segundos",
              "tipo_plano",
              "movimento_camera",
              "descricao_visual",
              "narracao",
              "audio_ambiente",
            ],
            additionalProperties: false,
          },
        },
        cta: { type: "string", description: "Call-to-action final (1 frase)" },
        hashtags: {
          type: "array",
          items: { type: "string" },
          description: "5-10 hashtags relevantes",
        },
      },
      required: ["titulo", "sinopse", "conceito_visual", "cenas", "cta", "hashtags"],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(briefing: BriefingInput): string {
  return `Você é um roteirista cinematográfico sênior especializado em vídeos curtos virais para redes sociais e campanhas de marketing.

Sua missão: transformar as FONTES fornecidas em um roteiro estruturado pronto para produção via IA generativa de vídeo (Veo, Kling, Sora).

DIRETRIZES OBRIGATÓRIAS:
- Tom desejado: ${briefing.tom || "cinematográfico profissional"}
- Público-alvo: ${briefing.publico_alvo || "geral"}
- Objetivo: ${briefing.objetivo || "engajar e informar"}
- Formato: ${briefing.formato || "9:16"} ${briefing.formato === "9:16" ? "(Reels/TikTok/Shorts)" : ""}
- Duração total alvo: ~${briefing.duracao_total || 30}s
- Número de cenas: ${briefing.numero_cenas || 5}
${briefing.paleta_cores?.length ? `- Paleta de cores: ${briefing.paleta_cores.join(", ")}` : ""}

REGRAS CRÍTICAS PARA descricao_visual (PROMPT DE VÍDEO):
1. SEMPRE em INGLÊS (modelos de vídeo respondem melhor)
2. Mínimo 30 palavras, máximo 80
3. Estrutura: [SUJEITO] + [AÇÃO] + [AMBIENTE] + [ILUMINAÇÃO] + [ESTILO/MOOD]
4. Inclua qualificadores cinematográficos: "shot on 35mm film", "golden hour", "shallow depth of field", "anamorphic lens flare", "color graded teal and orange"
5. NUNCA mencione textos sobrepostos, logos ou marcas escritas
6. Evite ambiguidade — seja específico em cada elemento

REGRAS PARA narracao:
- PT-BR, frases curtas (max 15 palavras por cena)
- Sincronize ritmo com duracao_segundos (~2.5 palavras/segundo)
- Pode ser vazio em cenas puramente visuais

ESTRUTURA NARRATIVA (siga esta arc):
- Cena 1: HOOK visual impactante (3-5s)
- Cenas intermediárias: desenvolvimento do conceito/produto
- Cena final: CTA visual + texto

Use a função gerar_roteiro_cinematografico para retornar o roteiro estruturado.`;
}

function buildUserMessage(fontes: FonteInput[], briefing: BriefingInput): string {
  const fontesTexto = fontes
    .map((f, i) => {
      const header = `--- FONTE ${i + 1}: ${f.titulo || f.tipo} (${f.tipo}) ---`;
      const conteudo = f.conteudo.slice(0, 8000); // cap por fonte
      return `${header}\n${conteudo}`;
    })
    .join("\n\n");

  return `TEMA DO VÍDEO: ${briefing.tema}

FONTES PARA INSPIRAÇÃO E CONTEÚDO:

${fontesTexto || "(Nenhuma fonte adicional — use apenas o tema acima)"}

Gere o roteiro cinematográfico estruturado seguindo as diretrizes do sistema.`;
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 10, rateLimitPrefix: "roteirista-ia" },
  async (req, ctx) => {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const userId = ctx.userId!;
    const body = await req.json();
    const fontes: FonteInput[] = Array.isArray(body.fontes) ? body.fontes : [];
    const briefing: BriefingInput = body.briefing || {};
    const roteiroId: string | undefined = body.roteiro_id;

    if (!briefing.tema || briefing.tema.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Briefing inválido: 'tema' é obrigatório (min 5 chars)" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const model = body.model || "google/gemini-2.5-pro";
    const systemPrompt = buildSystemPrompt(briefing);
    const userMessage = buildUserMessage(fontes, briefing);

    logger.log("[roteirista-ia] Gerando roteiro:", {
      userId,
      tema: briefing.tema.slice(0, 80),
      n_fontes: fontes.length,
      model,
    });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [ROTEIRO_TOOL],
        tool_choice: { type: "function", function: { name: "gerar_roteiro_cinematografico" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      logger.error("[roteirista-ia] AI Gateway error:", aiRes.status, errText);

      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos." }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Falha na geração: ${aiRes.status}` }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      logger.error("[roteirista-ia] Sem tool_call na resposta:", JSON.stringify(aiData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "IA não retornou roteiro estruturado. Tente novamente." }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    let roteiro;
    try {
      roteiro = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      logger.error("[roteirista-ia] JSON inválido do tool_call:", e);
      return new Response(
        JSON.stringify({ error: "Roteiro retornado em formato inválido" }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Persistir no banco
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let savedId = roteiroId;
    if (roteiroId) {
      // Atualiza roteiro existente
      const { error } = await supabase
        .from("roteiros_cinematograficos")
        .update({
          titulo: roteiro.titulo || briefing.tema,
          sinopse: roteiro.sinopse || null,
          briefing,
          fontes: fontes.map(f => ({ tipo: f.tipo, titulo: f.titulo, tamanho: f.conteudo.length })),
          roteiro,
          modelo_usado: model,
        })
        .eq("id", roteiroId)
        .eq("user_id", userId);
      if (error) logger.error("[roteirista-ia] erro ao atualizar:", error);
    } else {
      const { data, error } = await supabase
        .from("roteiros_cinematograficos")
        .insert({
          user_id: userId,
          titulo: roteiro.titulo || briefing.tema,
          sinopse: roteiro.sinopse || null,
          briefing,
          fontes: fontes.map(f => ({ tipo: f.tipo, titulo: f.titulo, tamanho: f.conteudo.length })),
          roteiro,
          status: "rascunho",
          modelo_usado: model,
        })
        .select("id")
        .single();
      if (error) {
        logger.error("[roteirista-ia] erro ao salvar:", error);
      } else {
        savedId = data.id;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        roteiro_id: savedId,
        roteiro,
        modelo_usado: model,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
));
