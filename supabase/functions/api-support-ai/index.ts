import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const API_DOCS_CONTEXT = `
## APIs Disponíveis no Portal ERP (Huggs)

### Contas a Pagar API (contas-pagar-api)
Endpoints:
- GET /status — Health check
- POST /sync — Sincronização em massa (legado)
- POST /bulk-sync — Sincronização em massa com rate limiting
- POST /sync-chunk — Chunk de sincronização
- POST /sync-complete — Finalizar sincronização
- GET /chunks-progress — Progresso dos chunks
- GET /last-sync — Última sincronização
- GET /stats — Estatísticas
- POST /incluir — Incluir título (Huggs-style)
- PUT /alterar — Alterar título
- DELETE /excluir — Excluir (inativar) título
- POST /upsert — Upsert unitário
- POST /upsert-lote — Upsert em lote (max 500)
- POST /lancar-pagamento — Lançar baixa
- POST /cancelar-pagamento — Cancelar baixa
- GET /listar — Listagem paginada

### Contas a Receber API (contas-receber-api)
- POST /sync — Sincronização
- GET /listar — Listagem paginada
- POST /incluir — Incluir título
- PUT /alterar — Alterar título
- DELETE /excluir — Excluir título

### Clientes API (clientes-api)
- POST /sync — Sincronização
- POST /upsert-lote — Upsert em lote
- GET /listar — Listagem paginada

### Export API (contas-pagar-export-api)
- GET /pending — Títulos pendentes
- GET /paid — Títulos pagos
- POST /confirm — Confirmar exportação

## Autenticação
Todas as APIs aceitam:
1. API Key via header "x-api-key"
2. JWT Bearer token via header "Authorization"

## Formato de Datas
Aceita ISO 8601 (YYYY-MM-DD) e formatos brasileiros (DD/MM/YYYY).

## Erros Comuns
- 401: Chave inválida ou expirada
- 409: Registro duplicado (use /upsert)
- 413: Lote excede 500 registros
- 429: Rate limit excedido (aguarde)
- 404: Registro não encontrado
`;

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate JWT - admin only
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { message_id, user_message, endpoint_path } = body;

    if (!user_message) {
      return new Response(JSON.stringify({ error: 'user_message is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `Você é um assistente técnico especializado nas APIs de integração ERP do sistema BiMaster/Union CRM.
Responda SEMPRE em português brasileiro, de forma técnica mas acessível a desenvolvedores.
Use exemplos de código (curl, JavaScript) quando relevante.
Seja direto e objetivo.

${API_DOCS_CONTEXT}

O endpoint em discussão é: ${endpoint_path || 'geral'}

Regras:
- Não invente endpoints que não existem
- Sugira soluções práticas com exemplos de código
- Se não souber a resposta, diga claramente
- Formate a resposta em Markdown`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: user_message },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido, tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResponse.json();
    const suggestion = aiData.choices?.[0]?.message?.content || 'Sem resposta gerada.';

    // Save suggestion to the message if message_id provided
    if (message_id) {
      await supabase
        .from('api_support_messages')
        .update({ ai_suggested_reply: suggestion })
        .eq('id', message_id);
    }

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('api-support-ai error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
