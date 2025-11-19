import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Package } from "lucide-react";
import { useState } from "react";

interface FormulaTreeProps {
  formula: any;
  itens: any[];
}

export function FormulaTree({ formula, itens }: FormulaTreeProps) {
  const [expandido, setExpandido] = useState(true);

  if (!formula || itens.length === 0) {
    return null;
  }

  const custoTotal = itens.reduce((sum, item) => {
    return (
      sum +
      (item.quantidade || 0) *
        (item.fabrica_materias_primas?.custo_unitario || 0)
    );
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Estrutura da Fórmula (Árvore BOM)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Produto Raiz */}
          <div
            className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={() => setExpandido(!expandido)}
          >
            {expandido ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <div className="flex-1">
              <p className="font-semibold">
                {formula.fabrica_produtos?.nome || "Produto"}
              </p>
              <p className="text-sm text-muted-foreground">
                {itens.length} ingredientes • Custo: R${" "}
                {custoTotal.toFixed(2)}
              </p>
            </div>
            <Badge>{formula.rendimento_teorico || 0} un</Badge>
          </div>

          {/* Ingredientes */}
          {expandido && (
            <div className="ml-6 space-y-2 border-l-2 border-border pl-4">
              {itens.map((item, index) => {
                const mp = item.fabrica_materias_primas;
                const custo =
                  (item.quantidade || 0) * (mp?.custo_unitario || 0);

                return (
                  <div
                    key={item.id || index}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {item.ordem_adicao || index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{mp?.nome}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{mp?.codigo}</span>
                        <span>•</span>
                        <span>
                          {item.quantidade?.toFixed(2)}{" "}
                          {mp?.fabrica_unidades_medida?.sigla}
                        </span>
                        <span>•</span>
                        <span>{item.percentual?.toFixed(2)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          item.criticidade === "critico"
                            ? "destructive"
                            : item.criticidade === "importante"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {item.criticidade}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          R$ {custo.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
