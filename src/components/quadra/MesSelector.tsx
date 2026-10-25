import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chaveMesDeDate, labelMesLongo, mesAnterior, mesSeguinte } from "@/lib/quadra/resumoFinanceiro";

interface Props {
  /** YYYY-MM */
  mes: string;
  onChange: (mes: string) => void;
}

export function MesSelector({ mes, onChange }: Props) {
  const mesAtual = chaveMesDeDate(new Date());
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange(mesAnterior(mes))} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        className="h-8 min-w-[11rem] px-2 font-medium capitalize"
        onClick={() => onChange(mesAtual)}
        title="Voltar ao mês atual"
      >
        {labelMesLongo(mes)}
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange(mesSeguinte(mes))} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
