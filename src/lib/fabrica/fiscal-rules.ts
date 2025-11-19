/**
 * Regras fiscais para determinação automática de ICMS ST e crédito
 */

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
 */
export function geraCredIcms(cst: string | null): boolean {
  if (!cst) return false;
  
  const cstNumber = cst.replace(/\D/g, '');
  
  // CSTs de ST não geram crédito
  if (isICMSST(cst)) {
    return false;
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
export function getTipoCreditoICMS(cst: string | null): string {
  if (!cst || !geraCredIcms(cst)) return 'sem_credito';
  
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
}

/**
 * Valida e retorna informações fiscais completas baseado nos CSTs
 */
export function validateFiscalData(
  cstIcms: string | null,
  cstPis: string | null,
  cstCofins: string | null
): FiscalValidation {
  return {
    tem_icms_st: isICMSST(cstIcms),
    gera_credito_icms: geraCredIcms(cstIcms),
    tipo_credito_icms: getTipoCreditoICMS(cstIcms),
    gera_credito_pis: geraCredPisCofins(cstPis),
    tipo_credito_pis: getTipoCreditoPisCofins(cstPis),
    gera_credito_cofins: geraCredPisCofins(cstCofins),
    tipo_credito_cofins: getTipoCreditoPisCofins(cstCofins),
  };
}
