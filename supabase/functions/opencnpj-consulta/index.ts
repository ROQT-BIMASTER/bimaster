import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OpenCNPJResponse {
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  // Campos de telefone - a API pode usar diferentes formatos
  telefone_1?: string;
  telefone_2?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  ddd_fax?: string;
  telefone?: string;
  email?: string;
  situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  cnae_principal?: {
    codigo?: string;
    descricao?: string;
  };
  capital_social?: number;
  porte?: string;
  natureza_juridica?: string;
  [key: string]: any; // Allow additional fields
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header missing" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verificar token do usuário
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { cnpj } = await req.json();

    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: "CNPJ é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limpar CNPJ (apenas números)
    const cnpjLimpo = cnpj.replace(/\D/g, "");

    if (cnpjLimpo.length !== 14) {
      return new Response(
        JSON.stringify({ error: "CNPJ deve ter 14 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[OpenCNPJ] Consultando CNPJ: ${cnpjLimpo} para usuário: ${user.id}`);

    // Cliente admin para acessar cache
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar cache
    const { data: cacheData } = await adminClient
      .from("opencnpj_cache")
      .select("data, expires_at")
      .eq("cnpj", cnpjLimpo)
      .single();

    if (cacheData && new Date(cacheData.expires_at) > new Date()) {
      console.log(`[OpenCNPJ] Cache hit para CNPJ: ${cnpjLimpo}`);
      return new Response(
        JSON.stringify({ ...cacheData.data, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Consultar API OpenCNPJ
    console.log(`[OpenCNPJ] Cache miss, consultando API para: ${cnpjLimpo}`);
    
    // URL correta da API OpenCNPJ: https://api.opencnpj.org/{CNPJ}
    const apiUrl = `https://api.opencnpj.org/${cnpjLimpo}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[OpenCNPJ] Erro na API: ${apiResponse.status} - ${errorText}`);
      
      if (apiResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: "CNPJ não encontrado na base da Receita Federal" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (apiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de consultas excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao consultar CNPJ. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiData: OpenCNPJResponse = await apiResponse.json();
    console.log(`[OpenCNPJ] Dados recebidos para: ${cnpjLimpo}`);

    // Extrair telefone do array "telefones" retornado pela API
    // Formato: telefones: [{ ddd: "11", numero: "46854646", is_fax: false }]
    let telefone: string | null = null;
    const telefones = (apiData as any).telefones;
    if (Array.isArray(telefones) && telefones.length > 0) {
      // Priorizar telefone que não é fax
      const tel = telefones.find((t: any) => !t.is_fax) || telefones[0];
      if (tel?.ddd && tel?.numero) {
        telefone = `(${tel.ddd}) ${tel.numero}`;
      } else if (tel?.numero) {
        telefone = tel.numero;
      }
    }
    console.log(`[OpenCNPJ] Telefone extraído: ${telefone}`);

    // Mapear regime tributário
    const opcaoSimples = (apiData as any).opcao_simples;
    const opcaoMEI = (apiData as any).opcao_mei;
    let regimeTributario: string | null = null;
    if (opcaoMEI === 'S') {
      regimeTributario = 'MEI';
    } else if (opcaoSimples === 'S') {
      regimeTributario = 'Simples Nacional';
    } else if (opcaoSimples === 'N') {
      regimeTributario = 'Lucro Presumido/Real';
    }

    // Montar resposta padronizada
    const responseData = {
      razaoSocial: apiData.razao_social || null,
      nomeFantasia: apiData.nome_fantasia || null,
      endereco: [
        apiData.logradouro,
        apiData.numero,
        apiData.complemento,
      ].filter(Boolean).join(", ") || null,
      bairro: apiData.bairro || null,
      cidade: apiData.municipio || null,
      uf: apiData.uf || null,
      cep: apiData.cep || null,
      telefone,
      email: apiData.email || null,
      situacao: apiData.situacao_cadastral || null,
      cnae: apiData.cnae_principal?.descricao || null,
      porte: (apiData as any).porte_empresa || apiData.porte || null,
      capitalSocial: apiData.capital_social || null,
      regimeTributario,
      matrizFilial: (apiData as any).matriz_filial || null,
    };

    // Salvar no cache (upsert)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias de cache

    await adminClient
      .from("opencnpj_cache")
      .upsert({
        cnpj: cnpjLimpo,
        data: responseData,
        expires_at: expiresAt.toISOString(),
      });

    console.log(`[OpenCNPJ] Cache salvo para: ${cnpjLimpo}`);

    return new Response(
      JSON.stringify({ ...responseData, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[OpenCNPJ] Erro interno:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar requisição" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
