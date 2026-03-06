import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função helper para extrair valor do XML
function getTagValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

// Interface completa de produto XML (TODOS OS IMPOSTOS)
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
  
  // ICMS
  cst_icms?: string;
  aliquota_icms?: number;
  valor_icms?: number;
  base_icms?: number;
  
  // ICMS ST
  valor_icms_st?: number;
  base_icms_st?: number;
  aliquota_icms_st?: number;
  
  // IPI
  cst_ipi?: string;
  aliquota_ipi?: number;
  valor_ipi?: number;
  
  // PIS
  cst_pis?: string;
  aliquota_pis?: number;
  valor_pis?: number;
  base_pis?: number;
  
  // COFINS
  cst_cofins?: string;
  aliquota_cofins?: number;
  valor_cofins?: number;
  base_cofins?: number;
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

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    const { xml } = await req.json();
    console.log('[process-nfe-xml] Iniciando processamento do XML');

    const xmlData = parseXML(xml);
    console.log('[process-nfe-xml] XML parseado:', xmlData.chave_acesso);

    // Verificar duplicidade
    const { data: existing } = await supabase
      .from('fabrica_notas_fiscais')
      .select('id')
      .eq('chave_acesso', xmlData.chave_acesso)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ 
          error: 'Nota fiscal já foi importada anteriormente',
          nota_id: existing.id,
          duplicada: true
        }),
        { 
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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

    // Processar itens com TODOS os impostos
    const itensProcessados = await processarItens(supabase, nota.id, fornecedorId, xmlData.produtos);

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

    const produto: XMLProduct = {
      numero_item: nItem,
      codigo: getTagValue(detContent, 'cProd'),
      descricao: getTagValue(detContent, 'xProd'),
      ncm: getTagValue(detContent, 'NCM'),
      cfop: getTagValue(detContent, 'CFOP'),
      unidade: getTagValue(detContent, 'uCom'),
      quantidade: parseFloat(getTagValue(detContent, 'qCom')),
      valor_unitario: parseFloat(getTagValue(detContent, 'vUnCom')),
      valor_total: parseFloat(getTagValue(detContent, 'vProd')),
    };

    // ICMS
    const icmsSection = detContent.match(/<ICMS>(.*?)<\/ICMS>/s)?.[1] || '';
    produto.cst_icms = getTagValue(icmsSection, 'CST') || getTagValue(icmsSection, 'CSOSN');
    const vICMS = getTagValue(icmsSection, 'vICMS');
    const pICMS = getTagValue(icmsSection, 'pICMS');
    const vBC = getTagValue(icmsSection, 'vBC');
    if (vICMS) produto.valor_icms = parseFloat(vICMS);
    if (pICMS) produto.aliquota_icms = parseFloat(pICMS);
    if (vBC) produto.base_icms = parseFloat(vBC);

    // ICMS ST
    const vICMSST = getTagValue(icmsSection, 'vICMSST');
    const pICMSST = getTagValue(icmsSection, 'pICMSST');
    const vBCST = getTagValue(icmsSection, 'vBCST');
    if (vICMSST) produto.valor_icms_st = parseFloat(vICMSST);
    if (pICMSST) produto.aliquota_icms_st = parseFloat(pICMSST);
    if (vBCST) produto.base_icms_st = parseFloat(vBCST);

    // IPI
    const ipiSection = detContent.match(/<IPI>(.*?)<\/IPI>/s)?.[1] || '';
    produto.cst_ipi = getTagValue(ipiSection, 'CST');
    const vIPI = getTagValue(ipiSection, 'vIPI');
    const pIPI = getTagValue(ipiSection, 'pIPI');
    if (vIPI) produto.valor_ipi = parseFloat(vIPI);
    if (pIPI) produto.aliquota_ipi = parseFloat(pIPI);

    // PIS
    const pisSection = detContent.match(/<PIS>(.*?)<\/PIS>/s)?.[1] || '';
    produto.cst_pis = getTagValue(pisSection, 'CST');
    const vPIS = getTagValue(pisSection, 'vPIS');
    const pPIS = getTagValue(pisSection, 'pPIS');
    const vBCPIS = getTagValue(pisSection, 'vBC');
    if (vPIS) produto.valor_pis = parseFloat(vPIS);
    if (pPIS) produto.aliquota_pis = parseFloat(pPIS);
    if (vBCPIS) produto.base_pis = parseFloat(vBCPIS);

    // COFINS
    const cofinsSection = detContent.match(/<COFINS>(.*?)<\/COFINS>/s)?.[1] || '';
    produto.cst_cofins = getTagValue(cofinsSection, 'CST');
    const vCOFINS = getTagValue(cofinsSection, 'vCOFINS');
    const pCOFINS = getTagValue(cofinsSection, 'pCOFINS');
    const vBCCOFINS = getTagValue(cofinsSection, 'vBC');
    if (vCOFINS) produto.valor_cofins = parseFloat(vCOFINS);
    if (pCOFINS) produto.aliquota_cofins = parseFloat(pCOFINS);
    if (vBCCOFINS) produto.base_cofins = parseFloat(vBCCOFINS);

    products.push(produto);
  }

  return products;
}

