import { useState } from "react";
import { useActiveTradeMateriais, TradeMaterial } from "@/hooks/useTradeMateriais";
import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TradeSectionHeader } from "@/components/trade/ui/TradeSectionHeader";
import { MaterialOrderSheet } from "@/components/trade/MaterialOrderSheet";

export function MateriaisCarousel() {
  const { data: materiais, isLoading } = useActiveTradeMateriais();
  const [selectedMaterial, setSelectedMaterial] = useState<TradeMaterial | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <TradeSectionHeader title="Materiais para Solicitação" />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 min-w-[64px]">
              <Skeleton className="w-14 h-14 rounded-2xl" />
              <Skeleton className="w-12 h-3 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!materiais || materiais.length === 0) return null;

  return (
    <div className="space-y-2">
      <TradeSectionHeader
        title="Materiais para Solicitação"
        subtitle="Solicite materiais de trade"
        linkText="Ver todos"
        linkTo="/dashboard/trade/materiais"
      />
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {materiais.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMaterial(m)}
            className="flex flex-col items-center gap-1.5 min-w-[64px] max-w-[64px] sm:min-w-[72px] sm:max-w-[72px] group"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-muted flex items-center justify-center shadow-sm border border-border group-hover:shadow-md transition-shadow">
              {m.foto_url ? (
                <img
                  src={m.foto_url}
                  alt={m.nome}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <span className="text-[11px] text-foreground font-medium text-center leading-tight line-clamp-2">
              {m.nome.split(" ").slice(0, 2).join(" ")}
            </span>
          </button>
        ))}
      </div>

      <MaterialOrderSheet
        material={selectedMaterial}
        onClose={() => setSelectedMaterial(null)}
      />
    </div>
  );
}
