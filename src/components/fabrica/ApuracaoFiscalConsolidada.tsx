import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { arredondamentoFiscal } from "@/lib/fabrica/fiscal-iva-service";

interface ImpostoResumo {
  tipo: string;
  debitos: number;
  creditos: number;
  saldo: number;
}

export function ApuracaoFiscalConsolidada() {
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data, isLoading } = useQuery({
    queryKey: ["apuracao-consolidada", periodo],
    queryFn: async () => {
      const [ano, mes] = periodo.split("-").map(Number);
      const inicioMes = new Date(ano, mes - 1, 1).toISOString();
      const fimMes = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      // 1) Apuração existente (ICMS, PIS, COFINS e qualquer CBS/IBS já lançado)
      const { data: apuracoes } = await supabase
        .from("fabrica_apuracao_fiscal")
        .select("tipo_imposto, total_debitos, total_creditos, saldo_periodo")
        .eq("periodo", periodo);

      // 2) Créditos CBS/IBS dos itens NF de entrada
      const { data: itensEntrada } = await supabase
        .from("fabrica_itens_nf")
        .select("valor_cbs, valor_ibs, elegivel_credito_iva, created_at")
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes)
        .not("valor_cbs", "is", null);

      // 3) Débitos CBS/IBS dos itens NF de saída
      const { data: itensSaida } = await (supabase
        .from("fabrica_itens_nf_saida") as any)
        .select("valor_cbs, valor_ibs, created_at")
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes);

      // Montar mapa de impostos tradicionais
      const impostos: Record<string, ImpostoResumo> = {};

      for (const ap of apuracoes || []) {
        if (!ap.tipo_imposto) continue;
        const tipo = ap.tipo_imposto.toUpperCase();
        if (tipo === "CBS" || tipo === "IBS") continue; // vamos calcular de outra forma
        impostos[tipo] = {
          tipo,
          debitos: ap.total_debitos || 0,
          creditos: ap.total_creditos || 0,
          saldo: ap.saldo_periodo || 0,
        };
      }

      // Garantir ICMS, PIS, COFINS existam
      for (const t of ["ICMS", "PIS", "COFINS"]) {
        if (!impostos[t]) {
          impostos[t] = { tipo: t, debitos: 0, creditos: 0, saldo: 0 };
        }
      }

      // CBS
      const creditosCbs = arredondamentoFiscal(
        (itensEntrada || [])
          .filter((i: any) => i.elegivel_credito_iva !== false)
          .reduce((s: number, i: any) => s + (i.valor_cbs || 0), 0)
      );
      const debitosCbs = arredondamentoFiscal(
        (itensSaida || []).reduce((s: number, i: any) => s + (i.valor_cbs || 0), 0)
      );
      impostos["CBS"] = {
        tipo: "CBS",
        debitos: debitosCbs,
        creditos: creditosCbs,
        saldo: arredondamentoFiscal(debitosCbs - creditosCbs),
      };

      // IBS
      const creditosIbs = arredondamentoFiscal(
        (itensEntrada || [])
          .filter((i: any) => i.elegivel_credito_iva !== false)
          .reduce((s: number, i: any) => s + (i.valor_ibs || 0), 0)
      );
      const debitosIbs = arredondamentoFiscal(
        (itensSaida || []).reduce((s: number, i: any) => s + (i.valor_ibs || 0), 0)
      );
      impostos["IBS"] = {
        tipo: "IBS",
        debitos: debitosIbs,
        creditos: creditosIbs,
        saldo: arredondamentoFiscal(debitosIbs - creditosIbs),
      };

      const lista = ["ICMS", "PIS", "COFINS", "CBS", "IBS"]
        .map((t) => impostos[t])
        .filter(Boolean);

      const totalDebitos = arredondamentoFiscal(lista.reduce((s, i) => s + i.debitos, 0));
      const totalCreditos = arredondamentoFiscal(lista.reduce((s, i) => s + i.creditos, 0));
      const totalSaldo = arredondamentoFiscal(lista.reduce((s, i) => s + i.saldo, 0));

      return { impostos: lista, totalDebitos, totalCreditos, totalSaldo };
    },
    enabled: !!periodo,
  });

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const exportarExcel = async () => {
    if (!data) return;
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Apuração Consolidada");

      ws.columns = [
        { header: "Imposto", key: "tipo", width: 12 },
        { header: "Débitos", key: "debitos", width: 16 },
        { header: "Créditos", key: "creditos", width: 16 },
        { header: "Saldo", key: "saldo", width: 16 },
      ];

      for (const imp of data.impostos) {
        ws.addRow(imp);
      }
      ws.addRow({});
      ws.addRow({
        tipo: "TOTAL",
        debitos: data.totalDebitos,
        creditos: data.totalCreditos,
        saldo: data.totalSaldo,
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apuracao_consolidada_${periodo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: CSV
      const csv = [
        "Imposto,Débitos,Créditos,Saldo",
        ...data.impostos.map((i) => `${i.tipo},${i.debitos},${i.creditos},${i.saldo}`),
        `TOTAL,${data.totalDebitos},${data.totalCreditos},${data.totalSaldo}`,
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apuracao_consolidada_${periodo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <Label>Período</Label>
            <Input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-48"
            />
          </div>
        </div>
        {data && (
          <Button variant="outline" size="sm" onClick={exportarExcel}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Cards resumo */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  Total Débitos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(data.totalDebitos)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  Total Créditos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {fmt(data.totalCreditos)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Saldo a Recolher
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    data.totalSaldo > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {fmt(data.totalSaldo)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela detalhada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detalhamento por Imposto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imposto</TableHead>
                      <TableHead className="text-right">Débitos</TableHead>
                      <TableHead className="text-right">Créditos</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.impostos.map((imp) => (
                      <TableRow key={imp.tipo}>
                        <TableCell>
                          <Badge
                            variant={
                              imp.tipo === "CBS" || imp.tipo === "IBS"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {imp.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{fmt(imp.debitos)}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {fmt(imp.creditos)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            imp.saldo > 0 ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {fmt(imp.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total */}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{fmt(data.totalDebitos)}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {fmt(data.totalCreditos)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          data.totalSaldo > 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {fmt(data.totalSaldo)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-muted-foreground text-center py-8">Selecione um período</p>
      )}
    </div>
  );
}
