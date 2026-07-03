import { secureDownload } from "@/lib/utils/secure-download";
import { detectFileKind } from "@/lib/utils/detectFileKind";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useProjetoTarefaMetas, TarefaMeta } from "@/hooks/useProjetoTarefaMetas";
import { TarefaRiskBadge } from "./TarefaRiskBadge";
import { Input } from "@/components/ui/input";
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
import { ValidacaoFinalDialog, AprovacaoPanel } from "./ValidacaoFinalDialog";
import { MentionInput } from "./MentionInput";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { DisplayGradePopover } from "@/components/fabrica/DisplayGradePopover";
import { cn } from "@/lib/utils";
import { copyTarefaLink } from "@/lib/utils/copyDeepLink";
import { flickerLog } from "@/lib/debug/flickerLog";
import { isTarefasFlagEnabled } from "@/lib/tarefas/featureFlags";
import { lockField, unlockField } from "@/lib/tarefas/editingFieldsStore";
import { trackLocalMutation } from "@/lib/tarefas/lastLocalMutationTracker";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, parseLocalDateOrNow, formatLocalDate } from "@/lib/utils/parseLocalDate";
import {
  CheckCircle2, Circle, CalendarIcon, Paperclip, MessageSquare,
  Send, Upload, FileText, Image, File, Trash2, Download,
  Package, FolderOpen, MessageCircle, Search, X, ArrowRightLeft, Plus, ShieldCheck, ChevronLeft, ChevronRight, ChevronDown, Clock, Sparkles, Loader2, Target, Maximize2, Minimize2, FileSpreadsheet, RotateCcw, Ship, Hash, Copy, Link2
} from "lucide-react";
import { TarefaFocusMode } from "./TarefaFocusMode";
import { ProjetoAprovacaoWorkflow } from "./ProjetoAprovacaoWorkflow";
import { ProjetoAtividadesLog } from "./ProjetoAtividadesLog";
import { ProjetoTarefaTimeline } from "./ProjetoTarefaTimeline";
import { TarefaAcessoHistorico } from "./TarefaAcessoHistorico";
import { VisibilidadeDebugDialog } from "./VisibilidadeDebugDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { ProjetoTarefaDependencias } from "./ProjetoTarefaDependencias";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { useProjetoBriefing } from "@/hooks/useProjetoBriefing";
import { BriefingImportDialog } from "./BriefingImportDialog";
import { BriefingView } from "./BriefingView";
import { BriefingToTasksDialog } from "./BriefingToTasksDialog";
import { useProjetoChinaVinculo } from "@/hooks/useChinaProjeto";
import { ChinaProdutoWidget } from "@/components/china/ChinaProdutoWidget";
import { ModulosVinculadosWidget } from "@/components/shared/ModulosVinculadosWidget";
import { TarefaAnexosSection } from "./tarefa-detalhe/TarefaAnexosSection";
import { TarefaBriefingsSection } from "./tarefa-detalhe/TarefaBriefingsSection";
import { TarefaComentariosSection } from "./tarefa-detalhe/TarefaComentariosSection";
import { TarefaNotasPessoaisSection } from "./tarefa-detalhe/TarefaNotasPessoaisSection";
import { TarefaChatPanel } from "./tarefa-detalhe/TarefaChatPanel";
import { TarefaResponsavelSeguidoresEditor } from "./tarefa-detalhe/TarefaResponsavelSeguidoresEditor";
import { SubtarefasSection } from "./tarefa-detalhe/SubtarefasSection";
import { TarefaCurtirButton } from "./tarefa-detalhe/TarefaCurtirButton";

import { TarefaChinaDocsSection } from "./tarefa-detalhe/TarefaChinaDocsSection";
import { TarefaProcessoSection } from "./tarefa-detalhe/TarefaProcessoSection";
import { TarefaAprovacoesSection } from "./aprovacoes/TarefaAprovacoesSection";
import { useUIPermissions } from "@/hooks/useUIPermissions";
import { TAREFA_DETALHE_TELA } from "@/config/tarefa-detalhe-componentes";

