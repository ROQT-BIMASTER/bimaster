import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Package, Loader2, AlertTriangle, Clock, Barcode, Trash2,
  RotateCcw, Search, Eye, PenLine, CheckCircle2, XCircle, Send,
  Filter, ChevronDown, ChevronUp, FileText, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { STATUS_LABELS } from "@/lib/china-document-types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { SubmissionManual } from "@/components/china/SubmissionManual";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { formatLocalDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";

type SortField = "produto_codigo" | "created_at" | "status" | "qty_total";
type SortDir = "asc" | "desc";

export default function ChinaRecebimentos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isChinaUser } = useChinaUserContext();
  const statusFilter = searchParams.get("status");
  const [search, setSearch] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  // Docs count per submission
  const { data: docsCountMap = {} } = useQuery({
    queryKey: ["china-docs-count-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_documentos" as any)
        .select("submissao_id, status");
      const map: Record<string, { total: number; aprovados: number; pendentes: number }> = {};
      (data || []).forEach((d: any) => {
        if (!map[d.submissao_id]) map[d.submissao_id] = { total: 0, aprovados: 0, pendentes: 0 };
        map[d.submissao_id].total++;
        if (d.status === "aprovado" || d.status === "ciencia") map[d.submissao_id].aprovados++;
        if (d.status === "pendente") map[d.submissao_id].pendentes++;
      });
      return map;
    },
  });

  const activeSubmissoes = submissoes.filter((s: any) => !s.deleted_at);
  const trashedSubmissoes = submissoes.filter((s: any) => !!s.deleted_at);
  const baseList = showTrash ? trashedSubmissoes : activeSubmissoes;

  const filtered = baseList
    .filter((sub: any) => {
      if (search) {
        const q = search.toLowerCase();
        if (!sub.produto_codigo?.toLowerCase().includes(q) && !sub.produto_nome?.toLowerCase().includes(q)) return false;
      }
      if (statusFilter && sub.status !== statusFilter) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      let cmp = 0;
      if (sortField === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === "produto_codigo") cmp = (a.produto_codigo || "").localeCompare(b.produto_codigo || "");
      else if (sortField === "status") cmp = (a.status || "").localeCompare(b.status || "");
      else if (sortField === "qty_total") cmp = (a.qty_total || 0) - (b.qty_total || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });

  // KPIs
  const total = activeSubmissoes.length;
  const rascunhos = activeSubmissoes.filter((s: any) => s.status === "rascunho").length;
  const pendentes = activeSubmissoes.filter((s: any) => s.status === "pendente" || s.status === "em_revisao").length;
  const aprovados = activeSubmissoes.filter((s: any) => s.status === "aprovado" || s.status === "arte_enviada").length;
  const rejeitados = activeSubmissoes.filter((s: any) => s.status === "rejeitado").length;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const handleRestore = async (subId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase
      .from("china_produto_submissoes" as any)
      .update({ deleted_at: null, deleted_by: null, delete_reason: null } as any)
      .eq("id", subId);
    toast.success("Submissão restaurada! 提交已恢复！");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BilingualLabel pt="Submissões" cn="提交列表" size="lg" className="flex-1" />
          <ManualFabricaDrawer screen="china-submissoes" />
        </div>

        <SubmissionManual />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", cn: "总计", value: total, icon: Package, color: "text-foreground" },
            { label: "Rascunhos", cn: "草稿", value: rascunhos, icon: PenLine, color: "text-muted-foreground" },
            { label: "Pendentes", cn: "待审", value: pendentes, icon: Clock, color: "text-warning" },
            { label: "Aprovados", cn: "已批准", value: aprovados, icon: CheckCircle2, color: "text-success" },
            { label: "Rejeitados", cn: "被拒", value: rejeitados, icon: XCircle, color: "text-destructive" },
          ].map(kpi => (
            <Card key={kpi.label} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                <span className="text-xs text-muted-foreground">{kpi.label} {kpi.cn}</span>
              </div>
              <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar código ou nome... 搜索代码或名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {statusFilter && (
            <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => setSearchParams({})}>
              {STATUS_LABELS[statusFilter]?.pt || statusFilter} ✕
            </Badge>
          )}
          <Button
            size="sm"
            variant={showTrash ? "destructive" : "outline"}
            onClick={() => setShowTrash(!showTrash)}
            className="gap-1 ml-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Lixeira 回收站 {trashedSubmissoes.length > 0 && `(${trashedSubmissoes.length})`}
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center">
            <Package className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
            <BilingualLabel pt="Nenhuma submissão encontrada" cn="未找到提交" size="md" className="items-center" />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("produto_codigo")}>
                      <div className="flex items-center gap-1">Produto 产品 <SortIcon field="produto_codigo" /></div>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("status")}>
                      <div className="flex items-center gap-1">Status 状态 <SortIcon field="status" /></div>
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                      Docs 文件
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("qty_total")}>
                      <div className="flex items-center justify-center gap-1">Qtd 数量 <SortIcon field="qty_total" /></div>
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                      EAN
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("created_at")}>
                      <div className="flex items-center justify-center gap-1">Data 日期 <SortIcon field="created_at" /></div>
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                      Ações 操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((sub: any) => {
                    const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.rascunho;
                    const rejectedDocs = (rejectedDocsMap as any)[sub.id] || 0;
                    const isDraft = sub.status === "rascunho";
                    const docStats = (docsCountMap as any)[sub.id] || { total: 0, aprovados: 0, pendentes: 0 };
                    const docPct = docStats.total > 0 ? Math.round((docStats.aprovados / docStats.total) * 100) : 0;

                    const hasDisplay = !!sub.ean_display;
                    const hasMaster = !!sub.ean_caixa_master;
                    const skuEans = (sub.cores || []).filter((c: any) => !!c.codigo_barras_ean).length;
                    const totalSkus = (sub.cores || []).length;
                    const allEanComplete = hasDisplay && hasMaster && (totalSkus === 0 || skuEans === totalSkus);

                    // Status-based left border color
                    const borderColor = sub.status === "aprovado" || sub.status === "arte_enviada"
                      ? "border-l-success"
                      : sub.status === "rejeitado"
                      ? "border-l-destructive"
                      : sub.status === "pendente" || sub.status === "em_revisao"
                      ? "border-l-warning"
                      : sub.status === "contestado"
                      ? "border-l-warning"
                      : "border-l-muted-foreground/30";

                    return (
                      <tr
                        key={sub.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-accent/10 border-l-4",
                          borderColor,
                        )}
                        onClick={() => isDraft
                          ? navigate(`/dashboard/fabrica-china/nova/${sub.id}`)
                          : navigate(`/dashboard/fabrica-china/produto/${sub.id}`)
                        }
                      >
                        {/* Produto */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-foreground text-sm">{sub.produto_codigo}</p>
                                {rejectedDocs > 0 && (
                                  <span className="flex items-center gap-0.5 text-destructive">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span className="text-[10px] font-medium">{rejectedDocs}</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{sub.produto_nome}</p>
                              {sub.formula_codigo && (
                                <p className="text-[10px] text-muted-foreground">Fórmula: {sub.formula_codigo}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <Badge variant={statusInfo.variant} className="text-[10px]">
                            {statusInfo.pt}
                          </Badge>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{statusInfo.cn}</p>
                        </td>

                        {/* Docs progress */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-medium text-foreground">
                              {docStats.aprovados}/{docStats.total}
                            </span>
                            <Progress value={docPct} className="h-1.5 w-16" />
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-semibold text-foreground">
                            {sub.qty_total ? sub.qty_total.toLocaleString() : "—"}
                          </span>
                          {totalSkus > 0 && (
                            <p className="text-[10px] text-muted-foreground">{totalSkus} SKU{totalSkus > 1 ? "s" : ""}</p>
                          )}
                        </td>

                        {/* EAN */}
                        <td className="px-4 py-3 text-center">
                          {allEanComplete ? (
                            <Badge variant="success" className="text-[9px]">
                              <Barcode className="h-2.5 w-2.5 mr-0.5" /> ✓
                            </Badge>
                          ) : (hasDisplay || hasMaster || skuEans > 0) ? (
                            <Badge variant="warning" className="text-[9px]">
                              <Barcode className="h-2.5 w-2.5 mr-0.5" />
                              {[hasDisplay && "D", hasMaster && "M"].filter(Boolean).join("+")}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-foreground">{formatLocalDate(sub.created_at, "dd/MM/yyyy")}</span>
                          <p className="text-[10px] text-muted-foreground">{formatLocalDate(sub.created_at, "HH:mm")}</p>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {showTrash ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => handleRestore(sub.id, e)}>
                                <RotateCcw className="h-3 w-3" /> Restaurar
                              </Button>
                            ) : isDraft ? (
                              <>
                                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/fabrica-china/nova/${sub.id}`); }}>
                                  <PenLine className="h-3 w-3" /> Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmed(false); setDeleteTarget(sub); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/fabrica-china/produto/${sub.id}`); }}>
                                <Eye className="h-3 w-3" /> Ver
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filtered.length} de {baseList.length} submissão(ões)
              </span>
              <span className="text-xs text-muted-foreground">
                Total Qtd: {filtered.reduce((s, sub: any) => s + (sub.qty_total || 0), 0).toLocaleString()} un
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Delete Draft Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir Submissão 删除提交
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm space-y-2">
              <p className="font-semibold">Termo de Exclusão 删除条款</p>
              <p className="text-muted-foreground text-xs">
                Ao excluir, a submissão será movida para a <strong>Lixeira</strong> por 30 dias.
              </p>
              <p className="text-muted-foreground text-xs">
                删除后，提交将被移至<strong>回收站</strong>30天。
              </p>
              {deleteTarget && (
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  <strong>Produto 产品:</strong> {deleteTarget.produto_codigo} — {deleteTarget.produto_nome}
                </div>
              )}
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="delete-confirm-list"
                checked={deleteConfirmed}
                onCheckedChange={(checked) => setDeleteConfirmed(!!checked)}
              />
              <label htmlFor="delete-confirm-list" className="text-sm cursor-pointer leading-tight">
                Confirmo que desejo excluir esta submissão.
                <br />
                <span className="text-xs text-muted-foreground">我确认要删除此提交。</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar 取消</Button>
            <Button
              variant="destructive"
              disabled={!deleteConfirmed || deleting}
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  await supabase
                    .from("china_produto_submissoes" as any)
                    .update({
                      deleted_at: new Date().toISOString(),
                      deleted_by: user?.id || null,
                      delete_reason: "Exclusão voluntária pelo usuário",
                    } as any)
                    .eq("id", deleteTarget.id);
                  toast.success("Submissão movida para a lixeira! 提交已移至回收站！");
                  setDeleteTarget(null);
                  window.location.reload();
                } catch {
                  toast.error("Erro ao excluir 删除失败");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Confirmar Exclusão 确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
