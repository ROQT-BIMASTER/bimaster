import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageOpen, Wrench, TrendingUp, Calculator, Link2 } from "lucide-react";

interface InsumoOrigem {
  id: string;
  codigo: string;
  nome: string;
  tipo_insumo: string | null;
  fornecedor: string | null;
  nf_referencia: string | null;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
}

interface ConfigOrigem {
  fornecedor_mao_obra: string | null;
  custo_mao_obra_nf: number;
  custo_mao_obra_servico: number;
  percentual_markup: number;
  base_calculo_markup: string;
}

interface InsumosOrigemPanelProps {
  codigoProdutoOrigem: string;
}

const tipoLabels: Record<string, string> = {
  bulk: "Bulk",
  embalagem_primaria: "Emb. Primária",
  embalagem_secundaria: "Emb. Secundária",
  rotulo: "Rótulo",
  acessorio: "Acessório",
  importado_kit: "Produto do Kit",
  outro: "Outro",
};

const baseLabels: Record<string, string> = {
  total: "sobre Totais",
  nf: "sobre NF",
  servico: "sobre Serviço",
  nf_servico: "sobre NF+Serviço",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 }).format(v);

export function InsumosOrigemPanel({ codigoProdutoOrigem }: InsumosOrigemPanelProps) {
  const [insumos, setInsumos] = useState<InsumoOrigem[]>([]);
  const [config, setConfig] = useState<ConfigOrigem | null>(null);
  const [loading, setLoading] = useState(true);
  const [produtoNome, setProdutoNome] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: produto } = await supabase
        .from("fabrica_produtos")
        .select("id, nome")
        .eq("codigo", codigoProdutoOrigem)
        .limit(1)
        .maybeSingle();

      if (!produto) {
        setLoading(false);
        return;
      }

      setProdutoNome(produto.nome);

      // Fetch insumos and config in parallel
      const [insumosRes, configRes] = await Promise.all([
        supabase
          .from("fabrica_produto_custos")
          .select("id, codigo, nome, tipo_insumo, fornecedor, nf_referencia, custo_nf, custo_servico, custo_condicao")
          .eq("produto_id", produto.id)
          .order("fornecedor", { ascending: true, nullsFirst: false }),
        supabase
          .from("fabrica_produto_custos_config")
          .select("fornecedor_mao_obra, custo_mao_obra_nf, custo_mao_obra_servico, percentual_markup, base_calculo_markup")
          .eq("produto_id", produto.id)
          .maybeSingle(),
      ]);

      setInsumos(
        (insumosRes.data || []).map((c: any) => ({
          id: c.id,
          codigo: c.codigo,
          nome: c.nome,
          tipo_insumo: c.tipo_insumo,
          fornecedor: c.fornecedor,
          nf_referencia: c.nf_referencia,
          custo_nf: Number(c.custo_nf) || 0,
          custo_servico: Number(c.custo_servico) || 0,
          custo_condicao: Number(c.custo_condicao) || 0,
        }))
      );

      if (configRes.data) {
        setConfig({
          fornecedor_mao_obra: configRes.data.fornecedor_mao_obra,
          custo_mao_obra_nf: Number(configRes.data.custo_mao_obra_nf) || 0,
          custo_mao_obra_servico: Number(configRes.data.custo_mao_obra_servico) || 0,
          percentual_markup: Number(configRes.data.percentual_markup) || 0,
          base_calculo_markup: configRes.data.base_calculo_markup || "total",
        });
      }

      setLoading(false);
    };

    fetchData();
  }, [codigoProdutoOrigem]);

  if (loading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (insumos.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        <PackageOpen className="h-4 w-4 inline mr-1.5 opacity-60" />
        Nenhum insumo cadastrado na ficha de origem ({codigoProdutoOrigem})
      </div>
    );
  }

  // Calculate totals (same logic as useFichaCustoProduto)
  const sumNF = insumos.reduce((s, i) => s + i.custo_nf, 0);
  const sumServico = insumos.reduce((s, i) => s + i.custo_servico, 0);
  const sumCondicao = insumos.reduce((s, i) => s + i.custo_condicao, 0);

  const moNF = config?.custo_mao_obra_nf || 0;
  const moServico = config?.custo_mao_obra_servico || 0;

  const totalNF = sumNF + moNF;
  const totalServico = sumServico + moServico;
  const totalCondicao = sumCondicao;
  const subtotal = totalNF + totalServico + totalCondicao;

  const pctMarkup = config?.percentual_markup || 0;
  const base = config?.base_calculo_markup || "total";

  const mkNF = (base === "total" || base === "nf" || base === "nf_servico") ? totalNF * (pctMarkup / 100) : 0;
  const mkServico = (base === "total" || base === "servico" || base === "nf_servico") ? totalServico * (pctMarkup / 100) : 0;
  const mkCondicao = base === "total" ? totalCondicao * (pctMarkup / 100) : 0;
  const mkTotal = mkNF + mkServico + mkCondicao;
  const custoTotal = subtotal + mkTotal;

  const hasMO = moNF > 0 || moServico > 0;
  const hasMarkup = pctMarkup > 0;

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Link2 className="h-4 w-4 text-blue-500" />
        <span className="text-[10px] text-blue-500 uppercase tracking-wide font-medium">Vinculado a:</span>
        <span className="font-mono text-blue-600 dark:text-blue-400">{codigoProdutoOrigem}</span>
        {produtoNome && (
          <span className="font-normal text-muted-foreground">— {produtoNome}</span>
        )}
        <Badge variant="outline" className="text-[10px] ml-1 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">{insumos.length} insumos</Badge>
      </h4>

      {/* Insumos table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs py-1.5">Código</TableHead>
              <TableHead className="text-xs py-1.5">Insumo</TableHead>
              <TableHead className="text-xs py-1.5">Tipo</TableHead>
              <TableHead className="text-xs py-1.5">Fornecedor</TableHead>
              <TableHead className="text-xs py-1.5">NF Ref.</TableHead>
              <TableHead className="text-xs py-1.5 text-right">NF</TableHead>
              <TableHead className="text-xs py-1.5 text-right">Serviço</TableHead>
              <TableHead className="text-xs py-1.5 text-right">Condição</TableHead>
              <TableHead className="text-xs py-1.5 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos.map((item) => {
              const total = item.custo_nf + item.custo_servico + item.custo_condicao;
              return (
                <TableRow key={item.id} className="text-xs">
                  <TableCell className="py-1.5 font-mono">{item.codigo}</TableCell>
                  <TableCell className="py-1.5">{item.nome}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {tipoLabels[item.tipo_insumo || "outro"] || item.tipo_insumo}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5">{item.fornecedor || "-"}</TableCell>
                  <TableCell className="py-1.5 font-mono">{item.nf_referencia || "-"}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono">{fmt(item.custo_nf)}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono">{fmt(item.custo_servico)}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono">{fmt(item.custo_condicao)}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono font-medium">{fmt(total)}</TableCell>
                </TableRow>
              );
            })}
            {/* Subtotal insumos */}
            <TableRow className="bg-muted/30 text-xs">
              <TableCell colSpan={5} className="py-1.5 text-right font-medium">Subtotal Insumos:</TableCell>
              <TableCell className="py-1.5 text-right font-mono">{fmt(sumNF)}</TableCell>
              <TableCell className="py-1.5 text-right font-mono">{fmt(sumServico)}</TableCell>
              <TableCell className="py-1.5 text-right font-mono">{fmt(sumCondicao)}</TableCell>
              <TableCell className="py-1.5 text-right font-mono font-medium">{fmt(sumNF + sumServico + sumCondicao)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Summary cards: M.O., Markup, Custo Total */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {/* M.O. */}
        <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wrench className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Mão de Obra</span>
          </div>
          {hasMO ? (
            <div className="space-y-0.5">
              {moNF > 0 && <p className="text-xs font-mono">NF: {fmt(moNF)}</p>}
              {moServico > 0 && <p className="text-xs font-mono">Serv: {fmt(moServico)}</p>}
              <p className="text-sm font-bold font-mono">{fmt(moNF + moServico)}</p>
              {config?.fornecedor_mao_obra && (
                <p className="text-[10px] text-muted-foreground truncate">{config.fornecedor_mao_obra}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>

        {/* Markup */}
        <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Markup</span>
          </div>
          {hasMarkup ? (
            <div className="space-y-0.5">
              <Badge variant="outline" className="text-[10px]">{pctMarkup}%</Badge>
              <p className="text-sm font-bold font-mono">{fmt(mkTotal)}</p>
              <p className="text-[10px] text-muted-foreground">{baseLabels[base] || base}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>

        {/* Subtotal */}
        <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Calculator className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Subtotal</span>
          </div>
          <p className="text-sm font-bold font-mono">{fmt(subtotal)}</p>
          <p className="text-[10px] text-muted-foreground">Insumos + M.O.</p>
        </div>

        {/* Custo Total */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <PackageOpen className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-primary uppercase tracking-wide font-medium">Custo Total Unit.</span>
          </div>
          <p className="text-base font-bold font-mono text-primary">{fmt(custoTotal)}</p>
          <p className="text-[10px] text-muted-foreground">Subtotal + Markup</p>
        </div>
      </div>
    </div>
  );
}
