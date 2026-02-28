import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RevisaoChatConsolidado } from "@/components/fabrica/RevisaoChatConsolidado";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

export default function FabricaComunicacaoRevisoes() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
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
        </div>

        <RevisaoChatConsolidado />
      </div>
    </DashboardLayout>
  );
}
