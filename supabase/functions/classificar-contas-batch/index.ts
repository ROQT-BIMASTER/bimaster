import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GroupToClassify {
  categoria_nome: string;
  fornecedor_nome: string | null;
  tipo_documento: string | null;
  count: number;
}

interface ClassificationResult {
  categoria_nome: string;
  fornecedor_nome: string | null;
  tipo_documento: string | null;
  departamento_id: string | null;
  departamento_nome: string | null;
  plano_contas_id: string | null;
  plano_contas_nome: string | null;
  plano_contas_codigo: string | null;
  confianca_classificacao: number;
  classificacao_justificativa: string;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar variáveis de ambiente primeiro
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente Supabase não configuradas");
    }

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const { groups } = await req.json() as { groups: GroupToClassify[] };

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      throw new Error("Lista de grupos inválida ou vazia");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Buscar contexto UMA VEZ
    console.log("Buscando contexto (departamentos e plano de contas)...");
    
    const { data: departamentos, error: deptError } = await supabase
      .from("departamentos")
      .select("id, nome, descricao")
      .eq("ativo", true)
      .order("nome");

    if (deptError) {
      throw new Error(`Erro ao buscar departamentos: ${deptError.message}`);
    }

    const { data: planoContas, error: planoError } = await supabase
      .from("trade_chart_of_accounts")
      .select("id, code, name, account_type")
      .order("code");

    if (planoError) {
      throw new Error(`Erro ao buscar plano de contas: ${planoError.message}`);
    }

    console.log(`Contexto carregado: ${departamentos.length} departamentos, ${planoContas.length} contas`);

    const results: ClassificationResult[] = [];

    for (const group of groups) {
      try {
        console.log(`Processando grupo: ${group.categoria_nome} | ${group.fornecedor_nome} | ${group.tipo_documento} (${group.count} contas)`);

        // Verificar se existe regra aprendida
        const { data: existingRule } = await supabase
          .from("account_classification_rules")
          .select("*")
          .eq("categoria_nome", group.categoria_nome)
          .eq("fornecedor_nome", group.fornecedor_nome || "")
          .eq("tipo_documento", group.tipo_documento || "")
          .maybeSingle();

        if (existingRule) {
          console.log("✓ Regra aprendida encontrada, aplicando...");
          
          // Atualizar uso da regra
          await supabase
            .from("account_classification_rules")
            .update({
              times_used: (existingRule.times_used || 0) + group.count,
              last_used_at: new Date().toISOString()
            })
            .eq("id", existingRule.id);

          results.push({
            categoria_nome: group.categoria_nome,
            fornecedor_nome: group.fornecedor_nome,
            tipo_documento: group.tipo_documento,
            departamento_id: existingRule.departamento_id,
            departamento_nome: departamentos.find(d => d.id === existingRule.departamento_id)?.nome || null,
            plano_contas_id: existingRule.plano_contas_id,
            plano_contas_nome: planoContas.find(p => p.id === existingRule.plano_contas_id)?.name || null,
            plano_contas_codigo: planoContas.find(p => p.id === existingRule.plano_contas_id)?.code || null,
            confianca_classificacao: existingRule.confidence_score || 0.95,
            classificacao_justificativa: "Classificação baseada em regra aprendida anteriormente",
            success: true
          });
          continue;
        }

        // Não existe regra, chamar IA
        console.log("✗ Regra não encontrada, consultando IA...");

        const systemPrompt = `Você é um especialista em classificação contábil e financeira.
Sua tarefa é classificar contas a pagar nos departamentos e contas contábeis corretos.

DEPARTAMENTOS DISPONÍVEIS:
${departamentos.map(d => `- ID: ${d.id} | ${d.nome}${d.descricao ? ` (${d.descricao})` : ''}`).join('\n')}

PLANO DE CONTAS DISPONÍVEL:
${planoContas.map(p => `- ID: ${p.id} | ${p.code} - ${p.name} [Tipo: ${p.account_type}]`).join('\n')}

INSTRUÇÕES CRÍTICAS:
1. Use EXATAMENTE o nome da conta conforme listado acima no campo "plano_contas_nome"
2. Se não encontrar conta específica, escolha a conta de GRUPO (nível superior) mais relacionada
3. NUNCA invente nomes de contas que não existem na lista

GUIA DE CLASSIFICAÇÃO POR TIPO:
- revenue: Receitas de vendas, serviços prestados
- expense: Despesas operacionais gerais (administrativas, comerciais)
- cost_center: Custos de produção, centros de custo
- budget: Orçamentos e previsões
- asset: Investimentos em ativos, imobilizado
- liability: Obrigações, empréstimos, financiamentos

MAPEAMENTOS ESPECÍFICOS:
- Comissões → "6.1.07 - Comissão de Vendedores" [expense]
- Salários → Departamento RH + conta adequada do grupo 6.2
- Materiais de produção → grupo 5 [cost_center]
- Aluguel, água, luz → "6.2 - DESPESAS ADMINISTRATIVAS" [expense]
- Impostos → conta específica de impostos do grupo adequado

Retorne SEMPRE um JSON válido com esta estrutura:
{
  "departamento_nome": "nome EXATO do departamento da lista",
  "plano_contas_nome": "nome EXATO da conta da lista",
  "confianca": 0.95,
  "justificativa": "breve explicação"
}`;

        const userPrompt = `Classifique esta conta a pagar:
Categoria: ${group.categoria_nome}
Fornecedor: ${group.fornecedor_nome || 'N/A'}
Tipo Documento: ${group.tipo_documento || 'N/A'}

Escolha o departamento e conta contábil mais adequados.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.3
          })
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error("Erro na IA:", aiResponse.status, errorText);
          throw new Error(`Erro na IA: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error("Resposta da IA vazia");
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("JSON não encontrado na resposta da IA");
        }

        const classification = JSON.parse(jsonMatch[0]);

        // Mapear nomes para IDs com busca flexível
        const dept = departamentos.find(d => 
          d.nome.toLowerCase() === classification.departamento_nome?.toLowerCase()
        );
        
        // Busca de conta com múltiplas estratégias
        let conta = null;
        
        // 1. Match exato
        conta = planoContas.find(p => 
          p.name.toLowerCase() === classification.plano_contas_nome?.toLowerCase()
        );
        
        // 2. Match parcial (contains)
        if (!conta && classification.plano_contas_nome) {
          const searchTerm = classification.plano_contas_nome.toLowerCase();
          conta = planoContas.find(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            searchTerm.includes(p.name.toLowerCase())
          );
        }
        
        // 3. Match por palavras-chave comuns
        if (!conta && classification.plano_contas_nome) {
          const keywords = classification.plano_contas_nome.toLowerCase();
          
          // Mapeamentos comuns
          const commonMappings: { [key: string]: string[] } = {
            'comissão': ['Comissão de Vendedores', 'DESPESAS COMERCIAIS/TRADE'],
            'biardini': ['Comissão de Vendedores'],
            'salário': ['Salários e Ordenados', 'Folha de Pagamento'],
            'marketing': ['Marketing e Publicidade', 'Propaganda e Marketing'],
            'aluguel': ['Aluguel'],
            'água': ['Água e Esgoto'],
            'energia': ['Energia Elétrica'],
            'telefone': ['Telefone e Internet'],
            'internet': ['Telefone e Internet'],
            'frete': ['Frete sobre Vendas', 'Frete sobre Compras', 'Logística'],
            'combustível': ['Combustíveis e Lubrificantes'],
            'manutenção': ['Manutenção e Reparos'],
            'material': ['Material de Escritório', 'Material POP'],
            'honorários': ['Honorários Profissionais', 'Serviços Contábeis'],
            'contábil': ['Serviços Contábeis'],
            'impostos': ['Impostos e Taxas'],
            'seguro': ['Seguros'],
            'eventos': ['Eventos e Ativações'],
            'promotor': ['Promotores e Degustação']
          };
          
          for (const [keyword, options] of Object.entries(commonMappings)) {
            if (keywords.includes(keyword)) {
              conta = planoContas.find(p => 
                options.some(opt => p.name.toLowerCase().includes(opt.toLowerCase()))
              );
              if (conta) {
                console.log(`✓ Conta encontrada via mapeamento: ${keyword} → ${conta.name}`);
                break;
              }
            }
          }
        }
        
        // 4. Conta padrão baseada em fornecedor ou categoria
        if (!conta) {
          // Para COMISSÃO ou vendedores específicos
          if (group.fornecedor_nome?.toLowerCase().includes('comissão') || 
              group.fornecedor_nome?.toLowerCase().includes('biardini') ||
              group.categoria_nome?.toLowerCase().includes('comissão')) {
            conta = planoContas.find(p => p.code === '6.1.07'); // Comissão de Vendedores
            if (conta) {
              console.log(`✓ Usando conta específica de comissões: ${conta.name}`);
            }
          }
          
          // Para despesas comerciais gerais
          if (!conta && group.categoria_nome?.toLowerCase().includes('comercial')) {
            conta = planoContas.find(p => p.code === '6.1');
            if (conta) {
              console.log(`✓ Usando conta padrão de despesas comerciais: ${conta.name}`);
            }
          }
        }

        if (!dept) {
          console.warn(`❌ Departamento não encontrado: ${classification.departamento_nome}`);
        }
        if (!conta) {
          console.warn(`❌ Conta não encontrada para: "${classification.plano_contas_nome}"`);
          console.warn(`   Categoria: ${group.categoria_nome}, Fornecedor: ${group.fornecedor_nome}`);
        } else {
          console.log(`✓ Conta encontrada: ${conta.code} - ${conta.name}`);
        }

        // Salvar regra aprendida (mesmo sem plano_contas_id)
        if (dept) {
          const { error: ruleError } = await supabase
            .from("account_classification_rules")
            .insert({
              categoria_nome: group.categoria_nome,
              fornecedor_nome: group.fornecedor_nome || "",
              tipo_documento: group.tipo_documento || "",
              departamento_id: dept.id,
              plano_contas_id: conta?.id || null,
              confidence_score: classification.confianca || 0.8,
              times_used: group.count,
              last_used_at: new Date().toISOString()
            });

          if (ruleError) {
            console.error("Erro ao salvar regra:", ruleError);
          } else {
            console.log("✓ Regra aprendida salva com sucesso");
          }
        }

        // Só marcar como sucesso se encontrou pelo menos o departamento
        const hasValidClassification = dept?.id && conta?.id;
        
        results.push({
          categoria_nome: group.categoria_nome,
          fornecedor_nome: group.fornecedor_nome,
          tipo_documento: group.tipo_documento,
          departamento_id: dept?.id || null,
          departamento_nome: dept?.nome || null,
          plano_contas_id: conta?.id || null,
          plano_contas_nome: conta?.name || null,
          plano_contas_codigo: conta?.code || null,
          confianca_classificacao: classification.confianca || 0.8,
          classificacao_justificativa: classification.justificativa,
          success: hasValidClassification,
          error: !hasValidClassification ? "Não foi possível encontrar departamento ou conta no sistema" : undefined
        });
        
        if (!hasValidClassification) {
          console.warn(`⚠️ Classificação incompleta: dept=${!!dept}, conta=${!!conta}`);
        }

      } catch (error) {
        console.error(`Erro ao processar grupo ${group.categoria_nome}:`, error);
        results.push({
          categoria_nome: group.categoria_nome,
          fornecedor_nome: group.fornecedor_nome,
          tipo_documento: group.tipo_documento,
          departamento_id: null,
          departamento_nome: null,
          plano_contas_id: null,
          plano_contas_nome: null,
          plano_contas_codigo: null,
          confianca_classificacao: 0,
          classificacao_justificativa: "",
          success: false,
          error: error instanceof Error ? error.message : "Erro desconhecido"
        });
      }
    }

    console.log(`Processamento concluído: ${results.filter(r => r.success).length}/${results.length} grupos classificados`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
