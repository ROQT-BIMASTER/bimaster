import { ProjetoAtividade } from "@/hooks/useProjetoAtividades";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MessageSquare, CheckCircle2, UserPlus, FolderPlus, ArrowRight,
  Eye, Star, Archive, ArchiveRestore
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const TIPO_CONFIG: Record<string, { icon: React.ElementType; label: string; bgClass: string }> = {
  criou_tarefa: { icon: FolderPlus, label: "adicionou tarefa", bgClass: "bg-blue-500/15 text-blue-500" },
  completou: { icon: CheckCircle2, label: "completou", bgClass: "bg-emerald-500/15 text-emerald-500" },
  comentou: { icon: MessageSquare, label: "comentou em", bgClass: "bg-amber-500/15 text-amber-500" },
  compartilhou: { icon: UserPlus, label: "compartilhou", bgClass: "bg-violet-500/15 text-violet-500" },
  moveu: { icon: ArrowRight, label: "moveu", bgClass: "bg-cyan-500/15 text-cyan-500" },
};

interface ProjetoInboxCardProps {
  atividade: ProjetoAtividade;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onOpenDetail?: (atividade: ProjetoAtividade) => void;
  onMarcarLida?: () => void;
  onToggleFavorita?: () => void;
  onArquivar?: () => void;
  showArquivarRestore?: boolean;
}

export function ProjetoInboxCard({
  atividade,
  selected,
  onSelect,
  onOpenDetail,
  onMarcarLida,
  onToggleFavorita,
  onArquivar,
  showArquivarRestore,
}: ProjetoInboxCardProps) {
  const config = TIPO_CONFIG[atividade.tipo] || TIPO_CONFIG.criou_tarefa;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-all border-b border-border/30 group cursor-pointer relative",
        !atividade.lida && "bg-primary/[0.04]",
        selected && "bg-primary/10"
      )}
      onClick={() => onOpenDetail?.(atividade)}
    >
      {/* Project color bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
        style={{ backgroundColor: atividade.projeto_cor || "hsl(var(--primary))" }}
      />

      {/* Checkbox */}
      {onSelect && (
        <div className="pt-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect(atividade.id)}
            className="h-4 w-4"
          />
        </div>
      )}

      {/* Unread dot */}
      <div className="w-2 pt-2 flex-shrink-0">
        {!atividade.lida && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
      </div>

      {/* Type icon */}
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", config.bgClass)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-semibold text-foreground">{atividade.user_nome}</span>
          {" "}
          <span className="text-muted-foreground">{config.label}</span>
          {atividade.descricao && (
            <span className="text-foreground font-medium"> "{atividade.descricao.length > 60 ? atividade.descricao.slice(0, 60) + "…" : atividade.descricao}"</span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
            style={{
              backgroundColor: (atividade.projeto_cor || "#6366f1") + "20",
              color: atividade.projeto_cor || "#6366f1",
            }}
          >
            {atividade.projeto_nome}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(atividade.created_at), { addSuffix: true, locale: ptBR })}
          </span>
          {atividade.favorita && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
        </div>
        {/* Content preview for comments */}
        {atividade.tipo === "comentou" && atividade.metadata?.comentario && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 bg-muted/30 rounded px-2 py-1 border-l-2 border-muted-foreground/20">
            {(atividade.metadata.comentario as string).slice(0, 120)}
          </p>
        )}
      </div>

      {/* Avatar */}
      <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
        <AvatarImage src={atividade.user_avatar || undefined} />
        <AvatarFallback className="text-[10px] bg-muted">{atividade.user_nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      {/* Quick actions */}
      <div
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {!atividade.lida && onMarcarLida && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar como lida" onClick={onMarcarLida}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        {onToggleFavorita && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title={atividade.favorita ? "Remover favorito" : "Favoritar"} onClick={onToggleFavorita}>
            <Star className={cn("h-3.5 w-3.5", atividade.favorita && "fill-amber-400 text-amber-400")} />
          </Button>
        )}
        {onArquivar && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title={showArquivarRestore ? "Desarquivar" : "Arquivar"} onClick={onArquivar}>
            {showArquivarRestore ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}
