/**
 * Regras fiscais para determinação automática de ICMS ST e crédito
 */

/**
 * Tipos de operação fiscal na entrada
 */
export enum TipoOperacaoEntrada {
  IMPORTACAO_DIRETA = 'importacao_direta',
  COMPRA_INTERESTADUAL = 'compra_interestadual',
  COMPRA_INTERNA = 'compra_interna',
  USO_CONSUMO = 'uso_consumo',
  ATIVO_IMOBILIZADO = 'ativo_imobilizado',
}

/**
 * Interface para regra de CST na entrada
 */
export interface RegraCSTEntrada {
  cst: string;
  descricao: string;
  gera_credito: boolean;
  tipo_credito: string;
  requer_st: boolean;
  observacao?: string;
}

/**
 * Mapeamento CFOP → Tipo de Operação
 */
export function identificarTipoOperacao(cfop: string | null): TipoOperacaoEntrada | null {
  if (!cfop) return null;
  
  const cfopNum = cfop.replace(/\D/g, '');
  
  // Importação direta (3.xxx)
  if (['3101', '3102', '3103', '3104'].includes(cfopNum)) {
    return TipoOperacaoEntrada.IMPORTACAO_DIRETA;
  }
  
  // Uso e consumo
  if (['1103', '2103', '3103'].includes(cfopNum)) {
    return TipoOperacaoEntrada.USO_CONSUMO;
  }
  
  // Ativo imobilizado
  if (['1104', '2104', '3104'].includes(cfopNum)) {
    return TipoOperacaoEntrada.ATIVO_IMOBILIZADO;
  }
  
  // Compra interestadual (2.xxx)
  if (cfopNum.startsWith('2')) {
    return TipoOperacaoEntrada.COMPRA_INTERESTADUAL;
  }
  
  // Compra interna (1.xxx)
  if (cfopNum.startsWith('1')) {
    return TipoOperacaoEntrada.COMPRA_INTERNA;
  }
  
  return null;
}

/**
 * Regras de CST por tipo de operação
 */
