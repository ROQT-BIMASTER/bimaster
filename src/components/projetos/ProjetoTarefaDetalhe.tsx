import { useState, useRef, useEffect } from "react";
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
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { useProjetoTarefaDetalhe } from "@/hooks/useProjetoTarefaDetalhe";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Circle, CalendarIcon, Paperclip, MessageSquare,
  Send, X, Upload, FileText, Image, File, Trash2, Download, ChevronDown
} from "lucide-react";

const ESTAGIO_OPTIONS = [
  { value: "briefing", label: "Briefing", color: "bg-purple-500/20 text-purple-400" },
  { value: "em_criacao", label: "Em Criação", color: "bg-blue-500/20 text-blue-400" },
  { value: "revisao", label: "Revisão", color: "bg-amber-500/20 text-amber-400" },
  { value: "aprovado", label: "Aprovado", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "producao", label: "Produção", color: "bg-pink-500/20 text-pink-400" },
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
}

export function ProjetoTarefaDetalhe({
  tarefa, open, onOpenChange, onUpdate, onToggle, onAddSubtarefa,
}: ProjetoTarefaDetalheProps) {
  const { comentarios, addComentario, anexos, uploadAnexo, deleteAnexo, getAnexoUrl } =
    useProjetoTarefaDetalhe(tarefa?.id);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [commentValue, setCommentValue] = useState("");
  const [subtarefaValue, setSubtarefaValue] = useState("");
  const [datePicker, setDatePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tarefa) {
      setTitleValue(tarefa.titulo);
      setDescValue(tarefa.descricao || "");
    }
  }, [tarefa?.id]);

  if (!tarefa) return null;

  const isCompleted = tarefa.status === "concluida";
  const estagioInfo = ESTAGIO_OPTIONS.find(e => e.value === (tarefa as any).estagio);

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

  const handleComment = () => {
    if (!commentValue.trim()) return;
    addComentario.mutate(commentValue.trim());
    setCommentValue("");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col">
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
          {tarefa.codigo && (
            <span className="text-xs text-muted-foreground ml-auto font-mono">{tarefa.codigo}</span>
          )}
        </div>

        <ScrollArea className="flex-1">
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
              <Select
                value={tarefa.status}
                onValueChange={v => onUpdate(tarefa.id, { status: v })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Prioridade */}
              <span className="text-muted-foreground">Prioridade</span>
              <Select
                value={tarefa.prioridade}
                onValueChange={v => onUpdate(tarefa.id, { prioridade: v })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADE_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Estágio */}
              <span className="text-muted-foreground">Estágio</span>
              <Select
                value={(tarefa as any).estagio || ""}
                onValueChange={v => onUpdate(tarefa.id, { estagio: v } as any)}
              >
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

              {/* Colaboradores */}
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
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Upload
                </Button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
              </div>
              {anexos.length > 0 ? (
                <div className="space-y-1.5">
                  {anexos.map(a => (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
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
            </div>

            <Separator />

            {/* Comentários */}
            <div>
              <h3 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                <MessageSquare className="h-4 w-4" /> Comentários ({comentarios.length})
              </h3>
              <div className="space-y-3">
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
                      <p className="text-sm text-foreground/90 mt-0.5">{c.conteudo}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* New comment */}
              <div className="flex items-end gap-2 mt-3">
                <Textarea
                  value={commentValue}
                  onChange={e => setCommentValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                  placeholder="Escreva um comentário..."
                  className="min-h-[60px] text-sm resize-none"
                />
                <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleComment} disabled={!commentValue.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
