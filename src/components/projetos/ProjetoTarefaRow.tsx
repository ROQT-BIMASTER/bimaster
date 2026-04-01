import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Circle, CheckCircle2, Plus, X, UserPlus, Package, RotateCcw, Trash2, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { TarefaRiskBadge } from "./TarefaRiskBadge";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { GRID_COLS } from "./ProjetoListView";
import { ColumnConfig, buildGridCols } from "./ColumnConfigPopover";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-gray-400 text-white",
  nao_iniciado: "bg-gray-400 text-white",
  em_andamento: "bg-amber-500 text-white",
  concluida: "bg-emerald-500 text-white",
  bloqueada: "bg-red-500 text-white",
};

const STATUS_COLORS_DARK: Record<string, string> = {
  pendente: "bg-gray-500 text-white",
  nao_iniciado: "bg-gray-500 text-white",
  em_andamento: "bg-amber-500 text-white",
  concluida: "bg-emerald-500 text-white",
  bloqueada: "bg-red-500 text-white",
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
  briefing: "bg-purple-500 text-white",
  em_criacao: "bg-blue-500 text-white",
  revisao: "bg-amber-500 text-white",
  aprovado: "bg-emerald-500 text-white",
  producao: "bg-pink-500 text-white",
  lancamento: "bg-rose-500 text-white",
};

