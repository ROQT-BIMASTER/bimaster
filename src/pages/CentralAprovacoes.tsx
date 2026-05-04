import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { KanbanAprovacoes } from "@/components/projetos/aprovacoes/KanbanAprovacoes";

export default function CentralAprovacoes() {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-[1600px]">
        <KanbanAprovacoes
          escopo="pessoal"
          titulo="Minhas Aprovações"
          subtitulo="Documentos pendentes para sua revisão, aprovação ou encaminhamento — em todos os projetos."
        />
      </div>
    </DashboardLayout>
  );
}
