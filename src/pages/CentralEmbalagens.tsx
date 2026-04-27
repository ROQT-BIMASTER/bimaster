import { Package } from "lucide-react";
import { CentralTrabalhoModulo } from "@/components/inbox/CentralTrabalhoModulo";

export default function CentralEmbalagens() {
  return (
    <CentralTrabalhoModulo
      origem="embalagens"
      titulo="Central — Embalagens"
      subtitulo="Análises e aprovações de embalagens, layouts e specs do time."
      corModulo="hsl(35 90% 55%)"
      Icon={Package}
    />
  );
}
