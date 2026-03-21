import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trophy } from "lucide-react";
import { IncentivosAdminList } from "@/components/trade/incentivos/IncentivosAdminList";
import { IncentivoFormDialog } from "@/components/trade/incentivos/IncentivoFormDialog";
import type { TradeIncentivo } from "@/hooks/useTradeIncentivos";

const TradeIncentivosAdmin = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editIncentivo, setEditIncentivo] = useState<TradeIncentivo | null>(null);

  const handleEdit = (incentivo: TradeIncentivo) => {
    setEditIncentivo(incentivo);
    setFormOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20 sm:pb-6">
        <div className="flex items-center gap-4 px-1">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/trade/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Incentivos da Semana</h1>
            <p className="text-sm text-muted-foreground">Gerencie metas e recompensas da equipe</p>
          </div>
          <Button onClick={() => { setEditIncentivo(null); setFormOpen(true); }} className="bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white hover:brightness-110">
            <Plus className="h-4 w-4 mr-1" /> Criar Incentivo
          </Button>
        </div>

        <IncentivosAdminList onEdit={handleEdit} />
        <IncentivoFormDialog open={formOpen} onOpenChange={setFormOpen} editIncentivo={editIncentivo} />
      </div>
    </DashboardLayout>
  );
};

export default TradeIncentivosAdmin;
