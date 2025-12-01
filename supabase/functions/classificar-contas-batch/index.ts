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

// Função auxiliar para processar um grupo
async function processGroup(
  group: GroupToClassify,
  supabase: any,
  departamentos: any[],
  planoContas: any[],
  lovableApiKey: string
): Promise<ClassificationResult> {
  try {
    // Verificar se existe regra aprendida
    let ruleQuery = supabase
      .from("account_classification_rules")
      .select("*")
      .eq("categoria_nome", group.categoria_nome);
    
    if (group.fornecedor_nome) {
      ruleQuery = ruleQuery.eq("fornecedor_nome", group.fornecedor_nome);
    } else {
      ruleQuery = ruleQuery.is("fornecedor_nome", null);
    }
    
    if (group.tipo_documento) {
      ruleQuery = ruleQuery.eq("tipo_documento", group.tipo_documento);
    } else {
      ruleQuery = ruleQuery.is("tipo_documento", null);
    }
    
    const { data: existingRule } = await ruleQuery.maybeSingle();

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

      return {
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
      };
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

    // Mapear nomes para IDs
    const dept = departamentos.find(d => 
      d.nome.toLowerCase() === classification.departamento_nome?.toLowerCase()
    );
    
    let conta = planoContas.find(p => 
      p.name.toLowerCase() === classification.plano_contas_nome?.toLowerCase()
    );

    if (!dept) {
      console.warn(`❌ Departamento não encontrado: ${classification.departamento_nome}`);
    }
    if (!conta) {
      console.warn(`❌ Conta não encontrada: ${classification.plano_contas_nome}`);
    } else {
      console.log(`✓ Conta encontrada: ${conta.code} - ${conta.name}`);
    }

    // Salvar regra aprendida
    if (dept) {
      await supabase
        .from("account_classification_rules")
        .insert({
          categoria_nome: group.categoria_nome,
          fornecedor_nome: group.fornecedor_nome || null,
          tipo_documento: group.tipo_documento || null,
          departamento_id: dept.id,
          plano_contas_id: conta?.id || null,
          confidence_score: classification.confianca || 0.8,
          times_used: group.count,
          last_used_at: new Date().toISOString()
        });
      
      console.log("✓ Regra aprendida salva com sucesso");
    }

    const hasValidClassification = dept?.id && conta?.id;

    return {
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
      error: !hasValidClassification ? "Não foi possível encontrar departamento ou conta" : undefined
    };

  } catch (error) {
    console.error(`Erro ao processar grupo:`, error);
    return {
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
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseKey || !lovableApiKey) {
      throw new Error("Variáveis de ambiente não configuradas");
    }

    const { groups } = await req.json() as { groups: GroupToClassify[] };

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      throw new Error("Lista de grupos inválida");
    }

    // Limitar batch
    const MAX_BATCH = 10;
    if (groups.length > MAX_BATCH) {
      return new Response(
        JSON.stringify({ error: `Máximo ${MAX_BATCH} grupos por vez` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    console.log("Buscando contexto...");
    
    const { data: departamentos, error: deptError } = await supabase
      .from("departamentos")
      .select("id, nome, descricao")
      .eq("ativo", true)
      .order("nome");

    if (deptError) throw new Error(`Erro departamentos: ${deptError.message}`);

    const { data: planoContas, error: planoError } = await supabase
      .from("trade_chart_of_accounts")
      .select("id, code, name, account_type")
      .order("code");

    if (planoError) throw new Error(`Erro plano de contas: ${planoError.message}`);

    console.log(`Contexto: ${departamentos.length} depts, ${planoContas.length} contas`);

    const results: ClassificationResult[] = [];

    for (const group of groups) {
      console.log(`Processando: ${group.categoria_nome} | ${group.fornecedor_nome} (${group.count})`);
      const result = await processGroup(group, supabase, departamentos, planoContas, lovableApiKey);
      results.push(result);
    }

    console.log(`Concluído: ${results.filter(r => r.success).length}/${results.length}`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
