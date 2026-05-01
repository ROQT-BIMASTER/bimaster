import { useMemo } from "react";
import { FolderOpen, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Projeto } from "@/hooks/useProjetos";

interface Props {
  projetos: Projeto[];
  metricsMap: Map<string, { total: number; concluidas: number; atrasadas: number }>;
  className?: string;
}

interface Kpi {
  key: string;
  label: string;
  value: number;
  icon: typeof FolderOpen;
  accent: string; // tailwind classes for icon bg/text
}

/**
 * Faixa de 4 KPIs no topo da listagem de Projetos.
 * Cards translúcidos com backdrop-blur para harmonizar com qualquer cor de fundo
 * escolhida no PageBgCustomizer.
 */
export function ProjetoKpiStrip({ projetos, metricsMap, className }: Props) {
  const kpis = useMemo<Kpi[]>(() => {
    let total = projetos.length;
    let emAndamento = 0;
    let atrasados = 0;
    let concluidos = 0;

    for (const p of projetos) {
      const m = metricsMap.get(p.id) || { total: 0, concluidas: 0, atrasadas: 0 };
      const isFinalizado = p.status === "finalizado" || (m.total > 0 && m.concluidas === m.total);
      if (isFinalizado) concluidos += 1;
      else if (m.atrasadas > 0) atrasados += 1;
      else if (m.concluidas > 0) emAndamento += 1;
    }

    return [
      { key: "total", label: "Total de projetos", value: total, icon: FolderOpen, accent: "bg-primary/10 text-primary" },
      { key: "andamento", label: "Em andamento", value: emAndamento, icon: Activity, accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
      { key: "atrasados", label: "Com atrasos", value: atrasados, icon: AlertTriangle, accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
      { key: "concluidos", label: "Concluídos", value: concluidos, icon: CheckCircle2, accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    ];
  }, [projetos, metricsMap]);

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.key}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm px-4 py-3 transition-all hover:border-border hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", k.accent)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
                  {k.label}
                </p>
                <p className="text-xl font-semibold leading-tight tabular-nums text-foreground">{k.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
