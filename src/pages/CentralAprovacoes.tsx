import { ShieldCheck } from "lucide-react";
import { CentralTrabalhoModulo } from "@/components/inbox/CentralTrabalhoModulo";

export default function CentralAprovacoes() {
  return (
    <CentralTrabalhoModulo
      origem="aprovacoes"
      titulo="Central — Aprovações"
      subtitulo="Fila unificada de aprovações pendentes (artes, preços, processos, campanhas)."
      corModulo="hsl(142 70% 45%)"
      Icon={ShieldCheck}
    />
  );
}
