import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  Percent, 
  Calendar,
  DollarSign,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  valorOriginal: number;
  diasAtraso: number;
  onConfirmarAcordo?: (acordo: AcordoCalculado) => void;
}

export interface AcordoCalculado {
  valorOriginal: number;
  descontoPercentual: number;
  valorDesconto: number;
  valorFinal: number;
  numeroParcelas: number;
  valorParcela: number;
  dataInicio: string;
  parcelas: { numero: number; vencimento: string; valor: number }[];
}

export function AcordoCalculadora({ valorOriginal, diasAtraso, onConfirmarAcordo }: Props) {
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entradaPercentual, setEntradaPercentual] = useState(0);

  // Calcular desconto máximo baseado no atraso
  const descontoMaximo = useMemo(() => {
    if (diasAtraso < 30) return 5;
    if (diasAtraso < 60) return 10;
    if (diasAtraso < 90) return 15;
    return 20;
  }, [diasAtraso]);

  // Cálculos do acordo
  const acordo = useMemo<AcordoCalculado>(() => {
    const valorDesconto = valorOriginal * (descontoPercentual / 100);
    const valorFinal = valorOriginal - valorDesconto;
    const valorEntrada = valorFinal * (entradaPercentual / 100);
    const valorParcelar = valorFinal - valorEntrada;
    const valorParcela = numeroParcelas > 0 ? valorParcelar / numeroParcelas : valorFinal;

    // Gerar parcelas
    const parcelas: { numero: number; vencimento: string; valor: number }[] = [];
    
    // Entrada (se houver)
    if (entradaPercentual > 0) {
      parcelas.push({
        numero: 0,
        vencimento: dataInicio,
        valor: valorEntrada
      });
    }

    // Parcelas regulares
    const dataBase = new Date(dataInicio);
    for (let i = 1; i <= numeroParcelas; i++) {
      const vencimento = addMonths(dataBase, entradaPercentual > 0 ? i : i - 1);
      parcelas.push({
        numero: i,
        vencimento: format(vencimento, 'yyyy-MM-dd'),
        valor: valorParcela
      });
    }

    return {
      valorOriginal,
      descontoPercentual,
      valorDesconto,
      valorFinal,
      numeroParcelas: entradaPercentual > 0 ? numeroParcelas + 1 : numeroParcelas,
      valorParcela,
      dataInicio,
      parcelas
    };
  }, [valorOriginal, descontoPercentual, numeroParcelas, dataInicio, entradaPercentual]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Calculadora de Acordo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Valor Original */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Valor Original da Dívida</span>
            <span className="text-xl font-bold text-destructive">{formatCurrency(valorOriginal)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-muted-foreground">Dias de atraso</span>
            <Badge variant="outline">{diasAtraso} dias</Badge>
          </div>
        </div>

        {/* Desconto */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Desconto
            </Label>
            <Badge variant="secondary">{descontoPercentual}%</Badge>
          </div>
          <Slider
            value={[descontoPercentual]}
            onValueChange={([value]) => setDescontoPercentual(value)}
            max={descontoMaximo}
            step={1}
            className="py-2"
          />
          <p className="text-xs text-muted-foreground">
            Desconto máximo permitido: {descontoMaximo}% (baseado em {diasAtraso} dias de atraso)
          </p>
        </div>

        {/* Entrada */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Entrada
            </Label>
            <Badge variant="secondary">{entradaPercentual}%</Badge>
          </div>
          <Slider
            value={[entradaPercentual]}
            onValueChange={([value]) => setEntradaPercentual(value)}
            max={50}
            step={5}
            className="py-2"
          />
          {entradaPercentual > 0 && (
            <p className="text-sm text-green-600">
              Entrada: {formatCurrency(valorOriginal * (1 - descontoPercentual/100) * (entradaPercentual/100))}
            </p>
          )}
        </div>

        {/* Parcelas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Parcelas
            </Label>
            <Select 
              value={numeroParcelas.toString()} 
              onValueChange={(v) => setNumeroParcelas(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data Primeira Parcela</Label>
            <Input 
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
        </div>

        {/* Resumo */}
        <div className="p-4 bg-green-500/10 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Valor com desconto</span>
            <span className="font-semibold">{formatCurrency(acordo.valorFinal)}</span>
          </div>
          {descontoPercentual > 0 && (
            <div className="flex justify-between items-center text-green-600">
              <span className="text-sm">Economia</span>
              <span className="font-semibold">-{formatCurrency(acordo.valorDesconto)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">Valor da parcela</span>
            <span className="text-xl font-bold">{formatCurrency(acordo.valorParcela)}</span>
          </div>
        </div>

        {/* Tabela de Parcelas */}
        {acordo.parcelas.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acordo.parcelas.map((parcela) => (
                  <TableRow key={parcela.numero}>
                    <TableCell>
                      {parcela.numero === 0 ? (
                        <Badge variant="secondary">Entrada</Badge>
                      ) : (
                        `${parcela.numero}/${numeroParcelas}`
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(parcela.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parcela.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Botão Confirmar */}
        {onConfirmarAcordo && (
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => onConfirmarAcordo(acordo)}
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Confirmar Acordo
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
