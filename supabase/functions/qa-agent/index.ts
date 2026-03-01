import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://bimaster.lovable.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de todas as rotas do sistema
const SYSTEM_ROUTES = [
  { path: "/dashboard", name: "Dashboard Principal", module: "core" },
  { path: "/prospects", name: "Prospects", module: "comercial" },
  { path: "/prospects/new", name: "Novo Prospect", module: "comercial" },
  { path: "/marketing", name: "Marketing", module: "marketing" },
  { path: "/marketing/dashboard", name: "Marketing Dashboard", module: "marketing" },
  { path: "/marketing/campanhas", name: "Campanhas", module: "marketing" },
  { path: "/trade", name: "Trade Marketing", module: "trade" },
  { path: "/trade/dashboard", name: "Trade Dashboard", module: "trade" },
  { path: "/trade/roteiros", name: "Roteiros", module: "trade" },
  { path: "/fabrica", name: "Fábrica", module: "fabrica" },
  { path: "/fabrica/producao", name: "Produção", module: "fabrica" },
  { path: "/fabrica/estoque", name: "Estoque", module: "fabrica" },
  { path: "/financeiro", name: "Financeiro", module: "financeiro" },
  { path: "/financeiro/contas-a-receber", name: "Contas a Receber", module: "financeiro" },
  { path: "/financeiro/contas-a-pagar", name: "Contas a Pagar", module: "financeiro" },
  { path: "/financeiro/fluxo-caixa", name: "Fluxo de Caixa", module: "financeiro" },
  { path: "/crm", name: "CRM", module: "crm" },
  { path: "/crm/clientes", name: "Clientes", module: "crm" },
  { path: "/crm/cobranca", name: "Cobrança", module: "crm" },
  { path: "/relatorios", name: "Relatórios", module: "relatorios" },
  { path: "/configuracoes", name: "Configurações", module: "admin" },
];

// Lista de Edge Functions
const EDGE_FUNCTIONS = [
  { name: "ai-analytics", description: "Analytics com IA" },
  { name: "marketing-insights", description: "Insights de Marketing" },
  { name: "n8n-contas-receber", description: "Sync Contas Receber via N8N" },
  { name: "n8n-contas-pagar", description: "Sync Contas Pagar via N8N" },
  { name: "geocode-address", description: "Geocodificação de Endereços" },
  { name: "padronizar-nome-cliente", description: "Padronização de Nomes" },
  { name: "padronizar-municipio", description: "Padronização de Municípios" },
  { name: "generate-product-creative", description: "Geração de Criativos" },
  { name: "pollo-check-status", description: "Status Pollo AI" },
  { name: "pollo-analyze-website", description: "Análise de Website" },
  { name: "get-mapbox-token", description: "Token Mapbox" },
  { name: "social-media-metrics", description: "Métricas Redes Sociais" },
  { name: "sync-all-accounts", description: "Sync Todas Contas" },
  { name: "datawarehouse-api", description: "API Data Warehouse" },
  { name: "process-photo-analysis-queue", description: "Análise de Fotos" },
];

