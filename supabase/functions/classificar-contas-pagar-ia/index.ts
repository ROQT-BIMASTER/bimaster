import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContaPagar {
  id: string;
  categoria_nome?: string;
  fornecedor_nome?: string;
  tipo_documento?: string;
  valor_original?: number;
  numero_documento?: string;
}

interface ClassificationResult {
  plano_contas_id?: string;
  plano_contas_codigo?: string;
  plano_contas_nome?: string;
  departamento_id?: string;
  departamento_nome?: string;
  confianca: number;
  justificativa: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conta }: { conta: ContaPagar } = await req.json();
    console.log("Processando conta:", conta);

    if (!conta || !conta.id) {
      throw new Error("Dados da conta inválidos");
    }

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar regras aprendidas similares
    const { data: existingRule } = await supabase
      .from("account_classification_rules")
      .select(`
        *,
        plano_contas:trade_chart_of_accounts(id, code, name),
        departamento:departamentos(id, nome)
      `)
      .eq("categoria_nome", conta.categoria_nome || "")
      .eq("fornecedor_nome", conta.fornecedor_nome || "")
      .eq("tipo_documento", conta.tipo_documento || "")
      .single();

    // Se já existe regra aprendida, usar ela
    if (existingRule) {
      console.log("Usando regra existente:", existingRule);
      
      // Atualizar contador de uso
      await supabase
        .from("account_classification_rules")
        .update({
          times_used: existingRule.times_used + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existingRule.id);

      return new Response(
        JSON.stringify({
          plano_contas_id: existingRule.plano_contas_id,
          plano_contas_codigo: existingRule.plano_contas?.code,
          plano_contas_nome: existingRule.plano_contas?.name,
          departamento_id: existingRule.departamento_id,
          departamento_nome: existingRule.departamento?.nome,
          confianca: existingRule.confidence_score || 0.95,
          justificativa: `Regra aprendida aplicada (${existingRule.times_used + 1}x usada)`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar contexto: departamentos ativos
    const { data: departamentos, error: deptError } = await supabase
      .from("departamentos")
      .select("id, nome, descricao")
      .eq("ativo", true);

    if (deptError) {
      console.error("Erro ao buscar departamentos:", deptError);
    }

    // 3. Buscar contexto: plano de contas
    const { data: planoContas, error: planoError } = await supabase
      .from("trade_chart_of_accounts")
      .select("id, code, name, account_type, parent_id")
      .eq("active", true)
      .order("code");

    if (planoError) {
      console.error("Erro ao buscar plano de contas:", planoError);
    }

    // 4. Preparar prompt para IA (sem exemplos hardcoded do gerente)
    const systemPrompt = `Você é um especialista em contabilidade e classificação fiscal brasileira.
Sua tarefa é analisar uma conta a pagar e sugerir:
1. A conta do plano de contas mais adequada
2. O departamento responsável pela despesa

GUIA DE CLASSIFICAÇÃO POR ESTRUTURA CONTÁBIL:
- 3.1.x = Custos de Vendas (CMV, Compras de Mercadoria, Fretes de Vendas)
- 3.2.x = Despesas Variáveis (Comissões, Representantes, Embalagens)
- 3.3.x = Despesas Fixas (Salários, Aluguel, Água, Luz, Internet, Software, Manutenção)
- 3.4.x = Impostos e Tributos (ICMS, PIS, COFINS, ISS, Simples Nacional, IRPJ, CSLL)
- 3.5.x = Outras Despesas Operacionais
- 3.6.x = Despesas de Marketing e Publicidade
- 3.7.x = Despesas Financeiras (Juros, Tarifas Bancárias, IOF)
- 3.8.x = Retiradas dos Sócios (Pró-labore, Distribuição de Lucros)
- 4.1.x = Receita Operacional Bruta
- 4.2.x = Deduções da Receita

DEPARTAMENTOS POR TIPO DE DESPESA:
- Financeiro: Impostos, tributos, tarifas bancárias, juros
- RH: Salários, benefícios, encargos trabalhistas, férias, 13º
- Comercial: Comissões, representantes, fretes de vendas
- Marketing: Publicidade, propaganda, mídia
- Operações: Aluguel, utilidades (água, luz), manutenção
- TI: Software, equipamentos de informática
- Administrativo: Despesas gerais, material de escritório

Considere:
- Natureza da despesa (tributos, fornecedores, serviços, etc.)
- Tipo de documento
- Nome do fornecedor
- Categoria atual

Retorne APENAS um objeto JSON com a estrutura:
{
  "plano_contas_codigo": "código da conta (ex: 3.3.01)",
  "departamento_nome": "nome do departamento",
  "confianca": 0.85,
  "justificativa": "explicação breve"
}`;

    const userPrompt = `Classifique esta conta a pagar:

Categoria: ${conta.categoria_nome || "N/A"}
Fornecedor: ${conta.fornecedor_nome || "N/A"}
Tipo Documento: ${conta.tipo_documento || "N/A"}
Valor: R$ ${conta.valor_original?.toFixed(2) || "0.00"}
Número Doc: ${conta.numero_documento || "N/A"}

Departamentos disponíveis:
${departamentos?.map(d => `- ${d.nome}: ${d.descricao || ""}`).join("\n") || "Nenhum"}

Plano de Contas disponível:
${planoContas?.map(p => `- ${p.code} ${p.name} (${p.account_type})`).join("\n") || "Nenhum"}`;

    // 5. Chamar Lovable AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    console.log("Chamando Lovable AI...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro da IA:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "rate_limit", 
            message: "Limite de requisições excedido. Aguarde um momento." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro da IA: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    console.log("Resposta da IA:", aiContent);

    // 6. Processar resposta
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("IA não retornou JSON válido");
    }

    const classification = JSON.parse(jsonMatch[0]);

    // 7. Encontrar IDs correspondentes
    let planoMatch = planoContas?.find(
      p => p.code === classification.plano_contas_codigo
    );
    
    // Fallback: busca por nome se não encontrar por código
    if (!planoMatch && classification.plano_contas_codigo) {
      planoMatch = planoContas?.find(
        p => p.name.toLowerCase().includes(classification.plano_contas_codigo?.toLowerCase() || "") ||
             classification.plano_contas_codigo?.toLowerCase().includes(p.name.toLowerCase())
      );
    }

    const deptMatch = departamentos?.find(
      d => d.nome.toLowerCase() === classification.departamento_nome?.toLowerCase() ||
           d.nome.toLowerCase().includes(classification.departamento_nome?.toLowerCase() || "")
    );

    const result: ClassificationResult = {
      plano_contas_id: planoMatch?.id,
      plano_contas_codigo: planoMatch?.code,
      plano_contas_nome: planoMatch?.name,
      departamento_id: deptMatch?.id,
      departamento_nome: deptMatch?.nome,
      confianca: classification.confianca || 0.85,
      justificativa: classification.justificativa || "Classificação automática por IA",
    };

    // 8. Salvar regra aprendida se confiança >= 0.80
    if (result.confianca >= 0.80 && result.plano_contas_id && result.departamento_id) {
      await supabase
        .from("account_classification_rules")
        .upsert({
          categoria_nome: conta.categoria_nome || "",
          fornecedor_nome: conta.fornecedor_nome || "",
          tipo_documento: conta.tipo_documento || "",
          plano_contas_id: result.plano_contas_id,
          departamento_id: result.departamento_id,
          confidence_score: result.confianca,
        }, {
          onConflict: "categoria_nome,fornecedor_nome,tipo_documento",
        });
    }

    console.log("Classificação final:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro na classificação:", error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || "Erro desconhecido",
        details: error?.toString() || "Erro ao processar requisição"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
