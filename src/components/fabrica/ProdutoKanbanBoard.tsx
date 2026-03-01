import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileX, RefreshCw, CheckCircle2 } from "lucide-react";
import { ProdutoKanbanCard } from "./ProdutoKanbanCard";

interface ProdutoKanbanBoardProps {
  produtos: any[];
  fichasMap: Map<string, string>;
  custoTotalMap: Map<string, number>;
  produtosComAumento: Set<string>;
  formatarMoeda: (valor: number) => string;
  onProdutoClick: (produto: any) => void;
}

const COLUMNS = [
  {
    id: "sem_ficha",
    label: "Sem Ficha",
    icon: FileX,
    color: "bg-muted-foreground",
    bgCard: "bg-muted/30",
    statuses: [] as string[], // products NOT in fichasMap
  },
  {
    id: "em_revisao",
    label: "Em Revisão",
    icon: RefreshCw,
    color: "bg-warning",
    bgCard: "bg-warning/10",
    statuses: ["revisao_solicitada", "em_revisao", "rascunho"],
  },
  {
    id: "aprovado",
    label: "Aprovado",
    icon: CheckCircle2,
    color: "bg-success",
    bgCard: "bg-success/10",
    statuses: ["aprovada"],
  },
];

export function ProdutoKanbanBoard({
  produtos,
  fichasMap,
  custoTotalMap,
  produtosComAumento,
  formatarMoeda,
  onProdutoClick,
}: ProdutoKanbanBoardProps) {
  const grouped = useMemo(() => {
    const result: Record<string, any[]> = {
      sem_ficha: [],
      em_revisao: [],
      aprovado: [],
    };

    produtos.forEach((p) => {
      const status = fichasMap.get(p.id);
      if (!status) {
        result.sem_ficha.push(p);
      } else if (COLUMNS[2].statuses.includes(status)) {
        result.aprovado.push(p);
      } else {
        result.em_revisao.push(p);
      }
    });

    return result;
  }, [produtos, fichasMap]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[500px]">
      {COLUMNS.map((col) => {
        const items = grouped[col.id] || [];
        const Icon = col.icon;

        return (
          <div
            key={col.id}
            className={`rounded-xl border ${col.bgCard} flex flex-col`}
          >
            {/* Column Header */}
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{col.label}</span>
                </div>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className={`h-1 w-full rounded-full ${col.color}`} />
            </div>

            {/* Column Content */}
            <ScrollArea className="flex-1 px-3 pb-3">
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    Nenhum produto
                  </div>
                ) : (
                  items.map((produto) => (
                    <ProdutoKanbanCard
                      key={produto.id}
                      produto={produto}
                      custoTotal={custoTotalMap.get(produto.id)}
                      temAumento={produtosComAumento.has(produto.id)}
                      onClick={onProdutoClick}
                      formatarMoeda={formatarMoeda}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
