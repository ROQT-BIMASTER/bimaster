import { useTradeIncentivos, useMyIncentivoProgresso } from "@/hooks/useTradeIncentivos";
import { IncentivoCard } from "./IncentivoCard";
import { Trophy, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function IncentivosWeekSection() {
  const { data: incentivos, isLoading } = useTradeIncentivos(true);
  const ids = incentivos?.map(i => i.id) || [];
  const { data: progressos } = useMyIncentivoProgresso(ids);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!incentivos?.length) return null;

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10">
          <Sparkles className="h-32 w-32 -mt-4 -mr-4" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-xl">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Incentivos da Semana</h3>
            <p className="text-white/80 text-sm">Complete metas e ganhe recompensas!</p>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {incentivos.map((incentivo) => {
          const progresso = progressos?.find(p => p.incentivo_id === incentivo.id);
          return (
            <IncentivoCard
              key={incentivo.id}
              incentivo={incentivo}
              progresso={progresso}
            />
          );
        })}
      </div>
    </div>
  );
}
