import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, Trash2, Sparkles, Loader2, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDateOrNow } from "@/lib/utils/parseLocalDate";
import { toast } from "sonner";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { SubtarefaResponsavelPicker } from "./SubtarefaResponsavelPicker";
import { SubtarefaSeguidoresPicker } from "./SubtarefaSeguidoresPicker";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { reportSubtarefaArrowEvent } from "@/lib/telemetry/subtarefaArrowTelemetry";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { flickerLog } from "@/lib/debug/flickerLog";


const MIN_TITLE_LEN = 2;
const MAX_TITLE_LEN = 200;
// Indentação da árvore vem de uma ÚNICA fonte: a CSS var `--tree-indent`
// (e o offset derivado `--tree-row-content-offset`), definidas em
// `src/index.css`. Nunca redeclare esses valores em outros componentes —
// referencie sempre as vars para manter subtarefas e subitens alinhados
// no drawer, no Focus Mode e na Central de Trabalho.
const TREE_INDENT_VAR = "var(--tree-indent)";
const TREE_ROW_CONTENT_OFFSET_VAR = "var(--tree-row-content-offset)";

/**
 * Valida título de novo subitem/subtarefa antes de disparar a criação.
 * Retorna string de erro (pronta para toast) ou null se OK.
 * Duplicidade é comparada apenas contra irmãos diretos (case-insensitive + trim).
 */
function validateNewTitle(
  titulo: string,
  siblings: { titulo: string }[],
): string | null {
  const t = titulo.trim();
  if (!t) return "Informe um título para o subitem.";
  if (t.length < MIN_TITLE_LEN) return `O título precisa ter ao menos ${MIN_TITLE_LEN} caracteres.`;
  if (t.length > MAX_TITLE_LEN) return `O título deve ter no máximo ${MAX_TITLE_LEN} caracteres.`;
  const norm = t.toLowerCase();
  if (siblings.some((s) => (s.titulo || "").trim().toLowerCase() === norm)) {
    return "Já existe um subitem com esse título neste nível.";
  }
  return null;
}

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

interface SubtarefasSectionProps {
  tarefa: ProjetoTarefa;
  projetoId: string | null;
  onUpdate: (id: string, updates: Partial<ProjetoTarefa>) => void;
  onToggle: (tarefa: ProjetoTarefa) => void;
  onAddSubtarefa?: (titulo: string, parentId: string, secaoId: string) => void | Promise<void>;
  onDelete?: (tarefaId: string) => void;
  onOpenSubtarefa?: (subtarefaId: string) => void;
  /** Esconde o título "Subtarefas" + contador (útil quando o consumidor já renderiza próprio header). */
  hideHeader?: boolean;
  /** Fallback adicional de hidratação de responsáveis (super-set do `projeto_membros`). */
  teamMembers?: { id: string; nome: string; avatar_url: string | null }[];
  /**
   * ID da tarefa raiz (nível 0) do drawer. Quando o drawer está aberto em uma
   * subtarefa, o input principal "Adicionar subtarefa" e a IA "Sugerir com IA"
   * usam este id como parent — assim novas subtarefas nascem sempre no mesmo
   * nível hierárquico, nunca aninhadas sob outra subtarefa. O botão explícito
   * "Adicionar subitem" (por linha) continua criando filho aninhado.
   */
  rootTarefaId?: string;
}

/**
 * UI completa de subtarefas (paridade entre detalhe normal e Modo Foco):
 * checkbox + título editável + abrir + excluir + Status/Prioridade/Estágio/Responsável
 * inline + badge de data + IA "Gerar checklist".
 *
 * Componente self-contained: gerencia seu próprio estado de edição inline,
 * pendentes IA e show/hide concluídas.
 */
