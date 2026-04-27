import { useEffect, useMemo, useState } from "react";
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
import { ChinaInboxToolbar, type InboxFilterState, type InboxViewMode } from "@/components/china/ChinaInboxToolbar";
import { ChinaInboxTable } from "@/components/china/ChinaInboxTable";
import { ChinaAutoAdvanceCTA } from "@/components/china/ChinaAutoAdvanceCTA";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
import { useChinaInbox, type ChinaInboxItem as InboxItem } from "@/hooks/useChinaInbox";
import {
  useCriarRevisao,
  useDarCiencia,
} from "@/hooks/useChinaRevisoes";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type FilterKey = "todos" | "pendente" | "ajuste";

const VIEW_MODE_KEY = "china-inbox-view-mode";
const GROUP_KEY = "china-inbox-grouped";

/**
 * Caixa de Entrada bilíngue China — fila única do que precisa de ação.
 *
 * Agora com:
 *  - Visão tabela densa (desktop ≥ lg) com agrupamento por produto/submissão
 *  - Filtros avançados (busca, OC, tipo, urgência)
 *  - Ações em lote por submissão
 */
export default function ChinaCaixaEntrada() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isBrasilUser, isChinaUser } = useChinaUserContext();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [filter, setFilter] = useState<FilterKey>("todos");
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Visualização (table/cards) e filtros locais
  const [viewMode, setViewMode] = useState<InboxViewMode>(() => {
    if (typeof window === "undefined") return "table";
    const saved = window.localStorage.getItem(VIEW_MODE_KEY);
    if (saved === "table" || saved === "cards") return saved;
    return "table";
  });
  const [filters, setFilters] = useState<InboxFilterState>(() => {
    const agrupar =
      typeof window !== "undefined"
        ? window.localStorage.getItem(GROUP_KEY) !== "0"
        : true;
    return { busca: "", oc: "todos", tipo: "todos", urgencia: "todos", agrupar };
  });

  // Persistência leve
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
    }
  }, [viewMode]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GROUP_KEY, filters.agrupar ? "1" : "0");
    }
  }, [filters.agrupar]);

  // Em mobile força cards
  const effectiveView: InboxViewMode = isDesktop ? viewMode : "cards";

  const { data: items = [], isLoading, refetch, isFetching } = useChinaInbox(filter);

  const aprovar = useCriarRevisao();
  const darCiencia = useDarCiencia();

  // Submissões 100% aprovadas (CTA verde no topo)
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

  // Aplica filtros locais
  const filteredItems = useMemo(() => {
    const q = filters.busca.trim().toLowerCase();
    return items.filter((i) => {
      if (filters.oc !== "todos" && i.numero_ordem !== filters.oc) return false;
      if (filters.tipo !== "todos" && i.tipo_documento !== filters.tipo) return false;
      if (filters.urgencia !== "todos") {
        const min = parseInt(filters.urgencia, 10);
        if (i.horas_pendentes < min) return false;
      }
      if (q) {
        const blob = `${i.produto_codigo} ${i.produto_nome} ${i.numero_ordem ?? ""} ${i.nome_arquivo ?? ""} ${i.tipo_documento}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, filters]);

  // Contadores para tabs (sobre items, antes dos filtros locais — mais útil)
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

  const handleView = (item: InboxItem) => {
    setPreviewDoc(item);
  };

  const handleCorrigir = (item: InboxItem) => {
    navigate(`/dashboard/fabrica-china/submissao/${item.submissao_id}`);
  };

  const handleCiencia = (item: InboxItem) => {
    darCiencia.mutate({
      documento_id: item.documento_id,
      submissao_id: item.submissao_id,
    });
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

      {/* Tabs / filtros rápidos por status */}
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

      {/* Toolbar avançada (busca + filtros + view toggle) */}
      <ChinaInboxToolbar
        items={items}
        filters={filters}
        onFiltersChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isDesktop={isDesktop}
      />

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={items.length === 0 ? "Tudo em dia / 全部完成" : "Nenhum item nos filtros / 无匹配"}
          description={
            items.length === 0
              ? (isBrasilUser
                ? "Não há documentos da China aguardando sua aprovação."
                : "Não há documentos para corrigir. Bom trabalho!")
              : "Ajuste os filtros acima para ver mais itens."
          }
          className="py-12"
        />
      ) : effectiveView === "table" ? (
        <ChinaInboxTable
          items={filteredItems}
          isBrasilUser={isBrasilUser}
          isChinaUser={isChinaUser}
          agrupar={filters.agrupar}
          onApprove={handleApprove}
          onReject={handleReject}
          onView={handleView}
          onCorrigir={handleCorrigir}
          onCiencia={handleCiencia}
          loading={loading}
        />
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
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
