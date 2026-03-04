import { useState, useEffect, useCallback } from "react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck, ShieldX, Search, Clock, CheckCircle2, XCircle,
  FileText, FolderOpen, Send, Loader2, ArrowLeft, Package,
  Tag, Factory, FlaskConical, Barcode, BookOpen
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pendente_validacao: { label: "Aguardando", icon: Clock, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  validada: { label: "Aprovado", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  rejeitada: { label: "Correção", icon: XCircle, color: "text-destructive bg-destructive/10 border-destructive/30" },
};

export default function ProjetoAprovacaoCadastro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [selectedTarefa, setSelectedTarefa] = useState<any | null>(null);
  const [produto, setProduto] = useState<any | null>(null);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectObs, setRejectObs] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  // Load pending tasks
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

  // Load product + docs + comments when task selected
  useEffect(() => {
    if (!selectedTarefa) {
      setProduto(null);
      setDocumentos([]);
      setComentarios([]);
      return;
    }

    const loadDetails = async () => {
      // Load product
      if (selectedTarefa.produto_id) {
        const { data: prod } = await supabase
          .from("fabrica_produtos")
          .select("*")
          .eq("id", selectedTarefa.produto_id)
          .single();
        setProduto(prod);
      } else {
        setProduto(null);
      }

      // Load cofre docs
      const { data: docs } = await supabase
        .from("fabrica_revisao_documentos" as any)
        .select("*")
        .eq("origem_projeto_tarefa_id", selectedTarefa.id)
        .order("created_at", { ascending: false });
      setDocumentos((docs as any[]) || []);

      // Load comments
      const { data: comments } = await supabase
        .from("projeto_tarefa_comentarios")
        .select("*")
        .eq("tarefa_id", selectedTarefa.id)
        .order("created_at", { ascending: true });
      setComentarios(comments || []);
    };

    loadDetails();
  }, [selectedTarefa]);

  const filteredTarefas = tarefas.filter(t =>
    !search || t.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    (t.projeto as any)?.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = tarefas.filter(t => (t as any).validacao_status === "pendente_validacao").length;

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
        .update({
          status: "aprovada",
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        } as any)
        .eq("tarefa_id", selectedTarefa.id)
        .eq("status", "pendente");

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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
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
        .update({
          status: "rejeitada",
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
          observacoes: rejectObs,
        } as any)
        .eq("tarefa_id", selectedTarefa.id)
        .eq("status", "pendente");

      await supabase
        .from("projeto_tarefas")
        .update({ validacao_status: "rejeitada" } as any)
        .eq("id", selectedTarefa.id);

      // Add comment with rejection reason
      await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: selectedTarefa.id,
        user_id: user.id,
        conteudo: `⚠️ **Correção solicitada:** ${rejectObs}`,
      });

      toast.success("Correção solicitada.");
      setRejectObs("");
      setShowRejectForm(false);
      await loadTarefas();
      setSelectedTarefa(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    if (!user || !selectedTarefa || !novoComentario.trim()) return;
    setSendingComment(true);
    try {
      const { data } = await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: selectedTarefa.id,
        user_id: user.id,
        conteudo: novoComentario.trim(),
      }).select().single();
      if (data) setComentarios(prev => [...prev, data]);
      setNovoComentario("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingComment(false);
    }
  };

  const isPending = selectedTarefa && (selectedTarefa as any).validacao_status === "pendente_validacao";

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-card/50">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/projetos")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Aprovação de Cadastro</h1>
        {pendingCount > 0 && (
          <Badge variant="warning" className="text-xs">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
        )}
      </div>

      {/* 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT — Task list */}
        <div className="w-80 border-r border-border/50 flex flex-col bg-muted/20">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar tarefa ou projeto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 pb-2 space-y-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTarefas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma tarefa encontrada.</p>
              ) : (
                filteredTarefas.map(t => {
                  const status = STATUS_CONFIG[(t as any).validacao_status] || STATUS_CONFIG.pendente_validacao;
                  const StatusIcon = status.icon;
                  const isSelected = selectedTarefa?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTarefa(t); setShowRejectForm(false); setRejectObs(""); }}
                      className={`w-full text-left p-3 rounded-lg transition-all text-sm ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-accent/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: (t.projeto as any)?.cor || "hsl(var(--muted))" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-foreground">{t.titulo}</p>
                          <p className="text-xs text-muted-foreground truncate">{(t.projeto as any)?.nome}</p>
                          <div className="mt-1.5">
                            <Badge variant="outline" className={`text-[10px] gap-1 ${status.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* CENTER — Product data + docs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedTarefa ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <ShieldCheck className="h-12 w-12 mx-auto opacity-30" />
                <p className="text-sm">Selecione uma tarefa para revisar</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6 max-w-3xl">
                {/* Task info */}
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedTarefa.titulo}</h2>
                  {selectedTarefa.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedTarefa.descricao}</p>
                  )}
                </div>

                {/* Product data */}
                {produto ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Dados Técnicos do Produto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <InfoRow icon={Tag} label="Nome Comercial" value={produto.nome_comercial || produto.nome} />
                        <InfoRow icon={Barcode} label="SKU" value={produto.sku} />
                        <InfoRow icon={BookOpen} label="Processo ANVISA" value={produto.processo_anvisa} />
                        <InfoRow icon={Factory} label="Fabricante" value={produto.fabricante} />
                        <InfoRow icon={Tag} label="Categoria" value={produto.categoria} />
                        <InfoRow icon={Tag} label="Marca / Linha" value={[produto.marca, produto.linha].filter(Boolean).join(" / ")} />
                      </div>
                      {produto.descricao_completa && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                              <FlaskConical className="h-3.5 w-3.5" /> Composição / Descrição Completa
                            </p>
                            <p className="text-xs text-foreground/80 whitespace-pre-wrap">{produto.descricao_completa}</p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-6">
                      <p className="text-sm text-muted-foreground text-center">Nenhum produto vinculado a esta tarefa.</p>
                    </CardContent>
                  </Card>
                )}

                {/* Cofre documents */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      Documentos do Cofre
                      <Badge variant="ghost" className="text-[10px]">{documentos.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documentos.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento vinculado.</p>
                    ) : (
                      <div className="space-y-3">
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
                  </CardContent>
                </Card>

                {/* Action buttons */}
                {isPending && (
                  <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-amber-400 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Parecer de Aprovação
                    </p>

                    {!showRejectForm ? (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleAprovar}
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
                          onClick={() => setShowRejectForm(true)}
                          disabled={submitting}
                        >
                          <ShieldX className="h-3.5 w-3.5" /> Solicitar Correção
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          value={rejectObs}
                          onChange={e => setRejectObs(e.target.value)}
                          placeholder="Descreva o que precisa ser corrigido..."
                          className="min-h-[60px] text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs gap-1.5"
                            onClick={handleRejeitar}
                            disabled={submitting || !rejectObs.trim()}
                          >
                            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
                            Confirmar Rejeição
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setShowRejectForm(false); setRejectObs(""); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* RIGHT — Comments / Parecer */}
        <div className="w-80 border-l border-border/50 flex flex-col bg-muted/20">
          <div className="px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">Parecer / Observações</h3>
          </div>

          {selectedTarefa ? (
            <>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  {comentarios.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum comentário ainda.</p>
                  ) : (
                    comentarios.map(c => (
                      <div key={c.id} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary">U</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 pl-6 whitespace-pre-wrap">{c.conteudo}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Input
                    value={novoComentario}
                    onChange={e => setNovoComentario(e.target.value)}
                    placeholder="Adicionar parecer..."
                    className="h-8 text-xs flex-1"
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendComment()}
                  />
                  <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSendComment} disabled={sendingComment || !novoComentario.trim()}>
                    {sendingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Selecione uma tarefa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
