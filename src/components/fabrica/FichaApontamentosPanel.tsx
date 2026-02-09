import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MessageSquare } from "lucide-react";
import type { RevisaoItem } from "@/hooks/useFichaRevisao";
import type { CustoInsumo } from "@/hooks/useFichaCustoProduto";

interface Props {
  apontamentos: RevisaoItem[];
  insumos: CustoInsumo[];
}

const campoLabels: Record<string, string> = {
  custo_nf: "Custo NF",
  custo_servico: "Custo Serviço",
  custo_condicao: "Custo Condição",
};

export function FichaApontamentosPanel({ apontamentos, insumos }: Props) {
  if (apontamentos.length === 0) return null;

  const getInsumoNome = (id: string | null) => {
    if (!id) return "Insumo removido";
    const insumo = insumos.find((i) => i.id === id);
    return insumo ? `${insumo.codigo} - ${insumo.nome}` : "Insumo não encontrado";
  };

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

  return (
    <Card className="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-orange-600" />
          Apontamentos da Diretoria
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {apontamentos.map((item) => (
          <div key={item.id} className="p-3 bg-background rounded-lg border space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{getInsumoNome(item.insumo_id)}</span>
              <Badge variant="outline" className="text-xs">{campoLabels[item.campo] || item.campo}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{formatarMoeda(Number(item.valor_atual))}</span>
              <ArrowRight className="h-3 w-3 text-orange-600" />
              <span className="font-semibold text-orange-700 dark:text-orange-400">{formatarMoeda(Number(item.valor_sugerido))}</span>
            </div>
            {item.comentario && (
              <p className="text-xs text-muted-foreground italic">"{item.comentario}"</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
