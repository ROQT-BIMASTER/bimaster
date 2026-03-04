import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ProjetoTarefa, ProjetoSecao as ProjetoSecaoType } from "@/hooks/useProjetoTarefas";
import { useProjetoTarefaDetalhe, ProdutoAcabado } from "@/hooks/useProjetoTarefaDetalhe";
import { MentionInput } from "./MentionInput";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { DisplayGradePopover } from "@/components/fabrica/DisplayGradePopover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Circle, CalendarIcon, Paperclip, MessageSquare,
  Send, Upload, FileText, Image, File, Trash2, Download,
  Package, FolderOpen, MessageCircle, Search, X, ArrowRightLeft, Plus
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ESTAGIO_OPTIONS = [
  { value: "briefing", label: "Briefing", color: "bg-purple-500/20 text-purple-400" },
  { value: "em_criacao", label: "Em Criação", color: "bg-blue-500/20 text-blue-400" },
  { value: "revisao", label: "Revisão", color: "bg-amber-500/20 text-amber-400" },
  { value: "aprovado", label: "Aprovado", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "producao", label: "Produção", color: "bg-pink-500/20 text-pink-400" },
  { value: "lancamento", label: "Lançamento", color: "bg-pink-500/20 text-pink-400" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "bloqueada", label: "Bloqueada" },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

const COFRE_CATEGORIAS = [
  "orcamento", "nota_fiscal", "art", "laudo", "certificado", "rotulo", "ficha_tecnica", "outro"
];

const COFRE_CATEGORIA_LABELS: Record<string, string> = {
  orcamento: "Orçamento",
  nota_fiscal: "Nota Fiscal",
  art: "ART",
  laudo: "Laudo",
  certificado: "Certificado",
  rotulo: "Rótulo",
  ficha_tecnica: "Ficha Técnica",
  outro: "Outro",
};

function getFileIcon(tipo: string | null) {
  if (!tipo) return <File className="h-5 w-5" />;
  if (tipo.startsWith("image/")) return <Image className="h-5 w-5 text-blue-400" />;
  if (tipo.includes("pdf")) return <FileText className="h-5 w-5 text-red-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface ProjetoTarefaDetalheProps {
  tarefa: ProjetoTarefa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<ProjetoTarefa>) => void;
  onToggle: (tarefa: ProjetoTarefa) => void;
  onAddSubtarefa?: (titulo: string, parentId: string, secaoId: string) => void;
  secoes?: ProjetoSecaoType[];
  onMoveTarefa?: (tarefaId: string, secaoOrigemId: string, secaoDestinoId: string) => void;
}