// Tabelas principais do sistema
const MAIN_TABLES = [
  "profiles", "prospects", "atividades", "clientes", "vendas", "itens_venda",
  "contas_receber", "contas_pagar", "cobrancas", "departamentos",
  "stores", "visits", "photos", "products", "competitors",
  "ads_accounts", "ads_campaigns", "ads_metrics", "social_media_accounts",
  "notifications", "user_permissions", "planos", "assinaturas"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, sessionId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Definição das ferramentas disponíveis para o agente
    const tools = [
      {
        type: "function",
        function: {
          name: "listar_rotas",
          description: "Lista todas as rotas/páginas do sistema e seus módulos",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "listar_edge_functions",
          description: "Lista todas as Edge Functions disponíveis no backend",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "verificar_tabela",
          description: "Verifica estrutura e quantidade de registros de uma tabela",
          parameters: {
            type: "object",
            properties: {
              table_name: { type: "string", description: "Nome da tabela a verificar" }
            },
            required: ["table_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_estatisticas_db",
          description: "Retorna estatísticas gerais do banco de dados",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "verificar_erros_recentes",
          description: "Busca erros e falhas recentes no sistema",
          parameters: {
            type: "object",
            properties: {
              horas: { type: "number", description: "Últimas X horas para buscar", default: 24 }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "testar_edge_function",
          description: "Testa uma Edge Function específica",
          parameters: {
            type: "object",
            properties: {
              function_name: { type: "string", description: "Nome da função a testar" }
            },
            required: ["function_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "verificar_integridade_dados",
          description: "Verifica integridade referencial e dados órfãos",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "gerar_relatorio_qa",
          description: "Gera um relatório completo de qualidade do sistema",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "registrar_problema",
          description: "Registra um problema encontrado para acompanhamento",
          parameters: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
              category: { type: "string" },
              description: { type: "string" },
              suggested_fix: { type: "string" }
            },
            required: ["severity", "category", "description"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "listar_problemas_abertos",
          description: "Lista todos os problemas registrados que ainda estão abertos",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "verificar_sincronizacoes",
          description: "Verifica status das sincronizações com sistemas externos (N8N, etc)",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_metricas_sistema",
          description: "Retorna métricas de uso do sistema (usuários ativos, operações, etc)",
          parameters: { type: "object", properties: {}, required: [] }
        }
      }
    ];

    // Função para executar as ferramentas
    async function executeTool(name: string, args: any): Promise<any> {
      const startTime = Date.now();
      
      switch (name) {
        case "listar_rotas":
          return {
            total: SYSTEM_ROUTES.length,
            routes: SYSTEM_ROUTES,
            by_module: SYSTEM_ROUTES.reduce((acc, r) => {
              acc[r.module] = (acc[r.module] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          };

        case "listar_edge_functions":
          return {
            total: EDGE_FUNCTIONS.length,
            functions: EDGE_FUNCTIONS
          };

        case "verificar_tabela": {
          const { table_name } = args;
          try {
            const { count, error } = await supabase
              .from(table_name)
              .select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            
            return {
              table: table_name,
              record_count: count,
              status: "ok",
              checked_at: new Date().toISOString()
            };
          } catch (e: any) {
            return {
              table: table_name,
              status: "error",
              error: e.message
            };
          }
        }

        case "consultar_estatisticas_db": {
          const stats: any = { tables: [], total_records: 0 };
          
          for (const table of MAIN_TABLES) {
            try {
              const { count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
              
              stats.tables.push({ name: table, count: count || 0 });
              stats.total_records += count || 0;
            } catch (e) {
              stats.tables.push({ name: table, count: 0, error: "Não acessível" });
            }
          }
          
          return stats;
        }

        case "verificar_erros_recentes": {
          const horas = args.horas || 24;
          const since = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
          
          // Busca logs de sync com erro
          const { data: syncLogs } = await supabase
            .from('sync_logs')
            .select('*')
            .eq('status', 'error')
            .gte('started_at', since)
            .order('started_at', { ascending: false })
            .limit(20);
          
          // Busca logs de API com erro
          const { data: apiLogs } = await supabase
            .from('api_security_log')
            .select('*')
            .eq('success', false)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(20);

          return {
            periodo: `Últimas ${horas} horas`,
            sync_errors: syncLogs || [],
            api_errors: apiLogs || [],
            total_errors: (syncLogs?.length || 0) + (apiLogs?.length || 0)
          };
        }

        case "testar_edge_function": {
          const { function_name } = args;
          const funcInfo = EDGE_FUNCTIONS.find(f => f.name === function_name);
          
          if (!funcInfo) {
            return { status: "error", message: `Função ${function_name} não encontrada` };
          }

          try {
            const testStart = Date.now();
            const response = await fetch(
              `${SUPABASE_URL}/functions/v1/${function_name}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({ test: true })
              }
            );
            
            const duration = Date.now() - testStart;
            
            return {
              function: function_name,
              status: response.ok ? "ok" : "error",
              http_status: response.status,
              duration_ms: duration,
              description: funcInfo.description
            };
          } catch (e: any) {
            return {
              function: function_name,
              status: "error",
              error: e.message
            };
          }
        }

        case "verificar_integridade_dados": {
          const issues: any[] = [];
          
          // Verifica prospects sem vendedor
          const { count: orphanProspects } = await supabase
            .from('prospects')
            .select('*', { count: 'exact', head: true })
            .is('vendedor_id', null);
          
          if (orphanProspects && orphanProspects > 0) {
            issues.push({
              type: "orphan_data",
              table: "prospects",
              description: `${orphanProspects} prospects sem vendedor atribuído`
            });
          }
          
          // Verifica contas receber sem cliente
          const { count: orphanContas } = await supabase
            .from('contas_receber')
            .select('*', { count: 'exact', head: true })
            .is('cliente_codigo', null);
          
          if (orphanContas && orphanContas > 0) {
            issues.push({
              type: "orphan_data",
              table: "contas_receber",
              description: `${orphanContas} contas sem cliente associado`
            });
          }

          return {
            checked_at: new Date().toISOString(),
            issues_found: issues.length,
            issues
          };
        }

        case "gerar_relatorio_qa": {
          // Coleta todas as estatísticas
          const dbStats = await executeTool("consultar_estatisticas_db", {});
          const errors = await executeTool("verificar_erros_recentes", { horas: 24 });
          const integrity = await executeTool("verificar_integridade_dados", {});
          
          const { data: openIssues } = await supabase
            .from('qa_issues')
            .select('*')
            .eq('status', 'open');

          return {
            generated_at: new Date().toISOString(),
            summary: {
              total_tables: dbStats.tables.length,
              total_records: dbStats.total_records,
              total_routes: SYSTEM_ROUTES.length,
              total_edge_functions: EDGE_FUNCTIONS.length,
              errors_last_24h: errors.total_errors,
              integrity_issues: integrity.issues_found,
              open_qa_issues: openIssues?.length || 0
            },
            database: dbStats,
            recent_errors: errors,
            integrity: integrity,
            open_issues: openIssues
          };
        }

        case "registrar_problema": {
          const { severity, category, description, suggested_fix } = args;
          
          const { data, error } = await supabase
            .from('qa_issues')
            .insert({
              severity,
              category,
              description,
              suggested_fix,
              status: 'open'
            })
            .select()
            .single();
          
          if (error) throw error;
          
          return {
            registered: true,
            issue_id: data.id,
            message: "Problema registrado com sucesso"
          };
        }

        case "listar_problemas_abertos": {
          const { data: issues } = await supabase
            .from('qa_issues')
            .select('*')
            .eq('status', 'open')
            .order('severity', { ascending: true });
          
          return {
            total: issues?.length || 0,
            issues: issues || []
          };
        }

        case "verificar_sincronizacoes": {
          const { data: recentSyncs } = await supabase
            .from('sync_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(10);
          
          const summary = {
            total_syncs: recentSyncs?.length || 0,
            successful: recentSyncs?.filter(s => s.status === 'completed').length || 0,
            failed: recentSyncs?.filter(s => s.status === 'error').length || 0,
            running: recentSyncs?.filter(s => s.status === 'running').length || 0
          };
          
          return {
            summary,
            recent_syncs: recentSyncs
          };
        }

        case "consultar_metricas_sistema": {
          // Usuários ativos (logaram nos últimos 7 dias)
          const { count: activeUsers } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('ultimo_acesso', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
          
          // Total de prospects este mês
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const { count: newProspects } = await supabase
            .from('prospects')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth.toISOString());
          
          // Atividades hoje
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const { count: todayActivities } = await supabase
            .from('atividades')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());

          return {
            active_users_7d: activeUsers || 0,
            new_prospects_month: newProspects || 0,
            activities_today: todayActivities || 0,
            checked_at: new Date().toISOString()
          };
        }

        default:
          return { error: `Ferramenta ${name} não implementada` };
      }
    }

    // System prompt para o agente QA
    const systemPrompt = `Você é o **Agente de QA (Quality Assurance)** do sistema BiMaster/Union CRM. Sua função é testar todas as funcionalidades do sistema, identificar problemas e sugerir correções.

## Suas Capacidades

Você tem acesso às seguintes ferramentas:

1. **listar_rotas** - Lista todas as páginas/rotas do sistema
2. **listar_edge_functions** - Lista todas as funções backend
3. **verificar_tabela** - Verifica estrutura e dados de uma tabela específica
4. **consultar_estatisticas_db** - Estatísticas gerais do banco de dados
5. **verificar_erros_recentes** - Busca erros das últimas X horas
6. **testar_edge_function** - Testa uma função backend específica
7. **verificar_integridade_dados** - Verifica dados órfãos e problemas de integridade
8. **gerar_relatorio_qa** - Gera relatório completo de qualidade
9. **registrar_problema** - Registra um problema encontrado
10. **listar_problemas_abertos** - Lista problemas ainda não resolvidos
11. **verificar_sincronizacoes** - Status das sincronizações com sistemas externos
12. **consultar_metricas_sistema** - Métricas de uso do sistema

## Comandos Especiais

Quando o usuário digitar:
- **/testar-tudo** ou **testar tudo** - Execute uma bateria completa de testes
- **/relatorio** ou **relatório** - Gere um relatório de QA
- **/problemas** - Liste os problemas abertos
- **/testar [módulo]** - Teste um módulo específico (financeiro, marketing, trade, etc)

## Diretrizes

1. Seja proativo na identificação de problemas
2. Sempre explique o que está testando e por quê
3. Forneça sugestões de correção quando encontrar problemas
4. Use emojis para indicar status: ✅ OK, ⚠️ Warning, ❌ Erro, 🔄 Testando
5. Organize os resultados de forma clara com tabelas quando apropriado
6. Registre problemas críticos automaticamente usando registrar_problema

## Módulos do Sistema

- **core**: Dashboard, autenticação, configurações
- **comercial**: Prospects, vendas, atividades
- **marketing**: Campanhas, social media, analytics
- **trade**: Lojas, visitas, fotos, roteiros
- **fabrica**: Produção, estoque, pedidos
- **financeiro**: Contas a receber/pagar, fluxo de caixa, cobrança
- **crm**: Clientes, cobrança, score de crédito
- **relatorios**: Relatórios gerenciais

Você está pronto para ajudar a testar e melhorar o sistema!`;

    // Chamada inicial à API
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        tools,
        tool_choice: "auto",
        stream: true
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    // Criar um TransformStream para processar e passar o stream adiante
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Processar streaming em background
    (async () => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let toolCalls: any[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Passar chunk para o cliente
          await writer.write(value);
          
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              
              try {
                const parsed = JSON.parse(data);
                const choice = parsed.choices?.[0];
                
                if (choice?.delta?.content) {
                  fullContent += choice.delta.content;
                }
                
                if (choice?.delta?.tool_calls) {
                  for (const tc of choice.delta.tool_calls) {
                    if (tc.index !== undefined) {
                      if (!toolCalls[tc.index]) {
                        toolCalls[tc.index] = { id: tc.id, function: { name: "", arguments: "" } };
                      }
                      if (tc.function?.name) {
                        toolCalls[tc.index].function.name = tc.function.name;
                      }
                      if (tc.function?.arguments) {
                        toolCalls[tc.index].function.arguments += tc.function.arguments;
                      }
                    }
                  }
                }
                
                if (choice?.finish_reason === "tool_calls") {
                  // Executar tool calls
                  const toolResults: any[] = [];
                  
                  for (const tc of toolCalls) {
                    if (tc && tc.function?.name) {
                      const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
                      console.log(`Executing tool: ${tc.function.name}`, args);
                      const result = await executeTool(tc.function.name, args);
                      toolResults.push({
                        tool_call_id: tc.id,
                        role: "tool",
                        content: JSON.stringify(result)
                      });
                    }
                  }
                  
                  // Segunda chamada com resultados das ferramentas
                  const secondMessages = [
                    { role: "system", content: systemPrompt },
                    ...messages,
                    { role: "assistant", content: fullContent, tool_calls: toolCalls.filter(Boolean) },
                    ...toolResults
                  ];
                  
                  const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash",
                      messages: secondMessages,
                      stream: true
                    }),
                  });
                  
                  if (secondResponse.ok && secondResponse.body) {
                    const secondReader = secondResponse.body.getReader();
                    while (true) {
                      const { done: done2, value: value2 } = await secondReader.read();
                      if (done2) break;
                      await writer.write(value2);
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } catch (error) {
        console.error("Stream processing error:", error);
      } finally {
        await writer.close();
      }
    })();

    // Retornar o readable stream imediatamente
    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" }
    });

  } catch (error) {
    console.error("QA Agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
