import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Receipt, Plus, Search, Pencil, Eye, Ban, Loader2, DollarSign,
  AlertTriangle, CheckCircle, FileText, CalendarIcon, CreditCard, Wallet, Users, History, Shield
} from "lucide-react";
import { Link } from "react-router-dom";
import { AdminPasswordDialog } from "@/components/configuracoes/AdminPasswordDialog";
import { CPHistoricoTimeline } from "@/components/financeiro/CPHistoricoTimeline";

// Types
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
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  categoria_nome: string | null;
  portador: string | null;
  status: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  data_competencia: string | null;
  created_at: string;
}

interface Parcela {
  id: string;
  conta_pagar_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  status: string;
}

interface Pagamento {
  id: string;
  conta_pagar_id: string;
  parcela_id: string | null;
  conta_bancaria_id: string | null;
  valor: number;
  data_pagamento: string;
  forma_pagamento: string | null;
  observacoes: string | null;
}

interface ContaBancaria {
  id: string;
  banco: string;
  agencia: string | null;
  conta: string | null;
}

interface Empresa {
  id: number;
  nome: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"; className: string }> = {
  aberto: { label: "Aberto", variant: "default", className: "bg-blue-100 text-blue-800 border-blue-200" },
  pendente: { label: "Pendente", variant: "default", className: "bg-blue-100 text-blue-800 border-blue-200" },
  pago: { label: "Pago", variant: "success", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  vencido: { label: "Vencido", variant: "destructive", className: "bg-red-100 text-red-800 border-red-200" },
  cancelado: { label: "Cancelado", variant: "secondary", className: "bg-gray-100 text-gray-600 border-gray-200" },
  parcialmente_pago: { label: "Parcial", variant: "warning", className: "bg-amber-100 text-amber-800 border-amber-200" },
  parcial: { label: "Parcial", variant: "warning", className: "bg-amber-100 text-amber-800 border-amber-200" },
};

const FORMAS_PAGAMENTO = ["PIX", "TED", "DOC", "boleto", "cheque", "dinheiro", "cartao"];

function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  try {
    const d = parseISO(date);
    return isValid(d) ? format(d, "dd/MM/yyyy") : "—";
  } catch { return "—"; }
}

