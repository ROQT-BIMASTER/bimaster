// Painel de drill da Torre de Despesas: Departamento → Plano → Fornecedor → Títulos.
// Cada nível chama fn_despesas_drill server-side; títulos são paginados e cada
// linha permite abrir o MarcarRevisaoDialog (ação já funcional na Fase 1).
import { useEffect, useState } from "react";
import { ChevronRight, Flag } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { MarcarRevisaoDialog } from "@/components/financeiro/MarcarRevisaoDialog";
import { StatusTituloBadge } from "@/components/financeiro/StatusTituloBadge";
import { useTorreDrill } from "@/hooks/financeiro/useTorreDespesas";
import type {
  TorreDrillTituloItem,
  TorreNatureza,
  TorreSelecao,
} from "@/types/financeiro/torre-despesas";

interface Props {
  selecao: TorreSelecao | null;
  empresaIds: number[];
  natureza: TorreNatureza;
  centroCustoIds?: string[];
}

const TITULOS_POR_PAGINA = 25;

const fmtPct = (v: number | null) =>
  v === null
    ? "—"
    : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const fmtData = (v: string | null) => (v ? format(parseISO(v), "dd/MM/yyyy") : "—");

interface PlanoSel {
  id: string;
  nome: string;
}

interface FornecedorSel {
  codigo: string;
  nome: string;
}

function DrillSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function TorreDrill({ selecao, empresaIds, natureza }: Props) {
  const [plano, setPlano] = useState<PlanoSel | null>(null);
  const [fornecedor, setFornecedor] = useState<FornecedorSel | null>(null);
  const [pagina, setPagina] = useState(0);
  const [revisaoAberta, setRevisaoAberta] = useState(false);
  const [tituloRevisao, setTituloRevisao] = useState<TorreDrillTituloItem | null>(null);

  // Nova seleção no heatmap reseta o caminho do drill
  const selecaoKey = selecao
    ? `${selecao.departamentoId ?? (selecao.semDepto ? "sem" : "tot")}|${selecao.mes}`
    : "none";
  useEffect(() => {
    setPlano(null);
    setFornecedor(null);
    setPagina(0);
  }, [selecaoKey]);

  const nivel = fornecedor ? "titulos" : plano ? "fornecedor" : "plano";

  const baseParams = {
    mes: selecao?.mes ?? null,
    departamentoId: selecao?.departamentoId ?? null,
    semDepto: selecao?.semDepto ?? false,
    empresaIds,
    natureza,
  };

  const planoQuery = useTorreDrill({
    ...baseParams,
    nivel: "plano",
    planoContasId: null,
    fornecedorCodigo: null,
    enabled: nivel === "plano",
  });

  const fornecedorQuery = useTorreDrill({
    ...baseParams,
    nivel: "fornecedor",
    planoContasId: plano?.id ?? null,
    fornecedorCodigo: null,
    enabled: nivel === "fornecedor",
  });

  const titulosQuery = useTorreDrill({
    ...baseParams,
    nivel: "titulos",
    planoContasId: plano?.id ?? null,
    fornecedorCodigo: fornecedor?.codigo ?? null,
    limit: TITULOS_POR_PAGINA,
    offset: pagina * TITULOS_POR_PAGINA,
    enabled: nivel === "titulos",
  });

  if (!selecao) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-8 flex items-center justify-center h-full min-h-[18rem]">
        <p className="text-sm text-muted-foreground text-center">
          Selecione uma célula no mapa de calor para detalhar
          <br />
          plano de contas, fornecedores e títulos.
        </p>
      </div>
    );
  }

  const mesLabel = format(parseISO(selecao.mes), "MMM/yyyy", { locale: ptBR });
  const totalTitulos = titulosQuery.data?.total_qtd ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalTitulos / TITULOS_POR_PAGINA));

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-col">
      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap gap-1 text-xs mb-3" aria-label="Caminho do drill">
        <button
          type="button"
          onClick={() => {
            setPlano(null);
            setFornecedor(null);
            setPagina(0);
          }}
          className={cn(
            "font-medium",
            nivel === "plano" ? "text-foreground" : "text-primary hover:underline underline-offset-2",
          )}
        >
          {selecao.departamentoNome}
        </button>
        <span className="text-muted-foreground tabular-nums">· {mesLabel}</span>
        {plano && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              type="button"
              onClick={() => {
                setFornecedor(null);
                setPagina(0);
              }}
              className={cn(
                "font-medium truncate max-w-[12rem]",
                nivel === "fornecedor" ? "text-foreground" : "text-primary hover:underline underline-offset-2",
              )}
            >
              {plano.nome}
            </button>
          </>
        )}
        {fornecedor && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium text-foreground truncate max-w-[12rem]">{fornecedor.nome}</span>
          </>
        )}
      </nav>

      <div className="overflow-x-auto -mx-1 px-1">
        {/* Nível: plano de contas */}
        {nivel === "plano" &&
          (planoQuery.isLoading ? (
            <DrillSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Plano de contas</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">MoM</TableHead>
                  <TableHead className="text-xs text-right">YoY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(planoQuery.data?.itens ?? []).map((item) => {
                  const clicavel = item.plano_contas_id !== null;
                  return (
                    <TableRow
                      key={item.plano_contas_id ?? "sem-plano"}
                      className={cn(clicavel && "cursor-pointer")}
                      onClick={() => {
                        if (clicavel && item.plano_contas_id) {
                          setPlano({ id: item.plano_contas_id, nome: item.plano_nome });
                          setPagina(0);
                        }
                      }}
                      title={clicavel ? "Ver fornecedores deste plano" : "Sem plano de contas — drill indisponível"}
                    >
                      <TableCell className={cn("text-xs font-medium", !clicavel && "italic text-muted-foreground")}>
                        {item.plano_nome}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-medium">
                        {formatCurrency(item.valor_mes)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                        {item.qtd.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmtPct(item.mom_pct)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmtPct(item.yoy_pct)}</TableCell>
                    </TableRow>
                  );
                })}
                {(planoQuery.data?.itens ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                      Nenhum lançamento no mês selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ))}

        {/* Nível: fornecedor */}
        {nivel === "fornecedor" &&
          (fornecedorQuery.isLoading ? (
            <DrillSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Fornecedor</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">MoM</TableHead>
                  <TableHead className="text-xs text-right">1º lançamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(fornecedorQuery.data?.itens ?? []).map((item) => (
                  <TableRow
                    key={item.fornecedor_codigo}
                    className="cursor-pointer"
                    onClick={() => {
                      setFornecedor({ codigo: item.fornecedor_codigo, nome: item.fornecedor_nome });
                      setPagina(0);
                    }}
                    title="Ver títulos deste fornecedor"
                  >
                    <TableCell className="text-xs font-medium">{item.fornecedor_nome}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-medium">
                      {formatCurrency(item.valor_mes)}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                      {item.qtd.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmtPct(item.mom_pct)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                      {fmtData(item.primeiro_lancamento)}
                    </TableCell>
                  </TableRow>
                ))}
                {(fornecedorQuery.data?.itens ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                      Nenhum fornecedor neste plano no mês selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ))}

        {/* Nível: títulos (paginado) */}
        {nivel === "titulos" &&
          (titulosQuery.isLoading ? (
            <DrillSkeleton />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Documento</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs text-right">Emissão</TableHead>
                    <TableHead className="text-xs text-right">Vencimento</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(titulosQuery.data?.itens ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">
                        <span className="font-medium">{t.numero_documento || t.erp_id}</span>
                        <span className="text-muted-foreground tabular-nums"> · parc. {t.parcela}</span>
                        <span className="block text-[10px] text-muted-foreground capitalize">
                          {t.natureza_lancamento}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-medium">
                        {formatCurrency(t.valor_original)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                        {fmtData(t.data_emissao)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                        {fmtData(t.data_vencimento)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <StatusTituloBadge status={t.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-800"
                          onClick={() => {
                            setTituloRevisao(t);
                            setRevisaoAberta(true);
                          }}
                        >
                          <Flag className="h-3 w-3" />
                          Revisão
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(titulosQuery.data?.itens ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                        Nenhum título encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Paginação */}
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {totalTitulos.toLocaleString("pt-BR")} títulos · total{" "}
                  {formatCurrency(titulosQuery.data?.total_valor ?? 0)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={pagina === 0}
                    onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {pagina + 1} / {totalPaginas}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={pagina + 1 >= totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          ))}
      </div>

      {/* Marcar título para revisão — reaproveita o dialog existente com o
          subset de campos que o drill possui (demais props são opcionais). */}
      {tituloRevisao && (
        <MarcarRevisaoDialog
          open={revisaoAberta}
          onOpenChange={(open) => {
            setRevisaoAberta(open);
            if (!open) setTituloRevisao(null);
          }}
          contaId={tituloRevisao.id}
          planoContasId={plano?.id}
          departamentoId={selecao.departamentoId ?? undefined}
          categoriaNome={plano?.nome}
          valorAtual={tituloRevisao.valor_original}
          nomeItem={`${tituloRevisao.fornecedor_nome} — doc. ${tituloRevisao.numero_documento || tituloRevisao.erp_id}`}
          fornecedorNome={tituloRevisao.fornecedor_nome}
          numeroDocumento={tituloRevisao.numero_documento}
          dataVencimento={tituloRevisao.data_vencimento}
        />
      )}
    </div>
  );
}
