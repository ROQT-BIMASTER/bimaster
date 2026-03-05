import { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjetoTarefa, ProjetoSecao as ProjetoSecaoType } from "@/hooks/useProjetoTarefas";
import { useProjetoTarefaDetalhe } from "@/hooks/useProjetoTarefaDetalhe";
import { useProjetoTarefaMetas } from "@/hooks/useProjetoTarefaMetas";
import { TaskEvolutionChart } from "./TaskEvolutionChart";
import { MentionInput } from "./MentionInput";
import { TarefaRiskBadge } from "./TarefaRiskBadge";
import { ProductLaunchPanel } from "./ProductLaunchPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Minimize2, CheckCircle2, Circle, CalendarIcon, Paperclip, MessageSquare,
  MessageCircle, Upload, FileText, Image, File, Trash2, Download,
  Target, Plus, BarChart3, FolderOpen, ShieldCheck, AlertTriangle
} from "lucide-react";

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
  "briefing", "arte_final", "rotulo", "ficha_tecnica", "laudo", "certificado", "orcamento", "nota_fiscal", "art", "outro"
];

// ── Mock data for testing/demo ──────────────────────────────────────────
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

const MOCK_ANEXOS: any[] = [
  { id: "mock-a1", nome: "Briefing_HB-L6532.pdf", tipo_arquivo: "application/pdf", tamanho: 2516582, storage_path: "mock/briefing.pdf", created_at: daysAgo(28), tarefa_id: "mock", user_id: "mock" },
  { id: "mock-a2", nome: "Rotulo_frente_v3.png", tipo_arquivo: "image/png", tamanho: 1153434, storage_path: "mock/rotulo.png", created_at: daysAgo(22), tarefa_id: "mock", user_id: "mock" },
  { id: "mock-a3", nome: "Ficha_Tecnica_final.pdf", tipo_arquivo: "application/pdf", tamanho: 911360, storage_path: "mock/ficha.pdf", created_at: daysAgo(18), tarefa_id: "mock", user_id: "mock" },
  { id: "mock-a4", nome: "Arte_embalagem.ai", tipo_arquivo: "application/illustrator", tamanho: 5452595, storage_path: "mock/arte.ai", created_at: daysAgo(14), tarefa_id: "mock", user_id: "mock" },
  { id: "mock-a5", nome: "Laudo_estabilidade.pdf", tipo_arquivo: "application/pdf", tamanho: 327680, storage_path: "mock/laudo.pdf", created_at: daysAgo(8), tarefa_id: "mock", user_id: "mock" },
  { id: "mock-a6", nome: "Foto_amostra_01.jpg", tipo_arquivo: "image/jpeg", tamanho: 3984588, storage_path: "mock/foto.jpg", created_at: daysAgo(3), tarefa_id: "mock", user_id: "mock" },
];

const MOCK_COFRE_DOCS = [
  { id: "mock-cd1", nome_arquivo: "Briefing_HB-L6532.pdf", tipo_arquivo: "application/pdf", categoria: "briefing", status: "aprovado", visivel_fabrica: false, created_at: daysAgo(26) },
  { id: "mock-cd2", nome_arquivo: "Ficha_Tecnica_final.pdf", tipo_arquivo: "application/pdf", categoria: "ficha_tecnica", status: "ativo", visivel_fabrica: false, created_at: daysAgo(16) },
  { id: "mock-cd3", nome_arquivo: "Laudo_estabilidade.pdf", tipo_arquivo: "application/pdf", categoria: "laudo", status: "ativo", visivel_fabrica: true, created_at: daysAgo(6) },
];

const MOCK_MESSAGES: any[] = [
  { id: "mock-m1", conteudo: "Pessoal, acabei de subir o briefing atualizado. Podem revisar?", user_id: "u1", created_at: daysAgo(27), autor: { nome: "Ana Costa", avatar_url: null } },
  { id: "mock-m2", conteudo: "Revisado! Faltou o campo de registro ANVISA, @Ana pode completar?", user_id: "u2", created_at: daysAgo(25), autor: { nome: "Carlos Silva", avatar_url: null } },
  { id: "mock-m3", conteudo: "Feito! Já atualizei o briefing e subi a ficha técnica também.", user_id: "u1", created_at: daysAgo(17), autor: { nome: "Ana Costa", avatar_url: null } },
  { id: "mock-m4", conteudo: "A arte da embalagem ficou ótima. Vou enviar para aprovação do cliente.", user_id: "u3", created_at: daysAgo(10), autor: { nome: "Mariana Souza", avatar_url: null } },
  { id: "mock-m5", conteudo: "Cliente aprovou a arte! Podemos seguir para produção. 🎉", user_id: "u3", created_at: daysAgo(5), autor: { nome: "Mariana Souza", avatar_url: null } },
];

