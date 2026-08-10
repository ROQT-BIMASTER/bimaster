import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SupervisorShare } from "@/hooks/useMunicipiosIntelligence";

interface SupervisorShareCardProps {
  data: SupervisorShare[];
  loading: boolean;
}

const TOP_N = 8;
const NEUTRAL_LABELS = ["E-commerce (carteira automática)", "Sem supervisor"];

interface Linha extends SupervisorShare {
  neutro: boolean;
  share: number;
}

export function SupervisorShareCard({ data, loading }: SupervisorShareCardProps) {
  const { linhas, totalClientes, totalSupervisores } = useMemo(() => {
    const total = data.reduce((acc, d) => acc + d.total_clientes, 0);
    const ordenado = [...data].sort((a, b) => b.total_clientes - a.total_clientes);
    const principais = ordenado.slice(0, TOP_N);
    const resto = ordenado.slice(TOP_N);

    const linhas: Linha[] = principais.map((d) => ({
      ...d,
      neutro: NEUTRAL_LABELS.includes(d.supervisor),
      share: total > 0 ? (d.total_clientes / total) * 100 : 0,
    }));

    if (resto.length > 0) {
      const clientes = resto.reduce((acc, d) => acc + d.total_clientes, 0);
      linhas.push({
        supervisor: `Outros (${resto.length} supervisores)`,
        total_clientes: clientes,
        total_municipios: resto.reduce((acc, d) => acc + d.total_municipios, 0),
        total_vendedores: resto.reduce((acc, d) => acc + d.total_vendedores, 0),
        neutro: true,
        share: total > 0 ? (clientes / total) * 100 : 0,
      });
    }

    return { linhas, totalClientes: total, totalSupervisores: ordenado.length };
  }, [data]);

  const maiorShare = linhas.length > 0 ? Math.max(...linhas.map((l) => l.share)) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Share por Supervisor</CardTitle>
        <CardDescription>Participação na base de clientes dos municípios filtrados</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum cliente encontrado para os filtros aplicados.
          </p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="space-y-3">
              {linhas.map((l) => (
                <div key={l.supervisor} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-medium truncate">{l.supervisor}</p>
                        </TooltipTrigger>
                        <TooltipContent>{l.supervisor}</TooltipContent>
                      </Tooltip>
                      <p className="text-[11px] text-muted-foreground">
                        {l.total_municipios.toLocaleString("pt-BR")} mun. · {l.total_vendedores.toLocaleString("pt-BR")} vend.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{l.share.toFixed(1)}%</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {l.total_clientes.toLocaleString("pt-BR")} clientes
                      </p>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${l.neutro ? "bg-muted-foreground/50" : "bg-primary"}`}
                      style={{ width: `${maiorShare > 0 ? (l.share / maiorShare) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}

        {!loading && linhas.length > 0 && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            {totalSupervisores.toLocaleString("pt-BR")} supervisores · {totalClientes.toLocaleString("pt-BR")} clientes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
