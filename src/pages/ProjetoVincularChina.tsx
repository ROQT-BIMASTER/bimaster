import { useState, useMemo } from "react";
import { Search, Link2, Unlink, ChevronRight, Package, FolderKanban, CheckCircle2, Loader2, ShieldCheck, Eye, Grid3X3, FileText, Palette } from "lucide-react";
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

const DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";

export default function ProjetoVincularChina() {
  const { isAdmin } = usePermissions();
  const { data: userDepartments = [] } = useUserDepartments();
  const isDevTeam = isAdmin || userDepartments.some(d => d.id === DEV_DEPARTMENT_ID);

  const [search, setSearch] = useState("");
  const [selectedSubmissaoId, setSelectedSubmissaoId] = useState<string | null>(null);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [checkedTarefas, setCheckedTarefas] = useState<Set<string>>(new Set());
  const [selectedTarefaForDocs, setSelectedTarefaForDocs] = useState<string | null>(null);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);

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
    // Ungrouped
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

    let audit = null;
    if (selectedSubmissao && firstTarefa) {
      audit = await auditTarefaProduto({
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
      });
    }

    for (const tarefaId of checkedTarefas) {
      const tarefa = tarefas.find((t: any) => t.id === tarefaId);
      if (vinculosByTarefa.has(tarefaId)) continue;
      await createVinculo.mutateAsync({
        submissao_id: selectedSubmissaoId,
        tarefa_id: tarefaId,
        secao_id: tarefa?.secao_id || null,
        projeto_id: selectedProjetoId,
        audit_result: audit || undefined,
      });
    }
    setCheckedTarefas(new Set());
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
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
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Submissões China
            </CardTitle>
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
            <ScrollArea className="h-[400px]">
              {loadingSub ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : submissoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhuma submissão encontrada</p>
              ) : (
                <div className="divide-y">
                  {submissoes.map((sub: any) => {
                    const isSelected = selectedSubmissaoId === sub.id;
                    const isLinked = submissaoVinculadas.has(sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setSelectedSubmissaoId(sub.id);
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
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {sub.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
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
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[320px]">
              {!selectedProjetoId ? (
                <p className="text-sm text-muted-foreground text-center py-10">Selecione um projeto acima</p>
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
                  disabled={checkedTarefas.size === 0 || createVinculo.isPending || auditLoading}
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
                            variant={doc.status === "aprovado" ? "default" : "secondary"}
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

      {/* Existing vinculos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Vínculos Existentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allVinculos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum vínculo criado ainda</p>
          ) : (
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
          )}
        </CardContent>
      </Card>

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
