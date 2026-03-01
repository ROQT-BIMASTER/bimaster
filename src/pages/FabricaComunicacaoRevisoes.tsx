import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RevisaoChatConsolidado } from "@/components/fabrica/RevisaoChatConsolidado";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";

export default function FabricaComunicacaoRevisoes() {
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col gap-2">
        <div className="flex items-center gap-4 shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/fabrica/produtos-acabados">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Comunicação de Revisões</h1>
          </div>
          <ManualFabricaDrawer screen="comunicacao" />
        </div>

        <div className="flex-1 min-h-0">
          <RevisaoChatConsolidado />
        </div>
      </div>
    </DashboardLayout>
  );
}
