import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Pencil, Ban, Loader2, Wallet, CheckCircle,
  ChevronDown, CreditCard, Clock
} from "lucide-react";

// ─── Helpers ───
function fmtCurrency(v: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try { const p = parseISO(d); return isValid(p) ? format(p, "dd/MM/yyyy") : "—"; } catch { return "—"; }
}
function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  try { const p = parseISO(d); return isValid(p) ? format(p, "dd/MM/yyyy HH:mm") : "—"; } catch { return "—"; }
}
function isOverdue(d: string | null, status: string | null): boolean {
  if (!d || !["pendente", "aberto"].includes(status || "")) return false;
  return d < format(new Date(), "yyyy-MM-dd");
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-blue-100 text-blue-800 border-blue-200" },
  aberto: { label: "Aberto", className: "bg-blue-100 text-blue-800 border-blue-200" },
  pago: { label: "Pago", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  vencido: { label: "Vencido", className: "bg-red-100 text-red-800 border-red-200" },
  cancelado: { label: "Cancelado", className: "bg-gray-100 text-gray-600 border-gray-200" },
  parcialmente_pago: { label: "Parcial", className: "bg-amber-100 text-amber-800 border-amber-200" },
  parcial: { label: "Parcial", className: "bg-amber-100 text-amber-800 border-amber-200" },
};
const FORMAS_PAGAMENTO = ["PIX", "TED", "DOC", "Boleto", "Dinheiro", "Cheque", "Cartão Débito", "Cartão Crédito", "Transferência"];

export default function ContaPagarDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);

  // Payment form
  const [payForm, setPayForm] = useState({
    data_pagamento: format(new Date(), "yyyy-MM-dd"),
    valor_pago: "",
    valor_desconto: "0",
    valor_juros: "0",
    forma_pagamento: "",
    conta_bancaria_id: "",
    numero_documento: "",
    autenticacao: "",
    observacoes: "",
  });

  // ─── Queries ───
  const { data: conta, isLoading } = useQuery({
    queryKey: ["cp-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_pagar").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: parcelas = [] } = useQuery({
    queryKey: ["cp-detalhe-parcelas", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("parcelas").select("*").eq("conta_pagar_id", id!).order("numero_parcela");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["cp-contas-bancarias-detalhe"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("id, banco, agencia, conta").eq("status", "ativa");
      return data || [];
    },
  });

  const parcelasPagas = parcelas.filter((p: any) => p.status === "pago").length;
  const totalParcelas = parcelas.length || conta?.total_parcelas || 1;
  const progressPct = totalParcelas > 0 ? (parcelasPagas / totalParcelas) * 100 : 0;

  const isReadonly = ["pago", "cancelado"].includes(conta?.status || "");

  // ─── Mutations ───
  const payMutation = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(payForm.valor_pago);
      if (!valor || valor <= 0) throw new Error("Valor inválido");

      const pgPayload: any = {
        conta_pagar_id: id,
        valor,
        data_pagamento: payForm.data_pagamento,
        forma_pagamento: payForm.forma_pagamento || null,
        observacoes: payForm.observacoes || null,
      };
      if (payForm.conta_bancaria_id) pgPayload.conta_bancaria_id = payForm.conta_bancaria_id;
      if (selectedParcelaId) pgPayload.parcela_id = selectedParcelaId;

      const { error: pgErr } = await supabase.from("pagamentos").insert(pgPayload);
      if (pgErr) throw pgErr;

      // Update parcela
      if (selectedParcelaId) {
        await supabase.from("parcelas").update({
          status: "pago", data_pagamento: payForm.data_pagamento, valor_pago: valor,
        }).eq("id", selectedParcelaId);
      }

      // Recalculate conta
      const novoAberto = Math.max(0, (conta.valor_aberto || 0) - valor);
      const novoPago = (conta.valor_pago || 0) + valor;
      const novoStatus = novoAberto <= 0 ? "pago" : "parcialmente_pago";

      await supabase.from("contas_pagar").update({
        valor_aberto: novoAberto, valor_pago: novoPago, status: novoStatus,
        data_pagamento: novoAberto <= 0 ? payForm.data_pagamento : null,
        baixa_origem: "manual",
      }).eq("id", id);
    },
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["cp-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["cp-detalhe-parcelas", id] });
      setPayDialogOpen(false);
      setSelectedParcelaId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contas_pagar").update({ status: "cancelado" }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Título cancelado");
      qc.invalidateQueries({ queryKey: ["cp-detalhe", id] });
      setCancelOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openPayment = (parcelaId?: string) => {
    const parcela = parcelaId ? parcelas.find((p: any) => p.id === parcelaId) : null;
    const valorPre = parcela ? parcela.valor : conta?.valor_aberto || 0;
    setSelectedParcelaId(parcelaId || null);
    setPayForm({
      data_pagamento: format(new Date(), "yyyy-MM-dd"),
      valor_pago: String(valorPre),
      valor_desconto: "0", valor_juros: "0",
      forma_pagamento: "", conta_bancaria_id: "",
      numero_documento: "", autenticacao: "", observacoes: "",
    });
    setPayDialogOpen(true);
  };

  const statusBadge = (status: string | null, size: "sm" | "lg" = "sm") => {
    const cfg = STATUS_MAP[status || ""] || STATUS_MAP.pendente;
    return <Badge variant="outline" className={cn(size === "lg" ? "text-sm px-3 py-1" : "text-xs", "font-medium", cfg.className)}>{cfg.label}</Badge>;
  };

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  if (!conta) {
    return <DashboardLayout><div className="flex flex-col items-center justify-center h-96 text-muted-foreground"><p>Título não encontrado</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Top banner for status */}
        {conta.status === "cancelado" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm font-medium">Este título foi cancelado.</div>
        )}
        {conta.status === "pago" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-sm font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Título totalmente pago em {fmtDate(conta.data_pagamento)}.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/financeiro/contas-a-pagar")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Título #{conta.numero_documento || conta.erp_id?.slice(0, 10)}</h1>
                {statusBadge(conta.status, "lg")}
              </div>
              <p className="text-sm text-muted-foreground">{conta.fornecedor_nome}</p>
            </div>
          </div>
          {!isReadonly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/dashboard/financeiro/contas-a-pagar`)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button variant="destructive" onClick={() => setCancelOpen(true)} className="gap-1.5">
                <Ban className="h-3.5 w-3.5" /> Cancelar Título
              </Button>
            </div>
          )}
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT 60% */}
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                  <div><p className="text-xs text-muted-foreground">Fornecedor</p><p className="font-medium text-sm">{conta.fornecedor_nome || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Documento</p><p className="font-mono text-sm">{conta.numero_documento || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Tipo</p><p className="text-sm">{conta.tipo_documento || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Emissão</p><p className="text-sm tabular-nums">{fmtDate(conta.data_emissao)}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className={cn("text-sm tabular-nums font-medium", isOverdue(conta.data_vencimento, conta.status) && "text-red-600")}>
                      {fmtDate(conta.data_vencimento)}
                    </p>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Competência</p><p className="text-sm tabular-nums">{fmtDate(conta.data_competencia)}</p></div>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                  <div><p className="text-xs text-muted-foreground">Valor Original</p><p className="font-semibold text-sm tabular-nums">{fmtCurrency(conta.valor_original)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Desconto</p><p className="text-sm tabular-nums text-emerald-700">{fmtCurrency(conta.valor_desconto)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Juros</p><p className="text-sm tabular-nums text-red-600">{fmtCurrency(conta.valor_juros)}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Líquido</p>
                    <p className="font-semibold text-sm tabular-nums">
                      {fmtCurrency((conta.valor_original || 0) - (conta.valor_desconto || 0) + (conta.valor_juros || 0))}
                    </p>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Valor Pago</p><p className="font-semibold text-sm tabular-nums text-emerald-700">{fmtCurrency(conta.valor_pago)}</p></div>
                  <div className="bg-muted/50 rounded-lg p-2 -m-1">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="font-bold tabular-nums text-base">{fmtCurrency(conta.valor_aberto)}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                  <div><p className="text-xs text-muted-foreground">Categoria</p><p className="text-sm">{conta.categoria_nome || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Empresa</p><p className="text-sm">{conta.empresa_nome || String(conta.empresa_id)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Portador</p><p className="text-sm">{conta.portador || "—"}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Audit section */}
            <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
                  Informações de Auditoria
                  <ChevronDown className={cn("h-4 w-4 transition-transform", auditOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs text-muted-foreground">Criado em</p><p className="text-sm tabular-nums">{fmtDateTime(conta.created_at)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Atualizado em</p><p className="text-sm tabular-nums">{fmtDateTime(conta.updated_at)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Sincronizado em</p><p className="text-sm tabular-nums">{fmtDateTime(conta.sincronizado_em)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Baixa Origem</p><p className="text-sm">{conta.baixa_origem || "—"}</p></div>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* RIGHT 40% */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Parcelas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Progress value={progressPct} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{parcelasPagas}/{totalParcelas} pagas</span>
                </div>

                {parcelas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Título sem parcelas individuais</p>
                ) : (
                  <div className="space-y-2">
                    {parcelas.map((p: any) => (
                      <div key={p.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{p.numero_parcela}/{totalParcelas}</span>
                            {statusBadge(p.status)}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={cn("text-xs tabular-nums", isOverdue(p.data_vencimento, p.status) && "text-red-600 font-medium")}>
                              <Clock className="inline h-3 w-3 mr-0.5" />
                              {fmtDate(p.data_vencimento)}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">{fmtCurrency(p.valor)}</span>
                          </div>
                          {p.status === "pago" && p.data_pagamento && (
                            <p className="text-xs text-emerald-700 mt-1">Pago em {fmtDate(p.data_pagamento)}</p>
                          )}
                        </div>
                        {["aberto", "pendente", "vencido"].includes(p.status || "") && !isReadonly && (
                          <Button size="sm" onClick={() => openPayment(p.id)} className="gap-1.5 shrink-0">
                            <Wallet className="h-3.5 w-3.5" /> Pagar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct payment button if no parcelas or all parcelas */}
                {parcelas.length === 0 && !isReadonly && (conta.valor_aberto || 0) > 0 && (
                  <Button onClick={() => openPayment()} className="w-full gap-2">
                    <Wallet className="h-4 w-4" /> Registrar Pagamento
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ═══ PAYMENT DIALOG ═══ */}
        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>
                {selectedParcelaId ? `Parcela selecionada` : `Título: ${conta.numero_documento || conta.erp_id}`} — Saldo: {fmtCurrency(conta.valor_aberto)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Pagamento *</Label>
                  <Input type="date" value={payForm.data_pagamento} onChange={e => setPayForm(f => ({ ...f, data_pagamento: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor Pago *</Label>
                  <Input type="number" step="0.01" value={payForm.valor_pago} onChange={e => setPayForm(f => ({ ...f, valor_pago: e.target.value }))} />
                </div>
                <div>
                  <Label>Desconto</Label>
                  <Input type="number" step="0.01" value={payForm.valor_desconto} onChange={e => setPayForm(f => ({ ...f, valor_desconto: e.target.value }))} />
                </div>
                <div>
                  <Label>Juros</Label>
                  <Input type="number" step="0.01" value={payForm.valor_juros} onChange={e => setPayForm(f => ({ ...f, valor_juros: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Forma de Pagamento *</Label>
                <Select value={payForm.forma_pagamento} onValueChange={v => setPayForm(f => ({ ...f, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{FORMAS_PAGAMENTO.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta Bancária *</Label>
                <Select value={payForm.conta_bancaria_id} onValueChange={v => setPayForm(f => ({ ...f, conta_bancaria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contasBancarias.map((cb: any) => <SelectItem key={cb.id} value={cb.id}>{cb.banco} — Ag {cb.agencia} Cc {cb.conta}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nº Comprovante</Label>
                  <Input value={payForm.numero_documento} onChange={e => setPayForm(f => ({ ...f, numero_documento: e.target.value }))} />
                </div>
                <div>
                  <Label>Autenticação</Label>
                  <Input value={payForm.autenticacao} onChange={e => setPayForm(f => ({ ...f, autenticacao: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={payForm.observacoes} onChange={e => setPayForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => payMutation.mutate()}
                disabled={payMutation.isPending || !payForm.valor_pago || !payForm.forma_pagamento || !payForm.conta_bancaria_id}
                className="gap-2"
              >
                {payMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ CANCEL DIALOG ═══ */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar título?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação é irreversível. O título e todas as parcelas pendentes serão cancelados.</AlertDialogDescription>
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
