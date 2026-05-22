import { exportToExcel } from "@/lib/excel-utils";
import {
  buildComparativoRows,
  classificacaoProvador,
  type CenarioCustoAgg,
} from "@/components/fabrica/analises/analises-utils";

interface ProvadorRow {
  provador_codigo: string;
  provador_nome: string;
  pai_codigo: string;
  pai_nome: string;
  custo_fabrica: number;
  custo_pai: number;
  pct_do_pai: number;
}

export async function exportAnalisesCustos(opts: {
  custosArr: CenarioCustoAgg[];
  provadores: ProvadorRow[];
  grupoLabel: string;
}) {
  const { custosArr, provadores, grupoLabel } = opts;

  const comparativoRows = buildComparativoRows(custosArr).map((r) => ({
    "Código ERP": r.codigo,
    Produto: r.nome,
    Tipo: r.tipo,
    "Custo Sim01": r.custoSim01,
    "Custo Sim02": r.custoSim02,
    "Diferença R$": r.delta,
    "Diferença %": r.deltaPct,
    Status: r.status,
    Observação: r.observacao,
  }));

  const consolidadoRows = custosArr.map((c) => ({
    "Código ERP": c.produto.codigo,
    SKU: c.produto.cenario_label || c.produto.nome,
    Tipo: (c.produto.tipo || "OFICIAL").toUpperCase(),
    Marca: c.produto.marca,
    "Total Insumos": c.totalInsumos,
    "IPI (R$)": c.ipiTotal,
    "Total NF": c.totalNF,
    Serviço: c.totalServico,
    Condição: c.totalCondicao,
    "NF Made In": c.totalNFMadeIn,
    "Mão de obra NF": c.custoMaoObraNF,
    "Mão de obra Serviço": c.custoMaoObraServico,
    "CUSTO FINAL": c.custoFinal,
  }));

  const provadoresRows = provadores.map((p) => ({
    "Cód. Provador": p.provador_codigo,
    "SKU Provador": p.provador_nome,
    "Cód. ERP Pai": p.pai_codigo,
    "Produto Pai": p.pai_nome,
    "Custo Provador": p.custo_fabrica,
    "Custo Pai": p.custo_pai,
    "% do Pai": p.pct_do_pai,
    Classificação: classificacaoProvador(p.pct_do_pai),
  }));

  const safe = grupoLabel.replace(/[^\w\-]+/g, "_").slice(0, 40) || "grupo";
  await exportToExcel(
    [
      { name: "Comparativo_Sim01_Sim02", data: comparativoRows },
      { name: "Consolidado", data: consolidadoRows },
      { name: "Precos_Provadores", data: provadoresRows },
    ],
    `analises_custos_${safe}.xlsx`,
  );
}
