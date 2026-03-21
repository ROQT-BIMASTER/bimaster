import { TradeDisplay } from "@/hooks/useTradeDisplays";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisplayCatalogGridProps {
  displays: TradeDisplay[];
  onSelect?: (display: TradeDisplay) => void;
  showStatus?: boolean;
}

function formatDimensions(d: TradeDisplay) {
  const parts: string[] = [];
  if (d.largura_cm) parts.push(`${d.largura_cm}cm`);
  if (d.profundidade_cm) parts.push(`${d.profundidade_cm}cm`);
  if (d.altura_cm) parts.push(`${d.altura_cm}cm`);
  return parts.length > 0 ? parts.join(" × ") : null;
}

export function DisplayCatalogGrid({ displays, onSelect, showStatus = false }: DisplayCatalogGridProps) {
  if (displays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm">Nenhum display cadastrado</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {displays.map((display) => {
        const dims = formatDimensions(display);
        return (
          <Card
            key={display.id}
            className={cn(
              "group overflow-hidden rounded-2xl border hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer",
              !display.ativo && "opacity-60"
            )}
            onClick={() => onSelect?.(display)}
          >
            <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
              {display.foto_url ? (
                <img
                  src={display.foto_url}
                  alt={display.nome}
                  className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-16 w-16 text-muted-foreground/20" />
                </div>
              )}
              {display.categoria && (
                <Badge className="absolute top-2 left-2 bg-[hsl(330,81%,60%)] text-white border-0 text-[10px]">
                  {display.categoria}
                </Badge>
              )}
              {showStatus && (
                <Badge
                  className={cn(
                    "absolute top-2 right-2 border-0 text-[10px]",
                    display.ativo
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-400 text-white"
                  )}
                >
                  {display.ativo ? "Ativo" : "Inativo"}
                </Badge>
              )}
            </div>
            <CardContent className="p-3">
              <h3 className="font-semibold text-sm truncate">{display.nome}</h3>
              {display.codigo && (
                <p className="text-xs text-muted-foreground mt-0.5">Cód: {display.codigo}</p>
              )}
              {dims && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <Ruler className="h-3 w-3" />
                  <span className="font-medium">{dims}</span>
                  <span className="text-[10px]">(L × P × A)</span>
                </div>
              )}
              {display.material && (
                <p className="text-[11px] text-muted-foreground mt-1">{display.material}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