const MOCK_COMENTARIOS: any[] = [
  { id: "mock-c1", conteudo: "Briefing revisado e aprovado. @Carlos pode iniciar a arte.", created_at: daysAgo(24), autor: { nome: "Ana Costa", avatar_url: null } },
  { id: "mock-c2", conteudo: "Arte finalizada. Enviei o arquivo .AI para revisão do time de qualidade.", created_at: daysAgo(12), autor: { nome: "Carlos Silva", avatar_url: null } },
  { id: "mock-c3", conteudo: "Laudo de estabilidade recebido do laboratório. Tudo dentro dos parâmetros.", created_at: daysAgo(4), autor: { nome: "Mariana Souza", avatar_url: null } },
];

const MOCK_METAS = [
  { id: "mock-mt1", descricao: "Briefing aprovado pelo gerente de produto", concluida: true, created_at: daysAgo(26), data_meta: daysAgo(26) },
  { id: "mock-mt2", descricao: "Arte da embalagem finalizada", concluida: true, created_at: daysAgo(14), data_meta: daysAgo(14) },
  { id: "mock-mt3", descricao: "Ficha técnica validada pelo regulatório", concluida: true, created_at: daysAgo(10), data_meta: daysAgo(10) },
  { id: "mock-mt4", descricao: "Aprovação final do cliente", concluida: false, created_at: daysAgo(5), data_meta: null },
  { id: "mock-mt5", descricao: "Envio para linha de produção", concluida: false, created_at: daysAgo(2), data_meta: null },
];
// ── End mock data ───────────────────────────────────────────────────────

const COFRE_CATEGORIA_LABELS: Record<string, string> = {
  briefing: "Briefing", arte_final: "Arte Final", rotulo: "Rótulo", ficha_tecnica: "Ficha Técnica",
  laudo: "Laudo", certificado: "Certificado", orcamento: "Orçamento", nota_fiscal: "Nota Fiscal",
  art: "ART", outro: "Outro",
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

function renderMentionText(text: string) {
  const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return <span key={i} className="text-primary font-medium">{part}</span>;
    }
    return part;
  });
}

interface TarefaFocusModeProps {
  tarefa: ProjetoTarefa;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<ProjetoTarefa>) => void;
  onToggle: (tarefa: ProjetoTarefa) => void;
  onAddSubtarefa?: (titulo: string, parentId: string, secaoId: string) => void;
  secoes?: ProjetoSecaoType[];
}

