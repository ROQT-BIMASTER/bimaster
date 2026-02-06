import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import type { RiscoPorUF } from "@/hooks/useClienteReativacao";

interface Props {
  data: RiscoPorUF[];
}

export function RiskByStateCard({ data }: Props) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const top10 = data.slice(0, 10);
  const maxValor = top10[0]?.valor_total || 1;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Risco por UF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {top10.map((item) => {
          const pct = (item.valor_total / maxValor) * 100;
          return (
            <div key={item.uf} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.uf}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{item.quantidade} clientes</span>
                  <span className="font-semibold text-xs">{formatCurrency(item.valor_total)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
