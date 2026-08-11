import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { PerfilMarkup } from "@/hooks/usePerfisMarkup";
import {
  custoRaizDoProduto,
  precosPorTabela,
  markupEfetivo,
  type ProdutoHipotetico,
  type TabelaNode,
} from "@/lib/fabrica/perfilSimulacao";

interface Props {
  produtos: ProdutoHipotetico[];
  tabelas: TabelaNode[];
  perfilA: PerfilMarkup | null;
  perfilB: PerfilMarkup | null;
}

export function ComparativoPerfisTable({ produtos, tabelas, perfilA, perfilB }: Props) {
  const validos = produtos.filter((p) => p.valor > 0);

  if (!perfilA || validos.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Informe ao menos um produto com valor e selecione um perfil para ver o comparativo.
        </CardContent>
      </Card>
    );
  }

  const itensA = perfilA.itens;
  const itensB = perfilB?.itens ?? [];

  const linhas = validos.map((p) => {
    const custoA = custoRaizDoProduto(p, tabelas, itensA);
    const precosA = precosPorTabela(custoA, tabelas, itensA);
    const custoB = perfilB ? custoRaizDoProduto(p, tabelas, itensB) : 0;
    const precosB = perfilB ? precosPorTabela(custoB, tabelas, itensB) : {};
    return { produto: p, custoA, precosA, custoB, precosB };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Comparativo de preços por perfil</CardTitle>
        <CardDescription>
          {perfilA.nome}
          {perfilB ? ` vs ${perfilB.nome}` : ""} — preços projetados a partir do custo de fábrica
          reconstruído.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Custo fábrica</TableHead>
              {tabelas.map((t) => (
                <TableHead key={t.id} className="text-right">
                  {t.nome}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(({ produto, custoA, precosA, custoB, precosB }) => (
              <>
                <TableRow key={`${produto.id}-a`}>
                  <TableCell className="font-medium">
                    {produto.descricao || "Sem descrição"}
                    <div className="text-xs text-muted-foreground">{perfilA.nome}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(custoA)}</TableCell>
                  {tabelas.map((t) => (
                    <TableCell key={t.id} className="text-right font-mono">
                      {formatCurrency(precosA[t.id] ?? 0)}
                      <div className="text-[10px] text-muted-foreground">
                        {markupEfetivo(precosA[t.id] ?? 0, custoA).toFixed(3)}x
                      </div>
                    </TableCell>
                  ))}
                </TableRow>

                {perfilB && (
                  <TableRow key={`${produto.id}-b`} className="bg-muted/40">
                    <TableCell className="text-xs text-muted-foreground pl-6">
                      {perfilB.nome}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(custoB)}</TableCell>
                    {tabelas.map((t) => {
                      const a = precosA[t.id] ?? 0;
                      const b = precosB[t.id] ?? 0;
                      const diff = b - a;
                      const pct = a > 0 ? (diff / a) * 100 : 0;
                      return (
                        <TableCell key={t.id} className="text-right font-mono">
                          {formatCurrency(b)}
                          {Math.abs(diff) > 0.004 && (
                            <div className="text-[10px]">
                              <Badge
                                variant={diff > 0 ? "default" : "secondary"}
                                className="font-mono text-[10px] px-1 py-0"
                              >
                                {diff > 0 ? "+" : ""}
                                {formatCurrency(diff)} ({pct.toFixed(1)}%)
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