export const REGRAS_CST_ENTRADA: Record<TipoOperacaoEntrada, RegraCSTEntrada[]> = {
  [TipoOperacaoEntrada.IMPORTACAO_DIRETA]: [
    {
      cst: '00',
      descricao: 'Tributada integralmente - ICMS próprio destacado',
      gera_credito: true,
      tipo_credito: 'integral',
      requer_st: false,
    },
    {
      cst: '40',
      descricao: 'Isenta',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
    {
      cst: '41',
      descricao: 'Não tributada',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
    {
      cst: '51',
      descricao: 'Diferimento parcial',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
      observacao: 'Tributação diferida',
    },
    {
      cst: '70',
      descricao: 'Com redução de BC e ICMS ST',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: true,
      observacao: 'Operação com ST - sem crédito',
    },
  ],
  
  [TipoOperacaoEntrada.COMPRA_INTERESTADUAL]: [
    {
      cst: '00',
      descricao: 'Tributada integralmente - ICMS próprio',
      gera_credito: true,
      tipo_credito: 'integral',
      requer_st: false,
    },
    {
      cst: '20',
      descricao: 'Com redução de BC',
      gera_credito: true,
      tipo_credito: 'proporcional',
      requer_st: false,
    },
    {
      cst: '10',
      descricao: 'Tributada e com cobrança de ICMS ST',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: true,
    },
    {
      cst: '70',
      descricao: 'Com redução de BC e ICMS ST',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: true,
    },
    {
      cst: '60',
      descricao: 'ICMS cobrado anteriormente por ST',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: true,
    },
    {
      cst: '40',
      descricao: 'Isenta',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
    {
      cst: '41',
      descricao: 'Não tributada',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
  ],
  
  [TipoOperacaoEntrada.COMPRA_INTERNA]: [
    {
      cst: '00',
      descricao: 'Tributada integralmente - ICMS próprio',
      gera_credito: true,
      tipo_credito: 'integral',
      requer_st: false,
    },
    {
      cst: '20',
      descricao: 'Com redução de BC',
      gera_credito: true,
      tipo_credito: 'proporcional',
      requer_st: false,
    },
    {
      cst: '60',
      descricao: 'ICMS cobrado anteriormente por ST',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: true,
    },
    {
      cst: '40',
      descricao: 'Isenta',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
    {
      cst: '41',
      descricao: 'Não tributada',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
    {
      cst: '50',
      descricao: 'Suspensão',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
  ],
  
  [TipoOperacaoEntrada.USO_CONSUMO]: [
    {
      cst: '00',
      descricao: 'Tributada integralmente - sem crédito (uso/consumo)',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
      observacao: 'Material de uso/consumo não gera crédito',
    },
    {
      cst: '20',
      descricao: 'Com redução de BC - sem crédito (uso/consumo)',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
      observacao: 'Material de uso/consumo não gera crédito',
    },
    {
      cst: '40',
      descricao: 'Isenta',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
    {
      cst: '41',
      descricao: 'Não tributada',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
    },
  ],
  
  [TipoOperacaoEntrada.ATIVO_IMOBILIZADO]: [
    {
      cst: '40',
      descricao: 'Isenta - sem crédito (ativo imobilizado)',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
      observacao: 'Ativo imobilizado não gera crédito imediato',
    },
    {
      cst: '41',
      descricao: 'Não tributada - sem crédito (ativo imobilizado)',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
      observacao: 'Ativo imobilizado não gera crédito imediato',
    },
    {
      cst: '50',
      descricao: 'Suspensão - sem crédito (ativo imobilizado)',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
      observacao: 'Ativo imobilizado não gera crédito imediato',
    },
    {
      cst: '51',
      descricao: 'Diferimento - sem crédito (ativo imobilizado)',
      gera_credito: false,
      tipo_credito: 'sem_credito',
      requer_st: false,
      observacao: 'Ativo imobilizado não gera crédito imediato',
    },
  ],
};

/**
 * Sugere CST baseado no tipo de operação e características da nota
 */
export function sugerirCST(
  cfop: string | null,
  temIcmsProprio: boolean,
  valorIcmsST: number,
  temReducao: boolean,
  temIsencao: boolean
): RegraCSTEntrada | null {
  const tipoOp = identificarTipoOperacao(cfop);
  if (!tipoOp) return null;
  
  const regras = REGRAS_CST_ENTRADA[tipoOp];
  
  // Regra especial: se tem valor de ICMS ST > 0, é CST 60
  if (valorIcmsST > 0) {
    return regras.find(r => r.cst === '60') || null;
  }
  
  // Se tem isenção
  if (temIsencao) {
    return regras.find(r => r.cst === '40' || r.cst === '41') || null;
  }
  
  // Se tem redução + ST
  if (temReducao && valorIcmsST > 0) {
    return regras.find(r => r.cst === '70') || null;
  }
  
  // Se tem redução
  if (temReducao && temIcmsProprio) {
    return regras.find(r => r.cst === '20') || null;
  }
  
  // Se tem ICMS próprio destacado
  if (temIcmsProprio) {
    return regras.find(r => r.cst === '00') || null;
  }
  
  return regras[0]; // Retorna primeira regra como padrão
}

/**
 * Determina se um CST de ICMS é de Substituição Tributária
 */
export function isICMSST(cst: string | null): boolean {
  if (!cst) return false;
  
  const cstNumber = cst.replace(/\D/g, '');
  const stCodes = ['10', '30', '60', '70'];
  
  return stCodes.includes(cstNumber);
}

/**
 * Determina se um CST de ICMS gera crédito tributário
 * Validação cruzada com tipo de operação
 */
export function geraCredIcms(cst: string | null, cfop?: string | null): boolean {
  if (!cst) return false;
  
  const cstNumber = cst.replace(/\D/g, '');
  
  // CSTs de ST não geram crédito
  if (isICMSST(cst)) {
    return false;
  }
  
  // Validação por tipo de operação
  if (cfop) {
    const tipoOp = identificarTipoOperacao(cfop);
    
    // Uso/consumo e ativo não geram crédito
    if (tipoOp === TipoOperacaoEntrada.USO_CONSUMO || 
        tipoOp === TipoOperacaoEntrada.ATIVO_IMOBILIZADO) {
      return false;
    }
  }
  
  // CST 00: Tributado integralmente - gera crédito
  if (cstNumber === '00') return true;
  
  // CST 20: Com redução de BC - gera crédito proporcional
  if (cstNumber === '20') return true;
  
  // CST 90: Outros - gera crédito (requer validação)
  if (cstNumber === '90') return true;
  
  // Demais CSTs não geram crédito
  return false;
}

/**
 * Determina o tipo de crédito gerado pelo CST
 */
export function getTipoCreditoICMS(cst: string | null, cfop?: string | null): string {
  if (!cst || !geraCredIcms(cst, cfop)) return 'sem_credito';
  
  const cstNumber = cst.replace(/\D/g, '');
  
  if (cstNumber === '00') return 'integral';
  if (cstNumber === '20') return 'proporcional';
  if (cstNumber === '90') return 'parcial';
  
  return 'sem_credito';
}

/**
 * Determina se um CST de PIS/COFINS gera crédito
 */
export function geraCredPisCofins(cst: string | null): boolean {
  if (!cst) return false;
  
  const cstNumber = cst.replace(/\D/g, '');
  
  // CSTs que geram crédito
  const creditCodes = ['01', '02', '50', '51', '52', '53', '54', '55', '56'];
  
  return creditCodes.includes(cstNumber);
}

/**
 * Determina o tipo de crédito PIS/COFINS
 */
export function getTipoCreditoPisCofins(cst: string | null): string {
  if (!cst || !geraCredPisCofins(cst)) return 'sem_credito';
  
  const cstNumber = cst.replace(/\D/g, '');
  
  // CST 01, 02: operações tributáveis com alíquota básica
  if (['01', '02'].includes(cstNumber)) return 'integral';
  
  // CST 50-56: operações com direito a crédito - regime não cumulativo
  if (['50', '51', '52', '53', '54', '55', '56'].includes(cstNumber)) {
    return 'nao_cumulativo';
  }
  
  return 'sem_credito';
}

/**
 * Obtém todas as opções de CST para um tipo de operação
 */
export function getOpcoesCSTPorOperacao(cfop: string | null): RegraCSTEntrada[] {
  const tipoOp = identificarTipoOperacao(cfop);
  if (!tipoOp) return [];
  
  return REGRAS_CST_ENTRADA[tipoOp] || [];
}

/**
 * Obtém descrição do tipo de operação
 */
export function getDescricaoTipoOperacao(cfop: string | null): string {
  const tipoOp = identificarTipoOperacao(cfop);
  if (!tipoOp) return 'Operação não identificada';
  
  const descricoes: Record<TipoOperacaoEntrada, string> = {
    [TipoOperacaoEntrada.IMPORTACAO_DIRETA]: 'Importação Direta',
    [TipoOperacaoEntrada.COMPRA_INTERESTADUAL]: 'Compra Interestadual',
    [TipoOperacaoEntrada.COMPRA_INTERNA]: 'Compra Interna',
    [TipoOperacaoEntrada.USO_CONSUMO]: 'Uso e Consumo',
    [TipoOperacaoEntrada.ATIVO_IMOBILIZADO]: 'Ativo Imobilizado',
  };
  
  return descricoes[tipoOp];
}

/**
 * Interface para resultado de validação fiscal
 */
export interface FiscalValidation {
  tem_icms_st: boolean;
  gera_credito_icms: boolean;
  tipo_credito_icms: string;
  gera_credito_pis: boolean;
  tipo_credito_pis: string;
  gera_credito_cofins: boolean;
  tipo_credito_cofins: string;
  tipo_operacao?: string;
  cst_sugerido?: RegraCSTEntrada | null;
}

/**
 * Valida e retorna informações fiscais completas baseado nos CSTs e CFOP
 */
export function validateFiscalData(
  cstIcms: string | null,
  cstPis: string | null,
  cstCofins: string | null,
  cfop?: string | null,
  valorIcmsST?: number,
  temReducao?: boolean,
  temIsencao?: boolean
): FiscalValidation {
  const temIcmsProprio = !!cstIcms && !['40', '41', '50', '51'].includes(cstIcms.replace(/\D/g, ''));
  
  return {
    tem_icms_st: isICMSST(cstIcms),
    gera_credito_icms: geraCredIcms(cstIcms, cfop),
    tipo_credito_icms: getTipoCreditoICMS(cstIcms, cfop),
    gera_credito_pis: geraCredPisCofins(cstPis),
    tipo_credito_pis: getTipoCreditoPisCofins(cstPis),
    gera_credito_cofins: geraCredPisCofins(cstCofins),
    tipo_credito_cofins: getTipoCreditoPisCofins(cstCofins),
    tipo_operacao: cfop ? getDescricaoTipoOperacao(cfop) : undefined,
    cst_sugerido: cfop ? sugerirCST(
      cfop,
      temIcmsProprio,
      valorIcmsST || 0,
      temReducao || false,
      temIsencao || false
    ) : null,
  };
}
