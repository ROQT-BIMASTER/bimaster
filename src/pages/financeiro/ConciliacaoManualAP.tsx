import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Link2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

async function callApi(fn: string, body: any) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  return data;
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

export default function ConciliacaoManualAP() {
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  // Confirm match
  const confirmMutation = useMutation({
    mutationFn: async (match: any) => {
      // Register payment
      await callApi("contas-pagar-api", {
        path: "/registrar-pagamento",
        id: match.conta_pagar_id,
        valor_pago: match.valor_transacao,
        data_pagamento: match.data_transacao,
        metodo_pagamento: "PIX",
      });
      // Link pluggy transaction
      await callApi("contas-pagar-api", {
        path: "/update",
        id: match.conta_pagar_id,
        pluggy_transaction_id: match.pluggy_transaction_id,
      });
      // Update match status
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

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[#1B2A4A]">Conciliação Manual AP</h1>
          <p className="text-sm text-muted-foreground">Confirme ou rejeite sugestões de conciliação com confiança média</p>
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
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
