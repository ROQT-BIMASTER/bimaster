import { Palette } from "lucide-react";
import { CentralTrabalhoModulo } from "@/components/inbox/CentralTrabalhoModulo";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function CentralMotorArtes() {
  return (
    <DashboardLayout>
      <CentralTrabalhoModulo
        origem="motor_artes"
        titulo="Central — Motor de Artes"
        subtitulo="Gates pendentes, AFs recebidas, reprovações e revisões da equipe de criação."
        corModulo="hsl(280 80% 60%)"
        Icon={Palette}
      />
    </DashboardLayout>
  );
}
