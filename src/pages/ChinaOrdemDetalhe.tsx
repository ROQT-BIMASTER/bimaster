import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaOrdemProgress } from "@/components/china/ChinaOrdemProgress";
import { ChinaApontamentoForm } from "@/components/china/ChinaApontamentoForm";
import { ChinaEmbarqueForm } from "@/components/china/ChinaEmbarqueForm";
import { ChinaEmbarqueInfo } from "@/components/china/ChinaEmbarqueInfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { toast } from "sonner";

export default function ChinaOrdemDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isBrasilUser } = useChinaUserContext();
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const { data: ordem, isLoading } = useQuery({
    queryKey: ["china-ordem", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_ordens_compra" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: apontamentos = [] } = useQuery({
    queryKey: ["china-apontamentos", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_producao_apontamentos" as any)
        .select("*")
        .eq("ordem_compra_id", id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: cores = [] } = useQuery({
    queryKey: ["china-cores-ordem", ordem?.submissao_id],
    enabled: !!ordem?.submissao_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", ordem.submissao_id);
      return (data || []) as any[];
    },
  });

  // Fetch embarque data
  const { data: embarque } = useQuery({
    queryKey: ["china-embarque", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_embarques" as any)
        .select("*")
        .eq("ordem_compra_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any | null;
    },
  });

  const { data: embarqueDocs = [] } = useQuery({
    queryKey: ["china-embarque-docs", embarque?.id],
    enabled: !!embarque?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_embarque_documentos" as any)
        .select("*")
        .eq("embarque_id", embarque.id);
      return (data || []) as any[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`china-producao-${id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "china_producao_apontamentos",
        filter: `ordem_compra_id=eq.${id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["china-apontamentos", id] });
        queryClient.invalidateQueries({ queryKey: ["china-ordem", id] });
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "china_embarques",
        filter: `ordem_compra_id=eq.${id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["china-embarque", id] });
        queryClient.invalidateQueries({ queryKey: ["china-ordem", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  const coresProgress = cores.map((c: any) => {
    const produzida = apontamentos
      .filter((a: any) => a.cor_nome === c.cor_nome)
      .reduce((sum: number, a: any) => sum + (a.quantidade || 0), 0);
    return { cor_nome: c.cor_nome, qty_pedida: c.quantidade, qty_produzida: produzida, cor_hex: c.cor_hex || undefined };
  });

  const coreNames = cores.map((c: any) => c.cor_nome);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["china-apontamentos", id] });
    queryClient.invalidateQueries({ queryKey: ["china-ordem", id] });
    queryClient.invalidateQueries({ queryKey: ["china-embarque", id] });
    queryClient.invalidateQueries({ queryKey: ["china-embarque-docs"] });
  };

  const handleViewPhoto = async (fotoPath: string) => {
    const { signedUrl } = await getSignedUrl("china-documentos", fotoPath);
    if (signedUrl) window.open(signedUrl, "_blank");
  };

  const handleAprovar = async () => {
    setApprovalLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("china_ordens_compra" as any)
        .update({ status: "aprovada", aprovado_por: user?.id, aprovado_em: new Date().toISOString() } as any)
        .eq("id", ordem.id);
      if (error) throw error;
      toast.success("OC aprovada! A China agora pode iniciar a produção ✅");
      handleRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar");
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleRejeitar = async () => {
    if (!motivoRejeicao.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setApprovalLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("china_ordens_compra" as any)
        .update({ status: "rejeitada", aprovado_por: user?.id, aprovado_em: new Date().toISOString(), motivo_rejeicao: motivoRejeicao } as any)
        .eq("id", ordem.id);
      if (error) throw error;
      toast.success("OC rejeitada");
      setShowRejeitar(false);
      handleRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao rejeitar");
    } finally {
      setApprovalLoading(false);
    }
  };

  // Determine if production is complete (qty_produzida >= qty_total)
  const isProductionComplete = ordem && ordem.qty_total > 0 && ordem.qty_produzida >= ordem.qty_total;
  const showEmbarqueForm = isProductionComplete && (!embarque || embarque.status === "rascunho");
  const showEmbarqueInfo = embarque && embarque.status !== "rascunho";
  const isActiveOrder = ordem && ordem.status !== "concluida" && ordem.status !== "cancelada";
  const isApproved = ordem && !["rascunho", "rejeitada"].includes(ordem.status);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ordem) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Package className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Ordem não encontrada</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/fabrica-china/ordens")}>
          Voltar 返回
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china/ordens")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{ordem.numero_oc}</h1>
            <p className="text-muted-foreground">{ordem.produto_codigo} — {ordem.produto_nome}</p>
          </div>
        </div>

        {/* OC Summary */}
        <Card className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Total 总数</p>
              <p className="text-xl font-bold">{ordem.qty_total?.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Produzido 已生产</p>
              <p className="text-xl font-bold text-primary">{ordem.qty_produzida?.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Emissão 下单</p>
              <p className="text-sm font-medium">{new Date(ordem.data_emissao).toLocaleDateString("pt-BR")}</p>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Entrega 交货</p>
              <p className="text-sm font-medium">
                {ordem.data_entrega_prevista
                  ? new Date(ordem.data_entrega_prevista).toLocaleDateString("pt-BR")
                  : "—"}
              </p>
            </div>
          </div>

          <ChinaOrdemProgress
            cores={coresProgress}
            qtyTotal={ordem.qty_total || 0}
            qtyProduzida={ordem.qty_produzida || 0}
          />
        </Card>

        {/* Production Form — only while production is not complete */}
        {isActiveOrder && !isProductionComplete && (
          <ChinaApontamentoForm
            ordemId={ordem.id}
            cores={coreNames}
            onSuccess={handleRefresh}
          />
        )}

        {/* Embarque Section — appears when production is complete */}
        {showEmbarqueInfo && (
          <ChinaEmbarqueInfo embarque={embarque} documentos={embarqueDocs} />
        )}

        {showEmbarqueForm && (
          <ChinaEmbarqueForm
            ordemId={ordem.id}
            existingEmbarque={embarque?.status === "rascunho" ? embarque : undefined}
            onSuccess={handleRefresh}
          />
        )}

        {/* Completed production banner prompting shipping */}
        {isProductionComplete && !embarque && (
          <Card className="p-5 border-2 border-dashed border-blue-400/40 bg-blue-50/30 dark:bg-blue-950/10 text-center">
            <BilingualLabel pt="✅ Produção concluída! Preencha os dados de embarque abaixo." cn="✅ 生产完成！请填写以下装运信息。" size="md" />
          </Card>
        )}

        {/* History */}
        <Card className="p-5">
          <BilingualLabel pt="Histórico de Produção" cn="生产历史" size="md" className="mb-4" />
          {apontamentos.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum registro ainda 暂无记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apontamentos.map((apt: any) => (
                <div key={apt.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {apt.quantidade}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{apt.cor_nome}</Badge>
                      {apt.lote && <span className="text-xs text-muted-foreground">Lote: {apt.lote}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(apt.created_at).toLocaleString("pt-BR")}
                    </p>
                    {apt.observacao && (
                      <p className="text-xs text-muted-foreground mt-1">{apt.observacao}</p>
                    )}
                  </div>
                  {apt.foto_path && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewPhoto(apt.foto_path)}
                    >
                      📷
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
