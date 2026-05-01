import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ProjetoFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
} from "./ProjetoFilterSort";

interface Props {
  filters: ProjetoFilters;
  onFiltersChange: (filters: ProjetoFilters) => void;
  teamMembers?: { id: string; nome: string }[];
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Não iniciado",
  em_andamento: "Em andamento",
  concluida: "Concluído",
  bloqueada: "Bloqueada",
};

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const ESTAGIO_LABELS: Record<string, string> = {
  briefing: "Briefing",
  em_criacao: "Em criação",
  revisao: "Revisão",
  aprovado: "Aprovado",
  producao: "Produção",
  lancamento: "Lançamento",
};

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
  tone?: "default" | "primary" | "warning";
}

/**
 * Barra de chips com filtros ativos. Mostra apenas quando há filtros aplicados.
 * Cada chip remove individualmente; também há botão "Limpar tudo".
 */
export function ProjetoActiveFiltersBar({ filters, onFiltersChange, teamMembers = [], className }: Props) {
  if (!hasActiveFilters(filters)) return null;

  const chips: Chip[] = [];

  filters.status.forEach((s) =>
    chips.push({
      key: `status:${s}`,
      label: `Status: ${STATUS_LABELS[s] ?? s}`,
      onRemove: () => onFiltersChange({ ...filters, status: filters.status.filter((v) => v !== s) }),
    }),
  );

  filters.prioridade.forEach((p) =>
    chips.push({
      key: `prio:${p}`,
      label: `Prioridade: ${PRIORIDADE_LABELS[p] ?? p}`,
      onRemove: () => onFiltersChange({ ...filters, prioridade: filters.prioridade.filter((v) => v !== p) }),
    }),
  );

  filters.estagio.forEach((e) =>
    chips.push({
      key: `est:${e}`,
      label: `Estágio: ${ESTAGIO_LABELS[e] ?? e}`,
      onRemove: () => onFiltersChange({ ...filters, estagio: filters.estagio.filter((v) => v !== e) }),
    }),
  );

  filters.tipo.forEach((t) =>
    chips.push({
      key: `tipo:${t}`,
      label: `Tipo: ${t}`,
      onRemove: () => onFiltersChange({ ...filters, tipo: filters.tipo.filter((v) => v !== t) }),
    }),
  );

  filters.canalCriacao.forEach((c) =>
    chips.push({
      key: `canal:${c}`,
      label: `Canal: ${c}`,
      onRemove: () => onFiltersChange({ ...filters, canalCriacao: filters.canalCriacao.filter((v) => v !== c) }),
    }),
  );

  if (filters.responsavelId) {
    let label = "Responsável";
    if (filters.responsavelId === "__me__") label = "Responsável: eu";
    else if (filters.responsavelId === "sem_responsavel") label = "Sem responsável";
    else {
      const m = teamMembers.find((t) => t.id === filters.responsavelId);
      label = `Responsável: ${m?.nome ?? "—"}`;
    }
    chips.push({
      key: "responsavel",
      label,
      onRemove: () => onFiltersChange({ ...filters, responsavelId: null }),
    });
  }

  if (filters.atrasadas) {
    chips.push({
      key: "atrasadas",
      label: "Apenas atrasadas",
      tone: "warning",
      onRemove: () => onFiltersChange({ ...filters, atrasadas: false }),
    });
  }

  const term = (filters.searchTerm || "").trim();
  if (term) {
    chips.push({
      key: "busca",
      label: `Busca: "${term}"`,
      tone: "primary",
      onRemove: () => onFiltersChange({ ...filters, searchTerm: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((c) => (
        <Badge
          key={c.key}
          variant="outline"
          className={cn(
            "h-6 pl-2 pr-1 text-[11px] gap-1 font-medium border-border/60 bg-card/60 backdrop-blur-sm",
            c.tone === "primary" && "border-primary/40 bg-primary/10 text-primary",
            c.tone === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          {c.label}
          <button
            type="button"
            onClick={c.onRemove}
            aria-label={`Remover ${c.label}`}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-muted/60"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={() => onFiltersChange(EMPTY_FILTERS)}
      >
        Limpar tudo
      </Button>
    </div>
  );
}
