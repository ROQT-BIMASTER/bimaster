import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const requestSchema = z.object({
  planilhaTexto: z.string().max(100000, { message: 'Texto da planilha muito longo (máx 100KB)' }).optional(),
  texto: z.string().max(100000, { message: 'Texto muito longo (máx 100KB)' }).optional(),
  tipo: z.enum(['stores', 'prospects', 'produtos'], { invalid_type_error: 'Tipo deve ser "stores", "prospects" ou "produtos"' })
}).refine(
  (data) => data.planilhaTexto || data.texto,
  { message: 'É necessário fornecer planilhaTexto ou texto' }
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('❌ Tentativa de acesso sem autorização');
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuração do Supabase ausente');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Token inválido ou usuário não encontrado:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Usuário autenticado:', user.id);

    // Validar entrada
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('❌ Erro de validação:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: validation.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { planilhaTexto, texto, tipo } = validation.data;
    const textoAnalise = texto || planilhaTexto;
    const tipoLabels: Record<string, string> = { stores: 'de lojas', prospects: 'de prospects', produtos: 'de produtos' };
    console.log(`📊 Iniciando análise ${tipoLabels[tipo]} com IA...`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    let systemPrompt = "";
    
    if (tipo === "stores") {
      systemPrompt = `Você é um assistente especializado em analisar dados de lojas/PDVs.
Analise o texto fornecido e extraia TODAS as lojas possíveis.
Retorne um JSON válido com o array 'stores' contendo os dados estruturados.

Formato esperado:
{
  "stores": [
    {
      "name": "string (obrigatório)",
      "code": "string ou null",
      "chain": "string ou null (rede)",
      "cnpj": "string ou null",
      "address": "string ou null",
      "city": "string ou null",
      "state": "string (UF) ou null",
      "phone": "string ou null",
      "email": "string ou null",
      "category": "string ou null (supermercado, farmacia, atacado, conveniencia)",
      "priority": "string ou null (alta, media, baixa)"
    }
  ],
  "total_encontrados": number,
  "confianca": "alta | media | baixa"
}

IMPORTANTE:
- name é obrigatório
- Normalize category para: supermercado, farmacia, atacado ou conveniencia
- Normalize priority para: alta, media ou baixa
- Se não conseguir identificar um campo, use null
- Retorne APENAS o JSON, sem texto adicional`;
    } else if (tipo === "produtos") {
      systemPrompt = `Você é um assistente especializado em analisar dados de produtos fabricados.
Analise o texto fornecido e extraia TODOS os produtos possíveis.
Retorne um JSON válido com o array 'produtos' contendo os dados estruturados.

Formato esperado:
{
  "produtos": [
    {
      "codigo": "string (obrigatório - gere se não encontrar, ex: PROD001)",
      "nome": "string (obrigatório)",
      "tipo": "ACABADO | INTER (padrão: ACABADO, use INTER para produtos intermediários/semiacabados)",
      "sku": "string ou null",
      "codigo_barras_ean": "string ou null (código de barras EAN-13)",
      "categoria": "string ou null (ex: Perfumaria, Corpo, Cabelos, Limpeza)",
      "subcategoria": "string ou null",
      "linha": "string ou null (linha de produtos)",
      "marca": "string ou null",
      "fabricante": "string ou null",
      "unidade": "UN | KG | L | ML | G (padrão: UN)",
      "descricao_curta": "string ou null",
      "descricao": "string ou null (descrição completa)",
      "status": "ativo | inativo (padrão: ativo)"
    }
  ],
  "total_encontrados": number,
  "confianca": "alta | media | baixa"
}

IMPORTANTE:
- codigo e nome são obrigatórios
- Se não encontrar código, gere um único (PROD001, PROD002...)
- Normalize tipo para: ACABADO ou INTER
- Se não conseguir identificar um campo, use null
- Retorne APENAS o JSON, sem texto adicional`;
    } else {
      systemPrompt = `Você é um assistente especializado em análise de dados de empresas para um CRM de prospecção.

Sua tarefa é analisar os dados fornecidos (que podem estar em formato de planilha, texto não estruturado, lista, etc.) e extrair TODAS as empresas/prospects mencionados.

REGRAS IMPORTANTES:
1. Extraia TODOS os prospects que conseguir identificar nos dados
2. Para cada prospect, tente extrair o máximo de informações possível
3. Se um campo não estiver disponível, use null
4. Normalize os dados (remova acentos desnecessários, padronize formatos)
5. Para município e UF, sempre tente identificar mesmo se não estiver explícito
6. CLASSIFICAÇÃO DE PORTE (OBRIGATÓRIO - use EXATAMENTE estes valores):
   - Se tiver informação de funcionários:
     * 0-1 funcionários = "MEI"
     * 2-9 funcionários = "ME"
     * 10-49 funcionários = "EPP"
     * 50+ funcionários = "Grande"
   - Valores ACEITOS: "MEI", "ME", "EPP", "Grande"
   - NUNCA use: "Microempresa", "Pequena", "Média" - use apenas os valores acima
   - Se não houver informação suficiente = null
7. ENDEREÇO - Extraia TODOS os componentes possíveis:
   - Tipo de logradouro (Rua, Avenida, Alameda, etc.)
   - Nome da rua/avenida (logradouro)
   - Número
   - CEP
   - Bairro
   - Município
   - UF

Retorne um JSON com a seguinte estrutura:
{
  "prospects": [
    {
      "nome_empresa": "string (obrigatório)",
      "cnpj": "string ou null",
      "municipio": "string (obrigatório)",
      "uf": "string de 2 letras ou null",
      "telefone": "string ou null",
      "email": "string ou null",
      "contato_principal": "string ou null",
      "porte_empresa": "MEI | ME | EPP | Grande | null (use APENAS estes valores exatos)",
      "segmento": "string ou null",
      "tipo_logradouro": "string ou null (Ex: Rua, Avenida, Alameda)",
      "logradouro": "string ou null (nome da rua/avenida)",
      "numero": "string ou null",
      "cep": "string ou null",
      "bairro": "string ou null",
      "nome_fantasia": "string ou null",
      "cnpj_raiz": "string ou null",
      "dominio": "string ou null",
      "perfil_linkedin": "string ou null",
      "cnae_codigo": "string ou null",
      "cnae_principal": "string ou null",
      "tipo_estabelecimento": "string ou null",
      "total_funcionarios": "number ou null",
      "faixa_funcionarios": "string ou null",
      "faixa_faturamento": "string ou null",
      "demais_emails": "string ou null",
      "demais_telefones": "string ou null",
      "perfil_facebook": "string ou null",
      "perfil_instagram": "string ou null",
      "perfil_twitter": "string ou null",
      "observacoes": "string ou null"
    }
  ],
  "total_encontrados": number,
  "confianca": "alta | media | baixa"
}`;
    }

    const tipoTextos: Record<string, string> = {
      stores: 'todas as lojas/PDVs',
      prospects: 'todas as empresas/prospects',
      produtos: 'todos os produtos fabricados'
    };
    const userPrompt = `Analise os seguintes dados e extraia ${tipoTextos[tipo]} que encontrar:\n\n${textoAnalise}`;

    console.log("🤖 Chamando IA para análise...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na resposta da IA:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na IA: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log("📝 Resposta da IA:", content);

    // Extrair JSON da resposta (pode vir com markdown)
    let resultado;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultado = JSON.parse(jsonMatch[0]);
      } else {
        resultado = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Erro ao parsear resposta da IA:", parseError);
      throw new Error("Não foi possível processar a resposta da IA. Tente novamente.");
    }

    const tipoResultLabels: Record<string, string> = { stores: 'lojas', prospects: 'prospects', produtos: 'produtos' };
    console.log(`✅ Análise concluída: ${resultado.total_encontrados} ${tipoResultLabels[tipo]} encontrados`);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Erro na função:", error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || "Erro ao processar dados",
        details: error?.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
