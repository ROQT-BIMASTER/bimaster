import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck, ShieldX, Search, Clock, CheckCircle2, XCircle,
  FileText, FolderOpen, Send, Loader2, Package, Eye,
  Tag, Factory, FlaskConical, Barcode, BookOpen, MessageSquare,
  ClipboardList, Reply, X, ChevronDown, ChevronRight,
  AlertTriangle, StickyNote, RotateCcw, Plus, Trash2, Link2,
} from "lucide-react";

const COFRE_CATEGORIA_LABELS: Record<string, string> = {
  briefing: "Briefing",
  arte_final: "Arte Final",
  rotulo: "Rótulo",
  ficha_tecnica: "Ficha Técnica",
  laudo: "Laudo",
  certificado: "Certificado",
  orcamento: "Orçamento",
  nota_fiscal: "Nota Fiscal",
  art: "ART",
  outro: "Outro",
};

const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  aprovado: { label: "Aprovado", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
  revisao_solicitada: { label: "Revisão", color: "text-amber-600 bg-amber-500/10 border-amber-500/30", icon: AlertTriangle },
  rejeitado: { label: "Rejeitado", color: "text-destructive bg-destructive/10 border-destructive/30", icon: XCircle },
};

export default function ProjetoAprovacaoCadastro() {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [selectedTarefa, setSelectedTarefa] = useState<any | null>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectObs, setRejectObs] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [tabAtiva, setTabAtiva] = useState("fichas");

  const loadTarefas = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("projeto_tarefas")
      .select("*, projeto:projetos(nome, cor)") as any)
      .in("validacao_status", ["pendente_validacao", "validada", "rejeitada"])
      .order("updated_at", { ascending: false });
    setTarefas((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTarefas(); }, [loadTarefas]);

  const loadDocumentos = useCallback(async (tarefaId: string) => {
    const { data: docs } = await supabase
      .from("fabrica_revisao_documentos" as any)
      .select("*")
      .eq("origem_projeto_tarefa_id", tarefaId)
      .order("created_at", { ascending: false });
    setDocumentos((docs as any[]) || []);
  }, []);

  const loadProdutos = useCallback(async (tarefaId: string) => {
    // Load from junction table
    const { data: links } = await supabase
      .from("projeto_tarefa_produtos" as any)
      .select("*")
      .eq("tarefa_id", tarefaId)
      .order("created_at", { ascending: true });

    if (!links || links.length === 0) {
      setProdutos([]);
      return;
    }

    const produtoIds = (links as any[]).map((l: any) => l.produto_id);
    const { data: prods } = await supabase
      .from("fabrica_produtos" as any)
      .select("*")
      .in("id", produtoIds);
    
    // Merge link info with product data
    const produtosComLink = (links as any[]).map((link: any) => {
      const prod = (prods as any[] || []).find((p: any) => p.id === link.produto_id);
      return { ...prod, _linkId: link.id };
    }).filter((p: any) => p.id);

    setProdutos(produtosComLink);
  }, []);

  useEffect(() => {
    if (!selectedTarefa) { setProdutos([]); setDocumentos([]); return; }
    loadProdutos(selectedTarefa.id);
    loadDocumentos(selectedTarefa.id);
  }, [selectedTarefa, loadDocumentos, loadProdutos]);

  const filteredTarefas = tarefas.filter(t =>
    !busca || t.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
    (t.projeto as any)?.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  const pendentes = tarefas.filter(t => (t as any).validacao_status === "pendente_validacao");

  const handleAprovar = async () => {
    if (!user || !selectedTarefa) return;
    if (produtos.length === 0) {
      toast.error("Vincule pelo menos um produto acabado antes de aprovar.");
      return;
    }
    setSubmitting(true);
    try {
      // Validate admin_cofre role before making docs visible to factory
      const { data: canPublish } = await supabase.rpc("can_publish_to_cofre", {
        _user_id: user.id,
        _projeto_id: (selectedTarefa as any).projeto_id,
      });
      if (!canPublish) {
        toast.error("Apenas usuários com papel 'Admin. Cofre' ou 'Coordenador' podem aprovar e liberar documentos.");
        setSubmitting(false);
        return;
      }

      await supabase
        .from("projeto_tarefa_validacoes" as any)
        .update({ status: "aprovada", aprovado_por: user.id, aprovado_em: new Date().toISOString() } as any)
        .eq("tarefa_id", selectedTarefa.id).eq("status", "pendente");
      await supabase
        .from("projeto_tarefas")
        .update({ validacao_status: "validada" } as any)
        .eq("id", selectedTarefa.id);
      await supabase
        .from("fabrica_revisao_documentos" as any)
        .update({ visivel_fabrica: true } as any)
        .eq("origem_projeto_tarefa_id", selectedTarefa.id);
      toast.success("Cadastro aprovado! Documentos visíveis na Fábrica.");
      await loadTarefas();
      setSelectedTarefa(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const handleRejeitar = async () => {
    if (!user || !selectedTarefa || !rejectObs.trim()) {
      toast.error("Informe o motivo da correção."); return;
    }
    setSubmitting(true);
    try {
      await supabase
        .from("projeto_tarefa_validacoes" as any)
        .update({ status: "rejeitada", aprovado_por: user.id, aprovado_em: new Date().toISOString(), observacoes: rejectObs } as any)
        .eq("tarefa_id", selectedTarefa.id).eq("status", "pendente");
      await supabase
        .from("projeto_tarefas")
        .update({ validacao_status: "rejeitada" } as any)
        .eq("id", selectedTarefa.id);
      await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: selectedTarefa.id, user_id: user.id,
        conteudo: `⚠️ **Correção solicitada:** ${rejectObs}`,
      });
      toast.success("Correção solicitada.");
      setRejectObs(""); setShowRejectForm(false);
      await loadTarefas(); setSelectedTarefa(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDocStatusChange = async (docId: string, status: string, obs?: string) => {
    try {
      const metadata = obs ? { observacao_revisao: obs, revisao_em: new Date().toISOString(), revisao_por: user?.id } : undefined;
      await supabase
        .from("fabrica_revisao_documentos" as any)
        .update({
          status,
          ...(metadata ? { metadata } : {}),
          ...(status === "aprovado" ? { aprovado_por: user?.id, aprovado_em: new Date().toISOString() } : {}),
        } as any)
        .eq("id", docId);
      toast.success(status === "aprovado" ? "Documento aprovado" : status === "revisao_solicitada" ? "Revisão solicitada" : "Status atualizado");
      if (selectedTarefa) loadDocumentos(selectedTarefa.id);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddProduto = async (produtoId: string) => {
    if (!user || !selectedTarefa) return;
    try {
      // Check if this product is a China submission and run AI audit
      const { data: chinaSubmissao } = await supabase
        .from("china_produto_submissoes")
        .select("id, produto_codigo, produto_nome, status, formula_codigo, ean_unidade, ean_display, ean_caixa_master, peso_liquido_g, peso_bruto_g, qty_total, observacoes_brasil, observacoes_china")
        .eq("id", produtoId)
        .maybeSingle();

      if (chinaSubmissao) {
        // Run AI audit for China product link
        const { data: auditData, error: auditError } = await supabase.functions.invoke("audit-china-vinculo", {
          body: {
            modo: "tarefa_produto",
            tarefa: {
              titulo: (selectedTarefa as any).titulo,
              descricao: (selectedTarefa as any).descricao,
              estagio: (selectedTarefa as any).estagio,
              secao_nome: (selectedTarefa as any).secao_nome,
              prioridade: (selectedTarefa as any).prioridade,
            },
            submissao: chinaSubmissao,
          },
        });

        if (!auditError && auditData?.match === "baixo") {
          toast.warning(`IA detectou incompatibilidade: ${auditData.motivo}`, { duration: 8000 });
          // Don't block, but warn
        } else if (!auditError && auditData?.match === "medio") {
          toast.info(`IA: ${auditData.motivo}`, { duration: 5000 });
        }
      }

      const { error } = await supabase.from("projeto_tarefa_produtos" as any).insert({
        tarefa_id: selectedTarefa.id,
        produto_id: produtoId,
        created_by: user.id,
      } as any);
      if (error) throw error;
      toast.success("Produto vinculado!");
      loadProdutos(selectedTarefa.id);
    } catch (err: any) {
      if (err.message?.includes("duplicate")) toast.error("Produto já vinculado.");
      else toast.error(err.message);
    }
  };

  const [unlinkConfirm, setUnlinkConfirm] = useState<string | null>(null);
  
  const handleRemoveProduto = async (linkId: string) => {
    try {
      await supabase.from("projeto_tarefa_produtos" as any).delete().eq("id", linkId);
      toast.success("Produto desvinculado.");
      if (selectedTarefa) loadProdutos(selectedTarefa.id);
      setUnlinkConfirm(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const isPending = selectedTarefa && (selectedTarefa as any).validacao_status === "pendente_validacao";

  const statusBadge = (status: string) => {
    switch (status) {
      case "pendente_validacao": return <Badge variant="warning" className="text-[10px] gap-1"><Clock className="h-3 w-3" /> Aguardando</Badge>;
      case "validada": return <Badge variant="success" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> Aprovado</Badge>;
      case "rejeitada": return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-3 w-3" /> Correção</Badge>;
      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Aprovação de Cadastro</h1>
          <p className="text-muted-foreground">Revise tarefas, marque documentos e defina observações</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-primary">{pendentes.length}</p>
          </CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Aprovadas</p>
            <p className="text-2xl font-bold text-emerald-600">{tarefas.filter(t => (t as any).validacao_status === "validada").length}</p>
          </CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Correção</p>
            <p className="text-2xl font-bold text-orange-500">{tarefas.filter(t => (t as any).validacao_status === "rejeitada").length}</p>
          </CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{tarefas.length}</p>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList>
            <TabsTrigger value="fichas" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Tarefas
              {pendentes.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{pendentes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="comunicacao" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Comunicação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fichas" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou projeto..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredTarefas.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
                {busca ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa pendente"}
              </CardContent></Card>
            ) : (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Tarefas ({filteredTarefas.length})</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarefa</TableHead>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Atualizado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTarefas.map((t: any) => (
                        <TableRow key={t.id} className={selectedTarefa?.id === t.id ? "bg-primary/5" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: (t.projeto as any)?.cor || "hsl(var(--muted))" }} />
                              {t.titulo}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{(t.projeto as any)?.nome}</TableCell>
                          <TableCell>{statusBadge(t.validacao_status)}</TableCell>
                          <TableCell className="text-sm">{t.updated_at ? format(new Date(t.updated_at), "dd/MM/yy HH:mm") : "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant={selectedTarefa?.id === t.id ? "default" : "outline"} onClick={() => {
                              setSelectedTarefa(selectedTarefa?.id === t.id ? null : t);
                              setShowRejectForm(false); setRejectObs("");
                            }}>
                              <Eye className="h-4 w-4 mr-1" /> {selectedTarefa?.id === t.id ? "Fechar" : "Analisar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Inline Analysis Panel */}
            {selectedTarefa && (
              <AprovacaoAnalisePanel
                tarefa={selectedTarefa}
                produtos={produtos}
                documentos={documentos}
                isPending={!!isPending}
                submitting={submitting}
                showRejectForm={showRejectForm}
                rejectObs={rejectObs}
                onRejectObsChange={setRejectObs}
                onShowRejectForm={setShowRejectForm}
                onAprovar={handleAprovar}
                onRejeitar={handleRejeitar}
                onDocStatusChange={handleDocStatusChange}
                onAddProduto={handleAddProduto}
                onRemoveProduto={handleRemoveProduto}
                onClose={() => { setSelectedTarefa(null); setShowRejectForm(false); setRejectObs(""); }}
              />
            )}
          </TabsContent>

          <TabsContent value="comunicacao" className="mt-4">
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
              Selecione uma tarefa e clique em "Analisar" para acessar o chat.
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ─── Inline Analysis Panel ───────────────────────────────────────────────────

interface AprovacaoAnalisePanelProps {
  tarefa: any;
  produtos: any[];
  documentos: any[];
  isPending: boolean;
  submitting: boolean;
  showRejectForm: boolean;
  rejectObs: string;
  onRejectObsChange: (v: string) => void;
  onShowRejectForm: (v: boolean) => void;
  onAprovar: () => void;
  onRejeitar: () => void;
  onDocStatusChange: (docId: string, status: string, obs?: string) => void;
  onAddProduto: (produtoId: string) => void;
  onRemoveProduto: (linkId: string) => void;
  onClose: () => void;
}

function AprovacaoAnalisePanel({
  tarefa, produtos, documentos, isPending, submitting,
  showRejectForm, rejectObs, onRejectObsChange, onShowRejectForm,
  onAprovar, onRejeitar, onDocStatusChange, onAddProduto, onRemoveProduto, onClose,
}: AprovacaoAnalisePanelProps) {

  const docsByCategoria = documentos.reduce((acc: Record<string, any[]>, doc: any) => {
    const cat = doc.categoria || "outro";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const allApproved = documentos.length > 0 && documentos.every(d => d.status === "aprovado");
  const hasRevisionPending = documentos.some(d => d.status === "revisao_solicitada");
  const hasProdutos = produtos.length > 0;
  const canApprove = allApproved && hasProdutos;

  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden">
      <CardHeader className="pb-2 flex-row items-center justify-between bg-primary/5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">{tarefa.titulo}</CardTitle>
            <p className="text-xs text-muted-foreground">{(tarefa.projeto as any)?.nome}</p>
          </div>
          {allApproved && <Badge variant="success" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> Docs OK</Badge>}
          {hasRevisionPending && <Badge variant="warning" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Revisão pendente</Badge>}
          {!hasProdutos && isPending && (
            <Badge variant="destructive" className="text-[10px] gap-1"><Package className="h-3 w-3" /> Sem produto</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="p-0">
        <ResizablePanelGroup direction="horizontal" className="min-h-[650px]">
          {/* Left: Details + Docs + Actions */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <ScrollArea className="h-[650px]">
              <div className="p-6 space-y-6">
                {/* Linked Products Section */}
                <ProdutosVinculadosSection
                  produtos={produtos}
                  isPending={isPending}
                  onAddProduto={onAddProduto}
                  onRemoveProduto={onRemoveProduto}
                />

                <Separator />

                {/* Interactive Document Review */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <FolderOpen className="h-4 w-4 text-primary" /> Documentos do Cofre
                      <Badge variant="ghost" className="text-[10px]">{documentos.length}</Badge>
                    </h3>
                    {isPending && documentos.length > 0 && (
                      <Button
                        variant="outline" size="sm" className="text-xs gap-1.5"
                        onClick={() => {
                          documentos.forEach(d => { if (d.status !== "aprovado") onDocStatusChange(d.id, "aprovado"); });
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar Todos
                      </Button>
                    )}
                  </div>

                  {documentos.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento vinculado.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(docsByCategoria).map(([cat, docs]: [string, any[]]) => (
                        <DocumentCategoryGroup
                          key={cat}
                          categoria={cat}
                          docs={docs}
                          isPending={isPending}
                          onDocStatusChange={onDocStatusChange}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Task-level action buttons */}
                {isPending && (
                  <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2" style={{ color: "hsl(var(--warning))" }}>
                      <Clock className="h-4 w-4" /> Parecer Final
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {!hasProdutos
                        ? "🔗 Vincule pelo menos um produto acabado da Fábrica antes de aprovar."
                        : allApproved
                          ? "✅ Todos os documentos foram aprovados. Você pode aprovar o cadastro."
                          : hasRevisionPending
                            ? "⚠️ Existem documentos com revisão solicitada. Revise-os antes de aprovar."
                            : "Marque os documentos como aprovados ou solicite revisão antes de dar o parecer final."
                      }
                    </p>

                    {!showRejectForm ? (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={onAprovar} disabled={submitting || !canApprove}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs" size="sm"
                          title={!hasProdutos ? "Vincule pelo menos um produto para aprovar" : !allApproved ? "Aprove todos os documentos primeiro" : ""}
                        >
                          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          Aprovar Cadastro
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive border-destructive/30"
                          onClick={() => onShowRejectForm(true)} disabled={submitting}
                        >
                          <ShieldX className="h-3.5 w-3.5" /> Solicitar Correção
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea value={rejectObs} onChange={e => onRejectObsChange(e.target.value)}
                          placeholder="Descreva o que precisa ser corrigido na tarefa..." className="min-h-[60px] text-xs" />
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="destructive" className="text-xs gap-1.5"
                            onClick={onRejeitar} disabled={submitting || !rejectObs.trim()}
                          >
                            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
                            Confirmar Rejeição
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => { onShowRejectForm(false); onRejectObsChange(""); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Chat */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <AprovacaoChatPanel tarefaId={tarefa.id} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </CardContent>
    </Card>
  );
}

// ─── Produtos Vinculados Section ─────────────────────────────────────────────

function ProdutosVinculadosSection({
  produtos, isPending, onAddProduto, onRemoveProduto,
}: {
  produtos: any[];
  isPending: boolean;
  onAddProduto: (produtoId: string) => void;
  onRemoveProduto: (linkId: string) => void;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [unlinkProdutoId, setUnlinkProdutoId] = useState<string | null>(null);

  const linkedIds = new Set(produtos.map(p => p.id));

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("fabrica_produtos" as any)
      .select("id, codigo, nome, marca, linha, tipo, foto_url")
      .eq("ativo", true)
      .or(`nome.ilike.%${query}%,codigo.ilike.%${query}%`)
      .order("nome")
      .limit(10);
    setSearchResults((data as any[]) || []);
    setSearching(false);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Package className="h-4 w-4 text-primary" /> Produtos Acabados Vinculados
          <Badge variant="ghost" className="text-[10px]">{produtos.length}</Badge>
        </h3>
        {isPending && (
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setShowSearch(!showSearch)}>
            <Plus className="h-3.5 w-3.5" /> Vincular Produto
          </Button>
        )}
      </div>

      {/* Search box */}
      {showSearch && (
        <div className="border border-primary/30 rounded-lg p-3 bg-primary/5 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar produto por nome ou código..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
              autoFocus
            />
          </div>
          {searching && <div className="text-xs text-muted-foreground text-center py-2"><Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> Buscando...</div>}
          {searchResults.length > 0 && (
            <div className="max-h-[180px] overflow-y-auto divide-y divide-border/30">
              {searchResults.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5 px-1">
                  {p.foto_url ? (
                    <img src={p.foto_url} className="h-8 w-8 rounded object-cover shrink-0" alt="" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{p.codigo} · {p.marca} {p.linha ? `/ ${p.linha}` : ""}</p>
                  </div>
                  {linkedIds.has(p.id) ? (
                    <Badge variant="outline" className="text-[9px] text-muted-foreground">Vinculado</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary" onClick={() => { onAddProduto(p.id); }}>
                      <Link2 className="h-3 w-3" /> Vincular
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {searchQuery.length > 0 && searchResults.length === 0 && !searching && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum produto encontrado.</p>
          )}
        </div>
      )}

      {/* Linked products list */}
      {produtos.length === 0 ? (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-center">
          <Package className="h-6 w-6 mx-auto mb-1.5 text-destructive/50" />
          <p className="text-xs text-destructive/80 font-medium">Nenhum produto vinculado</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            É obrigatório vincular pelo menos um produto acabado para aprovar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {produtos.map((p: any) => (
            <div key={p._linkId} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
              {p.foto_url ? (
                <img src={p.foto_url} className="h-10 w-10 rounded object-cover shrink-0" alt="" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{p.nome_comercial || p.nome}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{p.codigo}</span>
                  {p.marca && <span>· {p.marca}</span>}
                  {p.linha && <span>/ {p.linha}</span>}
                  {p.tipo && <Badge variant="outline" className="text-[9px] h-4">{p.tipo}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                  {p.sku && <span><Barcode className="h-2.5 w-2.5 inline mr-0.5" />{p.sku}</span>}
                  {p.processo_anvisa && <span><BookOpen className="h-2.5 w-2.5 inline mr-0.5" />{p.processo_anvisa}</span>}
                  {p.fabricante && <span><Factory className="h-2.5 w-2.5 inline mr-0.5" />{p.fabricante}</span>}
                </div>
              </div>
              {isPending && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => onRemoveProduto(p._linkId)} title="Desvincular produto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unlink confirmation AlertDialog */}
      <AlertDialog open={!!unlinkProdutoId} onOpenChange={() => setUnlinkProdutoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto será desvinculado desta tarefa. Esta ação será registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlinkProdutoId && onRemoveProduto(unlinkProdutoId)}>
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Document Category Group ────────────────────────────────────────────────

function DocumentCategoryGroup({
  categoria, docs, isPending, onDocStatusChange,
}: {
  categoria: string;
  docs: any[];
  isPending: boolean;
  onDocStatusChange: (docId: string, status: string, obs?: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const approvedCount = docs.filter(d => d.status === "aprovado").length;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 p-3 hover:bg-accent/30 transition-colors text-left">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <Badge variant="outline" className="text-[10px]">
              {COFRE_CATEGORIA_LABELS[categoria] || categoria}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{docs.length} doc{docs.length > 1 ? "s" : ""}</span>
            {approvedCount > 0 && (
              <Badge variant="success" className="text-[9px] ml-auto gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" /> {approvedCount}/{docs.length}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/30 divide-y divide-border/20">
            {docs.map(doc => (
              <DocumentReviewRow key={doc.id} doc={doc} isPending={isPending} onStatusChange={onDocStatusChange} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Single Document Review Row ──────────────────────────────────────────────

function DocumentReviewRow({
  doc, isPending, onStatusChange,
}: {
  doc: any;
  isPending: boolean;
  onStatusChange: (docId: string, status: string, obs?: string) => void;
}) {
  const [showObsInput, setShowObsInput] = useState(false);
  const [obsText, setObsText] = useState("");
  const isApproved = doc.status === "aprovado";
  const isRevision = doc.status === "revisao_solicitada";
  const statusConfig = DOC_STATUS_CONFIG[doc.status];
  const existingObs = (doc.metadata as any)?.observacao_revisao;

  return (
    <div className="px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2">
        {isPending && (
          <Checkbox
            checked={isApproved}
            onCheckedChange={(checked) => {
              onStatusChange(doc.id, checked ? "aprovado" : "pendente");
            }}
            className="shrink-0"
          />
        )}
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-foreground truncate flex-1">{doc.nome_arquivo}</span>

        {statusConfig && (
          <Badge variant="outline" className={`text-[9px] gap-0.5 ${statusConfig.color}`}>
            <statusConfig.icon className="h-2.5 w-2.5" />
            {statusConfig.label}
          </Badge>
        )}

        {isPending && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Adicionar observação"
              onClick={() => setShowObsInput(!showObsInput)}
            >
              <StickyNote className="h-3 w-3 text-muted-foreground" />
            </Button>
            {!isRevision && (
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Solicitar revisão deste documento"
                onClick={() => setShowObsInput(true)}
              >
                <RotateCcw className="h-3 w-3 text-amber-500" />
              </Button>
            )}
          </div>
        )}
      </div>

      {existingObs && !showObsInput && (
        <div className="ml-7 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
            <StickyNote className="h-2.5 w-2.5" /> Observação do revisor
          </p>
          <p className="text-xs text-foreground/80">{existingObs}</p>
        </div>
      )}

      {showObsInput && (
        <div className="ml-7 space-y-1.5">
          <Textarea value={obsText} onChange={e => setObsText(e.target.value)}
            placeholder="Observação sobre este documento..." className="min-h-[40px] text-xs" autoFocus
          />
          <div className="flex items-center gap-1.5">
            <Button size="sm" className="text-xs h-7 gap-1 bg-amber-600 hover:bg-amber-700"
              onClick={() => { onStatusChange(doc.id, "revisao_solicitada", obsText); setShowObsInput(false); setObsText(""); }}
              disabled={!obsText.trim()}
            >
              <RotateCcw className="h-3 w-3" /> Solicitar Revisão
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
              onClick={() => { onStatusChange(doc.id, doc.status || "pendente", obsText); setShowObsInput(false); setObsText(""); }}
              disabled={!obsText.trim()}
            >
              <StickyNote className="h-3 w-3" /> Salvar Observação
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setShowObsInput(false); setObsText(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Professional Chat Panel ─────────────────────────────────────────────────

function AprovacaoChatPanel({ tarefaId }: { tarefaId: string }) {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { nome: string; avatar_url?: string }>>({});
  const [novoComentario, setNovoComentario] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projeto_tarefa_comentarios").select("*")
      .eq("tarefa_id", tarefaId).order("created_at", { ascending: true });
    const comments = data || [];
    setComentarios(comments);
    const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  }, [tarefaId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  // Realtime subscription for approval chat
  useEffect(() => {
    if (!tarefaId) return;
    const channel = supabase
      .channel(`aprovacao-chat-${tarefaId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "projeto_tarefa_comentarios",
        filter: `tarefa_id=eq.${tarefaId}`,
      }, () => {
        loadComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tarefaId, loadComments]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [comentarios]);

  const handleSend = async () => {
    if (!user || !novoComentario.trim()) return;
    setSending(true);
    try {
      const content = replyTo
        ? `> ${profiles[replyTo.user_id]?.nome || "Usuário"}: ${replyTo.conteudo.slice(0, 80)}${replyTo.conteudo.length > 80 ? "…" : ""}\n\n${novoComentario.trim()}`
        : novoComentario.trim();
      const { data } = await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: tarefaId, user_id: user.id, conteudo: content,
      }).select().single();
      if (data) setComentarios(prev => [...prev, data]);
      setNovoComentario(""); setReplyTo(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setSending(false); }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, "'Hoje' HH:mm", { locale: ptBR });
    if (isYesterday(d)) return format(d, "'Ontem' HH:mm", { locale: ptBR });
    return format(d, "dd/MM HH:mm", { locale: ptBR });
  };

  const getInitials = (name: string) =>
    name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-col h-[650px] bg-muted/10">
      <div className="px-4 py-3 border-b border-border/50 bg-card">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Parecer / Observações
        </h3>
        <p className="text-[10px] text-muted-foreground">{comentarios.length} mensagen{comentarios.length !== 1 ? "s" : ""}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : comentarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">Nenhum comentário ainda</p>
            <p className="text-[10px]">Inicie uma conversa sobre esta aprovação</p>
          </div>
        ) : (
          comentarios.map(c => {
            const isMe = c.user_id === user?.id;
            const profile = profiles[c.user_id];
            const nome = profile?.nome || "Usuário";
            const hasQuote = c.conteudo?.startsWith("> ");
            let quotedText = "", mainText = c.conteudo;
            if (hasQuote) {
              const parts = c.conteudo.split("\n\n");
              quotedText = parts[0]?.replace(/^> /, "") || "";
              mainText = parts.slice(1).join("\n\n");
            }

            return (
              <div key={c.id} className={`flex gap-2 group ${isMe ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className={`text-[10px] ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {getInitials(nome)}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] space-y-0.5 ${isMe ? "items-end" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    {!isMe && <span className="text-[10px] font-medium text-foreground">{nome}</span>}
                    <span className="text-[9px] text-muted-foreground">{formatTime(c.created_at)}</span>
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-xs relative ${
                    isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border/50 text-foreground rounded-tl-sm"
                  }`}>
                    {hasQuote && (
                      <div className={`text-[10px] mb-1.5 pl-2 border-l-2 ${isMe ? "border-primary-foreground/40 opacity-70" : "border-primary/40 text-muted-foreground"}`}>
                        {quotedText}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{mainText}</p>
                  </div>
                  <button onClick={() => setReplyTo(c)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
                  >
                    <Reply className="h-3 w-3" /> Responder
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {replyTo && (
        <div className="px-3 py-1.5 border-t border-border/30 bg-muted/30 flex items-center gap-2">
          <Reply className="h-3 w-3 text-primary shrink-0" />
          <p className="text-[10px] text-muted-foreground truncate flex-1">
            Respondendo a <span className="font-medium text-foreground">{profiles[replyTo.user_id]?.nome || "Usuário"}</span>
          </p>
          <button onClick={() => setReplyTo(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      )}

      <div className="p-3 border-t border-border/50 bg-card">
        <div className="flex items-center gap-2">
          <Textarea value={novoComentario} onChange={e => setNovoComentario(e.target.value)}
            placeholder="Escreva um parecer..." className="min-h-[36px] max-h-[100px] text-xs flex-1 resize-none"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={sending || !novoComentario.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
