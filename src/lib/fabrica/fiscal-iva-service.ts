/**
 * FiscalIVAService — Serviço isolado para cálculos da Reforma Tributária (IVA Dual CBS/IBS)
 * 
 * Não altera nenhuma regra existente de ICMS/PIS/COFINS.
 * Controlado pela feature flag `iva_dual_habilitado` em fabrica_empresa_config.
 */

export interface DebitoIVA {
  valor_cbs: number;
  valor_ibs: number;
}

export interface CreditoIVA {
  credito_cbs: number;
  credito_ibs: number;
}

export interface ApuracaoIVA {
  total_debitos_cbs: number;
  total_debitos_ibs: number;
  total_creditos_cbs: number;
  total_creditos_ibs: number;
  cbs_a_recolher: number;
  ibs_a_recolher: number;
  saldo_iva: number;
}

export interface ItemIVA {
  base_cbs: number;
  base_ibs: number;
  aliquota_cbs: number;
  aliquota_ibs: number;
  elegivel_credito?: boolean;
  tipo_operacao: "ENTRADA" | "SAIDA";
}

/**
 * Arredondamento fiscal padrão: 2 casas decimais
 */
export function arredondamentoFiscal(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Valida que a base de cálculo não é negativa
 */
function validarBase(base: number, campo: string): void {
  if (base < 0) {
    throw new Error(`Base de cálculo ${campo} não pode ser negativa: ${base}`);
  }
}

/**
 * Calcula débito IVA (operações de SAÍDA)
 */
export function calcularDebitoIVA(
  baseCalculo: number,
  aliquotaCBS: number,
  aliquotaIBS: number
): DebitoIVA {
  validarBase(baseCalculo, "débito");

  return {
    valor_cbs: arredondamentoFiscal(baseCalculo * (aliquotaCBS / 100)),
    valor_ibs: arredondamentoFiscal(baseCalculo * (aliquotaIBS / 100)),
  };
}

/**
 * Calcula crédito IVA (operações de ENTRADA)
 * Retorna zero se não for elegível
 */
export function calcularCreditoIVA(
  baseCalculo: number,
  aliquotaCBS: number,
  aliquotaIBS: number,
  elegivel: boolean
): CreditoIVA {
  if (!elegivel) {
    return { credito_cbs: 0, credito_ibs: 0 };
  }

  validarBase(baseCalculo, "crédito");

  return {
    credito_cbs: arredondamentoFiscal(baseCalculo * (aliquotaCBS / 100)),
    credito_ibs: arredondamentoFiscal(baseCalculo * (aliquotaIBS / 100)),
  };
}

/**
 * Calcula apuração consolidada IVA para um período
 */
export function calcularApuracaoIVA(
  debitos: DebitoIVA[],
  creditos: CreditoIVA[]
): ApuracaoIVA {
  const total_debitos_cbs = arredondamentoFiscal(
    debitos.reduce((sum, d) => sum + d.valor_cbs, 0)
  );
  const total_debitos_ibs = arredondamentoFiscal(
    debitos.reduce((sum, d) => sum + d.valor_ibs, 0)
  );
  const total_creditos_cbs = arredondamentoFiscal(
    creditos.reduce((sum, c) => sum + c.credito_cbs, 0)
  );
  const total_creditos_ibs = arredondamentoFiscal(
    creditos.reduce((sum, c) => sum + c.credito_ibs, 0)
  );

  const cbs_a_recolher = arredondamentoFiscal(total_debitos_cbs - total_creditos_cbs);
  const ibs_a_recolher = arredondamentoFiscal(total_debitos_ibs - total_creditos_ibs);

  return {
    total_debitos_cbs,
    total_debitos_ibs,
    total_creditos_cbs,
    total_creditos_ibs,
    cbs_a_recolher,
    ibs_a_recolher,
    saldo_iva: arredondamentoFiscal(cbs_a_recolher + ibs_a_recolher),
  };
}

/**
 * Processa um item fiscal e retorna débito ou crédito conforme tipo de operação
 */
export function processarItemIVA(item: ItemIVA): { debito?: DebitoIVA; credito?: CreditoIVA } {
  if (item.tipo_operacao === "SAIDA") {
    return {
      debito: calcularDebitoIVA(item.base_cbs, item.aliquota_cbs, item.aliquota_ibs),
    };
  }

  return {
    credito: calcularCreditoIVA(
      item.base_cbs,
      item.aliquota_cbs,
      item.aliquota_ibs,
      item.elegivel_credito !== false
    ),
  };
}

/**
 * Simula cálculo IVA para um conjunto de itens
 */
export function simularIVA(itens: ItemIVA[]): ApuracaoIVA {
  const debitos: DebitoIVA[] = [];
  const creditos: CreditoIVA[] = [];

  for (const item of itens) {
    const resultado = processarItemIVA(item);
    if (resultado.debito) debitos.push(resultado.debito);
    if (resultado.credito) creditos.push(resultado.credito);
  }

  return calcularApuracaoIVA(debitos, creditos);
}
