import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, isValid, addMonths, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Receipt, Plus, Search, Pencil, Eye, Ban, Loader2, DollarSign,
  AlertTriangle, CheckCircle, CalendarIcon, Clock, ChevronLeft, ChevronRight, X
} from "lucide-react";

// ─── Types ───
interface ContaPagar {
  id: string;
  erp_id: string;
  empresa_id: number;
  empresa_nome: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  parcela: number | null;
  fornecedor_codigo: string | null;
  fornecedor_nome: string | null;
  valor_original: number;
  valor_aberto: number;
  valor_pago: number;
  valor_juros: number;
  valor_desconto: number;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_competencia: string | null;
  categoria_nome: string | null;
  portador: string | null;
  status: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  created_at: string;
}

interface Fornecedor {
  id: string;
  razao_social: string | null;
  nome: string | null;
  cnpj: string | null;
}

interface ContaBancaria {
  id: string;
  banco: string;
  agencia: string | null;
  conta: string | null;
}

interface CentroCusto {
  id: string;
  nome: string;
  codigo: string | null;
}

interface Empresa {
  id: number;
  nome: string;
}

// ─── Helpers ───
const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-blue-100 text-blue-800 border-blue-200" },
  aberto: { label: "Aberto", className: "bg-blue-100 text-blue-800 border-blue-200" },
  pago: { label: "Pago", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  vencido: { label: "Vencido", className: "bg-red-100 text-red-800 border-red-200" },
  cancelado: { label: "Cancelado", className: "bg-gray-100 text-gray-600 border-gray-200" },
  parcialmente_pago: { label: "Parcial", className: "bg-amber-100 text-amber-800 border-amber-200" },
  parcial: { label: "Parcial", className: "bg-amber-100 text-amber-800 border-amber-200" },
};

const CATEGORIAS = ["Fornecedor", "Serviço", "Imposto", "Aluguel", "Folha", "Outros"];

function fmtCurrency(v: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? format(parsed, "dd/MM/yyyy") : "—";
  } catch {
    return "—";
  }
}

function isOverdue(d: string | null, status: string | null): boolean {
  if (!d || !["pendente", "aberto"].includes(status || "")) return false;
  return d < format(new Date(), "yyyy-MM-dd");
}

const PAGE_SIZE = 20;

