import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Circle, CheckCircle2, Plus, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { TarefaRiskBadge } from "./TarefaRiskBadge";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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

export type TeamMember = { id: string; nome: string; avatar_url: string | null };

interface ProjetoTarefaRowProps {
  tarefa: ProjetoTarefa;
  indented?: boolean;
  selected?: boolean;
  onToggle: (tarefa: ProjetoTarefa) => void;
  onSelect?: (tarefa: ProjetoTarefa) => void;
  onUpdate?: (id: string, updates: Record<string, any>) => void;
  teamMembers?: TeamMember[];
  onAddColaborador?: (tarefaId: string, userId: string) => void;
  onRemoveColaborador?: (tarefaId: string, userId: string) => void;
}

export function ProjetoTarefaRow({
  tarefa, indented = false, selected = false,
  onToggle, onSelect, onUpdate,
  teamMembers = [], onAddColaborador, onRemoveColaborador,
}: ProjetoTarefaRowProps) {
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

        {/* Title - inline editable */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {tarefa.produto_foto_url && (
            <ProductThumbnail src={tarefa.produto_foto_url} alt={tarefa.titulo} size="sm" className="flex-shrink-0" />
          )}
          {tarefa.codigo && (
            <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{tarefa.codigo}</span>
          )}
          <InlineTitle
            value={tarefa.titulo}
            isCompleted={isCompleted}
            isBold={hasSubtarefas && !indented}
            onSave={(val) => onUpdate?.(tarefa.id, { titulo: val })}
            onClick={() => onSelect?.(tarefa)}
          />
          {hasSubtarefas && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 text-muted-foreground border-border/50 flex-shrink-0">
              {subtaskCompleted}/{subtaskTotal} ts
            </Badge>
          )}
          <TarefaRiskBadge
            status={tarefa.status}
            dataPrazo={tarefa.data_prazo}
            diasAlertaAntes={(tarefa as any).dias_alerta_antes ?? 2}
            compact
          />
        </div>

        {/* Responsável - inline picker */}
        <div className="flex items-center gap-1.5 min-w-0">
          <PersonPicker
            current={tarefa.responsavel}
            members={teamMembers}
            onSelect={(userId) => onUpdate?.(tarefa.id, { responsavel_id: userId })}
          />
        </div>

        {/* Data prazo - inline date picker */}
        <div className="text-xs min-w-0">
          <InlineDatePicker
            value={tarefa.data_prazo}
            isOverdue={!!isOverdue}
            isDueToday={!!isDueToday}
            onChange={(date) => onUpdate?.(tarefa.id, { data_prazo: date })}
          />
        </div>

        {/* Colaboradores - inline add/remove */}
        <div className="flex items-center">
          <ColaboradoresPicker
            colaboradores={tarefa.colaboradores || []}
            members={teamMembers}
            onAdd={(userId) => onAddColaborador?.(tarefa.id, userId)}
            onRemove={(userId) => onRemoveColaborador?.(tarefa.id, userId)}
          />
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
            isToday(new Date(tarefa.updated_at))
              ? "Hoje"
              : formatDistanceToNow(new Date(tarefa.updated_at), { locale: ptBR, addSuffix: false })
          ) : null}
        </div>

        {/* Status */}
        <div className="flex justify-center">
          <InlineSelector
            value={tarefa.status}
            options={STATUS_OPTIONS}
            colors={STATUS_COLORS}
            labels={STATUS_LABELS}
            onChange={(val) => onUpdate?.(tarefa.id, { status: val })}
          />
        </div>

        {/* Estágio */}
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
        <ProjetoTarefaRow
          key={st.id} tarefa={st} indented
          onToggle={onToggle} onSelect={onSelect} onUpdate={onUpdate}
          teamMembers={teamMembers}
          onAddColaborador={onAddColaborador}
          onRemoveColaborador={onRemoveColaborador}
          selected={false}
        />
      ))}
    </>
  );
}

/* ───────── Inline Title Editor ───────── */
function InlineTitle({ value, isCompleted, isBold, onSave, onClick }: {
  value: string; isCompleted: boolean; isBold: boolean;
  onSave: (val: string) => void; onClick: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="h-6 text-sm px-1 py-0 border-primary/50"
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={cn(
        "text-sm truncate cursor-pointer hover:text-primary transition-colors",
        isCompleted && "line-through text-muted-foreground",
        isBold && "font-medium"
      )}
      onClick={onClick}
      onDoubleClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      title="Clique duplo para editar"
    >
      {value}
    </span>
  );
}

