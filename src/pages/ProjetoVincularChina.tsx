import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Link2, Unlink, ChevronRight, ChevronDown, Package, FolderKanban, CheckCircle2, Loader2, ShieldCheck, Eye, Grid3X3, FileText, Palette, Filter, BarChart3, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuditChinaVinculoBadge } from "@/components/china/AuditChinaVinculoBadge";
import { ChinaGradeView } from "@/components/china/ChinaGradeView";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
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
const DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";

const STATUS_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "enviado", label: "Enviado" },
  { value: "em_revisao", label: "Em Revisão" },
  { value: "aprovado", label: "Aprovado" },
  { value: "arte_enviada", label: "Docs Enviados" },
  { value: "rejeitado", label: "Rejeitado" },
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
  const [vinculosOpen, setVinculosOpen] = useState(false);

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

  // Filter out invalid submissions and apply status filter
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

  // Doc vinculos indexed by "docId-tarefaId"
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

    // Start audit in background (non-blocking)
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

    // Create vínculos immediately without waiting for audit
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

    // Auto-create produto_brasil record after linking
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
        // Populate checklist
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
    }

    // Update audit result in background when ready (informational only)
    if (auditPromise) {
      auditPromise.then(() => {/* result already set via hook state */});
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Vincular Envio China</h1>
          <p className="text-sm text-muted-foreground">
            Associe submissões e documentos da fábrica China a tarefas e seções do projeto
          </p>
        </div>
      </div>

      {/* Main content - two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel - China submissions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Submissões China
              </CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="font-medium">{filteredSubmissoes.length}</span> submissões
                <span className="text-muted-foreground/50">|</span>
                <span className="font-medium text-success">{vinculadasCount}</span> vinculadas
              </div>
            </div>

            {/* Status filter chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors",
                    statusFilter === f.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loadingSub ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSubmissoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhuma submissão encontrada</p>
              ) : (
                <div className="divide-y">
                  {filteredSubmissoes.map((sub: any) => {
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
                            "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-center gap-3",
                            isSelected && "bg-primary/5 border-l-2 border-l-primary"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-primary">{sub.produto_codigo}</span>
                              {isLinked && (
                                <span className="h-2 w-2 rounded-full bg-success shrink-0" title="Já vinculada" />
                              )}
                            </div>
                            <p className="text-sm text-foreground truncate">{sub.produto_nome}</p>
                            {sub.numero_ordem && (
                              <p className="text-[10px] text-muted-foreground">OC: {sub.numero_ordem}</p>
                            )}
                          </div>
                          <Badge variant={getStatusBadgeVariant(sub.status)} className="text-[10px] shrink-0">
                            {getStatusLabel(sub.status)}
                          </Badge>
                          <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )} />
                        </button>
                        {isExpanded && (
                          <ChinaSubmissaoExpandido
                            submissao={sub}
                            onPreviewDoc={setPreviewDoc}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel - Project sections & tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" />
                Projeto & Tarefas
              </CardTitle>
              {selectedSubmissaoId && cores.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setGradeOpen(true)}>
                  <Grid3X3 className="h-3.5 w-3.5 mr-1.5" />
                  Ver Grade
                </Button>
              )}
            </div>
            <Select value={selectedProjetoId || ""} onValueChange={(v) => { setSelectedProjetoId(v); setCheckedTarefas(new Set()); setSelectedTarefaForDocs(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto..." />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.cor && (
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.cor }}
                        />
                      )}
                      {p.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[320px]">
              {!selectedProjetoId && !selectedSubmissaoId ? (
                <p className="text-sm text-muted-foreground text-center py-10">Selecione uma submissão e um projeto</p>
              ) : !selectedProjetoId && selectedSubmissao ? (
                /* Submission summary when no project is selected */
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
                      {selectedSubmissao.ean_unidade && (
                        <div>
                          <span className="text-muted-foreground">EAN Unid:</span>{" "}
                          <span className="font-mono text-[11px]">{selectedSubmissao.ean_unidade}</span>
                        </div>
                      )}
                      {selectedSubmissao.ean_display && (
                        <div>
                          <span className="text-muted-foreground">EAN Display:</span>{" "}
                          <span className="font-mono text-[11px]">{selectedSubmissao.ean_display}</span>
                        </div>
                      )}
                      {selectedSubmissao.ean_caixa_master && (
                        <div>
                          <span className="text-muted-foreground">EAN Cx Master:</span>{" "}
                          <span className="font-mono text-[11px]">{selectedSubmissao.ean_caixa_master}</span>
                        </div>
                      )}
                      {selectedSubmissao.peso_liquido_g && (
                        <div>
                          <span className="text-muted-foreground">P. Líq:</span>{" "}
                          <span>{selectedSubmissao.peso_liquido_g}g</span>
                        </div>
                      )}
                      {selectedSubmissao.peso_bruto_g && (
                        <div>
                          <span className="text-muted-foreground">P. Bruto:</span>{" "}
                          <span>{selectedSubmissao.peso_bruto_g}g</span>
                        </div>
                      )}
                      {selectedSubmissao.numero_ordem && (
                        <div>
                          <span className="text-muted-foreground">Nº Ordem:</span>{" "}
                          <span>{selectedSubmissao.numero_ordem}</span>
                        </div>
                      )}
                      {selectedSubmissao.numero_item && (
                        <div>
                          <span className="text-muted-foreground">Nº Item:</span>{" "}
                          <span>{selectedSubmissao.numero_item}</span>
                        </div>
                      )}
                    </div>
                    {(selectedSubmissao.observacoes_brasil || selectedSubmissao.observacoes_china) && (
                      <div className="space-y-1 pt-1 border-t border-border/50">
                        {selectedSubmissao.observacoes_brasil && (
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-medium">🇧🇷 Brasil:</span> {selectedSubmissao.observacoes_brasil}
                          </p>
                        )}
                        {selectedSubmissao.observacoes_china && (
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-medium">🇨🇳 China:</span> {selectedSubmissao.observacoes_china}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Selecione um projeto acima para vincular
                  </p>
                </div>
              ) : !selectedSubmissaoId ? (
                <p className="text-sm text-muted-foreground text-center py-10">Selecione uma submissão à esquerda</p>
              ) : secoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhuma seção encontrada</p>
              ) : (
                <div className="px-4 py-2 space-y-3">
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
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => handleToggleTarefa(tarefa.id)}
                                    />
                                  )}
                                  <span className="text-sm text-foreground">{tarefa.titulo}</span>
                                  {tarefa.codigo && (
                                    <span className="text-[10px] text-muted-foreground font-mono">{tarefa.codigo}</span>
                                  )}
                                </label>
                                {docCount > 0 && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    <FileText className="h-3 w-3 mr-0.5" />
                                    {docCount}
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
                                      <FileText className="h-3 w-3 mr-1" />
                                      Docs
                                    </Button>
                                    <Badge variant="outline" className="text-[10px] text-success border-success/30">
                                      Vinculada
                                    </Badge>
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

            {/* Audit + Action bar */}
            {selectedSubmissaoId && selectedProjetoId && (
              <div className="border-t px-4 py-3 space-y-2">
                <AuditChinaVinculoBadge result={auditResult} loading={auditLoading} />
                <Button
                  onClick={handleVincular}
                  disabled={checkedTarefas.size === 0 || createVinculo.isPending}
                  className="w-full"
                  size="sm"
                >
                  {createVinculo.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Vincular {checkedTarefas.size > 0 ? `(${checkedTarefas.size})` : ""}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
              <Badge variant="secondary" className="text-xs">
                {documentos.length} documento(s)
              </Badge>
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
                            <p className="text-sm text-foreground truncate">
                              {doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {getDocTypeLabel(doc.tipo_documento)}
                            </p>
                          </div>
                          <Badge
                            variant={doc.status === "aprovado" ? "success" : "secondary"}
                            className="text-[10px] shrink-0"
                          >
                            {doc.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setPreviewDoc(doc)}
                          >
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

      {/* Existing vinculos - collapsible, hidden when empty */}
      {allVinculos.length > 0 && (
        <Collapsible open={vinculosOpen} onOpenChange={setVinculosOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Vínculos Existentes
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {allVinculos.length}
                    </Badge>
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
                          <span className="text-xs font-mono font-bold text-primary">
                            {v.submissao?.produto_codigo || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground mx-1.5">→</span>
                          <span className="text-sm text-foreground">
                            {projeto?.nome || v.projeto_id}
                          </span>
                        </div>
                        {v.submissao?.status && (
                          <Badge variant={getStatusBadgeVariant(v.submissao.status)} className="text-[10px]">
                            {getStatusLabel(v.submissao.status)}
                          </Badge>
                        )}
                        {v.audit_result && (
                          <AuditChinaVinculoBadge result={v.audit_result} compact />
                        )}
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

      {/* Grade Dialog */}
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
    </div>
  );
}