// ─── Component ───
export default function ContasPagarModule() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);

  // Drawer & dialogs
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");

  // Fornecedor autocomplete
  const [fornecedorSearch, setFornecedorSearch] = useState("");
  const [showFornecedorList, setShowFornecedorList] = useState(false);

  // Form
  const emptyForm = {
    fornecedor_id: "", fornecedor_nome: "", descricao: "", numero_documento: "",
    data_emissao: format(new Date(), "yyyy-MM-dd"), data_vencimento: "",
    data_competencia: "", valor_original: "", valor_desconto: "0", valor_juros: "0",
    numero_parcelas: "1", conta_bancaria_id: "", categoria_nome: "",
    centro_custo_id: "", observacoes: "", empresa_id: "",
  };
  const [form, setForm] = useState(emptyForm);

  const valorLiquido = useMemo(() => {
    const orig = parseFloat(form.valor_original) || 0;
    const desc = parseFloat(form.valor_desconto) || 0;
    const juros = parseFloat(form.valor_juros) || 0;
    return orig - desc + juros;
  }, [form.valor_original, form.valor_desconto, form.valor_juros]);

  // Parcelas preview
  const parcelasPreview = useMemo(() => {
    const n = parseInt(form.numero_parcelas) || 1;
    if (n <= 1 || !form.data_vencimento) return [];
    const base = parseISO(form.data_vencimento);
    if (!isValid(base)) return [];
    const vlrParcela = Math.round((valorLiquido / n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      vencimento: format(addMonths(base, i), "dd/MM/yyyy"),
      valor: i === n - 1 ? valorLiquido - vlrParcela * (n - 1) : vlrParcela,
    }));
  }, [form.numero_parcelas, form.data_vencimento, valorLiquido]);

  // ─── Queries ───
  const { data: kpiData } = useQuery({
    queryKey: ["cp-module-kpis"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const in7 = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const monthStart = format(new Date(), "yyyy-MM-01");
      const monthEnd = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

      const [{ data: d1 }, { data: d2 }, { data: d3 }, { data: d4 }] = await Promise.all([
        supabase.from("contas_pagar").select("valor_aberto").in("status", ["pendente", "aberto", "vencido", "parcialmente_pago", "parcial"]),
        supabase.from("contas_pagar").select("valor_aberto").in("status", ["pendente", "aberto"]).lt("data_vencimento", today),
        supabase.from("contas_pagar").select("valor_aberto").in("status", ["pendente", "aberto"]).gte("data_vencimento", today).lte("data_vencimento", in7),
        supabase.from("contas_pagar").select("valor_pago, valor_original").eq("status", "pago").gte("data_pagamento", monthStart).lte("data_pagamento", monthEnd),
      ]);
      return {
        totalPagar: (d1 || []).reduce((s, r) => s + (r.valor_aberto || 0), 0),
        totalVencido: (d2 || []).reduce((s, r) => s + (r.valor_aberto || 0), 0),
        aVencer7d: (d3 || []).reduce((s, r) => s + (r.valor_aberto || 0), 0),
        pagoMes: (d4 || []).reduce((s, r) => s + (r.valor_pago || r.valor_original || 0), 0),
      };
    },
  });

  const { data: tableResult, isLoading } = useQuery({
    queryKey: ["cp-module-table", search, statusFilter, dateFrom?.toISOString(), dateTo?.toISOString(), page],
    queryFn: async () => {
      let q = supabase
        .from("contas_pagar")
        .select("*", { count: "exact" })
        .order("data_vencimento", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) {
        q = q.or(`fornecedor_nome.ilike.%${search}%,numero_documento.ilike.%${search}%,categoria_nome.ilike.%${search}%`);
      }
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (dateFrom) q = q.gte("data_vencimento", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) q = q.lte("data_vencimento", format(dateTo, "yyyy-MM-dd"));

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data || []) as ContaPagar[], total: count || 0 };
    },
  });

  const rows = tableResult?.rows || [];
  const totalRows = tableResult?.total || 0;
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  // Ref data
  const { data: empresas = [] } = useQuery({
    queryKey: ["cp-empresas"],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id, nome").order("nome");
      return (data || []) as Empresa[];
    },
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["cp-contas-bancarias"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("id, banco, agencia, conta").eq("status", "ativa");
      return (data || []) as ContaBancaria[];
    },
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["cp-centros-custo"],
    queryFn: async () => {
      const { data } = await supabase.from("centros_custo").select("id, nome, codigo").eq("status", "ativo");
      return (data || []) as CentroCusto[];
    },
  });

  const { data: fornecedoresAC = [] } = useQuery({
    queryKey: ["cp-fornecedores-ac", fornecedorSearch],
    enabled: fornecedorSearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("id, razao_social, nome, cnpj")
        .ilike("razao_social", `%${fornecedorSearch}%`)
        .limit(10);
      return (data || []) as Fornecedor[];
    },
  });

  // ─── Mutations ───
  const saveMutation = useMutation({
    mutationFn: async () => {
      const valorOrig = parseFloat(form.valor_original) || 0;
      const valorDesc = parseFloat(form.valor_desconto) || 0;
      const valorJuros = parseFloat(form.valor_juros) || 0;
      const numParcelas = parseInt(form.numero_parcelas) || 1;

      const payload: any = {
        fornecedor_nome: form.fornecedor_nome || null,
        fornecedor_codigo: form.fornecedor_id || null,
        numero_documento: form.numero_documento || null,
        valor_original: valorOrig,
        valor_desconto: valorDesc,
        valor_juros: valorJuros,
        valor_aberto: valorLiquido,
        data_emissao: form.data_emissao || null,
        data_vencimento: form.data_vencimento || null,
        data_competencia: form.data_competencia || null,
        categoria_nome: form.categoria_nome || null,
        total_parcelas: numParcelas,
        portador: form.conta_bancaria_id || null,
        status: "pendente",
      };
      if (form.empresa_id) payload.empresa_id = parseInt(form.empresa_id);

      if (editingId) {
        const { error } = await supabase.from("contas_pagar").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.erp_id = `MAN-${Date.now()}`;
        payload.empresa_id = payload.empresa_id || 1;
        payload.valor_pago = 0;
        const { data: inserted, error } = await supabase.from("contas_pagar").insert(payload).select().single();
        if (error) throw error;

        if (numParcelas > 1 && inserted) {
          const vlrParcela = Math.round((valorLiquido / numParcelas) * 100) / 100;
          const baseDate = form.data_vencimento ? parseISO(form.data_vencimento) : new Date();
          const parcelasData = Array.from({ length: numParcelas }, (_, i) => ({
            conta_pagar_id: inserted.id,
            numero_parcela: i + 1,
            valor: i === numParcelas - 1 ? valorLiquido - vlrParcela * (numParcelas - 1) : vlrParcela,
            data_vencimento: format(addMonths(baseDate, i), "yyyy-MM-dd"),
            status: "aberto",
          }));
          await supabase.from("parcelas").insert(parcelasData);
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Título atualizado!" : "Título criado!");
      qc.invalidateQueries({ queryKey: ["cp-module-table"] });
      qc.invalidateQueries({ queryKey: ["cp-module-kpis"] });
      setDrawerOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelId) return;
      const { error } = await supabase.from("contas_pagar").update({ status: "cancelado" }).eq("id", cancelId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Título cancelado");
      qc.invalidateQueries({ queryKey: ["cp-module-table"] });
      qc.invalidateQueries({ queryKey: ["cp-module-kpis"] });
      setCancelDialogOpen(false);
      setCancelMotivo("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Helpers ───
  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setFornecedorSearch("");
  }, []);

  const openEdit = useCallback((c: ContaPagar) => {
    setForm({
      fornecedor_id: c.fornecedor_codigo || "",
      fornecedor_nome: c.fornecedor_nome || "",
      descricao: "",
      numero_documento: c.numero_documento || "",
      data_emissao: c.data_emissao || "",
      data_vencimento: c.data_vencimento || "",
      data_competencia: c.data_competencia || "",
      valor_original: String(c.valor_original || 0),
      valor_desconto: String(c.valor_desconto || 0),
      valor_juros: String(c.valor_juros || 0),
      numero_parcelas: String(c.total_parcelas || 1),
      conta_bancaria_id: c.portador || "",
      categoria_nome: c.categoria_nome || "",
      centro_custo_id: "",
      observacoes: "",
      empresa_id: String(c.empresa_id || ""),
    });
    setFornecedorSearch(c.fornecedor_nome || "");
    setEditingId(c.id);
    setDrawerOpen(true);
  }, []);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
  };

  const statusBadge = (status: string | null) => {
    const cfg = STATUS_MAP[status || ""] || STATUS_MAP.pendente;
    return <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>{cfg.label}</Badge>;
  };

  // ─── Render ───
  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Gestão de títulos, parcelas e pagamentos</p>
          </div>
          <Button onClick={() => { resetForm(); setDrawerOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Título
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total a Pagar", value: kpiData?.totalPagar, icon: DollarSign, bg: "bg-blue-50", iconColor: "text-blue-600" },
            { label: "Vencidos", value: kpiData?.totalVencido, icon: AlertTriangle, bg: "bg-red-50", iconColor: "text-red-600" },
            { label: "A Vencer (7d)", value: kpiData?.aVencer7d, icon: Clock, bg: "bg-orange-50", iconColor: "text-orange-600" },
            { label: "Pagos no Mês", value: kpiData?.pagoMes, icon: CheckCircle, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("rounded-lg p-2.5", kpi.bg)}><kpi.icon className={cn("h-5 w-5", kpi.iconColor)} /></div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-semibold tabular-nums">{fmtCurrency(kpi.value)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs mb-1 block">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Fornecedor, documento, descrição..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
                </div>
              </div>
              <div className="w-[150px]">
                <Label className="text-xs mb-1 block">Status</Label>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="parcialmente_pago">Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[140px]">
                <Label className="text-xs mb-1 block">Vencimento de</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={d => { setDateFrom(d); setPage(0); }} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-[140px]">
                <Label className="text-xs mb-1 block">Até</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={d => { setDateTo(d); setPage(0); }} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Receipt className="h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">Nenhum título encontrado</p>
                <p className="text-sm">Ajuste os filtros ou crie um novo título</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="w-[120px]">Documento</TableHead>
                        <TableHead className="hidden md:table-cell">Descrição</TableHead>
                        <TableHead className="w-[110px]">Vencimento</TableHead>
                        <TableHead className="text-right w-[120px]">Valor</TableHead>
                        <TableHead className="text-right w-[100px]">Pago</TableHead>
                        <TableHead className="text-right w-[100px]">Saldo</TableHead>
                        <TableHead className="w-[90px]">Status</TableHead>
                        <TableHead className="w-[80px]">Parcelas</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(c => (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/dashboard/financeiro/contas-a-pagar/${c.id}`)}>
                          <TableCell className="max-w-[180px] truncate font-medium text-sm">{c.fornecedor_nome || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{c.numero_documento || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[160px] truncate">{c.categoria_nome || "—"}</TableCell>
                          <TableCell className={cn("tabular-nums text-sm", isOverdue(c.data_vencimento, c.status) && "text-red-600 font-medium")}>
                            {fmtDate(c.data_vencimento)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-sm">{fmtCurrency(c.valor_original)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-emerald-700">{fmtCurrency(c.valor_pago)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{fmtCurrency(c.valor_aberto)}</TableCell>
                          <TableCell>{statusBadge(c.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.numero_parcela || c.parcela || 1}/{c.total_parcelas || 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/dashboard/financeiro/contas-a-pagar/${c.id}`)} title="Ver">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {!["cancelado", "pago"].includes(c.status || "") && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setCancelId(c.id); setCancelDialogOpen(true); }} title="Cancelar">
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">{totalRows} registro{totalRows !== 1 ? "s" : ""}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm tabular-nums">{page + 1} / {totalPages || 1}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ═══ CREATE/EDIT DRAWER ═══ */}
        <Sheet open={drawerOpen} onOpenChange={v => { if (!v) { setDrawerOpen(false); resetForm(); } }}>
          <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingId ? "Editar Título" : "Nova Conta a Pagar"}</SheetTitle>
              <SheetDescription>Preencha os dados do título</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 py-6">
              {/* Fornecedor autocomplete */}
              <div className="relative">
                <Label>Fornecedor *</Label>
                <Input
                  value={fornecedorSearch}
                  onChange={e => { setFornecedorSearch(e.target.value); setShowFornecedorList(true); setForm(f => ({ ...f, fornecedor_nome: e.target.value, fornecedor_id: "" })); }}
                  onFocus={() => fornecedorSearch.length >= 2 && setShowFornecedorList(true)}
                  placeholder="Digite para buscar..."
                />
                {showFornecedorList && fornecedoresAC.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {fornecedoresAC.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setForm(prev => ({ ...prev, fornecedor_id: f.id, fornecedor_nome: f.razao_social || f.nome || "" }));
                          setFornecedorSearch(f.razao_social || f.nome || "");
                          setShowFornecedorList(false);
                        }}
                      >
                        <span className="font-medium">{f.razao_social || f.nome}</span>
                        {f.cnpj && <span className="text-muted-foreground ml-2 text-xs">{f.cnpj}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Descrição *</Label>
                  <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div>
                  <Label>Nº Documento</Label>
                  <Input value={form.numero_documento} onChange={e => setForm(f => ({ ...f, numero_documento: e.target.value }))} />
                </div>
                <div>
                  <Label>Empresa</Label>
                  <Select value={form.empresa_id} onValueChange={v => setForm(f => ({ ...f, empresa_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data Emissão *</Label>
                  <Input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} />
                </div>
                <div>
                  <Label>Data Vencimento *</Label>
                  <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                </div>
                <div>
                  <Label>Mês Competência</Label>
                  <Input type="month" value={form.data_competencia} onChange={e => setForm(f => ({ ...f, data_competencia: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor Original * (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.valor_original} onChange={e => setForm(f => ({ ...f, valor_original: e.target.value }))} />
                </div>
                <div>
                  <Label>Desconto (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.valor_desconto} onChange={e => setForm(f => ({ ...f, valor_desconto: e.target.value }))} />
                </div>
                <div>
                  <Label>Juros (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.valor_juros} onChange={e => setForm(f => ({ ...f, valor_juros: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor Líquido</Label>
                  <Input value={fmtCurrency(valorLiquido)} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Nº Parcelas</Label>
                  <Input type="number" min="1" max="12" value={form.numero_parcelas} onChange={e => setForm(f => ({ ...f, numero_parcelas: e.target.value }))} />
                </div>
                <div>
                  <Label>Conta Bancária</Label>
                  <Select value={form.conta_bancaria_id} onValueChange={v => setForm(f => ({ ...f, conta_bancaria_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {contasBancarias.map(cb => <SelectItem key={cb.id} value={cb.id}>{cb.banco} — Ag {cb.agencia} Cc {cb.conta}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoria_nome} onValueChange={v => setForm(f => ({ ...f, categoria_nome: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Centro de Custo</Label>
                  <Select value={form.centro_custo_id} onValueChange={v => setForm(f => ({ ...f, centro_custo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {centrosCusto.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.codigo ? `${cc.codigo} — ` : ""}{cc.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} />
                </div>
              </div>

              {/* Parcelas preview */}
              {parcelasPreview.length > 0 && (
                <div>
                  <Separator className="my-2" />
                  <Label className="text-sm font-medium mb-2 block">Preview das Parcelas</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs">Nº</TableHead>
                          <TableHead className="text-xs">Vencimento</TableHead>
                          <TableHead className="text-xs text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelasPreview.map(p => (
                          <TableRow key={p.numero}>
                            <TableCell className="text-sm py-1.5">{p.numero}/{parcelasPreview.length}</TableCell>
                            <TableCell className="text-sm py-1.5 tabular-nums">{p.vencimento}</TableCell>
                            <TableCell className="text-sm py-1.5 text-right tabular-nums">{fmtCurrency(p.valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setDrawerOpen(false); resetForm(); }} className="flex-1">Cancelar</Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !form.fornecedor_nome || !form.valor_original || !form.data_vencimento}
                  className="flex-1 gap-2"
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Salvar Alterações" : "Criar Título"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* ═══ CANCEL DIALOG ═══ */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar título?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação é irreversível. O título será permanentemente cancelado.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label>Motivo do cancelamento *</Label>
              <Textarea value={cancelMotivo} onChange={e => setCancelMotivo(e.target.value)} placeholder="Informe o motivo..." rows={3} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCancelMotivo("")}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => cancelMutation.mutate()}
                disabled={!cancelMotivo.trim() || cancelMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar Cancelamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
