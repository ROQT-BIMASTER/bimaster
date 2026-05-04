import { useParams, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { KanbanAprovacoes } from "@/components/projetos/aprovacoes/KanbanAprovacoes";

export default function ProjetoAprovacoes() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const secaoId = params.get("secao");

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-[1600px]">
        <KanbanAprovacoes
          escopo="projeto"
          projetoId={id}
          secaoId={secaoId}
          titulo={secaoId ? "Aprovações da Seção" : "Aprovações do Projeto"}
          subtitulo={
            secaoId
              ? "Kanban de documentos desta seção, organizados por pipeline e etapa."
              : "Kanban de documentos do projeto, agrupados por pipeline. Arraste cards entre etapas."
          }
        />
      </div>
    </DashboardLayout>
  );
}
