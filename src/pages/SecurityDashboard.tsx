import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SecurityKPICards } from "@/components/security/SecurityKPICards";
import { SecurityActivityFeed } from "@/components/security/SecurityActivityFeed";
import { SecurityTrendChart } from "@/components/security/SecurityTrendChart";

const SecurityDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Painel de Segurança
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitoramento em tempo real de eventos de segurança
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard/relatorio-seguranca")}>
          Relatório Completo
        </Button>
      </div>

      <SecurityKPICards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityTrendChart />
        <SecurityActivityFeed />
      </div>
    </div>
  );
};

export default SecurityDashboard;
