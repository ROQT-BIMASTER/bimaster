import { useState } from "react";
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
  onAddSubtarefa?: (titulo: string, parentId: string, secaoId: string) => void;
  onDelete?: (tarefaId: string) => void;
  onOpenSubtarefa?: (subtarefaId: string) => void;
  /** Esconde o título "Subtarefas" + contador (útil quando o consumidor já renderiza próprio header). */
  hideHeader?: boolean;
  /** Fallback adicional de hidratação de responsáveis (super-set do `projeto_membros`). */
  teamMembers?: { id: string; nome: string; avatar_url: string | null }[];
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
}: SubtarefasSectionProps) {
  const { loading: iaLoading, generateChecklist } = useProjetoIA();
  const { membros } = useProjetoMembros(projetoId || undefined);
  const [subtarefaValue, setSubtarefaValue] = useState("");
  const [editingSubtarefaId, setEditingSubtarefaId] = useState<string | null>(null);
  const [editingSubtarefaTitulo, setEditingSubtarefaTitulo] = useState("");
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [pendingAISubtarefas, setPendingAISubtarefas] = useState<{ titulo: string; selected: boolean }[]>([]);
  // Multi-level support: collapsed nodes + per-node "add subitem" inline input.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingForId, setAddingForId] = useState<string | null>(null);
  const [addingValue, setAddingValue] = useState("");

  const toggleCollapsed = (id: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = () => {
    if (!subtarefaValue.trim() || !onAddSubtarefa) return;
    onAddSubtarefa(subtarefaValue.trim(), tarefa.id, tarefa.secao_id);
    setSubtarefaValue("");
  };

  /**
   * Cria subitem de QUALQUER nó da árvore, herdando obrigatoriamente
   * projeto/seção do nó pai (garantido também por trigger no banco
   * `trg_validate_tarefa_parent_integrity`). Datas NÃO são herdadas:
   * o usuário deve configurar `data_prazo` explicitamente após criação.
   * Permissões/visibilidade derivam do mesmo `projeto_id`, então a RLS
   * existente cobre subtarefas em qualquer profundidade.
   */
  const addChildOf = (parent: typeof allSubs[number], titulo: string) => {
    if (!onAddSubtarefa || !titulo.trim()) return;
    // Guard frontend: parent deve pertencer ao mesmo projeto.
    if (projetoId && (parent as any).projeto_id && (parent as any).projeto_id !== projetoId) {
      toast.error("Não é possível criar subitem em outro projeto.");
      return;
    }
    onAddSubtarefa(titulo.trim(), parent.id, parent.secao_id);
  };

  const allSubs = tarefa.subtarefas ?? [];
  const pendentes = allSubs.filter((s) => s.status !== "concluida");
  const concluidas = allSubs.filter((s) => s.status === "concluida");
  const total = allSubs.length;
  const done = concluidas.length;

  const renderSub = (st: typeof allSubs[number], depth = 0) => {
    const stEstagioInfo = ESTAGIO_OPTIONS.find((e) => e.value === st.estagio);
    const children = (st as any).subtarefas ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedIds.has(st.id);
    return (
      <div
        key={(st as any).__clientKey || st.id}
        className={cn(
          "group border-b border-border/40 last:border-b-0 py-2 hover:bg-muted/20 transition-colors space-y-2 -mx-2 px-2 rounded-sm",
          depth > 0 && "border-l-2 border-border/30 ml-2",
        )}
        style={depth > 0 ? { marginLeft: depth * 12 } : undefined}
      >
        {/* Linha 1: chevron + checkbox + título + abrir + excluir */}
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapsed(st.id)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              title={isCollapsed ? "Expandir" : "Recolher"}
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-3.5 flex-shrink-0" />
          )}
          <button
            onClick={() => onToggle(st)}
            className={cn(
              "flex-shrink-0",
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
              className="h-7 text-sm flex-1 min-w-0"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingSubtarefaId(st.id);
                setEditingSubtarefaTitulo(st.titulo);
              }}
              className={cn(
                "text-sm flex-1 min-w-0 text-left break-words whitespace-normal hover:text-foreground transition-colors",
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
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onOpenSubtarefa(st.id)}
              title="Abrir subtarefa"
            >
              <ChevronRight className="h-3.5 w-3.5" />
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
        <div className="flex items-center gap-1.5 pl-6 flex-wrap">
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
            return (
              <>
                <SubtarefaResponsavelPicker
                  subtarefaId={st.id}
                  projetoId={projetoId}
                  responsavelId={respId}
                  responsavelNome={nome}
                  responsavelAvatar={avatar}
                />
                <SubtarefaSeguidoresPicker
                  subtarefaId={st.id}
                  projetoId={projetoId}
                  colaboradores={st.colaboradores || []}
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
          <div className="pl-6">
            {addingForId === st.id ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={addingValue}
                  onChange={(e) => setAddingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = addingValue.trim();
                      if (v) {
                        addChildOf(st, v);
                        setCollapsedIds((prev) => {
                          const n = new Set(prev);
                          n.delete(st.id);
                          return n;
                        });
                      }
                      setAddingValue("");
                      setAddingForId(null);
                    } else if (e.key === "Escape") {
                      setAddingValue("");
                      setAddingForId(null);
                    }
                  }}
                  onBlur={() => {
                    const v = addingValue.trim();
                    if (v) addChildOf(st, v);
                    setAddingValue("");
                    setAddingForId(null);
                  }}
                  placeholder="Título do subitem..."
                  className="h-7 text-xs flex-1"
                  data-testid={`subitem-input-${st.id}`}
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-primary opacity-60 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                onClick={() => {
                  setAddingForId(st.id);
                  setAddingValue("");
                }}
                data-testid={`subitem-add-${st.id}`}
              >
                <Plus className="h-3 w-3" />
                Adicionar subitem
              </Button>
            )}
          </div>
        )}

        {/* Filhos recursivos */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-1.5 mt-1">
            {children.map((child: any) => renderSub(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

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
              onClick={() => {
                const selected = pendingAISubtarefas.filter((it) => it.selected);
                if (onAddSubtarefa) {
                  for (const item of selected) {
                    onAddSubtarefa(item.titulo, tarefa.id, tarefa.secao_id);
                  }
                }
                setPendingAISubtarefas([]);
                toast.success(`${selected.length} subtarefa(s) criada(s)!`);
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
        {pendentes.map(renderSub)}

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
            {showConcluidas && <div className="space-y-1.5 mt-1">{concluidas.map(renderSub)}</div>}
          </div>
        )}
      </div>

      {onAddSubtarefa && (
        <div className="flex items-center gap-2 mt-2">
          <Input
            value={subtarefaValue}
            onChange={(e) => setSubtarefaValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Adicionar subtarefa..."
            className="h-8 text-sm"
          />
          <Button size="sm" variant="ghost" onClick={handleAdd} className="h-8">
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
