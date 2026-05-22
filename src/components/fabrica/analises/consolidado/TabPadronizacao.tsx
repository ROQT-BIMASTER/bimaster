import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wand2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ProdutoConsolidado } from "@/hooks/useCustosConsolidados";
import { detectarDuplicados, type AggInsumoFornecedor } from "@/lib/fabrica/consolidado-utils";
import { DialogPadronizar } from "./DialogPadronizar";

export function TabPadronizacao({ produtos }: { produtos: ProdutoConsolidado[] }) {
  const grupos = useMemo(() => detectarDuplicados(produtos), [produtos]);
  const [selecionado, setSelecionado] = useState<AggInsumoFornecedor | null>(null);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  function handleAbrir(g: AggInsumoFornecedor) {
    setSelecionado(g);
    setOpen(true);
  }

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ["fabrica-custos-consolidados-v1"] });
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-muted/30 flex items-center gap-2 text-xs">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        <span>
          {grupos.length === 0
            ? "Nenhum cadastro duplicado detectado nas fichas filtradas."
            : `${grupos.length} grupo(s) com a mesma descrição + fornecedor cadastrados em códigos diferentes.`}
        </span>
      </div>
      <div className="overflow-auto max-h-[680px]">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Descrição canônica</th>
              <th className="px-3 py-2 font-medium">Fornecedor</th>
              <th className="px-3 py-2 font-medium">Códigos atuais</th>
              <th className="px-3 py-2 font-medium text-right">Variantes</th>
              <th className="px-3 py-2 font-medium text-right"># Produtos</th>
              <th className="px-3 py-2 font-medium text-right">Custo médio</th>
              <th className="px-3 py-2 font-medium text-right">Total acumulado</th>
              <th className="px-3 py-2 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">Sem duplicidades.</td></tr>
            )}
            {grupos.map((g) => (
              <tr key={g.chave} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2" title={g.insumoNome}>{g.insumoNome}</td>
                <td className="px-3 py-2 text-muted-foreground">{g.fornecedor}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                    {g.codigos.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-muted whitespace-nowrap">{c || "—"}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                    {g.codigos.length}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{g.nProdutos}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(g.custoMedio)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(g.totalAcumulado)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => handleAbrir(g)}>
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    Padronizar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DialogPadronizar grupo={selecionado} open={open} onOpenChange={setOpen} onSuccess={handleSuccess} />
    </Card>
  );
}
