/**
 * Parser client-side de XML NF-e
 * Extrai dados básicos do XML sem persistir nada no banco
 */

function getTagValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

export interface NFeXmlProduto {
  numero_item: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface NFeXmlFornecedor {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
}

export interface NFeXmlData {
  numero: string;
  serie: string;
  chave_acesso: string;
  data_emissao: string;
  valor_total: number;
  fornecedor: NFeXmlFornecedor;
  produtos: NFeXmlProduto[];
}

export function parseNFeXml(xmlText: string): NFeXmlData {
  return {
    chave_acesso: getTagValue(xmlText, 'chNFe'),
    numero: getTagValue(xmlText, 'nNF'),
    serie: getTagValue(xmlText, 'serie'),
    data_emissao: getTagValue(xmlText, 'dhEmi').substring(0, 10),
    valor_total: parseFloat(getTagValue(xmlText, 'vNF')) || 0,
    fornecedor: {
      cnpj: getTagValue(xmlText, 'CNPJ'),
      razao_social: getTagValue(xmlText, 'xNome'),
      nome_fantasia: getTagValue(xmlText, 'xFant'),
    },
    produtos: extractProducts(xmlText),
  };
}

function extractProducts(xmlText: string): NFeXmlProduto[] {
  const products: NFeXmlProduto[] = [];
  const detRegex = /<det nItem="(\d+)">(.*?)<\/det>/gs;
  let match;

  while ((match = detRegex.exec(xmlText)) !== null) {
    const nItem = parseInt(match[1]);
    const detContent = match[2];

    products.push({
      numero_item: nItem,
      codigo: getTagValue(detContent, 'cProd'),
      descricao: getTagValue(detContent, 'xProd'),
      ncm: getTagValue(detContent, 'NCM'),
      cfop: getTagValue(detContent, 'CFOP'),
      unidade: getTagValue(detContent, 'uCom'),
      quantidade: parseFloat(getTagValue(detContent, 'qCom')) || 0,
      valor_unitario: parseFloat(getTagValue(detContent, 'vUnCom')) || 0,
      valor_total: parseFloat(getTagValue(detContent, 'vProd')) || 0,
    });
  }

  return products;
}
