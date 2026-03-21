import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Trophy, Gift } from "lucide-react";
import { differenceInDays } from "date-fns";
import type { TradeIncentivo, TradeIncentivoProgresso } from "@/hooks/useTradeIncentivos";

interface Props {
  incentivo: TradeIncentivo;
  progresso?: TradeIncentivoProgresso;
  onClick?: () => void;
}

const tipoIcons: Record<string, string> = {
  visitas: "📍",
  fotos: "📸",
  vendas: "💰",
  ranking: "🏆",
  bonus: "🎁",
};

function getStatusBadge(incentivo: TradeIncentivo, progresso?: TradeIncentivoProgresso) {
  if (progresso?.concluido) return { label: "Concluído", color: "bg-emerald-500 text-white" };
  const today = new Date();
  if (new Date(incentivo.data_fim) < today) return { label: "Expirado", color: "bg-muted text-muted-foreground" };
  return { label: "Em andamento", color: "bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white" };
}

export function IncentivoCard({ incentivo, progresso, onClick }: Props) {
  const pct = incentivo.meta_valor > 0 ? Math.min(((progresso?.valor_atual || 0) / incentivo.meta_valor) * 100, 100) : 0;
  const daysLeft = Math.max(0, differenceInDays(new Date(incentivo.data_fim), new Date()));
  const status = getStatusBadge(incentivo, progresso);
  const icon = incentivo.icone || tipoIcons[incentivo.tipo] || "🎯";

  return (
    <div
      onClick={onClick}
      className="bg-card border rounded-2xl p-4 cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all duration-200 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h4 className="font-semibold text-sm leading-tight">{incentivo.titulo}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{incentivo.tipo}</p>
          </div>
        </div>
        <Badge className={`text-[10px] px-2 py-0.5 ${status.color} border-0`}>
          {status.label}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {progresso?.valor_atual || 0}/{incentivo.meta_valor} {incentivo.meta_unidade}
          </span>
          <span className="font-semibold">{Math.round(pct)}%</span>
        </div>
        <Progress value={pct} className="h-2" gradient />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{daysLeft > 0 ? `${daysLeft} dias restantes` : "Encerrado"}</span>
        </div>
        {incentivo.recompensa && (
          <div className="flex items-center gap-1 text-[hsl(330,81%,60%)] font-medium">
            <Gift className="h-3.5 w-3.5" />
            <span>{incentivo.recompensa}</span>
          </div>
        )}
      </div>
    </div>
  );
}
