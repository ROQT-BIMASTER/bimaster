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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ClipboardList, Reply, X,
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

export default function ProjetoAprovacaoCadastro() {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [selectedTarefa, setSelectedTarefa] = useState<any | null>(null);
  const [produto, setProduto] = useState<any | null>(null);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectObs, setRejectObs] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [tabAtiva, setTabAtiva] = useState("fichas");

  // Load tasks with validation status
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

  // Load product + docs when task selected
  useEffect(() => {
    if (!selectedTarefa) { setProduto(null); setDocumentos([]); return; }
    const load = async () => {
      if (selectedTarefa.produto_id) {
        const { data: prod } = await supabase
          .from("fabrica_produtos")
          .select("*")
          .eq("id", selectedTarefa.produto_id)
          .single();
        setProduto(prod);
      } else { setProduto(null); }

      const { data: docs } = await supabase
        .from("fabrica_revisao_documentos" as any)
        .select("*")
        .eq("origem_projeto_tarefa_id", selectedTarefa.id)
        .order("created_at", { ascending: false });
      setDocumentos((docs as any[]) || []);
    };
    load();
  }, [selectedTarefa]);

  const filteredTarefas = tarefas.filter(t =>
    !busca || t.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
    (t.projeto as any)?.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  const pendentes = tarefas.filter(t => (t as any).validacao_status === "pendente_validacao");

  const docsByCategoria = documentos.reduce((acc: Record<string, any[]>, doc: any) => {
    const cat = doc.categoria || "outro";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const handleAprovar = async () => {
    if (!user || !selectedTarefa) return;
    setSubmitting(true);
    try {
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
      toast.error("Informe o motivo da correção.");
      return;
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
        tarefa_id: selectedTarefa.id,
        user_id: user.id,
        conteudo: `⚠️ **Correção solicitada:** ${rejectObs}`,
      });
      toast.success("Correção solicitada.");
      setRejectObs(""); setShowRejectForm(false);
      await loadTarefas();
      setSelectedTarefa(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
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
          <p className="text-muted-foreground">Revise e aprove tarefas finalizadas com documentos do Cofre</p>
        </div>

        {/* KPIs Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-primary">{pendentes.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Aprovadas</p>
              <p className="text-2xl font-bold text-emerald-600">{tarefas.filter(t => (t as any).validacao_status === "validada").length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Correção Solicitada</p>
              <p className="text-2xl font-bold text-orange-500">{tarefas.filter(t => (t as any).validacao_status === "rejeitada").length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">{tarefas.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList>
            <TabsTrigger value="fichas" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Tarefas Pendentes
              {pendentes.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{pendentes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="comunicacao" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Comunicação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fichas" className="mt-4 space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou projeto..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTarefas.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  {busca ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa pendente de aprovação"}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tarefas ({filteredTarefas.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarefa</TableHead>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Atualizado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTarefas.map((t: any) => (
                        <TableRow
                          key={t.id}
                          className={selectedTarefa?.id === t.id ? "bg-primary/5" : ""}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: (t.projeto as any)?.cor || "hsl(var(--muted))" }}
                              />
                              {t.titulo}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{(t.projeto as any)?.nome}</TableCell>
                          <TableCell>{statusBadge(t.validacao_status)}</TableCell>
                          <TableCell className="text-sm">
                            {t.updated_at ? format(new Date(t.updated_at), "dd/MM/yy HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={selectedTarefa?.id === t.id ? "default" : "outline"}
                              onClick={() => {
                                setSelectedTarefa(selectedTarefa?.id === t.id ? null : t);
                                setShowRejectForm(false);
                                setRejectObs("");
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {selectedTarefa?.id === t.id ? "Fechar" : "Analisar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Painel de Análise Inline — split screen */}
            {selectedTarefa && (
              <AprovacaoAnalisePanel
                tarefa={selectedTarefa}
                produto={produto}
                documentos={documentos}
                docsByCategoria={docsByCategoria}
                isPending={!!isPending}
                submitting={submitting}
                showRejectForm={showRejectForm}
                rejectObs={rejectObs}
                onRejectObsChange={setRejectObs}
                onShowRejectForm={setShowRejectForm}
                onAprovar={handleAprovar}
                onRejeitar={handleRejeitar}
                onClose={() => { setSelectedTarefa(null); setShowRejectForm(false); setRejectObs(""); }}
              />
            )}
          </TabsContent>

          <TabsContent value="comunicacao" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                Selecione uma tarefa na aba "Tarefas Pendentes" e clique em "Analisar" para acessar o chat.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ─── Inline Analysis Panel (split-screen: details + chat) ────────────────────

interface AprovacaoAnalisePanelProps {
  tarefa: any;
  produto: any;
  documentos: any[];
  docsByCategoria: Record<string, any[]>;
  isPending: boolean;
  submitting: boolean;
  showRejectForm: boolean;
  rejectObs: string;
  onRejectObsChange: (v: string) => void;
  onShowRejectForm: (v: boolean) => void;
  onAprovar: () => void;
  onRejeitar: () => void;
  onClose: () => void;
}

function AprovacaoAnalisePanel({
  tarefa, produto, documentos, docsByCategoria, isPending,
  submitting, showRejectForm, rejectObs, onRejectObsChange,
  onShowRejectForm, onAprovar, onRejeitar, onClose,
}: AprovacaoAnalisePanelProps) {
  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden">
      <CardHeader className="pb-2 flex-row items-center justify-between bg-primary/5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">{tarefa.titulo}</CardTitle>
            <p className="text-xs text-muted-foreground">{(tarefa.projeto as any)?.nome}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ResizablePanelGroup direction="horizontal" className="min-h-[600px]">
          {/* Left: Details + Action */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <ScrollArea className="h-[600px]">
              <div className="p-6 space-y-6">
                {/* Product data */}
                {produto ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Package className="h-4 w-4 text-primary" /> Dados Técnicos do Produto
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-muted/30 rounded-lg p-4">
                      <InfoRow icon={Tag} label="Nome Comercial" value={produto.nome_comercial || produto.nome} />
                      <InfoRow icon={Barcode} label="SKU" value={produto.sku} />
                      <InfoRow icon={BookOpen} label="Processo ANVISA" value={produto.processo_anvisa} />
                      <InfoRow icon={Factory} label="Fabricante" value={produto.fabricante} />
                      <InfoRow icon={Tag} label="Categoria" value={produto.categoria} />
                      <InfoRow icon={Tag} label="Marca / Linha" value={[produto.marca, produto.linha].filter(Boolean).join(" / ")} />
                    </div>
                    {produto.descricao_completa && (
                      <div className="bg-muted/30 rounded-lg p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                          <FlaskConical className="h-3.5 w-3.5" /> Composição / Descrição Completa
                        </p>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap">{produto.descricao_completa}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum produto vinculado a esta tarefa.</p>
                  </div>
                )}

                <Separator />

                {/* Cofre documents */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <FolderOpen className="h-4 w-4 text-primary" /> Documentos do Cofre
                    <Badge variant="ghost" className="text-[10px]">{documentos.length}</Badge>
                  </h3>
                  {documentos.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento vinculado.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(docsByCategoria).map(([cat, docs]: [string, any[]]) => (
                        <div key={cat} className="border border-border/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[10px]">
                              {COFRE_CATEGORIA_LABELS[cat] || cat}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{docs.length} doc{docs.length > 1 ? "s" : ""}</span>
                          </div>
                          <div className="space-y-1">
                            {docs.map((doc: any) => (
                              <div key={doc.id} className="flex items-center gap-2 text-xs text-foreground/80">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{doc.nome_arquivo}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Action buttons */}
                {isPending && (
                  <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2" style={{ color: "hsl(var(--warning))" }}>
                      <Clock className="h-4 w-4" /> Parecer de Aprovação
                    </p>

                    {!showRejectForm ? (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={onAprovar}
                          disabled={submitting}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
                          size="sm"
                        >
                          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          Aprovar Cadastro
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-destructive border-destructive/30"
                          onClick={() => onShowRejectForm(true)}
                          disabled={submitting}
                        >
                          <ShieldX className="h-3.5 w-3.5" /> Solicitar Correção
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          value={rejectObs}
                          onChange={e => onRejectObsChange(e.target.value)}
                          placeholder="Descreva o que precisa ser corrigido..."
                          className="min-h-[60px] text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm" variant="destructive" className="text-xs gap-1.5"
                            onClick={onRejeitar}
                            disabled={submitting || !rejectObs.trim()}
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

          {/* Right: Inline Chat */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <AprovacaoChatPanel tarefaId={tarefa.id} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </CardContent>
    </Card>
  );
}

// ─── InfoRow helper ──────────────────────────────────────────────────────────

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

// ─── Professional Chat Panel (WhatsApp-style) ────────────────────────────────

function AprovacaoChatPanel({ tarefaId }: { tarefaId: string }) {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { nome: string; avatar_url?: string }>>({});
  const [novoComentario, setNovoComentario] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load comments
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("projeto_tarefa_comentarios")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: true });
      const comments = data || [];
      setComentarios(comments);

      // Load profiles
      const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", userIds);
        const map: Record<string, any> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p; });
        setProfiles(map);
      }
      setLoading(false);
    };
    load();
  }, [tarefaId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comentarios]);

  const handleSend = async () => {
    if (!user || !novoComentario.trim()) return;
    setSending(true);
    try {
      const { data } = await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: tarefaId,
        user_id: user.id,
        conteudo: replyTo
          ? `> ${profiles[replyTo.user_id]?.nome || "Usuário"}: ${replyTo.conteudo.slice(0, 80)}${replyTo.conteudo.length > 80 ? "…" : ""}\n\n${novoComentario.trim()}`
          : novoComentario.trim(),
      }).select().single();
      if (data) setComentarios(prev => [...prev, data]);
      setNovoComentario("");
      setReplyTo(null);
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
    <div className="flex flex-col h-[600px] bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-card">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Parecer / Observações
        </h3>
        <p className="text-[10px] text-muted-foreground">{comentarios.length} mensagen{comentarios.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Messages */}
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

            // Check for quoted reply
            const hasQuote = c.conteudo?.startsWith("> ");
            let quotedText = "";
            let mainText = c.conteudo;
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
                  <div
                    className={`rounded-xl px-3 py-2 text-xs relative ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border/50 text-foreground rounded-tl-sm"
                    }`}
                  >
                    {hasQuote && (
                      <div className={`text-[10px] mb-1.5 pl-2 border-l-2 ${isMe ? "border-primary-foreground/40 opacity-70" : "border-primary/40 text-muted-foreground"}`}>
                        {quotedText}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{mainText}</p>
                  </div>
                  {/* Reply button */}
                  <button
                    onClick={() => setReplyTo(c)}
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

      {/* Reply indicator */}
      {replyTo && (
        <div className="px-3 py-1.5 border-t border-border/30 bg-muted/30 flex items-center gap-2">
          <Reply className="h-3 w-3 text-primary shrink-0" />
          <p className="text-[10px] text-muted-foreground truncate flex-1">
            Respondendo a <span className="font-medium text-foreground">{profiles[replyTo.user_id]?.nome || "Usuário"}</span>
          </p>
          <button onClick={() => setReplyTo(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border/50 bg-card">
        <div className="flex items-center gap-2">
          <Textarea
            value={novoComentario}
            onChange={e => setNovoComentario(e.target.value)}
            placeholder="Escreva um parecer..."
            className="min-h-[36px] max-h-[100px] text-xs flex-1 resize-none"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={sending || !novoComentario.trim()}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
