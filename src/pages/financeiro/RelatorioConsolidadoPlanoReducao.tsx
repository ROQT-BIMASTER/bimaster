import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, FileDown, Sparkles, TrendingDown, Wallet,
  Calculator, PiggyBank, FileSpreadsheet, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import {
  useDespesasExtrasPlano, type DespesaExtra, type DespesaExtraTipo,
} from "@/hooks/useDespesasExtrasPlano";
import { getMesesPeriodo, labelMes, labelMesLongo } from "@/lib/financeiro/periodoMeses";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(280, 60%, 55%)",
];

const FOLHA_TI_PRESET = [
  { categoria: "Folha TI", descricao: "Leonardo Silva dos Santos – Auxiliar de Infraestrutura", valor_mensal: 4042.92 },
  { categoria: "Folha TI", descricao: "Luan Ribeiro de Almeida – Analista de Infraestrutura", valor_mensal: 5625.63 },
  { categoria: "Folha TI", descricao: "Thiago Vieira – Supervisor de T.I.", valor_mensal: 9842.84 },
];

const TIPO_LABELS: Record<DespesaExtraTipo, string> = {
  eliminar: "Eliminar",
  reduzir: "Reduzir",
  manter: "Manter",
};

export default function RelatorioConsolidadoPlanoReducao() {
  const { planoId } = useParams<{ planoId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Período fixo: Nov/2025–Abr/2026 (passa Abr/2026 como referência)
  const meses = useMemo(() => getMesesPeriodo(new Date(2026, 3, 1), 6), []);

  const { data: plano, isLoading: planoLoading } = useQuery({
    queryKey: ["plano-reducao", planoId],
    enabled: !!planoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_reducao")
        .select("*")
        .eq("id", planoId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const [custoSistema, setCustoSistema] = useState<string>("5500");
  useEffect(() => {
    if (plano?.custo_alvo_mensal != null) {
      setCustoSistema(String(plano.custo_alvo_mensal));
    }
  }, [plano?.custo_alvo_mensal]);

  const custoSistemaNum = Number((custoSistema || "0").toString().replace(",", ".")) || 0;

  const salvarCustoSistema = async () => {
    if (!planoId) return;
    const { error } = await supabase
      .from("planos_reducao")
      .update({ custo_alvo_mensal: custoSistemaNum })
      .eq("id", planoId);
    if (error) {
      toast.error("Falha ao salvar custo do sistema");
      return;
    }
    qc.invalidateQueries({ queryKey: ["plano-reducao", planoId] });
    toast.success("Custo do sistema atualizado");
  };

  const desp = useDespesasExtrasPlano(planoId);
  const despesas: DespesaExtra[] = desp.data || [];

  // Itens do plano (revisões)
  const { data: revisoes } = useQuery({
    queryKey: ["revisoes-plano", planoId],
    enabled: !!planoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar_revisao")
        .select("id, categoria_nome, fornecedor_nome, fornecedor_codigo, valor_atual, meta_reducao_valor, meta_reducao_percentual, tipo_revisao, status")
        .eq("plano_id", planoId!)
        .neq("status", "concluido");
      if (error) throw error;
      return data || [];
    },
  });

  // Histórico mensal real das revisões (por fornecedor + mês)
  const { data: revisoesHist } = useQuery({
    queryKey: ["revisoes-plano-hist", planoId, meses],
    enabled: !!planoId && (revisoes?.length ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_revisoes_plano_historico_mensal", {
        p_plano_id: planoId!,
        p_meses: meses,
      });
      if (error) throw error;
      // Map: revisao_id -> { mes -> valor }
      const m: Record<string, Record<string, number>> = {};
      (data || []).forEach((r: any) => {
        if (!m[r.revisao_id]) m[r.revisao_id] = {};
        m[r.revisao_id][r.mes] = Number(r.valor || 0);
      });
      return m;
    },
  });

  // Helpers de cálculo
  const valorMesDespesa = (d: DespesaExtra, mes: string): number => {
    const v = d.valores_mensais?.[mes];
    return typeof v === "number" ? v : Number(d.valor_mensal || 0);
  };

  // Regra: por fornecedor (mesmo fornecedor_codigo) só pode existir UMA
  // revisão efetiva. Prioridade: "eliminar" > "reduzir" > "manter".
  // Evita duplicação no consolidado quando o mesmo fornecedor aparece em
  // mais de uma revisão.
  const TIPO_PRIORIDADE: Record<string, number> = { eliminar: 3, reduzir: 2, manter: 1 };
  const revisoesEfetivas = useMemo(() => {
    const porFornecedor = new Map<string, any>();
    const semFornecedor: any[] = [];
    (revisoes || []).forEach((r: any) => {
      if (!r.fornecedor_codigo) {
        semFornecedor.push(r);
        return;
      }
      const key = String(r.fornecedor_codigo);
      const atual = porFornecedor.get(key);
      if (!atual) {
        porFornecedor.set(key, r);
        return;
      }
      const pAtual = TIPO_PRIORIDADE[String(atual.tipo_revisao)] || 0;
      const pNovo = TIPO_PRIORIDADE[String(r.tipo_revisao)] || 0;
      if (pNovo > pAtual) porFornecedor.set(key, r);
    });
    return [...porFornecedor.values(), ...semFornecedor];
  }, [revisoes]);

  // IDs duplicados (mesmo fornecedor_codigo, não escolhidos como efetivo)
  const revisoesDuplicadasIds = useMemo(() => {
    const efetivosIds = new Set(revisoesEfetivas.map((r: any) => r.id));
    return (revisoes || []).filter((r: any) => !efetivosIds.has(r.id)).map((r: any) => r.id);
  }, [revisoes, revisoesEfetivas]);

  const valorMesRevisao = (r: any, mes: string): number => {
    const real = revisoesHist?.[r.id]?.[mes];
    return typeof real === "number" ? real : 0;
  };

  const totalMesDespesas = (mes: string): number =>
    despesas.reduce((s, d) => s + valorMesDespesa(d, mes), 0);

  const totalMesRevisoes = (mes: string): number =>
    revisoesEfetivas.reduce((s, r: any) => s + valorMesRevisao(r, mes), 0);

  const totalMes = (mes: string): number => totalMesDespesas(mes) + totalMesRevisoes(mes);

  const mediaMensal = useMemo(() => {
    const soma = meses.reduce((s, m) => s + totalMes(m), 0);
    return soma / meses.length;
  }, [meses, despesas, revisoes, revisoesHist]);


  const economiaMensal = mediaMensal - custoSistemaNum;
  const economiaPct = mediaMensal > 0 ? (economiaMensal / mediaMensal) * 100 : 0;
  const economiaAnual = economiaMensal * 12;
  const payback = economiaMensal > 0 ? custoSistemaNum / economiaMensal : 0;

  // Totalizador de itens "a eliminar" (despesas extras + revisões), média mensal
  const mediaEliminar = useMemo(() => {
    const despEliminar = despesas.filter((d) => d.tipo === "eliminar");
    const revEliminar = revisoesEfetivas.filter((r: any) => r.tipo_revisao === "eliminar");
    const somaMeses = meses.reduce((acc, m) => {
      const sd = despEliminar.reduce((s, d) => s + valorMesDespesa(d, m), 0);
      const sr = revEliminar.reduce((s, r: any) => s + valorMesRevisao(r, m), 0);
      return acc + sd + sr;
    }, 0);
    return somaMeses / meses.length;
  }, [despesas, revisoes, revisoesHist, meses]);
  const pctReducaoEliminar = mediaMensal > 0 ? (mediaEliminar / mediaMensal) * 100 : 0;

  // Dados gráficos
  const dadosLinhaTotal = meses.map((m) => ({
    mes: labelMes(m),
    Atual: Number(totalMes(m).toFixed(2)),
    Sistema: Number(custoSistemaNum.toFixed(2)),
  }));

  const dadosBarrasCategorias = useMemo(() => {
    const cats = new Set<string>();
    despesas.forEach((d) => cats.add(d.categoria || "Outros"));
    return meses.map((mes) => {
      const row: any = { mes: labelMes(mes) };
      cats.forEach((c) => {
        row[c] = despesas
          .filter((d) => (d.categoria || "Outros") === c)
          .reduce((s, d) => s + valorMesDespesa(d, mes), 0);
      });
      return row;
    });
  }, [despesas, meses]);

  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>();
    despesas.forEach((d) => cats.add(d.categoria || "Outros"));
    return Array.from(cats);
  }, [despesas]);

  const dadosPizzaComposicao = useMemo(() => {
    const map = new Map<string, number>();
    categoriasUnicas.forEach((c) => map.set(c, 0));
    meses.forEach((m) => {
      categoriasUnicas.forEach((c) => {
        const soma = despesas
          .filter((d) => (d.categoria || "Outros") === c)
          .reduce((s, d) => s + valorMesDespesa(d, m), 0);
        map.set(c, (map.get(c) || 0) + soma);
      });
    });
    return Array.from(map.entries()).map(([name, valor]) => ({ name, valor: valor / meses.length }));
  }, [despesas, meses, categoriasUnicas]);

  // Dialog adicionar despesa
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaDesp, setNovaDesp] = useState({
    categoria: "Folha TI",
    descricao: "",
    valor_mensal: "",
    tipo: "eliminar" as DespesaExtraTipo,
  });

  const handleAddDespesa = async () => {
    const v = Number(novaDesp.valor_mensal.replace(",", "."));
    if (!novaDesp.descricao || !v || v <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    const valoresMensais: Record<string, number> = {};
    meses.forEach((m) => (valoresMensais[m] = v));
    await desp.create.mutateAsync({
      categoria: novaDesp.categoria,
      descricao: novaDesp.descricao,
      valor_mensal: v,
      valores_mensais: valoresMensais,
      tipo: novaDesp.tipo,
    });
    setDialogOpen(false);
    setNovaDesp({ categoria: "Folha TI", descricao: "", valor_mensal: "", tipo: "eliminar" });
  };

  const handlePreFolhaTI = async () => {
    const itens = FOLHA_TI_PRESET.map((p, i) => {
      const valoresMensais: Record<string, number> = {};
      meses.forEach((m) => (valoresMensais[m] = p.valor_mensal));
      return { ...p, valores_mensais: valoresMensais, tipo: "eliminar" as DespesaExtraTipo, ordem: i };
    });
    await desp.bulkInsert.mutateAsync(itens);
  };

  const handleEditValorMes = async (d: DespesaExtra, mes: string, novoValor: number) => {
    const novos = { ...(d.valores_mensais || {}), [mes]: novoValor };
    await desp.update.mutateAsync({ id: d.id, patch: { valores_mensais: novos } });
  };

  // ===== Agrupamento por fornecedor (unifica revisões + despesas extras) =====
  type ItemFornecedor = {
    descricao: string;
    categoria: string;
    tipo: string;
    valoresMes: number[]; // alinhado com `meses`
    total: number;
    media: number;
  };
  type GrupoFornecedor = {
    fornecedor: string;
    itens: ItemFornecedor[];
    subtotalMes: number[];
    subtotalTotal: number;
    subtotalMedia: number;
  };

  const agruparPorFornecedor = (): GrupoFornecedor[] => {
    const map = new Map<string, ItemFornecedor[]>();

    // Itens do plano (revisões) — agrupa por fornecedor_nome
    revisoesEfetivas.forEach((r: any) => {
      const fornecedor =
        (r.fornecedor_nome && String(r.fornecedor_nome).trim()) ||
        (r.categoria_nome && String(r.categoria_nome).trim()) ||
        "Sem fornecedor";
      const valoresMes = meses.map((m) => valorMesRevisao(r, m));
      const total = valoresMes.reduce((s, v) => s + v, 0);
      const item: ItemFornecedor = {
        descricao: r.categoria_nome || r.fornecedor_nome || "—",
        categoria: r.categoria_nome || "—",
        tipo: String(r.tipo_revisao || "—"),
        valoresMes,
        total,
        media: total / meses.length,
      };
      if (!map.has(fornecedor)) map.set(fornecedor, []);
      map.get(fornecedor)!.push(item);
    });

    // Despesas extras — agrupadas como "Despesa interna — <categoria>"
    despesas.forEach((d) => {
      const fornecedor = `Despesa interna — ${d.categoria || "Outros"}`;
      const valoresMes = meses.map((m) => valorMesDespesa(d, m));
      const total = valoresMes.reduce((s, v) => s + v, 0);
      const item: ItemFornecedor = {
        descricao: d.descricao,
        categoria: d.categoria || "Outros",
        tipo: TIPO_LABELS[d.tipo],
        valoresMes,
        total,
        media: total / meses.length,
      };
      if (!map.has(fornecedor)) map.set(fornecedor, []);
      map.get(fornecedor)!.push(item);
    });

    const grupos: GrupoFornecedor[] = Array.from(map.entries())
      .map(([fornecedor, itens]) => {
        const itensOrd = [...itens].sort((a, b) =>
          a.descricao.localeCompare(b.descricao, "pt-BR"),
        );
        const subtotalMes = meses.map((_, i) =>
          itensOrd.reduce((s, it) => s + (it.valoresMes[i] || 0), 0),
        );
        const subtotalTotal = subtotalMes.reduce((s, v) => s + v, 0);
        return {
          fornecedor,
          itens: itensOrd,
          subtotalMes,
          subtotalTotal,
          subtotalMedia: subtotalTotal / meses.length,
        };
      })
      .sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, "pt-BR"));

    // Sanidade dev-only: subtotais por fornecedor devem casar com totalMes da tela
    if (import.meta.env.DEV) {
      meses.forEach((m, i) => {
        const somaSub = grupos.reduce((s, g) => s + g.subtotalMes[i], 0);
        const tela = totalMes(m);
        if (Math.abs(somaSub - tela) > 0.01) {
          // eslint-disable-next-line no-console
          console.warn(
            `[Relatório Consolidado] Divergência em ${m}: agrupado=${somaSub} vs tela=${tela}`,
          );
        }
      });
    }

    return grupos;
  };

  // Exportações
  const handleExportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const grupos = agruparPorFornecedor();

    // Aba Resumo (apenas KPI Custo Atual média 6m)
    const r = wb.addWorksheet("Resumo");
    r.addRow(["Plano", plano?.nome || ""]);
    r.addRow([
      "Período",
      `${labelMesLongo(meses[0])} a ${labelMesLongo(meses[meses.length - 1])}`,
    ]);
    r.addRow([]);
    r.addRow(["KPI", "Valor"]);
    const kpiRow = r.addRow(["Custo Atual Mensal (média 6m)", mediaMensal]);
    kpiRow.getCell(2).numFmt = '"R$" #,##0.00';
    kpiRow.font = { bold: true };
    const elimRow = r.addRow(["A Eliminar (média 6m)", mediaEliminar]);
    elimRow.getCell(2).numFmt = '"R$" #,##0.00';
    elimRow.font = { bold: true };
    const pctRow = r.addRow(["% Redução sobre a média", pctReducaoEliminar / 100]);
    pctRow.getCell(2).numFmt = "0.0%";
    r.columns = [{ width: 38 }, { width: 22 }];

    // Aba Por Fornecedor
    const s = wb.addWorksheet("Por Fornecedor");
    const header = [
      "Fornecedor",
      "Item",
      "Categoria",
      "Tipo",
      ...meses.map(labelMesLongo),
      "Total 6m",
      "Média",
    ];
    const headerRow = s.addRow(header);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    const numericFmt = '"R$" #,##0.00';
    const numCols = meses.length + 2; // meses + Total + Média
    const firstNumCol = 5;
    const lastNumCol = 4 + numCols;

    grupos.forEach((g) => {
      g.itens.forEach((it) => {
        const row = s.addRow([
          g.fornecedor,
          it.descricao,
          it.categoria,
          it.tipo,
          ...it.valoresMes,
          it.total,
          it.media,
        ]);
        for (let c = firstNumCol; c <= lastNumCol; c++) {
          row.getCell(c).numFmt = numericFmt;
        }
      });
      const subRow = s.addRow([
        `Subtotal ${g.fornecedor}`,
        "",
        "",
        "",
        ...g.subtotalMes,
        g.subtotalTotal,
        g.subtotalMedia,
      ]);
      subRow.font = { bold: true };
      subRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
      for (let c = firstNumCol; c <= lastNumCol; c++) {
        subRow.getCell(c).numFmt = numericFmt;
      }
    });

    // Total geral
    const totaisMes = meses.map((_, i) =>
      grupos.reduce((sum, g) => sum + g.subtotalMes[i], 0),
    );
    const totalGeral = totaisMes.reduce((sum, v) => sum + v, 0);
    const totRow = s.addRow([
      "TOTAL GERAL",
      "",
      "",
      "",
      ...totaisMes,
      totalGeral,
      totalGeral / meses.length,
    ]);
    totRow.font = { bold: true };
    totRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD1D5DB" },
    };
    for (let c = firstNumCol; c <= lastNumCol; c++) {
      totRow.getCell(c).numFmt = numericFmt;
    }

    s.columns = [
      { width: 32 },
      { width: 42 },
      { width: 18 },
      { width: 12 },
      ...meses.map(() => ({ width: 14 })),
      { width: 14 },
      { width: 14 },
    ];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_${(plano?.nome || "Plano").replace(/\s+/g, "_")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const grupos = agruparPorFornecedor();

    doc.setFontSize(16);
    doc.text(plano?.nome || "Relatório de Redução de Custos", 40, 40);
    doc.setFontSize(10);
    doc.text(
      `Período: ${labelMesLongo(meses[0])} a ${labelMesLongo(meses[meses.length - 1])}`,
      40, 58,
    );

    autoTable(doc, {
      startY: 76,
      head: [["KPI", "Valor"]],
      body: [
        ["Custo Atual Mensal (média 6m)", formatCurrency(mediaMensal)],
        ["A Eliminar (média 6m)", `${formatCurrency(mediaEliminar)}  (${pctReducaoEliminar.toFixed(1)}%)`],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [40, 40, 40] },
    });

    // Tabela única agrupada por fornecedor
    const head = [[
      "Fornecedor", "Item", "Tipo",
      ...meses.map(labelMes),
      "Total 6m", "Média",
    ]];

    type Row = (string | number)[];
    const body: Row[] = [];
    const subtotalRowIdxs = new Set<number>();
    const totalRowIdxs = new Set<number>();

    grupos.forEach((g) => {
      g.itens.forEach((it) => {
        body.push([
          g.fornecedor,
          it.descricao,
          it.tipo,
          ...it.valoresMes.map((v) => formatCurrency(v)),
          formatCurrency(it.total),
          formatCurrency(it.media),
        ]);
      });
      subtotalRowIdxs.add(body.length);
      body.push([
        `Subtotal ${g.fornecedor}`,
        "",
        "",
        ...g.subtotalMes.map((v) => formatCurrency(v)),
        formatCurrency(g.subtotalTotal),
        formatCurrency(g.subtotalMedia),
      ]);
    });

    const totaisMes = meses.map((_, i) =>
      grupos.reduce((sum, g) => sum + g.subtotalMes[i], 0),
    );
    const totalGeral = totaisMes.reduce((sum, v) => sum + v, 0);
    totalRowIdxs.add(body.length);
    body.push([
      "TOTAL GERAL",
      "",
      "",
      ...totaisMes.map((v) => formatCurrency(v)),
      formatCurrency(totalGeral),
      formatCurrency(totalGeral / meses.length),
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head,
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 40, 40] },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (totalRowIdxs.has(data.row.index)) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [209, 213, 219];
        } else if (subtotalRowIdxs.has(data.row.index)) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });

    doc.save(`Relatorio_${(plano?.nome || "Plano").replace(/\s+/g, "_")}.pdf`);
  };

  if (planoLoading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Relatório Consolidado</h1>
            <Badge variant="secondary">{plano?.nome}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Comparativo dos últimos 6 meses ({labelMesLongo(meses[0])} a {labelMesLongo(meses[meses.length - 1])}) vs custo do sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      {/* Configuração custo do sistema */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Custo mensal do sistema (R$)</Label>
            <Input
              value={custoSistema}
              onChange={(e) => setCustoSistema(e.target.value)}
              className="w-40"
              inputMode="decimal"
            />
          </div>
          <Button onClick={salvarCustoSistema} variant="secondary">Salvar</Button>
          <div className="text-xs text-muted-foreground ml-auto max-w-md">
            Inclui Lovable + IAs + banco de dados. Esse valor é a referência usada para calcular a economia.
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiBox
          icon={<Wallet className="h-4 w-4" />}
          titulo="Custo Atual (média 6m)"
          valor={formatCurrency(mediaMensal)}
          tone="warning"
        />
        <KpiBox
          icon={<Calculator className="h-4 w-4" />}
          titulo="Custo com Sistema"
          valor={formatCurrency(custoSistemaNum)}
          tone="info"
        />
        <KpiBox
          icon={<TrendingDown className="h-4 w-4" />}
          titulo="Economia Mensal"
          valor={formatCurrency(economiaMensal)}
          subtitle={`${economiaPct.toFixed(1)}% de redução`}
          tone={economiaMensal > 0 ? "success" : "destructive"}
        />
        <KpiBox
          icon={<PiggyBank className="h-4 w-4" />}
          titulo="Economia Anual Projetada"
          valor={formatCurrency(economiaAnual)}
          tone={economiaAnual > 0 ? "success" : "destructive"}
        />
        <KpiBox
          icon={<Calculator className="h-4 w-4" />}
          titulo="Payback"
          valor={payback > 0 ? `${payback.toFixed(1)} meses` : "—"}
          tone="info"
        />
        <KpiBox
          icon={<TrendingDown className="h-4 w-4" />}
          titulo="A Eliminar (média 6m)"
          valor={formatCurrency(mediaEliminar)}
          subtitle={`${pctReducaoEliminar.toFixed(1)}% da média atual`}
          tone={mediaEliminar > 0 ? "destructive" : "info"}
        />
      </div>

      {/* Despesas Extras */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Despesas Extras</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Gastos do plano que não vêm do Contas a Pagar (folha, software, infra). Edite o valor por mês clicando na célula.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {despesas.length === 0 && (
              <Button variant="outline" onClick={handlePreFolhaTI}>
                <Sparkles className="h-4 w-4 mr-2" /> Pré-preencher Folha TI
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar despesa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova despesa</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Categoria</Label>
                    <Input
                      value={novaDesp.categoria}
                      onChange={(e) => setNovaDesp({ ...novaDesp, categoria: e.target.value })}
                      placeholder="Folha TI, Software, Infra..."
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input
                      value={novaDesp.descricao}
                      onChange={(e) => setNovaDesp({ ...novaDesp, descricao: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Valor mensal (R$)</Label>
                      <Input
                        value={novaDesp.valor_mensal}
                        onChange={(e) => setNovaDesp({ ...novaDesp, valor_mensal: e.target.value })}
                        inputMode="decimal"
                      />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={novaDesp.tipo}
                        onValueChange={(v) => setNovaDesp({ ...novaDesp, tipo: v as DespesaExtraTipo })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eliminar">Eliminar</SelectItem>
                          <SelectItem value="reduzir">Reduzir</SelectItem>
                          <SelectItem value="manter">Manter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAddDespesa}>Adicionar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Categoria</TableHead>
                <TableHead className="min-w-[260px]">Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                {meses.map((m) => (
                  <TableHead key={m} className="text-right">{labelMes(m)}</TableHead>
                ))}
                <TableHead className="text-right">Média</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {despesas.map((d) => {
                const valores = meses.map((m) => valorMesDespesa(d, m));
                const media = valores.reduce((s, v) => s + v, 0) / meses.length;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.categoria}</TableCell>
                    <TableCell>{d.descricao}</TableCell>
                    <TableCell>
                      <Badge variant={d.tipo === "eliminar" ? "destructive" : d.tipo === "reduzir" ? "default" : "secondary"}>
                        {TIPO_LABELS[d.tipo]}
                      </Badge>
                    </TableCell>
                    {meses.map((m, i) => (
                      <TableCell key={m} className="text-right p-1">
                        <input
                          className="w-24 bg-transparent text-right border border-transparent hover:border-border focus:border-primary rounded px-1 py-1 outline-none text-sm"
                          defaultValue={valores[i].toFixed(2)}
                          onBlur={(e) => {
                            const nv = Number(e.target.value.replace(",", "."));
                            if (!isNaN(nv) && nv !== valores[i]) handleEditValorMes(d, m, nv);
                          }}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">{formatCurrency(media)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Remover esta despesa?")) desp.remove.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {despesas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={meses.length + 5} className="text-center py-8 text-muted-foreground">
                    Nenhuma despesa extra cadastrada. Use "Pré-preencher Folha TI" para começar.
                  </TableCell>
                </TableRow>
              )}
              {despesas.length > 0 && (
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  {meses.map((m) => (
                    <TableCell key={m} className="text-right">{formatCurrency(totalMesDespesas(m))}</TableCell>
                  ))}
                  <TableCell className="text-right">
                    {formatCurrency(meses.reduce((s, m) => s + totalMesDespesas(m), 0) / meses.length)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Itens do plano (revisões) — formato mês a mês */}
      {revisoes && revisoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Itens do Plano (vinculados ao DRE)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Valor pago em cada mês (Contas a Pagar). Quando não houver pagamento no mês, exibe o valor atual de referência.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Categoria/Fornecedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  {meses.map((m) => (
                    <TableHead key={m} className="text-right">{labelMes(m)}</TableHead>
                  ))}
                  <TableHead className="text-right">Média</TableHead>
                  <TableHead className="text-right">Meta Redução</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisoes.map((r: any) => {
                  const valores = meses.map((m) => valorMesRevisao(r, m));
                  const media = valores.reduce((s, v) => s + v, 0) / meses.length;
                  const tipoVariant =
                    r.tipo_revisao === "eliminar" ? "destructive" :
                    r.tipo_revisao === "reduzir" ? "default" : "secondary";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="text-sm">{r.categoria_nome || "—"}</div>
                        {r.fornecedor_nome && (
                          <div className="text-xs text-muted-foreground">{r.fornecedor_nome}</div>
                        )}
                      </TableCell>
                      <TableCell><Badge variant={tipoVariant as any}>{r.tipo_revisao}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                      {valores.map((v, i) => (
                        <TableCell key={meses[i]} className="text-right text-sm tabular-nums">
                          {v > 0 ? formatCurrency(v) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(media)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.meta_reducao_valor || 0))}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  {meses.map((m) => (
                    <TableCell key={m} className="text-right tabular-nums">{formatCurrency(totalMesRevisoes(m))}</TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(meses.reduce((s, m) => s + totalMesRevisoes(m), 0) / meses.length)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency((revisoes || []).reduce((s, r: any) => s + Number(r.meta_reducao_valor || 0), 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Total Consolidado das duas tabelas */}
      {(despesas.length > 0 || (revisoes && revisoes.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Consolidado do Plano</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Soma mês a mês de Despesas Extras + Itens do Plano, comparado com o custo do sistema.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Linha</TableHead>
                  {meses.map((m) => (
                    <TableHead key={m} className="text-right">{labelMes(m)}</TableHead>
                  ))}
                  <TableHead className="text-right">Média</TableHead>
                  <TableHead className="text-right">Total 6m</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const linhaDesp = meses.map((m) => totalMesDespesas(m));
                  const linhaRev = meses.map((m) => totalMesRevisoes(m));
                  const linhaTot = meses.map((_, i) => linhaDesp[i] + linhaRev[i]);
                  const linhaSis = meses.map(() => custoSistemaNum);
                  const linhaEcon = linhaTot.map((v, i) => v - linhaSis[i]);
                  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
                  const renderRow = (label: string, vals: number[], opts?: { strong?: boolean; tone?: "success" | "destructive" | "info"; sign?: boolean }) => {
                    const total = sum(vals);
                    const media = total / vals.length;
                    const toneCls = opts?.tone === "success" ? "text-success"
                      : opts?.tone === "destructive" ? "text-destructive"
                      : opts?.tone === "info" ? "text-primary" : "";
                    const fontCls = opts?.strong ? "font-semibold" : "";
                    return (
                      <TableRow className={opts?.strong ? "bg-muted/40" : undefined}>
                        <TableCell className={`${fontCls}`}>{label}</TableCell>
                        {vals.map((v, i) => (
                          <TableCell key={i} className={`text-right tabular-nums ${fontCls} ${toneCls}`}>
                            {opts?.sign && v > 0 ? "+" : ""}{formatCurrency(v)}
                          </TableCell>
                        ))}
                        <TableCell className={`text-right tabular-nums ${fontCls} ${toneCls}`}>{formatCurrency(media)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${fontCls} ${toneCls}`}>{formatCurrency(total)}</TableCell>
                      </TableRow>
                    );
                  };
                  return (
                    <>
                      {renderRow("Despesas Extras", linhaDesp)}
                      {renderRow("Itens do Plano", linhaRev)}
                      {renderRow("TOTAL GERAL", linhaTot, { strong: true })}
                      {renderRow("Custo com Sistema (alvo)", linhaSis, { tone: "info" })}
                      {renderRow(
                        "Diferença vs Sistema",
                        linhaEcon,
                        { strong: true, tone: economiaMensal > 0 ? "success" : "destructive", sign: true },
                      )}
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}


      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Custo total mensal vs Sistema</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dadosLinhaTotal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="Atual" stroke="hsl(var(--destructive))" strokeWidth={2} />
                <Line type="monotone" dataKey="Sistema" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Composição (média mensal por categoria)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={dadosPizzaComposicao}
                  dataKey="valor"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                >
                  {dadosPizzaComposicao.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: any) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Despesas por categoria — últimos 6 meses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosBarrasCategorias}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend />
                {categoriasUnicas.map((c, i) => (
                  <Bar key={c} dataKey={c} stackId="a" fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <p className="text-xs text-muted-foreground text-center pb-6">
        Relatório gerencial — valores informados manualmente pelo responsável. Não substitui DRE oficial.
      </p>
    </div>
  );
}

interface KpiBoxProps {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  subtitle?: string;
  tone: "success" | "warning" | "destructive" | "info";
}

function KpiBox({ icon, titulo, valor, subtitle, tone }: KpiBoxProps) {
  const toneClass = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-primary",
  }[tone];
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}{titulo}
        </div>
        <div className={`text-2xl font-bold mt-2 ${toneClass}`}>{valor}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}
