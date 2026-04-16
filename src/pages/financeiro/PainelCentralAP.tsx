import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Eye, CreditCard, XCircle, RotateCcw, FileText, History, Upload, MoreHorizontal, Loader2, Paperclip, AlertTriangle, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { PostPaymentErpPrompt } from "@/components/financeiro/ap/PostPaymentErpPrompt";
import { callApi, callExportApi, formatBRL, fmtDate, fmtDateTime, dateToApi, enqueueErpSync } from "@/lib/utils/api-helpers";
import { debounce } from "@/lib/utils/debounce";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { exportToExcel } from "@/utils/excelExport";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-blue-100 text-blue-800" },
  vencido: { label: "Vencido", cls: "bg-red-100 text-red-800" },
  pago: { label: "Pago", cls: "bg-green-100 text-green-800" },
  pago_parcial: { label: "Parcial", cls: "bg-orange-100 text-orange-800" },
  cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-700" },
};

const ERP_BADGES: Record<string, { label: string; cls: string }> = {
  sem_exportacao: { label: "Sem Export.", cls: "bg-gray-100 text-gray-600" },
  pendente: { label: "Na Fila", cls: "bg-yellow-100 text-yellow-800" },
  enviado: { label: "Exportado", cls: "bg-blue-100 text-blue-800" },
  sucesso: { label: "Confirmado", cls: "bg-green-100 text-green-800" },
  erro: { label: "Erro ERP", cls: "bg-red-100 text-red-800" },
};

const ORIGEM_BADGES: Record<string, string> = {
  pluggy: "Pluggy",
  erp_webhook: "ERP",
  manual: "Manual",
};

