import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, Pencil, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown, Check, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  filterEmpresas: number[];
  filterAno: string;
  filterMes: string;
  filterDepartamento: string;
  filterPortadores: string[];
}

interface FormData {
  fornecedor_nome: string;
  fornecedor_codigo: string;
  tipo_documento: string;
  numero_documento: string;
  descricao: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  valor_desconto: number;
  valor_juros: number;
  valor_ajustes: number;
  numero_parcelas: number;
  categoria_nome: string;
  departamento_id: string;
  portador_id: string;
  conta: string;
  empresa_id: number;
  empresa_nome: string;
  observacoes: string;
  codigo_integracao: string;
}

const emptyForm: FormData = {
  fornecedor_nome: "", fornecedor_codigo: "", tipo_documento: "NF",
  numero_documento: "", descricao: "", data_emissao: new Date().toISOString().slice(0, 10),
  data_vencimento: "", valor_original: 0, valor_desconto: 0, valor_juros: 0,
  valor_ajustes: 0, numero_parcelas: 1, categoria_nome: "", departamento_id: "",
  portador_id: "", conta: "", empresa_id: 1, empresa_nome: "", observacoes: "",
  codigo_integracao: "",
};

function statusBadge(s: string | null) {
  const st = (s || "").toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    pago: { label: "Pago", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    vencido: { label: "Vencido", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    parcial: { label: "Parcial", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  };
  const m = map[st] || { label: st || "—", cls: "bg-muted text-muted-foreground" };
  return <Badge className={cn("text-xs font-medium border-0", m.cls)}>{m.label}</Badge>;
}

function isOverdue(dt: string | null) {
  if (!dt) return false;
  return new Date(dt + "T00:00:00") < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
}

export function ContasPagarTabContent({ filterEmpresas, filterAno, filterMes, filterDepartamento, filterPortadores }: Props) {
  const qc = useQueryClient();
  const nav = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [erpFilter, setErpFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [fornecedorOpen, setFornecedorOpen] = useState(false);

  // Cancel dialog
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelJust, setCancelJust] = useState("");

  // ----- Queries -----
  const { data: contasResult, isLoading, refetch: refetchContas } = useQuery({
    queryKey: ["cp-tab-contas", filterEmpresas.join(","), filterAno, filterMes, filterDepartamento, filterPortadores.join(","), statusFilter, search, erpFilter, dateFrom?.toISOString(), dateTo?.toISOString(), page],
    queryFn: async () => {
      let q: any = supabase.from("contas_pagar").select("*", { count: "exact" }).order("data_vencimento", { ascending: false });
      if (filterEmpresas.length) q = q.in("empresa_id", filterEmpresas);
      if (filterAno !== "all") {
        q = q.gte("data_vencimento", `${filterAno}-01-01`).lte("data_vencimento", `${filterAno}-12-31`);
      }
      if (filterMes !== "all" && filterAno !== "all") {
        const m = filterMes.padStart(2, "0");
        q = q.gte("data_vencimento", `${filterAno}-${m}-01`).lte("data_vencimento", `${filterAno}-${m}-31`);
      }
      if (filterDepartamento !== "all") q = q.eq("departamento_id", filterDepartamento);
      if (filterPortadores.length) q = q.in("portador_id", filterPortadores);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (erpFilter === "sincronizado") q = q.eq("importado_api", true);
      if (erpFilter === "pendente") q = q.eq("importado_api", false);
      if (search) {
        q = q.or(`fornecedor_nome.ilike.%${search}%,numero_documento.ilike.%${search}%`);
      }
      if (dateFrom) q = q.gte("data_vencimento", dateFrom.toISOString().slice(0, 10));
      if (dateTo) q = q.lte("data_vencimento", dateTo.toISOString().slice(0, 10));

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data || [], totalCount: count ?? 0 };
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Auto-refresh every 30s for N8N sync
  });

  const contas = contasResult?.data;
  const totalCount = contasResult?.totalCount ?? 0;

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-autocomplete"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("fornecedores").select("id,nome,codigo_externo,cnpj").eq("status", "ativo").order("nome").limit(500);
      return data || [];
    },
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas-select"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id,nome").eq("status", "ativo").order("nome");
      return data || [];
    },
  });

  const { data: contasBancarias } = useQuery({
    queryKey: ["contas-bancarias-select"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("contas_bancarias").select("id,banco,agencia,conta,tipo").eq("status", "ativo").order("banco");
      return data || [];
    },
  });

  const { data: centrosCusto } = useQuery({
    queryKey: ["centros-custo-select"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("centros_custo").select("id,nome,codigo").eq("status", "ativo").order("nome");
      return data || [];
    },
  });

  const { data: departamentos } = useQuery({
    queryKey: ["departamentos-select"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("departamentos").select("id,nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  // ERP filter is now server-side
  const filtered = contas || [];

  // ----- Pagination (fully server-side) -----
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginated = filtered;

  // ----- Mutations -----
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        // Update existing
        const { error } = await supabase.from("contas_pagar").update({
          fornecedor_nome: form.fornecedor_nome,
          fornecedor_codigo: form.fornecedor_codigo || null,
          tipo_documento: form.tipo_documento || null,
          numero_documento: form.numero_documento || null,
          data_emissao: form.data_emissao || null,
          data_vencimento: form.data_vencimento || null,
          valor_original: form.valor_original,
          valor_desconto: form.valor_desconto,
          valor_juros: form.valor_juros,
          valor_ajustes: form.valor_ajustes,
          categoria_nome: form.categoria_nome || null,
          departamento_id: form.departamento_id || null,
          portador_id: form.portador_id || null,
          conta: form.conta || null,
        }).eq("id", editingId);
        if (error) throw error;
      } else if (form.numero_parcelas > 1) {
        // Create with RPC
        const { error } = await (supabase as any).rpc("fn_criar_titulo_com_parcelas", {
          p_fornecedor_nome: form.fornecedor_nome,
          p_fornecedor_codigo: form.fornecedor_codigo || null,
          p_tipo_documento: form.tipo_documento || null,
          p_numero_documento: form.numero_documento || null,
          p_data_emissao: form.data_emissao || null,
          p_data_vencimento: form.data_vencimento || null,
          p_valor_original: form.valor_original,
          p_valor_desconto: form.valor_desconto,
          p_valor_juros: form.valor_juros,
          p_valor_ajustes: form.valor_ajustes,
          p_empresa_id: form.empresa_id,
          p_empresa_nome: form.empresa_nome || null,
          p_numero_parcelas: form.numero_parcelas,
          p_categoria_nome: form.categoria_nome || null,
          p_departamento_id: form.departamento_id || null,
          p_conta: form.conta || null,
          p_observacoes: form.observacoes || null,
        });
        if (error) throw error;
      } else {
        // Single insert
        const valorLiquido = form.valor_original - form.valor_desconto + form.valor_juros + form.valor_ajustes;
        const { error } = await supabase.from("contas_pagar").insert({
          erp_id: "MAN-" + crypto.randomUUID(),
          empresa_id: form.empresa_id,
          empresa_nome: form.empresa_nome || null,
          fornecedor_nome: form.fornecedor_nome,
          fornecedor_codigo: form.fornecedor_codigo || null,
          tipo_documento: form.tipo_documento || null,
          numero_documento: form.numero_documento || null,
          data_emissao: form.data_emissao || null,
          data_vencimento: form.data_vencimento || null,
          valor_original: form.valor_original,
          valor_desconto: form.valor_desconto,
          valor_juros: form.valor_juros,
          valor_ajustes: form.valor_ajustes,
          valor_aberto: valorLiquido,
          valor_pago: 0,
          numero_parcela: 1,
          total_parcelas: 1,
          categoria_nome: form.categoria_nome || null,
          departamento_id: form.departamento_id || null,
          portador_id: form.portador_id || null,
          conta: form.conta || null,
          status: "pendente",
          baixa_origem: "manual",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Título atualizado" : "Título criado");
      qc.invalidateQueries({ queryKey: ["cp-tab-contas"] });
      qc.invalidateQueries({ queryKey: ["contas-pagar"] });
      closeDrawer();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelId) return;
      const { error } = await supabase.from("contas_pagar").update({ status: "cancelado" }).eq("id", cancelId);
      if (error) throw error;
      // Log in historico
      await supabase.from("contas_pagar_historico").insert({
        conta_id: cancelId,
        campo_alterado: "status",
        valor_anterior: "pendente",
        valor_novo: "cancelado",
        tipo_alteracao: "cancelamento",
        justificativa: cancelJust || "Cancelado pelo usuário",
      });
    },
    onSuccess: () => {
      toast.success("Título cancelado");
      qc.invalidateQueries({ queryKey: ["cp-tab-contas"] });
      qc.invalidateQueries({ queryKey: ["contas-pagar"] });
      setCancelId(null);
      setCancelJust("");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // ----- Helpers -----
  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDrawerOpen(true);
  }

  function openEdit(c: any) {
    setEditingId(c.id);
    setEditingStatus(c.status || null);
    setForm({
      fornecedor_nome: c.fornecedor_nome || "",
      fornecedor_codigo: c.fornecedor_codigo || "",
      tipo_documento: c.tipo_documento || "NF",
      numero_documento: c.numero_documento || "",
      descricao: c.categoria_nome || "",
      data_emissao: c.data_emissao?.slice(0, 10) || "",
      data_vencimento: c.data_vencimento?.slice(0, 10) || "",
      valor_original: c.valor_original || 0,
      valor_desconto: c.valor_desconto || 0,
      valor_juros: c.valor_juros || 0,
      valor_ajustes: c.valor_ajustes || 0,
      numero_parcelas: c.total_parcelas || 1,
      categoria_nome: c.categoria_nome || "",
      departamento_id: c.departamento_id || "",
      portador_id: c.portador_id || "",
      conta: c.conta || "",
      empresa_id: c.empresa_id || 1,
      empresa_nome: c.empresa_nome || "",
      observacoes: "",
      codigo_integracao: c.codigo_integracao || "",
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingId(null);
    setEditingStatus(null);
  }

  const isReadOnly = editingStatus === "pago" || editingStatus === "cancelado";

  const valorLiquido = form.valor_original - form.valor_desconto + form.valor_juros + form.valor_ajustes;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setErpFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  }

  const hasFilters = search || statusFilter !== "all" || erpFilter !== "all" || dateFrom || dateTo;


  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Buscar fornecedor / documento..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-64 h-9 text-sm"
          />
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={erpFilter} onValueChange={v => { setErpFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Sinc. ERP" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ERP: Todos</SelectItem>
              <SelectItem value="sincronizado">Sincronizado</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={d => { setDateFrom(d); setPage(1); }} onDateToChange={d => { setDateTo(d); setPage(1); }} />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">Limpar</Button>
          )}
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Título
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead className="hidden lg:table-cell">Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell text-center">ERP</TableHead>
                      <TableHead className="hidden md:table-cell">Parcelas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{c.fornecedor_nome || "—"}</TableCell>
                        <TableCell className="text-sm">{c.numero_documento || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[180px] truncate">{c.categoria_nome || "—"}</TableCell>
                        <TableCell className={cn("text-sm", c.status !== "pago" && c.status !== "cancelado" && isOverdue(c.data_vencimento) && "text-destructive font-semibold")}>
                          {c.data_vencimento ? format(new Date(c.data_vencimento + "T00:00:00"), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">{BRL.format(c.valor_original || 0)}</TableCell>
                        <TableCell className="text-right text-sm">{BRL.format(c.valor_pago || 0)}</TableCell>
                        <TableCell className="text-right text-sm">{BRL.format(c.valor_aberto || 0)}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell className="hidden md:table-cell text-center">
                          {(c as any).importado_api && (c as any).codigo_integracao ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span><CheckCircle2 className="h-4 w-4 text-emerald-500 inline-block" /></span>
                              </TooltipTrigger>
                              <TooltipContent><p>Cód: {(c as any).codigo_integracao}</p></TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span><Clock className="h-4 w-4 text-amber-500 inline-block" /></span>
                              </TooltipTrigger>
                              <TooltipContent><p>Pendente de envio ao ERP</p></TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-center">{c.numero_parcela || 1}/{c.total_parcelas || 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav(`/dashboard/financeiro/contas-a-pagar/${c.id}`)} title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Editar" disabled={c.status === "cancelado" || c.status === "pago"}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setCancelId(c.id)} title="Cancelar" disabled={c.status === "cancelado" || c.status === "pago"}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">{filtered.length} registros</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page === 1}><ChevronsLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm px-3">Página {page} de {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page >= totalPages}><ChevronsRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Drawer Create/Edit ===== */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar Título" : "Novo Título"}</SheetTitle>
            <SheetDescription>{editingId ? "Altere os dados do título" : "Preencha os dados para criar um novo título a pagar"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {/* Warning banner for locked status */}
            {isReadOnly && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Este título está com status <strong>{editingStatus === "pago" ? "Pago" : "Cancelado"}</strong> e não pode ser alterado.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Fornecedor *</Label>
              <Popover open={isReadOnly ? false : fornecedorOpen} onOpenChange={setFornecedorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between h-10 font-normal" disabled={isReadOnly}>
                    {form.fornecedor_nome || "Selecionar fornecedor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar fornecedor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum fornecedor</CommandEmpty>
                      <CommandGroup>
                        {fornecedores?.map(f => (
                          <CommandItem key={f.id} value={f.nome} onSelect={() => {
                            setForm(prev => ({ ...prev, fornecedor_nome: f.nome, fornecedor_codigo: f.codigo_externo || "" }));
                            setFornecedorOpen(false);
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", form.fornecedor_nome === f.nome ? "opacity-100" : "opacity-0")} />
                            {f.nome} {f.cnpj ? `(${f.cnpj})` : ""}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Empresa */}
            <div className="space-y-1.5">
              <Label>Empresa *</Label>
              <Select disabled={isReadOnly} value={form.empresa_id.toString()} onValueChange={v => {
                const emp = empresas?.find(e => e.id.toString() === v);
                setForm(prev => ({ ...prev, empresa_id: Number(v), empresa_nome: emp?.nome || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas?.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo Documento</Label>
                <Select disabled={isReadOnly} value={form.tipo_documento} onValueChange={v => setForm(p => ({ ...p, tipo_documento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["NF", "NFS", "Boleto", "Recibo", "Contrato", "Fatura", "Outros"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nº Documento</Label>
                <Input disabled={isReadOnly} value={form.numero_documento} onChange={e => setForm(p => ({ ...p, numero_documento: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data Emissão</Label>
                <Input disabled={isReadOnly} type="date" value={form.data_emissao} onChange={e => setForm(p => ({ ...p, data_emissao: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data Vencimento *</Label>
                <Input disabled={isReadOnly} type="date" value={form.data_vencimento} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor Original *</Label>
                <Input disabled={isReadOnly} type="number" min={0} step="0.01" value={form.valor_original} onChange={e => setForm(p => ({ ...p, valor_original: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto</Label>
                <Input disabled={isReadOnly} type="number" min={0} step="0.01" value={form.valor_desconto} onChange={e => setForm(p => ({ ...p, valor_desconto: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Juros</Label>
                <Input disabled={isReadOnly} type="number" min={0} step="0.01" value={form.valor_juros} onChange={e => setForm(p => ({ ...p, valor_juros: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Ajustes</Label>
                <Input disabled={isReadOnly} type="number" min={0} step="0.01" value={form.valor_ajustes} onChange={e => setForm(p => ({ ...p, valor_ajustes: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              Valor Líquido: <strong>{BRL.format(valorLiquido)}</strong>
            </div>

            {!editingId && (
              <div className="space-y-1.5">
                <Label>Nº de Parcelas</Label>
                <Select value={form.numero_parcelas.toString()} onValueChange={v => setForm(p => ({ ...p, numero_parcelas: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Conta Bancária</Label>
              <Select disabled={isReadOnly} value={form.conta} onValueChange={v => setForm(p => ({ ...p, conta: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contasBancarias?.map(cb => <SelectItem key={cb.id} value={cb.id}>{cb.banco} - Ag {cb.agencia} / {cb.conta}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input disabled={isReadOnly} value={form.categoria_nome} onChange={e => setForm(p => ({ ...p, categoria_nome: e.target.value }))} placeholder="Ex: Material de escritório" />
            </div>

            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select disabled={isReadOnly} value={form.departamento_id} onValueChange={v => setForm(p => ({ ...p, departamento_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {departamentos?.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea disabled={isReadOnly} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} />
            </div>

            {/* ERP Integration Code - readonly */}
            {editingId && (
              <div className="space-y-1.5">
                <Label>Cód. Integração ERP</Label>
                <Input
                  value={form.codigo_integracao || ""}
                  readOnly
                  disabled
                  placeholder="Preenchido automaticamente ao enviar ao ERP"
                  className="bg-muted/50"
                />
              </div>
            )}
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={closeDrawer}>{isReadOnly ? "Fechar" : "Cancelar"}</Button>
            {!isReadOnly && (
              <Button onClick={() => saveMutation.mutate()} disabled={!form.fornecedor_nome || !form.data_vencimento || form.valor_original <= 0 || saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar" : "Criar Título"}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Cancel AlertDialog */}
      <AlertDialog open={!!cancelId} onOpenChange={open => { if (!open) { setCancelId(null); setCancelJust(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Título</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O título será marcado como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Justificativa *</Label>
            <Textarea value={cancelJust} onChange={e => setCancelJust(e.target.value)} placeholder="Motivo do cancelamento..." rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMutation.mutate()} disabled={!cancelJust.trim() || cancelMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
