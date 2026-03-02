import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { arredondamentoFiscal } from "@/lib/fabrica/fiscal-iva-service";

export function IVAApuracaoResumo() {
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data, isLoading } = useQuery({
    queryKey: ["iva-apuracao", periodo],
    queryFn: async () => {
      const [ano, mes] = periodo.split("-").map(Number);
      const inicioMes = new Date(ano, mes - 1, 1).toISOString();
      const fimMes = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      // Buscar créditos de itens de NF (entradas) no período
      const { data: itensNF, error: errItens } = await supabase
        .from("fabrica_itens_nf")
        .select("valor_cbs, valor_ibs, elegivel_credito_iva, created_at")
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes)
        .not("valor_cbs", "is", null);

      if (errItens) throw errItens;

      // Buscar débitos da apuração fiscal existente (CBS/IBS)
      const { data: apuracoes, error: errAp } = await supabase
        .from("fabrica_apuracao_fiscal")
        .select("tipo_imposto, total_debitos, total_creditos, saldo_periodo")
        .eq("periodo", periodo)
        .in("tipo_imposto", ["CBS", "IBS"]);

      if (errAp) throw errAp;

      // Calcular créditos dos itens de NF
      const creditos_cbs = arredondamentoFiscal(
        (itensNF || [])
          .filter((i) => i.elegivel_credito_iva !== false)
          .reduce((s, i) => s + (i.valor_cbs || 0), 0)
      );
      const creditos_ibs = arredondamentoFiscal(
        (itensNF || [])
          .filter((i) => i.elegivel_credito_iva !== false)
          .reduce((s, i) => s + (i.valor_ibs || 0), 0)
      );

      // Pegar débitos da apuração (se existirem)
      const apCBS = apuracoes?.find((a) => a.tipo_imposto === "CBS");
      const apIBS = apuracoes?.find((a) => a.tipo_imposto === "IBS");

      const debitos_cbs = apCBS?.total_debitos || 0;
      const debitos_ibs = apIBS?.total_debitos || 0;

      return {
        debitos_cbs,
        debitos_ibs,
        creditos_cbs,
        creditos_ibs,
        cbs_a_recolher: arredondamentoFiscal(debitos_cbs - creditos_cbs),
        ibs_a_recolher: arredondamentoFiscal(debitos_ibs - creditos_ibs),
        total_itens: itensNF?.length || 0,
      };
    },
    enabled: !!periodo,
  });

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div>
          <Label>Período (mês/ano)</Label>
          <Input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-48"
          />
        </div>
        {data && (
          <Badge variant="outline" className="mt-5">
            {data.total_itens} itens no período
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {/* CBS */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-500" />
                Débitos CBS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(data.debitos_cbs)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-500" />
                Créditos CBS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{fmt(data.creditos_cbs)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                CBS a Recolher
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.cbs_a_recolher > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmt(data.cbs_a_recolher)}
              </div>
            </CardContent>
          </Card>

          {/* IBS */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-500" />
                Débitos IBS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(data.debitos_ibs)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-500" />
                Créditos IBS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{fmt(data.creditos_ibs)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                IBS a Recolher
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.ibs_a_recolher > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmt(data.ibs_a_recolher)}
              </div>
            </CardContent>
          </Card>

          {/* Saldo Total */}
          <Card className="md:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total IVA (CBS + IBS)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${(data.cbs_a_recolher + data.ibs_a_recolher) > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmt(data.cbs_a_recolher + data.ibs_a_recolher)}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">Selecione um período</p>
      )}
    </div>
  );
}
