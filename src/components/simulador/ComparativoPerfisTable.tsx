import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Columns3, FileDown, FileSpreadsheet, GripVertical, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import type { PerfilMarkup } from "@/hooks/usePerfisMarkup";
import {
  custoRaizDoProduto,
  precosPorTabela,
  markupEfetivo,
  type ProdutoHipotetico,
  type TabelaNode,
} from "@/lib/fabrica/perfilSimulacao";
import {
  exportarComparativoExcel,
  exportarComparativoPDF,
  ordenarColunasPadrao,
  CABECALHO_PDF_PADRAO,
  type CabecalhoPDF,
  type ComparativoLinhaExport,
} from "@/lib/fabrica/exportComparativoPerfis";

const STORAGE_KEY = "simulador:comparativo:ordem-colunas";
const HIDDEN_KEY = "simulador:comparativo:colunas-ocultas";
const PDF_HEADER_KEY = "simulador:comparativo:cabecalho-pdf";


interface Props {
  produtos: ProdutoHipotetico[];
  tabelas: TabelaNode[];
  perfilA: PerfilMarkup | null;
  perfilB: PerfilMarkup | null;
}

export function ComparativoPerfisTable({ produtos, tabelas, perfilA, perfilB }: Props) {
  const { user } = useAuth();
  const uid = user?.id ?? "anon";
  const hiddenKey = `${HIDDEN_KEY}:${uid}`;

  const [ordem, setOrdem] = useState<string[]>([]);
  const [ocultas, setOcultas] = useState<string[]>([]);

  // Ordem padrão comercial + preferência salva do usuário.
  const colunasOrdenadas = useMemo(() => {
    const padrao = ordenarColunasPadrao(tabelas);
    if (ordem.length === 0) return padrao;
    const mapa = new Map(padrao.map((t) => [t.id, t]));
    const escolhidas = ordem.map((id) => mapa.get(id)).filter(Boolean) as TabelaNode[];
    const restantes = padrao.filter((t) => !ordem.includes(t.id));
    return [...escolhidas, ...restantes];
  }, [tabelas, ordem]);

  const colunasVisiveis = useMemo(
    () => colunasOrdenadas.filter((t) => !ocultas.includes(t.id)),
    [colunasOrdenadas, ocultas],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOrdem(JSON.parse(raw));
    } catch {
      /* preferência opcional */
    }
  }, []);

  // Colunas ocultas: preferência por usuário.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(hiddenKey);
      setOcultas(raw ? JSON.parse(raw) : []);
    } catch {
      setOcultas([]);
    }
  }, [hiddenKey]);

  const persistirOcultas = (ids: string[]) => {
    setOcultas(ids);
    try {
      localStorage.setItem(hiddenKey, JSON.stringify(ids));
    } catch {
      /* preferência opcional */
    }
  };

  const toggleColuna = (id: string) => {
    persistirOcultas(ocultas.includes(id) ? ocultas.filter((x) => x !== id) : [...ocultas, id]);
  };

  const persistirOrdem = (ids: string[]) => {
    setOrdem(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* preferência opcional */
    }
  };

  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  const soltarColuna = (destinoId: string) => {
    const origemId = arrastando;
    setArrastando(null);
    setAlvo(null);
    if (!origemId || origemId === destinoId) return;
    const ids = colunasOrdenadas.map((t) => t.id);
    const from = ids.indexOf(origemId);
    const to = ids.indexOf(destinoId);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    persistirOrdem(ids);
  };


  const validos = produtos.filter((p) => p.valor > 0);


  const linhas = useMemo(() => {
    if (!perfilA) return [];
    const itensA = perfilA.itens;
    const itensB = perfilB?.itens ?? [];
    return validos.map((p) => {
      const custoA = custoRaizDoProduto(p, tabelas, itensA);
      const precosA = precosPorTabela(custoA, tabelas, itensA);
      const custoB = perfilB ? custoRaizDoProduto(p, tabelas, itensB) : 0;
      const precosB = perfilB ? precosPorTabela(custoB, tabelas, itensB) : {};
      return { produto: p, custoA, precosA, custoB, precosB };
    });
  }, [validos, tabelas, perfilA, perfilB]);

  if (!perfilA || validos.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Informe ao menos um produto com valor e selecione um perfil para ver o comparativo.
        </CardContent>
      </Card>
    );
  }

  const linhasExport = (): ComparativoLinhaExport[] => {
    const out: ComparativoLinhaExport[] = [];
    for (const l of linhas) {
      out.push({
        produto: l.produto.descricao || "Sem descrição",
        perfil: perfilA.nome,
        custo: l.custoA,
        precos: l.precosA,
      });
      if (perfilB) {
        const diffs: Record<string, number> = {};
        for (const t of colunasVisiveis) {
          diffs[t.id] = (l.precosB[t.id] ?? 0) - (l.precosA[t.id] ?? 0);
        }
        out.push({
          produto: l.produto.descricao || "Sem descrição",
          perfil: perfilB.nome,
          custo: l.custoB,
          precos: l.precosB,
          diffs,
        });
      }
    }
    return out;
  };

  const handleExcel = async () => {
    try {
      await exportarComparativoExcel(colunasVisiveis, linhasExport(), {
        a: perfilA.nome,
        b: perfilB?.nome,
      });
      toast.success("Comparativo exportado em Excel");
    } catch (e) {
      logger.error("Erro ao exportar comparativo em Excel", e);
      toast.error("Não foi possível exportar o Excel");
    }
  };

  const handlePDF = () => {
    try {
      exportarComparativoPDF(
        colunasVisiveis,
        linhasExport(),
        { a: perfilA.nome, b: perfilB?.nome },
        cabecalho,
      );
      setPdfDialogAberto(false);
      toast.success("PDF gerado");
    } catch (e) {
      logger.error("Erro ao gerar PDF do comparativo", e);
      toast.error("Não foi possível gerar o PDF");
    }
  };


  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Comparativo de preços por perfil</CardTitle>
          <CardDescription>
            {perfilA.nome}
            {perfilB ? ` vs ${perfilB.nome}` : ""} — preços projetados a partir do custo de fábrica
            reconstruído.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-4 w-4 mr-2" />
                Colunas
                {ocultas.length > 0 && (
                  <span className="ml-2 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                    {colunasVisiveis.length}/{colunasOrdenadas.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Colunas visíveis</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {colunasOrdenadas.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t.id}
                  checked={!ocultas.includes(t.id)}
                  onCheckedChange={() => toggleColuna(t.id)}
                  onSelect={(e) => e.preventDefault()}
                  disabled={!ocultas.includes(t.id) && colunasVisiveis.length === 1}
                  className="text-xs"
                >
                  {t.nome}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => persistirOcultas([])} className="text-xs">
                <RotateCcw className="h-3 w-3 mr-2" />
                Mostrar todas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDF}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Custo fábrica</TableHead>
              {colunasVisiveis.map((t) => (
                <TableHead
                  key={t.id}
                  className={`text-right select-none ${
                    alvo === t.id ? "bg-accent/60" : ""
                  } ${arrastando === t.id ? "opacity-50" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    setArrastando(t.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (alvo !== t.id) setAlvo(t.id);
                  }}
                  onDragLeave={() => setAlvo((a) => (a === t.id ? null : a))}
                  onDrop={(e) => {
                    e.preventDefault();
                    soltarColuna(t.id);
                  }}
                  onDragEnd={() => {
                    setArrastando(null);
                    setAlvo(null);
                  }}
                  title="Arraste para reordenar a coluna"
                >
                  <div className="flex items-center justify-end gap-1 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-3 w-3 text-muted-foreground" aria-hidden />
                    <span>{t.nome}</span>
                  </div>
                </TableHead>
              ))}

            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(({ produto, custoA, precosA, custoB, precosB }) => [
              <TableRow key={`${produto.id}-a`}>
                <TableCell className="font-medium">
                  {produto.descricao || "Sem descrição"}
                  <div className="text-xs text-muted-foreground">{perfilA.nome}</div>
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(custoA)}</TableCell>
                {colunasVisiveis.map((t) => (
                  <TableCell key={t.id} className="text-right font-mono">
                    {formatCurrency(precosA[t.id] ?? 0)}
                    <div className="text-[10px] text-muted-foreground">
                      {markupEfetivo(precosA[t.id] ?? 0, custoA).toFixed(3)}x
                    </div>
                  </TableCell>
                ))}
              </TableRow>,

              perfilB ? (
                <TableRow key={`${produto.id}-b`} className="bg-muted/40">
                  <TableCell className="text-xs text-muted-foreground pl-6">
                    {perfilB.nome}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(custoB)}</TableCell>
                  {colunasVisiveis.map((t) => {
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
              ) : null,
            ])}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
