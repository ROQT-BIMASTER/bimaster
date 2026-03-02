import { Package, DollarSign, TrendingUp, Layers } from "lucide-react";
import { ComposicaoGradeCard } from "@/components/fabrica/ComposicaoGradeCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProdutoKanbanCardProps {
  produto: any;
  custoTotal?: number;
  temAumento?: boolean;
  onClick: (produto: any) => void;
  formatarMoeda: (valor: number) => string;
}

export function ProdutoKanbanCard({
  produto,
  custoTotal,
  temAumento,
  onClick,
  formatarMoeda,
}: ProdutoKanbanCardProps) {
  return (
    <div
      onClick={() => onClick(produto)}
      className="group cursor-pointer rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Product Photo - Hero */}
      <div className="aspect-[16/9] w-full bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden">
        {produto.foto_url ? (
          <img
            src={produto.foto_url}
            alt={produto.nome}
            className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        {/* Origin badge overlay */}
        <div className="absolute top-2 right-2">
          <Badge
            variant={produto.origem === "importado" ? "destructive" : "secondary"}
            className="text-[10px] shadow-sm"
          >
            {produto.origem === "importado" ? "IMP" : "NAC"}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="font-medium text-sm leading-tight line-clamp-2">{produto.nome}</p>
        <p className="text-xs text-muted-foreground font-mono">{produto.codigo}</p>

        {produto.tipo === "DISPLAY" && (
          <div className="mt-1">
            <ComposicaoGradeCard produtoId={produto.id} compact />
          </div>
        )}

        {(produto.marca || produto.linha) && (
          <div className="flex flex-wrap gap-1">
            {produto.marca && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {produto.marca}
              </Badge>
            )}
            {produto.linha && (
              <Badge variant="ghost" className="text-[10px] px-1.5 py-0">
                {produto.linha}
              </Badge>
            )}
          </div>
        )}

        {custoTotal != null && (
          <div className="flex items-center gap-1 pt-1 border-t border-border/50">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-mono font-semibold">
              {formatarMoeda(custoTotal)}
            </span>
            {temAumento && (
              <TrendingUp className="h-3 w-3 text-destructive" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