export default function PainelCentralAP() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Filters
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [filtroFornecedorDebounced, setFiltroFornecedorDebounced] = useState("");
  const [filtroDataDe, setFiltroDataDe] = useState("");
  const [filtroDataAte, setFiltroDataAte] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroDepartamento, setFiltroDepartamento] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroEmissaoDe, setFiltroEmissaoDe] = useState("");
  const [filtroEmissaoAte, setFiltroEmissaoAte] = useState("");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Debounced fornecedor search
  const debouncedSetFornecedor = useMemo(
    () => debounce((v: string) => { setFiltroFornecedorDebounced(v); setPagina(1); }, 400),
    []
  );

  // Modals
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [cancelModal, setCancelModal] = useState<any>(null);
  const [estornoModal, setEstornoModal] = useState<any>(null);
  const [parcelasSheet, setParcelasSheet] = useState<any>(null);
  const [pagamentosSheet, setPagamentosSheet] = useState<any>(null);
  const [anexosSheet, setAnexosSheet] = useState<any>(null);
  const [erpPrompt, setErpPrompt] = useState<string | null>(null);

  // Confirmation dialogs for destructive actions
  const [erpConfirmId, setErpConfirmId] = useState<string | null>(null);
  const [estornoConfirmItem, setEstornoConfirmItem] = useState<any>(null);

  // Payment form — default date to today
  const [payValor, setPayValor] = useState("");
  const [payData, setPayData] = useState("");
  const [payMetodo, setPayMetodo] = useState("PIX");
  const [payPortador, setPayPortador] = useState("");

  // Cancel form
  const [cancelMotivo, setCancelMotivo] = useState("");

  // Estorno form
  const [estornoMotivo, setEstornoMotivo] = useState("");
  const [estornoValor, setEstornoValor] = useState("");

  // Anexo upload
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [anexoTipo, setAnexoTipo] = useState("CP");

  // KPIs
  const { data: resumo, isLoading: resumoLoading } = useQuery({
    queryKey: ["ap-resumo"],
    queryFn: () => callApi("resumo-financeiro-api", { path: "/resumo", dDia: new Date().toISOString().split("T")[0], lApenasResumo: false }),
    staleTime: 60_000,
  });

  const { data: erpStatus } = useQuery({
    queryKey: ["erp-export-status-kpi"],
    queryFn: () => callExportApi("/status"),
    staleTime: 60_000,
  });

  // Empresa list for filter
  const { empresasDoUsuario } = useEmpresaContext();

  // Main table — apply dateToApi to date filters
  const { data: titulos, isLoading: titulosLoading, isError: titulosError } = useQuery({
    queryKey: ["ap-titulos", pagina, porPagina, filtroStatus, filtroFornecedorDebounced, filtroDataDe, filtroDataAte, filtroCategoria, filtroDepartamento, filtroEmpresa, filtroEmissaoDe, filtroEmissaoAte],
    queryFn: () => callApi("contas-pagar-api", {
      path: "/listar",
      pagina,
      registros_por_pagina: porPagina,
      ...(filtroStatus ? { filtrar_por_status: filtroStatus } : {}),
      ...(filtroDataDe ? { filtrar_por_data_de: dateToApi(filtroDataDe) } : {}),
      ...(filtroDataAte ? { filtrar_por_data_ate: dateToApi(filtroDataAte) } : {}),
      ...(filtroFornecedorDebounced ? { filtrar_cliente: filtroFornecedorDebounced } : {}),
      ...(filtroCategoria ? { filtrar_categoria: filtroCategoria } : {}),
      ...(filtroDepartamento ? { filtrar_departamento: filtroDepartamento } : {}),
      ...(filtroEmpresa ? { filtrar_empresa_id: parseInt(filtroEmpresa) } : {}),
      ...(filtroEmissaoDe ? { filtrar_por_emissao_de: dateToApi(filtroEmissaoDe) } : {}),
      ...(filtroEmissaoAte ? { filtrar_por_emissao_ate: dateToApi(filtroEmissaoAte) } : {}),
    }),
    staleTime: 30_000,
  });

  // ERP sync status per title (secondary query)
  const list = titulos?.conta_pagar_cadastro || [];
  const titleIds = list.map((t: any) => t.id).filter(Boolean);

  const { data: erpSyncMap } = useQuery({
    queryKey: ["erp-sync-status-map", titleIds.join(",")],
    queryFn: async () => {
      if (titleIds.length === 0) return {};
      const { data } = await supabase
        .from("erp_sync_log" as any)
        .select("conta_pagar_id, sync_status, created_at")
        .in("conta_pagar_id", titleIds)
        .order("created_at", { ascending: false });
      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        if (!map[row.conta_pagar_id]) {
          map[row.conta_pagar_id] = row.sync_status;
        }
      });
      return map;
    },
    enabled: titleIds.length > 0,
    staleTime: 15_000,
  });

  // Lookups for filters
  const { data: categorias } = useQuery({
    queryKey: ["ap-categorias-filter"],
    queryFn: () => callApi("categorias-api", { path: "/listar" }),
    staleTime: 120_000,
  });

  const { data: departamentos } = useQuery({
    queryKey: ["ap-departamentos-filter"],
    queryFn: () => callApi("departamentos-api", { path: "/listar" }),
    staleTime: 120_000,
  });

  // Contas correntes for payment modal
  const { data: contasCC } = useQuery({
    queryKey: ["contas-correntes-resumo"],
    queryFn: () => callApi("contas-correntes-api", { path: "/resumo" }),
    staleTime: 120_000,
  });

  const contasCCList = contasCC?.data || contasCC?.contas || [];
  const categoriasList = categorias?.data || categorias?.categorias || [];
  const departamentosList = departamentos?.data || departamentos?.departamentos || [];

  // Payment mutation
  const payMutation = useMutation({
    mutationFn: (body: any) => callApi("contas-pagar-api", { path: "/registrar-pagamento", ...body }),
    onSuccess: (data) => {
      toast.success("Pagamento registrado com sucesso!");
      setPaymentModal(null);
      setErpPrompt(data?.id || paymentModal?.id);
      qc.invalidateQueries({ queryKey: ["ap-titulos"] });
      qc.invalidateQueries({ queryKey: ["ap-resumo"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Cancel mutation — enqueues ERP cancellation
  const cancelMutation = useMutation({
    mutationFn: async (body: any) => {
      const result = await callApi("contas-pagar-api", { path: "/cancelar", ...body });
      for (const id of (body.ids || [])) {
        await enqueueErpSync({ contaPagarId: id, operacao: "cancelamento", action: "export_cancelamento" });
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Título cancelado e enfileirado para ERP");
      setCancelModal(null);
      setCancelMotivo("");
      qc.invalidateQueries({ queryKey: ["ap-titulos"] });
      qc.invalidateQueries({ queryKey: ["erp-sync-status-map"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Estorno mutation — enqueues ERP estorno
  const estornoMutation = useMutation({
    mutationFn: async (body: any) => {
      const result = await callApi("contas-pagar-api", { path: "/estornar", ...body });
      await enqueueErpSync({ contaPagarId: body.id, operacao: "estorno", action: "export_estorno" });
      return result;
    },
    onSuccess: () => {
      toast.success("Estorno registrado e enfileirado para ERP");
      setEstornoModal(null);
      qc.invalidateQueries({ queryKey: ["ap-titulos"] });
      qc.invalidateQueries({ queryKey: ["erp-sync-status-map"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ERP export with confirmation dialog
  const erpExportMutation = useMutation({
    mutationFn: async (id: string) => {
      await enqueueErpSync({ contaPagarId: id, operacao: "provisao" });
    },
    onSuccess: () => {
      toast.success("Enviado à fila de exportação ERP");
      setErpConfirmId(null);
      qc.invalidateQueries({ queryKey: ["erp-sync-status-map"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Cancel payment mutation — also enqueues ERP cancellation
  const cancelPaymentMutation = useMutation({
    mutationFn: async (payload: { codigoBaixa: string; contaPagarId: string }) => {
      const result = await callApi("contas-pagar-api", { path: "/cancelar-pagamento", codigo_baixa: payload.codigoBaixa });
      await enqueueErpSync({ contaPagarId: payload.contaPagarId, operacao: "cancelamento_pagamento", action: "export_cancelamento_pagamento" });
      return result;
    },
    onSuccess: () => {
      toast.success("Pagamento cancelado e enfileirado para ERP");
      qc.invalidateQueries({ queryKey: ["ap-pagamentos"] });
      qc.invalidateQueries({ queryKey: ["ap-titulos"] });
      qc.invalidateQueries({ queryKey: ["erp-sync-status-map"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Parcelas
  const { data: parcelas, isLoading: parcelasLoading } = useQuery({
    queryKey: ["ap-parcelas", parcelasSheet?.id],
    queryFn: () => callApi("contas-pagar-api", { path: "/parcelas", conta_pagar_id: parcelasSheet.id }),
    enabled: !!parcelasSheet,
  });

  // Pagamentos
  const { data: pagamentos, isLoading: pagamentosLoading } = useQuery({
    queryKey: ["ap-pagamentos", pagamentosSheet?.id],
    queryFn: () => callApi("contas-pagar-api", { path: "/pagamentos", conta_pagar_id: pagamentosSheet.id }),
    enabled: !!pagamentosSheet,
  });

  // Anexos
  const { data: anexos, isLoading: anexosLoading } = useQuery({
    queryKey: ["ap-anexos", anexosSheet?.id],
    queryFn: () => callApi("contas-pagar-api", { path: "/anexos", conta_pagar_id: anexosSheet.id }),
    enabled: !!anexosSheet,
  });

  // Upload anexo mutation with file size validation
  const uploadAnexoMutation = useMutation({
    mutationFn: async () => {
      if (!anexoFile || !anexosSheet) return;
      if (anexoFile.size > MAX_FILE_SIZE) {
        throw new Error("Arquivo muito grande. Máximo permitido: 10MB.");
      }
      const filePath = `anexos/${anexosSheet.id}/${Date.now()}_${anexoFile.name}`;
      const { error: upErr } = await supabase.storage.from("comprovantes").upload(filePath, anexoFile);
      if (upErr) throw upErr;
      return callApi("contas-pagar-api", {
        path: "/anexos",
        conta_pagar_id: anexosSheet.id,
        tipo_anexo: anexoTipo,
        arquivo_path: filePath,
        nome_arquivo: anexoFile.name,
      });
    },
    onSuccess: () => {
      toast.success("Comprovante anexado com sucesso");
      setAnexoFile(null);
      qc.invalidateQueries({ queryKey: ["ap-anexos"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao anexar"),
  });

  const totalPaginas = titulos?.total_de_paginas || 1;

  // KPI "Vencidos" — use resumo data (total, not page-scoped)
  const vencidosCount = resumo?.contaPagar?.qtdVencidos ?? resumo?.contaPagar?.qVencido ?? (() => {
    // Fallback: count from current page (not ideal but functional)
    const today = new Date().toISOString().split("T")[0];
    return list.filter((t: any) => t.status === "pendente" && t.data_vencimento && t.data_vencimento < today).length;
  })();

  // Payment value validation helper
  const paymentSaldoDevedor = useMemo(() => {
    if (!paymentModal) return 0;
    const valorDoc = paymentModal.valor_documento || paymentModal.valor_original || 0;
    const valorPago = paymentModal.valor_pago || 0;
    return Math.max(0, valorDoc - valorPago);
  }, [paymentModal]);

  const payValorExceedsSaldo = Number(payValor) > paymentSaldoDevedor && paymentSaldoDevedor > 0;

  const kpis = [
    { label: "Total em Aberto", value: formatBRL(resumo?.contaPagar?.vTotal), color: "text-primary" },
    { label: "Vencidos", value: String(vencidosCount), color: "text-destructive" },
    { label: "Pago no Mês", value: formatBRL(resumo?.contaPagar?.vPago), color: "text-success" },
    { label: "Aguardando ERP", value: erpStatus?.pending_total ?? "—", color: "text-warning" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Painel Central — Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada com status ERP integrado</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={async () => {
              if (list.length === 0) { toast.error("Nenhum dado para exportar"); return; }
              await exportToExcel(list.map((item: any) => ({
                Fornecedor: item.fornecedor_nome || "",
                Título: item.codigo_lancamento_integracao || "",
                Categoria: item.codigo_categoria || "",
                Departamento: item.departamento_nome || "",
                Vencimento: fmtDate(item.data_vencimento),
                "Valor Original": item.valor_documento || item.valor_original || 0,
                "Valor Pago": item.valor_pago || 0,
                Status: item.status || "",
              })), { filename: "contas_pagar_ap", sheetName: "Contas a Pagar", includeTimestamp: true });
              toast.success("Excel exportado com sucesso");
            }}>
              <Download className="mr-1 h-4 w-4" /> Exportar Excel
            </Button>
            <Button size="sm" onClick={() => navigate("/dashboard/financeiro/contas-a-pagar/novo")}>
              + Novo Título
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-6">
                {resumoLoading ? <Skeleton className="h-8 w-24" /> : (
                  <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus || "all"} onValueChange={(v) => { setFiltroStatus(v === "all" ? "" : v); setPagina(1); }}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pago_parcial">Parcial</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={filtroCategoria || "all"} onValueChange={(v) => { setFiltroCategoria(v === "all" ? "" : v); setPagina(1); }}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categoriasList.map((c: any) => (
                  <SelectItem key={c.codigo || c.id} value={c.codigo || c.id}>
                    {c.codigo} — {c.descricao || c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Departamento</Label>
            <Select value={filtroDepartamento || "all"} onValueChange={(v) => { setFiltroDepartamento(v === "all" ? "" : v); setPagina(1); }}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {departamentosList.map((d: any) => (
                  <SelectItem key={d.codigo || d.id} value={String(d.codigo || d.id)}>
                    {d.descricao || d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vencimento de</Label>
            <Input type="date" className="h-9 w-[150px]" value={filtroDataDe} onChange={(e) => { setFiltroDataDe(e.target.value); setPagina(1); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vencimento até</Label>
            <Input type="date" className="h-9 w-[150px]" value={filtroDataAte} onChange={(e) => { setFiltroDataAte(e.target.value); setPagina(1); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fornecedor</Label>
            <Input
              className="h-9 w-[180px]"
              placeholder="Buscar..."
              value={filtroFornecedor}
              onChange={(e) => { setFiltroFornecedor(e.target.value); debouncedSetFornecedor(e.target.value); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Por página</Label>
            <Select value={String(porPagina)} onValueChange={(v) => { setPorPagina(Number(v)); setPagina(1); }}>
              <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {titulosLoading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : titulosError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-sm text-destructive font-medium">Erro ao carregar títulos</p>
              <p className="text-xs text-muted-foreground mt-1">Verifique sua conexão e tente novamente.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => qc.invalidateQueries({ queryKey: ["ap-titulos"] })}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>N° Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor Original</TableHead>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem Baixa</TableHead>
                    <TableHead>Status ERP</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        Nenhum título encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((item: any, idx: number) => {
                      const st = STATUS_BADGES[item.status] || STATUS_BADGES.pendente;
                      const erpSt = erpSyncMap?.[item.id] || "sem_exportacao";
                      const erp = ERP_BADGES[erpSt] || ERP_BADGES.sem_exportacao;
                      return (
                        <TableRow key={item.id || idx} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                          <TableCell className="font-medium text-sm">{item.fornecedor_nome || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{item.codigo_lancamento_integracao || "—"}</TableCell>
                          <TableCell className="text-xs">{item.codigo_categoria || "—"}</TableCell>
                          <TableCell className="text-xs">{item.departamento_nome || "—"}</TableCell>
                          <TableCell className="text-xs">{fmtDate(item.data_vencimento)}</TableCell>
                          <TableCell className="text-sm">{formatBRL(item.valor_documento || item.valor_original)}</TableCell>
                          <TableCell className="text-sm">{formatBRL(item.valor_pago)}</TableCell>
                          <TableCell><Badge className={`${st.cls} text-xs`}>{st.label}</Badge></TableCell>
                          <TableCell className="text-xs">{ORIGEM_BADGES[item.baixa_origem] || "—"}</TableCell>
                          <TableCell><Badge className={`${erp.cls} text-xs`}>{erp.label}</Badge></TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/dashboard/financeiro/contas-a-pagar/${item.id}`)}>
                                  <Eye className="mr-2 h-3.5 w-3.5" /> Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setPaymentModal(item);
                                  setPayValor("");
                                  setPayData(new Date().toISOString().split("T")[0]);
                                  setPayMetodo("PIX");
                                  setPayPortador("");
                                }}>
                                  <CreditCard className="mr-2 h-3.5 w-3.5" /> Registrar Pagamento
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setCancelModal(item); setCancelMotivo(""); }}>
                                  <XCircle className="mr-2 h-3.5 w-3.5" /> Cancelar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setEstornoConfirmItem(item);
                                }}>
                                  <RotateCcw className="mr-2 h-3.5 w-3.5" /> Estornar Pagamento
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setParcelasSheet(item)}>
                                  <FileText className="mr-2 h-3.5 w-3.5" /> Ver Parcelas
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPagamentosSheet(item)}>
                                  <History className="mr-2 h-3.5 w-3.5" /> Histórico Pagamentos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setAnexosSheet(item); setAnexoFile(null); }}>
                                  <Paperclip className="mr-2 h-3.5 w-3.5" /> Anexar Comprovante
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setErpConfirmId(item.id)}
                                  disabled={erpExportMutation.isPending}
                                >
                                  {erpExportMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                                  Enviar ao ERP
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Página {pagina} de {totalPaginas} ({titulos?.total_de_registros || 0} registros)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
              </div>
            </div>
          </>
        )}

        {/* ERP Export Confirmation Dialog */}
        <AlertDialog open={!!erpConfirmId} onOpenChange={(o) => !o && setErpConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar envio ao ERP</AlertDialogTitle>
              <AlertDialogDescription>
                Este título será adicionado à fila de exportação para o ERP. Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => erpConfirmId && erpExportMutation.mutate(erpConfirmId)}
                disabled={erpExportMutation.isPending}
              >
                {erpExportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Envio
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Estorno Confirmation → opens estorno modal */}
        <AlertDialog open={!!estornoConfirmItem} onOpenChange={(o) => {
          if (!o) setEstornoConfirmItem(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Estorno</AlertDialogTitle>
              <AlertDialogDescription>
                Estornar um pagamento é uma ação irreversível e será enfileirada para o ERP. Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setEstornoModal(estornoConfirmItem);
                setEstornoMotivo("");
                setEstornoValor("");
                setEstornoConfirmItem(null);
              }}>
                Continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Payment Modal — with validation and dateToApi */}
        <Dialog open={!!paymentModal} onOpenChange={(o) => !o && setPaymentModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">Registrar Pagamento</DialogTitle>
              {paymentModal && (
                <DialogDescription>
                  Saldo devedor: <strong>{formatBRL(paymentSaldoDevedor)}</strong>
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor Pago (R$)</Label>
                <Input type="number" step="0.01" min="0.01" value={payValor} onChange={(e) => setPayValor(e.target.value)} />
                {payValorExceedsSaldo && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Valor excede o saldo devedor ({formatBRL(paymentSaldoDevedor)})
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input type="date" value={payData} onChange={(e) => setPayData(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <Select value={payMetodo} onValueChange={setPayMetodo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["PIX", "TED", "Boleto", "Dinheiro", "Cartão"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Portador (Conta Corrente)</Label>
                <Select value={payPortador} onValueChange={setPayPortador}>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                  <SelectContent>
                    {contasCCList.map((c: any) => (
                      <SelectItem key={c.nCodCC || c.id} value={String(c.nCodCC || c.id)}>
                        {c.descricao || c.cDescricao || `Conta ${c.nCodCC}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentModal(null)}>Cancelar</Button>
              <Button
                disabled={payMutation.isPending || !payValor || !payData || Number(payValor) <= 0 || payValorExceedsSaldo}
                onClick={() => payMutation.mutate({
                  id: paymentModal.id,
                  valor_pago: Number(payValor),
                  data_pagamento: dateToApi(payData),
                  metodo_pagamento: payMetodo,
                  portador_id: payPortador || undefined,
                })}
              >
                {payMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Modal */}
        <Dialog open={!!cancelModal} onOpenChange={(o) => !o && setCancelModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">Cancelar Título</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Motivo (mínimo 10 caracteres)</Label>
              <Input value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} placeholder="Informe o motivo do cancelamento..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelModal(null)}>Voltar</Button>
              <Button
                variant="destructive"
                disabled={cancelMutation.isPending || cancelMotivo.length < 10}
                onClick={() => cancelMutation.mutate({ ids: [cancelModal.id], motivo: cancelMotivo })}
              >
                {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Estorno Modal */}
        <Dialog open={!!estornoModal} onOpenChange={(o) => !o && setEstornoModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">Estornar Pagamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor do Estorno (R$)</Label>
                <Input type="number" step="0.01" value={estornoValor} onChange={(e) => setEstornoValor(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Motivo (obrigatório)</Label>
                <Input value={estornoMotivo} onChange={(e) => setEstornoMotivo(e.target.value)} placeholder="Motivo do estorno..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEstornoModal(null)}>Voltar</Button>
              <Button
                variant="destructive"
                disabled={estornoMutation.isPending || !estornoMotivo || !estornoValor}
                onClick={() => estornoMutation.mutate({ id: estornoModal.id, motivo: estornoMotivo, valor_estorno: Number(estornoValor) })}
              >
                {estornoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Estorno
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Parcelas Sheet — with empty state */}
        <Sheet open={!!parcelasSheet} onOpenChange={(o) => !o && setParcelasSheet(null)}>
          <SheetContent className="w-[500px]">
            <SheetHeader>
              <SheetTitle className="text-foreground">Parcelas</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {parcelasLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (parcelas?.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma parcela encontrada para este título.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>N°</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(parcelas?.data || []).map((p: any, i: number) => (
                      <TableRow key={p.id || i}>
                        <TableCell>{p.numero_parcela || i + 1}</TableCell>
                        <TableCell>{fmtDate(p.data_vencimento)}</TableCell>
                        <TableCell>{formatBRL(p.valor)}</TableCell>
                        <TableCell>{p.status || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Pagamentos Sheet — with Cancel Payment button and empty state */}
        <Sheet open={!!pagamentosSheet} onOpenChange={(o) => !o && setPagamentosSheet(null)}>
          <SheetContent className="w-[550px]">
            <SheetHeader>
              <SheetTitle className="text-foreground">Histórico de Pagamentos</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {pagamentosLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (pagamentos?.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum pagamento registrado para este título.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Método</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pagamentos?.data || []).map((p: any, i: number) => (
                      <TableRow key={p.id || i}>
                        <TableCell>{fmtDate(p.data_pagamento)}</TableCell>
                        <TableCell>{formatBRL(p.valor)}</TableCell>
                        <TableCell>{p.metodo_pagamento || "—"}</TableCell>
                        <TableCell>{p.status || "—"}</TableCell>
                        <TableCell>
                          {p.status !== "cancelado" && p.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-destructive"
                              disabled={cancelPaymentMutation.isPending}
                              onClick={() => cancelPaymentMutation.mutate({ codigoBaixa: p.id, contaPagarId: pagamentosSheet?.id })}
                            >
                              {cancelPaymentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                              Cancelar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Anexos Sheet — upload comprovante with file size validation and empty state */}
        <Sheet open={!!anexosSheet} onOpenChange={(o) => !o && setAnexosSheet(null)}>
          <SheetContent className="w-[500px]">
            <SheetHeader>
              <SheetTitle className="text-foreground">Comprovantes / Anexos</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {/* Upload section */}
              <div className="rounded-md border p-3 space-y-3">
                <Label className="text-sm font-medium">Enviar novo comprovante</Label>
                <div className="space-y-2">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={anexoTipo} onValueChange={setAnexoTipo}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CP">Comprovante Pagamento</SelectItem>
                      <SelectItem value="NF">Nota Fiscal</SelectItem>
                      <SelectItem value="CT">Contrato</SelectItem>
                      <SelectItem value="OT">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > MAX_FILE_SIZE) {
                      toast.error("Arquivo muito grande. Máximo: 10MB.");
                      setAnexoFile(null);
                      e.target.value = "";
                      return;
                    }
                    setAnexoFile(file);
                  }}
                />
                <p className="text-xs text-muted-foreground">Formatos: PDF, JPG, PNG, XML. Máx: 10MB.</p>
                <Button
                  size="sm"
                  disabled={!anexoFile || uploadAnexoMutation.isPending}
                  onClick={() => uploadAnexoMutation.mutate()}
                >
                  {uploadAnexoMutation.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  <Upload className="mr-1 h-3.5 w-3.5" /> Enviar
                </Button>
              </div>

              {/* Existing attachments */}
              {anexosLoading ? (
                <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (anexos?.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum anexo encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Tipo</TableHead><TableHead>Arquivo</TableHead><TableHead>Data</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(anexos?.data || []).map((a: any, i: number) => (
                      <TableRow key={a.id || i}>
                        <TableCell className="text-xs">{a.tipo_anexo || a.tipo || "—"}</TableCell>
                        <TableCell className="text-xs">{a.nome_arquivo || "—"}</TableCell>
                        <TableCell className="text-xs">{fmtDateTime(a.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Post-payment ERP prompt */}
        <PostPaymentErpPrompt
          open={!!erpPrompt}
          onOpenChange={(o) => !o && setErpPrompt(null)}
          tituloId={erpPrompt || ""}
          onConfirm={async () => {
            await callExportApi("/export-batch", "POST", {
              ids: [erpPrompt],
              channel: "rest_api",
              export_type: "payment",
            });
          }}
          onSkip={() => setErpPrompt(null)}
        />
      </div>
    </DashboardLayout>
  );
}