export function TarefaFocusMode({
  tarefa, open, onOpenChange, onUpdate, onToggle, onAddSubtarefa, secoes = [],
}: TarefaFocusModeProps) {
  const {
    comentarios, addComentario, anexos, uploadAnexo, deleteAnexo, getAnexoUrl,
    messages, sendMessage, sendToCofre, teamMembers, linkedProduto,
  } = useProjetoTarefaDetalhe(tarefa?.id, (tarefa as any)?.produto_id);
  const { metas, addMeta, toggleMeta, deleteMeta } = useProjetoTarefaMetas(tarefa?.id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [descValue, setDescValue] = useState(tarefa?.descricao || "");
  const [chatValue, setChatValue] = useState("");
  const [commentValue, setCommentValue] = useState("");
  const [subtarefaValue, setSubtarefaValue] = useState("");
  const [datePicker, setDatePicker] = useState(false);
  const [newMeta, setNewMeta] = useState("");
  const [selectedAnexoIds, setSelectedAnexoIds] = useState<string[]>([]);
  const [categoriasPorAnexo, setCategoriasPorAnexo] = useState<Record<string, string>>({});
  const [sendingToCofre, setSendingToCofre] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Cofre documents for this task
  const { data: cofreDocsReal = [] } = useQuery({
    queryKey: ["cofre-docs-tarefa", tarefa?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_revisao_documentos" as any)
        .select("*")
        .eq("origem_projeto_tarefa_id", tarefa!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tarefa?.id,
  });

  // Use mock data as fallback when real data is empty
  const displayAnexos = useMemo(() => anexos.length > 0 ? anexos : MOCK_ANEXOS, [anexos]);
  const cofreDocs = useMemo(() => cofreDocsReal.length > 0 ? cofreDocsReal : MOCK_COFRE_DOCS, [cofreDocsReal]);
  const displayComentarios = useMemo(() => comentarios.length > 0 ? comentarios : MOCK_COMENTARIOS, [comentarios]);
  const displayMessages = useMemo(() => messages.length > 0 ? messages : MOCK_MESSAGES, [messages]);
  const displayMetas = useMemo(() => metas.length > 0 ? metas : MOCK_METAS as any[], [metas]);

  // Identify which annexes are NOT in the cofre
  const anexosNoCofre = useMemo(() => {
    const cofreNames = new Set(cofreDocs.map((d: any) => d.nome_arquivo));
    return displayAnexos.filter(a => !cofreNames.has(a.nome));
  }, [displayAnexos, cofreDocs]);

  useEffect(() => {
    if (tarefa) setDescValue(tarefa.descricao || "");
  }, [tarefa?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isCompleted = tarefa.status === "concluida";
  const estagioInfo = ESTAGIO_OPTIONS.find(e => e.value === tarefa.estagio);

  const handleDescBlur = () => {
    if (descValue !== (tarefa.descricao || "")) {
      onUpdate(tarefa.id, { descricao: descValue });
    }
  };

  const handleChatSubmit = (text: string, mentionIds: string[]) => {
    sendMessage.mutate({ conteudo: text, mentions: mentionIds });
    setChatValue("");
  };

  const handleCommentSubmit = (text: string, mentionIds: string[]) => {
    addComentario.mutate({ conteudo: text, mentions: mentionIds });
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

  const completedMetas = displayMetas.filter(m => m.concluida).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border/50 flex-shrink-0">
          <Button
            variant={isCompleted ? "default" : "outline"}
            size="sm"
            className={cn("gap-1.5 text-xs", isCompleted && "bg-emerald-600 hover:bg-emerald-700")}
            onClick={() => onToggle(tarefa)}
          >
            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            {isCompleted ? "Concluída" : "Marcar concluída"}
          </Button>
          {estagioInfo && (
            <Badge className={cn("text-[10px] border-0", estagioInfo.color)}>{estagioInfo.label}</Badge>
          )}
          {tarefa.codigo && (
            <span className="text-xs text-muted-foreground font-mono">{tarefa.codigo}</span>
          )}
          <h2 className="text-sm font-semibold truncate flex-1">{tarefa.titulo}</h2>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onOpenChange(false)}>
            <Minimize2 className="h-3.5 w-3.5" />
            Sair do Foco
          </Button>
        </div>

        {/* 2-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left column - Task details */}
          <ScrollArea className="flex-1 border-r border-border/50">
            <div className="p-6 space-y-5">

              {/* Fields grid */}
              <div className="grid grid-cols-[130px_1fr_130px_1fr] gap-y-3 gap-x-3 text-sm">
                <span className="text-muted-foreground">Status</span>
                <Select value={tarefa.status} onValueChange={v => onUpdate(tarefa.id, { status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>

                <span className="text-muted-foreground">Prioridade</span>
                <Select value={tarefa.prioridade} onValueChange={v => onUpdate(tarefa.id, { prioridade: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>

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

                <span className="text-muted-foreground">Risco</span>
                <div>
                  <TarefaRiskBadge
                    status={tarefa.status}
                    dataPrazo={tarefa.data_prazo}
                    diasAlertaAntes={(tarefa as any).dias_alerta_antes ?? 2}
                  />
                </div>

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
              </div>

              <Separator />

              {/* Evolution Chart */}
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                  <BarChart3 className="h-4 w-4" />
                  Evolução da Tarefa
                </h3>
                <TaskEvolutionChart
                  metas={displayMetas}
                  comentarios={displayComentarios}
                  messages={displayMessages}
                  subtarefas={tarefa.subtarefas?.map(s => ({ status: s.status, created_at: (s as any).created_at })) || []}
                />
              </div>

              <Separator />

              {/* Marcos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Marcos
                    {displayMetas.length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                        {completedMetas}/{displayMetas.length}
                      </Badge>
                    )}
                  </h3>
                </div>
                {displayMetas.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {displayMetas.map(meta => (
                      <div key={meta.id} className="flex items-center gap-2 group">
                        <button onClick={() => toggleMeta.mutate(meta)} className="flex-shrink-0">
                          {meta.concluida
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          }
                        </button>
                        <span className={cn("text-xs flex-1", meta.concluida && "line-through text-muted-foreground")}>
                          {meta.descricao}
                        </span>
                        {meta.data_meta && (
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(meta.data_meta), "dd/MM", { locale: ptBR })}
                          </span>
                        )}
                        <button
                          onClick={() => deleteMeta.mutate(meta.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={newMeta}
                    onChange={e => setNewMeta(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && newMeta.trim() && (addMeta.mutate({ descricao: newMeta.trim() }), setNewMeta(""))}
                    placeholder="Adicionar marco..."
                    className="h-7 text-xs flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (newMeta.trim()) { addMeta.mutate({ descricao: newMeta.trim() }); setNewMeta(""); } }}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
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
                  className="min-h-[100px] text-sm bg-muted/30 border-border/50 resize-none"
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
                <div className="space-y-1 mb-2">
                  {tarefa.subtarefas?.map(st => (
                    <div key={st.id} className="flex items-center gap-2 group">
                      <button onClick={() => onToggle(st)} className="flex-shrink-0">
                        {st.status === "concluida"
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        }
                      </button>
                      <span className={cn("text-xs flex-1", st.status === "concluida" && "line-through text-muted-foreground")}>
                        {st.titulo}
                      </span>
                    </div>
                  ))}
                </div>
                {onAddSubtarefa && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={subtarefaValue}
                      onChange={e => setSubtarefaValue(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddSubtarefa()}
                      placeholder="Adicionar subtarefa..."
                      className="h-8 text-sm"
                    />
                    <Button size="sm" variant="ghost" onClick={handleAddSubtarefa} className="h-8">Adicionar</Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Documentos & Cofre */}
              <div>
                <Tabs defaultValue="todos" className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <TabsList className="h-8">
                      <TabsTrigger value="todos" className="text-xs h-7 gap-1">
                        <Paperclip className="h-3.5 w-3.5" /> Todos ({displayAnexos.length})
                      </TabsTrigger>
                      <TabsTrigger value="cofre" className="text-xs h-7 gap-1">
                        <FolderOpen className="h-3.5 w-3.5" /> No Cofre ({cofreDocs.length})
                      </TabsTrigger>
                      <TabsTrigger value="pendentes" className="text-xs h-7 gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Fora do Cofre ({anexosNoCofre.length})
                      </TabsTrigger>
                    </TabsList>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </Button>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </div>

                  {/* Tab: Todos os anexos */}
                  <TabsContent value="todos" className="mt-0">
                    {displayAnexos.length > 0 ? (
                      <div className="space-y-1.5">
                        {displayAnexos.map(a => {
                          const inCofre = cofreDocs.some((d: any) => d.nome_arquivo === a.nome);
                          return (
                            <div key={a.id} className={cn("flex items-center gap-2 p-2 rounded-md border border-border/30", inCofre ? "bg-emerald-500/5" : "bg-muted/30")}>
                              {getFileIcon(a.tipo_arquivo)}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{a.nome}</p>
                                <p className="text-[10px] text-muted-foreground">{formatFileSize(a.tamanho)}</p>
                              </div>
                              {inCofre && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-500 gap-0.5">
                                  <ShieldCheck className="h-2.5 w-2.5" /> Cofre
                                </Badge>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(a)}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAnexo.mutate(a)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">Nenhum anexo.</p>
                    )}
                  </TabsContent>

                  {/* Tab: Documentos no Cofre */}
                  <TabsContent value="cofre" className="mt-0">
                    {cofreDocs.length > 0 ? (
                      <div className="space-y-1.5">
                        {cofreDocs.map((doc: any) => (
                          <div key={doc.id} className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                            {getFileIcon(doc.tipo_arquivo)}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{doc.nome_arquivo}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {doc.categoria && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                    {COFRE_CATEGORIA_LABELS[doc.categoria] || doc.categoria}
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  {doc.created_at && format(new Date(doc.created_at), "dd MMM yyyy", { locale: ptBR })}
                                </span>
                                {doc.status === "aprovado" && (
                                  <Badge className="text-[9px] px-1 py-0 h-4 bg-emerald-500/20 text-emerald-500 border-0">Aprovado</Badge>
                                )}
                              </div>
                            </div>
                            {doc.visivel_fabrica && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                                <ShieldCheck className="h-2.5 w-2.5" /> Visível Fábrica
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FolderOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">Nenhum documento no Cofre ainda.</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Selecione documentos na aba "Fora do Cofre" para enviar.</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab: Fora do Cofre */}
                  <TabsContent value="pendentes" className="mt-0">
                    {anexosNoCofre.length > 0 ? (
                      <div className="space-y-2">
                        {!(tarefa as any).produto_id && (
                          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <p className="text-xs">Vincule um produto à tarefa para enviar documentos ao Cofre.</p>
                          </div>
                        )}
                        {anexosNoCofre.map(a => (
                          <div key={a.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
                            <Checkbox
                              checked={selectedAnexoIds.includes(a.id)}
                              onCheckedChange={() => {
                                setSelectedAnexoIds(prev =>
                                  prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                                );
                              }}
                              className="flex-shrink-0"
                            />
                            {getFileIcon(a.tipo_arquivo)}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{a.nome}</p>
                              <p className="text-[10px] text-muted-foreground">{formatFileSize(a.tamanho)}</p>
                            </div>
                            {selectedAnexoIds.includes(a.id) && (
                              <Select
                                value={categoriasPorAnexo[a.id] || ""}
                                onValueChange={v => setCategoriasPorAnexo(prev => ({ ...prev, [a.id]: v }))}
                              >
                                <SelectTrigger className="h-7 w-[120px] text-[11px]">
                                  <SelectValue placeholder="Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  {COFRE_CATEGORIAS.map(c => (
                                    <SelectItem key={c} value={c}>{COFRE_CATEGORIA_LABELS[c]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ))}
                        {selectedAnexoIds.length > 0 && (tarefa as any).produto_id && (
                          <Button
                            size="sm"
                            className="w-full gap-1.5 text-xs mt-2"
                            disabled={sendingToCofre || !selectedAnexoIds.every(id => categoriasPorAnexo[id])}
                            onClick={async () => {
                              if (!selectedAnexoIds.every(id => categoriasPorAnexo[id])) {
                                toast.error("Selecione uma categoria para cada documento.");
                                return;
                              }
                              setSendingToCofre(true);
                              try {
                                await sendToCofre.mutateAsync({
                                  anexoIds: selectedAnexoIds,
                                  produtoId: (tarefa as any).produto_id,
                                  categoriasPorAnexo,
                                });
                                queryClient.invalidateQueries({ queryKey: ["cofre-docs-tarefa", tarefa.id] });
                                setSelectedAnexoIds([]);
                                setCategoriasPorAnexo({});
                              } finally {
                                setSendingToCofre(false);
                              }
                            }}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            {sendingToCofre ? "Enviando..." : `Enviar ${selectedAnexoIds.length} ao Cofre`}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
                        <p className="text-xs text-muted-foreground">Todos os documentos estão no Cofre!</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* Comentários */}
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                  <MessageSquare className="h-4 w-4" /> Comentários ({displayComentarios.length})
                </h3>
                <div className="space-y-3 mb-3">
                  {displayComentarios.map(c => (
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

          {/* Middle column - Product panel & checklist */}
          <ProductLaunchPanel
            linkedProduto={linkedProduto}
            cofreDocs={cofreDocs}
            metas={displayMetas}
          />

          {/* Right column - Chat */}
          <div className="w-[380px] flex flex-col bg-muted/10 flex-shrink-0">
            <div className="px-4 py-3 border-b border-border/50">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" /> Chat
                {displayMessages.length > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">{displayMessages.length}</Badge>
                )}
              </h4>
            </div>
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {displayMessages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-12">Nenhuma mensagem ainda. Inicie uma conversa!</p>
                )}
                {displayMessages.map(m => {
                  const isMe = m.user_id === (tarefa as any).criador_id;
                  return (
                    <div key={m.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarImage src={m.autor?.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                          {m.autor?.nome?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-xs",
                        isMe ? "bg-primary/20" : "bg-muted"
                      )}>
                        <p className="font-medium text-[10px] mb-0.5">{m.autor?.nome?.split(" ")[0]}</p>
                        <p className="whitespace-pre-wrap">{renderMentionText(m.conteudo)}</p>
                        <p className="text-[9px] text-muted-foreground mt-1">
                          {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border/50">
              <MentionInput
                value={chatValue}
                onChange={setChatValue}
                onSubmit={handleChatSubmit}
                users={teamMembers}
                placeholder="Digite uma mensagem..."
                minRows={1}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
