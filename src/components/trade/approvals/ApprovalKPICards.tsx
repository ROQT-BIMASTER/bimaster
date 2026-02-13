import { Card } from "@/components/ui/card";
import { AlertCircle, Target, FileText, DollarSign, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/trade-utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ApprovalKPICardsProps {
  campaignsCount: number;
  entriesCount: number;
  investmentsCount: number;
  totalCampaignsCost: number;
  totalEntriesAmount: number;
}

export function ApprovalKPICards({ campaignsCount, entriesCount, investmentsCount, totalCampaignsCost, totalEntriesAmount }: ApprovalKPICardsProps) {
  const { t } = useLanguage();
  const totalPending = campaignsCount + entriesCount + investmentsCount;
  const totalValue = totalCampaignsCost + totalEntriesAmount;

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 rounded-lg"><AlertCircle className="h-6 w-6 text-orange-500" /></div>
          <div>
            <p className="text-sm text-muted-foreground">{t("approval.total_pending")}</p>
            <p className="text-2xl font-bold">{totalPending}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg"><Target className="h-6 w-6 text-purple-500" /></div>
          <div>
            <p className="text-sm text-muted-foreground">{t("approval.campaigns")}</p>
            <p className="text-2xl font-bold">{campaignsCount}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg"><FileText className="h-6 w-6 text-blue-500" /></div>
          <div>
            <p className="text-sm text-muted-foreground">{t("approval.entries")}</p>
            <p className="text-2xl font-bold">{entriesCount + investmentsCount}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg"><DollarSign className="h-6 w-6 text-emerald-500" /></div>
          <div>
            <p className="text-sm text-muted-foreground">{t("approval.total_value")}</p>
            <p className="text-lg font-bold">{formatCurrency(totalValue)}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg"><CheckCircle2 className="h-6 w-6 text-green-500" /></div>
          <div>
            <p className="text-sm text-muted-foreground">{t("approval.status")}</p>
            <p className="text-lg font-semibold">{totalPending > 0 ? t("approval.review") : t("approval.up_to_date")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
