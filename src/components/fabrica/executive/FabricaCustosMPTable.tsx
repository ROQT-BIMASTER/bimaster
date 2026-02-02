import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Package } from "lucide-react";

interface MateriaPrima {
  id: string;
  nome: string;
  codigo: string;
  custo_unitario: number | null;
}

interface Props {
  materiasPrimas: MateriaPrima[];
}

export function FabricaCustosMPTable({ materiasPrimas }: Props) {
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  // Calcular custo total e médio
  const custoTotal = materiasPrimas.reduce((acc, mp) => acc + (mp.custo_unitario || 0), 0);
  const custoMedio = materiasPrimas.length > 0 ? custoTotal / materiasPrimas.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Top 10 Matérias-Primas por Custo
          </div>
          <Badge variant="secondary">
            Média: {formatCurrency(custoMedio)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {materiasPrimas.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <div className="text-center">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma matéria-prima cadastrada</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Matéria-Prima</TableHead>
                <TableHead className="text-right">Custo Unitário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiasPrimas.map((mp, index) => (
                <TableRow key={mp.id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{mp.codigo}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{mp.nome}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(mp.custo_unitario)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
