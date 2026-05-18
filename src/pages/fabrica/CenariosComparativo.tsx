import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGrupoCenario, type CenarioProduto } from "@/hooks/useGrupoCenarios";
import { ArrowLeft, Trophy, Layers, TrendingDown, TrendingUp, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { PromoverCenarioDialog } from "@/components/fabrica/cenarios/PromoverCenarioDialog";
import { NovoCenarioDialog } from "@/components/fabrica/cenarios/NovoCenarioDialog";

interface CustoItem {
  produto_id: string;
  codigo: string;
  nome: string;
  fornecedor: string | null;
  tipo_insumo: string | null;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
  nf_referencia: string | null;
}

interface ProdutoCustosAgg {
  produto_id: string;
  custoTotal: number;
  itens: CustoItem[];
}

function useCustosDoGrupo(produtoIds: string[]) {
  return useQuery({
    queryKey: ["fabrica-cenarios-custos", produtoIds.slice().sort().join(",")],
    enabled: produtoIds.length > 0,
    queryFn: async (): Promise<Map<string, ProdutoCustosAgg>> => {
      const { data, error } = await supabase
        .from("fabrica_produto_custos")
        .select("produto_id, codigo, nome, fornecedor, tipo_insumo, custo_nf, custo_servico, custo_condicao, nf_referencia, ordem")
        .in("produto_id", produtoIds)
        .order("ordem", { ascending: true });
      if (error) throw error;

      const map = new Map<string, ProdutoCustosAgg>();
      (data ?? []).forEach((row: any) => {
        const cur = map.get(row.produto_id) ?? { produto_id: row.produto_id, custoTotal: 0, itens: [] };
        const item: CustoItem = {
          produto_id: row.produto_id,
          codigo: row.codigo,
          nome: row.nome,
          fornecedor: row.fornecedor,
          tipo_insumo: row.tipo_insumo,
          custo_nf: Number(row.custo_nf || 0),
          custo_servico: Number(row.custo_servico || 0),
          custo_condicao: Number(row.custo_condicao || 0),
          nf_referencia: row.nf_referencia,
        };
        cur.itens.push(item);
        cur.custoTotal += item.custo_nf + item.custo_servico + item.custo_condicao;
        map.set(row.produto_id, cur);
      });
      return map;
    },
  });
}

export default function CenariosComparativo() {
  const { grupoId } = useParams<{ grupoId: string }>();
  const navigate = useNavigate();
  const { data: cenarios = [], isLoading, refetch } = useGrupoCenario(grupoId ?? null, false);
  const produtoIds = useMemo(() => cenarios.map((c) => c.id), [cenarios]);
  const { data: custosMap } = useCustosDoGrupo(produtoIds);

  const [vencedor, setVencedor] = useState<CenarioProduto | null>(null);
  const [promoverOpen, setPromoverOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);

  const custosArr = useMemo(() => {
    return cenarios.map((c) => ({
      produto: c,
      custoTotal: custosMap?.get(c.id)?.custoTotal ?? 0,
      custoUnit: c.custo_unitario ?? custosMap?.get(c.id)?.custoTotal ?? 0,
      itens: custosMap?.get(c.id)?.itens ?? [],
    }));
  }, [cenarios, custosMap]);

  const minCusto = useMemo(() => {
    const vals = custosArr.map((x) => x.custoTotal).filter((v) => v > 0);
    return vals.length > 0 ? Math.min(...vals) : null;
  }, [custosArr]);
  const maxMargem = useMemo(() => {
    const vals = custosArr.map((x) => Number(x.produto.preco_maximo || 0) - x.custoTotal);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [custosArr]);

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica/produtos-acabados")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Comparativo de Cenários
              </h1>
              <p className="text-xs text-muted-foreground">
                {cenarios.length} cenário(s) ativo(s) neste grupo · {cenarios[0]?.nome ?? ""}
              </p>
            </div>
          </div>
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Adicionar cenário
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : cenarios.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Nenhum cenário ativo neste grupo. Use "Adicionar cenário" para começar.
          </Card>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cenarios.length, 4)}, minmax(280px, 1fr))` }}>
            {custosArr.map(({ produto, custoTotal, custoUnit, itens }) => {
              const isMinCusto = minCusto !== null && custoTotal === minCusto && custoTotal > 0;
              const margem = Number(produto.preco_maximo || 0) - custoTotal;
              const isMaxMargem = maxMargem !== null && margem === maxMargem && margem > 0;

              return (
                <Card key={produto.id} className="p-4 flex flex-col gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm leading-tight flex-1">
                        {produto.cenario_label || produto.nome}
                      </h3>
                      {isMinCusto && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          <TrendingDown className="h-3 w-3 mr-1" /> menor custo
                        </Badge>
                      )}
                      {isMaxMargem && (
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                          <TrendingUp className="h-3 w-3 mr-1" /> maior margem
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{produto.codigo}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo total</div>
                      <div className="text-base font-semibold tabular-nums">{formatCurrency(custoTotal)}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo unit.</div>
                      <div className="text-base font-semibold tabular-nums">{formatCurrency(Number(custoUnit) || 0)}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço sugerido</div>
                      <div className="text-sm font-medium tabular-nums">{formatCurrency(Number(produto.preco_maximo) || 0)}</div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Margem</div>
                      <div className={`text-sm font-medium tabular-nums ${margem > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {formatCurrency(margem)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Composição ({itens.length} insumo{itens.length !== 1 ? "s" : ""})
                    </div>
                    <div className="rounded-md border max-h-44 overflow-auto">
                      <table className="w-full text-xs">
                        <tbody>
                          {itens.slice(0, 12).map((it, i) => {
                            const totalItem = it.custo_nf + it.custo_servico + it.custo_condicao;
                            return (
                              <tr key={`${produto.id}-${i}`} className="border-b last:border-b-0">
                                <td className="px-2 py-1.5">
                                  <div className="font-medium truncate max-w-[160px]" title={it.nome}>{it.nome}</div>
                                  {it.fornecedor && (
                                    <div className="text-[10px] text-muted-foreground truncate" title={it.fornecedor}>
                                      {it.fornecedor}
                                      {it.nf_referencia ? ` · NF ${it.nf_referencia}` : ""}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                  {formatCurrency(totalItem)}
                                </td>
                              </tr>
                            );
                          })}
                          {itens.length === 0 && (
                            <tr><td className="px-2 py-3 text-center text-muted-foreground">Sem insumos lançados.</td></tr>
                          )}
                          {itens.length > 12 && (
                            <tr><td colSpan={2} className="px-2 py-1 text-center text-[10px] text-muted-foreground">+ {itens.length - 12} demais itens</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-auto flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/dashboard/fabrica/ficha-custo/${produto.id}`)}
                    >
                      Ficha
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => { setVencedor(produto); setPromoverOpen(true); }}
                    >
                      <Trophy className="h-3.5 w-3.5 mr-1.5" />
                      Escolher
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <PromoverCenarioDialog
        open={promoverOpen}
        onOpenChange={setPromoverOpen}
        vencedor={vencedor}
        irmaos={cenarios}
        onSuccess={() => {
          refetch();
          // após promoção, volta para a tela principal (aba Oficiais)
          setTimeout(() => navigate("/dashboard/fabrica/produtos-acabados"), 400);
        }}
      />

      <NovoCenarioDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        defaultGrupoId={grupoId}
        onSuccess={() => refetch()}
      />
    </DashboardLayout>
  );
}
