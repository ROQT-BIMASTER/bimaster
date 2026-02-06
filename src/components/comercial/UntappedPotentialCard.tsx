import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PotencialNaoExplorado } from "@/hooks/useClienteAnalytics";

interface Props {
  data: PotencialNaoExplorado[] | undefined;
  isLoading: boolean;
}

export function UntappedPotentialCard({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-[350px] rounded-xl" />;
  if (!data || data.length === 0) return null;

  const top8 = data.slice(0, 8);
  const totalSemCompra = data.reduce((s, d) => s + d.semCompra, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          Potencial Não Explorado
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {totalSemCompra} clientes cadastrados sem nenhuma compra registrada
        </p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {top8.map((item) => {
          const severity =
            item.taxaInatividade > 80
              ? "destructive"
              : item.taxaInatividade > 50
              ? "secondary"
              : "outline";

          return (
            <div key={item.uf} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm">{item.uf}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {item.semCompra} de {item.cadastrados}
                </span>
                <Badge variant={severity} className="text-[10px] px-1.5 py-0 min-w-[42px] justify-center">
                  {item.taxaInatividade.toFixed(0)}%
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
