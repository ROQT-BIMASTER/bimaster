import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { explodirBOM } from "@/lib/fabrica/bom-explosion";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SimuladorProducaoProps {
  formulaId: string;
  onClose: () => void;
}

export function SimuladorProducao({
  formulaId,
  onClose,
}: SimuladorProducaoProps) {
  const [quantidade, setQuantidade] = useState(100);
  const [considerarPerdas, setConsiderarPerdas] = useState(true);

  const { data: resultado, isLoading } = useQuery({
    queryKey: ["explosao-bom", formulaId, quantidade, considerarPerdas],
    queryFn: () => explodirBOM(formulaId, quantidade, considerarPerdas),
    enabled: quantidade > 0,
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Simulador de Produção</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Inputs */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Quantidade a Produzir</Label>
              <Input
                type="number"
                value={quantidade}
                onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
                min="1"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={considerarPerdas}
                onChange={(e) => setConsiderarPerdas(e.target.checked)}
                className="rounded"
              />
              <Label>Considerar perdas esperadas</Label>
            </div>
          </div>

          {/* Alertas */}
          {resultado?.alertas && resultado.alertas.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {resultado.alertas.map((alerta, i) => (
                    <li key={i}>{alerta}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Resumo */}
          {resultado && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-2xl font-bold text-primary">
                  R$ {resultado.custoTotalEstimado.toFixed(2)}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Tempo Estimado
                </p>
                <p className="text-2xl font-bold">
                  {resultado.tempoProducaoEstimado} min
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Custo Unitário
                </p>
                <p className="text-2xl font-bold">
                  R${" "}
                  {(resultado.custoTotalEstimado / quantidade).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Tabela de Materiais */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            resultado && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matéria-Prima</TableHead>
                      <TableHead className="text-right">Necessário</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">Falta</TableHead>
                      <TableHead className="text-right">
                        Custo Unit.
                      </TableHead>
                      <TableHead className="text-right">
                        Custo Total
                      </TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.materiaisNecessarios.map((material) => (
                      <TableRow key={material.mp_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{material.mp_nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {material.mp_codigo}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {material.quantidade_necessaria.toFixed(2)}{" "}
                          {material.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {material.estoque_disponivel.toFixed(2)}{" "}
                          {material.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {material.falta > 0 && (
                            <span className="text-destructive font-medium">
                              {material.falta.toFixed(2)} {material.unidade}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {material.custo_unitario.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {material.custo_total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          {material.falta > 0 ? (
                            <Badge variant="destructive">Insuficiente</Badge>
                          ) : (
                            <Badge className="bg-success">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button
              disabled={
                !resultado ||
                resultado.materiaisNecessarios.some((m) => m.falta > 0)
              }
            >
              Gerar Ordem de Produção
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