export function SubtarefasSection({
  tarefa,
  projetoId,
  onUpdate,
  onToggle,
  onAddSubtarefa,
  onDelete,
  onOpenSubtarefa,
  hideHeader = false,
  teamMembers,
  rootTarefaId,
}: SubtarefasSectionProps) {
  const { loading: iaLoading, generateChecklist } = useProjetoIA();
  const { membros, isLoading: membrosLoading } = useProjetoMembros(projetoId || undefined);
  const [subtarefaValue, setSubtarefaValue] = useState("");
  const [editingSubtarefaId, setEditingSubtarefaId] = useState<string | null>(null);
  const [editingSubtarefaTitulo, setEditingSubtarefaTitulo] = useState("");
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [pendingAISubtarefas, setPendingAISubtarefas] = useState<{ titulo: string; selected: boolean }[]>([]);
  // Multi-level support: collapsed nodes + per-node "add subitem" inline input.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingForId, setAddingForId] = useState<string | null>(null);
  const [addingValue, setAddingValue] = useState("");
  // Guards sem estado visual: evita render extra (loader/disable) antes e depois
  // do patch otimista, que era percebido como “piscada” ao criar subtarefa.
  const pendingMainAddRef = useRef(false);
  const pendingChildAddsRef = useRef<Set<string>>(new Set());

  /**
   * Parent efetivo do input principal e do fluxo IA "Sugerir com IA":
   * sempre a tarefa raiz (nível 0) quando conhecida, garantindo que uma
   * subtarefa nova nasça como irmã — nunca aninhada sob outra subtarefa.
   */
  const siblingParentId = rootTarefaId ?? tarefa.id;

  const toggleCollapsed = (id: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = async () => {
    if (!onAddSubtarefa) return;
    if (pendingMainAddRef.current) return;
    flickerLog("ui-add-clicked", { level: "root", parent: siblingParentId });
    const err = validateNewTitle(subtarefaValue, allSubs);
    if (err) {
      toast.error(err);
      return;
    }
    const titulo = subtarefaValue.trim();

    pendingMainAddRef.current = true;
    setSubtarefaValue("");
    try {
      void Promise.resolve(onAddSubtarefa(titulo, siblingParentId, tarefa.secao_id))
        .then(() => toast.success("Subtarefa criada."))
        .catch(() => {
          setSubtarefaValue(titulo);
          toast.error("Não foi possível criar a subtarefa. Tente novamente.");
        })
        .finally(() => {
          pendingMainAddRef.current = false;
        });
    } catch (err) {
      pendingMainAddRef.current = false;
      setSubtarefaValue(titulo);
      toast.error("Não foi possível criar a subtarefa. Tente novamente.");
    }
  };

  /**
   * Cria subitem de QUALQUER nó da árvore, herdando obrigatoriamente
   * projeto/seção do nó pai (garantido também por trigger no banco
   * `trg_validate_tarefa_parent_integrity`). Datas NÃO são herdadas:
   * o usuário deve configurar `data_prazo` explicitamente após criação.
   * Permissões/visibilidade derivam do mesmo `projeto_id`, então a RLS
   * existente cobre subtarefas em qualquer profundidade.
   *
   * Retorna true quando o dispatch foi acionado (input pode limpar/fechar);
   * false quando a validação falhou (input permanece aberto).
   */
  const addChildOf = async (parent: typeof allSubs[number], titulo: string): Promise<boolean> => {
    if (!onAddSubtarefa) return false;
    if (pendingChildAddsRef.current.has(parent.id)) return false;
    flickerLog("ui-add-clicked", { level: "child", parent: parent.id });
    // Guard frontend: parent deve pertencer ao mesmo projeto.
    if (projetoId && (parent as any).projeto_id && (parent as any).projeto_id !== projetoId) {
      toast.error("Não é possível criar subitem em outro projeto.");
      return false;
    }
    const siblings = ((parent as any).subtarefas ?? []) as { titulo: string }[];
    const err = validateNewTitle(titulo, siblings);
    if (err) {
      toast.error(err);
      return false;
    }
    pendingChildAddsRef.current.add(parent.id);
    const tituloFinal = titulo.trim();
    try {
      void Promise.resolve(onAddSubtarefa(tituloFinal, parent.id, parent.secao_id))
        .then(() => toast.success("Subitem criado."))
        .catch(() => toast.error("Não foi possível criar o subitem. Tente novamente."))
        .finally(() => {
          pendingChildAddsRef.current.delete(parent.id);
        });
    } catch {
      pendingChildAddsRef.current.delete(parent.id);
      toast.error("Não foi possível criar o subitem. Tente novamente.");
      return false;
    }
    return true;
  };


  const allSubs = tarefa.subtarefas ?? [];
  const pendentes = allSubs.filter((s) => s.status !== "concluida");
  const concluidas = allSubs.filter((s) => s.status === "concluida");
  const total = allSubs.length;
  const done = concluidas.length;
  flickerLog("tree-render", { tarefaId: tarefa.id, total, pendentes: pendentes.length });


  /**
   * Renderiza UMA linha da árvore. O deslocamento horizontal é SEMPRE
   * `depth * var(--tree-indent)` aplicado explicitamente aqui — o passo
   * entre subtarefa (depth=0) e seu subitem (depth=1) é idêntico ao passo
   * entre subitem (depth=1) e seu neto (depth=2). Nunca dependa de
   * marginLeft/padding herdado de wrappers para calcular indentação.
   */
  const renderSub = (st: typeof allSubs[number], depth = 0) => {
    const stEstagioInfo = ESTAGIO_OPTIONS.find((e) => e.value === st.estagio);
    const children = (st as any).subtarefas ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedIds.has(st.id);
    const isCreatingChild = pendingChildAddsRef.current.has(st.id);
    return (
      <div
        key={(st as any).__clientKey || st.id}
        data-tree-row=""
        data-depth={depth}
        className={cn(
          "group border-b border-border/40 last:border-b-0 py-2 hover:bg-muted/20 transition-colors rounded-sm",
          depth > 0 && "border-l-2 border-border/30",
        )}
        style={{ marginLeft: `calc(${TREE_INDENT_VAR} * ${depth})` }}
      >

        <div className="px-2 space-y-2">
          {/* Linha 1: chevron + checkbox + título + abrir + excluir */}
          <div className="grid grid-cols-[14px_16px_minmax(0,1fr)_auto_auto] items-center gap-x-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapsed(st.id)}
                className="h-4 w-3.5 flex-shrink-0 text-muted-foreground hover:text-foreground flex items-center justify-center"
                title={isCollapsed ? "Expandir" : "Recolher"}
              >
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="h-4 w-3.5 flex-shrink-0" />
            )}
            <button
              onClick={() => onToggle(st)}
              className={cn(
                "h-4 w-4 flex-shrink-0 flex items-center justify-center",
                st.status === "concluida" ? "text-emerald-400" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {st.status === "concluida" ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </button>
            {editingSubtarefaId === st.id ? (
              <Input
                autoFocus
                value={editingSubtarefaTitulo}
                onChange={(e) => setEditingSubtarefaTitulo(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const novo = editingSubtarefaTitulo.trim();
                    if (novo && novo !== st.titulo) onUpdate(st.id, { titulo: novo } as any);
                    setEditingSubtarefaId(null);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingSubtarefaId(null);
                  }
                }}
                onBlur={() => {
                  const novo = editingSubtarefaTitulo.trim();
                  if (novo && novo !== st.titulo) onUpdate(st.id, { titulo: novo } as any);
                  setEditingSubtarefaId(null);
                }}
                className="h-7 text-sm min-w-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingSubtarefaId(st.id);
                  setEditingSubtarefaTitulo(st.titulo);
                }}
                className={cn(
                  "text-sm min-w-0 text-left break-words whitespace-normal hover:text-foreground transition-colors",
                  st.status === "concluida" && "line-through text-muted-foreground",
                )}
                title="Clique para renomear"
              >
                {st.titulo}
              </button>
            )}
            {onOpenSubtarefa && (
              <Button
                variant="ghost"
                size="icon"
                data-testid="subtarefa-open-arrow"
                data-subtarefa-id={st.id}
                aria-label={`Abrir subtarefa: ${st.titulo}`}
                title="Abrir subtarefa"
                className="h-6 w-6 min-h-6 min-w-6 md:h-6 md:w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:opacity-100"
                onClick={() => {
                  if (!st.id) {
                    reportSubtarefaArrowEvent({ type: "invalid_id", subtarefaId: st.id });
                    return;
                  }
                  reportSubtarefaArrowEvent({ type: "click", subtarefaId: st.id });
                  try {
                    onOpenSubtarefa(st.id);
                  } catch (err) {
                    reportSubtarefaArrowEvent({
                      type: "render_error",
                      subtarefaId: st.id,
                      extra: { message: (err as Error)?.message },
                    });
                    throw err;
                  }
                }}
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(st.id)}
                title="Mover subtarefa para a lixeira"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

        {/* Linha 2: controles inline */}
        <div className="flex items-center gap-1.5 flex-wrap" style={{ marginLeft: TREE_ROW_CONTENT_OFFSET_VAR }}>
          <Select value={st.status} onValueChange={(v) => onUpdate(st.id, { status: v })}>
            <SelectTrigger className="h-6 text-[10px] w-auto min-w-[80px] gap-1 border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={st.prioridade} onValueChange={(v) => onUpdate(st.id, { prioridade: v })}>
            <SelectTrigger className="h-6 text-[10px] w-auto min-w-[60px] gap-1 border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDADE_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={st.estagio || ""} onValueChange={(v) => onUpdate(st.id, { estagio: v } as any)}>
            <SelectTrigger className="h-6 text-[10px] w-auto min-w-[70px] gap-1 border-border/30">
              {stEstagioInfo ? (
                <Badge className={cn("text-[9px] border-0 px-1 py-0", stEstagioInfo.color)}>
                  {stEstagioInfo.label}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Estágio</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {ESTAGIO_OPTIONS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  <Badge className={cn("text-[9px] border-0", e.color)}>{e.label}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {projetoId && (() => {
            // Cadeia de fallback para garantir avatar/nome do responsável no
            // front, mesmo quando a subtarefa não vem 100% hidratada
            // (payload otimista, cache antigo, RLS restringindo o join em
            // profiles, ou responsável fora de `projeto_membros` mas
            // presente em `teamMembers` da RPC).
            //
            // Ordem: responsavel (join) → primeiro item de responsaveis[] →
            // match pelo responsavel_id em responsaveis[] → lookup em
            // projeto_membros → lookup em teamMembers (super-set) → "Membro".
            const respId = st.responsavel_id || null;
            const respPrimario = st.responsaveis?.[0];
            const respByIdInJunction = respId
              ? (st.responsaveis || []).find((r) => r.user_id === respId)
              : null;
            const respFromMembros = respId
              ? membros.find((m) => m.user_id === respId)
              : null;
            const respFromTeam = respId
              ? (teamMembers || []).find((tm) => tm.id === respId)
              : null;
            const nome =
              st.responsavel?.nome ||
              respByIdInJunction?.nome ||
              respPrimario?.nome ||
              respFromMembros?.profile?.nome ||
              respFromTeam?.nome ||
              (respId ? "Membro" : null);
            const avatar =
              st.responsavel?.avatar_url ||
              respByIdInJunction?.avatar_url ||
              respPrimario?.avatar_url ||
              respFromMembros?.profile?.avatar_url ||
              respFromTeam?.avatar_url ||
              null;
            // Email prioriza `projeto_membros` (fonte autoritativa com RLS),
            // caindo para `teamMembers` quando o responsável está fora do
            // pool de membros do projeto (super-set da RPC). Serve como
            // `identifier` do SmartAvatar para desambiguar homônimos e
            // apontar o dono real quando o avatar falha.
            const respEmail =
              (respFromMembros?.profile as any)?.email ||
              (respFromTeam as any)?.email ||
              null;
            return (
              <>
                <SubtarefaResponsavelPicker
                  subtarefaId={st.id}
                  projetoId={projetoId}
                  responsavelId={respId}
                  responsavelNome={nome}
                  responsavelAvatar={avatar}
                  responsavelEmail={respEmail}
                />
                <SubtarefaSeguidoresPicker
                  subtarefaId={st.id}
                  projetoId={projetoId}
                  colaboradores={(st.colaboradores || []).map((c) => {
                    // Fallback de hidratação: quando o registro veio sem
                    // nome/avatar (ex.: RPC leve, RLS restringindo o join
                    // em `profiles`), tenta preencher pelo pool de membros
                    // do projeto e pelo super-set `teamMembers`. Como último
                    // recurso mantém "Membro" + iniciais no SmartAvatar.
                    const fromMembros = membros.find((m) => m.user_id === c.user_id);
                    const fromTeam = (teamMembers || []).find((t) => t.id === c.user_id);
                    const nomeHidratado =
                      c.nome && c.nome !== "Membro"
                        ? c.nome
                        : fromMembros?.profile?.nome || fromTeam?.nome || "Membro";
                    const avatarHidratado =
                      c.avatar_url ||
                      fromMembros?.profile?.avatar_url ||
                      (fromTeam as any)?.avatar_url ||
                      null;
                    // `email` vem via projeto_membros (fonte autoritativa),
                    // com fallback para teamMembers quando o colaborador
                    // não está no pool de membros. Nunca do objeto `c`
                    // (o payload atual de colaboradores não carrega email).
                    const emailHidratado =
                      (fromMembros?.profile as any)?.email ||
                      (fromTeam as any)?.email ||
                      null;
                    return {
                      user_id: c.user_id,
                      nome: nomeHidratado,
                      avatar_url: avatarHidratado,
                      email: emailHidratado,
                    };
                  })}
                  isResolving={
                    // Só considera "resolvendo" quando os membros ainda estão
                    // carregando e ao menos um colaborador está sem hidratação
                    // completa — evita placeholder desnecessário na maioria
                    // dos casos, em que o objeto já vem hidratado.
                    membrosLoading &&
                    (st.colaboradores || []).some(
                      (c) => !c.avatar_url || !c.nome || c.nome === "Membro",
                    )
                  }
                />


              </>
            );
          })()}
          {st.data_prazo && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                parseLocalDateOrNow(st.data_prazo) < new Date() && st.status !== "concluida"
                  ? "text-destructive bg-destructive/10"
                  : "text-muted-foreground bg-muted/50",
              )}
            >
              {format(parseLocalDateOrNow(st.data_prazo), "dd MMM", { locale: ptBR })}
            </span>
          )}
        </div>

        {/* Linha 3: botão "Adicionar subitem" + input inline (multi-nível) */}
        {onAddSubtarefa && (
          <div style={{ marginLeft: TREE_ROW_CONTENT_OFFSET_VAR }}>
            {addingForId === st.id ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={addingValue}
                  onChange={(e) => setAddingValue(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const ok = await addChildOf(st, addingValue);
                      if (ok) {
                        setCollapsedIds((prev) => {
                          const n = new Set(prev);
                          n.delete(st.id);
                          return n;
                        });
                        setAddingValue("");
                        setAddingForId(null);
                      }
                      // se inválido, mantém input aberto (toast já disparado)
                    } else if (e.key === "Escape" && !isCreatingChild) {
                      setAddingValue("");
                      setAddingForId(null);
                    }
                  }}
                  onBlur={() => {
                    if (isCreatingChild) return;
                    // Blur apenas cancela o modo inline. A criação acontece
                    // por Enter/botão para evitar dispatch duplicado e piscar.
                    setAddingValue("");
                    setAddingForId(null);
                  }}
                  disabled={false}
                  placeholder="Título do subitem..."
                  className="h-9 md:h-7 text-sm md:text-xs flex-1"
                  maxLength={MAX_TITLE_LEN}
                  data-testid={`subitem-input-${st.id}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 md:h-7 md:w-7 shrink-0"
                  disabled={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={async () => {
                    const ok = await addChildOf(st, addingValue);
                    if (ok) {
                      setCollapsedIds((prev) => {
                        const n = new Set(prev);
                        n.delete(st.id);
                        return n;
                      });
                      setAddingValue("");
                      setAddingForId(null);
                    }
                  }}
                  aria-label="Salvar subitem"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 md:h-6 min-h-[32px] md:min-h-0 px-2 text-[11px] md:text-[10px] gap-1 text-muted-foreground hover:text-primary"
                       disabled={false}
                      onClick={() => {
                        setAddingForId(st.id);
                        setAddingValue("");
                      }}
                      data-testid={`subitem-add-${st.id}`}
                    >
                      <Plus className="h-3.5 w-3.5 md:h-3 md:w-3" />
                      Adicionar subitem
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-xs">
                    Subitem fica aninhado dentro desta subtarefa. Para criar uma subtarefa no mesmo nível, use o campo "Adicionar subtarefa" no fim da lista.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

          </div>
        )}
        </div>

      </div>
    );
  };

  /**
   * DFS flat: percorre a árvore e emite uma lista linear de linhas com
   * o `depth` correto para cada nó. Filhos de nós colapsados são pulados.
   * Como a indentação é aplicada por `depth * var(--tree-indent)` em cada
   * linha, todos os níveis compartilham o mesmo passo — nenhum nível herda
   * offset de wrapper.
   *
   * A lista flat é memoizada (`useMemo` nas variantes `pendentesRows` /
   * `concluidasRows`), então mudanças de colapso/expansão não recalculam a
   * árvore inteira — só a fatia afetada dispara re-render, evitando trabalho
   * desnecessário em tarefas com muitos níveis.
   */
  const flattenTree = React.useCallback(
    (nodes: typeof allSubs, depth = 0): Array<{ node: typeof allSubs[number]; depth: number }> => {
      const out: Array<{ node: typeof allSubs[number]; depth: number }> = [];
      for (const node of nodes) {
        out.push({ node, depth });
        const children = ((node as any).subtarefas ?? []) as typeof allSubs;
        if (children.length > 0 && !collapsedIds.has(node.id)) {
          out.push(...flattenTree(children, depth + 1));
        }
      }
      return out;
    },
    [collapsedIds],
  );

  const pendentesRows = useMemo(() => flattenTree(pendentes), [flattenTree, pendentes]);
  const concluidasRows = useMemo(() => flattenTree(concluidas), [flattenTree, concluidas]);

  const renderRows = (rows: Array<{ node: typeof allSubs[number]; depth: number }>) =>
    rows.map(({ node, depth }) => renderSub(node, depth));



  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">
            Subtarefas
            {total > 0 && (
              <span className="text-muted-foreground ml-1">
                ({done}/{total})
              </span>
            )}
          </h3>
          {onAddSubtarefa && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-primary hover:text-primary"
              disabled={iaLoading === "generate_checklist"}
              onClick={async () => {
                try {
                  const result = await generateChecklist(tarefa.titulo, tarefa.descricao, tarefa.estagio);
                  setPendingAISubtarefas(result.items.map((i) => ({ titulo: i.titulo, selected: true })));
                } catch {
                  /* handled in hook */
                }
              }}
            >
              {iaLoading === "generate_checklist" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Sugerir com IA
            </Button>
          )}
        </div>
      )}

      {pendingAISubtarefas.length > 0 && (
        <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
          <p className="text-xs font-medium text-primary flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Subtarefas geradas pela IA — selecione as que deseja criar:
          </p>
          {pendingAISubtarefas.map((item, i) => (
            <label
              key={i}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/20 rounded px-1 py-0.5"
            >
              <Checkbox
                checked={item.selected}
                onCheckedChange={(checked) => {
                  setPendingAISubtarefas((prev) =>
                    prev.map((it, idx) => (idx === i ? { ...it, selected: !!checked } : it)),
                  );
                }}
              />
              <span>{item.titulo}</span>
            </label>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={async () => {
                const selected = pendingAISubtarefas.filter((it) => it.selected);
                const existentes = allSubs.map((s) => ({ titulo: s.titulo }));
                let criadas = 0;
                let ignoradas = 0;
                if (onAddSubtarefa) {
                  for (const item of selected) {
                    const err = validateNewTitle(item.titulo, existentes);
                    if (err) {
                      ignoradas++;
                      continue;
                    }
                    existentes.push({ titulo: item.titulo });
                    try {
                      await Promise.resolve(onAddSubtarefa(item.titulo.trim(), siblingParentId, tarefa.secao_id));
                      criadas++;
                    } catch {
                      ignoradas++;
                    }
                  }
                }
                setPendingAISubtarefas([]);
                if (criadas > 0) {
                  toast.success(
                    ignoradas > 0
                      ? `${criadas} subtarefa(s) criada(s). ${ignoradas} ignorada(s) por duplicidade/validação.`
                      : `${criadas} subtarefa(s) criada(s).`,
                  );
                } else if (ignoradas > 0) {
                  toast.error("Nenhuma subtarefa foi criada — todas duplicadas ou inválidas.");
                }
              }}
              disabled={pendingAISubtarefas.filter((it) => it.selected).length === 0}
            >
              <CheckCircle2 className="h-3 w-3" />
              Criar {pendingAISubtarefas.filter((it) => it.selected).length} selecionada(s)
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPendingAISubtarefas([])}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {total === 0 && pendingAISubtarefas.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic mb-2 pl-1">
          Nenhuma subtarefa ainda. Adicione abaixo ou gere um checklist com IA.
        </p>
      )}

      <div className="space-y-1.5">
        {renderTree(pendentes)}

        {concluidas.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => setShowConcluidas((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {showConcluidas ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {showConcluidas ? "Ocultar" : "Mostrar"} {concluidas.length} concluída
              {concluidas.length > 1 ? "s" : ""}
            </button>
            {showConcluidas && <div className="space-y-1.5 mt-1">{renderTree(concluidas)}</div>}
          </div>
        )}
      </div>

      {onAddSubtarefa && (
        <div className="flex items-center gap-2 mt-2">
          <Input
            value={subtarefaValue}
            onChange={(e) => setSubtarefaValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
            placeholder={rootTarefaId && rootTarefaId !== tarefa.id ? "Adicionar subtarefa (mesmo nível)..." : "Adicionar subtarefa..."}
            className="h-9 md:h-8 text-sm"
            maxLength={MAX_TITLE_LEN}
            disabled={false}
          />
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={() => void handleAdd()} disabled={false} className="h-9 md:h-8 min-h-[36px] md:min-h-0 px-3 gap-1.5">
                  Adicionar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                Cria uma subtarefa no mesmo nível hierárquico da tarefa atual. Para aninhar dentro de uma subtarefa existente, use "Adicionar subitem".
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