const ESTAGIO_OPTIONS = [
  { value: "briefing", label: "Briefing", color: "bg-purple-500/20 text-purple-400" },
  { value: "em_criacao", label: "Em Criação", color: "bg-blue-500/20 text-blue-400" },
  { value: "revisao", label: "Revisão", color: "bg-amber-500/20 text-amber-400" },
  { value: "aprovado", label: "Aprovado", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "producao", label: "Produção", color: "bg-pink-500/20 text-pink-400" },
  { value: "lancamento", label: "Lançamento", color: "bg-pink-500/20 text-pink-400" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-muted text-muted-foreground" },
  { value: "em_andamento", label: "Em andamento", color: "bg-emerald-500/15 text-emerald-400" },
  { value: "concluida", label: "Concluída", color: "bg-blue-500/15 text-blue-400" },
  { value: "bloqueada", label: "Bloqueada", color: "bg-destructive/15 text-destructive" },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa", color: "bg-emerald-500/15 text-emerald-400" },
  { value: "media", label: "Média", color: "bg-rose-500/15 text-rose-400" },
  { value: "alta", label: "Alta", color: "bg-destructive/20 text-destructive" },
];

const COFRE_CATEGORIAS = [
  "briefing", "arte_final", "rotulo", "ficha_tecnica", "laudo", "certificado", "orcamento", "nota_fiscal", "art", "outro"
];

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

function getFileIcon(nome: string, tipo: string | null) {
  const kind = detectFileKind(nome, tipo);
  if (kind === "image") return <Image className="h-5 w-5 text-blue-400" />;
  if (kind === "pdf") return <FileText className="h-5 w-5 text-red-400" />;
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
  onAddSubtarefa?: (titulo: string, parentId: string, secaoId: string) => void | Promise<void>;
  /** Soft-delete handler (tarefa ou subtarefa). Quando ausente, o botão de excluir não é renderizado. */
  onDelete?: (tarefaId: string) => void;
  secoes?: ProjetoSecaoType[];
  onMoveTarefa?: (tarefaId: string, secaoOrigemId: string, secaoDestinoId: string) => void;
  projetoIdOverride?: string;
  /** Comentário a destacar/rolar (vindo de deep-link de menção). */
  highlightCommentId?: string | null;
  /** Indica que uma persistência externa (bridge) está em andamento. Mostra o indicador de "Salvando…" no header e mantém o painel aberto. */
  externalSaving?: boolean;
  /** Navega para outra tarefa/subtarefa reutilizando o mesmo drawer (dono controla via URL). */
  onOpenSubtarefa?: (id: string) => void;
}

export function ProjetoTarefaDetalhe({
  tarefa: tarefaProp, open, onOpenChange, onUpdate, onToggle, onAddSubtarefa, onDelete, secoes = [], onMoveTarefa, projetoIdOverride, highlightCommentId = null, externalSaving = false, onOpenSubtarefa,
}: ProjetoTarefaDetalheProps) {

  // Mantém o último snapshot aberto para que refetches/invalidations não
  // desmontem a tela enquanto o usuário salva status ou subtarefas.
  const lastOpenTarefaRef = useRef<ProjetoTarefa | null>(null);
  if (open && tarefaProp) {
    lastOpenTarefaRef.current = tarefaProp;
  }
  const tarefa = tarefaProp ?? (open ? lastOpenTarefaRef.current : null);
  flickerLog("drawer-render", { tarefaId: tarefa?.id, open, isTemp: String(tarefa?.id ?? "").startsWith("temp-") });

  const navigate = useNavigate();
  const { id: routeProjetoId } = useParams<{ id: string }>();
  const projetoId = projetoIdOverride || routeProjetoId;
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const {
    comentarios, addComentario, anexos, uploadAnexo, deleteAnexo, getAnexoUrl,
    sendToCofre, removeFromCofre, messages, sendMessage, searchProdutos, teamMembers, linkedProduto,
  } = useProjetoTarefaDetalhe(tarefa?.id, (tarefa as any)?.produto_id);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  // Permite expandir a caixa de descrição para leitura confortável do
  // conteúdo — evita depender apenas da barra de rolagem quando o texto
  // é longo. Persistido por tarefa (id) para não resetar ao trocar de aba.
  const [descExpanded, setDescExpanded] = useState(false);
  const [datePicker, setDatePicker] = useState(false);
  const [inicioPicker, setInicioPicker] = useState(false);
  const [proximaAcaoPicker, setProximaAcaoPicker] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [validacaoDialogOpen, setValidacaoDialogOpen] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState("");
  const [produtoResults, setProdutoResults] = useState<ProdutoAcabado[]>([]);
  const [showProdutoSearch, setShowProdutoSearch] = useState(false);
  // Navegação para subtarefas agora é elevada ao dono do drawer via `onOpenSubtarefa`,
  // que troca `?tarefa=` na URL. Isso mantém UM único Sheet montado (sem pilha, sem flicker).


  // Quando esta tarefa é uma subtarefa, busca título da tarefa pai para o botão "Voltar".
  const parentTarefaId = (tarefa as any)?.parent_tarefa_id as string | null | undefined;
  const { data: parentTarefaTitulo } = useQuery({
    queryKey: ["parent-tarefa-titulo", parentTarefaId],
    enabled: !!parentTarefaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("projeto_tarefas")
        .select("titulo")
        .eq("id", parentTarefaId!)
        .maybeSingle();
      return (data?.titulo as string | undefined) ?? null;
    },
  });
  // Resolve o ID da tarefa raiz (nível 0) subindo a cadeia de parents.
  // Usado por `SubtarefasSection` para garantir que o input "Adicionar subtarefa"
  // e a IA sempre criem irmãs — nunca aninhem sob outra subtarefa.
  const { data: rootTarefaId } = useQuery({
    queryKey: ["root-tarefa-id", tarefa?.id, parentTarefaId],
    enabled: !!tarefa?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!parentTarefaId) return tarefa!.id;
      let current: { id: string; parent_tarefa_id: string | null } = {
        id: tarefa!.id,
        parent_tarefa_id: parentTarefaId,
      };
      // Guard contra ciclos (trigger no banco já previne, mas defesa em profundidade).
      for (let hop = 0; hop < 16 && current.parent_tarefa_id; hop += 1) {
        const { data } = await supabase
          .from("projeto_tarefas")
          .select("id, parent_tarefa_id")
          .eq("id", current.parent_tarefa_id)
          .maybeSingle();
        if (!data) break;
        current = { id: data.id, parent_tarefa_id: data.parent_tarefa_id };
      }
      return current.id;
    },
  });
  const { suggestFields, loading: iaLoading } = useProjetoIA();
  const [pendingAIDescricao, setPendingAIDescricao] = useState<{
    descricao: string;
    prioridade: string;
    estagio: string;
    dataPrazo: string | null;
    apply: { descricao: boolean; prioridade: boolean; estagio: boolean; dataPrazo: boolean };
  } | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  // Mantém um snapshot da última `tarefa` enquanto o Focus Mode está aberto
  // para evitar que o Dialog desmonte quando o prop `tarefa` ficar nulo
  // momentaneamente durante refetches/invalidations das mutações.
  const lastFocusTarefaRef = useRef<ProjetoTarefa | null>(null);
  if (focusMode && tarefa) {
    lastFocusTarefaRef.current = tarefa;
  }
  const focusTarefa = tarefa ?? (focusMode ? lastFocusTarefaRef.current : null);
  // Guard: o Focus Mode só pode ser fechado por intenção explícita do usuário
  // ("Sair do Foco" / Esc). Qualquer outro caminho de fechamento (re-render
  // colateral por invalidação de query após concluir subtarefa/marco, mudar
  // responsável, calendário, etc.) é ignorado para evitar "piscar e sair do foco".
  const closeFocusIntentRef = useRef(false);
  const [briefingDialogOpen, setBriefingDialogOpen] = useState(false);
  const [briefingTasksDialogOpen, setBriefingTasksDialogOpen] = useState(false);
  const { briefing: tarefaBriefing, saveBriefing: saveTarefaBriefing, deleteBriefing: deleteTarefaBriefing } = useProjetoBriefing(tarefa?.id);
  const { data: chinaVinculo } = useProjetoChinaVinculo(projetoId);
  const { membros: projetoMembros, currentUserPapel } = useProjetoMembros(projetoId);
  const { canView: canViewUI } = useUIPermissions(TAREFA_DETALHE_TELA);
  const { data: projetoTipo } = useQuery({
    queryKey: ["projeto-tipo", projetoId],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("tipo").eq("id", projetoId!).single();
      return (data?.tipo as string) || "generico";
    },
    enabled: !!projetoId,
  });
  // Produto só faz sentido em projetos de desenvolvimento (PLM). Outros
  // tipos (kanban, documentacao, generico) não devem expor o campo.
  const isProjetoProduto = projetoTipo === "desenvolvimento_produto" || projetoTipo === "desenvolvimento";

  // Fetch creator profile for metadata display
  const criadorId = (tarefa as any)?.criador_id;
  const { data: criadorProfile } = useQuery({
    queryKey: ["profile-mini", criadorId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, avatar_url").eq("id", criadorId).single();
      return data;
    },
    enabled: !!criadorId,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-save status: "idle" | "saving" | "saved"
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoSaveRef = useRef(true);

  // Guarda id da tarefa cujo edit-lock está ativo, para desbloquear ao trocar.
  const lockedIdRef = useRef<string | null>(null);
  const releaseEditLocks = useCallback((id: string | null) => {
    if (!id) return;
    if (!isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) return;
    unlockField(id, "titulo");
    unlockField(id, "descricao");
  }, []);

  useEffect(() => {
    if (tarefa) {
      flickerLog("drawer-sync-effect", { tarefaId: tarefa.id, isTemp: String(tarefa.id).startsWith("temp-") });
      // Reset everything on task switch and skip the next auto-save trigger
      skipAutoSaveRef.current = true;
      // Libera locks da tarefa anterior antes de trocar
      if (lockedIdRef.current && lockedIdRef.current !== tarefa.id) {
        releaseEditLocks(lockedIdRef.current);
      }
      lockedIdRef.current = tarefa.id;
      setTitleValue(tarefa.titulo);
      setDescValue(tarefa.descricao || "");
      setAutoSaveStatus("idle");
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    }
  }, [tarefa?.id, releaseEditLocks]);


  const flagSaved = useCallback(() => {
    setAutoSaveStatus("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 1500);
  }, []);

  // Debounced auto-save for title
  useEffect(() => {
    if (!tarefa) return;
    if (skipAutoSaveRef.current) { skipAutoSaveRef.current = false; return; }
    if (titleValue.trim() === (tarefa.titulo || "").trim()) return;
    if (!titleValue.trim()) return; // never auto-save empty title
    setAutoSaveStatus("saving");
    // Marca o campo como "em edição" para o reducer de Realtime não sobrescrever
    if (isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) {
      lockField(tarefa.id, "titulo");
    }
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      const id = tarefa.id;
      onUpdate(id, { titulo: titleValue.trim() });
      if (isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) {
        trackLocalMutation(id, ["titulo"]);
        unlockField(id, "titulo");
      }
      flagSaved();
    }, 700);
    return () => { if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current); };
  }, [titleValue, tarefa?.id]);

  // Debounced auto-save for description
  useEffect(() => {
    if (!tarefa) return;
    if (descValue === (tarefa.descricao || "")) return;
    setAutoSaveStatus("saving");
    if (isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) {
      lockField(tarefa.id, "descricao");
    }
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    descDebounceRef.current = setTimeout(() => {
      const id = tarefa.id;
      onUpdate(id, { descricao: descValue });
      if (isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) {
        trackLocalMutation(id, ["descricao"]);
        unlockField(id, "descricao");
      }
      flagSaved();
    }, 900);
    return () => { if (descDebounceRef.current) clearTimeout(descDebounceRef.current); };
  }, [descValue, tarefa?.id]);

  // Flush pending auto-save on close/unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      releaseEditLocks(lockedIdRef.current);
      lockedIdRef.current = null;
    };
  }, [releaseEditLocks]);

  const responsaveisDetalheSignature = useMemo(() => {
    if (!tarefa) return "";
    const lista = (tarefa.responsaveis || []).map((r) =>
      `${r.user_id}:${r.nome || "Membro"}:${r.avatar_url || ""}:junction`,
    );
    if (tarefa.responsavel_id && tarefa.responsavel && !(tarefa.responsaveis || []).some((r) => r.user_id === tarefa.responsavel_id)) {
      lista.unshift(
        `${tarefa.responsavel_id}:${tarefa.responsavel.nome || "Membro"}:${tarefa.responsavel.avatar_url || ""}:principal`,
      );
    }
    return lista.join("|");
  }, [tarefa?.responsaveis, tarefa?.responsavel_id, tarefa?.responsavel]);

  const seguidoresDetalheSignature = useMemo(() => {
    if (!tarefa) return "";
    return (tarefa.colaboradores || [])
      .map((c) => `${c.user_id}:${c.nome || "Membro"}:${c.avatar_url || ""}`)
      .join("|");
  }, [tarefa?.colaboradores]);

  const responsaveisDetalhe = useMemo(() => {
    if (!tarefa) return [];
    const lista: Array<{ user_id: string; nome: string; avatar_url: string | null; origem: "junction" | "principal" }> = (tarefa.responsaveis || []).map(r => ({
      user_id: r.user_id,
      nome: r.nome || "Membro",
      avatar_url: r.avatar_url || null,
      origem: "junction",
    }));

    if (tarefa.responsavel_id && tarefa.responsavel && !lista.some(r => r.user_id === tarefa.responsavel_id)) {
      lista.unshift({
        user_id: tarefa.responsavel_id,
        nome: tarefa.responsavel.nome || "Membro",
        avatar_url: tarefa.responsavel.avatar_url || null,
        origem: "principal" as const,
      });
    }

    return lista;
  }, [responsaveisDetalheSignature]);

  const seguidoresDetalhe = useMemo(() => {
    if (!tarefa) return [];
    return (tarefa.colaboradores || []).map(c => ({
      user_id: c.user_id,
      nome: c.nome || "Membro",
      avatar_url: c.avatar_url || null,
    }));
  }, [seguidoresDetalheSignature]);



  if (!tarefa) return null;

  const isCompleted = tarefa.status === "concluida";
  const isPendingValidation = (tarefa as any).validacao_status === "pendente_validacao";
  const estagioInfo = ESTAGIO_OPTIONS.find(e => e.value === tarefa.estagio);

  const handleEnviarParaValidacao = async () => {
    // Check if there are linked products in junction table
    const { data: links } = await supabase
      .from("projeto_tarefa_produtos" as any)
      .select("id")
      .eq("tarefa_id", tarefa.id);
    
    if (!links || links.length === 0) {
      toast.error("Vincule pelo menos um produto acabado antes de enviar para validação.");
      return;
    }
    
    // Directly submit for validation (update status)
    const { error } = await supabase
      .from("projeto_tarefas")
      .update({ validacao_status: "pendente_validacao" } as any)
      .eq("id", tarefa.id);
    
    if (error) {
      toast.error("Erro ao enviar para validação: " + error.message);
      return;
    }
    
    toast.success("Tarefa enviada para validação!");
    onUpdate(tarefa.id, {});
  };

  const handleEnviarAoSuperior = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Usuário não autenticado."); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("supervisor_id")
        .eq("id", user.id)
        .single();

      const superiorId = profile?.supervisor_id;
      if (!superiorId) {
        toast.error("Nenhum superior hierárquico encontrado no seu perfil.");
        return;
      }

      const { error } = await supabase
        .from("projeto_tarefas")
        .update({
          validacao_status: "pendente_validacao",
          responsavel_id: superiorId,
        } as any)
        .eq("id", tarefa.id);

      if (error) {
        toast.error("Erro ao enviar ao superior: " + error.message);
        return;
      }

      toast.success("Tarefa enviada ao superior para aprovação!");
      onUpdate(tarefa.id, {});
    } catch (err) {
      toast.error("Erro inesperado ao enviar ao superior.");
    }
  };

  const handleTitleBlur = () => {
    setEditingTitle(false);
    // Flush any pending debounce immediately
    if (titleDebounceRef.current) { clearTimeout(titleDebounceRef.current); titleDebounceRef.current = null; }
    if (titleValue.trim() && titleValue !== tarefa.titulo) {
      onUpdate(tarefa.id, { titulo: titleValue.trim() });
      if (isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) {
        trackLocalMutation(tarefa.id, ["titulo"]);
      }
      flagSaved();
    }
    if (isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) {
      unlockField(tarefa.id, "titulo");
    }
  };

  const handleDescBlur = () => {
    if (descDebounceRef.current) { clearTimeout(descDebounceRef.current); descDebounceRef.current = null; }
    if (descValue !== (tarefa.descricao || "")) {
      onUpdate(tarefa.id, { descricao: descValue });
      if (isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) {
        trackLocalMutation(tarefa.id, ["descricao"]);
      }
      flagSaved();
    }
    if (isTarefasFlagEnabled("tarefas_descricao_editor_isolado")) {
      unlockField(tarefa.id, "descricao");
    }
  };



  const handleDownload = async (anexo: any) => {
    await secureDownload(anexo.storage_path, anexo.nome, "projeto-anexos");
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


  // linkedProduto now comes from the hook

  return (
    <>
      <Sheet open={open && !focusMode} onOpenChange={(next) => {
        // Defesa: enquanto o Modo Foco estiver ativo, ignoramos qualquer
        // pedido de fechamento do Sheet pai — assim re-renders colaterais
        // não derrubam o estado e não fazem a tela "saltar" para o Sheet.
        if (focusMode) return;
        onOpenChange(next);
      }}>
        <SheetContent
          side="right"
          hideClose
          data-testid="projeto-tarefa-detalhe-drawer"
          data-tarefa-id={tarefa.id}
          className="w-full sm:max-w-[580px] p-0 flex flex-col overflow-hidden"
          onPointerDownOutside={(e) => {
            // Evita que cliques em conteúdo portalizado (Popover, Select,
            // Dropdown, Dialog aninhado, cmdk) sejam tratados como "fora do
            // Sheet" — sem isso o Sheet (e o Sheet pai, quando este é uma
            // subtarefa) fecha sozinho ao abrir o picker de Responsável/
            // Seguidores.
            const target = e.target as HTMLElement | null;
            if (
              target?.closest(
                "[data-radix-popper-content-wrapper], [data-radix-popover-content], [data-radix-select-content], [data-radix-dropdown-menu-content], [role=dialog], [role=alertdialog], [role=menu], [role=listbox], [cmdk-root], [cmdk-list], [cmdk-item]"
              )
            ) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (
              target?.closest(
                "[data-radix-popper-content-wrapper], [data-radix-popover-content], [data-radix-select-content], [data-radix-dropdown-menu-content], [role=dialog], [role=alertdialog], [role=menu], [role=listbox], [cmdk-root], [cmdk-list], [cmdk-item]"
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhe da tarefa</SheetTitle>
            <SheetDescription>Visualize e edite os detalhes da tarefa selecionada</SheetDescription>
          </SheetHeader>

          {/* Top action bar — Asana-style flat header */}
          <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2 flex-wrap">
            {(tarefa as any).parent_tarefa_id && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs rounded-full h-8 px-2 -ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const parentId = (tarefa as any).parent_tarefa_id as string | null | undefined;
                    if (parentId && onOpenSubtarefa) onOpenSubtarefa(parentId);
                    else onOpenChange(false);
                  }}
                  title={parentTarefaTitulo ? `Voltar para "${parentTarefaTitulo}"` : "Voltar para a tarefa"}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="max-w-[220px] truncate">
                    {parentTarefaTitulo || "Voltar à tarefa"}
                  </span>
                </Button>
                <Separator orientation="vertical" className="h-5 mx-1" />
                <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0 h-5">Subtarefa</Badge>
              </>
            )}
            {/* Marcar como concluída - bloqueado durante validação pendente */}
            {isPendingValidation ? (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0 gap-1 rounded-full px-2.5 py-1">
                <Clock className="h-3 w-3" />
                Pendente de Aprovação
              </Badge>
            ) : canViewUI("acao_marcar_concluida") ? (
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="sm"
                className={cn(
                  "gap-1.5 text-xs rounded-full h-8 px-3",
                  isCompleted && "bg-emerald-600 hover:bg-emerald-700"
                )}
                onClick={() => onToggle(tarefa)}
                disabled={isPendingValidation}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                {isCompleted ? "Concluída" : "Marcar como concluída"}
              </Button>
            ) : null}
            {/* Enviar para Validação (dev produto) ou Enviar ao Superior (genérico) */}
            {isCompleted && !(tarefa as any).validacao_status && projetoTipo === 'desenvolvimento_produto' && (
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleEnviarParaValidacao()}
              >
                <ShieldCheck className="h-4 w-4" />
                Enviar para Validação
              </Button>
            )}
            {isCompleted && !(tarefa as any).validacao_status && projetoTipo !== 'desenvolvimento_produto' && (
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={() => handleEnviarAoSuperior()}
              >
                <Send className="h-4 w-4" />
                Enviar ao Superior
              </Button>
            )}
            {(tarefa as any).validacao_status === "validada" && (
              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-0">✓ Validada</Badge>
            )}
            {(tarefa as any).validacao_status === "rejeitada" && (
              <Badge className="text-[10px] bg-destructive/20 text-destructive border-0">✗ Rejeitada — Corrija e reenvie</Badge>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {tarefa.numero_processo && canViewUI("acao_numero_processo") && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tarefa.numero_processo!);
                    toast.success("Número do processo copiado");
                  }}
                  title={`Processo ${tarefa.numero_processo} — clique para copiar`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border border-border/60 text-foreground/80 hover:bg-muted transition-colors"
                >
                  <Hash className="h-3 w-3" />
                  {tarefa.numero_processo}
                  <Copy className="h-2.5 w-2.5 opacity-60" />
                </button>
              )}
              {tarefa.codigo && (
                <span className="text-xs text-muted-foreground font-mono">{tarefa.codigo}</span>
              )}
              {canViewUI("acao_chat") && (
                <Button
                  variant={chatOpen ? "default" : "ghost"}
                  size="sm"
                  className="gap-1.5 text-xs rounded-full h-8 px-3"
                  onClick={() => setChatOpen(!chatOpen)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Chat {messages.length > 0 && `(${messages.length})`}
                </Button>
              )}
              <TarefaCurtirButton tarefaId={tarefa.id} />
              {canViewUI("acao_copiar_link") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs rounded-full h-8 px-3"
                  onClick={() => copyTarefaLink(tarefa.projeto_id, tarefa.id)}
                  title="Copiar link da tarefa"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Copiar link
                </Button>
              )}
              {canViewUI("acao_foco") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs rounded-full h-8 px-3"
                  onClick={() => setFocusMode(true)}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Foco
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-8 w-8 p-0 shrink-0"
                onClick={() => onOpenChange(false)}
                title="Fechar"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Main content */}
            <ScrollArea className={cn("flex-1", chatOpen && "border-r border-border/50")}>
              <div className="px-5 py-4 space-y-5">
                {/* Title + auto-save indicator */}
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {editingTitle ? (
                      <Input
                        value={titleValue}
                        onChange={e => setTitleValue(e.target.value)}
                        onBlur={handleTitleBlur}
                        onKeyDown={e => e.key === "Enter" && handleTitleBlur()}
                        autoFocus
                        className="text-2xl font-bold tracking-tight border-none p-0 h-auto focus-visible:ring-0"
                      />
                    ) : (
                      <h2
                        className="text-2xl font-bold tracking-tight cursor-pointer -mx-2 px-2 py-0.5 rounded hover:bg-muted/40 transition-colors"
                        onClick={() => setEditingTitle(true)}
                      >
                        {tarefa.titulo}
                      </h2>
                    )}
                  </div>
                  {(autoSaveStatus !== "idle" || externalSaving) && (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[11px] mt-1.5 shrink-0 transition-opacity",
                        externalSaving || autoSaveStatus === "saving" ? "text-muted-foreground" : "text-emerald-500"
                      )}
                      aria-live="polite"
                      data-testid="tarefa-saving-indicator"
                    >
                      {externalSaving || autoSaveStatus === "saving" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Salvando…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Salvo
                        </>
                      )}
                    </span>
                  )}
                </div>


                {/* Creation & attribution metadata */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  {criadorProfile && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Criada por <span className="font-medium text-foreground">{criadorProfile.nome?.split(" ")[0]}</span>
                    </span>
                  )}
                  {tarefa.created_at && (
                    <span>
                      em {format(new Date(tarefa.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                  {(() => {
                    const lista = (tarefa as any).responsaveis as { nome?: string | null }[] | undefined;
                    const principalNome =
                      (lista && lista.length > 0 ? lista[0]?.nome : null) ||
                      (tarefa as any).responsavel?.nome ||
                      (typeof (tarefa as any).responsavel === "string" ? (tarefa as any).responsavel : null);
                    if (!principalNome) return null;
                    const extras = lista && lista.length > 1 ? lista.length - 1 : 0;
                    return (
                      <>
                        <span className="text-border">·</span>
                        <span className="flex items-center gap-1">
                          Atribuída a{" "}
                          <span className="font-medium text-foreground">
                            {String(principalNome).split(" ")[0]}
                          </span>
                          {extras > 0 && (
                            <span className="text-muted-foreground">+{extras}</span>
                          )}
                        </span>
                      </>
                    );
                  })()}
                </div>

                {/* Fields grid */}
                <div className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-3 text-sm" data-testid="projeto-tarefa-detalhe-fields">
                  {/* Status */}
                  {canViewUI("campo_status") && (<>
                  <span className="text-muted-foreground">Status</span>
                  <Select value={isPendingValidation ? "pendente_validacao" : tarefa.status} onValueChange={v => {
                    if (isPendingValidation) { toast.error("Aguardando aprovação. Não é possível alterar o status."); return; }
                    onUpdate(tarefa.id, { status: v });
                  }} disabled={isPendingValidation}>
                    <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-muted/40 px-2 [&>svg]:opacity-40 justify-start gap-2">
                      {(() => {
                        const s = STATUS_OPTIONS.find(x => x.value === tarefa.status);
                        return s ? (
                          <Badge className={cn("text-[10px] border-0 rounded-md", s.color)}>{s.label}</Badge>
                        ) : <SelectValue />;
                      })()}
                    </SelectTrigger>
                    <SelectContent>
                      {isPendingValidation && <SelectItem value="pendente_validacao">Pendente de Aprovação</SelectItem>}
                      {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  </>)}

                  {/* Prioridade */}
                  {canViewUI("campo_prioridade") && (<>
                  <span className="text-muted-foreground">Prioridade</span>
                  <Select value={tarefa.prioridade} onValueChange={v => onUpdate(tarefa.id, { prioridade: v })}>
                    <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-muted/40 px-2 [&>svg]:opacity-40 justify-start gap-2">
                      {(() => {
                        const p = PRIORIDADE_OPTIONS.find(x => x.value === tarefa.prioridade);
                        return p ? (
                          <Badge className={cn("text-[10px] border-0 rounded-md", p.color)}>{p.label}</Badge>
                        ) : <SelectValue />;
                      })()}
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDADE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  </>)}


                  {/* Estágio */}
                  {canViewUI("campo_estagio") && (<>
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
                  </>)}

                  {/* Data prazo */}
                  {canViewUI("campo_data_prazo") && (<>
                  <span className="text-muted-foreground">Data prazo <span className="text-destructive">*</span></span>
                  <Popover open={datePicker} onOpenChange={setDatePicker}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-8 justify-start text-xs gap-1.5", !tarefa.data_prazo && "border-destructive/50 text-destructive")}>
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {tarefa.data_prazo
                          ? format(parseLocalDateOrNow(tarefa.data_prazo), "dd MMM yyyy", { locale: ptBR })
                          : "Definir prazo (obrigatório)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseLocalDate(tarefa.data_prazo) ?? undefined}
                        onSelect={d => {
                          if (d) {
                            onUpdate(tarefa.id, { data_prazo: formatLocalDate(d) });
                            setDatePicker(false);
                          }
                        }}
                        className="p-3 pointer-events-auto"
                      />
                      {tarefa.data_prazo && (
                        <div className="border-t p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs"
                            data-testid="clear-data-prazo"
                            onClick={() => {
                              onUpdate(tarefa.id, { data_prazo: null as any });
                              setDatePicker(false);
                            }}
                          >
                            Limpar data
                          </Button>
                        </div>
                      )}
                    </PopoverContent>

                  </Popover>
                  </>)}

                  {/* Data Início Planejada */}
                  {canViewUI("campo_inicio_planejado") && (<>
                  <span className="text-muted-foreground">Início planejado <span className="text-destructive">*</span></span>
                  <Popover open={inicioPicker} onOpenChange={setInicioPicker}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-8 justify-start text-xs gap-1.5", !(tarefa as any).data_inicio_planejada && "border-destructive/50 text-destructive")}>
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {(tarefa as any).data_inicio_planejada
                          ? format(parseLocalDateOrNow((tarefa as any).data_inicio_planejada), "dd MMM yyyy", { locale: ptBR })
                          : "Definir início (obrigatório)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseLocalDate((tarefa as any).data_inicio_planejada) ?? undefined}
                        onSelect={d => {
                          if (d) {
                            onUpdate(tarefa.id, { data_inicio_planejada: formatLocalDate(d) } as any);
                            setInicioPicker(false);
                          }
                        }}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  </>)}

                  {/* Próxima ação */}
                  <span className="text-muted-foreground">Próxima ação</span>
                  <Popover open={proximaAcaoPicker} onOpenChange={setProximaAcaoPicker}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {(tarefa as any).data_proxima_acao
                          ? format(parseLocalDateOrNow((tarefa as any).data_proxima_acao), "dd MMM yyyy", { locale: ptBR })
                          : "Definir próxima ação"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseLocalDate((tarefa as any).data_proxima_acao) ?? undefined}
                        onSelect={d => {
                          if (d) {
                            onUpdate(tarefa.id, { data_proxima_acao: formatLocalDate(d) } as any);
                            setProximaAcaoPicker(false);
                          }
                        }}
                        className="p-3 pointer-events-auto"
                      />
                      {(tarefa as any).data_proxima_acao && (
                        <div className="border-t p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs"
                            data-testid="clear-data-proxima-acao"
                            onClick={() => {
                              onUpdate(tarefa.id, { data_proxima_acao: null } as any);
                              setProximaAcaoPicker(false);
                            }}
                          >
                            Limpar data
                          </Button>
                        </div>
                      )}
                    </PopoverContent>

                  </Popover>



                  {/* Alertar antes */}
                  {canViewUI("campo_alertar_antes") && (<>
                  <span className="text-muted-foreground">Alertar antes</span>
                  <Select
                    value={String((tarefa as any).dias_alerta_antes ?? 2)}
                    onValueChange={v => onUpdate(tarefa.id, { dias_alerta_antes: parseInt(v) } as any)}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 7].map(d => (
                        <SelectItem key={d} value={String(d)}>{d} dia{d > 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </>)}

                  {/* Risk badge */}
                  {canViewUI("campo_risco") && (<>
                  <span className="text-muted-foreground">Risco</span>
                  <div>
                    <TarefaRiskBadge
                      status={tarefa.status}
                      dataPrazo={tarefa.data_prazo}
                      diasAlertaAntes={(tarefa as any).dias_alerta_antes ?? 2}
                    />
                    {!tarefa.data_prazo && <span className="text-xs text-muted-foreground">Defina um prazo</span>}
                  </div>
                  </>)}

                  {/* Responsável + Seguidores editáveis */}
                  {projetoId && canViewUI("campo_responsavel_seguidores") && (
                    <TarefaResponsavelSeguidoresEditor
                      tarefaId={tarefa.id}
                      projetoId={projetoId}
                      responsaveis={responsaveisDetalhe}
                      colaboradores={seguidoresDetalhe}
                      onSetResponsavelPrincipal={(userId) => onUpdate(tarefa.id, { responsavel_id: userId })}
                    />
                  )}



                  {/* Produto vinculado - apenas em projetos de produto */}
                  {isProjetoProduto && canViewUI("campo_produto") && (
                    <>
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
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 ml-auto text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                                    onClick={() => {
                                      const previo = (tarefa as any).produto_id;
                                      onUpdate(tarefa.id, { produto_id: null } as any);
                                      toast.success("Produto removido da tarefa", {
                                        action: {
                                          label: "Desfazer",
                                          onClick: () => onUpdate(tarefa.id, { produto_id: previo } as any),
                                        },
                                      });
                                    }}
                                    title="Remover produto desta tarefa"
                                  >
                                    <X className="h-3 w-3" />
                                    Remover
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
                    </>
                  )}

                  {/* Processo (nº processo + pesquisa/configuração para Gerente) */}
                  {projetoId && canViewUI("campo_processo") && (
                    <TarefaProcessoSection
                      tarefaId={tarefa.id}
                      projetoId={projetoId}
                      produtoId={(tarefa as any).produto_id || null}
                      onUpdate={onUpdate}
                    />
                  )}

                  {/* Widget Produto China */}
                  {isProjetoProduto && chinaVinculo && canViewUI("campo_china") && (
                    <>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Ship className="h-3.5 w-3.5" /> Produto China
                      </span>
                      <ChinaProdutoWidget vinculo={chinaVinculo} />
                    </>
                  )}

                  {/* Módulos Vinculados */}
                  {canViewUI("campo_modulos_vinculados") && (
                    <ModulosVinculadosWidget tarefaId={tarefa?.id} />
                  )}

                  {/* Mover para Seção */}
                  {secoes.length > 1 && onMoveTarefa && canViewUI("campo_mover_para") && (
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

                {/* Retrabalho toggle */}
                {canViewUI("secao_retrabalho") && (<>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retrabalho
                    </h3>
                    <Button
                      variant={(tarefa as any).tipo_tarefa === "retrabalho" ? "destructive" : "outline"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        const isRetrabalho = (tarefa as any).tipo_tarefa === "retrabalho";
                        onUpdate(tarefa.id, {
                          tipo_tarefa: isRetrabalho ? "padrao" : "retrabalho",
                          motivo_retrabalho: isRetrabalho ? null : (tarefa as any).motivo_retrabalho,
                        } as any);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {(tarefa as any).tipo_tarefa === "retrabalho" ? "Remover retrabalho" : "Marcar como retrabalho"}
                    </Button>
                  </div>
                  {(tarefa as any).tipo_tarefa === "retrabalho" && (
                    <Select
                      value={(tarefa as any).motivo_retrabalho || ""}
                      onValueChange={v => onUpdate(tarefa.id, { motivo_retrabalho: v } as any)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Motivo do retrabalho..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="erro_fabril">Erro fabril</SelectItem>
                        <SelectItem value="mudanca_regulatoria">Mudança regulatória</SelectItem>
                        <SelectItem value="revisao_arte">Revisão de arte</SelectItem>
                        <SelectItem value="ajuste_embalagem">Ajuste de embalagem</SelectItem>
                        <SelectItem value="feedback_cliente">Feedback do cliente</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                </>)}

                {/* Approval Panel */}
                {(tarefa as any).validacao_status === "pendente_validacao" && (
                  <>
                    <Separator />
                    <AprovacaoPanel
                      tarefaId={tarefa.id}
                      validacaoStatus={(tarefa as any).validacao_status}
                      onStatusChange={() => {
                        onUpdate(tarefa.id, {});
                      }}
                    />
                  </>
                )}

                {/* Dependências */}
                {canViewUI("secao_dependencias") && (<>
                  <Separator />
                  <ProjetoTarefaDependencias tarefaId={tarefa.id} projetoId={tarefa.projeto_id} />
                </>)}

                {/* Workflow de Aprovação Multi-Etapa */}
                {canViewUI("secao_workflow_aprovacao") && (<>
                  <Separator />
                  <ProjetoAprovacaoWorkflow tarefaId={tarefa.id} />
                </>)}




                <Separator />

                {/* Marcos/Metas */}
                {canViewUI("secao_metas") && <MetasSection tarefaId={tarefa.id} />}

                <Separator />

                {/* Descrição */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Descrição</h3>
                    <div className="flex items-center gap-1">
                      {(descValue?.length ?? 0) > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setDescExpanded(v => !v)}
                          title={descExpanded ? "Recolher descrição" : "Expandir descrição para leitura"}
                        >
                          {descExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                          {descExpanded ? "Recolher" : "Expandir"}
                        </Button>
                      )}
                      {!pendingAIDescricao && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] gap-1 text-primary hover:text-primary"
                        disabled={iaLoading === "suggest_fields"}
                        onClick={async () => {
                          try {
                            const result = await suggestFields(tarefa.titulo, tarefa.descricao, "Projeto", secoes.find(s => s.id === tarefa.secao_id)?.nome || "");
                            let dataPrazo: string | null = null;
                            if (result.dias_prazo_sugerido && !tarefa.data_prazo) {
                              const prazo = new Date();
                              prazo.setDate(prazo.getDate() + result.dias_prazo_sugerido);
                              dataPrazo = formatLocalDate(prazo);
                            }
                            setPendingAIDescricao({
                              descricao: result.descricao,
                              prioridade: result.prioridade,
                              estagio: result.estagio,
                              dataPrazo,
                              apply: {
                                descricao: true,
                                prioridade: result.prioridade !== tarefa.prioridade,
                                estagio: result.estagio !== tarefa.estagio,
                                dataPrazo: !!dataPrazo,
                              },
                            });
                          } catch { /* handled in hook */ }
                        }}
                      >
                        {iaLoading === "suggest_fields" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Sugerir com IA
                      </Button>
                    )}
                    </div>
                  </div>

                  {pendingAIDescricao && (
                    <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                      <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        Sugestões da IA — revise antes de aplicar
                      </p>

                      <div className="space-y-2">
                        <label className="flex items-start gap-2 text-xs">
                          <Checkbox
                            checked={pendingAIDescricao.apply.descricao}
                            onCheckedChange={(c) => setPendingAIDescricao(p => p && ({ ...p, apply: { ...p.apply, descricao: !!c } }))}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">Descrição</span>
                            <Textarea
                              value={pendingAIDescricao.descricao}
                              onChange={(e) => setPendingAIDescricao(p => p && ({ ...p, descricao: e.target.value }))}
                              className="mt-1 min-h-[80px] text-xs bg-background border-border/50 resize-none"
                            />
                          </div>
                        </label>

                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={pendingAIDescricao.apply.prioridade}
                            onCheckedChange={(c) => setPendingAIDescricao(p => p && ({ ...p, apply: { ...p.apply, prioridade: !!c } }))}
                          />
                          <span className="font-medium">Prioridade:</span>
                          <span className="text-muted-foreground">{tarefa.prioridade || "—"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-foreground">{pendingAIDescricao.prioridade}</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={pendingAIDescricao.apply.estagio}
                            onCheckedChange={(c) => setPendingAIDescricao(p => p && ({ ...p, apply: { ...p.apply, estagio: !!c } }))}
                          />
                          <span className="font-medium">Estágio:</span>
                          <span className="text-muted-foreground">{tarefa.estagio || "—"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-foreground">{pendingAIDescricao.estagio}</span>
                        </label>

                        {pendingAIDescricao.dataPrazo && (
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={pendingAIDescricao.apply.dataPrazo}
                              onCheckedChange={(c) => setPendingAIDescricao(p => p && ({ ...p, apply: { ...p.apply, dataPrazo: !!c } }))}
                            />
                            <span className="font-medium">Prazo sugerido:</span>
                            <span className="font-medium text-foreground">{pendingAIDescricao.dataPrazo}</span>
                          </label>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPendingAIDescricao(null)}>
                          Descartar
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={!pendingAIDescricao.apply.descricao && !pendingAIDescricao.apply.prioridade && !pendingAIDescricao.apply.estagio && !pendingAIDescricao.apply.dataPrazo}
                          onClick={() => {
                            const updates: any = {};
                            if (pendingAIDescricao.apply.descricao) {
                              updates.descricao = pendingAIDescricao.descricao;
                              setDescValue(pendingAIDescricao.descricao);
                            }
                            if (pendingAIDescricao.apply.prioridade) updates.prioridade = pendingAIDescricao.prioridade;
                            if (pendingAIDescricao.apply.estagio) updates.estagio = pendingAIDescricao.estagio;
                            if (pendingAIDescricao.apply.dataPrazo && pendingAIDescricao.dataPrazo) updates.data_prazo = pendingAIDescricao.dataPrazo;
                            if (Object.keys(updates).length > 0) onUpdate(tarefa.id, updates);
                            setPendingAIDescricao(null);
                            toast.success("Sugestões aplicadas.");
                          }}
                        >
                          Aplicar selecionadas
                        </Button>
                      </div>
                    </div>
                  )}

                  <Textarea
                    value={descValue}
                    onChange={e => setDescValue(e.target.value)}
                    onBlur={handleDescBlur}
                    placeholder="Do que se trata esta tarefa?"
                    className={cn(
                      "text-sm bg-muted/30 border-border/50 transition-[min-height,max-height] duration-200",
                      descExpanded
                        ? "min-h-[320px] max-h-[65vh] resize-y"
                        : "min-h-[80px] resize-none",
                    )}
                  />
                </div>


                {/* Briefing da Tarefa */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Briefing
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1 text-primary hover:text-primary"
                      onClick={() => setBriefingDialogOpen(true)}
                    >
                      <Sparkles className="h-3 w-3" />
                      {tarefaBriefing ? "Reimportar" : "Importar Briefing"}
                    </Button>
                  </div>
                  {tarefaBriefing && (
                    <BriefingView
                      briefing={tarefaBriefing}
                      onDelete={() => deleteTarefaBriefing.mutate(tarefaBriefing.id)}
                      onCreateTasks={() => setBriefingTasksDialogOpen(true)}
                    />
                  )}
                  {!tarefaBriefing && (
                    <p className="text-xs text-muted-foreground">Nenhum briefing importado para esta tarefa.</p>
                  )}
                </div>

                <Separator />

                {/* Subtarefas */}
                <SubtarefasSection
                  tarefa={tarefa}
                  projetoId={projetoId ?? null}
                  onUpdate={onUpdate}
                  onToggle={onToggle}
                  onAddSubtarefa={onAddSubtarefa}
                  onDelete={onDelete}
                  onOpenSubtarefa={onOpenSubtarefa}
                  teamMembers={teamMembers}
                  rootTarefaId={rootTarefaId ?? tarefa.id}
                />

                <Separator />

                {/* Anexos */}
                <TarefaAnexosSection
                  tarefaId={tarefa.id}
                  anexos={anexos}
                  produtoId={(tarefa as any).produto_id || null}
                  projetoId={projetoId}
                  currentUserPapel={currentUserPapel}
                  uploadAnexo={uploadAnexo}
                  deleteAnexo={deleteAnexo}
                  getAnexoUrl={getAnexoUrl}
                  sendToCofre={sendToCofre}
                  removeFromCofre={removeFromCofre}
                />

                <Separator />

                {/* Briefings inteligentes vinculados a esta tarefa */}
                <TarefaBriefingsSection tarefaId={tarefa.id} />




                {isProjetoProduto && (
                  <>
                    <Separator />
                    {/* Documentos vindos do Vincular China */}
                    <TarefaChinaDocsSection tarefaId={tarefa.id} />
                    <Separator />
                    {/* Lotes de aprovação (kanban de alçadas dentro da tarefa) */}
                    <TarefaAprovacoesSection tarefaId={tarefa.id} />
                    <Separator />
                  </>
                )}

                {/* Anotações pessoais (privadas) */}
                <TarefaNotasPessoaisSection tarefaId={tarefa.id} />

                <Separator />

                {/* Comentários com @menções */}
                <TarefaComentariosSection
                  comentarios={comentarios}
                  addComentario={addComentario}
                  teamMembers={teamMembers}
                  highlightCommentId={highlightCommentId}
                />

                {/* Timeline Unificada (Comentários + Atividades) */}
                <Separator />
                <ProjetoTarefaTimeline tarefaId={tarefa.id} />

                {/* Auditoria de acesso à tarefa */}
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Auditoria de acesso</h4>
                    {isAdmin && <VisibilidadeDebugDialog tarefaId={tarefa.id} />}
                  </div>
                  <TarefaAcessoHistorico tarefaId={tarefa.id} />
                </div>
              </div>

            </ScrollArea>

            {/* Lateral Chat */}
            {chatOpen && (
              <TarefaChatPanel
                messages={messages}
                sendMessage={sendMessage}
                teamMembers={teamMembers}
                currentUserId={user?.id || null}
                onClose={() => setChatOpen(false)}
                uploadAnexo={uploadAnexo}
                getAnexoUrl={getAnexoUrl}
                sendToCofre={sendToCofre}
                canPromoteToCofre={currentUserPapel === "admin_cofre" || currentUserPapel === "coordenador"}
                produtoId={(tarefa as any)?.produto_id ?? null}
                projetoId={projetoId}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>




      {/* Validação Final Dialog */}
      {(tarefa as any).produto_id && (
        <ValidacaoFinalDialog
          open={validacaoDialogOpen}
          onOpenChange={setValidacaoDialogOpen}
          tarefaId={tarefa.id}
          produtoId={(tarefa as any).produto_id}
          produtoNome={linkedProduto?.nome}
          onSuccess={() => onUpdate(tarefa.id, {})}
        />
      )}

      {/* Subtask Detail: navegação em múltiplos níveis é feita elevando o id
          selecionado ao dono do drawer (ProjetoListView) via `onOpenSubtarefa`.
          Isso mantém UM único Sheet montado — sem pilha, sem flicker. */}

      {/* Focus Mode */}
      {focusMode && focusTarefa && (
        <TarefaFocusMode
          tarefa={focusTarefa}
          open={focusMode}
          onOpenChange={(open) => {
            if (!open && !closeFocusIntentRef.current) {
              // Fechamento não solicitado (re-render colateral / Radix). Ignora.
              return;
            }
            closeFocusIntentRef.current = false;
            setFocusMode(open);
            if (!open) onOpenChange(true);
          }}
          requestExitFocus={() => { closeFocusIntentRef.current = true; }}
          onUpdate={onUpdate}
          onToggle={onToggle}
          onAddSubtarefa={onAddSubtarefa}
          onDelete={onDelete}
          onOpenSubtarefa={(subId) => onOpenSubtarefa?.(subId)}
          secoes={secoes}
          projetoTipo={projetoTipo}
          externalSaving={externalSaving}
          rootTarefaId={rootTarefaId ?? tarefa.id}
        />
      )}


      {/* Briefing Dialogs */}
      {tarefa && (
        <BriefingImportDialog
          open={briefingDialogOpen}
          onOpenChange={setBriefingDialogOpen}
          projetoId={projetoId || ""}
          tarefaId={tarefa.id}
          onSave={(nomeArquivo, campos) => {
            saveTarefaBriefing.mutate({
              projetoId: projetoId || "",
              tarefaId: tarefa.id,
              nomeArquivo,
              campos,
            });
          }}
        />
      )}

      {tarefa && tarefaBriefing?.campos && (
        <BriefingToTasksDialog
          open={briefingTasksDialogOpen}
          onOpenChange={setBriefingTasksDialogOpen}
          campos={tarefaBriefing.campos}
          secoes={secoes.length > 0 ? secoes.map(s => ({ id: s.id, nome: s.nome })) : [{ id: tarefa.secao_id, nome: "Seção" }]}
          defaultSecaoId={tarefa.secao_id}
          onCreateTasks={(tasks) => {
            if (onAddSubtarefa) {
              for (const t of tasks) {
                onAddSubtarefa(t.titulo, rootTarefaId ?? tarefa.id, tarefa.secao_id);
              }
            }
          }}
        />
      )}
    </>
  );
}

/** Metas/Marcos Section */
function MetasSection({ tarefaId }: { tarefaId: string }) {
  const { metas, addMeta, toggleMeta, deleteMeta } = useProjetoTarefaMetas(tarefaId);
  const [newMeta, setNewMeta] = useState("");

  const handleAdd = () => {
    if (!newMeta.trim()) return;
    addMeta.mutate({ descricao: newMeta.trim() });
    setNewMeta("");
  };

  const completed = metas.filter(m => m.concluida).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5" />
          Marcos
          {metas.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
              {completed}/{metas.length}
            </Badge>
          )}
        </h3>
      </div>
      {metas.length > 0 && (
        <div className="space-y-1 mb-2">
          {metas.map(meta => (
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
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="Adicionar marco..."
          className="h-7 text-xs flex-1"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAdd} disabled={!newMeta.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
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
