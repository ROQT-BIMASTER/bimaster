import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Link2, Unlink, ChevronRight, ChevronDown, Package, FolderKanban, CheckCircle2, Loader2, ShieldCheck, Eye, Grid3X3, FileText, Palette, Filter, BarChart3, ArrowLeft, ArrowUpRight, ArrowDownLeft, Scale, Maximize2, Gavel } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AuditChinaVinculoBadge } from "@/components/china/AuditChinaVinculoBadge";
import { ChinaGradeView } from "@/components/china/ChinaGradeView";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { useAuditChinaVinculo } from "@/hooks/useAuditChinaVinculo";
import {
  useSubmissoesChina,
  useProjetosParaVinculo,
  useSecoesETarefas,
  useVinculosExistentes,
  useAllVinculos,
  useCreateVinculo,
  useDeleteVinculo,
} from "@/hooks/useChinaTarefaVinculos";
import {
  useDocumentosDaSubmissao,
  useCoresDaSubmissao,
  useDocVinculosExistentes,
  useCreateDocVinculo,
  useDeleteDocVinculo,
} from "@/hooks/useChinaDocumentoVinculos";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { AccessDenied } from "@/components/common/AccessDenied";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChinaSubmissaoExpandido } from "@/components/china/ChinaSubmissaoExpandido";
import { ProcessOrchestrationPanel } from "@/components/processo/ProcessOrchestrationPanel";
import { DespachosPanel } from "@/components/processo/DespachosPanel";
import { PastaDigitalFromChecklist } from "@/components/china/PastaDigitalFromChecklist";
import { useDocumentosDaSubmissao as useDocsSub } from "@/hooks/useChinaDocumentoVinculos";
import { VincularChinaKpis } from "@/components/china/VincularChinaKpis";
import { ProcessDecisionDialog } from "@/components/processo/ProcessDecisionDialog";

const DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";

const STATUS_FILTERS = [
  { value: "todos", label: "Todos", labelCn: "全部" },
  { value: "rascunho", label: "Rascunho", labelCn: "草稿" },
  { value: "enviado", label: "Enviado", labelCn: "已发送" },
  { value: "em_revisao", label: "Em Revisão", labelCn: "审核中" },
  { value: "aprovado", label: "Aprovado", labelCn: "已批准" },
  { value: "arte_enviada", label: "Docs Enviados", labelCn: "文件已发" },
  { value: "rejeitado", label: "Rejeitado", labelCn: "已拒绝" },
];

function getStatusBadgeVariant(status: string): "secondary" | "default" | "warning" | "success" | "destructive" | "outline" {
  switch (status) {
    case "rascunho": return "secondary";
    case "enviado": return "default";
    case "em_revisao": return "warning";
    case "aprovado": return "success";
    case "arte_enviada": return "outline";
    case "rejeitado": return "destructive";
    default: return "secondary";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "rascunho": return "Rascunho";
    case "enviado": return "Enviado";
    case "em_revisao": return "Em Revisão";
    case "aprovado": return "Aprovado";
    case "arte_enviada": return "Docs Enviados";
    case "rejeitado": return "Rejeitado";
    default: return status;
  }
}

// Status border style (matching ChinaChecklistFocusMode)
const statusBorders: Record<string, string> = {
  aprovado: "border-l-success border-l-4",
  rejeitado: "border-l-destructive border-l-4",
  enviado: "border-l-primary border-l-4",
  em_revisao: "border-l-warning border-l-4",
  rascunho: "border-l-muted-foreground/40 border-l-4 border-dashed",
  arte_enviada: "border-l-success/60 border-l-4",
};

function DespachosActiveSection({ submissaoId }: { submissaoId: string }) {
  const { data: docs = [] } = useDocsSub(submissaoId);
  return <DespachosPanel submissaoId={submissaoId} documentos={docs} />;
}

