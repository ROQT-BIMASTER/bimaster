import { Progress } from "@/components/ui/progress";

interface ChinaOrdemProgressProps {
  cores: { cor_nome: string; qty_pedida: number; qty_produzida: number }[];
  qtyTotal: number;
  qtyProduzida: number;
}

export function ChinaOrdemProgress({ cores, qtyTotal, qtyProduzida }: ChinaOrdemProgressProps) {
  const pctTotal = qtyTotal > 0 ? Math.round((qtyProduzida / qtyTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="p-4 bg-secondary/50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Progresso Total 总进度
          </span>
          <span className="text-2xl font-bold text-primary">{pctTotal}%</span>
        </div>
        <Progress value={pctTotal} gradient className="h-4" />
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {qtyProduzida.toLocaleString()} / {qtyTotal.toLocaleString()} 单位
        </p>
      </div>

      {/* Per-color progress */}
      {cores.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Por Cor 按颜色</p>
          {cores.map((cor) => {
            const pct = cor.qty_pedida > 0
              ? Math.min(100, Math.round((cor.qty_produzida / cor.qty_pedida) * 100))
              : 0;
            const isComplete = pct >= 100;
            return (
              <div key={cor.cor_nome} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium truncate">{cor.cor_nome}</span>
                  <span className={`text-sm font-bold ${isComplete ? "text-success" : "text-foreground"}`}>
                    {cor.qty_produzida} / {cor.qty_pedida}
                  </span>
                </div>
                <Progress
                  value={pct}
                  className={`h-2.5 ${isComplete ? "[&>div]:bg-success" : ""}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
