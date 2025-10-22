import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CNPJBIZ_API_KEY = Deno.env.get('CNPJBIZ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas for API operations
const cnpjSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ must be exactly 14 digits')
});

const searchSchema = z.object({
  cnaes_primarios: z.array(z.string().max(10)).max(20).optional(),
  cnaes_secundarios: z.array(z.string().max(10)).max(20).optional(),
  situacao: z.array(z.enum(['ATIVA', 'BAIXADA', 'INAPTA', 'SUSPENSA', 'NULA'])).max(5).optional(),
  tipo: z.array(z.enum(['MATRIZ', 'FILIAL'])).max(2).optional(),
  natureza_juridica: z.array(z.string().max(10)).max(20).optional(),
  uf: z.array(z.string().length(2)).max(27).optional(),
  municipio: z.array(z.string().max(100)).max(50).optional(),
  bairro: z.array(z.string().max(100)).max(50).optional(),
  pagina: z.number().int().min(1).max(1000).optional(),
  por_pagina: z.number().int().min(1).max(100).optional()
});

const listSchema = searchSchema.extend({
  pagina: z.number().int().min(1).max(1000).optional(),
  por_pagina: z.number().int().min(1).max(100).optional()
});

// Safe error message mapper
function getSafeErrorMessage(error: any): string {
  const errorMsg = error?.message?.toLowerCase() || "";
  
  const errorMap: Record<string, string> = {
    "invalid cnpj": "CNPJ inválido",
    "must be exactly 14 digits": "CNPJ deve conter exatamente 14 dígitos",
    "invalid parameter": "Parâmetros de busca inválidos",
    "network error": "Erro de conexão com a API",
    "fetch failed": "Falha ao consultar dados",
    "timeout": "Tempo de consulta excedido"
  };
  
  for (const [key, message] of Object.entries(errorMap)) {
    if (errorMsg.includes(key)) return message;
  }
  
  console.error("[SECURITY] API error:", error);
  return "Erro ao processar consulta. Tente novamente";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verificar usuário autenticado
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    if (!CNPJBIZ_API_KEY) {
      console.error('❌ CNPJBIZ_API_KEY não configurado');
      return new Response(
        JSON.stringify({ error: 'API Key do CNPJ.BIZ não configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { operation, ...params } = await req.json();
    console.log(`🔍 Operação: ${operation}, Usuário: ${user.id}`);

    // Validate input based on operation type
    try {
      if (operation === 'buscar-cnpj') {
        cnpjSchema.parse(params);
      } else if (operation === 'listar' || operation === 'contar') {
        searchSchema.parse(params);
      }
    } catch (validationError) {
      console.error('❌ Validation error:', validationError);
      return new Response(
        JSON.stringify({ error: getSafeErrorMessage(validationError) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Gerar chave de cache
    const cacheKey = `${operation}:${JSON.stringify(params)}`;
    
    // Verificar cache
    const { data: cachedData } = await supabase
      .from('cnpjbiz_cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .single();

    if (cachedData && new Date(cachedData.expires_at) > new Date()) {
      console.log('✅ Dados do cache');
      return new Response(
        JSON.stringify({ ...cachedData.data, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mapear operação para endpoint da API
    const endpointMap: Record<string, string> = {
      'contar': '/empresas/contar',
      'listar': '/empresas/listar-com-dados',
      'buscar-cnpj': '/empresas/cnpj',
      'atividades': '/atividades/buscar',
      'naturezas': '/naturezas-juridicas/buscar',
      'localidades': '/localidades/buscar',
      'bairros': '/bairros/buscar',
      'creditos': '/conta/creditos'
    };

    const endpoint = endpointMap[operation];
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Operação inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const url = `https://cnpj.biz/api/v2${endpoint}`;
    console.log(`🌐 Chamando API: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${CNPJBIZ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error (${response.status}):`, errorText);
      
      // Map common API errors to safe messages
      const statusMessages: Record<number, string> = {
        400: 'Parâmetros de consulta inválidos',
        401: 'Erro de autenticação com a API',
        402: 'Créditos insuficientes na API',
        403: 'Acesso negado pela API',
        429: 'Limite de requisições excedido. Tente novamente em alguns minutos',
        500: 'Erro no servidor da API',
        503: 'API temporariamente indisponível'
      };
      
      const safeMessage = statusMessages[response.status] || 'Erro ao consultar dados';
      
      return new Response(
        JSON.stringify({ error: safeMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status >= 500 ? 500 : 400 }
      );
    }

    const data = await response.json();
    
    // Calcular créditos usados
    let creditsUsed = 0;
    if (operation === 'listar') {
      creditsUsed = Array.isArray(data) ? data.length : 0;
    } else if (operation === 'buscar-cnpj') {
      creditsUsed = 1;
    }

    // Registrar auditoria
    await supabase.from('cnpjbiz_audit').insert({
      user_id: user.id,
      operation,
      credits_used: creditsUsed,
      filters: params,
      results_count: operation === 'contar' ? data.count : (Array.isArray(data) ? data.length : 1)
    });

    // Salvar no cache (24h para consultas, 7 dias para dados específicos)
    const cacheHours = operation === 'buscar-cnpj' ? 168 : 24;
    const expiresAt = new Date(Date.now() + cacheHours * 60 * 60 * 1000);
    
    await supabase.from('cnpjbiz_cache').upsert({
      cache_key: cacheKey,
      data,
      expires_at: expiresAt.toISOString()
    }, { onConflict: 'cache_key' });

    console.log(`✅ Sucesso - Créditos usados: ${creditsUsed}`);
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(
      JSON.stringify({ error: getSafeErrorMessage(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