const ESTAGIO_COLORS_DARK: Record<string, string> = {
  briefing: "bg-purple-500 text-white",
  em_criacao: "bg-blue-500 text-white",
  revisao: "bg-amber-500 text-white",
  aprovado: "bg-emerald-500 text-white",
  producao: "bg-pink-500 text-white",
  lancamento: "bg-rose-500 text-white",
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

const PRIORITY_MAP: Record<string, number> = {
  baixa: 1, media: 2, normal: 3, alta: 4, urgente: 5,
};

const PRIORITY_REVERSE: Record<number, string> = {
  1: "baixa", 2: "media", 3: "normal", 4: "alta", 5: "urgente",
};

export type TeamMember = { id: string; nome: string; avatar_url: string | null };

interface ProjetoTarefaRowProps {
  tarefa: ProjetoTarefa;
  indented?: boolean;
  selected?: boolean;
  onToggle: (tarefa: ProjetoTarefa) => void;
  onSelect?: (tarefa: ProjetoTarefa) => void;
  onUpdate?: (id: string, updates: Record<string, any>) => void;
  onDelete?: (tarefaId: string) => void;
  teamMembers?: TeamMember[];
  onAddColaborador?: (tarefaId: string, userId: string) => void;
  onRemoveColaborador?: (tarefaId: string, userId: string) => void;
  darkBg?: boolean;
  columns?: ColumnConfig[];
}

export function ProjetoTarefaRow({
  tarefa, indented = false, selected = false,
  onToggle, onSelect, onUpdate, onDelete,
  teamMembers = [], onAddColaborador, onRemoveColaborador, darkBg = false, columns,
}: ProjetoTarefaRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSubtarefas = (tarefa.subtarefas?.length || 0) > 0;
  const isCompleted = tarefa.status === "concluida";
  const isOverdue = tarefa.data_prazo && isPast(new Date(tarefa.data_prazo)) && !isCompleted;
  const isDueToday = tarefa.data_prazo && isToday(new Date(tarefa.data_prazo));
  const subtaskCompleted = tarefa.subtarefas?.filter(s => s.status === "concluida").length || 0;
  const subtaskTotal = tarefa.subtarefas?.length || 0;

  const vis = (key: string) => !columns || columns.find(c => c.key === key)?.visible !== false;
  const gridStyle = columns ? buildGridCols(columns).replace(/_/g, " ") : undefined;

  return (
    <>
      <div
        className={cn(
          `group items-center gap-0 px-3 py-1.5 transition-colors min-h-[40px] relative`,
          columns ? "" : `grid ${GRID_COLS}`,
          darkBg ? "border-b border-white/10 hover:bg-white/5" : "border-b border-border/60 hover:bg-muted/30",
          indented && "pl-10",
          isCompleted && "opacity-70",
          selected && (darkBg ? "bg-white/10 border-l-2 border-l-primary" : "bg-primary/5 border-l-2 border-l-primary")
        )}
        style={columns ? { display: "grid", gridTemplateColumns: gridStyle } : undefined}
      >
        {/* Expand toggle */}
        <div className="flex-shrink-0">
          {hasSubtarefas ? (
            <button onClick={() => setExpanded(!expanded)} className={darkBg ? "text-white/50 hover:text-white" : "text-muted-foreground hover:text-foreground"}>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(tarefa); }}
          className={cn(
            "flex-shrink-0 transition-colors",
            isCompleted ? "text-emerald-400" : (darkBg ? "text-white/40 hover:text-white" : "text-muted-foreground hover:text-foreground")
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
            <span className={`text-[10px] font-mono flex-shrink-0 ${darkBg ? "text-white/50" : "text-foreground/60"}`}>{tarefa.codigo}</span>
          )}
          <InlineTitle
            value={tarefa.titulo}
            isCompleted={isCompleted}
            isBold={hasSubtarefas && !indented}
            onSave={(val) => onUpdate?.(tarefa.id, { titulo: val })}
            onClick={() => onSelect?.(tarefa)}
            darkBg={darkBg}
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
          {(tarefa as any).tipo_tarefa === "retrabalho" && (
            <Badge className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-amber-500/15 text-amber-500 border-0 flex-shrink-0">
              <RotateCcw className="h-2.5 w-2.5" />
              Retrabalho
            </Badge>
          )}
        </div>

        {/* Produto vinculado */}
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          {(() => {
            // Show linked_produtos from junction table, or fallback to produto_id
            const produtos = tarefa.linked_produtos && tarefa.linked_produtos.length > 0
              ? tarefa.linked_produtos
              : tarefa.produto_foto_url
                ? [{ id: tarefa.produto_id || "", nome: tarefa.produto_nome || "", foto_url: tarefa.produto_foto_url, codigo: null }]
                : [];
            if (produtos.length === 0) return <span className={`text-[10px] ${darkBg ? "text-white/30" : "text-muted-foreground/40"}`}>—</span>;
            const first = produtos[0];
            return (
              <div className="flex items-center gap-1 min-w-0" title={first.nome}>
                {first.foto_url ? (
                  <img src={first.foto_url} alt={first.nome} className="h-6 w-6 rounded object-contain bg-muted/50 flex-shrink-0" />
                ) : (
                  <div className="h-6 w-6 rounded bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <Package className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                {produtos.length > 1 && (
                  <span className={`text-[10px] flex-shrink-0 ${darkBg ? "text-white/50" : "text-muted-foreground"}`}>+{produtos.length - 1}</span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Separator: Identity | People */}
        <div className={`w-px h-5 ${darkBg ? "bg-white/8" : "bg-border/30"}`} />

        {/* Responsável - inline picker */}
        <div className="flex items-center gap-1.5 min-w-0">
          <PersonPicker
            current={tarefa.responsavel}
            members={teamMembers}
            onSelect={(userId) => onUpdate?.(tarefa.id, { responsavel_id: userId })}
          />
        </div>

        {/* Status */}
        <div className="flex justify-center">
          <InlineSelector
            value={tarefa.status}
            options={STATUS_OPTIONS}
            colors={darkBg ? STATUS_COLORS_DARK : STATUS_COLORS}
            labels={STATUS_LABELS}
            onChange={(val) => onUpdate?.(tarefa.id, { status: val })}
          />
        </div>

        {/* Timeline bar */}
        <div className="flex items-center px-1">
          <TimelineBar
            dataInicio={(tarefa as any).data_inicio}
            dataPrazo={tarefa.data_prazo}
            isCompleted={isCompleted}
            onChangeInicio={(date) => onUpdate?.(tarefa.id, { data_inicio: date })}
            onChangePrazo={(date) => onUpdate?.(tarefa.id, { data_prazo: date })}
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

        {/* Prioridade - estrelas */}
        <div className="flex justify-center items-center gap-0.5">
          <PriorityStars
            value={tarefa.prioridade}
            onChange={(val) => onUpdate?.(tarefa.id, { prioridade: val })}
          />
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(tarefa.id); }}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 ${darkBg ? "text-red-400 hover:text-red-300" : "text-destructive/60 hover:text-destructive"}`}
              title="Excluir tarefa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Subtarefas */}
      {expanded && tarefa.subtarefas?.map(st => (
        <ProjetoTarefaRow
          key={st.id} tarefa={st} indented
          onToggle={onToggle} onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete}
          teamMembers={teamMembers}
          onAddColaborador={onAddColaborador}
          onRemoveColaborador={onRemoveColaborador}
          selected={false}
          darkBg={darkBg}
        />
      ))}
    </>
  );
}

/* ───────── Inline Title Editor ───────── */
function InlineTitle({ value, isCompleted, isBold, onSave, onClick, darkBg = false }: {
  value: string; isCompleted: boolean; isBold: boolean;
  onSave: (val: string) => void; onClick: () => void; darkBg?: boolean;
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
        "text-sm cursor-pointer hover:text-primary transition-colors",
        darkBg && !isCompleted && "text-white",
        isCompleted && (darkBg ? "line-through text-white/40" : "line-through text-muted-foreground"),
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
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity min-w-0">
          {current ? (
            <>
              <Avatar className="h-6 w-6 flex-shrink-0 ring-2 ring-primary/20">
                <AvatarImage src={current.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/15 text-primary font-semibold">
                  {current.nome?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-foreground/80 truncate hidden xl:inline">{current.nome?.split(" ")[0]}</span>
            </>
          ) : (
            <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all">
              <UserPlus className="h-3 w-3 text-muted-foreground/50" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start" onClick={e => e.stopPropagation()}>
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Buscar membro..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-xs pl-8 bg-muted/30 border-border/50 focus-visible:ring-primary/30"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
          {current && (
            <button
              onClick={() => { onSelect(null); setOpen(false); setSearch(""); }}
              className="flex items-center gap-2 w-full px-2.5 py-2 text-xs rounded-md hover:bg-destructive/10 text-destructive/80 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Remover responsável
            </button>
          )}
          {filtered.map(m => {
            const isSelected = current?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { onSelect(m.id); setOpen(false); setSearch(""); }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-md transition-colors",
                  isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50"
                )}
              >
                <Avatar className={cn("h-6 w-6 flex-shrink-0", isSelected && "ring-2 ring-primary/30")}>
                  <AvatarImage src={m.avatar_url || undefined} />
                  <AvatarFallback className={cn(
                    "text-[9px] font-semibold",
                    isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {m.nome?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate flex-1 text-left">{m.nome}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-3">Nenhum membro encontrado</p>
          )}
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
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button onClick={e => e.stopPropagation()} className="flex items-center -space-x-1.5 hover:opacity-80 transition-opacity">
          {colaboradores.length > 0 ? (
            <>
              {colaboradores.slice(0, 3).map(c => (
                <Avatar key={c.user_id} className="h-5 w-5 border-2 border-background ring-1 ring-border/30">
                  <AvatarImage src={c.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-muted font-semibold">{c.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
              {colaboradores.length > 3 && (
                <div className="h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-[8px] font-semibold text-muted-foreground">+{colaboradores.length - 3}</span>
                </div>
              )}
            </>
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all">
              <Plus className="h-2.5 w-2.5 text-muted-foreground/50" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" onClick={e => e.stopPropagation()}>
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Buscar membro..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-xs pl-8 bg-muted/30 border-border/50 focus-visible:ring-primary/30"
              autoFocus
            />
          </div>
        </div>

        {/* Current colaboradores */}
        {colaboradores.length > 0 && (
          <div className="p-1.5 border-b border-border/30">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2 mb-1">
              Colaboradores ({colaboradores.length})
            </p>
            <div className="space-y-0.5">
              {colaboradores.map(c => (
                <div key={c.user_id} className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-accent/30 group transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarImage src={c.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px] bg-primary/15 text-primary font-semibold">{c.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs truncate">{c.nome}</span>
                  </div>
                  <button
                    onClick={() => onRemove(c.user_id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 transition-all"
                  >
                    <X className="h-3 w-3 text-destructive/70" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available members */}
        <div className="max-h-40 overflow-y-auto p-1.5 space-y-0.5">
          {filtered.filter(m => !colabIds.has(m.id)).length > 0 && (
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2 mb-1">Adicionar</p>
          )}
          {filtered.filter(m => !colabIds.has(m.id)).map(m => (
            <button
              key={m.id}
              onClick={() => onAdd(m.id)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-md hover:bg-accent/50 transition-colors group"
            >
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarImage src={m.avatar_url || undefined} />
                <AvatarFallback className="text-[9px] bg-muted text-muted-foreground font-semibold">{m.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate flex-1 text-left">{m.nome}</span>
              <Plus className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </button>
          ))}
          {filtered.filter(m => !colabIds.has(m.id)).length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-3">
              {search ? "Nenhum membro encontrado" : "Todos os membros já adicionados"}
            </p>
          )}
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

/* ───────── Timeline Bar ───────── */
function TimelineBar({ dataInicio, dataPrazo, isCompleted, onChangeInicio, onChangePrazo }: {
  dataInicio: string | null;
  dataPrazo: string | null;
  isCompleted: boolean;
  onChangeInicio: (date: string | null) => void;
  onChangePrazo: (date: string | null) => void;
}) {
  if (!dataInicio && !dataPrazo) {
    return (
      <div className="w-full h-2 rounded-full bg-muted/40 cursor-pointer" title="Sem datas definidas" />
    );
  }

  const now = new Date();
  const start = dataInicio ? new Date(dataInicio) : now;
  const end = dataPrazo ? new Date(dataPrazo) : new Date(start.getTime() + 7 * 86400000);
  const totalMs = Math.max(end.getTime() - start.getTime(), 86400000);
  const elapsedMs = now.getTime() - start.getTime();
  const progressPct = isCompleted ? 100 : Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const isOverdue = !isCompleted && now > end;

  const startLabel = dataInicio ? format(new Date(dataInicio), "dd MMM", { locale: ptBR }) : "";
  const endLabel = dataPrazo ? format(new Date(dataPrazo), "dd MMM", { locale: ptBR }) : "";

  return (
    <div className="w-full flex flex-col gap-0.5" title={`${startLabel} → ${endLabel}`}>
      <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden relative">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isCompleted ? "bg-emerald-500" : isOverdue ? "bg-red-500" : "bg-primary"
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground leading-none">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

/* ───────── Priority Stars ───────── */
function PriorityStars({ value, onChange }: {
  value: string;
  onChange: (val: string) => void;
}) {
  const numStars = PRIORITY_MAP[value] || 0;

  return (
    <div className="flex items-center gap-px" onClick={e => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onChange(PRIORITY_REVERSE[star === numStars ? 0 : star] || "normal")}
          className="p-0 focus:outline-none hover:scale-110 transition-transform"
          title={PRIORITY_REVERSE[star] || ""}
        >
          <svg
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              star <= numStars ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 fill-none"
            )}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