/* ───────── Person Picker (Responsável) ───────── */
function PersonPicker({ current, members, onSelect }: {
  current: { id: string; nome: string; avatar_url: string | null } | null | undefined;
  members: TeamMember[];
  onSelect: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = members.filter(m =>
    m.nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity min-w-0">
          {current ? (
            <>
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarImage src={current.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                  {current.nome?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-foreground/80 truncate hidden xl:inline">{current.nome?.split(" ")[0]}</span>
            </>
          ) : (
            <div className="h-6 w-6 rounded-full border border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors">
              <UserPlus className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start" onClick={e => e.stopPropagation()}>
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs mb-2"
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {current && (
            <button
              onClick={() => { onSelect(null); setOpen(false); setSearch(""); }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted/50 text-red-400"
            >
              <X className="h-3 w-3" /> Remover responsável
            </button>
          )}
          {filtered.map(m => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id); setOpen(false); setSearch(""); }}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted/50 transition-colors",
                current?.id === m.id && "bg-muted/30 font-medium"
              )}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={m.avatar_url || undefined} />
                <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{m.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate">{m.nome}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────── Inline Date Picker ───────── */
function InlineDatePicker({ value, isOverdue, isDueToday, onChange }: {
  value: string | null; isOverdue: boolean; isDueToday: boolean;
  onChange: (date: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1 hover:text-foreground transition-colors text-xs",
            isOverdue ? "text-red-400 font-medium" : isDueToday ? "text-amber-400" : "text-muted-foreground"
          )}
        >
          {value
            ? format(new Date(value), "dd MMM", { locale: ptBR })
            : <span className="text-muted-foreground/50 hover:text-muted-foreground">—</span>
          }
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" onClick={e => e.stopPropagation()}>
        <CalendarComponent
          mode="single"
          selected={dateObj}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
          locale={ptBR}
          initialFocus
        />
        {value && (
          <div className="border-t p-2">
            <button
              onClick={() => { onChange(null); setOpen(false); }}
              className="text-xs text-red-400 hover:text-red-300 w-full text-center"
            >
              Remover data
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ───────── Colaboradores Picker ───────── */
function ColaboradoresPicker({ colaboradores, members, onAdd, onRemove }: {
  colaboradores: { user_id: string; nome: string; avatar_url: string | null }[];
  members: TeamMember[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const colabIds = new Set(colaboradores.map(c => c.user_id));

  const filtered = members.filter(m =>
    m.nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button onClick={e => e.stopPropagation()} className="flex items-center -space-x-1 hover:opacity-80 transition-opacity">
          {colaboradores.length > 0 ? (
            <>
              {colaboradores.slice(0, 3).map(c => (
                <Avatar key={c.user_id} className="h-5 w-5 border border-background">
                  <AvatarImage src={c.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-muted">{c.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
              {colaboradores.length > 3 && (
                <span className="text-[10px] text-muted-foreground ml-1">+{colaboradores.length - 3}</span>
              )}
            </>
          ) : (
            <div className="h-5 w-5 rounded-full border border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors">
              <Plus className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" onClick={e => e.stopPropagation()}>
        <Input
          placeholder="Buscar membro..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs mb-2"
        />

        {/* Current colaboradores */}
        {colaboradores.length > 0 && (
          <div className="mb-2 pb-2 border-b border-border/30 space-y-0.5">
            <p className="text-[10px] text-muted-foreground font-medium mb-1">Colaboradores atuais</p>
            {colaboradores.map(c => (
              <div key={c.user_id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={c.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px] bg-muted">{c.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs truncate">{c.nome}</span>
                </div>
                <button onClick={() => onRemove(c.user_id)} className="text-red-400 hover:text-red-300">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Available members */}
        <div className="max-h-36 overflow-y-auto space-y-0.5">
          {filtered.filter(m => !colabIds.has(m.id)).map(m => (
            <button
              key={m.id}
              onClick={() => onAdd(m.id)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={m.avatar_url || undefined} />
                <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{m.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate">{m.nome}</span>
              <Plus className="h-3 w-3 ml-auto text-muted-foreground" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────── Inline Selector Popover ───────── */
function InlineSelector({
  value, options, colors, labels, onChange, placeholder = "—",
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
        <button onClick={e => e.stopPropagation()} className="focus:outline-none">
          {hasValue ? (
            <Badge className={cn("text-[10px] px-2 py-0 h-5 font-medium border-0 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity", colors[value])}>
              {display}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="center" onClick={e => e.stopPropagation()}>
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
