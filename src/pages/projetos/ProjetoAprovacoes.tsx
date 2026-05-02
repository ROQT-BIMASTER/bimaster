import { useParams, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AprovacoesDashboard } from "@/components/projetos/aprovacoes/AprovacoesDashboard";

export default function ProjetoAprovacoes() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const secaoId = params.get("secao");

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-[1600px]">
        <AprovacoesDashboard
          escopo="projeto"
          projetoId={id}
          secaoId={secaoId}
          titulo={secaoId ? "Aprovações da Seção" : "Aprovações do Projeto"}
          subtitulo={
            secaoId
              ? "Visão consolidada dos lotes desta seção do projeto."
              : "Quadro geral de todos os lotes de aprovação deste projeto."
          }
          hideBreadcrumb={!!secaoId}
        />
      </div>
    </DashboardLayout>
  );
}
