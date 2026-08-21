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

  // Cabeçalho personalizável do PDF (preferência por usuário).
  const headerKey = `${PDF_HEADER_KEY}:${uid}`;
  const [pdfDialogAberto, setPdfDialogAberto] = useState(false);
  const [cabecalho, setCabecalho] = useState<CabecalhoPDF>(CABECALHO_PDF_PADRAO);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(headerKey);
      setCabecalho(raw ? { ...CABECALHO_PDF_PADRAO, ...JSON.parse(raw) } : CABECALHO_PDF_PADRAO);
    } catch {
      setCabecalho(CABECALHO_PDF_PADRAO);
    }
  }, [headerKey]);

  const atualizarCabecalho = (patch: Partial<CabecalhoPDF>) => {
    setCabecalho((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(headerKey, JSON.stringify(next));
      } catch {
        /* preferência opcional */
      }
      return next;
    });
  };


  // Filtros da simulação
  const [busca, setBusca] = useState("");
  const [linhasFiltro, setLinhasFiltro] = useState<string[]>([]);
  const [agrupar, setAgrupar] = useState(false);
  const [filtroLinhaAberto, setFiltroLinhaAberto] = useState(false);

  const linhasDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(produtos.map((p) => (p.linha || "").trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [produtos],
  );

  const validos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (!(p.valor > 0)) return false;
      if (termo && !`${p.descricao} ${p.linha ?? ""}`.toLowerCase().includes(termo)) return false;
      if (linhasFiltro.length > 0 && !linhasFiltro.includes((p.linha || "").trim())) return false;
      return true;
    });
  }, [produtos, busca, linhasFiltro]);

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

  /** Agrupamento por linha comercial (mantém a ordem de entrada dentro do grupo). */
  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof linhas>();
    for (const l of linhas) {
      const chave = (l.produto.linha || "").trim() || "Sem linha";
      const atual = mapa.get(chave) ?? [];
      atual.push(l);
      mapa.set(chave, atual);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [linhas]);


  if (!perfilA || validos.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {produtos.some((p) => p.valor > 0) && (busca || linhasFiltro.length > 0)
            ? "Nenhum produto corresponde ao filtro aplicado."
            : "Informe ao menos um produto com valor e selecione um perfil para ver o comparativo."}
        </CardContent>
      </Card>
    );
  }

  const linhasExport = (): ComparativoLinhaExport[] => {
    const out: ComparativoLinhaExport[] = [];
    const fonte = agrupar ? grupos.flatMap(([, itens]) => itens) : linhas;
    for (const l of fonte) {
      const nome = l.produto.descricao || "Sem descrição";
      const linhaProduto = (l.produto.linha || "").trim() || "Sem linha";
      out.push({
        produto: nome,
        linha: linhaProduto,
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
          produto: nome,
          linha: linhaProduto,
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
          <Button variant="outline" size="sm" onClick={() => setPdfDialogAberto(true)}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>

          <Dialog open={pdfDialogAberto} onOpenChange={setPdfDialogAberto}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Cabeçalho do PDF</DialogTitle>
                <DialogDescription>
                  Personalize o título e as informações exibidas antes da tabela.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pdf-titulo">Título</Label>
                  <Input
                    id="pdf-titulo"
                    value={cabecalho.titulo ?? ""}
                    placeholder={CABECALHO_PDF_PADRAO.titulo}
                    onChange={(e) => atualizarCabecalho({ titulo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pdf-subtitulo">Subtítulo (opcional)</Label>
                  <Input
                    id="pdf-subtitulo"
                    value={cabecalho.subtitulo ?? ""}
                    placeholder="Ex.: Simulação de reajuste — linha Baunilha"
                    onChange={(e) => atualizarCabecalho({ subtitulo: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pdf-data" className="font-normal">
                    Incluir data e hora de geração
                  </Label>
                  <Switch
                    id="pdf-data"
                    checked={cabecalho.incluirData !== false}
                    onCheckedChange={(v) => atualizarCabecalho({ incluirData: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pdf-perfis" className="font-normal">
                    Incluir nome do perfil
                  </Label>
                  <Switch
                    id="pdf-perfis"
                    checked={cabecalho.incluirPerfis !== false}
                    onCheckedChange={(v) => atualizarCabecalho({ incluirPerfis: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => atualizarCabecalho(CABECALHO_PDF_PADRAO)}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restaurar padrão
                </Button>
                <Button onClick={handlePDF}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Gerar PDF
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

      </CardHeader>
      <CardContent className="overflow-x-auto space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto ou linha..."
              className="h-9 w-[240px] pl-8"
            />
          </div>

          <Popover open={filtroLinhaAberto} onOpenChange={setFiltroLinhaAberto}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 font-normal">
                <Layers3 className="h-4 w-4 mr-2 text-primary" />
                {linhasFiltro.length === 0
                  ? "Todas as linhas"
                  : linhasFiltro.length === 1
                    ? linhasFiltro[0]
                    : `${linhasFiltro.length} linhas`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar linha..." className="h-9" />
                <CommandList className="max-h-[280px]">
                  <CommandEmpty>Nenhuma linha.</CommandEmpty>
                  <CommandGroup>
                    {linhasFiltro.length > 0 && (
                      <CommandItem
                        value="__limpar__"
                        onSelect={() => setLinhasFiltro([])}
                        className="text-muted-foreground"
                      >
                        Limpar seleção ({linhasFiltro.length})
                      </CommandItem>
                    )}
                    {linhasDisponiveis.map((l) => (
                      <CommandItem
                        key={l}
                        value={l}
                        onSelect={() =>
                          setLinhasFiltro((prev) =>
                            prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l],
                          )
                        }
                      >
                        <Check
                          className={`h-4 w-4 mr-2 ${
                            linhasFiltro.includes(l) ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {l}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 pl-1">
            <Switch id="agrupar-linha" checked={agrupar} onCheckedChange={setAgrupar} />
            <Label htmlFor="agrupar-linha" className="font-normal text-sm">
              Agrupar por linha
            </Label>
          </div>
        </div>

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
            {agrupar
              ? grupos.map(([nomeLinha, itens]) => [
                  <TableRow key={`grupo-${nomeLinha}`} className="bg-muted/60">
                    <TableCell
                      colSpan={2 + colunasVisiveis.length}
                      className="text-xs font-semibold uppercase tracking-wide"
                    >
                      {nomeLinha}
                      <span className="ml-2 font-normal text-muted-foreground normal-case">
                        {itens.length} produto{itens.length > 1 ? "s" : ""}
                      </span>
                    </TableCell>
                  </TableRow>,
                  ...itens.flatMap((l) => renderProduto(l)),
                ])
              : linhas.map((l) => renderProduto(l))}
          </TableBody>
        </Table>
      </CardContent>

    </Card>
  );
}
