import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AprovacoesDashboard } from "@/components/projetos/aprovacoes/AprovacoesDashboard";

export default function CentralAprovacoes() {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-[1600px]">
        <AprovacoesDashboard
          escopo="pessoal"
          titulo="Minhas Aprovações"
          subtitulo="Lotes pendentes para sua revisão, aprovação ou encaminhamento — em todos os projetos."
        />
      </div>
    </DashboardLayout>
  );
}
