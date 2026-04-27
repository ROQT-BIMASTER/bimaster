import { Layers } from "lucide-react";
import { CentralTrabalhoModulo } from "@/components/inbox/CentralTrabalhoModulo";

export default function CentralAmostras() {
  return (
    <CentralTrabalhoModulo
      origem="amostras"
      titulo="Central — Amostras"
      subtitulo="Recebimentos de amostras, inspeções pendentes e devolutivas para a fábrica."
      corModulo="hsl(320 70% 55%)"
      Icon={Layers}
    />
  );
}
