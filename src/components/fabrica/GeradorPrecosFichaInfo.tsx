import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  totalAprovadas: number;
  totalPendentesPrecificacao: number;
  filtroPendentes: boolean;
  filtroAprovadas: boolean;
  filtroRecentes: boolean;
  onToggleFiltroPendentes: () => void;
  onToggleFiltroAprovadas: () => void;
  onToggleFiltroRecentes: () => void;
  onSelecionarPendentes: () => void;
}

export function GeradorPrecosFichaInfo({
  totalAprovadas,
  totalPendentesPrecificacao,
  filtroPendentes,
  filtroAprovadas,
  filtroRecentes,
  onToggleFiltroPendentes,
  onToggleFiltroAprovadas,
  onToggleFiltroRecentes,
  onSelecionarPendentes,
}: Props) {
  return (
    <div className="p-3 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50/60 dark:bg-orange-950/30 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <p className="font-medium text-foreground">
            Fonte: Ficha de Custo aprovada pela diretoria
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Use os filtros abaixo para localizar produtos recém-aprovados que ainda
            precisam ser precificados nesta tabela.
          </p>
        </div>
        {totalPendentesPrecificacao > 0 && (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onSelecionarPendentes}
            className="shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Selecionar {totalPendentesPrecificacao} pendente
            {totalPendentesPrecificacao > 1 ? "s" : ""} de precificação
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Filtros rápidos:</span>
        <FilterChip
          active={filtroPendentes}
          onClick={onToggleFiltroPendentes}
          label="Pendentes de precificação"
          count={totalPendentesPrecificacao}
        />
        <FilterChip
          active={filtroAprovadas}
          onClick={onToggleFiltroAprovadas}
          label="Apenas com ficha aprovada"
          count={totalAprovadas}
        />
        <FilterChip
          active={filtroRecentes}
          onClick={onToggleFiltroRecentes}
          label="Aprovadas nos últimos 30 dias"
        />
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:bg-muted"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <Badge
          variant="outline"
          className={`h-4 px-1 text-[10px] ${
            active
              ? "border-primary-foreground/40 text-primary-foreground"
              : "border-border"
          }`}
        >
          {count}
        </Badge>
      )}
    </button>
  );
}
