import { memo, useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Circle, CheckCircle2, Plus, X, UserPlus, Package, RotateCcw, Trash2, Search, Check, Target, MoreHorizontal, Ban, CalendarPlus, Hash, CalendarX, UserX, UserCheck } from "lucide-react";
import { AsanaBadge } from "@/components/projetos/shared/AsanaBadge";
import { CanalCriacaoBadge } from "@/components/projetos/shared/CanalCriacaoBadge";
import { DescricaoIndicator } from "@/components/projetos/shared/DescricaoIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { addDays, parseISO } from "date-fns";
import { MetasProgress } from "@/hooks/useMetasProgress";
import { cn } from "@/lib/utils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { TarefaRiskBadge } from "./TarefaRiskBadge";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { GRID_COLS } from "./ProjetoListView";
import { ColumnConfig, buildGridCols } from "./ColumnConfigPopover";
import { TarefaEspelhoBadge } from "./TarefaEspelhoBadge";

import {
  STATUS_LABELS, STATUS_OPTIONS, STATUS_COLORS_LIST as STATUS_COLORS, STATUS_COLORS_LIST_DARK as STATUS_COLORS_DARK,
  ESTAGIO_LABELS, ESTAGIO_OPTIONS, ESTAGIO_COLORS_LIST as ESTAGIO_COLORS,
  PRIORITY_MAP, PRIORITY_REVERSE,
} from "@/lib/projetoConstants";
import { useTarefaDensity } from "@/hooks/useTarefaDensity";
import { useRowMountCounter } from "@/lib/tarefas/instrumentation";

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
  metasProgress?: MetasProgress;
}