export function ProjetoTarefaDetalhe({
  tarefa, open, onOpenChange, onUpdate, onToggle, onAddSubtarefa, secoes = [], onMoveTarefa,
}: ProjetoTarefaDetalheProps) {
  const navigate = useNavigate();
  const {
    comentarios, addComentario, anexos, uploadAnexo, deleteAnexo, getAnexoUrl,
    sendToCofre, messages, sendMessage, searchProdutos, teamMembers, linkedProduto,
  } = useProjetoTarefaDetalhe(tarefa?.id, (tarefa as any)?.produto_id);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [commentValue, setCommentValue] = useState("");
  const [subtarefaValue, setSubtarefaValue] = useState("");
  const [datePicker, setDatePicker] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatValue, setChatValue] = useState("");
  const [cofreDialogOpen, setCofreDialogOpen] = useState(false);
  const [selectedAnexoIds, setSelectedAnexoIds] = useState<string[]>([]);
  const [cofreCategoria, setCofreCategoria] = useState("outro");
  const [produtoSearch, setProdutoSearch] = useState("");
  const [produtoResults, setProdutoResults] = useState<ProdutoAcabado[]>([]);
  const [showProdutoSearch, setShowProdutoSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tarefa) {
      setTitleValue(tarefa.titulo);
      setDescValue(tarefa.descricao || "");
    }
  }, [tarefa?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!tarefa) return null;

  const isCompleted = tarefa.status === "concluida";
  const estagioInfo = ESTAGIO_OPTIONS.find(e => e.value === tarefa.estagio);

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== tarefa.titulo) {
      onUpdate(tarefa.id, { titulo: titleValue.trim() });
    }
  };

  const handleDescBlur = () => {
    if (descValue !== (tarefa.descricao || "")) {
      onUpdate(tarefa.id, { descricao: descValue });
    }
  };

  const handleCommentSubmit = (text: string, mentionIds: string[]) => {
    addComentario.mutate({ conteudo: text, mentions: mentionIds });
  };

  const handleChatSubmit = (text: string, mentionIds: string[]) => {
    sendMessage.mutate({ conteudo: text, mentions: mentionIds });
    setChatValue("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(f => uploadAnexo.mutate(f));
    e.target.value = "";
  };

  const handleDownload = async (anexo: any) => {
    const url = await getAnexoUrl(anexo.storage_path);
    if (url) window.open(url, "_blank");
  };

  const handleAddSubtarefa = () => {
    if (!subtarefaValue.trim() || !onAddSubtarefa) return;
    onAddSubtarefa(subtarefaValue.trim(), tarefa.id, tarefa.secao_id);
    setSubtarefaValue("");
  };

  const handleProdutoSearch = async (q: string) => {
    setProdutoSearch(q);
    const results = await searchProdutos(q || undefined);
    setProdutoResults(results);
  };

  const handleProdutoFocus = async () => {
    setShowProdutoSearch(true);
    if (produtoResults.length === 0) {
      const results = await searchProdutos();
      setProdutoResults(results);
    }
  };

  const handleSelectProduto = (produto: ProdutoAcabado) => {
    onUpdate(tarefa.id, { produto_id: produto.id } as any);
    setShowProdutoSearch(false);
    setProdutoSearch("");
  };

  const toggleAnexoSelection = (id: string) => {
    setSelectedAnexoIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSendToCofre = () => {
    const prodId = (tarefa as any).produto_id;
    if (!prodId) {
      return;
    }
    sendToCofre.mutate({
      anexoIds: selectedAnexoIds,
      produtoId: prodId,
      categoria: cofreCategoria,
    });
    setCofreDialogOpen(false);
    setSelectedAnexoIds([]);
  };

  // linkedProduto now comes from the hook

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[580px] p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhe da tarefa</SheetTitle>
            <SheetDescription>Visualize e edite os detalhes da tarefa selecionada</SheetDescription>
          </SheetHeader>

          {/* Top bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
            <Button
              variant={isCompleted ? "default" : "outline"}
              size="sm"
              className={cn("gap-1.5 text-xs", isCompleted && "bg-emerald-600 hover:bg-emerald-700")}
              onClick={() => onToggle(tarefa)}
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {isCompleted ? "Concluída" : "Marcar como concluída"}
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              {tarefa.codigo && (
                <span className="text-xs text-muted-foreground font-mono">{tarefa.codigo}</span>
              )}
              <Button
                variant={chatOpen ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setChatOpen(!chatOpen)}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Chat {messages.length > 0 && `(${messages.length})`}
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Main content */}
            <ScrollArea className={cn("flex-1", chatOpen && "border-r border-border/50")}>
              <div className="px-5 py-4 space-y-5">
                {/* Title */}
                {editingTitle ? (
                  <Input
                    value={titleValue}
                    onChange={e => setTitleValue(e.target.value)}
                    onBlur={handleTitleBlur}
                    onKeyDown={e => e.key === "Enter" && handleTitleBlur()}
                    autoFocus
                    className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0"
                  />
                ) : (
                  <h2
                    className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setEditingTitle(true)}
                  >
                    {tarefa.titulo}
                  </h2>
                )}

                {/* Fields grid */}
                <div className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-3 text-sm">
                  {/* Status */}
                  <span className="text-muted-foreground">Status</span>
                  <Select value={tarefa.status} onValueChange={v => onUpdate(tarefa.id, { status: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* Prioridade */}
                  <span className="text-muted-foreground">Prioridade</span>
                  <Select value={tarefa.prioridade} onValueChange={v => onUpdate(tarefa.id, { prioridade: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORIDADE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* Estágio */}
                  <span className="text-muted-foreground">Estágio</span>
                  <Select value={tarefa.estagio || ""} onValueChange={v => onUpdate(tarefa.id, { estagio: v } as any)}>
                    <SelectTrigger className="h-8 text-xs">
                      {estagioInfo ? (
                        <Badge className={cn("text-[10px] border-0", estagioInfo.color)}>{estagioInfo.label}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Selecionar...</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {ESTAGIO_OPTIONS.map(e => (
                        <SelectItem key={e.value} value={e.value}>
                          <Badge className={cn("text-[10px] border-0", e.color)}>{e.label}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Data prazo */}
                  <span className="text-muted-foreground">Data prazo</span>
                  <Popover open={datePicker} onOpenChange={setDatePicker}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {tarefa.data_prazo
                          ? format(new Date(tarefa.data_prazo), "dd MMM yyyy", { locale: ptBR })
                          : "Definir prazo"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={tarefa.data_prazo ? new Date(tarefa.data_prazo) : undefined}
                        onSelect={d => {
                          onUpdate(tarefa.id, { data_prazo: d ? d.toISOString().split("T")[0] : null });
                          setDatePicker(false);
                        }}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Responsável */}
                  <span className="text-muted-foreground">Responsável</span>
                  <div className="flex items-center gap-2">
                    {tarefa.responsavel ? (
                      <>
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                            {tarefa.responsavel.nome?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{tarefa.responsavel.nome}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem responsável</span>
                    )}
                  </div>

                  {/* Seguidores */}
                  <span className="text-muted-foreground">Seguidores</span>
                  <div className="flex items-center gap-1">
                    {tarefa.colaboradores && tarefa.colaboradores.length > 0 ? (
                      <div className="flex -space-x-1">
                        {tarefa.colaboradores.map(c => (
                          <Avatar key={c.user_id} className="h-6 w-6 border-2 border-background">
                            <AvatarImage src={c.avatar_url || undefined} />
                            <AvatarFallback className="text-[8px] bg-muted">
                              {c.nome?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nenhum seguidor</span>
                    )}
                  </div>

                  {/* Produto vinculado */}
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Produto
                  </span>
                  <div className="relative">
                    {(tarefa as any).produto_id && !showProdutoSearch ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <ProductThumbnail src={linkedProduto?.foto_url} alt={linkedProduto?.nome} size="lg" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-xs gap-1">
                                <Package className="h-3 w-3" />
                                {linkedProduto ? linkedProduto.codigo : "..."}
                              </Badge>
                              {linkedProduto?.tipo === "DISPLAY" && (
                                <Badge variant="default" className="text-[9px] px-1">Display</Badge>
                              )}
                              {linkedProduto?.tipo === "DISPLAY" && (
                                <DisplayGradePopover
                                  produtoId={(tarefa as any).produto_id}
                                  produtoNome={linkedProduto?.nome}
                                  produtoCodigo={linkedProduto?.codigo}
                                />
                              )}
                              <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => {
                                onUpdate(tarefa.id, { produto_id: null } as any);
                              }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-foreground truncate mt-0.5">
                              {linkedProduto?.nome || "Produto vinculado"}
                            </p>
                            {linkedProduto?.marca && (
                              <p className="text-[10px] text-muted-foreground">{linkedProduto.marca}{linkedProduto.linha ? ` · ${linkedProduto.linha}` : ""}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={produtoSearch}
                            onChange={e => handleProdutoSearch(e.target.value)}
                            onFocus={handleProdutoFocus}
                            placeholder="Buscar produto por nome ou código..."
                            className="h-8 text-xs pl-7"
                          />
                        </div>
                        {showProdutoSearch && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-auto">
                            {produtoResults.length > 0 ? (
                              produtoResults.map(p => (
                                <div key={p.id}>
                                  <button
                                    onClick={() => handleSelectProduto(p)}
                                    className={`flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${p.tipo === "DISPLAY" ? "bg-primary/5 font-medium" : ""}`}
                                  >
                                    {p.foto_url ? (
                                      <img src={p.foto_url} alt="" className="h-5 w-5 rounded object-cover flex-shrink-0" />
                                    ) : (
                                      <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <span className="font-mono text-muted-foreground flex-shrink-0">{p.codigo}</span>
                                    <span className="truncate">{p.nome}</span>
                                    {p.tipo === "DISPLAY" && <Badge variant="default" className="text-[9px] px-1 flex-shrink-0">Display</Badge>}
                                    {p.marca && <Badge variant="outline" className="text-[9px] px-1 flex-shrink-0">{p.marca}</Badge>}
                                  </button>
                                  {/* Filhos do Display */}
                                  {p.tipo === "DISPLAY" && p.filhos && p.filhos.length > 0 && (
                                    <div className="border-l-2 border-primary/30 ml-5">
                                      {p.filhos.map(filho => (
                                        <button
                                          key={filho.id}
                                          onClick={() => handleSelectProduto(filho)}
                                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-primary/10 transition-colors pl-4"
                                        >
                                          <span className="text-primary">↳</span>
                                          <span className="font-mono text-primary/70 flex-shrink-0 text-[10px]">{filho.codigo}</span>
                                          <span className="truncate text-primary">{filho.nome}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                Nenhum produto encontrado
                              </div>
                            )}
                            <div className="border-t border-border/50">
                              <button
                                onClick={() => {
                                  setShowProdutoSearch(false);
                                  navigate("/dashboard/fabrica/produtos-acabados");
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-primary hover:bg-primary/5 transition-colors font-medium"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Cadastrar novo produto
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mover para Seção */}
                  {secoes.length > 1 && onMoveTarefa && (
                    <>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <ArrowRightLeft className="h-3.5 w-3.5" /> Mover para
                      </span>
                      <Select
                        value={tarefa.secao_id}
                        onValueChange={v => {
                          if (v !== tarefa.secao_id) {
                            onMoveTarefa(tarefa.id, tarefa.secao_id, v);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {secoes.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nome}
                              {s.id === tarefa.secao_id && " (atual)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>

                <Separator />

                {/* Descrição */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Descrição</h3>
                  <Textarea
                    value={descValue}
                    onChange={e => setDescValue(e.target.value)}
                    onBlur={handleDescBlur}
                    placeholder="Do que se trata esta tarefa?"
                    className="min-h-[80px] text-sm bg-muted/30 border-border/50 resize-none"
                  />
                </div>

                <Separator />

                {/* Subtarefas */}
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Subtarefas
                    {tarefa.subtarefas && tarefa.subtarefas.length > 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({tarefa.subtarefas.filter(s => s.status === "concluida").length}/{tarefa.subtarefas.length})
                      </span>
                    )}
                  </h3>
                  <div className="space-y-1">
                    {tarefa.subtarefas?.map(st => (
                      <div key={st.id} className="flex items-center gap-2 py-1">
                        <button onClick={() => onToggle(st)} className={cn(
                          "flex-shrink-0",
                          st.status === "concluida" ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
                        )}>
                          {st.status === "concluida" ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        </button>
                        <span className={cn("text-sm", st.status === "concluida" && "line-through text-muted-foreground")}>
                          {st.titulo}
                        </span>
                      </div>
                    ))}
                  </div>
                  {onAddSubtarefa && (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={subtarefaValue}
                        onChange={e => setSubtarefaValue(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAddSubtarefa()}
                        placeholder="Adicionar subtarefa..."
                        className="h-8 text-sm"
                      />
                      <Button size="sm" variant="ghost" onClick={handleAddSubtarefa} className="h-8">
                        Adicionar
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Anexos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <Paperclip className="h-4 w-4" /> Anexos ({anexos.length})
                    </h3>
                    <div className="flex items-center gap-1">
                      {selectedAnexoIds.length > 0 && (tarefa as any).produto_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 text-emerald-400 border-emerald-500/30"
                          onClick={() => setCofreDialogOpen(true)}
                        >
                          <FolderOpen className="h-3.5 w-3.5" /> Enviar ao Cofre ({selectedAnexoIds.length})
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3.5 w-3.5" /> Upload
                      </Button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </div>
                  {anexos.length > 0 ? (
                    <div className="space-y-1.5">
                      {anexos.map(a => (
                        <div key={a.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
                          <Checkbox
                            checked={selectedAnexoIds.includes(a.id)}
                            onCheckedChange={() => toggleAnexoSelection(a.id)}
                            className="flex-shrink-0"
                          />
                          {getFileIcon(a.tipo_arquivo)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{a.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{formatFileSize(a.tamanho)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(a)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAnexo.mutate(a)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
                  )}
                  {!(tarefa as any).produto_id && selectedAnexoIds.length > 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      ⚠ Vincule um produto à tarefa para enviar ao Cofre
                    </p>
                  )}
                </div>

                <Separator />

                {/* Comentários com @menções */}
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                    <MessageSquare className="h-4 w-4" /> Comentários ({comentarios.length})
                  </h3>
                  <div className="space-y-3 mb-3">
                    {comentarios.map(c => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarImage src={c.autor?.avatar_url || undefined} />
                          <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                            {c.autor?.nome?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{c.autor?.nome}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(c.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">
                            {renderMentionText(c.conteudo)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <MentionInput
                    value={commentValue}
                    onChange={setCommentValue}
                    onSubmit={handleCommentSubmit}
                    users={teamMembers}
                    placeholder="Escreva um comentário..."
                  />
                </div>
              </div>
            </ScrollArea>

            {/* Lateral Chat */}
            {chatOpen && (
              <div className="w-[260px] flex flex-col bg-muted/10">
                <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" /> Chat
                  </h4>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setChatOpen(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 px-3 py-2">
                  <div className="space-y-3">
                    {messages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">Nenhuma mensagem ainda.</p>
                    )}
                    {messages.map(m => {
                      const isMe = m.user_id === (tarefa as any).criador_id;
                      return (
                        <div key={m.id} className={cn("flex gap-1.5", isMe ? "flex-row-reverse" : "flex-row")}>
                          <Avatar className="h-5 w-5 flex-shrink-0">
                            <AvatarImage src={m.autor?.avatar_url || undefined} />
                            <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                              {m.autor?.nome?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs",
                            isMe ? "bg-primary/20 text-primary-foreground" : "bg-muted text-foreground"
                          )}>
                            <p className="font-medium text-[10px] mb-0.5">{m.autor?.nome?.split(" ")[0]}</p>
                            <p className="whitespace-pre-wrap">{renderMentionText(m.conteudo)}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                <div className="p-2 border-t border-border/50">
                  <MentionInput
                    value={chatValue}
                    onChange={setChatValue}
                    onSubmit={handleChatSubmit}
                    users={teamMembers}
                    placeholder="Mensagem..."
                    minRows={1}
                  />
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cofre Dialog */}
      <Dialog open={cofreDialogOpen} onOpenChange={setCofreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-emerald-500" />
              Enviar ao Cofre de Documentos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Documentos selecionados</Label>
              <div className="mt-1 space-y-1">
                {anexos.filter(a => selectedAnexoIds.includes(a.id)).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs p-1.5 bg-muted/30 rounded">
                    {getFileIcon(a.tipo_arquivo)}
                    <span className="truncate">{a.nome}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Categoria</Label>
              <Select value={cofreCategoria} onValueChange={setCofreCategoria}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COFRE_CATEGORIAS.map(c => (
                    <SelectItem key={c} value={c}>{COFRE_CATEGORIA_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCofreDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendToCofre} disabled={sendToCofre.isPending} className="gap-1.5">
              <FolderOpen className="h-4 w-4" />
              {sendToCofre.isPending ? "Enviando..." : "Enviar ao Cofre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Highlight @mentions in text */
function renderMentionText(text: string) {
  const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="text-primary font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}
