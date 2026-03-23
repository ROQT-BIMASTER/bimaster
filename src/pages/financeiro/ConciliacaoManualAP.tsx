import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Link2, Loader2, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { callApi, formatBRL, fmtDate } from "@/lib/utils/api-helpers";

export default function ConciliacaoManualAP() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [vincularModal, setVincularModal] = useState<any>(null);
  const [buscaTitulo, setBuscaTitulo] = useState("");
  const [tituloSelecionado, setTituloSelecionado] = useState<any>(null);

  // Fetch medium-confidence matches
  const { data: matches, isLoading } = useQuery({
    queryKey: ["conciliacao-manual-ap"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conciliacoes_bancarias" as any)
        .select("*")
        .eq("confianca", "media")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 30_000,
  });

  // Search titles for manual linking
  const { data: titulosBusca } = useQuery({
    queryKey: ["busca-titulos-vincular", buscaTitulo],
    queryFn: () => callApi("contas-pagar-api", {
      path: "/listar",
      pagina: 1,
      registros_por_pagina: 10,
      filtrar_cliente: buscaTitulo,
    }),
    enabled: !!buscaTitulo && buscaTitulo.length >= 3,
    staleTime: 30_000,
  });

  // Confirm match
  const confirmMutation = useMutation({
    mutationFn: async (match: any) => {
      await callApi("contas-pagar-api", {
        path: "/registrar-pagamento",
        id: match.conta_pagar_id,
        valor_pago: match.valor_transacao,
        data_pagamento: match.data_transacao,
        metodo_pagamento: "PIX",
      });
      await callApi("contas-pagar-api", {
        path: "/update",
        id: match.conta_pagar_id,
        pluggy_transaction_id: match.pluggy_transaction_id,
      });
      await supabase
        .from("conciliacoes_bancarias" as any)
        .update({ status: "confirmado" })
        .eq("id", match.id);
    },
    onSuccess: () => {
      toast.success("Conciliação confirmada e pagamento registrado");
      qc.invalidateQueries({ queryKey: ["conciliacao-manual-ap"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Reject match
  const rejectMutation = useMutation({
    mutationFn: async (matchId: string) => {
      await supabase
        .from("conciliacoes_bancarias" as any)
        .update({ status: "rejeitado" })
        .eq("id", matchId);
    },
    onSuccess: () => {
      toast.success("Sugestão rejeitada");
      qc.invalidateQueries({ queryKey: ["conciliacao-manual-ap"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Manual link mutation
  const vincularMutation = useMutation({
    mutationFn: async ({ match, titulo }: { match: any; titulo: any }) => {
      await callApi("contas-pagar-api", {
        path: "/registrar-pagamento",
        id: titulo.id,
        valor_pago: match.valor_transacao,
        data_pagamento: match.data_transacao,
        metodo_pagamento: "PIX",
      });
      await callApi("contas-pagar-api", {
        path: "/update",
        id: titulo.id,
        pluggy_transaction_id: match.pluggy_transaction_id,
      });
      await supabase
        .from("conciliacoes_bancarias" as any)
        .update({ status: "vinculado_manual", conta_pagar_id: titulo.id })
        .eq("id", match.id);
    },
    onSuccess: () => {
      toast.success("Transação vinculada manualmente ao título");
      setVincularModal(null);
      setTituloSelecionado(null);
      setBuscaTitulo("");
      qc.invalidateQueries({ queryKey: ["conciliacao-manual-ap"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const titulosResult = titulosBusca?.conta_pagar_cadastro || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[#1B2A4A]">Conciliação Manual AP</h1>
            <p className="text-sm text-muted-foreground">Confirme, rejeite ou vincule manualmente transações bancárias</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : !matches || matches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma sugestão de conciliação pendente.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match: any) => (
              <div key={match.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left — Bank Transaction */}
                <Card className="border-l-4 border-l-[#2563EB]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-[#1B2A4A]">Transação Bancária</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data</span>
                      <span>{fmtDate(match.data_transacao)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Descrição</span>
                      <span className="text-right max-w-[200px] truncate">{match.descricao_transacao || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor</span>
                      <span className="font-semibold">{formatBRL(match.valor_transacao)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Banco</span>
                      <span>{match.banco || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confiança</span>
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">Média</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Right — AP Title */}
                <Card className="border-l-4 border-l-[#16A34A]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-[#1B2A4A]">Título AP Sugerido</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fornecedor</span>
                      <span>{match.fornecedor_nome || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vencimento</span>
                      <span>{fmtDate(match.data_vencimento)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor</span>
                      <span className="font-semibold">{formatBRL(match.valor_titulo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">{match.status_titulo || "Pendente"}</Badge>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => confirmMutation.mutate(match)}
                        disabled={confirmMutation.isPending}
                      >
                        {confirmMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                        Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMutation.mutate(match.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => { setVincularModal(match); setBuscaTitulo(""); setTituloSelecionado(null); }}
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" /> Vincular outro
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* Manual Link Dialog */}
        <Dialog open={!!vincularModal} onOpenChange={(o) => !o && setVincularModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#1B2A4A]">Vincular a Outro Título</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transação:</span>
                  <span>{vincularModal?.descricao_transacao || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-semibold">{formatBRL(vincularModal?.valor_transacao)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Buscar título por fornecedor</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do fornecedor..."
                    value={buscaTitulo}
                    onChange={(e) => { setBuscaTitulo(e.target.value); setTituloSelecionado(null); }}
                  />
                  <Button size="icon" variant="outline" disabled>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {titulosResult.length > 0 && (
                <div className="rounded-md border max-h-[200px] overflow-y-auto">
                  {titulosResult.map((t: any) => (
                    <div
                      key={t.id}
                      className={`flex justify-between items-center p-2 cursor-pointer hover:bg-muted/50 text-sm ${tituloSelecionado?.id === t.id ? "bg-blue-50 border-l-2 border-l-[#2563EB]" : ""}`}
                      onClick={() => setTituloSelecionado(t)}
                    >
                      <div>
                        <div className="font-medium">{t.fornecedor_nome || "—"}</div>
                        <div className="text-xs text-muted-foreground">Venc: {fmtDate(t.data_vencimento)} | {t.codigo_lancamento_integracao}</div>
                      </div>
                      <span className="font-mono text-sm">{formatBRL(t.valor_documento || t.valor_original)}</span>
                    </div>
                  ))}
                </div>
              )}
              {tituloSelecionado && (
                <div className="rounded-md bg-green-50 p-2 text-sm flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Selecionado: <strong>{tituloSelecionado.fornecedor_nome}</strong> — {formatBRL(tituloSelecionado.valor_documento)}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVincularModal(null)}>Cancelar</Button>
              <Button
                disabled={!tituloSelecionado || vincularMutation.isPending}
                onClick={() => vincularMutation.mutate({ match: vincularModal, titulo: tituloSelecionado })}
              >
                {vincularMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Link2 className="mr-2 h-4 w-4" /> Vincular
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