function ProjetoTarefaRowImpl({
  tarefa, indented = false, selected = false,
  onToggle, onSelect, onUpdate, onDelete,
  teamMembers = [], onAddColaborador, onRemoveColaborador, darkBg = false, columns, metasProgress,
}: ProjetoTarefaRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { isCompact } = useTarefaDensity();
  const { user } = useAuth();
  useRowMountCounter(tarefa.id);
  const isMine = !!user?.id && tarefa.responsavel_id === user.id;
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
          `group items-center gap-0 px-3 transition-colors relative`,
          isCompact ? "py-1 min-h-[32px] text-[12.5px]" : "py-1.5 min-h-[40px]",
          columns ? "" : `grid ${GRID_COLS}`,
          darkBg ? "border-b border-white/10 hover:bg-white/5" : "border-b border-border/60 hover:bg-muted/30",
          // Fundo sutil para distinguir subtarefas de tarefas raiz
          indented && !darkBg && "bg-subtask hover:bg-subtask-hover",
          indented && darkBg && "bg-white/[0.03] hover:bg-white/[0.06]",
          indented && "pl-10",
          isCompleted && "opacity-70",
          selected && (darkBg ? "bg-white/10 border-l-2 border-l-primary" : "bg-primary/5 border-l-2 border-l-primary")
        )}
        style={columns ? { display: "grid", gridTemplateColumns: gridStyle } : undefined}
      >
        {/* Expand toggle */}
        <div className={cn("flex-shrink-0 border-r", darkBg ? "border-white/10" : "border-border/40")}>
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
            "flex-shrink-0 transition-colors border-r",
            darkBg ? "border-white/10" : "border-border/40",
            isCompleted ? "text-emerald-400" : (darkBg ? "text-white/40 hover:text-white" : "text-muted-foreground hover:text-foreground")
          )}
        >
          {isCompleted ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <Circle className="h-[18px] w-[18px]" />}
        </button>

        {/* Title - inline editable */}
        <div className={cn("flex items-center gap-2 min-w-0 pr-2 border-r", darkBg ? "border-white/10" : "border-border/40")}>
          {tarefa.produto_foto_url && (
            <ProductThumbnail src={tarefa.produto_foto_url} alt={tarefa.titulo} size="sm" className="flex-shrink-0" />
          )}
          {tarefa.codigo && (
            <span className={`text-[10px] font-mono flex-shrink-0 ${darkBg ? "text-white/50" : "text-foreground/60"}`}>{tarefa.codigo}</span>
          )}
          {(tarefa as any).codigo_acom && (
            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">{(tarefa as any).codigo_acom}</span>
          )}
          {tarefa.numero_processo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(tarefa.numero_processo!);
              }}
              title={`Processo ${tarefa.numero_processo} — clique para copiar`}
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 transition-colors",
                darkBg
                  ? "border-white/15 text-white/70 hover:bg-white/10"
                  : "border-border/60 text-foreground/70 hover:bg-muted"
              )}
            >
              <Hash className="h-2.5 w-2.5" />
              {tarefa.numero_processo}
            </button>
          )}
          <InlineTitle
            value={tarefa.titulo}
            isCompleted={isCompleted}
            isBold={hasSubtarefas && !indented}
            onSave={(val) => onUpdate?.(tarefa.id, { titulo: val })}
            onClick={() => onSelect?.(tarefa)}
            darkBg={darkBg}
          />
          <AsanaBadge gid={(tarefa as any).asana_gid} />
          <CanalCriacaoBadge canal={(tarefa as any).canal_criacao} />
          <DescricaoIndicator
            descricao={tarefa.descricao}
            onSave={async (val) => onUpdate?.(tarefa.id, { descricao: val })}
            onClick={() => onSelect?.(tarefa)}
          />
          {hasSubtarefas && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 text-muted-foreground border-border/50 flex-shrink-0">
              {subtaskCompleted}/{subtaskTotal} ts
            </Badge>
          )}
          {metasProgress && metasProgress.total > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-5 gap-1 flex-shrink-0 border-border/50",
                metasProgress.percent === 100 ? "text-emerald-400 border-emerald-400/30" : "text-muted-foreground"
              )}
              title={`Checklist: ${metasProgress.concluidas}/${metasProgress.total} (${metasProgress.percent}%)`}
            >
              <Target className="h-2.5 w-2.5" />
              <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    metasProgress.percent === 100 ? "bg-emerald-400" : "bg-primary"
                  )}
                  style={{ width: `${metasProgress.percent}%` }}
                />
              </div>
              {metasProgress.concluidas}/{metasProgress.total}
            </Badge>
          )}
          <TarefaRiskBadge
            status={tarefa.status}
            dataPrazo={tarefa.data_prazo}
            diasAlertaAntes={(tarefa as any).dias_alerta_antes ?? 2}
            compact
          />
          <TarefaEspelhoBadge tarefaId={tarefa.id} status={tarefa.status} />
          {!isCompleted && !tarefa.data_prazo && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex-shrink-0"
              title="Tarefa ativa sem prazo definido — não dispara alertas de risco"
            >
              <CalendarX className="h-2.5 w-2.5" />
              Sem prazo
            </Badge>
          )}
          {!isCompleted && !tarefa.responsavel_id && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex-shrink-0"
              title="Tarefa ativa sem responsável atribuído"
            >
              <UserX className="h-2.5 w-2.5" />
              Sem responsável
            </Badge>
          )}
          {isMine && !isCompleted && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-primary/10 text-primary border-primary/30 flex-shrink-0"
              title="Você é o responsável por esta tarefa"
            >
              <UserCheck className="h-2.5 w-2.5" />
              Sou responsável
            </Badge>
          )}
          {(tarefa as any).tipo_tarefa === "retrabalho" && (
            <Badge className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-amber-500/15 text-amber-500 border-0 flex-shrink-0">
              <RotateCcw className="h-2.5 w-2.5" />
              Retrabalho
            </Badge>
          )}
        </div>

        {/* Produto vinculado */}
        {vis("produto") && (
        <div className={cn("flex items-center gap-1 min-w-0 overflow-hidden border-r", darkBg ? "border-white/10" : "border-border/40")}>
          {(() => {
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
        )}

        {/* Separator column */}
        <div className={cn("border-r", darkBg ? "border-white/10" : "border-border/40")} />

        {/* Responsável - inline picker */}
        {vis("responsavel") && (
        <div className={cn("flex items-center gap-1.5 min-w-0 border-r", darkBg ? "border-white/10" : "border-border/40")}>
          <PersonPicker
            current={tarefa.responsavel}
            members={teamMembers}
            onSelect={(userId) => onUpdate?.(tarefa.id, { responsavel_id: userId })}
          />
        </div>
        )}

        {/* Equipe (seguidores) - inline picker */}
        {vis("equipe") && (
        <div className={cn("flex items-center gap-1.5 min-w-0 px-2 border-r", darkBg ? "border-white/10" : "border-border/40")}>
          <ColaboradoresPicker
            colaboradores={tarefa.colaboradores || []}
            members={teamMembers}
            onAdd={(userId) => onAddColaborador?.(tarefa.id, userId)}
            onRemove={(userId) => onRemoveColaborador?.(tarefa.id, userId)}
          />
        </div>
        )}

        {/* Status */}
        {vis("status") && (
        <div className={cn("flex justify-center border-r", darkBg ? "border-white/10" : "border-border/40")}>
          <InlineSelector
            value={tarefa.status}
            options={STATUS_OPTIONS}
            colors={darkBg ? STATUS_COLORS_DARK : STATUS_COLORS}
            labels={STATUS_LABELS}
            onChange={(val) => onUpdate?.(tarefa.id, { status: val })}
          />
        </div>
        )}

        {/* Timeline bar */}
        {vis("timeline") && (
        <div className={cn("flex items-center px-1 border-r", darkBg ? "border-white/10" : "border-border/40")}>
          <TimelineBar
            dataInicio={(tarefa as any).data_inicio}
            dataPrazo={tarefa.data_prazo}
            isCompleted={isCompleted}
            onChangeInicio={(date) => onUpdate?.(tarefa.id, { data_inicio: date })}
            onChangePrazo={(date) => onUpdate?.(tarefa.id, { data_prazo: date })}
          />
        </div>
        )}

        {/* Data prazo - inline date picker */}
        {vis("prazo") && (
        <div className={cn("text-xs min-w-0 border-r", darkBg ? "border-white/10" : "border-border/40")}>
          <InlineDatePicker
            value={tarefa.data_prazo}
            isOverdue={!!isOverdue}
            isDueToday={!!isDueToday}
            onChange={(date) => onUpdate?.(tarefa.id, { data_prazo: date })}
          />
        </div>
        )}

        {/* Prioridade - estrelas */}
        {vis("prioridade") && (
        <div className="flex justify-center items-center gap-0.5">
          <PriorityStars
            value={tarefa.prioridade}
            onChange={(val) => onUpdate?.(tarefa.id, { prioridade: val })}
          />
          <TarefaActionsMenu
            tarefa={tarefa}
            darkBg={darkBg}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
        )}

        {/* Actions menu when prioridade is hidden */}
        {!vis("prioridade") && (
          <div className="absolute right-2">
            <TarefaActionsMenu
              tarefa={tarefa}
              darkBg={darkBg}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>

      {/* Subtarefas */}
      {expanded && tarefa.subtarefas?.map(st => (
        <ProjetoTarefaRow
          key={(st as any).__clientKey || st.id} tarefa={st} indented
          onToggle={onToggle} onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete}
          teamMembers={teamMembers}
          onAddColaborador={onAddColaborador}
          onRemoveColaborador={onRemoveColaborador}
          selected={false}
          darkBg={darkBg}
          columns={columns}
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
        <button
          onClick={e => e.stopPropagation()}
          aria-label={current ? `Responsável: ${current.nome}. Clique para alterar` : "Atribuir responsável"}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity min-w-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
        >
          {current ? (
            <>
              <SmartAvatar
                src={current.avatar_url}
                nome={current.nome}
                identifier={current.id}
                fallbackNome="Membro"
                className="h-6 w-6 flex-shrink-0 ring-2 ring-primary/20"
                fallbackClassName="text-[10px] font-semibold"
              />
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
                  <AvatarImage src={m.avatar_url || undefined} referrerPolicy="no-referrer" />
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
          {members.length === 0 && (
            <div className="px-3 py-4 text-center space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                Nenhum membro cadastrado neste projeto.
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Adicione membros na aba <span className="font-semibold text-foreground/80">Equipe</span> para poder atribuir um responsável.
              </p>
            </div>
          )}
          {members.length > 0 && filtered.length === 0 && (
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
          aria-label={value ? `Prazo: ${format(new Date(value), "dd/MM/yyyy")}. Clique para alterar` : "Definir prazo"}
          className={cn(
            "flex items-center gap-1 hover:text-foreground transition-colors text-xs rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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
        <button
          onClick={e => e.stopPropagation()}
          aria-label={colaboradores.length > 0 ? `${colaboradores.length} colaborador(es). Clique para gerenciar` : "Adicionar colaborador"}
          className="flex items-center -space-x-1.5 hover:opacity-80 transition-opacity rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
        >
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
          {members.length === 0 ? (
            <div className="px-3 py-4 text-center space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                Nenhum membro cadastrado neste projeto.
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Adicione membros na aba <span className="font-semibold text-foreground/80">Equipe</span> para poder atribuí-los como seguidores.
              </p>
            </div>
          ) : (
            <>
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
            </>
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
        <button
          onClick={e => e.stopPropagation()}
          aria-label={hasValue ? `${placeholder}: ${display}. Clique para alterar` : `Definir ${placeholder.toLowerCase()}`}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
        >
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

// ─── Actions menu (cancelar / prorrogar / excluir) ───
function TarefaActionsMenu({
  tarefa,
  darkBg,
  onUpdate,
  onDelete,
}: {
  tarefa: ProjetoTarefa;
  darkBg: boolean;
  onUpdate?: (id: string, updates: Record<string, any>) => void;
  onDelete?: (id: string) => void;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const isCancelada = tarefa.status === "cancelada";

  const extend = (days: number) => {
    const base = tarefa.data_prazo ? parseISO(tarefa.data_prazo) : new Date();
    const next = addDays(base, days);
    onUpdate?.(tarefa.id, { data_prazo: format(next, "yyyy-MM-dd") });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded",
            darkBg ? "text-white/60 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Ações da tarefa"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CalendarPlus className="h-3.5 w-3.5 mr-2" />
            Prorrogar prazo
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => extend(1)}>+1 dia</DropdownMenuItem>
            <DropdownMenuItem onClick={() => extend(3)}>+3 dias</DropdownMenuItem>
            <DropdownMenuItem onClick={() => extend(7)}>+1 semana</DropdownMenuItem>
            <DropdownMenuItem onClick={() => extend(15)}>+15 dias</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setCalOpen(true); }}>
              Escolher data...
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {isCancelada ? (
          <DropdownMenuItem onClick={() => onUpdate?.(tarefa.id, { status: "pendente" })}>
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Reativar tarefa
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onUpdate?.(tarefa.id, { status: "cancelada" })}>
            <Ban className="h-3.5 w-3.5 mr-2" />
            Cancelar tarefa
          </DropdownMenuItem>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(tarefa.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Excluir tarefa
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>

      {/* Calendário para data customizada */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <span className="sr-only">Calendário</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <CalendarComponent
            mode="single"
            selected={tarefa.data_prazo ? parseISO(tarefa.data_prazo) : undefined}
            onSelect={(date) => {
              if (date) {
                onUpdate?.(tarefa.id, { data_prazo: format(date, "yyyy-MM-dd") });
                setCalOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </DropdownMenu>
  );
}

// Memoized export: re-renders only when tarefa identity/updated_at, columns,
// teamMembers, selection or display flags change. Stable callbacks (useCallback)
// upstream are required to maximize benefit.
export const ProjetoTarefaRow = memo(ProjetoTarefaRowImpl, (prev, next) => {
  if (prev.tarefa.id !== next.tarefa.id) return false;
  if (prev.tarefa.updated_at !== next.tarefa.updated_at) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.indented !== next.indented) return false;
  if (prev.darkBg !== next.darkBg) return false;
  if (prev.columns !== next.columns) return false;
  if (prev.teamMembers !== next.teamMembers) return false;
  if (prev.metasProgress !== next.metasProgress) return false;
  // Subtarefas length/identity matters for expand toggle
  const prevSubs = prev.tarefa.subtarefas || [];
  const nextSubs = next.tarefa.subtarefas || [];
  if (prevSubs.length !== nextSubs.length) return false;
  for (let i = 0; i < prevSubs.length; i++) {
    if (((prevSubs[i] as any).__clientKey || prevSubs[i].id) !== ((nextSubs[i] as any).__clientKey || nextSubs[i].id)) return false;
    if (prevSubs[i].titulo !== nextSubs[i].titulo) return false;
    if (prevSubs[i].status !== nextSubs[i].status) return false;
    if (prevSubs[i].responsavel_id !== nextSubs[i].responsavel_id) return false;
    if (prevSubs[i].prioridade !== nextSubs[i].prioridade) return false;
    if (prevSubs[i].estagio !== nextSubs[i].estagio) return false;
    if (prevSubs[i].data_prazo !== nextSubs[i].data_prazo) return false;
  }
  return true;
});