async function buscarOuCriarFornecedor(supabase: any, fornecedor: any): Promise<string> {
  const { data: existing } = await supabase
    .from('fabrica_fornecedores')
    .select('id')
    .eq('cnpj', fornecedor.cnpj)
    .single();

  if (existing) return existing.id;

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

// Regras fiscais inline (usar as mesmas do frontend)
function isICMSST(cst: string | null): boolean {
  if (!cst) return false;
  const cstNumber = cst.replace(/\D/g, '');
  return ['10', '30', '60', '70'].includes(cstNumber);
}

function geraCredIcms(cst: string | null): boolean {
  if (!cst) return false;
  const cstNumber = cst.replace(/\D/g, '');
  if (isICMSST(cst)) return false;
  return ['00', '20', '90'].includes(cstNumber);
}

function geraCredPisCofins(cst: string | null): boolean {
  if (!cst) return false;
  const cstNumber = cst.replace(/\D/g, '');
  return ['01', '02', '50', '51', '52', '53', '54', '55', '56'].includes(cstNumber);
}

function geraCredIPI(cst: string | null): boolean {
  if (!cst) return false;
  const cstNumber = cst.replace(/\D/g, '');
  return ['00', '01', '02', '03', '04', '05', '49', '50', '51', '52', '53', '54', '55'].includes(cstNumber);
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
      naoMapeados++;
    }

    // Determinar flags de crédito
    const temIcmsST = isICMSST(produto.cst_icms || null);
    const geraCreditoIcms = geraCredIcms(produto.cst_icms || null);
    const geraCreditoPis = geraCredPisCofins(produto.cst_pis || null);
    const geraCreditoCofins = geraCredPisCofins(produto.cst_cofins || null);
    const geraCreditoIPI = geraCredIPI(produto.cst_ipi || null);

    // Calcular custo de entrada (Valor + IPI + ICMS ST)
    const custoTotal = produto.valor_total + 
                      (produto.valor_ipi || 0) + 
                      (produto.valor_icms_st || 0);
    const custoUnitario = custoTotal / produto.quantidade;

    // Inserir item COM TODOS OS IMPOSTOS
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
      
      // ICMS
      cst_icms: produto.cst_icms || null,
      aliquota_icms: produto.aliquota_icms || null,
      valor_icms: produto.valor_icms || null,
      base_icms: produto.base_icms || null,
      tem_icms_st: temIcmsST,
      gera_credito_icms: geraCreditoIcms,
      
      // ICMS ST
      valor_icms_st: produto.valor_icms_st || null,
      base_icms_st: produto.base_icms_st || null,
      aliquota_icms_st: produto.aliquota_icms_st || null,
      
      // IPI
      cst_ipi: produto.cst_ipi || null,
      aliquota_ipi: produto.aliquota_ipi || null,
      valor_ipi: produto.valor_ipi || null,
      gera_credito_ipi: geraCreditoIPI,
      
      // PIS
      cst_pis: produto.cst_pis || null,
      aliquota_pis: produto.aliquota_pis || null,
      valor_pis: produto.valor_pis || null,
      base_pis: produto.base_pis || null,
      gera_credito_pis: geraCreditoPis,
      
      // COFINS
      cst_cofins: produto.cst_cofins || null,
      aliquota_cofins: produto.aliquota_cofins || null,
      valor_cofins: produto.valor_cofins || null,
      base_cofins: produto.base_cofins || null,
      gera_credito_cofins: geraCreditoCofins,
      
      // Custo calculado
      custo_unitario_entrada: custoUnitario,
      custo_total_entrada: custoTotal,
      
      // Mapeamento
      produto_interno_id: produtoInternoId,
      codigo_mapeado_id: codigoMapeadoId,
      status_mapeamento: statusMapeamento,
      quantidade_convertida: quantidadeConvertida,
      unidade_convertida: unidadeConvertida,
      
      // Validação pendente
      validado_fiscalmente: false,
    });
  }

  return { mapeados, naoMapeados };
}