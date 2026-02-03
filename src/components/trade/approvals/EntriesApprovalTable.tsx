import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { getEntryTypeLabel, formatCurrency, calcularSaldoDisponivel } from "@/lib/trade-utils";

interface EntriesApprovalTableProps {
  entries: any[];
  investments: any[];
  onReviewClick: (item: any, type: "entry" | "investment") => void;
}

export function EntriesApprovalTable({ entries, investments, onReviewClick }: EntriesApprovalTableProps) {
  const hasItems = entries.length > 0 || investments.length > 0;

  if (!hasItems) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
        <p className="text-lg font-semibold mb-2">Nenhum lançamento pendente</p>
        <p className="text-sm">Todos os lançamentos financeiros foram processados</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Solicitante</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Conta/Categoria</TableHead>
          <TableHead>Loja</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* Lançamentos Financeiros */}
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap">
              {format(new Date(entry.entry_date), "dd/MM/yyyy")}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  {entry.created_by_profile?.nome || "N/A"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entry.created_by_profile?.email || ""}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-sm whitespace-nowrap">
              {getEntryTypeLabel(entry.entry_type)}
            </TableCell>
            <TableCell className="max-w-xs">
              <div className="space-y-1">
                <div className="truncate" title={entry.description}>
                  {entry.description}
                </div>
                {entry.budget && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                    <div className="font-semibold mb-0.5">
                      {entry.budget.code} - {entry.budget.name}
                    </div>
                    <div className="flex gap-3">
                      <span>
                        💰 Disponível: {formatCurrency(calcularSaldoDisponivel(entry.budget))}
                      </span>
                      <span>
                        📊 Utilizado: {formatCurrency(parseFloat(String(entry.budget.spent_amount || 0)))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-sm">
              {entry.account ? (
                <span className="font-mono text-xs">{entry.account.code}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-sm">
              {entry.store ? (
                <span className="text-xs">{entry.store.code}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-right font-semibold whitespace-nowrap">
              {formatCurrency(parseFloat(String(entry.amount || 0)))}
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" onClick={() => onReviewClick(entry, "entry")}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Revisar
              </Button>
            </TableCell>
          </TableRow>
        ))}

        {/* Investimentos */}
        {investments.map((investment) => (
          <TableRow key={investment.id}>
            <TableCell className="whitespace-nowrap">
              {format(new Date(investment.investment_date), "dd/MM/yyyy")}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  {investment.created_by_profile?.nome || "N/A"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {investment.created_by_profile?.email || ""}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-sm whitespace-nowrap">
              <Badge variant="outline">Investimento PDV</Badge>
            </TableCell>
            <TableCell className="max-w-xs">
              <div className="truncate" title={investment.description}>
                {investment.description}
              </div>
            </TableCell>
            <TableCell className="text-sm">
              <span className="capitalize text-xs bg-muted px-2 py-1 rounded">
                {investment.category}
              </span>
            </TableCell>
            <TableCell className="text-sm">
              {investment.store ? (
                <span className="text-xs">{investment.store.code}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-right font-semibold whitespace-nowrap">
              {formatCurrency(parseFloat(String(investment.amount || 0)))}
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" onClick={() => onReviewClick(investment, "investment")}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Revisar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
