import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { DollarSign, FileText, Receipt, Users, UserCheck } from "lucide-react";

interface Props {
  data?: {
    faturamento: number; notas: number; ticket_medio: number;
    clientes: number; vendedores: number;
  };
  isLoading: boolean;
}

const fmtInt = (n: number) => n.toLocaleString("pt-BR");

export function KPICards({ data, isLoading }: Props) {
  const items = [
    { label: "Faturamento", value: data ? formatCurrency(data.faturamento) : "—", icon: DollarSign, color: "text-emerald-600" },
    { label: "Notas", value: data ? fmtInt(data.notas) : "—", icon: FileText, color: "text-blue-600" },
    { label: "Ticket médio", value: data ? formatCurrency(data.ticket_medio) : "—", icon: Receipt, color: "text-violet-600" },
    { label: "Clientes", value: data ? fmtInt(data.clientes) : "—", icon: Users, color: "text-amber-600" },
    { label: "Vendedores ativos", value: data ? fmtInt(data.vendedores) : "—", icon: UserCheck, color: "text-rose-600" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${it.color}`}>
              <it.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">{it.label}</div>
              {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : <div className="text-base font-semibold truncate">{it.value}</div>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
