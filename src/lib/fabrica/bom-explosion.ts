import { supabase } from "@/integrations/supabase/client";

export interface MaterialNecessario {
  mp_id: string;
  mp_codigo: string;
  mp_nome: string;
  quantidade_necessaria: number;
  unidade: string;
  estoque_disponivel: number;
  falta: number;
  custo_unitario: number;
  custo_total: number;
}

export interface ResultadoExplosao {
  materiaisNecessarios: MaterialNecessario[];
  custoTotalEstimado: number;
  tempoProducaoEstimado: number;
  alertas: string[];
}

export async function explodirBOM(
  formulaId: string,
  quantidadeProduzir: number,
  considerarPerdas: boolean = true
): Promise<ResultadoExplosao> {
  const alertas: string[] = [];

  // Buscar fórmula
  const { data: formula, error: formulaError } = await supabase
    .from("fabrica_formulas")
    .select("*, fabrica_produtos(*)")
    .eq("id", formulaId)
    .single();

  if (formulaError || !formula) {
    throw new Error("Fórmula não encontrada");
  }

  // Buscar itens da fórmula
  const { data: itens, error: itensError } = await supabase
    .from("fabrica_formula_itens")
    .select(`
      *,
      fabrica_materias_primas!mp_id (
        id,
        codigo,
        nome,
        estoque_atual,
        custo_unitario,
        fabrica_unidades_medida (sigla)
      )
    `)
    .eq("formula_id", formulaId)
    .order("ordem_adicao");

  if (itensError || !itens) {
    throw new Error("Erro ao buscar itens da fórmula");
  }

  // Calcular materiais necessários
  const materiaisNecessarios: MaterialNecessario[] = itens.map((item) => {
    const mp = item.fabrica_materias_primas;
    let quantidadeNecessaria = item.quantidade * quantidadeProduzir;

    // Considerar perdas esperadas
    if (considerarPerdas && formula.perdas_esperadas) {
      quantidadeNecessaria *= 1 + formula.perdas_esperadas / 100;
    }

    const estoqueDisponivel = mp?.estoque_atual || 0;
    const falta = Math.max(0, quantidadeNecessaria - estoqueDisponivel);
    const custoUnitario = mp?.custo_unitario || 0;
    const custoTotal = quantidadeNecessaria * custoUnitario;

    // Alertas
    if (falta > 0) {
      alertas.push(
        `Falta ${falta.toFixed(2)} ${mp?.fabrica_unidades_medida?.sigla} de ${mp?.nome}`
      );
    }

    return {
      mp_id: mp?.id || "",
      mp_codigo: mp?.codigo || "",
      mp_nome: mp?.nome || "",
      quantidade_necessaria: quantidadeNecessaria,
      unidade: mp?.fabrica_unidades_medida?.sigla || "",
      estoque_disponivel: estoqueDisponivel,
      falta,
      custo_unitario: custoUnitario,
      custo_total: custoTotal,
    };
  });

  // Calcular totais
  const custoTotalEstimado = materiaisNecessarios.reduce(
    (sum, mat) => sum + mat.custo_total,
    0
  );

  const tempoProducaoEstimado = formula.tempo_producao_minutos || 0;

  return {
    materiaisNecessarios,
    custoTotalEstimado,
    tempoProducaoEstimado,
    alertas,
  };
}
