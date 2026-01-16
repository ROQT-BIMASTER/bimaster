import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { QAAgentChat } from "@/components/qa/QAAgentChat";
import { useEffect } from "react";

const QAAgent = () => {
  useEffect(() => {
    document.title = "Agente de QA | Sistema de Gestão Huggs";
  }, []);

  return (
    <DashboardLayout>

      <div className="flex flex-col h-[calc(100vh-120px)]">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Agente de QA</h1>
          <p className="text-muted-foreground">
            Agente de IA para testar funcionalidades, identificar problemas e sugerir correções
          </p>
        </div>

        <div className="flex-1 min-h-0">
          <QAAgentChat />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default QAAgent;
