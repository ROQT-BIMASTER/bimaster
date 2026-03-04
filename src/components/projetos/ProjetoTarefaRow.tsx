import { useState } from "react";
import { ChevronRight, ChevronDown, Circle, CheckCircle2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { GRID_COLS } from "./ProjetoListView";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  nao_iniciado: "bg-pink-500/20 text-pink-400",
  em_andamento: "bg-amber-500/20 text-amber-400",
  concluida: "bg-emerald-500/20 text-emerald-400",
  bloqueada: "bg-red-500/20 text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Não iniciado",
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluida: "Concluído",
  bloqueada: "Bloqueada",
};

const STATUS_OPTIONS = [
  { value: "pendente", label: "Não iniciado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluído" },
  { value: "bloqueada", label: "Bloqueada" },
];

const ESTAGIO_COLORS: Record<string, string> = {
  briefing: "bg-purple-500/20 text-purple-400",
  em_criacao: "bg-blue-500/20 text-blue-400",
  revisao: "bg-amber-500/20 text-amber-400",
  aprovado: "bg-emerald-500/20 text-emerald-400",
  producao: "bg-pink-500/20 text-pink-400",
  lancamento: "bg-pink-500/20 text-pink-400",
};

const ESTAGIO_LABELS: Record<string, string> = {
  briefing: "Briefing",
  em_criacao: "Em Criação",
  revisao: "Revisão",
  aprovado: "Aprovado",
  producao: "Produção",
  lancamento: "Lançamento",
};

const ESTAGIO_OPTIONS = [
  { value: "briefing", label: "Briefing" },
  { value: "em_criacao", label: "Em Criação" },
  { value: "revisao", label: "Revisão" },
  { value: "aprovado", label: "Aprovado" },
  { value: "producao", label: "Produção" },
  { value: "lancamento", label: "Lançamento" },
];

interface ProjetoTarefaRowProps {
  tarefa: ProjetoTarefa;
  indented?: boolean;
  selected?: boolean;
  onToggle: (tarefa: ProjetoTarefa) => void;
  onSelect?: (tarefa: ProjetoTarefa) => void;
  onUpdate?: (id: string, updates: Record<string, any>) => void;
}

