import { Badge } from "@/components/ui/badge";
import { FlaskConical, Percent, Scale } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FormulaItem {
  id: string;
  quantidade: number;
  percentual_composicao?: number | null;
  materia_prima?: {
    nome: string;
    codigo?: string;
    unidade?: string;
  } | null;
}

interface Formula {
  id: string;
  nome: string;
  versao?: number | null;
  rendimento_esperado?: number | null;
  itens?: FormulaItem[];
}

interface ProductFormulaProps {
  formula: Formula | null;
}

export function ProductFormula({ formula }: ProductFormulaProps) {
  if (!formula) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <FlaskConical className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Fórmula não cadastrada</p>
      </div>
    );
  }

  const itens = formula.itens || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Composição / Fórmula
        </h4>
        <div className="flex items-center gap-2">
          {formula.versao && (
            <Badge variant="outline" className="text-xs">
              v{formula.versao}
            </Badge>
          )}
          {formula.rendimento_esperado && (
            <Badge variant="secondary" className="text-xs">
              <Scale className="h-3 w-3 mr-1" />
              Rend: {formula.rendimento_esperado}%
            </Badge>
          )}
        </div>
      </div>

      {itens.length > 0 ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Ingrediente</TableHead>
                <TableHead className="text-xs text-right">%</TableHead>
                <TableHead className="text-xs text-right">Qtd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item, index) => (
                <TableRow key={item.id || index} className="text-sm">
                  <TableCell className="py-2">
                    <span className="font-medium">
                      {item.materia_prima?.nome || 'Item não identificado'}
                    </span>
                    {item.materia_prima?.codigo && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({item.materia_prima.codigo})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    {item.percentual_composicao ? (
                      <Badge variant="outline" className="text-xs">
                        <Percent className="h-2.5 w-2.5 mr-0.5" />
                        {item.percentual_composicao.toFixed(1)}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="py-2 text-right text-muted-foreground">
                    {item.quantidade} {item.materia_prima?.unidade || 'un'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
          Nenhum ingrediente cadastrado
        </p>
      )}
    </div>
  );
}