import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { custoTotalDoSnapshot } from "@/lib/fabrica/ficha-custo-snapshot";
import { FileCheck, Factory, Layers, History, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  produtoId: string;
  produtoNome?: string;
  custoPropostoAtual?: number;
}

interface OrigemItem {
  fonte: "ficha_aprovada" | "ordem_producao" | "snapshot" | "tabela_publicada";
  titulo: string;
  valor: number;
  autor?: string | null;
  timestamp?: string | null;
  detalhe?: string;
}

/**
 * Linha do tempo da origem do custo de um produto da Tabela Fábrica.
 * Útil na revisão para validar de onde veio o custo proposto.
 */
export function OrigemCustoHistorico({ produtoId, produtoNome, custoPropostoAtual }: Props) {
  const { data: itens, isLoading } = useQuery({
    queryKey: ["origem-custo-produto", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const lista: OrigemItem[] = [];

      // 1) Snapshots de ficha (mais recentes primeiro)
      const { data: revisoes } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select("snapshot_totais, status, parecer, created_at, submetido_por, aprovado_por, aprovado_em")
        .eq("produto_id", produtoId)
        .order("created_at", { ascending: false })
        .limit(5);

      const userIds = new Set<string>();
      (revisoes || []).forEach((r: any) => {
        if (r.submetido_por) userIds.add(r.submetido_por);
        if (r.aprovado_por) userIds.add(r.aprovado_por);
      });

      let nomes: Record<string, string> = {};
      if (userIds.size) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", Array.from(userIds));
        nomes = Object.fromEntries((profs || []).map((p: any) => [p.id, p.nome]));
      }

      (revisoes || []).forEach((r: any, idx: number) => {
        const valor = custoTotalDoSnapshot(r.snapshot_totais);
        lista.push({
          fonte: idx === 0 && r.status === "aprovado" ? "ficha_aprovada" : "snapshot",
          titulo: idx === 0 && r.status === "aprovado"
            ? "Ficha de Análise — última aprovada"
            : `Snapshot #${idx + 1} (${r.status})`,
          valor,
          autor: nomes[r.aprovado_por] || nomes[r.submetido_por] || null,
          timestamp: r.aprovado_em || r.created_at,
          detalhe: r.parecer || undefined,
        });
      });

      // 2) Últimas 3 ordens de produção concluídas
      const { data: ops } = await supabase
        .from("fabrica_ordens_producao")
        .select(`
          id, codigo, created_at, quantidade_planejada, quantidade_produzida,
          fabrica_custos_producao(valor)
        `)
        .eq("produto_id", produtoId)
        .eq("status", "concluida")
        .order("created_at", { ascending: false })
        .limit(3);

      (ops || []).forEach((op: any) => {
        const totalCusto = (op.fabrica_custos_producao || []).reduce(
          (a: number, c: any) => a + (Number(c.valor) || 0), 0,
        );
        const qtd = op.quantidade_produzida || op.quantidade_planejada || 1;
        const unit = qtd > 0 ? totalCusto / qtd : 0;
        lista.push({
          fonte: "ordem_producao",
          titulo: `OP ${op.codigo || op.id.slice(0, 8)}`,
          valor: unit,
          timestamp: op.created_at,
          detalhe: `Custo unitário (${qtd} un)`,
        });
      });

      // 3) Preço vigente em tabela aprovada (Fábrica) como referência
      const { data: precoVigente } = await supabase
        .from("fabrica_precos_produtos")
        .select("preco_final, custo_base, data_atualizacao, fabrica_tabelas_preco!inner(nome, status)")
        .eq("produto_id", produtoId)
        .eq("ativo", true)
        .order("data_atualizacao", { ascending: false })
        .limit(3);

      (precoVigente || []).forEach((pv: any) => {
        if (pv.fabrica_tabelas_preco?.status !== "approved") return;
        lista.push({
          fonte: "tabela_publicada",
          titulo: `Tabela vigente: ${pv.fabrica_tabelas_preco.nome}`,
          valor: Number(pv.custo_base) || 0,
          timestamp: pv.data_atualizacao,
          detalhe: `Preço final atual ${formatarMoeda(Number(pv.preco_final) || 0)}`,
        });
      });

      return lista;
    },
  });

  const iconeFonte = (f: OrigemItem["fonte"]) => {
    switch (f) {
      case "ficha_aprovada": return <FileCheck className="h-4 w-4 text-emerald-600" />;
      case "ordem_producao": return <Factory className="h-4 w-4 text-blue-600" />;
      case "snapshot": return <Layers className="h-4 w-4 text-muted-foreground" />;
      case "tabela_publicada": return <History className="h-4 w-4 text-orange-600" />;
    }
  };

  const variacao = (v: number) => {
    if (custoPropostoAtual == null || custoPropostoAtual <= 0 || v <= 0) return null;
    const pct = ((custoPropostoAtual - v) / v) * 100;
    return pct;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Carregando origem do custo...
        </CardContent>
      </Card>
    );
  }

  if (!itens || itens.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Nenhum histórico de custo encontrado para {produtoNome || "este produto"}.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {custoPropostoAtual != null && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Custo proposto na revisão atual:</span>{" "}
              <span className="font-semibold">{formatarMoeda(custoPropostoAtual)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {itens.map((it, idx) => {
        const v = variacao(it.valor);
        return (
          <Card key={idx} className="border-l-2 border-l-border">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {iconeFonte(it.fonte)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{it.titulo}</p>
                    {it.detalhe && (
                      <p className="text-xs text-muted-foreground truncate">{it.detalhe}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {it.autor && <span>{it.autor} · </span>}
                      {it.timestamp && new Date(it.timestamp).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatarMoeda(it.valor)}</p>
                  {v != null && (
                    <Badge
                      variant="outline"
                      className={`text-xs gap-1 mt-0.5 ${
                        v > 0 ? "text-orange-600" : v < 0 ? "text-emerald-600" : ""
                      }`}
                    >
                      {v > 0 ? <TrendingUp className="h-3 w-3" /> : v < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                      {v > 0 ? "+" : ""}{v.toFixed(2)}% vs proposto
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
