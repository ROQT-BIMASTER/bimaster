import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Clock, CheckCircle, XCircle, Ship, ClipboardCheck, Scale, History } from "lucide-react";
import { VinculosBrasilPanel } from "@/components/china/VinculosBrasilPanel";
import { OPVinculadaCard } from "@/components/china/op/OPVinculadaCard";
import { HistoricoRecebimentosInternacionalSheet } from "@/components/compras/HistoricoRecebimentosInternacionalSheet";
import { ChinaOrdemItensPanel } from "@/components/china/ChinaOrdemItensPanel";
import { EmbarqueParcialDialog } from "@/components/china/EmbarqueParcialDialog";
import { RecebimentoConferenciaDialog } from "@/components/china/RecebimentoConferenciaDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaOrdemProgress } from "@/components/china/ChinaOrdemProgress";
import { ChinaApontamentoForm } from "@/components/china/ChinaApontamentoForm";
import { ChinaEmbarqueForm } from "@/components/china/ChinaEmbarqueForm";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { ChinaEmbarqueInfo } from "@/components/china/ChinaEmbarqueInfo";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { ChinaTimelineButton } from "@/components/china/timeline/ChinaTimelineButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { toast } from "sonner";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChinaOrdemDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isBrasilUser } = useChinaUserContext();
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [embarqueOpen, setEmbarqueOpen] = useState(false);
  const [recebOpen, setRecebOpen] = useState(false);
  const [histRecebOpen, setHistRecebOpen] = useState(false);

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
      .channel(uniqueChannelName(`china-producao-${id}`))
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
    const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
    const ok = await confirmConclusaoTarefa({
      tituloDialog: "Aprovar Ordem de Compra?",
      acaoLabel: "Sim, aprovar",
      descricao:
        `Você está prestes a aprovar a OC ${ordem?.codigo ?? ""}. ` +
        `A China receberá liberação para iniciar a produção imediatamente. ` +
        `Esta ação ficará registrada com seu usuário e data/hora.`,
    });
    if (!ok) return;
    setApprovalLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("china_ordens_compra" as any)
        .update({ status: "aprovada", aprovado_por: user?.id, aprovado_em: new Date().toISOString() } as any)
        .eq("id", ordem.id);
      if (error) throw error;
      toast.success("OC aprovada! A China agora pode iniciar a produção");
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
    const { confirmExclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
    const ok = await confirmExclusaoTarefa({
      tituloDialog: "Rejeitar Ordem de Compra?",
      acaoLabel: "Sim, rejeitar",
      descricao:
        `Você está prestes a rejeitar a OC ${ordem?.codigo ?? ""}. ` +
        `A China NÃO poderá iniciar a produção e o motivo será registrado: ` +
        `"${motivoRejeicao.trim()}". Esta ação fica registrada e exigirá ` +
        `nova OC para reverter.`,
    });
    if (!ok) return;
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
    // Skeleton estruturado em vez de spinner generico — usuario ve onde
    // cada bloco vai aparecer (header, KPIs, tabs) e percebe progresso.
    return (
      <ChinaPageShell>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </ChinaPageShell>
    );
  }

  if (!ordem) {
    return (
      <ChinaPageShell>
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Package className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">Ordem não encontrada</p>
          <Button variant="outline" onClick={() => navigate("/dashboard/fabrica-china/ordens")}>
            Voltar 返回
          </Button>
        </div>
      </ChinaPageShell>
    );
  }

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt={ordem.numero_oc}
        titleCn={`${ordem.produto_codigo} — ${ordem.produto_nome}`}
        icon={Package}
        iconTone="primary"
        showBack
        backTo="/dashboard/fabrica-china/ordens"
        actions={
          <>
            <ChinaTimelineButton scope={{ ocId: ordem.id, submissaoId: ordem.submissao_id }} />
            <ManualFabricaDrawer screen="china-ordem-detalhe" />
          </>
        }
      />

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

        {/* Approval Card — Brasil only, when status is rascunho */}
        {isBrasilUser && ordem.status === "rascunho" && (
          <Card className="p-5 border-2 border-dashed border-warning/40 bg-warning/5">
            <BilingualLabel pt="⏳ Aguardando Aprovação" cn="⏳ 等待审批" size="md" className="mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Esta OC está em rascunho. Aprove para enviar à fábrica na China ou rejeite com observação.
            </p>
            {!showRejeitar ? (
              <div className="flex gap-2">
                <Button onClick={handleAprovar} disabled={approvalLoading} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Aprovar OC
                </Button>
                <Button variant="destructive" onClick={() => setShowRejeitar(true)} disabled={approvalLoading} className="gap-2">
                  <XCircle className="h-4 w-4" />
                  Rejeitar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  placeholder="Motivo da rejeição..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleRejeitar} disabled={approvalLoading}>
                    Confirmar Rejeição
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejeitar(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Rejected info */}
        {ordem.status === "rejeitada" && (
          <Card className="p-5 border-2 border-destructive/30 bg-destructive/5">
            <BilingualLabel pt="❌ OC Rejeitada" cn="❌ 采购单已拒绝" size="md" className="mb-2" />
            {ordem.motivo_rejeicao && (
              <p className="text-sm text-muted-foreground">Motivo: {ordem.motivo_rejeicao}</p>
            )}
          </Card>
        )}

        {/* Production Form — only when approved and production not complete */}
        {isActiveOrder && isApproved && !isProductionComplete && (
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

        {/* Vínculos Brasil — auditoria de alocações desta OC */}
        <VinculosBrasilPanel
          ocId={ordem.id}
          numeroOC={ordem.numero_oc}
          produtoNome={ordem.produto_nome}
        />

        {/* Ordens de Produção vinculadas */}
        <OPVinculadaCard
          ocId={ordem.id}
          ocNumero={ordem.numero_oc}
          produtoCodigo={ordem.produto_codigo}
          produtoNome={ordem.produto_nome}
          qtySugerida={ordem.qty_total}
        />

        {/* Histórico de recebimentos no Brasil */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <BilingualLabel pt="Recebimentos no Brasil" cn="巴西收货记录" size="md" />
            <p className="text-xs text-muted-foreground mt-0.5">
              Auditoria de DI, conferente, datas e divergências por item.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setHistRecebOpen(true)} className="gap-1">
            <History className="h-4 w-4" />
            Ver histórico
          </Button>
        </Card>

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

        <HistoricoRecebimentosInternacionalSheet
          open={histRecebOpen}
          onOpenChange={setHistRecebOpen}
          ordemCompraId={ordem.id}
          numeroOC={ordem.numero_oc}
        />
    </ChinaPageShell>
  );
}
