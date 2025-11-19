import { supabase } from "@/integrations/supabase/client";

export interface NecessidadeMRP {
  mp_id: string;
  mp_codigo: string;
  mp_nome: string;
  data_necessidade: Date;
  quantidade_necessaria: number;
  quantidade_disponivel: number;
  quantidade_a_comprar: number;
  lead_time_dias: number;
  data_sugestao_compra: Date;
}

export interface SugestaoCompra {
  mp_id: string;
  mp_codigo: string;
  mp_nome: string;
  quantidade: number;
  preco_estimado: number;
  custo_total: number;
  fornecedor_id?: string;
  data_pedido_sugerida: Date;
  data_entrega_esperada: Date;
  urgencia: "critica" | "alta" | "media" | "baixa";
}

export interface AlertaRuptura {
  mp_id: string;
  mp_codigo: string;
  mp_nome: string;
  estoque_atual: number;
  estoque_minimo: number;
  dias_ate_ruptura: number;
  severidade: "critica" | "alta" | "media";
}

export async function calcularMRP(
  dataInicio: Date,
  dataFim: Date
): Promise<{
  necessidadesPorMP: Map<string, NecessidadeMRP[]>;
  sugestoesCompra: SugestaoCompra[];
  alertasRuptura: AlertaRuptura[];
}> {
  const necessidadesPorMP = new Map<string, NecessidadeMRP[]>();
  const sugestoesCompra: SugestaoCompra[] = [];
  const alertasRuptura: AlertaRuptura[] = [];

  // Buscar ordens de produção no período
  const { data: ordensProducao, error: ordensError } = await supabase
    .from("fabrica_ordens_producao")
    .select(`
      *,
      fabrica_formulas (
        *,
        fabrica_formula_itens (
          *,
          fabrica_materias_primas (*)
        )
      )
    `)
    .gte("data_prevista", dataInicio.toISOString())
    .lte("data_prevista", dataFim.toISOString())
    .in("status", ["pendente", "em_producao"]);

  if (ordensError) throw ordensError;

  // Calcular necessidades por MP
  ordensProducao?.forEach((op) => {
    const formula = op.fabrica_formulas;
    const itens = formula?.fabrica_formula_itens || [];

    itens.forEach((item: any) => {
      const mp = item.fabrica_materias_primas;
      const quantidadeNecessaria =
        item.quantidade * op.quantidade_planejada;

      const necessidade: NecessidadeMRP = {
        mp_id: mp.id,
        mp_codigo: mp.codigo,
        mp_nome: mp.nome,
        data_necessidade: new Date(op.data_prevista),
        quantidade_necessaria: quantidadeNecessaria,
        quantidade_disponivel: mp.estoque_atual || 0,
        quantidade_a_comprar: Math.max(
          0,
          quantidadeNecessaria - (mp.estoque_atual || 0)
        ),
        lead_time_dias: mp.lead_time_dias || 7,
        data_sugestao_compra: new Date(
          new Date(op.data_prevista).getTime() -
            (mp.lead_time_dias || 7) * 24 * 60 * 60 * 1000
        ),
      };

      if (!necessidadesPorMP.has(mp.id)) {
        necessidadesPorMP.set(mp.id, []);
      }
      necessidadesPorMP.get(mp.id)?.push(necessidade);
    });
  });

  // Gerar sugestões de compra
  necessidadesPorMP.forEach((necessidades, mpId) => {
    const totalNecessario = necessidades.reduce(
      (sum, n) => sum + n.quantidade_a_comprar,
      0
    );

    if (totalNecessario > 0) {
      const primeiraNecessidade = necessidades[0];
      const mp = primeiraNecessidade;

      sugestoesCompra.push({
        mp_id: mpId,
        mp_codigo: mp.mp_codigo,
        mp_nome: mp.mp_nome,
        quantidade: totalNecessario,
        preco_estimado: 0, // Buscar do histórico
        custo_total: 0,
        data_pedido_sugerida: mp.data_sugestao_compra,
        data_entrega_esperada: new Date(
          mp.data_sugestao_compra.getTime() +
            mp.lead_time_dias * 24 * 60 * 60 * 1000
        ),
        urgencia:
          mp.lead_time_dias <= 3
            ? "critica"
            : mp.lead_time_dias <= 7
            ? "alta"
            : mp.lead_time_dias <= 15
            ? "media"
            : "baixa",
      });
    }
  });

  // Identificar alertas de ruptura
  const { data: mpsEmRisco } = await supabase
    .from("fabrica_materias_primas")
    .select("*")
    .or("estoque_atual.lt.estoque_minimo,estoque_atual.lt.ponto_reposicao");

  mpsEmRisco?.forEach((mp) => {
    const diasAteRuptura = Math.floor(
      (mp.estoque_atual || 0) / ((mp.estoque_minimo || 1) / 30)
    );

    alertasRuptura.push({
      mp_id: mp.id,
      mp_codigo: mp.codigo,
      mp_nome: mp.nome,
      estoque_atual: mp.estoque_atual || 0,
      estoque_minimo: mp.estoque_minimo || 0,
      dias_ate_ruptura: Math.max(0, diasAteRuptura),
      severidade:
        diasAteRuptura <= 0
          ? "critica"
          : diasAteRuptura <= 7
          ? "alta"
          : "media",
    });
  });

  return {
    necessidadesPorMP,
    sugestoesCompra,
    alertasRuptura,
  };
}

export function calcularPontoPedido(
  estoqueAtual: number,
  estoqueSeguranca: number,
  consumoMedioDiario: number,
  leadTimeDias: number
): number {
  return estoqueSeguranca + consumoMedioDiario * leadTimeDias;
}
