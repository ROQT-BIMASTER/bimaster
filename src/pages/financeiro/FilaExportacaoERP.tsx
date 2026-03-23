import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, RefreshCw, CheckCircle2, Upload, ChevronDown, Settings, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function callExportApi(path: string, method = "GET", body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/contas-pagar-export-api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Processando", cls: "bg-blue-100 text-blue-800" },
  exported: { label: "Exportado", cls: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Confirmado", cls: "bg-green-100 text-green-800" },
  error: { label: "Erro", cls: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelado", cls: "bg-gray-100 text-gray-700" },
};

function formatBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm"); } catch { return d; }
}

export default function FilaExportacaoERP() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("provisao");
  const [reconcModal, setReconcModal] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);

  // KPIs
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["erp-export-status"],
    queryFn: () => callExportApi("/status"),
    staleTime: 30_000,
  });

  // Pending provisions
  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ["erp-export-pending"],
    queryFn: () => callExportApi("/pending"),
    staleTime: 30_000,
  });

  // Paid
  const { data: paid, isLoading: paidLoading } = useQuery({
    queryKey: ["erp-export-paid"],
    queryFn: () => callExportApi("/paid"),
    staleTime: 30_000,
  });

  // History
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["erp-export-history"],
    queryFn: () => callExportApi("/history"),
    staleTime: 30_000,
  });

  // Reconciliation
  const reconcMutation = useMutation({
    mutationFn: () => callExportApi("/reconciliation"),
    onSuccess: () => setReconcModal(true),
    onError: (e: any) => toast.error(e.message),
  });

  // Confirm
  const confirmMutation = useMutation({
    mutationFn: (args: { ids: string[]; export_type: string }) =>
      callExportApi("/confirm", "POST", args),
    onSuccess: (data) => {
      toast.success(`${data.confirmed || 0} título(s) confirmado(s)`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["erp-export"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Export batch
  const batchMutation = useMutation({
    mutationFn: (args: { ids: string[]; export_type: string }) =>
      callExportApi("/export-batch", "POST", { ...args, channel: "rest_api" }),
    onSuccess: (data) => {
      toast.success(`Enfileirados: ${data.queued || 0}, Ignorados: ${data.skipped || 0}`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["erp-export"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Retry
  const retryMutation = useMutation({
    mutationFn: (ids: string[]) =>
      callExportApi("/retry-failed", "POST", { ids, channel: "rest_api" }),
    onSuccess: () => {
      toast.success("Reprocessamento iniciado");
      qc.invalidateQueries({ queryKey: ["erp-export"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Webhook push
  const webhookMutation = useMutation({
    mutationFn: () =>
      callExportApi("/webhook-push", "POST", {
        webhook_url: webhookUrl,
        events: webhookEvents,
        secret: webhookSecret,
      }),
    onSuccess: () => toast.success("Configuração de webhook salva"),
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((items: any[]) => {
    if (!items) return;
    const allIds = items.map((i: any) => i.id);
    const allSelected = allIds.every((id: string) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [selectedIds]);

  const kpis = [
    { label: "Aguardando Provisão", value: status?.pending_registration ?? "—", color: "text-[#EA580C]" },
    { label: "Aguardando Baixa", value: status?.pending_payment ?? "—", color: "text-[#2563EB]" },
    { label: "Com Erro", value: status?.errors ?? "—", color: "text-[#DC2626]" },
  ];

  function renderTable(items: any[] | undefined, loading: boolean, exportType: string, showErpRef = false) {
    if (loading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      );
    }
    const list = Array.isArray(items) ? items : (items as any)?.data || [];
    if (list.length === 0) {
      return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro encontrado.</p>;
    }
    return (
      <>
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            disabled={selectedIds.size === 0 || confirmMutation.isPending}
            onClick={() =>
              confirmMutation.mutate({ ids: Array.from(selectedIds), export_type: exportType })
            }
          >
            {confirmMutation.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Confirmar Exportação
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedIds.size === 0 || selectedIds.size > 200 || batchMutation.isPending}
            onClick={() =>
              batchMutation.mutate({ ids: Array.from(selectedIds), export_type: exportType })
            }
          >
            {batchMutation.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            <Upload className="mr-1 h-3.5 w-3.5" /> Exportar Lote ({selectedIds.size})
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB]">
                <TableHead className="w-10">
                  <Checkbox
                    checked={list.length > 0 && list.every((i: any) => selectedIds.has(i.id))}
                    onCheckedChange={() => toggleAll(list)}
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data Criação</TableHead>
                <TableHead>Status</TableHead>
                {showErpRef && <TableHead>Ref. ERP</TableHead>}
                {showErpRef && <TableHead>Confirmação</TableHead>}
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item: any, idx: number) => {
                const st = STATUS_BADGES[item.status] || STATUS_BADGES.pending;
                return (
                  <TableRow key={item.id} className={idx % 2 === 0 ? "" : "bg-[#F9FAFB]"}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.id?.substring(0, 8)}...
                    </TableCell>
                    <TableCell>{item.fornecedor?.nome || item.fornecedor_nome || "—"}</TableCell>
                    <TableCell>{formatBRL(item.pagamento?.valor || item.valor)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.export_type || exportType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(item.created_at)}</TableCell>
                    <TableCell>
                      <Badge className={`${st.cls} text-xs`}>{st.label}</Badge>
                    </TableCell>
                    {showErpRef && <TableCell className="text-xs">{item.erp_reference || "—"}</TableCell>}
                    {showErpRef && <TableCell className="text-xs">{formatDate(item.confirmed_at)}</TableCell>}
                    <TableCell>
                      {item.status === "error" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-[#DC2626]"
                          onClick={() => retryMutation.mutate([item.id])}
                          disabled={retryMutation.isPending}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" /> Reprocessar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[#1B2A4A]">Fila de Exportação ERP</h1>
          <p className="text-sm text-muted-foreground">Gerencie provisões, baixas e histórico de exportação</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              {statusLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
              )}
              <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); }}>
        <TabsList>
          <TabsTrigger value="provisao">Pendentes Provisão</TabsTrigger>
          <TabsTrigger value="baixa">Pendentes Baixa / Cancel.</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="provisao" className="mt-4">
          {renderTable(pending, pendingLoading, "registration")}
        </TabsContent>

        <TabsContent value="baixa" className="mt-4">
          {renderTable(paid, paidLoading, "payment")}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reconcMutation.mutate()}
              disabled={reconcMutation.isPending}
            >
              {reconcMutation.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Reconciliar BiMaster x ERP
            </Button>
          </div>
          {renderTable(history, historyLoading, "registration", true)}
        </TabsContent>
      </Tabs>

      {/* Webhook Config */}
      <Collapsible open={webhookOpen} onOpenChange={setWebhookOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-2 text-sm text-muted-foreground">
            <Settings className="h-4 w-4" />
            Configuração Webhook Push
            <ChevronDown className={`h-4 w-4 transition-transform ${webhookOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL destino ERP</Label>
                  <Input
                    type="url"
                    placeholder="https://erp.example.com/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>HMAC Secret</Label>
                  <Input
                    type="text"
                    placeholder="Secret para assinatura HMAC"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Eventos</Label>
                <div className="flex gap-4">
                  {["accepted", "paid", "cancelled"].map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={webhookEvents.includes(ev)}
                        onCheckedChange={(checked) => {
                          setWebhookEvents((prev) =>
                            checked ? [...prev, ev] : prev.filter((e) => e !== ev)
                          );
                        }}
                      />
                      {ev}
                    </label>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => webhookMutation.mutate()}
                disabled={webhookMutation.isPending || !webhookUrl}
              >
                {webhookMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configuração
              </Button>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Reconciliation Modal */}
      <Dialog open={reconcModal} onOpenChange={setReconcModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1B2A4A]">Reconciliação BiMaster x ERP</DialogTitle>
          </DialogHeader>
          {reconcMutation.data?.resumo && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>Total Títulos: <strong>{reconcMutation.data.resumo.total_titulos}</strong></div>
                <div>Exportados: <strong className="text-[#16A34A]">{reconcMutation.data.resumo.exportados}</strong></div>
                <div>Com Erro: <strong className="text-[#DC2626]">{reconcMutation.data.resumo.com_erro}</strong></div>
                <div>Taxa Sinc.: <strong className="text-[#2563EB]">{reconcMutation.data.resumo.taxa_sincronizacao}%</strong></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
