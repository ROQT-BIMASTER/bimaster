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

  const valorMesRevisao = (r: any, mes: string): number => {
    const real = revisoesHist?.[r.id]?.[mes];
    return typeof real === "number" ? real : 0;
  };

  const totalMesDespesas = (mes: string): number =>
    despesas.reduce((s, d) => s + valorMesDespesa(d, mes), 0);

  const totalMesRevisoes = (mes: string): number =>
    (revisoes || []).reduce((s, r: any) => s + valorMesRevisao(r, mes), 0);

  const totalMes = (mes: string): number => totalMesDespesas(mes) + totalMesRevisoes(mes);

  const mediaMensal = useMemo(() => {
    const soma = meses.reduce((s, m) => s + totalMes(m), 0);
    return soma / meses.length;
  }, [meses, despesas, revisoes, revisoesHist]);


  const economiaMensal = mediaMensal - custoSistemaNum;
  const economiaPct = mediaMensal > 0 ? (economiaMensal / mediaMensal) * 100 : 0;
  const economiaAnual = economiaMensal * 12;
  const payback = economiaMensal > 0 ? custoSistemaNum / economiaMensal : 0;

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

  // Exportações
  const handleExportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    // Aba Resumo
    const r = wb.addWorksheet("Resumo");
    r.addRow(["Plano", plano?.nome || ""]);
    r.addRow(["Período", `${labelMesLongo(meses[0])} a ${labelMesLongo(meses[meses.length - 1])}`]);
    r.addRow([]);
    r.addRow(["KPI", "Valor"]);
    r.addRow(["Custo Atual Mensal (média 6m)", mediaMensal]);
    r.addRow(["Custo com Sistema (mensal)", custoSistemaNum]);
    r.addRow(["Economia Mensal", economiaMensal]);
    r.addRow(["Economia Mensal (%)", economiaPct / 100]);
    r.addRow(["Economia Anual Projetada", economiaAnual]);
    r.addRow(["Payback (meses)", payback]);
    [5, 6, 7, 9].forEach((i) => (r.getCell(`B${i}`).numFmt = '"R$" #,##0.00'));
    r.getCell("B8").numFmt = "0.0%";
    r.getCell("B10").numFmt = "0.0";
    r.columns = [{ width: 38 }, { width: 22 }];

    // Aba Despesas Extras
    const e = wb.addWorksheet("Despesas Extras");
    e.addRow(["Categoria", "Descrição", "Tipo", ...meses.map(labelMesLongo), "Total 6m", "Média"]);
    despesas.forEach((d) => {
      const valores = meses.map((m) => valorMesDespesa(d, m));
      const total = valores.reduce((s, v) => s + v, 0);
      e.addRow([d.categoria, d.descricao, TIPO_LABELS[d.tipo], ...valores, total, total / meses.length]);
    });
    const totalRow = ["TOTAL", "", "", ...meses.map((m) => totalMesDespesas(m))];
    const totSoma = meses.reduce((s, m) => s + totalMesDespesas(m), 0);
    totalRow.push(totSoma, totSoma / meses.length);
    const tr = e.addRow(totalRow);
    tr.font = { bold: true };
    e.columns = [
      { width: 18 }, { width: 48 }, { width: 12 },
      ...meses.map(() => ({ width: 14 })),
      { width: 16 }, { width: 14 },
    ];
    e.eachRow((row, idx) => {
      if (idx === 1) { row.font = { bold: true }; return; }
      for (let c = 4; c <= 3 + meses.length + 2; c++) {
        row.getCell(c).numFmt = '"R$" #,##0.00';
      }
    });

    // Aba Itens do Plano (mensal)
    if (revisoes && revisoes.length) {
      const p = wb.addWorksheet("Itens do Plano");
      p.addRow([
        "Categoria/Fornecedor", "Tipo", "Status",
        ...meses.map(labelMesLongo),
        "Média", "Total 6m", "Meta Redução",
      ]);
      revisoes.forEach((it: any) => {
        const valores = meses.map((m) => valorMesRevisao(it, m));
        const total = valores.reduce((s, v) => s + v, 0);
        p.addRow([
          it.categoria_nome || it.fornecedor_nome || "—",
          it.tipo_revisao,
          it.status,
          ...valores,
          total / meses.length,
          total,
          Number(it.meta_reducao_valor || 0),
        ]);
      });
      const totRevRow = [
        "TOTAL", "", "",
        ...meses.map((m) => totalMesRevisoes(m)),
      ] as any[];
      const totRevSoma = meses.reduce((s, m) => s + totalMesRevisoes(m), 0);
      totRevRow.push(totRevSoma / meses.length, totRevSoma, (revisoes || []).reduce((s, r: any) => s + Number(r.meta_reducao_valor || 0), 0));
      const trr = p.addRow(totRevRow);
      trr.font = { bold: true };
      p.getRow(1).font = { bold: true };
      p.columns = [
        { width: 40 }, { width: 14 }, { width: 14 },
        ...meses.map(() => ({ width: 14 })),
        { width: 14 }, { width: 14 }, { width: 16 },
      ];
      p.eachRow((row, idx) => {
        if (idx === 1) return;
        for (let c = 4; c <= 3 + meses.length + 3; c++) {
          row.getCell(c).numFmt = '"R$" #,##0.00';
        }
      });
    }

    // Aba Consolidado
    {
      const c = wb.addWorksheet("Consolidado");
      c.addRow(["Linha", ...meses.map(labelMesLongo), "Média", "Total 6m"]);
      const linhaDesp = meses.map((m) => totalMesDespesas(m));
      const linhaRev = meses.map((m) => totalMesRevisoes(m));
      const linhaTot = meses.map((_, i) => linhaDesp[i] + linhaRev[i]);
      const linhaSis = meses.map(() => custoSistemaNum);
      const linhaEcon = linhaTot.map((v, i) => v - linhaSis[i]);
      const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
      const addLine = (label: string, vals: number[]) =>
        c.addRow([label, ...vals, sum(vals) / vals.length, sum(vals)]);
      addLine("Despesas Extras", linhaDesp);
      addLine("Itens do Plano", linhaRev);
      const totRow = addLine("TOTAL GERAL", linhaTot);
      totRow.font = { bold: true };
      addLine("Custo com Sistema (alvo)", linhaSis);
      const econRow = addLine("Diferença vs Sistema", linhaEcon);
      econRow.font = { bold: true };
      c.getRow(1).font = { bold: true };
      c.columns = [{ width: 28 }, ...meses.map(() => ({ width: 14 })), { width: 14 }, { width: 14 }];
      c.eachRow((row, idx) => {
        if (idx === 1) return;
        for (let col = 2; col <= 1 + meses.length + 2; col++) {
          row.getCell(col).numFmt = '"R$" #,##0.00';
        }
      });
    }


    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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

    doc.setFontSize(16);
    doc.text(plano?.nome || "Relatório de Redução de Custos", 40, 40);
    doc.setFontSize(10);
    doc.text(
      `Período: ${labelMesLongo(meses[0])} a ${labelMesLongo(meses[meses.length - 1])}`,
      40, 58,
    );

    autoTable(doc, {
      startY: 80,
      head: [["KPI", "Valor"]],
      body: [
        ["Custo Atual Mensal (média 6m)", formatCurrency(mediaMensal)],
        ["Custo com Sistema (mensal)", formatCurrency(custoSistemaNum)],
        ["Economia Mensal", `${formatCurrency(economiaMensal)}  (${economiaPct.toFixed(1)}%)`],
        ["Economia Anual Projetada", formatCurrency(economiaAnual)],
        ["Payback", `${payback.toFixed(1)} meses`],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [40, 40, 40] },
    });

    const head = [["Categoria", "Descrição", ...meses.map(labelMes), "Média"]];
    const body = despesas.map((d) => {
      const valores = meses.map((m) => valorMesDespesa(d, m));
      const media = valores.reduce((s, v) => s + v, 0) / meses.length;
      return [
        d.categoria,
        d.descricao,
        ...valores.map((v) => formatCurrency(v)),
        formatCurrency(media),
      ];
    });
    const totaisRow = [
      "TOTAL", "",
      ...meses.map((m) => formatCurrency(totalMesDespesas(m))),
      formatCurrency(meses.reduce((s, m) => s + totalMesDespesas(m), 0) / meses.length),
    ];
    body.push(totaisRow);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head,
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 40, 40] },
      didParseCell: (data) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
