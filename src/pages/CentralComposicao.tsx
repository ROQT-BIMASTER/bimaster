import { FlaskConical } from "lucide-react";
import { CentralTrabalhoModulo } from "@/components/inbox/CentralTrabalhoModulo";

export default function CentralComposicao() {
  return (
    <CentralTrabalhoModulo
      origem="composicao"
      titulo="Central — Composição"
      subtitulo="Fila da equipe de Composição: INCI, checklists e validações regulatórias."
      corModulo="hsl(190 80% 50%)"
      Icon={FlaskConical}
    />
  );
}
