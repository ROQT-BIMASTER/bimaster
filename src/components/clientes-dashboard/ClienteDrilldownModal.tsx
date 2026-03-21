import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useOperacaoFilter } from "@/hooks/useConfigOperacoes";

interface Props {
  codCliente: number;
  filters: DashboardFilters;
  onClose: () => void;
}

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ClienteDrilldownModal({ codCliente, filters, onClose }: Props) {
  const { visiveis, multipliers } = useOperacaoFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-drilldown", codCliente, filters.ano],
    queryFn: async () => {
      // Fetch all sales for this client in the year
      const { data: vendas, error } = await supabase
        .from("vendas_union")
        .select("data,pedido,descricao,marca,quantidade,venda,preco_venda,operacao")
        .eq("cod_cliente", codCliente)
        .gte("data", `${filters.ano}-01-01`)
        .lte("data", `${filters.ano}-12-31`)
        .order("data", { ascending: false });

      if (error) throw error;

      const rows = (vendas || []).filter((v: any) => visiveis.has(v.operacao));

      // Monthly evolution
      const monthMap = new Map<number, number>();
      for (let m = 1; m <= 12; m++) monthMap.set(m, 0);
      
      // Products aggregation
      const prodMap = new Map<string, { qtd: number; receita: number }>();

      for (const v of rows) {
        const mult = multipliers.get(v.operacao) ?? 1;
        const valor = ((v as any).venda ?? ((v as any).preco_venda && (v as any).quantidade ? (v as any).preco_venda * (v as any).quantidade : 0)) * mult;
        const mes = new Date(v.data).getMonth() + 1;
        monthMap.set(mes, (monthMap.get(mes) || 0) + valor);

        const desc = (v as any).descricao || "Sem descrição";
        if (!prodMap.has(desc)) prodMap.set(desc, { qtd: 0, receita: 0 });
        prodMap.get(desc)!.qtd += (v as any).quantidade || 0;
        prodMap.get(desc)!.receita += valor;
      }

      const mNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const evolucao = Array.from(monthMap.entries()).map(([m, r]) => ({ mes: mNames[m - 1], receita: r }));
      const topProdutos = [...prodMap.entries()]
        .map(([desc, v]) => ({ descricao: desc, ...v }))
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 10);

      return { evolucao, topProdutos, totalRegistros: rows.length };
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cliente #{codCliente} — Detalhes {filters.ano}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Evolução Mensal de Receita</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data?.evolucao}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [fmtMoeda(v), "Receita"]} />
                    <defs>
                      <linearGradient id="clienteGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary))" fill="url(#clienteGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top 10 Produtos</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtde</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topProdutos || []).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{p.descricao}</TableCell>
                        <TableCell className="text-right">{p.qtd.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoeda(p.receita)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
