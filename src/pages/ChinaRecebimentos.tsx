import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Package, Loader2, AlertTriangle, Clock, Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { STATUS_LABELS } from "@/lib/china-document-types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";

export default function ChinaRecebimentos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isChinaUser } = useChinaUserContext();
  const [filter, setFilter] = useState<"all" | "pending_action">(
    searchParams.get("status") ? "all" : "all"
  );
  const statusFilter = searchParams.get("status");
  const [search, setSearch] = useState("");

  const { data: submissoes = [], isLoading } = useQuery({
    queryKey: ["china-submissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes" as any)
        .select("*, cores:china_produto_cores(codigo_barras_ean)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // For China users: fetch rejected docs to show pending action indicator
  const { data: rejectedDocsMap = {} } = useQuery({
    queryKey: ["china-rejected-docs-count"],
    enabled: isChinaUser,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_documentos" as any)
        .select("submissao_id")
        .eq("status", "rejeitado");
      const map: Record<string, number> = {};
      (data || []).forEach((d: any) => {
        map[d.submissao_id] = (map[d.submissao_id] || 0) + 1;
      });
      return map;
    },
  });

  const filtered = submissoes.filter((sub: any) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      if (!sub.produto_codigo?.toLowerCase().includes(q) && !sub.produto_nome?.toLowerCase().includes(q)) {
        return false;
      }
    }
    // Status query param filter (from dashboard cards)
    if (statusFilter && sub.status !== statusFilter) {
      return false;
    }
    // Pending action filter (for China): rejected docs or rejeitado status
    if (filter === "pending_action") {
      return sub.status === "rejeitado" || (rejectedDocsMap as any)[sub.id] > 0;
    }
    return true;
  });

  const pendingCount = submissoes.filter(
    (s: any) => s.status === "rejeitado" || (rejectedDocsMap as any)[s.id] > 0
  ).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BilingualLabel pt="Submissões" cn="提交列表" size="lg" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Buscar código ou nome... 搜索代码或名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          {statusFilter && (
            <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => setSearchParams({})}>
              Filtro: {STATUS_LABELS[statusFilter]?.pt || statusFilter} ✕
            </Badge>
          )}
          {isChinaUser && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                Todas 全部 ({submissoes.length})
              </Button>
              <Button
                size="sm"
                variant={filter === "pending_action" ? "destructive" : "outline"}
                onClick={() => setFilter("pending_action")}
                className="gap-1"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Minha Ação 需要操作 ({pendingCount})
              </Button>
            </div>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <BilingualLabel
              pt={filter === "pending_action" ? "Nenhuma pendência" : "Nenhuma submissão"}
              cn={filter === "pending_action" ? "没有待处理项" : "没有提交"}
              size="md"
              className="items-center"
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((sub: any) => {
              const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.rascunho;
              const rejectedDocs = (rejectedDocsMap as any)[sub.id] || 0;

              const isDraft = sub.status === "rascunho";

              return (
                <Card
                  key={sub.id}
                  className="p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                  onClick={() => isDraft
                    ? navigate(`/dashboard/fabrica-china/nova/${sub.id}`)
                    : navigate(`/dashboard/fabrica-china/produto/${sub.id}`)
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground">{sub.produto_codigo}</p>
                        {rejectedDocs > 0 && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {rejectedDocs} doc{rejectedDocs > 1 ? "s" : ""} rejeitado{rejectedDocs > 1 ? "s" : ""} 被拒绝
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{sub.produto_nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(sub.created_at).toLocaleDateString("pt-BR")}
                          {sub.qty_total && ` · ${sub.qty_total.toLocaleString()} un`}
                        </p>
                        {/* EAN Coverage Indicator */}
                        {(() => {
                          const hasDisplay = !!sub.ean_display;
                          const hasMaster = !!sub.ean_caixa_master;
                          const skuEans = (sub.cores || []).filter((c: any) => !!c.codigo_barras_ean).length;
                          const totalSkus = (sub.cores || []).length;
                          const hasAnyEan = hasDisplay || hasMaster || skuEans > 0;
                          const allComplete = hasDisplay && hasMaster && (totalSkus === 0 || skuEans === totalSkus);

                          return hasAnyEan ? (
                            <Badge variant={allComplete ? "default" : "outline"} className={`text-[9px] gap-0.5 px-1.5 py-0 ${allComplete ? "bg-success text-success-foreground" : "text-warning border-warning/40"}`}>
                              <Barcode className="h-2.5 w-2.5" />
                              EAN {allComplete ? "✓" : `${[hasDisplay && "D", hasMaster && "M", totalSkus > 0 && `${skuEans}/${totalSkus}`].filter(Boolean).join(" ")}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] gap-0.5 px-1.5 py-0 text-muted-foreground border-muted-foreground/30">
                              <Barcode className="h-2.5 w-2.5" />
                              Sem EAN
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={statusInfo.variant} className="text-[10px]">
                        {statusInfo.pt} {statusInfo.cn}
                      </Badge>
                      {isDraft && (
                        <span className="text-[10px] text-primary font-medium">
                          ▶ Continuar 继续
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
