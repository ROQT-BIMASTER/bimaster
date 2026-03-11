import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SmartValue } from "@/components/ui/smart-value";
import { Progress } from "@/components/ui/progress";
import { CreditCard, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface PainelCartoesProps {
  connections: any[];
}

export function PainelCartoes({ connections }: PainelCartoesProps) {
  const creditCards = connections.filter((c: any) => c.account_type === "CREDIT_CARD");

  if (creditCards.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum cartão de crédito conectado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {creditCards.map((card: any) => {
          const limit = card.credit_limit || 0;
          const available = card.available_limit || 0;
          const used = limit - available;
          const usagePercent = limit > 0 ? (used / limit) * 100 : 0;
          const isHighUsage = usagePercent > 80;

          return (
            <Card key={card.id} className={isHighUsage ? "border-destructive/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {card.banco}
                  </span>
                  {isHighUsage && <AlertTriangle className="h-4 w-4 text-destructive" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Utilizado</span>
                  <span>Limite</span>
                </div>
                <Progress value={usagePercent} className="h-2" />
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-destructive">
                    <SmartValue value={used} />
                  </span>
                  <span className="font-medium">
                    <SmartValue value={limit} />
                  </span>
                </div>

                <div className="pt-2 border-t space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Disponível</span>
                    <span className="font-medium text-green-600">
                      <SmartValue value={available} />
                    </span>
                  </div>
                  {card.bill_amount && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Fatura</span>
                      <span className="font-medium">
                        <SmartValue value={card.bill_amount} />
                      </span>
                    </div>
                  )}
                  {card.bill_due_date && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Vencimento</span>
                      <span>{format(new Date(card.bill_due_date), "dd/MM/yyyy")}</span>
                    </div>
                  )}
                </div>

                <Badge variant={usagePercent > 80 ? "destructive" : "default"} className="text-[10px] w-full justify-center">
                  {usagePercent.toFixed(0)}% utilizado
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
