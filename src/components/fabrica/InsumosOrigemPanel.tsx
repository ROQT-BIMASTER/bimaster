import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageOpen } from "lucide-react";

interface InsumoOrigem {
  id: string;
  codigo: string;
  nome: string;
  tipo_insumo: string | null;
  fornecedor: string | null;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
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

const formatarMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 }).format(v);

export function InsumosOrigemPanel({ codigoProdutoOrigem }: InsumosOrigemPanelProps) {
  const [insumos, setInsumos] = useState<InsumoOrigem[]>([]);
  const [loading, setLoading] = useState(true);
  const [produtoNome, setProdutoNome] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsumos = async () => {
      setLoading(true);

      // Find the origin product by code
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

      // Fetch its cost sheet insumos
      const { data: custos } = await supabase
        .from("fabrica_produto_custos")
        .select("id, codigo, nome, tipo_insumo, fornecedor, custo_nf, custo_servico, custo_condicao")
        .eq("produto_id", produto.id)
        .order("ordem");

      setInsumos(
        (custos || []).map((c: any) => ({
          id: c.id,
          codigo: c.codigo,
          nome: c.nome,
          tipo_insumo: c.tipo_insumo,
          fornecedor: c.fornecedor,
          custo_nf: Number(c.custo_nf) || 0,
          custo_servico: Number(c.custo_servico) || 0,
          custo_condicao: Number(c.custo_condicao) || 0,
        }))
      );
      setLoading(false);
    };

    fetchInsumos();
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

  const totalNF = insumos.reduce((s, i) => s + i.custo_nf, 0);
  const totalServico = insumos.reduce((s, i) => s + i.custo_servico, 0);
  const totalCondicao = insumos.reduce((s, i) => s + i.custo_condicao, 0);

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <PackageOpen className="h-4 w-4 text-primary" />
        Insumos da Origem
        {produtoNome && (
          <span className="font-normal text-muted-foreground">— {produtoNome}</span>
        )}
        <Badge variant="outline" className="text-[10px] ml-1">{insumos.length}</Badge>
      </h4>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs py-1.5">Código</TableHead>
              <TableHead className="text-xs py-1.5">Insumo</TableHead>
              <TableHead className="text-xs py-1.5">Tipo</TableHead>
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
                  <TableCell className="py-1.5 text-right font-mono">{formatarMoeda(item.custo_nf)}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono">{formatarMoeda(item.custo_servico)}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono">{formatarMoeda(item.custo_condicao)}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono font-medium">{formatarMoeda(total)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/30 font-medium text-xs">
              <TableCell colSpan={3} className="py-1.5 text-right">Totais:</TableCell>
              <TableCell className="py-1.5 text-right font-mono">{formatarMoeda(totalNF)}</TableCell>
              <TableCell className="py-1.5 text-right font-mono">{formatarMoeda(totalServico)}</TableCell>
              <TableCell className="py-1.5 text-right font-mono">{formatarMoeda(totalCondicao)}</TableCell>
              <TableCell className="py-1.5 text-right font-mono font-bold">{formatarMoeda(totalNF + totalServico + totalCondicao)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