// ===================== MAIN COMPONENT =====================
export default function ContasPagarGestao() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [empresaFilter, setEmpresaFilter] = useState("all");
  const [fornecedorFilter, setFornecedorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<ContaPagar | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingEditConta, setPendingEditConta] = useState<ContaPagar | null>(null);
  const [editJustificativa, setEditJustificativa] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);
  const PAGE_SIZE = 50;

  // Form state
  const [form, setForm] = useState({
    tipo_documento: "", numero_documento: "", fornecedor_nome: "", fornecedor_codigo: "",
    descricao: "", valor_original: "", data_emissao: "", data_vencimento: "",
    data_competencia: "", numero_parcelas: "1", empresa_id: "", categoria_nome: "",
    portador: "", status: "pendente",
    departamento_nome: "", plano_contas_codigo: "", plano_contas_nome: "",
    chave_nfe: "", numero_documento_fiscal: "", codigo_projeto: "",
    data_previsao: "", id_conta_corrente: "",
  });

  // Payment form
  const [payForm, setPayForm] = useState({
    valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"),
    forma_pagamento: "PIX", conta_bancaria_id: "", observacoes: "", parcela_id: "",
  });

  // ===== QUERIES =====
  const { data: contasResult, isLoading } = useQuery({
    queryKey: ["contas-pagar-gestao", page, statusFilter, empresaFilter, fornecedorFilter, dateFrom?.toISOString(), dateTo?.toISOString(), search],
    queryFn: async () => {
      let q = supabase
        .from("contas_pagar")
        .select("*", { count: "exact" })
        .order("data_vencimento", { ascending: false });

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (empresaFilter !== "all") q = q.eq("empresa_id", parseInt(empresaFilter));
      if (search) q = q.or(`fornecedor_nome.ilike.%${search}%,numero_documento.ilike.%${search}%,categoria_nome.ilike.%${search}%`);
      if (dateFrom) q = q.gte("data_vencimento", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) q = q.lte("data_vencimento", format(dateTo, "yyyy-MM-dd"));

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: (data || []) as ContaPagar[], totalCount: count ?? 0 };
    },
  });

  const contas = contasResult?.data ?? [];
  const totalCount = contasResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome").order("nome");
      if (error) throw error;
      return (data || []) as Empresa[];
    },
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["contas-bancarias-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("id, banco, agencia, conta").eq("status", "ativa");
      if (error) throw error;
      return (data || []) as ContaBancaria[];
    },
  });

  const { data: parcelas = [] } = useQuery({
    queryKey: ["parcelas-detail", selectedConta?.id],
    enabled: !!selectedConta,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("conta_pagar_id", selectedConta!.id)
        .order("numero_parcela");
      if (error) throw error;
      return (data || []) as Parcela[];
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos-detail", selectedConta?.id],
    enabled: !!selectedConta,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("conta_pagar_id", selectedConta!.id)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return (data || []) as Pagamento[];
    },
  });

  // Fornecedores únicos from contas
  const fornecedoresUnicos = useMemo(() => {
    const set = new Map<string, string>();
    contas.forEach(c => {
      if (c.fornecedor_nome) set.set(c.fornecedor_codigo || c.fornecedor_nome, c.fornecedor_nome);
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [contas]);

  // ===== FILTERS =====
  const filtered = useMemo(() => {
    return contas.filter(c => {
      if (fornecedorFilter !== "all" && (c.fornecedor_codigo || c.fornecedor_nome) !== fornecedorFilter) return false;
      return true;
    });
  }, [contas, fornecedorFilter]);

  // ===== SUMMARY CARDS =====
  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    let totalAberto = 0, totalVencido = 0, totalPagoMes = 0;
    filtered.forEach(c => {
      const st = c.status || "";
      if (["aberto", "pendente", "parcialmente_pago", "parcial"].includes(st)) totalAberto += (c.valor_aberto || 0);
      if (st === "vencido") totalVencido += (c.valor_aberto || 0);
      if (st === "pago" && c.data_pagamento && c.data_pagamento >= monthStart && c.data_pagamento <= monthEnd) {
        totalPagoMes += (c.valor_pago || c.valor_original || 0);
      }
    });
    return { totalAberto, totalVencido, totalPagoMes, qtd: filtered.length };
  }, [filtered]);

  // ===== MUTATIONS =====
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        tipo_documento: form.tipo_documento || null,
        numero_documento: form.numero_documento || null,
        fornecedor_nome: form.fornecedor_nome || null,
        fornecedor_codigo: form.fornecedor_codigo || null,
        valor_original: parseFloat(form.valor_original) || 0,
        valor_aberto: parseFloat(form.valor_original) || 0,
        data_emissao: form.data_emissao || null,
        data_vencimento: form.data_vencimento || null,
        data_competencia: form.data_competencia || null,
        categoria_nome: form.categoria_nome || null,
        portador: form.portador || null,
        status: form.status || "pendente",
        total_parcelas: parseInt(form.numero_parcelas) || 1,
        departamento_nome: form.departamento_nome || null,
        plano_contas_codigo: form.plano_contas_codigo || null,
        plano_contas_nome: form.plano_contas_nome || null,
        chave_nfe: form.chave_nfe || null,
        numero_documento_fiscal: form.numero_documento_fiscal || null,
        codigo_projeto: form.codigo_projeto || null,
        data_previsao: form.data_previsao || null,
        id_conta_corrente: form.id_conta_corrente ? parseInt(form.id_conta_corrente) : null,
      };
      if (form.empresa_id) payload.empresa_id = parseInt(form.empresa_id);

      if (editingId) {
        const { error } = await supabase.from("contas_pagar").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.erp_id = `MAN-${Date.now()}`;
        payload.empresa_id = payload.empresa_id || 1;
        const { data: inserted, error } = await supabase.from("contas_pagar").insert(payload).select().single();
        if (error) throw error;

        // Gerar parcelas se > 1
        const numParcelas = parseInt(form.numero_parcelas) || 1;
        if (numParcelas > 1 && inserted) {
          const valorParcela = Math.round((parseFloat(form.valor_original) / numParcelas) * 100) / 100;
          const baseDate = form.data_vencimento ? parseISO(form.data_vencimento) : new Date();
          const parcelasData = Array.from({ length: numParcelas }, (_, i) => {
            const dt = new Date(baseDate);
            dt.setMonth(dt.getMonth() + i);
            return {
              conta_pagar_id: inserted.id,
              numero_parcela: i + 1,
              valor: i === numParcelas - 1
                ? parseFloat(form.valor_original) - valorParcela * (numParcelas - 1)
                : valorParcela,
              data_vencimento: format(dt, "yyyy-MM-dd"),
              status: "aberto",
            };
          });
          await supabase.from("parcelas").insert(parcelasData);
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Título atualizado!" : "Título criado!");
      queryClient.invalidateQueries({ queryKey: ["contas-pagar-gestao"] });
      setModalOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_pagar").update({ status: "cancelado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Título cancelado");
      queryClient.invalidateQueries({ queryKey: ["contas-pagar-gestao"] });
      setCancelDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConta) throw new Error("Nenhum título selecionado");
      const valor = parseFloat(payForm.valor);
      if (!valor || valor <= 0) throw new Error("Valor inválido");

      const pgPayload: any = {
        conta_pagar_id: selectedConta.id,
        valor,
        data_pagamento: payForm.data_pagamento,
        forma_pagamento: payForm.forma_pagamento || null,
        observacoes: payForm.observacoes || null,
      };
      if (payForm.conta_bancaria_id) pgPayload.conta_bancaria_id = payForm.conta_bancaria_id;
      if (payForm.parcela_id) pgPayload.parcela_id = payForm.parcela_id;

      const { error: pgErr } = await supabase.from("pagamentos").insert(pgPayload);
      if (pgErr) throw pgErr;

      // Update parcela if selected
      if (payForm.parcela_id) {
        await supabase.from("parcelas").update({
          status: "pago", data_pagamento: payForm.data_pagamento, valor_pago: valor,
        }).eq("id", payForm.parcela_id);
      }

      // Recalculate valor_aberto
      const novoAberto = Math.max(0, (selectedConta.valor_aberto || 0) - valor);
      const novoPago = (selectedConta.valor_pago || 0) + valor;
      const novoStatus = novoAberto <= 0 ? "pago" : novoAberto < (selectedConta.valor_original || 0) ? "parcialmente_pago" : selectedConta.status;

      await supabase.from("contas_pagar").update({
        valor_aberto: novoAberto, valor_pago: novoPago, status: novoStatus,
        data_pagamento: novoAberto <= 0 ? payForm.data_pagamento : null,
      }).eq("id", selectedConta.id);
    },
    onSuccess: () => {
      toast.success("Pagamento registrado!");
      queryClient.invalidateQueries({ queryKey: ["contas-pagar-gestao"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detail"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-detail"] });
      setPaymentDialogOpen(false);
      setPayForm({ valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento: "PIX", conta_bancaria_id: "", observacoes: "", parcela_id: "" });
      // Refresh selectedConta
      if (selectedConta) {
        supabase.from("contas_pagar").select("*").eq("id", selectedConta.id).single().then(({ data }) => {
          if (data) setSelectedConta(data as ContaPagar);
        });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ===== HELPERS =====
  const resetForm = useCallback(() => {
    setForm({ tipo_documento: "", numero_documento: "", fornecedor_nome: "", fornecedor_codigo: "", descricao: "", valor_original: "", data_emissao: "", data_vencimento: "", data_competencia: "", numero_parcelas: "1", empresa_id: "", categoria_nome: "", portador: "", status: "pendente", departamento_nome: "", plano_contas_codigo: "", plano_contas_nome: "", chave_nfe: "", numero_documento_fiscal: "", codigo_projeto: "", data_previsao: "", id_conta_corrente: "" });
    setEditingId(null);
  }, []);

  const doOpenEdit = useCallback((c: ContaPagar) => {
    setForm({
      tipo_documento: c.tipo_documento || "", numero_documento: c.numero_documento || "",
      fornecedor_nome: c.fornecedor_nome || "", fornecedor_codigo: c.fornecedor_codigo || "",
      descricao: "", valor_original: String(c.valor_original || 0),
      data_emissao: c.data_emissao || "", data_vencimento: c.data_vencimento || "",
      data_competencia: c.data_competencia || "", numero_parcelas: String(c.total_parcelas || 1),
      empresa_id: String(c.empresa_id || ""), categoria_nome: c.categoria_nome || "",
      portador: c.portador || "", status: c.status || "pendente",
      departamento_nome: (c as any).departamento_nome || "", plano_contas_codigo: (c as any).plano_contas_codigo || "",
      plano_contas_nome: (c as any).plano_contas_nome || "", chave_nfe: (c as any).chave_nfe || "",
      numero_documento_fiscal: (c as any).numero_documento_fiscal || "", codigo_projeto: (c as any).codigo_projeto || "",
      data_previsao: (c as any).data_previsao || "", id_conta_corrente: String((c as any).id_conta_corrente || ""),
    });
    setEditingId(c.id);
    setEditJustificativa("");
    setPasswordVerified(false);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((c: ContaPagar) => {
    const isLocked = c.status === "pago" || c.status === "cancelado";
    if (isLocked) {
      setPendingEditConta(c);
      setPasswordDialogOpen(true);
    } else {
      doOpenEdit(c);
    }
  }, [doOpenEdit]);

  const openDetail = useCallback((c: ContaPagar) => {
    setSelectedConta(c);
    setDrawerOpen(true);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    if (cancelId) cancelMutation.mutate(cancelId);
  }, [cancelId]);

  const statusBadge = (status: string | null) => {
    const cfg = STATUS_CONFIG[status || ""] || STATUS_CONFIG.aberto;
    return <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>{cfg.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Gerencie títulos, parcelas e pagamentos</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/dashboard/financeiro/fornecedores">
                <Users className="h-4 w-4" /> Fornecedores
              </Link>
            </Button>
            <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Conta a Pagar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-xs text-muted-foreground">Total a Pagar</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(summary.totalAberto)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2.5"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-xs text-muted-foreground">Vencidos</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(summary.totalVencido)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2.5"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-xs text-muted-foreground">Pagos no Mês</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(summary.totalPagoMes)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2.5"><FileText className="h-5 w-5 text-purple-600" /></div>
              <div><p className="text-xs text-muted-foreground">Qtd Títulos</p><p className="text-lg font-semibold tabular-nums">{summary.qtd}</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs mb-1 block">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Fornecedor, documento, categoria..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="w-[150px]">
                <Label className="text-xs mb-1 block">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="parcialmente_pago">Parcial</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[180px]">
                <Label className="text-xs mb-1 block">Empresa</Label>
                <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {empresas.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[200px]">
                <Label className="text-xs mb-1 block">Fornecedor</Label>
                <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {fornecedoresUnicos.map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}
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
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
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
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Receipt className="h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">Nenhum título encontrado</p>
                <p className="text-sm">Ajuste os filtros ou crie um novo título</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[140px]">Documento</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="w-[120px]">Vencimento</TableHead>
                      <TableHead className="text-right w-[130px]">Valor Original</TableHead>
                      <TableHead className="text-right w-[130px]">Valor Aberto</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(c => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(c)}>
                        <TableCell className="font-mono text-xs">
                          {c.numero_documento || c.erp_id?.slice(0, 12)}
                          {(c.total_parcelas || 1) > 1 && (
                            <span className="text-muted-foreground ml-1">({c.numero_parcela || c.parcela}/{c.total_parcelas})</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{c.fornecedor_nome || "—"}</TableCell>
                        <TableCell className="tabular-nums text-sm">{formatDate(c.data_vencimento)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(c.valor_original)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(c.valor_aberto)}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(c)} title="Ver detalhe">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title={c.status === "pago" || c.status === "cancelado" ? "Editar (requer senha)" : "Editar"}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {c.status !== "cancelado" && c.status !== "pago" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setCancelId(c.id); setCancelDialogOpen(true); }} title="Cancelar">
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    {totalCount > 0
                      ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} de ${totalCount} registros`
                      : "Nenhum registro"}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(0)}>
                      {"<<"}
                    </Button>
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      {"<"}
                    </Button>
                    <span className="text-xs px-2 text-muted-foreground">
                      Pág. {page + 1} de {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
                      {">"}
                    </Button>
                    <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(totalPages - 1)}>
                      {">>"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== CREATE/EDIT MODAL ===== */}
        <Dialog open={modalOpen} onOpenChange={v => { if (!v) { setModalOpen(false); resetForm(); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Título" : "Nova Conta a Pagar"}</DialogTitle>
              <DialogDescription>Preencha os dados do título</DialogDescription>
            </DialogHeader>
            {/* Warning for locked status — unlocked via password */}
            {editingId && (form.status === "pago" || form.status === "cancelado") && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Título com status <strong>{form.status === "pago" ? "Pago" : "Cancelado"}</strong> — edição autorizada via senha. Justificativa obrigatória.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <Label>Tipo Documento</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))} placeholder="NF, Boleto..." />
              </div>
              <div>
                <Label>Nº Documento</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.numero_documento} onChange={e => setForm(f => ({ ...f, numero_documento: e.target.value }))} />
              </div>
              <div>
                <Label>Fornecedor Nome *</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.fornecedor_nome} onChange={e => setForm(f => ({ ...f, fornecedor_nome: e.target.value }))} required />
              </div>
              <div>
                <Label>Fornecedor Código</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.fornecedor_codigo} onChange={e => setForm(f => ({ ...f, fornecedor_codigo: e.target.value }))} />
              </div>
              <div>
                <Label>Valor Original *</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} type="number" step="0.01" value={form.valor_original} onChange={e => setForm(f => ({ ...f, valor_original: e.target.value }))} required />
              </div>
              <div>
                <Label>Empresa</Label>
                <Select disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.empresa_id} onValueChange={v => setForm(f => ({ ...f, empresa_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Emissão</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} />
              </div>
              <div>
                <Label>Data Vencimento *</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} required />
              </div>
              <div>
                <Label>Data Competência</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} type="date" value={form.data_competencia} onChange={e => setForm(f => ({ ...f, data_competencia: e.target.value }))} />
              </div>
              <div>
                <Label>Nº Parcelas</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} type="number" min="1" max="120" value={form.numero_parcelas} onChange={e => setForm(f => ({ ...f, numero_parcelas: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.categoria_nome} onChange={e => setForm(f => ({ ...f, categoria_nome: e.target.value }))} />
              </div>
              <div>
                <Label>Portador</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.portador} onChange={e => setForm(f => ({ ...f, portador: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* === Campos Adicionais === */}
              <div className="col-span-1 md:col-span-2">
                <Separator className="my-2" />
                <p className="text-xs font-semibold text-muted-foreground mb-3">Classificação & NF-e</p>
              </div>
              <div>
                <Label>Departamento</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.departamento_nome} onChange={e => setForm(f => ({ ...f, departamento_nome: e.target.value }))} placeholder="Ex: Financeiro" />
              </div>
              <div>
                <Label>Plano de Contas (Código)</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.plano_contas_codigo} onChange={e => setForm(f => ({ ...f, plano_contas_codigo: e.target.value }))} placeholder="Ex: 2.04.01" />
              </div>
              <div>
                <Label>Plano de Contas (Nome)</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.plano_contas_nome} onChange={e => setForm(f => ({ ...f, plano_contas_nome: e.target.value }))} placeholder="Ex: Serviços Terceiros" />
              </div>
              <div>
                <Label>Chave NF-e</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.chave_nfe} onChange={e => setForm(f => ({ ...f, chave_nfe: e.target.value }))} placeholder="44 dígitos" />
              </div>
              <div>
                <Label>Nº Documento Fiscal</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.numero_documento_fiscal} onChange={e => setForm(f => ({ ...f, numero_documento_fiscal: e.target.value }))} />
              </div>
              <div>
                <Label>Código Projeto</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} value={form.codigo_projeto} onChange={e => setForm(f => ({ ...f, codigo_projeto: e.target.value }))} />
              </div>
              <div>
                <Label>Data Previsão</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} type="date" value={form.data_previsao} onChange={e => setForm(f => ({ ...f, data_previsao: e.target.value }))} />
              </div>
              <div>
                <Label>ID Conta Corrente</Label>
                <Input disabled={editingId != null && (form.status === "pago" || form.status === "cancelado")} type="number" value={form.id_conta_corrente} onChange={e => setForm(f => ({ ...f, id_conta_corrente: e.target.value }))} />
              </div>
            </div>
            {/* Justificativa obrigatória para títulos pagos/cancelados */}
            {editingId && (form.status === "pago" || form.status === "cancelado") && (
              <div className="px-1">
                <Label>Justificativa da alteração *</Label>
                <Input
                  value={editJustificativa}
                  onChange={e => setEditJustificativa(e.target.value)}
                  placeholder="Descreva o motivo da alteração..."
                  className="mt-1"
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button 
                onClick={() => saveMutation.mutate()} 
                disabled={
                  saveMutation.isPending || !form.fornecedor_nome || !form.valor_original || !form.data_vencimento ||
                  (editingId != null && (form.status === "pago" || form.status === "cancelado") && !editJustificativa.trim())
                }
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingId ? "Salvar Alterações" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== CANCEL DIALOG ===== */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar título?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. O título será marcado como cancelado.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Confirmar Cancelamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ===== DETAIL DRAWER ===== */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <div className="overflow-y-auto px-4 pb-6 md:px-6">
              <DrawerHeader className="px-0">
                <DrawerTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Detalhe do Título
                </DrawerTitle>
                <DrawerDescription>
                  {selectedConta?.numero_documento || selectedConta?.erp_id} — {selectedConta?.fornecedor_nome}
                </DrawerDescription>
              </DrawerHeader>

              {selectedConta && (
                <div className="space-y-6">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-muted-foreground">Documento</p><p className="font-medium text-sm">{selectedConta.numero_documento || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium text-sm">{selectedConta.tipo_documento || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Fornecedor</p><p className="font-medium text-sm">{selectedConta.fornecedor_nome || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Empresa</p><p className="font-medium text-sm">{selectedConta.empresa_nome || String(selectedConta.empresa_id)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Emissão</p><p className="font-medium text-sm tabular-nums">{formatDate(selectedConta.data_emissao)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Vencimento</p><p className="font-medium text-sm tabular-nums">{formatDate(selectedConta.data_vencimento)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Competência</p><p className="font-medium text-sm tabular-nums">{formatDate(selectedConta.data_competencia)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Status</p>{statusBadge(selectedConta.status)}</div>
                    <div><p className="text-xs text-muted-foreground">Valor Original</p><p className="font-semibold text-sm tabular-nums">{formatCurrency(selectedConta.valor_original)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Valor Pago</p><p className="font-medium text-sm tabular-nums text-emerald-700">{formatCurrency(selectedConta.valor_pago)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Valor Aberto</p><p className="font-medium text-sm tabular-nums text-red-700">{formatCurrency(selectedConta.valor_aberto)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Categoria</p><p className="font-medium text-sm">{selectedConta.categoria_nome || "—"}</p></div>
                  </div>

                  <Separator />

                  {/* Parcelas */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers className="h-4 w-4" /> Parcelas</h3>
                    {parcelas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma parcela registrada</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="text-xs">Nº</TableHead>
                            <TableHead className="text-xs">Vencimento</TableHead>
                            <TableHead className="text-xs text-right">Valor</TableHead>
                            <TableHead className="text-xs text-right">Pago</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parcelas.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="text-sm">{p.numero_parcela}</TableCell>
                              <TableCell className="text-sm tabular-nums">{formatDate(p.data_vencimento)}</TableCell>
                              <TableCell className="text-sm text-right tabular-nums">{formatCurrency(p.valor)}</TableCell>
                              <TableCell className="text-sm text-right tabular-nums">{formatCurrency(p.valor_pago)}</TableCell>
                              <TableCell>{statusBadge(p.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  <Separator />

                  {/* Histórico de Alterações */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <History className="h-4 w-4" /> Histórico de Alterações
                    </h3>
                    <CPHistoricoTimeline contaId={selectedConta.id} />
                  </div>

                  <Separator />

                  {/* Pagamentos */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Pagamentos</h3>
                      {selectedConta.status !== "pago" && selectedConta.status !== "cancelado" && (
                        <Button size="sm" onClick={() => {
                          setPayForm({ valor: String(selectedConta.valor_aberto || 0), data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento: "PIX", conta_bancaria_id: "", observacoes: "", parcela_id: "" });
                          setPaymentDialogOpen(true);
                        }} className="gap-1.5">
                          <Wallet className="h-3.5 w-3.5" /> Registrar Pagamento
                        </Button>
                      )}
                    </div>
                    {pagamentos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="text-xs">Data</TableHead>
                            <TableHead className="text-xs text-right">Valor</TableHead>
                            <TableHead className="text-xs">Forma</TableHead>
                            <TableHead className="text-xs">Obs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagamentos.map(pg => (
                            <TableRow key={pg.id}>
                              <TableCell className="text-sm tabular-nums">{formatDate(pg.data_pagamento)}</TableCell>
                              <TableCell className="text-sm text-right tabular-nums font-medium">{formatCurrency(pg.valor)}</TableCell>
                              <TableCell className="text-sm">{pg.forma_pagamento || "—"}</TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">{pg.observacoes || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* ===== PAYMENT DIALOG ===== */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>Título: {selectedConta?.numero_documento || selectedConta?.erp_id} — Aberto: {formatCurrency(selectedConta?.valor_aberto)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Valor *</Label>
                <Input type="number" step="0.01" value={payForm.valor} onChange={e => setPayForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <Label>Data Pagamento *</Label>
                <Input type="date" value={payForm.data_pagamento} onChange={e => setPayForm(f => ({ ...f, data_pagamento: e.target.value }))} />
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={payForm.forma_pagamento} onValueChange={v => setPayForm(f => ({ ...f, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {contasBancarias.length > 0 && (
                <div>
                  <Label>Conta Bancária</Label>
                  <Select value={payForm.conta_bancaria_id} onValueChange={v => setPayForm(f => ({ ...f, conta_bancaria_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {contasBancarias.map(cb => <SelectItem key={cb.id} value={cb.id}>{cb.banco} — Ag {cb.agencia} Cc {cb.conta}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {parcelas.length > 0 && (
                <div>
                  <Label>Parcela (opcional)</Label>
                  <Select value={payForm.parcela_id} onValueChange={v => setPayForm(f => ({ ...f, parcela_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {parcelas.filter(p => p.status !== "pago").map(p => (
                        <SelectItem key={p.id} value={p.id}>Parcela {p.numero_parcela} — {formatCurrency(p.valor)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Observações</Label>
                <Input value={payForm.observacoes} onChange={e => setPayForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending || !payForm.valor}>
                {paymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Layers icon used in drawer
import { Layers } from "lucide-react";
