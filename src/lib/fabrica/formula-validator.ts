export interface FormulaItem {
  mp_id: string;
  quantidade: number;
  percentual?: number;
  criticidade?: string;
}

export interface ResultadoValidacao {
  valida: boolean;
  erros: string[];
  avisos: string[];
}

export function validarFormula(itens: FormulaItem[]): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  // Verificar se há itens
  if (!itens || itens.length === 0) {
    erros.push("A fórmula deve ter pelo menos um ingrediente");
    return { valida: false, erros, avisos };
  }

  // Verificar soma de percentuais
  const somaPercentuais = itens.reduce((sum, item) => {
    return sum + (item.percentual || 0);
  }, 0);

  const tolerancia = 0.01; // 0.01% de tolerância
  if (Math.abs(somaPercentuais - 100) > tolerancia) {
    erros.push(
      `A soma dos percentuais deve ser 100%. Atual: ${somaPercentuais.toFixed(2)}%`
    );
  }

  // Verificar quantidades negativas
  itens.forEach((item, index) => {
    if (item.quantidade <= 0) {
      erros.push(`Item ${index + 1}: Quantidade deve ser maior que zero`);
    }
  });

  // Verificar MPs duplicadas
  const mpsIds = itens.map((item) => item.mp_id);
  const duplicadas = mpsIds.filter(
    (id, index) => mpsIds.indexOf(id) !== index
  );
  if (duplicadas.length > 0) {
    erros.push("Existem matérias-primas duplicadas na fórmula");
  }

  // Avisos para ingredientes críticos
  const criticos = itens.filter((item) => item.criticidade === "critico");
  if (criticos.length === 0) {
    avisos.push(
      "Nenhum ingrediente marcado como crítico. Considere revisar."
    );
  }

  return {
    valida: erros.length === 0,
    erros,
    avisos,
  };
}
