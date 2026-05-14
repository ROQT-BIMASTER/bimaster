import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { SecaoIdentidade } from "./SecaoIdentidade";
import { SecaoGrade } from "./SecaoGrade";
import { SecaoCustosFiscais } from "./SecaoCustosFiscais";
import { SecaoPrecosSugeridos } from "./SecaoPrecosSugeridos";
import { SecaoChecklistRegulatorio } from "./SecaoChecklistRegulatorio";
import { SecaoDocumentos } from "./SecaoDocumentos";

interface Props {
  produto: ProdutoBrasil;
}

export function TabComparacao({ produto }: Props) {
  if (!produto.submissao_china_id) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-sm font-medium text-foreground">
          Este produto não está vinculado a uma submissão da China.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          A comparação lado a lado fica disponível assim que houver vínculo China → Brasil.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        Comparação lado a lado entre a versão chinesa e a versão Brasil do produto.
        Use o status à direita de cada linha para identificar pontos divergentes
        ou faltantes antes de oficializar o cadastro nacional.
      </div>

      <SecaoIdentidade produto={produto} />
      <SecaoGrade
        produtoBrasilId={produto.id}
        submissaoChinaId={produto.submissao_china_id}
      />
      <SecaoCustosFiscais
        produtoBrasilId={produto.id}
        submissaoChinaId={produto.submissao_china_id}
        custoUnitarioChina={produto.custo_unitario_china}
      />
      <SecaoPrecosSugeridos produtoBrasilId={produto.id} />
      <SecaoChecklistRegulatorio produto={produto} />
      <SecaoDocumentos
        produtoBrasilId={produto.id}
        submissaoChinaId={produto.submissao_china_id}
      />
    </div>
  );
}
