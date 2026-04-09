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
- GET /status — Health check
- GET /consultar — Consultar título por ID/código integração
- POST /sync — Sincronização
- GET /listar — Listagem paginada (max 500/página)
- POST /incluir — Incluir título
- PUT /alterar — Alterar título
- DELETE /excluir — Excluir título
- POST /upsert — Upsert unitário
- POST /upsert-lote — Upsert em lote (max 500)
- POST /lancar-recebimento — Lançar recebimento
- POST /cancelar-recebimento — Cancelar recebimento
- POST /conciliar — Conciliar título
- POST /desconciliar — Desconciliar título
- POST /cancelar — Cancelar título

### Clientes API (clientes-api)
- POST /sync — Sincronização
- POST /upsert-lote — Upsert em lote
- GET /listar — Listagem paginada
- POST /incluir — Incluir cliente
- POST /alterar — Alterar cliente
- POST /excluir — Excluir cliente

### Export API (contas-pagar-export-api)
- GET /pending — Títulos pendentes
- GET /paid — Títulos pagos
- POST /confirm — Confirmar exportação

### Contas Correntes API (contas-correntes-api)
- GET / — Listar contas correntes
- GET /resumo — Resumo financeiro
- POST /incluir — Incluir conta corrente
- PUT /alterar — Alterar conta corrente
- DELETE /excluir — Excluir conta corrente
- POST /upsert — Upsert unitário
- POST /upsert-lote — Upsert em lote

### Lançamentos CC API (lancamentos-cc-api)
- GET / — Listar lançamentos
- POST /incluir — Incluir lançamento
- PUT /alterar — Alterar lançamento
- DELETE /excluir — Excluir lançamento
- GET /extrato — Extrato de conta corrente

### Boletos API (boletos-api)
- POST /gerar — Gerar boleto
- GET /obter — Obter boleto
- POST /cancelar — Cancelar boleto
- POST /prorrogar — Prorrogar vencimento
- GET /listar — Listar boletos

### Anexos API (anexos-api)
- POST /incluir — Incluir anexo (base64)
- GET /consultar — Consultar anexos
- GET /obter — Download de anexo
- DELETE /excluir — Excluir anexo

### Webhook Subscriptions API
- POST /incluir — Criar assinatura webhook
- PUT /alterar — Alterar assinatura
- DELETE /excluir — Excluir assinatura
- POST /testar — Testar webhook

---

## Autenticação

