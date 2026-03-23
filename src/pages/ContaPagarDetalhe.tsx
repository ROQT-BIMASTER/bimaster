import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, CreditCard, FileText, Calendar, Building2, DollarSign, CloudUpload, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

function fmtDate(d: string | null) {
  if (!d) return "—";
  return format(new Date(d + "T00:00:00"), "dd/MM/yyyy");
}

export default function ContaPagarDetalhe() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [payOpen, setPayOpen] = useState(false);
  const [payParcelaId, setPayParcelaId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({
    valor: 0,
    data_pagamento: new Date().toISOString().slice(0, 10),
    forma_pagamento: "PIX",
    conta_bancaria_id: "",
    observacoes: "",
  });

  // ----- Queries -----
  const { data: titulo, isLoading } = useQuery({
    queryKey: ["cp-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_pagar").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: parcelas } = useQuery({
    queryKey: ["cp-parcelas", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("parcelas").select("*").eq("conta_pagar_id", id!).order("numero_parcela");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["cp-pagamentos", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*").eq("conta_pagar_id", id!).order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: contasBancarias } = useQuery({
    queryKey: ["contas-bancarias-select"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("id,banco,agencia,conta").eq("status", "ativo").order("banco");
      return data || [];
    },
  });

  // ----- Payment mutation -----
  const payMutation = useMutation({
    mutationFn: async () => {
      // 1. Insert payment
      const { error: payErr } = await supabase.from("pagamentos").insert({
        conta_pagar_id: id!,
        parcela_id: payParcelaId || null,
        valor: payForm.valor,
        data_pagamento: payForm.data_pagamento,
        forma_pagamento: payForm.forma_pagamento,
        conta_bancaria_id: payForm.conta_bancaria_id || null,
        observacoes: payForm.observacoes || null,
      });
      if (payErr) throw payErr;

      // 2. If paying a specific parcela, mark it as paid
      if (payParcelaId) {
        await supabase.from("parcelas").update({
          status: "pago",
          valor_pago: payForm.valor,
          data_pagamento: payForm.data_pagamento,
        }).eq("id", payParcelaId);
      }

      // 3. Update titulo saldo
      if (titulo) {
        const newPago = (titulo.valor_pago || 0) + payForm.valor;
        const newAberto = Math.max(0, (titulo.valor_aberto || titulo.valor_original || 0) - payForm.valor);
        await supabase.from("contas_pagar").update({
          valor_pago: newPago,
          valor_aberto: newAberto,
          data_pagamento: newAberto <= 0 ? payForm.data_pagamento : null,
          baixa_origem: "manual",
          data_baixa: newAberto <= 0 ? new Date().toISOString() : null,
        }).eq("id", id!);
      }
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      qc.invalidateQueries({ queryKey: ["cp-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["cp-parcelas", id] });
      qc.invalidateQueries({ queryKey: ["cp-pagamentos", id] });
      qc.invalidateQueries({ queryKey: ["cp-tab-contas"] });
      qc.invalidateQueries({ queryKey: ["contas-pagar"] });
      setPayOpen(false);
      setPayParcelaId(null);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  function openPayForParcela(parcelaId: string, valor: number) {
    setPayParcelaId(parcelaId);
    setPayForm({ valor, data_pagamento: new Date().toISOString().slice(0, 10), forma_pagamento: "PIX", conta_bancaria_id: "", observacoes: "" });
    setPayOpen(true);
  }

  function openPayGeneral() {
    setPayParcelaId(null);
    setPayForm({ valor: titulo?.valor_aberto || 0, data_pagamento: new Date().toISOString().slice(0, 10), forma_pagamento: "PIX", conta_bancaria_id: "", observacoes: "" });
    setPayOpen(true);
  }

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div></DashboardLayout>;
  }

  if (!titulo) {
    return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Título não encontrado</div></DashboardLayout>;
  }

  const hasParcelas = parcelas && parcelas.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-xl font-semibold">Título {titulo.numero_documento || titulo.erp_id}</h1>
              <p className="text-sm text-muted-foreground">{titulo.fornecedor_nome}</p>
            </div>
            {statusBadge(titulo.status)}
          </div>
          {titulo.status !== "pago" && titulo.status !== "cancelado" && (
            <Button onClick={openPayGeneral} className="gap-2">
              <CreditCard className="h-4 w-4" /> Registrar Pagamento
            </Button>
          )}
        </div>

        {/* 2-column layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left - Title Data */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Dados do Título</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Fornecedor" value={titulo.fornecedor_nome} />
              <Row label="Cód. Fornecedor" value={titulo.fornecedor_codigo} />
              <Row label="Empresa" value={titulo.empresa_nome} />
              <Row label="Tipo Documento" value={titulo.tipo_documento} />
              <Row label="Nº Documento" value={titulo.numero_documento} />
              <Row label="Data Emissão" value={fmtDate(titulo.data_emissao)} />
              <Row label="Data Vencimento" value={fmtDate(titulo.data_vencimento)} />
              <Row label="Valor Original" value={BRL.format(titulo.valor_original || 0)} />
              <Row label="Desconto" value={BRL.format(titulo.valor_desconto || 0)} />
              <Row label="Juros" value={BRL.format(titulo.valor_juros || 0)} />
              <Row label="Ajustes" value={BRL.format(titulo.valor_ajustes || 0)} />
              <div className="border-t pt-2">
                <Row label="Valor Pago" value={BRL.format(titulo.valor_pago || 0)} highlight />
                <Row label="Saldo Aberto" value={BRL.format(titulo.valor_aberto || 0)} highlight />
              </div>
              <Row label="Categoria" value={titulo.categoria_nome} />
              <Row label="Departamento" value={titulo.departamento_nome} />
              <Row label="Portador" value={titulo.portador} />
              <Row label="Plano de Contas" value={titulo.plano_contas_nome ? `${titulo.plano_contas_codigo} - ${titulo.plano_contas_nome}` : null} />
              <Row label="Origem Baixa" value={titulo.baixa_origem} />
              {/* ERP Status */}
              <ErpSyncStatus tituloId={titulo.id} importadoApi={(titulo as any).importado_api} codigoIntegracao={(titulo as any).codigo_integracao} status={titulo.status} />
              </div>
            </CardContent>
          </Card>

          {/* Right - Parcelas + Pagamentos */}
          <div className="space-y-6">
            {/* Parcelas */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4" /> Parcelas ({parcelas?.length || 0})</CardTitle></CardHeader>
              <CardContent>
                {!hasParcelas ? (
                  <p className="text-sm text-muted-foreground">Título sem parcelamento registrado</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelas!.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.numero_parcela}</TableCell>
                          <TableCell>{fmtDate(p.data_vencimento)}</TableCell>
                          <TableCell className="text-right">{BRL.format(p.valor)}</TableCell>
                          <TableCell>{statusBadge(p.status)}</TableCell>
                          <TableCell>
                            {p.status !== "pago" && titulo.status !== "cancelado" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPayForParcela(p.id, p.valor)}>
                                Pagar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Pagamentos */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4" /> Histórico de Pagamentos ({pagamentos?.length || 0})</CardTitle></CardHeader>
              <CardContent>
                {!pagamentos || pagamentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead>Obs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagamentos.map(pg => (
                        <TableRow key={pg.id}>
                          <TableCell>{fmtDate(pg.data_pagamento)}</TableCell>
                          <TableCell className="text-right font-medium">{BRL.format(pg.valor)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{pg.forma_pagamento || "—"}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{pg.observacoes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ===== Payment Dialog ===== */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {payParcelaId ? "Pagamento para parcela específica" : "Pagamento geral do título"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Valor *</Label>
              <Input type="number" min={0} step="0.01" value={payForm.valor} onChange={e => setPayForm(p => ({ ...p, valor: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data Pagamento *</Label>
              <Input type="date" value={payForm.data_pagamento} onChange={e => setPayForm(p => ({ ...p, data_pagamento: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select value={payForm.forma_pagamento} onValueChange={v => setPayForm(p => ({ ...p, forma_pagamento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["PIX", "TED", "DOC", "Boleto", "Cheque", "Dinheiro", "Cartão"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conta Bancária</Label>
              <Select value={payForm.conta_bancaria_id} onValueChange={v => setPayForm(p => ({ ...p, conta_bancaria_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contasBancarias?.map(cb => <SelectItem key={cb.id} value={cb.id}>{cb.banco} - {cb.agencia}/{cb.conta}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={payForm.observacoes} onChange={e => setPayForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={() => payMutation.mutate()} disabled={payForm.valor <= 0 || payMutation.isPending}>
              {payMutation.isPending ? "Salvando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", highlight && "font-semibold")}>{value || "—"}</span>
    </div>
  );
}