export default function ProjetoVincularChina() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { data: userDepartments = [] } = useUserDepartments();
  const isDevTeam = isAdmin || userDepartments.some(d => d.id === DEV_DEPARTMENT_ID);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedSubmissaoId, setSelectedSubmissaoId] = useState<string | null>(null);
  const [expandedSubmissaoId, setExpandedSubmissaoId] = useState<string | null>(null);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [checkedTarefas, setCheckedTarefas] = useState<Set<string>>(new Set());
  const [selectedTarefaForDocs, setSelectedTarefaForDocs] = useState<string | null>(null);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [focusSubmissao, setFocusSubmissao] = useState<any>(null);
  const [vinculosOpen, setVinculosOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionProcessId, setDecisionProcessId] = useState<string | null>(null);
  // Sidebar active category
  const [activeSidebarCat, setActiveSidebarCat] = useState<"todas" | "vinculadas" | "nao_vinculadas">("todas");

  // Submissão & projeto queries
  const { data: submissoes = [], isLoading: loadingSub } = useSubmissoesChina(search);
  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(selectedProjetoId);
  const { data: vinculos = [] } = useVinculosExistentes(selectedProjetoId);
  const { data: allVinculos = [] } = useAllVinculos();
  const createVinculo = useCreateVinculo();
  const deleteVinculo = useDeleteVinculo();
  const { auditTarefaProduto, loading: auditLoading, result: auditResult } = useAuditChinaVinculo();

  // Documentos & cores queries
  const { data: documentos = [] } = useDocumentosDaSubmissao(selectedSubmissaoId);
  const { data: cores = [] } = useCoresDaSubmissao(selectedSubmissaoId);
  const { data: docVinculos = [] } = useDocVinculosExistentes(selectedProjetoId);
  const createDocVinculo = useCreateDocVinculo();
  const deleteDocVinculo = useDeleteDocVinculo();

  // Filter submissions
  const filteredSubmissoes = useMemo(() => {
    return submissoes.filter((s: any) => {
      if (!s.produto_codigo || !s.produto_nome || s.produto_codigo === "null") return false;
      if (statusFilter !== "todos" && s.status !== statusFilter) return false;
      return true;
    });
  }, [submissoes, statusFilter]);

  const selectedSubmissao = useMemo(
    () => submissoes.find((s: any) => s.id === selectedSubmissaoId),
    [submissoes, selectedSubmissaoId]
  );

  const vinculosByTarefa = useMemo(() => {
    const map = new Map<string, string>();
    vinculos.forEach((v) => map.set(v.tarefa_id, v.id));
    return map;
  }, [vinculos]);

  const submissaoVinculadas = useMemo(() => {
    const set = new Set<string>();
    allVinculos.forEach((v) => set.add(v.submissao_id));
    return set;
  }, [allVinculos]);

  const vinculadasCount = useMemo(() => {
    return filteredSubmissoes.filter((s: any) => submissaoVinculadas.has(s.id)).length;
  }, [filteredSubmissoes, submissaoVinculadas]);

  // Apply sidebar category filter
  const displayedSubmissoes = useMemo(() => {
    if (activeSidebarCat === "vinculadas") return filteredSubmissoes.filter((s: any) => submissaoVinculadas.has(s.id));
    if (activeSidebarCat === "nao_vinculadas") return filteredSubmissoes.filter((s: any) => !submissaoVinculadas.has(s.id));
    return filteredSubmissoes;
  }, [filteredSubmissoes, activeSidebarCat, submissaoVinculadas]);

  // KPIs
  const kpiData = useMemo(() => ({
    total: filteredSubmissoes.length,
    enviados: filteredSubmissoes.filter((s: any) => s.status === "enviado").length,
    emRevisao: filteredSubmissoes.filter((s: any) => s.status === "em_revisao").length,
    aprovados: filteredSubmissoes.filter((s: any) => s.status === "aprovado").length,
    rejeitados: filteredSubmissoes.filter((s: any) => s.status === "rejeitado").length,
    vinculados: vinculadasCount,
  }), [filteredSubmissoes, vinculadasCount]);

  // Urgency sort: em_revisao first, then enviado, then rest
  const sortedDisplayedSubmissoes = useMemo(() => {
    const urgencyOrder: Record<string, number> = {
      em_revisao: 0,
      enviado: 1,
      rejeitado: 2,
      rascunho: 3,
      aprovado: 4,
      arte_enviada: 5,
    };
    return [...displayedSubmissoes].sort((a: any, b: any) => {
      const ua = urgencyOrder[a.status] ?? 99;
      const ub = urgencyOrder[b.status] ?? 99;
      if (ua !== ub) return ua - ub;
      // Secondary: newest first
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [displayedSubmissoes]);

  const docVinculoMap = useMemo(() => {
    const map = new Map<string, string>();
    docVinculos.forEach((v) => map.set(`${v.documento_id}-${v.tarefa_id}`, v.id));
    return map;
  }, [docVinculos]);

  const secoes = secoesData?.secoes || [];
  const tarefas = secoesData?.tarefas || [];

  // Group documents by category
  const docsByCategory = useMemo(() => {
    const grouped: Record<string, typeof documentos> = {};
    for (const cat of DOCUMENT_CATEGORIES) {
      const catDocs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
      if (catDocs.length > 0) grouped[cat.key] = catDocs;
    }
    const allTipos = DOCUMENT_CATEGORIES.flatMap((c) => c.tipos);
    const ungrouped = documentos.filter((d: any) => !allTipos.includes(d.tipo_documento));
    if (ungrouped.length > 0) grouped["_outros"] = ungrouped;
    return grouped;
  }, [documentos]);

  const handleToggleTarefa = (tarefaId: string) => {
    setCheckedTarefas((prev) => {
      const next = new Set(prev);
      if (next.has(tarefaId)) next.delete(tarefaId);
      else next.add(tarefaId);
      return next;
    });
  };

  const handleVincular = async () => {
    if (!selectedSubmissaoId || !selectedProjetoId || checkedTarefas.size === 0) return;

    const firstTarefaId = Array.from(checkedTarefas)[0];
    const firstTarefa = tarefas.find((t: any) => t.id === firstTarefaId);

    let auditPromise: Promise<any> | null = null;
    if (selectedSubmissao && firstTarefa) {
      auditPromise = auditTarefaProduto({
        tarefa: { titulo: firstTarefa.titulo, estagio: firstTarefa.estagio || undefined },
        submissao: {
          produto_codigo: selectedSubmissao.produto_codigo,
          produto_nome: selectedSubmissao.produto_nome,
          status: selectedSubmissao.status,
          formula_codigo: selectedSubmissao.formula_codigo,
          ean_unidade: selectedSubmissao.ean_unidade,
          ean_display: selectedSubmissao.ean_display,
          ean_caixa_master: selectedSubmissao.ean_caixa_master,
          peso_liquido_g: selectedSubmissao.peso_liquido_g,
          peso_bruto_g: selectedSubmissao.peso_bruto_g,
          qty_total: selectedSubmissao.qty_total,
          observacoes_brasil: selectedSubmissao.observacoes_brasil,
          observacoes_china: selectedSubmissao.observacoes_china,
        },
      }).catch(() => null);
    }

    for (const tarefaId of checkedTarefas) {
      const tarefa = tarefas.find((t: any) => t.id === tarefaId);
      if (vinculosByTarefa.has(tarefaId)) continue;
      await createVinculo.mutateAsync({
        submissao_id: selectedSubmissaoId,
        tarefa_id: tarefaId,
        secao_id: tarefa?.secao_id || null,
        projeto_id: selectedProjetoId,
      });
    }
    setCheckedTarefas(new Set());

    if (selectedSubmissao && selectedProjetoId) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        await (supabase.from("produtos_brasil" as any).insert({
          submissao_china_id: selectedSubmissaoId,
          projeto_id: selectedProjetoId,
          china_nome: selectedSubmissao.produto_nome,
          china_codigo: selectedSubmissao.produto_codigo,
          china_ean: selectedSubmissao.ean_unidade || null,
          china_descricao: selectedSubmissao.observacoes_brasil || null,
          status: "aguardando_precadastro",
        }) as any);
        const { data: prodBrasil } = await (supabase
          .from("produtos_brasil" as any)
          .select("id")
          .eq("submissao_china_id", selectedSubmissaoId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single() as any);
        if (prodBrasil?.id) {
          const checklistItems = [
            "Conferência de rotulagem",
            "Conferência de composição",
            "Registro ou notificação (se aplicável)",
            "Categoria ANVISA",
            "Tradução e adequação da descrição",
            "Validação de imagens da embalagem",
            "Verificação de obrigatoriedade de lote e validade",
          ].map((item) => ({ produto_brasil_id: prodBrasil.id, item, concluido: false }));
          await (supabase.from("produto_brasil_checklist" as any).insert(checklistItems) as any);
        }
      } catch (e) {
        console.error("Erro ao criar produto Brasil:", e);
      }

      // Register vinculação event in the unified process
      try {
        const { supabase: sb } = await import("@/integrations/supabase/client");
        const { data: existingProcess } = await (sb
          .from("product_process" as any)
          .select("id")
          .eq("produto_tipo", "china")
          .eq("produto_ref_id", selectedSubmissaoId)
          .maybeSingle() as any);

        let processId = existingProcess?.id;
        if (!processId) {
          const { data: { user } } = await sb.auth.getUser();
          const { data: newProcess } = await (sb
            .from("product_process" as any)
            .insert({
              produto_tipo: "china",
              produto_ref_id: selectedSubmissaoId,
              criado_por: user?.id,
              etapa_atual: "projeto",
            })
            .select("id")
            .single() as any);
          processId = newProcess?.id;
        } else {
          await (sb
            .from("product_process" as any)
            .update({ etapa_atual: "projeto" })
            .eq("id", processId)
            .eq("etapa_atual", "ideia") as any);
        }

        if (processId) {
          const { data: { user } } = await sb.auth.getUser();
          const { data: profile } = await sb.from("profiles").select("nome").eq("id", user!.id).maybeSingle();
          const projetoNome = projetos.find((p: any) => p.id === selectedProjetoId)?.nome || selectedProjetoId;

          await (sb.from("process_events" as any).insert({
            process_id: processId,
            tipo_evento: "vinculacao",
            descricao: `Vinculado ao projeto: ${projetoNome}`,
            modulo_origem: "processo",
            usuario_id: user?.id,
            usuario_nome: profile?.nome || user?.email,
            metadata: { projeto_id: selectedProjetoId, projeto_nome: projetoNome },
          }) as any);

          await (sb.from("process_step_history" as any).insert({
            process_id: processId,
            etapa: "projeto",
            status: "em_andamento",
            responsavel_id: user?.id,
            data_inicio: new Date().toISOString(),
          }) as any);
        }
      } catch (e) {
        console.error("Erro ao registrar processo:", e);
      }
    }

    if (auditPromise) {
      auditPromise.then(() => {});
    }
  };

  const handleDesvincular = (vinculoId: string) => {
    deleteVinculo.mutate(vinculoId);
  };

  const handleToggleDocVinculo = async (docId: string, tarefaId: string) => {
    if (!selectedProjetoId) return;
    const key = `${docId}-${tarefaId}`;
    const existingId = docVinculoMap.get(key);
    if (existingId) {
      deleteDocVinculo.mutate(existingId);
    } else {
      const tarefa = tarefas.find((t: any) => t.id === tarefaId);
      await createDocVinculo.mutateAsync({
        documento_id: docId,
        tarefa_id: tarefaId,
        secao_id: tarefa?.secao_id || null,
        projeto_id: selectedProjetoId,
      });
    }
  };

  const getDocTypeLabel = (tipo: string) => {
    const dt = CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipo);
    return dt ? dt.labelPt : tipo;
  };

  const getCategoryLabel = (key: string) => {
    if (key === "_outros") return "Outros";
    const cat = DOCUMENT_CATEGORIES.find((c) => c.key === key);
    return cat ? `${cat.labelPt} ${cat.labelCn}` : key;
  };

  if (!isDevTeam) {
    return <AccessDenied message="Acesso restrito à equipe de desenvolvimento." />;
  }

  // Sidebar category stats
  const sidebarCategories = [
    { key: "todas" as const, labelPt: "Todas Submissões", labelCn: "全部提交", count: filteredSubmissoes.length, icon: <Package className="h-3.5 w-3.5" />, color: "text-primary" },
    { key: "vinculadas" as const, labelPt: "Vinculadas", labelCn: "已关联", count: vinculadasCount, icon: <Link2 className="h-3.5 w-3.5" />, color: "text-success" },
    { key: "nao_vinculadas" as const, labelPt: "Não Vinculadas", labelCn: "未关联", count: filteredSubmissoes.length - vinculadasCount, icon: <Unlink className="h-3.5 w-3.5" />, color: "text-warning" },
  ];

  const progressPct = filteredSubmissoes.length > 0 ? Math.round((vinculadasCount / filteredSubmissoes.length) * 100) : 0;

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header — matching checklist style */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Vincular Envio China 关联中国发货</h1>
          <div className="flex items-center gap-3 mt-1">
            <Progress value={progressPct} className="h-2 w-40" />
            <span className="text-xs font-medium text-foreground">{vinculadasCount}/{filteredSubmissoes.length} · {progressPct}%</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <VincularChinaKpis data={kpiData} />

      {/* Counter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="text-[10px] bg-success/10 text-success border-success/20 border">
          <CheckCircle2 className="h-3 w-3 mr-1" />{vinculadasCount} Vinculadas
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          <Package className="h-3 w-3 mr-1" />{filteredSubmissoes.length} Total
        </Badge>
        {allVinculos.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            <ShieldCheck className="h-3 w-3 mr-1" />{allVinculos.length} Vínculos
          </Badge>
        )}
      </div>

      {/* Main layout: Sidebar + Submissions + Project panel */}
      <div className="flex gap-0 border rounded-xl overflow-hidden bg-card" style={{ height: "680px" }}>
        {/* Left Sidebar — Categories (China checklist style) */}
        <div className="w-56 border-r bg-muted/20 flex flex-col shrink-0">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* China Envia header */}
              <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-primary">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>China Envia</span>
                <span className="font-normal opacity-60">中国发送</span>
              </div>

              {sidebarCategories.map((cat) => {
                const isActive = activeSidebarCat === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveSidebarCat(cat.key)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 transition-all text-xs",
                      isActive
                        ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                        : "hover:bg-accent/50 text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate flex items-center gap-1.5">
                        {cat.icon}
                        {cat.labelPt}
                      </span>
                      <span className={cn(
                        "text-[10px] font-medium",
                        cat.key === "vinculadas" && cat.count > 0 ? "text-success" : "text-muted-foreground"
                      )}>
                        {cat.count}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block">{cat.labelCn}</span>
                  </button>
                );
              })}

              <div className="my-2 border-t border-border" />

              {/* Status filters as sidebar items */}
              <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-success">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                <span>Filtro Status</span>
                <span className="font-normal opacity-60">状态筛选</span>
              </div>

              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 transition-all text-xs",
                    statusFilter === f.value
                      ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                      : "hover:bg-accent/50 text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{f.label}</span>
                    <span className="text-[10px] text-muted-foreground">{f.labelCn}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Center: Submission cards (checklist-style cards) */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          {/* Search bar */}
          <div className="p-3 border-b bg-background/95">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome... 搜索代码或名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loadingSub ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sortedDisplayedSubmissoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhuma submissão encontrada</p>
            ) : (
              <div className="p-3 grid grid-cols-1 gap-3">
                {sortedDisplayedSubmissoes.map((sub: any) => {
                  const isSelected = selectedSubmissaoId === sub.id;
                  const isExpanded = expandedSubmissaoId === sub.id;
                  const isLinked = submissaoVinculadas.has(sub.id);

                  return (
                    <div key={sub.id}>
                      <button
                        onClick={() => {
                          setSelectedSubmissaoId(sub.id);
                          setExpandedSubmissaoId(isExpanded ? null : sub.id);
                          setSelectedTarefaForDocs(null);
                        }}
                        className={cn(
                          "w-full text-left border rounded-xl p-4 transition-all",
                          statusBorders[sub.status] || "",
                          isSelected
                            ? "bg-primary/5 border-primary/30 shadow-sm"
                            : "bg-card hover:bg-accent/30",
                          !isLinked && "border-dashed",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                            isLinked ? "bg-success/10" : "bg-secondary"
                          )}>
                            <Package className={cn("h-5 w-5", isLinked ? "text-success" : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-primary">{sub.produto_codigo}</span>
                              {isLinked && <span className="h-2 w-2 rounded-full bg-success shrink-0" title="Vinculada" />}
                            </div>
                            <p className="text-sm font-semibold text-foreground truncate">{sub.produto_nome}</p>
                            {sub.numero_ordem && (
                              <p className="text-[10px] text-muted-foreground">OC: {sub.numero_ordem}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant={getStatusBadgeVariant(sub.status)} className="text-[10px]">
                              {getStatusLabel(sub.status)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => { e.stopPropagation(); setFocusSubmissao(sub); }}
                              title="Modo Foco"
                            >
                              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <ChevronDown className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )} />
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="mt-1 ml-4">
                          <ChinaSubmissaoExpandido
                            submissao={sub}
                            onPreviewDoc={setPreviewDoc}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel: Project & Tasks */}
        <div className="w-[380px] flex flex-col shrink-0">
          <div className="p-3 border-b bg-background/95">
            <div className="flex items-center justify-between mb-2">
              <BilingualLabel pt="Projeto & Tarefas" cn="项目和任务" size="sm" />
              {selectedSubmissaoId && cores.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setGradeOpen(true)} className="h-7 text-[10px]">
                  <Grid3X3 className="h-3 w-3 mr-1" />
                  Grade
                </Button>
              )}
            </div>
            <Select value={selectedProjetoId || ""} onValueChange={(v) => { setSelectedProjetoId(v); setCheckedTarefas(new Set()); setSelectedTarefaForDocs(null); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione um projeto 选择项目..." />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.cor && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />}
                      {p.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            {!selectedProjetoId && !selectedSubmissaoId ? (
              <p className="text-sm text-muted-foreground text-center py-10">Selecione uma submissão e um projeto</p>
            ) : !selectedProjetoId && selectedSubmissao ? (
              <div className="px-4 py-4 space-y-3">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{selectedSubmissao.produto_nome}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Código:</span>{" "}
                      <span className="font-mono font-bold text-primary">{selectedSubmissao.produto_codigo}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge variant={getStatusBadgeVariant(selectedSubmissao.status)} className="text-[10px] ml-1">
                        {getStatusLabel(selectedSubmissao.status)}
                      </Badge>
                    </div>
                    {selectedSubmissao.formula_codigo && (
                      <div>
                        <span className="text-muted-foreground">Fórmula:</span>{" "}
                        <span className="font-mono">{selectedSubmissao.formula_codigo}</span>
                      </div>
                    )}
                    {selectedSubmissao.qty_total && (
                      <div>
                        <span className="text-muted-foreground">Qtd Total:</span>{" "}
                        <span className="font-semibold">{selectedSubmissao.qty_total.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">Selecione um projeto acima para vincular</p>
              </div>
            ) : !selectedSubmissaoId ? (
              <p className="text-sm text-muted-foreground text-center py-10">Selecione uma submissão à esquerda</p>
            ) : secoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhuma seção encontrada</p>
            ) : (
              <div className="px-3 py-2 space-y-3">
                {secoes.map((secao: any) => {
                  const secaoTarefas = tarefas.filter((t: any) => t.secao_id === secao.id);
                  if (secaoTarefas.length === 0) return null;
                  return (
                    <div key={secao.id}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        {secao.nome}
                      </p>
                      <div className="space-y-1">
                        {secaoTarefas.map((tarefa: any) => {
                          const isLinked = vinculosByTarefa.has(tarefa.id);
                          const isChecked = checkedTarefas.has(tarefa.id);
                          const isDocTarget = selectedTarefaForDocs === tarefa.id;
                          const docCount = docVinculos.filter((dv) => dv.tarefa_id === tarefa.id).length;
                          return (
                            <div
                              key={tarefa.id}
                              className={cn(
                                "flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors",
                                isLinked && "bg-success/5",
                                isDocTarget && "ring-1 ring-primary/30 bg-primary/5"
                              )}
                            >
                              <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                                {isLinked ? (
                                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                                ) : (
                                  <Checkbox checked={isChecked} onCheckedChange={() => handleToggleTarefa(tarefa.id)} />
                                )}
                                <span className="text-sm text-foreground">{tarefa.titulo}</span>
                                {tarefa.codigo && <span className="text-[10px] text-muted-foreground font-mono">{tarefa.codigo}</span>}
                              </label>
                              {docCount > 0 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  <FileText className="h-3 w-3 mr-0.5" />{docCount}
                                </Badge>
                              )}
                              {isLinked && (
                                <>
                                  <Button
                                    variant={isDocTarget ? "default" : "ghost"}
                                    size="sm"
                                    className="h-7 px-2 text-[10px]"
                                    onClick={() => setSelectedTarefaForDocs(isDocTarget ? null : tarefa.id)}
                                  >
                                    <FileText className="h-3 w-3 mr-1" />Docs
                                  </Button>
                                  <Badge variant="outline" className="text-[10px] text-success border-success/30">Vinculada</Badge>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Action bar */}
          {selectedSubmissaoId && selectedProjetoId && (
            <div className="border-t px-3 py-3 space-y-2">
              <AuditChinaVinculoBadge result={auditResult} loading={auditLoading} />
              <Button
                onClick={handleVincular}
                disabled={checkedTarefas.size === 0 || createVinculo.isPending}
                className="w-full"
                size="sm"
              >
                {createVinculo.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                Vincular 关联 {checkedTarefas.size > 0 ? `(${checkedTarefas.size})` : ""}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Documents panel - shows when a linked tarefa is selected for docs */}
      {selectedSubmissaoId && selectedTarefaForDocs && documentos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Documentos da Submissão — vincular à tarefa selecionada
              </CardTitle>
              <Badge variant="secondary" className="text-xs">{documentos.length} documento(s)</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(docsByCategory).map(([catKey, catDocs]) => (
                <div key={catKey}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {getCategoryLabel(catKey)}
                  </p>
                  <div className="space-y-1">
                    {catDocs.map((doc: any) => {
                      const key = `${doc.id}-${selectedTarefaForDocs}`;
                      const isDocLinked = docVinculoMap.has(key);
                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md border transition-colors",
                            isDocLinked ? "bg-success/5 border-success/20" : "bg-card border-border"
                          )}
                        >
                          <Checkbox
                            checked={isDocLinked}
                            onCheckedChange={() => handleToggleDocVinculo(doc.id, selectedTarefaForDocs)}
                            disabled={createDocVinculo.isPending || deleteDocVinculo.isPending}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}</p>
                            <p className="text-[10px] text-muted-foreground">{getDocTypeLabel(doc.tipo_documento)}</p>
                          </div>
                          <Badge variant={doc.status === "aprovado" ? "success" : "secondary"} className="text-[10px] shrink-0">{doc.status}</Badge>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPreviewDoc(doc)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing vinculos */}
      {allVinculos.length > 0 && (
        <Collapsible open={vinculosOpen} onOpenChange={setVinculosOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Vínculos Existentes 现有关联
                    <Badge variant="secondary" className="text-[10px] ml-1">{allVinculos.length}</Badge>
                  </CardTitle>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", vinculosOpen && "rotate-90")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="divide-y">
                  {allVinculos.map((v: any) => {
                    const projeto = projetos.find((p: any) => p.id === v.projeto_id);
                    return (
                      <div key={v.id} className="flex items-center gap-3 py-2.5">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono font-bold text-primary">{v.submissao?.produto_codigo || "—"}</span>
                          <span className="text-xs text-muted-foreground mx-1.5">→</span>
                          <span className="text-sm text-foreground">{projeto?.nome || v.projeto_id}</span>
                        </div>
                        {v.submissao?.status && (
                          <Badge variant={getStatusBadgeVariant(v.submissao.status)} className="text-[10px]">
                            {getStatusLabel(v.submissao.status)}
                          </Badge>
                        )}
                        {v.audit_result && <AuditChinaVinculoBadge result={v.audit_result} compact />}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDesvincular(v.id)}
                          disabled={deleteVinculo.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Pasta Digital TJSP — appears when a submission is selected and has docs */}
      {selectedSubmissaoId && documentos.length > 0 && (
        <PastaDigitalFromChecklist submissaoId={selectedSubmissaoId} />
      )}

      {/* Process Orchestration Panel — appears when a linked submission is selected */}
      {selectedSubmissaoId && submissaoVinculadas.has(selectedSubmissaoId) && (
        <>
          <ProcessOrchestrationPanel
            submissaoId={selectedSubmissaoId}
            submissaoNome={selectedSubmissao?.produto_nome}
            submissaoCodigo={selectedSubmissao?.produto_codigo}
          />
          {/* Decision Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setDecisionProcessId(selectedSubmissaoId);
                setDecisionOpen(true);
              }}
            >
              <Gavel className="h-4 w-4" />
              Decisão Formal do Brasil
            </Button>
          </div>
        </>
      )}

      {/* Despachos Panel — appears for any selected submission */}
      {selectedSubmissaoId && (
        <DespachosActiveSection submissaoId={selectedSubmissaoId} />
      )}

      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Palette className="h-4 w-4 text-primary" />
              Grade de Cores — {selectedSubmissao?.produto_codigo} {selectedSubmissao?.produto_nome}
            </DialogTitle>
          </DialogHeader>
          <ChinaGradeView items={cores as any} />
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <ChinaDocPreviewDialog
        open={!!previewDoc}
        onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}
        arquivoPath={previewDoc?.arquivo_path}
        arquivoUrl={previewDoc?.arquivo_url}
        nomeArquivo={previewDoc?.nome_arquivo}
        tipoDocumento={getDocTypeLabel(previewDoc?.tipo_documento || "")}
      />

      {/* Focus Mode Dialog */}
      <Dialog open={!!focusSubmissao} onOpenChange={(open) => { if (!open) setFocusSubmissao(null); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-primary">{focusSubmissao?.produto_codigo}</span>
                  <Badge variant={getStatusBadgeVariant(focusSubmissao?.status || "")}>
                    {getStatusLabel(focusSubmissao?.status || "")}
                  </Badge>
                </div>
                <p className="text-base font-semibold">{focusSubmissao?.produto_nome}</p>
              </div>
              {focusSubmissao?.numero_ordem && (
                <Badge variant="outline" className="ml-auto text-xs">OC: {focusSubmissao.numero_ordem}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-auto">
            <div className="p-6">
              {focusSubmissao && (
                <ChinaSubmissaoExpandido
                  submissao={focusSubmissao}
                  onPreviewDoc={setPreviewDoc}
                  processoId={undefined}
                />
              )}
              {focusSubmissao && (
                <div className="mt-4">
                  <DespachosActiveSection submissaoId={focusSubmissao.id} />
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Process Decision Dialog */}
      {decisionProcessId && (
        <ProcessDecisionDialog
          open={decisionOpen}
          onOpenChange={setDecisionOpen}
          processId={decisionProcessId}
          submissaoId={decisionProcessId}
          documentos={documentos.map((d: any) => ({ id: d.id, nome_arquivo: d.nome_arquivo, tipo_documento: d.tipo_documento }))}
        />
      )}
    </div>
  );
}
