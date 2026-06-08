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
  CheckCircle2, Circle, ChevronDown, ChevronRight, Trash2, Sparkles, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDateOrNow } from "@/lib/utils/parseLocalDate";
import { toast } from "sonner";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { SubtarefaResponsavelPicker } from "./SubtarefaResponsavelPicker";

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
}: SubtarefasSectionProps) {
  const { loading: iaLoading, generateChecklist } = useProjetoIA();
  const [subtarefaValue, setSubtarefaValue] = useState("");
  const [editingSubtarefaId, setEditingSubtarefaId] = useState<string | null>(null);
  const [editingSubtarefaTitulo, setEditingSubtarefaTitulo] = useState("");
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [pendingAISubtarefas, setPendingAISubtarefas] = useState<{ titulo: string; selected: boolean }[]>([]);

  const handleAdd = () => {
    if (!subtarefaValue.trim() || !onAddSubtarefa) return;
    onAddSubtarefa(subtarefaValue.trim(), tarefa.id, tarefa.secao_id);
    setSubtarefaValue("");
  };

  const allSubs = tarefa.subtarefas ?? [];
  const pendentes = allSubs.filter((s) => s.status !== "concluida");
  const concluidas = allSubs.filter((s) => s.status === "concluida");
  const total = allSubs.length;
  const done = concluidas.length;

  const renderSub = (st: typeof allSubs[number]) => {
    const stEstagioInfo = ESTAGIO_OPTIONS.find((e) => e.value === st.estagio);
    return (
      <div
        key={st.id}
        className="group border-b border-border/40 last:border-b-0 py-2 hover:bg-muted/20 transition-colors space-y-2 -mx-2 px-2 rounded-sm"
      >
        {/* Linha 1: checkbox + título + abrir + excluir */}
        <div className="flex items-center gap-2">
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
          {projetoId && (
            <SubtarefaResponsavelPicker
              subtarefaId={st.id}
              projetoId={projetoId}
              responsavelId={st.responsavel_id || null}
              responsavelNome={st.responsavel?.nome || null}
              responsavelAvatar={st.responsavel?.avatar_url || null}
            />
          )}
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
