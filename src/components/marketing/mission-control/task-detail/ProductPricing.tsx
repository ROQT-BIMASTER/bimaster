import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, PercentCircle, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceInfo {
  id: string;
  custo_base?: number | null;
  preco_final?: number | null;
  margem_lucro_percentual?: number | null;
  tabela?: {
    nome: string;
    codigo?: string;
  } | null;
}

interface ProductPricingProps {
  precos: PriceInfo[];
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function ProductPricing({ precos }: ProductPricingProps) {
  if (!precos || precos.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Preços não cadastrados</p>
      </div>
    );
  }

  // Pegar o primeiro preço como principal
  const mainPrice = precos[0];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        Informações Comerciais
      </h4>

      {/* Cards de preço principal */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Custo Base</p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(mainPrice.custo_base)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground mb-1">Preço Sugerido</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(mainPrice.preco_final)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Margem</p>
          <div className="flex items-center gap-1">
            <TrendingUp className={cn(
              "h-4 w-4",
              (mainPrice.margem_lucro_percentual || 0) >= 50 ? "text-green-500" : 
              (mainPrice.margem_lucro_percentual || 0) >= 30 ? "text-amber-500" : "text-red-500"
            )} />
            <p className={cn(
              "text-lg font-semibold",
              (mainPrice.margem_lucro_percentual || 0) >= 50 ? "text-green-500" : 
              (mainPrice.margem_lucro_percentual || 0) >= 30 ? "text-amber-500" : "text-red-500"
            )}>
              {mainPrice.margem_lucro_percentual?.toFixed(1) || '-'}%
            </p>
          </div>
        </div>
      </div>

      {/* Outras tabelas de preço */}
      {precos.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Outras tabelas de preço:</p>
          <div className="flex flex-wrap gap-2">
            {precos.slice(1).map((preco) => (
              <Badge 
                key={preco.id} 
                variant="outline"
                className="text-xs flex items-center gap-1"
              >
                <Tag className="h-3 w-3" />
                {preco.tabela?.nome || 'Tabela'}: {formatCurrency(preco.preco_final)}
                {preco.margem_lucro_percentual && (
                  <span className="text-muted-foreground">
                    ({preco.margem_lucro_percentual.toFixed(0)}%)
                  </span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}