import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartValue } from "@/components/ui/smart-value";
import { Users } from "lucide-react";
import type { RankingSupervisor } from "@/hooks/useRankingSupervisores";

interface Props {
  data: RankingSupervisor[] | undefined;
  isLoading: boolean;
}

export function DataTableSupervisores({ data, isLoading }: Props) {
  if (isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-600" />
          Detalhamento Supervisores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">#</th>
                <th className="text-left py-2 px-2 font-medium">Supervisor</th>
                <th className="text-right py-2 px-2 font-medium">Receita</th>
                <th className="text-right py-2 px-2 font-medium">Pedidos</th>
                <th className="text-right py-2 px-2 font-medium">Clientes</th>
                <th className="text-right py-2 px-2 font-medium">Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((s, i) => (
                <tr key={s.supervisor} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 px-2 font-medium">{s.supervisor}</td>
                  <td className="py-2 px-2 text-right"><SmartValue value={s.receita_total} /></td>
                  <td className="py-2 px-2 text-right">{s.qtde_pedidos.toLocaleString("pt-BR")}</td>
                  <td className="py-2 px-2 text-right">{s.clientes_ativos.toLocaleString("pt-BR")}</td>
                  <td className="py-2 px-2 text-right">
                    <SmartValue value={s.qtde_pedidos > 0 ? s.receita_total / s.qtde_pedidos : 0} />
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
