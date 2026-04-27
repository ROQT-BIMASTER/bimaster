import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, Filter, RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { ChinaInboxItem } from "@/components/china/ChinaInboxItem";
import { ChinaAutoAdvanceCTA } from "@/components/china/ChinaAutoAdvanceCTA";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
import { useChinaInbox, type ChinaInboxItem as InboxItem } from "@/hooks/useChinaInbox";
import {
  useCriarRevisao,
  useDarCiencia,
} from "@/hooks/useChinaRevisoes";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type FilterKey = "todos" | "pendente" | "ajuste";

/**
 * Caixa de Entrada bilíngue China — fila única do que precisa de ação.
 * Centraliza o que antes estava espalhado entre Painel de Aprovação,
 * Inbox de Decisões, Revisão e DocCard.
 *
 * Regra de ouro: mais simples que mandar a foto no WhatsApp.
 */
export default function ChinaCaixaEntrada() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isBrasilUser, isChinaUser } = useChinaUserContext();
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  const { data: items = [], isLoading, refetch, isFetching } = useChinaInbox(filter);

  const aprovar = useCriarRevisao();
  const darCiencia = useDarCiencia();

  // Submissões 100% aprovadas (para o CTA verde no topo)
  const { data: aprovadasRecentes = [] } = useQuery({
    queryKey: ["china-submissoes-aprovadas-cta"],
    enabled: isBrasilUser || isChinaUser,
    queryFn: async () => {
      const { data } = await (supabase
        .from("china_produto_submissoes" as any)
        .select("id, produto_codigo, produto_nome, aprovado_em, status")
        .eq("status", "aprovado")
        .order("aprovado_em", { ascending: false })
        .limit(3) as any);
      return (data || []) as any[];
    },
    staleTime: 30_000,
  });

  // Contadores para tabs
  const counts = useMemo(() => {
    const all = items;
    return {
      todos: all.length,
      pendente: all.filter((i) => ["pendente", "enviado"].includes(i.status)).length,
      ajuste: all.filter((i) => ["rejeitado", "contestado"].includes(i.status)).length,
    };
  }, [items]);

  const handleApprove = (item: InboxItem) => {
    aprovar.mutate({
      documento_id: item.documento_id,
      submissao_id: item.submissao_id,
      resultado: "aprovado",
      acao_tipo: "aprovar",
    });
  };

  const handleReject = (item: InboxItem, motivo: string) => {
    aprovar.mutate({
      documento_id: item.documento_id,
      submissao_id: item.submissao_id,
      resultado: "rejeitado",
      motivo_rejeicao: motivo,
      anotacoes: [],
      acao_tipo: "rejeitar",
    });
  };

  const handleView = async (item: InboxItem) => {
    let url = item.arquivo_url || null;
    if (!url && item.arquivo_path) {
      const { data } = await supabase.storage
        .from("china-documentos")
        .createSignedUrl(item.arquivo_path, 3600);
      url = data?.signedUrl || null;
    }
    setPreviewDoc({
      ...item,
      tipo: item.tipo_documento,
      url,
    });
  };

  const handleCorrigir = (item: InboxItem) => {
    navigate(`/dashboard/fabrica-china/submissao/${item.submissao_id}`);
  };

  const loading = aprovar.isPending || darCiencia.isPending;

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Caixa de Entrada"
        titleCn="收件箱"
        subtitle={
          isBrasilUser
            ? "Documentos da China aguardando sua aprovação."
            : "Documentos que precisam da sua correção ou ciência."
        }
        icon={Inbox}
        iconTone="primary"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar / 刷新
          </Button>
        }
      />

      {/* CTA verde: submissões 100% aprovadas */}
      {aprovadasRecentes.length > 0 && (
        <div className="space-y-2">
          {aprovadasRecentes.map((s: any) => (
            <ChinaAutoAdvanceCTA
              key={s.id}
              produtoCodigo={`${s.produto_codigo} — ${s.produto_nome}`}
              onIniciarOC={() => navigate(`/dashboard/fabrica-china/submissao/${s.id}?action=oc`)}
              onVerSubmissao={() => navigate(`/dashboard/fabrica-china/submissao/${s.id}`)}
            />
          ))}
        </div>
      )}

      {/* Tabs / filtros */}
      <Card className="p-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="todos" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Todos / 全部
              <Badge variant="secondary" className="ml-1 h-4 text-[10px]">
                {counts.todos}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pendente" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Aguardando / 等待
              <Badge variant="secondary" className="ml-1 h-4 text-[10px]">
                {counts.pendente}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="ajuste" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Ajustar / 修正
              <Badge variant="secondary" className="ml-1 h-4 text-[10px]">
                {counts.ajuste}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tudo em dia / 全部完成"
          description={
            isBrasilUser
              ? "Não há documentos da China aguardando sua aprovação."
              : "Não há documentos para corrigir. Bom trabalho!"
          }
          className="py-12"
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ChinaInboxItem
              key={item.documento_id}
              item={item}
              isBrasilUser={isBrasilUser}
              isChinaUser={isChinaUser}
              onApprove={handleApprove}
              onReject={handleReject}
              onView={handleView}
              onCorrigir={handleCorrigir}
              loading={loading}
            />
          ))}
        </div>
      )}

      <ChinaDocPreviewDialog
        open={!!previewDoc}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
        arquivoPath={previewDoc?.arquivo_path ?? null}
        arquivoUrl={previewDoc?.arquivo_url ?? null}
        nomeArquivo={previewDoc?.nome_arquivo ?? null}
        tipoDocumento={previewDoc?.tipo_documento}
      />
    </ChinaPageShell>
  );
}
