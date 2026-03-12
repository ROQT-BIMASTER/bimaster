import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";

interface Props {
  produto: ProdutoBrasil;
}

export function ColunaChina({ produto }: Props) {
  const fields = [
    { label: "Nome do Produto", value: produto.china_nome },
    { label: "Código", value: produto.china_codigo },
    { label: "EAN", value: produto.china_ean },
    { label: "Categoria", value: produto.china_categoria },
    { label: "Descrição", value: produto.china_descricao },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="text-lg">🇨🇳</span>
          <Package className="h-4 w-4 text-primary" />
          Dados da China
          <Badge variant="secondary" className="text-[10px] ml-auto">Somente Leitura</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <div key={f.label}>
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <div className="mt-1 text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2 min-h-[36px]">
              {f.value || <span className="text-muted-foreground italic">—</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
