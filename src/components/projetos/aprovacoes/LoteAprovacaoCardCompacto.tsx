import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AprovacaoConsolidado } from "@/hooks/useAprovacoesConsolidado";

interface Props {
  item: AprovacaoConsolidado;
  onOpen: (item: AprovacaoConsolidado) => void;
  showBreadcrumb?: boolean;
}

export function LoteAprovacaoCardCompacto({ item, onOpen, showBreadcrumb = true }: Props) {
  const isFinalizado = item.status === "concluido" || item.status === "cancelado";
  const atrasado = !!item.atrasado;

  return (
    <Card
      onClick={() => onOpen(item)}
      className={cn(
        "p-2.5 cursor-pointer hover:border-primary/40 hover:shadow-sm transition bg-card/70 backdrop-blur-sm",
        atrasado && "border-destructive/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-semibold leading-tight line-clamp-2 flex-1">
          {item.lote_nome || item.titulo || "Lote sem nome"}
        </p>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>

      {showBreadcrumb && (item.projeto_nome || item.tarefa_titulo) && (
        <p className="text-[10px] text-muted-foreground truncate mb-1.5">
          {[item.projeto_nome, item.secao_nome, item.tarefa_titulo].filter(Boolean).join(" › ")}
        </p>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {item.etapa_nome && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {item.etapa_nome}
          </Badge>
        )}
        {item.rodada > 1 && (
          <Badge variant="destructive" className="text-[10px] h-4 px-1.5">R{item.rodada}</Badge>
        )}
        {isFinalizado && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{item.status}</Badge>
        )}
        {item.qtd_documentos > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <FileText className="h-2.5 w-2.5" />
            {item.qtd_documentos}
          </span>
        )}
      </div>

      {!isFinalizado && (item.etapa_prazo_em || item.dias_restantes !== null) && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px]">
          {atrasado ? (
            <Badge variant="destructive" className="text-[10px] h-4 gap-0.5 px-1.5">
              <AlertTriangle className="h-2.5 w-2.5" /> Vencido
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {item.dias_restantes !== null
                ? `${item.dias_restantes}d restantes`
                : "Em andamento"}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
