import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface XMLProduct {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  numero_item: number;
}

interface XMLData {
  chave_acesso: string;
  numero: string;
  serie: string;
  data_emissao: string;
  valor_total: number;
  fornecedor: {
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
  };
  produtos: XMLProduct[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obter usuário autenticado
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    const { xml } = await req.json();

    console.log('[process-nfe-xml] Iniciando processamento do XML');

    // Parsear XML
    const xmlData = parseXML(xml);
    console.log('[process-nfe-xml] XML parseado:', xmlData.chave_acesso);

    // Verificar duplicidade
    const { data: existing } = await supabase
      .from('fabrica_notas_fiscais')
      .select('id')
      .eq('chave_acesso', xmlData.chave_acesso)
      .single();

    if (existing) {
      console.log('[process-nfe-xml] Nota duplicada:', xmlData.chave_acesso);
      throw new Error('Nota fiscal já importada anteriormente');
    }

    // Buscar ou criar fornecedor
    let fornecedorId = await buscarOuCriarFornecedor(supabase, xmlData.fornecedor);
    console.log('[process-nfe-xml] Fornecedor:', fornecedorId);

    // Criar nota fiscal
    const { data: nota, error: notaError } = await supabase
      .from('fabrica_notas_fiscais')
      .insert({
        chave_acesso: xmlData.chave_acesso,
        numero: xmlData.numero,
        serie: xmlData.serie,
        fornecedor_id: fornecedorId,
        data_emissao: xmlData.data_emissao,
        valor_total: xmlData.valor_total,
        xml_raw: xml,
        status: 'imported',
      })
      .select()
      .single();

    if (notaError) throw notaError;

    console.log('[process-nfe-xml] Nota criada:', nota.id);

    // Processar itens
    const itensProcessados = await processarItens(supabase, nota.id, fornecedorId, xmlData.produtos);

    // Registrar log
    await supabase.from('fabrica_processamento_logs').insert({
      nota_id: nota.id,
      tipo: 'success',
      etapa: 'importacao',
      mensagem: `Nota fiscal importada com sucesso. ${itensProcessados.mapeados} itens mapeados automaticamente, ${itensProcessados.naoMapeados} aguardando mapeamento manual.`,
      detalhes: { itensProcessados },
      usuario_id: user.id,
    });

    console.log('[process-nfe-xml] Processamento concluído');

    return new Response(
      JSON.stringify({
        success: true,
        nota_id: nota.id,
        itens_processados: itensProcessados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[process-nfe-xml] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function parseXML(xmlText: string): XMLData {
  // Parser XML simplificado (em produção, usar biblioteca robusta)
  // Esta implementação é básica para demonstração
  
  const getTagValue = (xml: string, tag: string): string => {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  };

  const chaveAcesso = getTagValue(xmlText, 'chNFe');
  
  return {
    chave_acesso: chaveAcesso,
    numero: getTagValue(xmlText, 'nNF'),
    serie: getTagValue(xmlText, 'serie'),
    data_emissao: getTagValue(xmlText, 'dhEmi').substring(0, 19).replace('T', ' '),
    valor_total: parseFloat(getTagValue(xmlText, 'vNF')),
    fornecedor: {
      cnpj: getTagValue(xmlText, 'CNPJ'),
      razao_social: getTagValue(xmlText, 'xNome'),
      nome_fantasia: getTagValue(xmlText, 'xFant'),
    },
    produtos: extractProducts(xmlText),
  };
}

function extractProducts(xmlText: string): XMLProduct[] {
  const products: XMLProduct[] = [];
  const detRegex = /<det nItem="(\d+)">(.*?)<\/det>/gs;
  let match;

  while ((match = detRegex.exec(xmlText)) !== null) {
    const nItem = parseInt(match[1]);
    const detContent = match[2];

    const getTagValue = (content: string, tag: string): string => {
      const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
      const m = content.match(regex);
      return m ? m[1].trim() : '';
    };

    products.push({
      numero_item: nItem,
      codigo: getTagValue(detContent, 'cProd'),
      descricao: getTagValue(detContent, 'xProd'),
      ncm: getTagValue(detContent, 'NCM'),
      cfop: getTagValue(detContent, 'CFOP'),
      unidade: getTagValue(detContent, 'uCom'),
      quantidade: parseFloat(getTagValue(detContent, 'qCom')),
      valor_unitario: parseFloat(getTagValue(detContent, 'vUnCom')),
      valor_total: parseFloat(getTagValue(detContent, 'vProd')),
    });
  }

  return products;
}

async function buscarOuCriarFornecedor(supabase: any, fornecedor: any): Promise<string> {
  // Buscar fornecedor existente por CNPJ
  const { data: existing } = await supabase
    .from('fabrica_fornecedores')
    .select('id')
    .eq('cnpj', fornecedor.cnpj)
    .single();

  if (existing) {
    return existing.id;
  }

  // Criar novo fornecedor
  const { data: novo, error } = await supabase
    .from('fabrica_fornecedores')
    .insert({
      cnpj: fornecedor.cnpj,
      razao_social: fornecedor.razao_social,
      nome_fantasia: fornecedor.nome_fantasia,
    })
    .select()
    .single();

  if (error) throw error;

  return novo.id;
}

async function processarItens(
  supabase: any,
  notaId: string,
  fornecedorId: string,
  produtos: XMLProduct[]
) {
  let mapeados = 0;
  let naoMapeados = 0;

  for (const produto of produtos) {
    // Tentar mapear automaticamente
    const { data: codigoMapeado } = await supabase
      .from('fabrica_codigos_fornecedor')
      .select('*, produto_interno:fabrica_materias_primas(*)')
      .eq('fornecedor_id', fornecedorId)
      .eq('codigo_fornecedor', produto.codigo)
      .eq('ativo', true)
      .single();

    let produtoInternoId = null;
    let codigoMapeadoId = null;
    let statusMapeamento = 'pending';
    let scoreSimilaridade = null;
    let quantidadeConvertida = null;
    let unidadeConvertida = null;

    if (codigoMapeado) {
      produtoInternoId = codigoMapeado.produto_interno_id;
      codigoMapeadoId = codigoMapeado.id;
      statusMapeamento = 'mapped';
      quantidadeConvertida = produto.quantidade * codigoMapeado.fator_conversao;
      unidadeConvertida = codigoMapeado.produto_interno?.unidade_medida_id || produto.unidade;
      mapeados++;
    } else {
      // Tentar mapeamento por NCM (simplificado)
      const { data: porNCM } = await supabase
        .from('fabrica_materias_primas')
        .select('id')
        .ilike('codigo', `%${produto.ncm}%`)
        .limit(1)
        .single();

      if (porNCM) {
        produtoInternoId = porNCM.id;
        statusMapeamento = 'manual_review';
        scoreSimilaridade = 0.5; // Score baixo, requer revisão
      }
      
      naoMapeados++;
    }

    // Inserir item
    await supabase.from('fabrica_itens_nf').insert({
      nota_id: notaId,
      numero_item: produto.numero_item,
      codigo_fornecedor: produto.codigo,
      descricao: produto.descricao,
      ncm: produto.ncm,
      cfop: produto.cfop,
      unidade: produto.unidade,
      quantidade: produto.quantidade,
      valor_unitario: produto.valor_unitario,
      valor_total: produto.valor_total,
      produto_interno_id: produtoInternoId,
      codigo_mapeado_id: codigoMapeadoId,
      status_mapeamento: statusMapeamento,
      score_similaridade: scoreSimilaridade,
      quantidade_convertida: quantidadeConvertida,
      unidade_convertida: unidadeConvertida,
    });
  }

  return { mapeados, naoMapeados };
}