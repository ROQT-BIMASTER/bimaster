import { FlaskConical } from "lucide-react";
import { CentralTrabalhoModulo } from "@/components/inbox/CentralTrabalhoModulo";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function CentralComposicao() {
  return (
    <DashboardLayout>
      <CentralTrabalhoModulo
        origem="composicao"
        titulo="Central — Composição"
        subtitulo="Fila da equipe de Composição: INCI, checklists e validações regulatórias."
        corModulo="hsl(190 80% 50%)"
        Icon={FlaskConical}
      />
    </DashboardLayout>
  );
}
