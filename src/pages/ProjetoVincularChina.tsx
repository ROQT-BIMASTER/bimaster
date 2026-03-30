import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Package, Loader2, ArrowLeft, Maximize2, Gavel, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditChinaVinculoBadge } from "@/components/china/AuditChinaVinculoBadge";
import { ChinaGradeView } from "@/components/china/ChinaGradeView";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
import { VincularChinaTable, type SubmissaoRow } from "@/components/china/VincularChinaTable";
import { VincularChinaSidePanel } from "@/components/china/VincularChinaSidePanel";
import { VincularChinaBulkActions } from "@/components/china/VincularChinaBulkActions";
import { VincularChinaKpis } from "@/components/china/VincularChinaKpis";
import { ChinaSubmissaoExpandido } from "@/components/china/ChinaSubmissaoExpandido";
import { DespachosPanel } from "@/components/processo/DespachosPanel";
import { ProcessDecisionDialog } from "@/components/processo/ProcessDecisionDialog";
import { useAuditChinaVinculo } from "@/hooks/useAuditChinaVinculo";
import { useSubmissaoPendencias } from "@/hooks/useSubmissaoPendencias";
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
import { useDespachosPorSubmissao } from "@/hooks/useDespachoDocumentos";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { AccessDenied } from "@/components/common/AccessDenied";
import { FileText, ChevronRight, Unlink } from "lucide-react";
import { toast } from "sonner";

const DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";

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

  // States
  const [selectedSubmissaoId, setSelectedSubmissaoId] = useState<string | null>(null);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [checkedTarefas, setCheckedTarefas] = useState<Set<string>>(new Set());
  const [gradeOpen, setGradeOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [focusSubmissao, setFocusSubmissao] = useState<any>(null);
  const [vinculosOpen, setVinculosOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionProcessId, setDecisionProcessId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterProjeto, setFilterProjeto] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  // Data queries
  const { data: submissoes = [], isLoading: loadingSub } = useSubmissoesChina("");
  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(selectedProjetoId);
  const { data: vinculos = [] } = useVinculosExistentes(selectedProjetoId);
  const { data: allVinculos = [] } = useAllVinculos();
  const createVinculo = useCreateVinculo();
  const deleteVinculo = useDeleteVinculo();
  const { auditTarefaProduto, loading: auditLoading, result: auditResult } = useAuditChinaVinculo();

  // Document queries for selected submission
  const { data: documentos = [] } = useDocumentosDaSubmissao(selectedSubmissaoId);
  const { data: cores = [] } = useCoresDaSubmissao(selectedSubmissaoId);
  const { data: docVinculos = [] } = useDocVinculosExistentes(selectedProjetoId);
  const createDocVinculo = useCreateDocVinculo();
  const deleteDocVinculo = useDeleteDocVinculo();

  // Real pendências from DB
  const submissaoIds = useMemo(() => submissoes.map((s: any) => s.id), [submissoes]);
  const { data: pendenciasMap } = useSubmissaoPendencias(submissaoIds);

  const submissaoVinculadas = useMemo(() => {
    const set = new Set<string>();
    allVinculos.forEach(v => set.add(v.submissao_id));
    return set;
  }, [allVinculos]);

  // Build table rows with real pendências
  const tableData: SubmissaoRow[] = useMemo(() => {
    return submissoes
      .filter((s: any) => s.produto_codigo && s.produto_nome && s.produto_codigo !== "null")
      .map((s: any) => {
        const isLinked = submissaoVinculadas.has(s.id);
        const linkedVinculo = allVinculos.find(v => v.submissao_id === s.id);
        const projeto = linkedVinculo ? projetos.find((p: any) => p.id === linkedVinculo.projeto_id) : null;
        const pend = pendenciasMap?.get(s.id);

        return {
          ...s,
          isLinked,
          projetoNome: projeto?.nome || undefined,
          projetoCor: projeto?.cor || undefined,
          pendencias: pend?.pendentes ?? 0,
          totalChecklist: pend?.total ?? 0,
        };
      });
  }, [submissoes, submissaoVinculadas, allVinculos, projetos, pendenciasMap]);

  const selectedSubmissao = useMemo(
    () => submissoes.find((s: any) => s.id === selectedSubmissaoId),
    [submissoes, selectedSubmissaoId]
  );

  const selectedRow = useMemo(
    () => tableData.find(r => r.id === selectedSubmissaoId) || null,
    [tableData, selectedSubmissaoId]
  );

  const secoes = secoesData?.secoes || [];
  const tarefas = secoesData?.tarefas || [];

  const vinculadasCount = useMemo(() => tableData.filter(r => r.isLinked).length, [tableData]);
  const progressPct = tableData.length > 0 ? Math.round((vinculadasCount / tableData.length) * 100) : 0;

  const kpiData = useMemo(() => ({
    total: tableData.length,
    enviados: tableData.filter(r => r.status === "enviado").length,
    emRevisao: tableData.filter(r => r.status === "em_revisao").length,
    aprovados: tableData.filter(r => r.status === "aprovado").length,
    rejeitados: tableData.filter(r => r.status === "rejeitado").length,
    vinculados: vinculadasCount,
  }), [tableData, vinculadasCount]);

  // Handlers
  const handleRowClick = (row: SubmissaoRow) => {
    setSelectedSubmissaoId(row.id);
  };

  const handleFocusClick = (row: SubmissaoRow) => {
    setFocusSubmissao(row);
  };

  const handleToggleTarefa = (tarefaId: string) => {
    setCheckedTarefas(prev => {
      const next = new Set(prev);
      next.has(tarefaId) ? next.delete(tarefaId) : next.add(tarefaId);
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

    const vinculosByTarefa = new Map<string, string>();
    vinculos.forEach(v => vinculosByTarefa.set(v.tarefa_id, v.id));

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
          ].map(item => ({ produto_brasil_id: prodBrasil.id, item, concluido: false }));
          await (supabase.from("produto_brasil_checklist" as any).insert(checklistItems) as any);
        }
      } catch (e) {
        console.error("Erro ao criar produto Brasil:", e);
      }

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

    if (auditPromise) auditPromise.then(() => {});
  };

  const handleDesvincular = (vinculoId: string) => {
    deleteVinculo.mutate(vinculoId);
  };

  const handleToggleDocVinculo = async (docId: string, tarefaId: string) => {
    if (!selectedProjetoId) return;
    const docVinculoMap = new Map<string, string>();
    docVinculos.forEach(v => docVinculoMap.set(`${v.documento_id}-${v.tarefa_id}`, v.id));
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
    const dt = CHINA_DOCUMENT_TYPES.find(d => d.tipo === tipo);
    return dt ? dt.labelPt : tipo;
  };

  if (!isDevTeam) {
    return <AccessDenied message="Acesso restrito à equipe de desenvolvimento." />;
  }

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
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
            <span className="text-xs font-medium text-foreground">{vinculadasCount}/{tableData.length} · {progressPct}%</span>
          </div>
        </div>

        <div className="w-[250px]">
          <Select value={selectedProjetoId || ""} onValueChange={v => { setSelectedProjetoId(v); setCheckedTarefas(new Set()); }}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione um projeto..." />
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
      </div>

      {/* KPIs */}
      <VincularChinaKpis data={kpiData} />

      {/* Split panel: Table + Side Panel */}
      <div className="flex gap-4" style={{ minHeight: "calc(100vh - 320px)" }}>
        {/* Table */}
        <div className={cn("transition-all duration-200", selectedSubmissaoId ? "w-[60%]" : "w-full")}>
          <VincularChinaTable
            data={tableData}
            loading={loadingSub}
            projetos={projetos}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onRowClick={handleRowClick}
            onFocusClick={handleFocusClick}
            onDespacharClick={(ids) => setBulkOpen(true)}
            filterProjeto={filterProjeto}
            onFilterProjetoChange={setFilterProjeto}
          />
        </div>

        {/* Side Panel */}
        {selectedSubmissaoId && selectedRow && (
          <div className="w-[40%] rounded-lg border overflow-hidden">
            <VincularChinaSidePanel
              submissao={selectedRow}
              isLinkedToProject={submissaoVinculadas.has(selectedSubmissaoId)}
              selectedProjetoId={selectedProjetoId}
              onClose={() => setSelectedSubmissaoId(null)}
              onPreviewDoc={setPreviewDoc}
              onDecisionClick={(id) => { setDecisionProcessId(id); setDecisionOpen(true); }}
              secoes={secoes}
              tarefas={tarefas}
              vinculos={vinculos}
              docVinculos={docVinculos}
              checkedTarefas={checkedTarefas}
              onToggleTarefa={handleToggleTarefa}
              onVincular={handleVincular}
              onToggleDocVinculo={handleToggleDocVinculo}
              vinculosPending={createVinculo.isPending}
              auditResult={auditResult}
              auditLoading={auditLoading}
            />
          </div>
        )}
      </div>

      {/* Existing vinculos (collapsible) */}
      {allVinculos.length > 0 && (
        <Collapsible open={vinculosOpen} onOpenChange={setVinculosOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Vínculos Existentes
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

      {/* Bulk Actions Dialog */}
      <VincularChinaBulkActions
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selectedIds={Array.from(selectedIds)}
        submissoes={tableData}
        onComplete={() => setSelectedIds(new Set())}
      />

      {/* Grade Dialog */}
      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              Grade de Cores — {selectedSubmissao?.produto_codigo} {selectedSubmissao?.produto_nome}
            </DialogTitle>
          </DialogHeader>
          <ChinaGradeView items={cores as any} />
        </DialogContent>
      </Dialog>

      {/* Document Preview */}
      <ChinaDocPreviewDialog
        open={!!previewDoc}
        onOpenChange={open => { if (!open) setPreviewDoc(null); }}
        arquivoPath={previewDoc?.arquivo_path}
        arquivoUrl={previewDoc?.arquivo_url}
        nomeArquivo={previewDoc?.nome_arquivo}
        tipoDocumento={getDocTypeLabel(previewDoc?.tipo_documento || "")}
      />

      {/* Focus Mode */}
      <Dialog open={!!focusSubmissao} onOpenChange={open => { if (!open) setFocusSubmissao(null); }}>
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
                  <DespachosPanel submissaoId={focusSubmissao.id} documentos={documentos} />
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Process Decision */}
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
