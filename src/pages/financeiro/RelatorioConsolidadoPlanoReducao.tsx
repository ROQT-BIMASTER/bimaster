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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Plus, Trash2, FileDown, Sparkles, TrendingDown, Wallet,
  Calculator, PiggyBank, FileSpreadsheet, FileText, Link2, AlertCircle,
  ChevronRight, ChevronDown,
} from "lucide-react";
import { VincularContaPagarDialog } from "@/components/financeiro/plano-reducao/VincularContaPagarDialog";
import { RevisaoDocumentosExpansao } from "@/components/financeiro/plano-reducao/RevisaoDocumentosExpansao";
import { Fragment } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import {
  useDespesasExtrasPlano, type DespesaExtra, type DespesaExtraTipo,
} from "@/hooks/useDespesasExtrasPlano";
import { getMesesPeriodo, labelMes, labelMesLongo } from "@/lib/financeiro/periodoMeses";
import { FornecedorContratoBadge } from "@/components/financeiro/contratos/FornecedorContratoBadge";
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
  const [exportandoPDF, setExportandoPDF] = useState(false);
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
        .select("id, categoria_nome, fornecedor_nome, fornecedor_codigo, empresa_nome, valor_atual, meta_reducao_valor, meta_reducao_percentual, tipo_revisao, status")
        .eq("plano_id", planoId!)
        .neq("status", "concluido");
      if (error) throw error;
      return data || [];
    },
  });

  // Excluir uma revisão (fornecedor) do plano
  const excluirRevisao = async (id: string, label: string) => {
    if (!confirm(`Remover "${label}" do plano de redução?`)) return;
    const { error } = await supabase.from("contas_pagar_revisao").delete().eq("id", id);
    if (error) {
      toast.error("Falha ao remover do plano");
      return;
    }
    qc.invalidateQueries({ queryKey: ["revisoes-plano", planoId] });
    qc.invalidateQueries({ queryKey: ["revisoes-plano-hist", planoId] });
    toast.success("Fornecedor removido do plano");
  };

  // Atualização inline de tipo_revisao / status diretamente na linha
  const atualizarRevisao = async (
    id: string,
    patch: { tipo_revisao?: string; status?: string },
  ) => {
    const { error } = await supabase.from("contas_pagar_revisao").update(patch).eq("id", id);
    if (error) {
      toast.error("Falha ao atualizar item do plano");
      return;
    }
    qc.invalidateQueries({ queryKey: ["revisoes-plano", planoId] });
    qc.invalidateQueries({ queryKey: ["revisoes-plano-hist", planoId] });
    toast.success("Item atualizado");
  };

  const [vincularAlvo, setVincularAlvo] = useState<{ id: string; nome: string; valor: number } | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const [limpandoDuplicados, setLimpandoDuplicados] = useState(false);
  const limparDuplicados = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Remover ${ids.length} item(ns) duplicado(s) do plano? A revisão efetiva de cada fornecedor (prioridade Eliminar > Reduzir > Manter) será mantida.`)) return;
    setLimpandoDuplicados(true);
    const { error } = await supabase.from("contas_pagar_revisao").delete().in("id", ids);
    setLimpandoDuplicados(false);
    if (error) {
      toast.error("Falha ao limpar duplicados");
      return;
    }
    qc.invalidateQueries({ queryKey: ["revisoes-plano", planoId] });
    qc.invalidateQueries({ queryKey: ["revisoes-plano-hist", planoId] });
    toast.success(`${ids.length} duplicado(s) removido(s)`);
  };
  // Histórico mensal real das revisões (por fornecedor + mês)
  // Filtro de filial (declarado mais abaixo, mas referenciado pelo histórico mensal
  // para que os valores reflitam a filial selecionada). Inicializamos aqui apenas
  // o estado; o setter é exposto via state hook abaixo.
  const [filtroFilial, setFiltroFilial] = useState<string>("__all__");
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("__all__");

  const { data: revisoesHist } = useQuery({
    queryKey: ["revisoes-plano-hist", planoId, meses, filtroFilial],
    enabled: !!planoId && (revisoes?.length ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_revisoes_plano_historico_mensal", {
        p_plano_id: planoId!,
        p_meses: meses,
        p_empresa_nome: filtroFilial === "__all__" ? null : filtroFilial,
      } as any);
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

  // Lista de filiais reais (a partir do Contas a Pagar) onde os fornecedores
  // do plano possuem títulos. Usado para popular o filtro de filial.
  const { data: filiaisAP } = useQuery({
    queryKey: ["plano-filiais-ap", planoId],
    enabled: !!planoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_filiais_plano_reducao", {
        p_plano_id: planoId!,
      } as any);
      if (error) throw error;
      return (data || []) as { fornecedor_codigo: string; empresa_nome: string }[];
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
    (revisoes || [])
      .filter((r: any) => r.status !== "cancelado")
      .forEach((r: any) => {
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

  const revisoesCanceladas = useMemo(() => {
    return ((revisoes || []) as any[]).filter((r: any) => r.status === "cancelado");
  }, [revisoes]);

  // IDs duplicados (mesmo fornecedor_codigo, não escolhidos como efetivo)
  const revisoesDuplicadasIds = useMemo(() => {
    const efetivosIds = new Set(revisoesEfetivas.map((r: any) => r.id));
    return (revisoes || []).filter((r: any) => !efetivosIds.has(r.id)).map((r: any) => r.id);
  }, [revisoes, revisoesEfetivas]);

  // Mapa fornecedor_codigo -> Set(empresa_nome) a partir do Contas a Pagar
  const filiaisPorFornecedor = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (filiaisAP || []).forEach((row) => {
      const key = String(row.fornecedor_codigo);
      if (!m.has(key)) m.set(key, new Set());
      m.get(key)!.add(String(row.empresa_nome));
    });
    return m;
  }, [filiaisAP]);

  const filiaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    // empresa_nome desnormalizada no contas_pagar_revisao
    (revisoes || []).forEach((r: any) => {
      if (r.empresa_nome) set.add(String(r.empresa_nome));
    });
    // todas as filiais reais com títulos no AP para os fornecedores do plano
    (filiaisAP || []).forEach((row) => {
      if (row.empresa_nome) set.add(String(row.empresa_nome));
    });
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [revisoes, filiaisAP]);

  // Verifica se uma revisão deve ser visível dada a filial selecionada.
  // Aceita o item se: (a) sem filtro; (b) empresa_nome do revisao bate; ou
  // (c) o fornecedor possui ALGUM título no AP naquela filial.
  const revisaoCasaFilial = (r: any, filial: string): boolean => {
    if (filial === "__all__") return true;
    if (String(r.empresa_nome || "") === filial) return true;
    const codigo = String(r.fornecedor_codigo || "");
    if (codigo && filiaisPorFornecedor.get(codigo)?.has(filial)) return true;
    return false;
  };

  const fornecedoresDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    (revisoes || []).forEach((r: any) => {
      const key = String(r.fornecedor_codigo || r.fornecedor_nome || "");
      if (!key) return;
      if (!revisaoCasaFilial(r, filtroFilial)) return;
      if (!map.has(key)) map.set(key, r.fornecedor_nome || key);
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [revisoes, filtroFilial, filiaisPorFornecedor]);

  const aplicarFiltros = <T extends { empresa_nome?: string | null; fornecedor_codigo?: string | null; fornecedor_nome?: string | null }>(
    list: T[],
  ): T[] => {
    return list.filter((r) => {
      if (!revisaoCasaFilial(r, filtroFilial)) return false;
      if (filtroFornecedor !== "__all__") {
        const key = String(r.fornecedor_codigo || r.fornecedor_nome || "");
        if (key !== filtroFornecedor) return false;
      }
      return true;
    });
  };

  const revisoesEfetivasFiltradas = useMemo(
    () => aplicarFiltros(revisoesEfetivas as any[]),
    [revisoesEfetivas, filtroFilial, filtroFornecedor],
  );
  const revisoesDuplicadasFiltradas = useMemo(
    () =>
      aplicarFiltros(
        ((revisoes || []) as any[]).filter((r: any) => revisoesDuplicadasIds.includes(r.id)),
      ),
    [revisoes, revisoesDuplicadasIds, filtroFilial, filtroFornecedor],
  );

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

  const handleExportPDF = async (incluirSubtotais: boolean = true) => {
    if (exportandoPDF) return;
    setExportandoPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const grupos = agruparPorFornecedor();

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 40;
      const periodoLabel = `${labelMesLongo(meses[0])} a ${labelMesLongo(meses[meses.length - 1])}`;
      const geradoEm = new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      });

      // Cabeçalho institucional
      doc.setFillColor(31, 41, 55); // slate-800
      doc.rect(0, 0, pageWidth, 70, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Relatório Consolidado — Plano de Redução de Custos", marginX, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(plano?.nome || "—", marginX, 48);
      doc.setFontSize(9);
      doc.text(`Período: ${periodoLabel}`, marginX, 62);
      doc.text(`Gerado em ${geradoEm}`, pageWidth - marginX, 62, { align: "right" });
      doc.setTextColor(0, 0, 0);

      // 1. Indicadores executivos (KPIs)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("1. Indicadores Executivos", marginX, 96);

      autoTable(doc, {
        startY: 104,
        head: [["Indicador", "Valor"]],
        body: [
          ["Custo médio mensal atual (6m)", formatCurrency(mediaMensal)],
          ["Custo do sistema (referência)", formatCurrency(custoSistemaNum)],
          ["A eliminar (média 6m)", `${formatCurrency(mediaEliminar)}  (${pctReducaoEliminar.toFixed(1)}% da média)`],
        ],
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" } },
        margin: { left: marginX, right: marginX },
        theme: "grid",
      });

      // 2. Tabela consolidada por fornecedor (sempre exibida — visão executiva)
      let cursorY = (doc as any).lastAutoTable.finalY + 22;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("2. Consolidado por Fornecedor", marginX, cursorY);

      const consolidadoTotaisMes = meses.map((_, i) =>
        grupos.reduce((sum, g) => sum + g.subtotalMes[i], 0),
      );
      const consolidadoTotalGeral = consolidadoTotaisMes.reduce((s, v) => s + v, 0);

      const consolidadoBody = grupos.map((g) => [
        g.fornecedor,
        ...g.subtotalMes.map((v) => formatCurrency(v)),
        formatCurrency(g.subtotalTotal),
        formatCurrency(g.subtotalMedia),
      ]);
      consolidadoBody.push([
        "TOTAL GERAL",
        ...consolidadoTotaisMes.map((v) => formatCurrency(v)),
        formatCurrency(consolidadoTotalGeral),
        formatCurrency(consolidadoTotalGeral / meses.length),
      ]);

      autoTable(doc, {
        startY: cursorY + 8,
        head: [["Fornecedor", ...meses.map(labelMes), "Total 6m", "Média"]],
        body: consolidadoBody,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
        columnStyles: Object.fromEntries(
          Array.from({ length: meses.length + 2 }, (_, i) => [i + 1, { halign: "right" }]),
        ) as any,
        margin: { left: marginX, right: marginX },
        theme: "grid",
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === consolidadoBody.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [209, 213, 219];
          }
        },
      });

      // 3. Tabela detalhada (item a item) — em página nova
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("3. Detalhamento por Item", marginX, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(
        incluirSubtotais
          ? "Inclui subtotais por fornecedor e total geral."
          : "Visão item a item, sem subtotais por fornecedor.",
        marginX,
        54,
      );
      doc.setTextColor(0, 0, 0);

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
        if (incluirSubtotais) {
          subtotalRowIdxs.add(body.length);
          body.push([
            `Subtotal ${g.fornecedor}`,
            "",
            "",
            ...g.subtotalMes.map((v) => formatCurrency(v)),
            formatCurrency(g.subtotalTotal),
            formatCurrency(g.subtotalMedia),
          ]);
        }
      });

      totalRowIdxs.add(body.length);
      body.push([
        "TOTAL GERAL",
        "",
        "",
        ...consolidadoTotaisMes.map((v) => formatCurrency(v)),
        formatCurrency(consolidadoTotalGeral),
        formatCurrency(consolidadoTotalGeral / meses.length),
      ]);

      autoTable(doc, {
        startY: 64,
        head,
        body,
        styles: { fontSize: 7.5, cellPadding: 3 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
        columnStyles: Object.fromEntries(
          Array.from({ length: meses.length + 2 }, (_, i) => [i + 3, { halign: "right" }]),
        ) as any,
        margin: { left: marginX, right: marginX },
        theme: "grid",
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

      // Rodapé com paginação
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(
          `${plano?.nome || "Plano"} — ${periodoLabel}`,
          marginX,
          pageHeight - 18,
        );
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth - marginX,
          pageHeight - 18,
          { align: "right" },
        );
      }

      const fileName = `Relatorio_${(plano?.nome || "Plano").replace(/\s+/g, "_")}.pdf`;
      await (doc as any).save(fileName, { returnPromise: true });
      toast.success("PDF gerado com sucesso");
    } catch (err: any) {
      console.error("[ExportPDF]", err);
      toast.error(`Falha ao gerar PDF: ${err?.message || "erro desconhecido"}`);
    } finally {
      setExportandoPDF(false);
    }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exportandoPDF}>
                <FileText className="h-4 w-4 mr-2" /> {exportandoPDF ? "Gerando..." : "PDF"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={exportandoPDF} onClick={() => handleExportPDF(true)}>
                Com subtotais por fornecedor
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportandoPDF} onClick={() => handleExportPDF(false)}>
                Sem subtotais
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Itens cancelados */}
      {revisoes && revisoes.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <CardTitle className="text-base">
                  Itens cancelados
                </CardTitle>
                <Badge variant={revisoesCanceladas.length > 0 ? "destructive" : "secondary"} className="h-5">
                  {revisoesCanceladas.length}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Estes itens não entram no cálculo da economia consolidada.
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {revisoesCanceladas.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                Nenhum item cancelado. Para cancelar um item, mude o status para "Cancelado" na coluna Status da tabela abaixo.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {revisoesCanceladas.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-foreground line-through decoration-destructive/70">
                      {r.fornecedor_nome || r.categoria_nome || "—"}
                    </span>
                    {r.empresa_nome && (
                      <span className="text-muted-foreground">· {r.empresa_nome}</span>
                    )}
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(Number(r.valor_atual || 0))}
                    </span>
                    <Badge variant="outline" className="h-4 text-[10px]">
                      {TIPO_LABELS[r.tipo_revisao as DespesaExtraTipo] || r.tipo_revisao || "—"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() => atualizarRevisao(r.id, { status: "pendente" })}
                      title="Reativar"
                    >
                      Reativar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                      <Select
                        value={d.tipo}
                        onValueChange={(v) => desp.update.mutate({ id: d.id, patch: { tipo: v as DespesaExtraTipo } })}
                      >
                        <SelectTrigger className="w-[110px] h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eliminar">Eliminar</SelectItem>
                          <SelectItem value="reduzir">Reduzir</SelectItem>
                          <SelectItem value="manter">Manter</SelectItem>
                        </SelectContent>
                      </Select>
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
              Valor pago em cada mês (Contas a Pagar). Quando o mesmo fornecedor possui mais
              de um item no plano, mantemos apenas um (prioridade: <strong>Eliminar</strong> &gt; Reduzir &gt; Manter)
              para evitar duplicação. Use o botão de remover para excluir um fornecedor do plano.
            </p>
            {revisoesDuplicadasIds.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                <span>
                  {revisoesDuplicadasIds.length} item(ns) duplicado(s) por fornecedor foram ignorados no consolidado.
                  Use o botão ao lado para limpar de uma vez.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={limpandoDuplicados}
                  onClick={() => limparDuplicados(revisoesDuplicadasIds)}
                  className="shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {limpandoDuplicados ? "Limpando..." : "Limpar duplicados"}
                </Button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Filial</Label>
                <Select value={filtroFilial} onValueChange={(v) => { setFiltroFilial(v); setFiltroFornecedor("__all__"); }}>
                  <SelectTrigger className="h-8 w-[220px] text-xs">
                    <SelectValue placeholder="Todas as filiais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as filiais</SelectItem>
                    {filiaisDisponiveis.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
                  <SelectTrigger className="h-8 w-[260px] text-xs">
                    <SelectValue placeholder="Todos os fornecedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os fornecedores</SelectItem>
                    {fornecedoresDisponiveis.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(filtroFilial !== "__all__" || filtroFornecedor !== "__all__") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setFiltroFilial("__all__"); setFiltroFornecedor("__all__"); }}
                >
                  Limpar filtros
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {revisoesEfetivasFiltradas.length} de {revisoesEfetivas.length} itens
              </span>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="min-w-[260px]">Categoria/Fornecedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  {meses.map((m) => (
                    <TableHead key={m} className="text-right">{labelMes(m)}</TableHead>
                  ))}
                  <TableHead className="text-right">Média</TableHead>
                  <TableHead className="text-right">Meta Redução</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisoesEfetivasFiltradas.map((r: any) => {
                  const valores = meses.map((m) => valorMesRevisao(r, m));
                  const media = valores.reduce((s, v) => s + v, 0) / meses.length;
                  const tipoVariant =
                    r.tipo_revisao === "eliminar" ? "destructive" :
                    r.tipo_revisao === "reduzir" ? "default" : "secondary";
                  const label = r.fornecedor_nome || r.categoria_nome || "item";
                  const aberto = expandidos.has(r.id);
                  return (
                    <Fragment key={r.id}>
                    <TableRow>
                      <TableCell className="align-top pt-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title={aberto ? "Recolher documentos" : "Ver documentos do Contas a Pagar"}
                          onClick={() => toggleExpandido(r.id)}
                        >
                          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="text-sm flex items-center gap-2">
                          <span>{r.categoria_nome || "—"}</span>
                          {r.fornecedor_codigo ? (
                            <Badge variant="outline" className="h-5 text-[10px] gap-1 border-success/40 text-success bg-success/5">
                              <Link2 className="h-2.5 w-2.5" /> AP em tempo real
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-5 text-[10px] gap-1 border-warning/40 text-warning bg-warning/5">
                              <AlertCircle className="h-2.5 w-2.5" /> Manual
                            </Badge>
                          )}
                        </div>
                        {r.fornecedor_nome && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="truncate">{r.fornecedor_nome}</span>
                            <FornecedorContratoBadge fornecedorCodigo={r.fornecedor_codigo} fornecedorNome={r.fornecedor_nome} empresaNome={r.empresa_nome} iconOnly />
                            {!r.fornecedor_codigo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[10px] gap-1"
                                onClick={() => setVincularAlvo({ id: r.id, nome: r.fornecedor_nome || r.categoria_nome || "", valor: Number(r.valor_atual || 0) })}
                              >
                                <Link2 className="h-3 w-3" /> Vincular
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={String(r.tipo_revisao || "")}
                          onValueChange={(v) => atualizarRevisao(r.id, { tipo_revisao: v })}
                        >
                          <SelectTrigger
                            className={
                              "h-7 w-[110px] text-xs font-medium border-0 " +
                              (r.tipo_revisao === "eliminar"
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                : r.tipo_revisao === "reduzir"
                                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                  : "bg-secondary text-secondary-foreground")
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eliminar">Eliminar</SelectItem>
                            <SelectItem value="reduzir">Reduzir</SelectItem>
                            <SelectItem value="renegociar">Renegociar</SelectItem>
                            <SelectItem value="monitorar">Monitorar</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={String(r.status || "")}
                          onValueChange={(v) => atualizarRevisao(r.id, { status: v })}
                        >
                          <SelectTrigger
                            className={
                              "h-7 w-[130px] text-xs font-medium border-0 " +
                              (r.status === "concluido"
                                ? "bg-success text-success-foreground"
                                : r.status === "em_andamento"
                                  ? "bg-warning text-warning-foreground"
                                  : r.status === "cancelado"
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-secondary text-secondary-foreground")
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="em_andamento">Em andamento</SelectItem>
                            <SelectItem value="concluido">Concluído</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {valores.map((v, i) => (
                        <TableCell key={meses[i]} className="text-right text-sm tabular-nums">
                          {v > 0 ? formatCurrency(v) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(media)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.meta_reducao_valor || 0))}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir fornecedor do plano"
                          onClick={() => excluirRevisao(r.id, label)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {aberto && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5 + meses.length + 2} className="p-0">
                          <RevisaoDocumentosExpansao
                            fornecedorCodigo={r.fornecedor_codigo || ""}
                            fornecedorNome={r.fornecedor_nome || r.categoria_nome || ""}
                            meses={meses}
                            empresaNome={filtroFilial === "__all__" ? null : filtroFilial}
                          />

                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  );
                })}
                {revisoesDuplicadasFiltradas.length > 0 && revisoesDuplicadasFiltradas
                  .map((r: any) => {
                    const label = r.fornecedor_nome || r.categoria_nome || "item";
                    return (
                      <TableRow key={r.id} className="opacity-60">
                        <TableCell></TableCell>
                        <TableCell className="font-medium">
                          <div className="text-sm">{r.categoria_nome || "—"}</div>
                          {r.fornecedor_nome && (
                            <div className="text-xs text-muted-foreground">{r.fornecedor_nome}</div>
                          )}
                          <div className="text-[10px] text-warning mt-1">Duplicado — ignorado no total</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{r.tipo_revisao}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                        {meses.map((m) => (
                          <TableCell key={m} className="text-right text-sm tabular-nums text-muted-foreground">—</TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir item duplicado"
                            onClick={() => excluirRevisao(r.id, label)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
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
                    {formatCurrency(revisoesEfetivas.reduce((s, r: any) => s + Number(r.meta_reducao_valor || 0), 0))}
                  </TableCell>
                  <TableCell />
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

      {vincularAlvo && (
        <VincularContaPagarDialog
          open={!!vincularAlvo}
          onOpenChange={(o) => { if (!o) setVincularAlvo(null); }}
          revisaoId={vincularAlvo.id}
          nomeAtual={vincularAlvo.nome}
          valorMensal={vincularAlvo.valor}
          onVinculado={() => {
            qc.invalidateQueries({ queryKey: ["revisoes-plano", planoId] });
            qc.invalidateQueries({ queryKey: ["revisoes-plano-hist", planoId] });
          }}
        />
      )}
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
