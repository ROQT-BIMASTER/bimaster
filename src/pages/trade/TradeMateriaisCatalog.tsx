import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useActiveTradeMateriais, TradeMaterial } from "@/hooks/useTradeMateriais";
import { Package, ArrowLeft, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { DisplayHeroBanner } from "@/components/trade/displays/DisplayHeroBanner";
import { MaterialOrderSheet } from "@/components/trade/MaterialOrderSheet";

export default function TradeMateriaisCatalog() {
  const { data: materiais, isLoading } = useActiveTradeMateriais();
  const [selectedMaterial, setSelectedMaterial] = useState<TradeMaterial | null>(null);
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/trade")}
            className="rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Catálogo de Materiais</h1>
            <p className="text-sm text-muted-foreground">Solicite materiais de trade para suas lojas</p>
          </div>
        </div>

        {/* Banner */}
        <DisplayHeroBanner />

        {/* Materials Grid */}
        <div>
          <h2 className="text-lg font-bold mb-3">Materiais Disponíveis</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-2xl" />
              ))}
            </div>
          ) : !materiais?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum material disponível no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {materiais.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMaterial(m)}
                  className="group text-left bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                    {m.foto_url ? (
                      <img
                        src={m.foto_url}
                        alt={m.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm line-clamp-2 leading-tight">{m.nome}</p>
                    {m.categoria && (
                      <Badge variant="secondary" className="mt-1.5 text-[10px]">
                        {m.categoria}
                      </Badge>
                    )}
                    {m.exibir_estoque && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {m.estoque_atual > 0 ? `${m.estoque_atual} em estoque` : "Sem estoque"}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-1 text-primary text-xs font-medium">
                      <ShoppingCart className="h-3 w-3" />
                      <span>Solicitar</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <MaterialOrderSheet
        material={selectedMaterial}
        onClose={() => setSelectedMaterial(null)}
      />
    </DashboardLayout>
  );
}
