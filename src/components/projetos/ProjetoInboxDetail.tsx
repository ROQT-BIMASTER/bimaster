import { ProjetoAtividade } from "@/hooks/useProjetoAtividades";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare, CheckCircle2, UserPlus, FolderPlus, ArrowRight,
  ExternalLink, Star, Archive, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

const TIPO_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  criou_tarefa: { icon: FolderPlus, label: "Tarefa Criada", color: "text-blue-500" },
  completou: { icon: CheckCircle2, label: "Tarefa Completada", color: "text-emerald-500" },
  comentou: { icon: MessageSquare, label: "Novo Comentário", color: "text-amber-500" },
  compartilhou: { icon: UserPlus, label: "Compartilhamento", color: "text-violet-500" },
  moveu: { icon: ArrowRight, label: "Tarefa Movida", color: "text-cyan-500" },
};

interface Props {
  atividade: ProjetoAtividade | null;
  open: boolean;
  onClose: () => void;
  onToggleFavorita?: () => void;
  onArquivar?: () => void;
}

export function ProjetoInboxDetail({ atividade, open, onClose, onToggleFavorita, onArquivar }: Props) {
  const navigate = useNavigate();
  if (!atividade) return null;

  const config = TIPO_CONFIG[atividade.tipo] || TIPO_CONFIG.criou_tarefa;
  const Icon = config.icon;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-5 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: (atividade.projeto_cor || "#6366f1") + "20" }}
            >
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base">{config.label}</SheetTitle>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-md inline-block mt-1"
                style={{
                  backgroundColor: (atividade.projeto_cor || "#6366f1") + "20",
                  color: atividade.projeto_cor || "#6366f1",
                }}
              >
                {atividade.projeto_nome}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* User info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={atividade.user_avatar || undefined} />
              <AvatarFallback className="bg-muted">{atividade.user_nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">{atividade.user_nome}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(atividade.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
          </div>

          {/* Description */}
          {atividade.descricao && (
            <div className="rounded-lg bg-muted/30 border border-border/50 p-4">
              <p className="text-sm text-foreground font-medium mb-1">Descrição</p>
              <p className="text-sm text-muted-foreground">{atividade.descricao}</p>
            </div>
          )}

          {/* Comment preview */}
          {atividade.tipo === "comentou" && atividade.metadata?.comentario && (
            <div className="rounded-lg bg-muted/30 border border-border/50 p-4">
              <p className="text-sm text-foreground font-medium mb-1">Comentário</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{atividade.metadata.comentario as string}</p>
            </div>
          )}

          {/* Metadata */}
          {atividade.metadata && Object.keys(atividade.metadata).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalhes</p>
              <div className="grid gap-2">
                {atividade.metadata.tarefa_nome && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Tarefa:</span>
                    <span className="font-medium text-foreground">{atividade.metadata.tarefa_nome as string}</span>
                  </div>
                )}
                {atividade.metadata.secao_nome && (
                  <div className="flex items-center gap-2 text-sm">
                    <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Seção:</span>
                    <span className="font-medium text-foreground">{atividade.metadata.secao_nome as string}</span>
                  </div>
                )}
                {atividade.metadata.de_status && atividade.metadata.para_status && (
                  <div className="flex items-center gap-2 text-sm">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <Badge variant="outline" className="text-[10px]">{atividade.metadata.de_status as string}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="text-[10px]">{atividade.metadata.para_status as string}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-3">
            {atividade.lida ? (
              <Badge variant="secondary" className="text-[10px]">Lida</Badge>
            ) : (
              <Badge variant="default" className="text-[10px]">Não lida</Badge>
            )}
            {atividade.favorita && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Favorita
              </Badge>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 p-4 flex items-center gap-2">
          <Button
            className="flex-1 gap-2"
            onClick={() => {
              onClose();
              navigate(`/dashboard/projetos/${atividade.projeto_id}`);
            }}
          >
            <ExternalLink className="h-4 w-4" />
            Ir para o Projeto
          </Button>
          {onToggleFavorita && (
            <Button variant="outline" size="icon" onClick={onToggleFavorita}>
              <Star className={cn("h-4 w-4", atividade.favorita && "fill-amber-400 text-amber-400")} />
            </Button>
          )}
          {onArquivar && (
            <Button variant="outline" size="icon" onClick={onArquivar}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
