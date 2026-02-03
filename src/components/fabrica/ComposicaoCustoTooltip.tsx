import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Wrench, Percent, Calculator } from "lucide-react";

interface InsumoComposicao {
  codigo: string;
  nome: string;
  tipo_insumo: string;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
}

interface TotaisComposicao {
  subtotal: number;
  markup: number;
  custo_total: number;
}

export interface ComposicaoCustoData {
  insumos: InsumoComposicao[];
  mao_obra_nf: number;
  mao_obra_servico: number;
  markup_percentual: number;
  totais: TotaisComposicao;
}

interface ComposicaoCustoTooltipProps {
  composicao: ComposicaoCustoData | string;
}

const getTipoInsumoLabel = (tipo: string): string => {
  const labels: Record<string, string> = {
    bulk: "Bulk",
    embalagem_primaria: "Emb. Primária",
    embalagem_secundaria: "Emb. Secundária",
    rotulo: "Rótulo",
    acessorio: "Acessório",
    outro: "Outro",
  };
  return labels[tipo] || tipo;
};

export function ComposicaoCustoTooltip({ composicao }: ComposicaoCustoTooltipProps) {
  // Parse se for string
  const data: ComposicaoCustoData = typeof composicao === "string" 
    ? JSON.parse(composicao) 
    : composicao;

  if (!data || !data.totais) {
    return <p className="text-sm text-muted-foreground">Dados indisponíveis</p>;
  }

  const totalInsumosNF = data.insumos?.reduce((acc, i) => acc + (i.custo_nf || 0), 0) || 0;
  const totalInsumosServico = data.insumos?.reduce((acc, i) => acc + (i.custo_servico || 0), 0) || 0;
  const totalInsumosCondicao = data.insumos?.reduce((acc, i) => acc + (i.custo_condicao || 0), 0) || 0;

  return (
    <div className="w-80 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Calculator className="h-4 w-4 text-primary" />
        Composição do Custo
      </div>

      {/* Insumos */}
      {data.insumos && data.insumos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-3 w-3" />
            Insumos
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {data.insumos.map((insumo, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {getTipoInsumoLabel(insumo.tipo_insumo)}
                  </Badge>
                  <span className="truncate">{insumo.nome}</span>
                </div>
                <span className="font-mono ml-2">
                  {formatarMoeda((insumo.custo_nf || 0) + (insumo.custo_servico || 0) + (insumo.custo_condicao || 0))}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs border-t pt-1">
            <span className="text-muted-foreground">Subtotal Insumos</span>
            <span className="font-mono font-medium">
              {formatarMoeda(totalInsumosNF + totalInsumosServico + totalInsumosCondicao)}
            </span>
          </div>
        </div>
      )}

      <Separator />

      {/* Mão de Obra */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wrench className="h-3 w-3" />
          Mão de Obra
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">NF:</span>
            <span className="font-mono">{formatarMoeda(data.mao_obra_nf || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Serviço:</span>
            <span className="font-mono">{formatarMoeda(data.mao_obra_servico || 0)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Totais */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{formatarMoeda(data.totais.subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Percent className="h-3 w-3" />
            Markup ({data.markup_percentual}%)
          </span>
          <span className="font-mono text-green-600">+{formatarMoeda(data.totais.markup)}</span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between text-sm font-semibold">
          <span>Custo Total</span>
          <span className="font-mono text-primary">{formatarMoeda(data.totais.custo_total)}</span>
        </div>
      </div>
    </div>
  );
}
