import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, Star } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RecentVisit } from "@/hooks/useTradeExecutiveDashboard";

interface TradeExecutiveVisitsTableProps {
  data?: RecentVisit[];
  isLoading: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "Concluída", variant: "default" },
  in_progress: { label: "Em Andamento", variant: "secondary" },
  scheduled: { label: "Agendada", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  pending: { label: "Pendente", variant: "outline" },
};

export function TradeExecutiveVisitsTable({ data, isLoading }: TradeExecutiveVisitsTableProps) {
  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Visitas Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PDV</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((visit) => {
                const status = statusConfig[visit.status] || statusConfig.pending;
                return (
                  <TableRow key={visit.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {visit.pdv}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {visit.vendedor}
                    </TableCell>
                    <TableCell>
                      {visit.data
                        ? format(parseISO(visit.data), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {visit.duracao !== null ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {visit.duracao} min
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {visit.score !== null ? (
                        <span className="flex items-center justify-end gap-1">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          {visit.score.toFixed(1)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Nenhuma visita encontrada
          </div>
        )}
      </CardContent>
    </Card>
  );
}