export function ProjetoTarefaRow({ tarefa, indented = false, selected = false, onToggle, onSelect, onUpdate }: ProjetoTarefaRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSubtarefas = (tarefa.subtarefas?.length || 0) > 0;
  const isCompleted = tarefa.status === "concluida";
  const isOverdue = tarefa.data_prazo && isPast(new Date(tarefa.data_prazo)) && !isCompleted;
  const isDueToday = tarefa.data_prazo && isToday(new Date(tarefa.data_prazo));

  const subtaskCompleted = tarefa.subtarefas?.filter(s => s.status === "concluida").length || 0;
  const subtaskTotal = tarefa.subtarefas?.length || 0;

  return (
    <>
      <div
        className={cn(
          `group grid ${GRID_COLS} items-center gap-0 px-3 py-1.5 border-b border-border/40 hover:bg-muted/30 transition-colors min-h-[40px] relative`,
          indented && "pl-10",
          isCompleted && "opacity-60",
          selected && "bg-primary/5 border-l-2 border-l-primary"
        )}
      >
        {/* Expand toggle */}
        <div className="flex-shrink-0">
          {hasSubtarefas ? (
            <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(tarefa); }}
          className={cn(
            "flex-shrink-0 transition-colors",
            isCompleted ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {isCompleted ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <Circle className="h-[18px] w-[18px]" />}
        </button>

        {/* Title + code + product photo + subtask count */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {tarefa.produto_foto_url && (
            <ProductThumbnail src={tarefa.produto_foto_url} alt={tarefa.titulo} size="sm" className="flex-shrink-0" />
          )}
          {tarefa.codigo && (
            <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{tarefa.codigo}</span>
          )}
          <span
            className={cn(
              "text-sm truncate cursor-pointer hover:text-primary transition-colors",
              isCompleted && "line-through text-muted-foreground",
              hasSubtarefas && !indented && "font-medium"
            )}
            onClick={() => onSelect?.(tarefa)}
          >
            {tarefa.titulo}
          </span>
          {hasSubtarefas && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 text-muted-foreground border-border/50 flex-shrink-0">
              {subtaskCompleted}/{subtaskTotal} ts
            </Badge>
          )}
        </div>

        {/* Responsável */}
        <div className="flex items-center gap-1.5 min-w-0">
          {tarefa.responsavel ? (
            <>
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                  {tarefa.responsavel.nome?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-foreground/80 truncate hidden xl:inline">{tarefa.responsavel.nome?.split(" ")[0]}</span>
            </>
          ) : null}
        </div>

        {/* Data conclusão / prazo */}
        <div className="text-xs min-w-0">
          {tarefa.data_prazo ? (
            <span className={cn(
              "flex items-center gap-1",
              isOverdue ? "text-red-400 font-medium" : isDueToday ? "text-amber-400" : "text-muted-foreground"
            )}>
              {format(new Date(tarefa.data_prazo), "dd MMM", { locale: ptBR })}
            </span>
          ) : null}
        </div>

        {/* Colaboradores */}
        <div className="flex items-center">
          {tarefa.colaboradores && tarefa.colaboradores.length > 0 ? (
            <div className="flex -space-x-1">
              {tarefa.colaboradores.slice(0, 3).map(c => (
                <Avatar key={c.user_id} className="h-5 w-5 border border-background">
                  <AvatarImage src={c.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-muted">{c.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
              {tarefa.colaboradores.length > 3 && (
                <span className="text-[10px] text-muted-foreground ml-1">+{tarefa.colaboradores.length - 3}</span>
              )}
            </div>
          ) : null}
        </div>

        {/* Criador */}
        <div className="flex items-center gap-1.5 min-w-0">
          {tarefa.criador ? (
            <>
              <Avatar className="h-5 w-5 flex-shrink-0">
                <AvatarImage src={tarefa.criador.avatar_url || undefined} />
                <AvatarFallback className="text-[8px] bg-muted">
                  {tarefa.criador.nome?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-muted-foreground truncate hidden xl:inline">{tarefa.criador.nome?.split(" ")[0]}</span>
            </>
          ) : null}
        </div>

        {/* Data modificação */}
        <div className="text-[11px] text-muted-foreground min-w-0 truncate">
          {tarefa.updated_at ? (
            isDueToday
              ? "Hoje"
              : formatDistanceToNow(new Date(tarefa.updated_at), { locale: ptBR, addSuffix: false })
          ) : null}
        </div>

        {/* Status - inline editable */}
        <div className="flex justify-center">
          <InlineSelector
            value={tarefa.status}
            options={STATUS_OPTIONS}
            colors={STATUS_COLORS}
            labels={STATUS_LABELS}
            onChange={(val) => onUpdate?.(tarefa.id, { status: val })}
          />
        </div>

        {/* Estágio - inline editable */}
        <div className="flex justify-center">
          <InlineSelector
            value={tarefa.estagio || ""}
            options={ESTAGIO_OPTIONS}
            colors={ESTAGIO_COLORS}
            labels={ESTAGIO_LABELS}
            onChange={(val) => onUpdate?.(tarefa.id, { estagio: val })}
            placeholder="—"
          />
        </div>
      </div>

      {/* Subtarefas */}
      {expanded && tarefa.subtarefas?.map(st => (
        <ProjetoTarefaRow key={st.id} tarefa={st} indented onToggle={onToggle} onSelect={onSelect} onUpdate={onUpdate} selected={false} />
      ))}
    </>
  );
}

/* ───────── Inline Selector Popover ───────── */
function InlineSelector({
  value,
  options,
  colors,
  labels,
  onChange,
  placeholder = "—",
}: {
  value: string;
  options: { value: string; label: string }[];
  colors: Record<string, string>;
  labels: Record<string, string>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const display = labels[value] || placeholder;
  const hasValue = !!value && !!labels[value];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
        >
          {hasValue ? (
            <Badge className={cn("text-[10px] px-2 py-0 h-5 font-medium border-0 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity", colors[value])}>
              {display}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              {placeholder}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="center" onClick={(e) => e.stopPropagation()}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted/50 transition-colors text-left",
              value === opt.value && "bg-muted/30 font-medium"
            )}
          >
            <Badge className={cn("text-[9px] px-1.5 py-0 h-4 font-medium border-0", colors[opt.value])}>
              {opt.label}
            </Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
