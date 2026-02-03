import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { getCampaignTypeLabel, formatCurrency, calcularSaldoDisponivel } from "@/lib/trade-utils";

interface CampaignsApprovalTableProps {
  campaigns: any[];
  onReviewClick: (campaign: any) => void;
}

export function CampaignsApprovalTable({ campaigns, onReviewClick }: CampaignsApprovalTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
        <p className="text-lg font-semibold mb-2">Nenhuma campanha pendente</p>
        <p className="text-sm">Todas as campanhas de Trade foram processadas</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Solicitante</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Período</TableHead>
          <TableHead>Verba</TableHead>
          <TableHead className="text-right">Custo Estimado</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((campaign: any) => (
          <TableRow key={campaign.id}>
            <TableCell className="font-mono text-sm font-medium">
              {campaign.code}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  {campaign.created_by_profile?.nome || "N/A"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {campaign.created_by_profile?.email || ""}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{getCampaignTypeLabel(campaign.campaign_type)}</Badge>
            </TableCell>
            <TableCell className="max-w-xs">
              <div className="truncate font-medium" title={campaign.name}>
                {campaign.name}
              </div>
              {campaign.description && (
                <div className="truncate text-xs text-muted-foreground" title={campaign.description}>
                  {campaign.description}
                </div>
              )}
            </TableCell>
            <TableCell className="text-sm whitespace-nowrap">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {format(new Date(campaign.start_date), "dd/MM/yy")} - {format(new Date(campaign.end_date), "dd/MM/yy")}
              </div>
            </TableCell>
            <TableCell>
              {campaign.budget ? (
                <div className="space-y-1">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    {campaign.budget.code}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    Disp: {formatCurrency(calcularSaldoDisponivel(campaign.budget))}
                  </div>
                </div>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  Sem verba
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right font-semibold whitespace-nowrap">
              {formatCurrency(parseFloat(String(campaign.estimated_cost || 0)))}
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" onClick={() => onReviewClick(campaign)}>
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