Todas as APIs aceitam dois métodos:
1. **API Key** via header \`x-api-key: SUA_CHAVE\` (para ERP/server-to-server)
2. **JWT Bearer** via header \`Authorization: Bearer <token>\` (para usuários autenticados)

### Fluxo de autenticação passo a passo:
1. Obtenha sua API Key no Portal ERP (menu Configurações > APIs)
2. Adicione o header \`x-api-key\` em todas as requisições
3. Para JWT: faça login via Supabase Auth e use o access_token retornado

---

## Schemas — Campos Obrigatórios por Endpoint

### CP /incluir (Contas a Pagar)
\`\`\`json
{
  "codigo_lancamento_integracao": "string (obrigatório, seu ID externo, max 100)",
  "codigo_cliente_fornecedor": "number (obrigatório, código do fornecedor)",
  "data_vencimento": "string (obrigatório, DD/MM/YYYY ou YYYY-MM-DD)",
  "valor_documento": "number (obrigatório)",
  "codigo_categoria": "string (obrigatório, ex: '2.04.01')",
  "data_previsao": "string (obrigatório)",
  "id_conta_corrente": "number (obrigatório)"
}
\`\`\`

### CR /incluir (Contas a Receber)
\`\`\`json
{
  "codigo_lancamento_integracao": "string (obrigatório, max 100)",
  "codigo_cliente_fornecedor": "string|number (opcional)",
  "data_vencimento": "string (opcional, DD/MM/YYYY ou YYYY-MM-DD)",
  "valor_documento": "number (opcional)",
  "codigo_categoria": "string (opcional, max 100)",
  "data_previsao": "string (opcional)",
  "empresa_id": "string|number (opcional)",
  "observacao": "string (opcional, max 2000)"
}
\`\`\`
⚠️ Schemas usam \`.strict()\` — campos extras são REJEITADOS com erro 400.

### CR /lancar-recebimento
\`\`\`json
{
  "codigo_lancamento_integracao": "string (obrigatório)",
  "valor": "number (obrigatório, positivo)",
  "data": "string (opcional)",
  "desconto": "number (opcional, min 0)",
  "juros": "number (opcional, min 0)",
  "multa": "number (opcional, min 0)",
  "observacao": "string (opcional, max 2000)"
}
\`\`\`

### /upsert-lote (CP e CR)
\`\`\`json
{
  "lote": 1,
  "conta_pagar_cadastro": [ { ...campos do /incluir, máx 500 itens } ]
}
\`\`\`

---

## Exemplos Completos de Request/Response

### Incluir CP — Sucesso
\`\`\`
POST /contas-pagar-api/incluir
x-api-key: SUA_CHAVE
Content-Type: application/json

{
  "codigo_lancamento_integracao": "CP-001",
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "2.04.01",
  "data_previsao": "21/03/2026",
  "id_conta_corrente": 4243124
}

→ 201:
{
  "codigo_lancamento_huggs": null,
  "codigo_lancamento_integracao": "CP-001",
  "codigo_status": "0",
  "descricao_status": "Cadastro incluído com sucesso!"
}
\`\`\`

### Incluir CP — Duplicado
\`\`\`
→ 409:
{
  "codigo_lancamento_integracao": "CP-001",
  "codigo_status": "3",
  "descricao_status": "Registro já existe. Use /upsert ou /alterar."
}
\`\`\`

### Payload Inválido (campo extra rejeitado pelo .strict())
\`\`\`
→ 400:
{
  "error": "Payload inválido",
  "details": { "": ["Unrecognized key(s) in object: 'campo_invalido'"] }
}
\`\`\`

### Recebimento CR — Sucesso
\`\`\`
POST /contas-receber-api/lancar-recebimento
{
  "codigo_lancamento_integracao": "CR-001",
  "valor": 100.20,
  "desconto": 0,
  "juros": 0,
  "multa": 0,
  "data": "21/03/2026",
  "observacao": "Baixa via API"
}

→ 200:
{
  "codigo_lancamento_integracao": "CR-001",
  "codigo_baixa": "uuid",
  "liquidado": "S",
  "valor_baixado": 100.20,
  "codigo_status": "0",
  "descricao_status": "Recebimento registrado com sucesso!"
}
\`\`\`

---

## Códigos de Erro Detalhados

| Status | Código | Descrição | Ação Recomendada |
|--------|--------|-----------|------------------|
| 400 | — | Payload inválido (Zod validation) | Verifique campos obrigatórios e tipos |
| 401 | — | API Key inválida ou JWT expirado | Gere nova chave ou faça novo login |
| 403 | — | Sem permissão para esta operação | Verifique permissões da API Key |
| 404 | — | Registro não encontrado | Verifique o ID ou codigo_lancamento_integracao |
| 409 | 3 | Registro duplicado | Use /upsert em vez de /incluir |
| 413 | — | Lote excede 500 registros | Divida em lotes menores |
| 429 | — | Rate limit excedido | Aguarde e respeite header Retry-After |
| 500 | — | Erro interno do servidor | Tente novamente; se persistir, contate suporte |

---

## Rate Limiting

- **Contas a Pagar**: 60 req/min por empresa ou usuário
- **Contas a Receber**: 60 req/min por empresa ou usuário
- **Geral operacional**: 100 req/min
- **APIs de IA**: 20 req/min
- Header \`Retry-After\` indica quando tentar novamente

---

## Webhook Events

Eventos disparados automaticamente:
- \`conta_pagar.incluida\` — Novo título CP criado
- \`conta_pagar.alterada\` — Título CP alterado
- \`conta_pagar.excluida\` — Título CP inativado
- \`conta_pagar.pagamento\` — Baixa de pagamento registrada
- \`conta_receber.incluida\` — Novo título CR criado
- \`conta_receber.recebimento\` — Recebimento registrado

Formato do webhook:
\`\`\`json
{
  "event_type": "conta_pagar.incluida",
  "timestamp": "2026-04-09T10:00:00Z",
  "data": { "id": "uuid", "codigo_lancamento_integracao": "CP-001" }
}
\`\`\`

---

## Formato de Datas
Aceita ISO 8601 (YYYY-MM-DD) e formatos brasileiros (DD/MM/YYYY).

## Paginação
Padrão Huggs: \`{ pagina: 1, registros_por_pagina: 50 }\`
Padrão REST: query params \`?offset=0&limit=50\`
Máximo: 500 registros por página.
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

    // Validate JWT - any authenticated user
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

    const body = await req.json();
    const { message_id, user_message, endpoint_path, mode, conversation_history } = body;
    // mode: "inline" = user chatbot (any authenticated), "admin" = admin panel (admin only)

    if (mode === 'admin') {
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
    }

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

    const systemPrompt = `Você é o assistente técnico mais avançado do Portal de APIs ERP do sistema BiMaster/Union CRM (Portal Huggs).
Você tem conhecimento COMPLETO de todas as APIs, schemas, autenticação, webhooks, rate limits e erros.
Responda SEMPRE em português brasileiro, de forma técnica mas acessível a desenvolvedores.
Use exemplos de código (curl, JavaScript, Python) quando relevante.
Seja direto, preciso e completo. Formate a resposta em Markdown.

${API_DOCS_CONTEXT}

O endpoint em discussão é: ${endpoint_path || 'geral'}

Regras:
- Não invente endpoints que não existem na documentação acima
- Sugira soluções práticas com exemplos de código completos
- Se não souber a resposta, diga claramente e sugira contatar o admin
- Para erros, mostre o payload correto e headers necessários
- Inclua exemplos de tratamento de erro
- Quando relevante, mencione rate limits e boas práticas
- Se a dúvida for sobre campos obrigatórios, liste o schema Zod completo
- Para webhooks, explique o formato do evento e como configurar`;

    // Build messages array with conversation history
    const messages: Array<{role: string; content: string}> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history if provided
    if (Array.isArray(conversation_history) && conversation_history.length > 0) {
      // Limit to last 20 messages to avoid token overflow
      const recentHistory = conversation_history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role && msg.content) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add the current user message
    messages.push({ role: 'user', content: user_message });

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages,
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

    // Save suggestion to the message if message_id provided (admin mode)
    if (message_id && mode === 'admin') {
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
