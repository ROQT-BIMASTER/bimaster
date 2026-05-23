import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Users } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CenarioProduto } from "@/hooks/useGrupoCenarios";

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

export interface CustoArrEntry {
  produto: CenarioProduto;
  custoTotal: number;
  custoUnit: number;
  itens: CustoItem[];
}

interface CelulaCenario {
  custo: number;
  fornecedor: string | null;
  nf: string | null;
  tipo_insumo: string | null;
  presente: boolean;
}

interface LinhaInsumo {
  chave: string;
  nome: string;
  tipo_insumo: string | null;
  porCenario: Map<string, CelulaCenario>;
  min: number;
  max: number;
  delta: number;
  deltaPct: number;
  fornecedoresDistintos: string[];
  cenarioMin: string | null;
  cenarioMax: string | null;
  presencaCount: number;
}

const TIPO_LABEL: Record<string, string> = {
  bulk: "Bulk",
  embalagem_primaria: "Emb. primária",
  embalagem_secundaria: "Emb. secundária",
  rotulo: "Rótulo",
  acessorio: "Acessório",
  importado_kit: "Importado",
  outro: "Outro",
};

const normalizaChave = (codigo: string | null | undefined, nome: string) => {
  const c = (codigo || "").trim();
  if (c) return `c:${c.toLowerCase()}`;
  return `n:${(nome || "").trim().toLowerCase()}`;
};

export function AnaliseInsumosComparativa({ custosArr }: { custosArr: CustoArrEntry[] }) {
  const navigate = useNavigate();

  const linhas = useMemo<LinhaInsumo[]>(() => {
    const map = new Map<string, LinhaInsumo>();

    custosArr.forEach(({ produto, itens }) => {
      const porChaveDesteCenario = new Map<string, { custo: number; nome: string; fornecedor: string | null; nf: string | null; tipo_insumo: string | null }>();
      itens.forEach((it) => {
        const chave = normalizaChave(it.codigo, it.nome);
        const totalItem = (it.custo_nf || 0) + (it.custo_servico || 0) + (it.custo_condicao || 0);
        const cur = porChaveDesteCenario.get(chave);
        if (cur) {
          cur.custo += totalItem;
        } else {
          porChaveDesteCenario.set(chave, {
            custo: totalItem,
            nome: it.nome,
            fornecedor: it.fornecedor,
            nf: it.nf_referencia,
            tipo_insumo: it.tipo_insumo,
          });
        }
      });

      porChaveDesteCenario.forEach((v, chave) => {
        let linha = map.get(chave);
        if (!linha) {
          linha = {
            chave,
            nome: v.nome,
            tipo_insumo: v.tipo_insumo,
            porCenario: new Map(),
            min: 0,
            max: 0,
            delta: 0,
            deltaPct: 0,
            fornecedoresDistintos: [],
            cenarioMin: null,
            cenarioMax: null,
            presencaCount: 0,
          };
          map.set(chave, linha);
        }
        if (!linha.tipo_insumo && v.tipo_insumo) linha.tipo_insumo = v.tipo_insumo;
        linha.porCenario.set(produto.id, {
          custo: v.custo,
          fornecedor: v.fornecedor,
          nf: v.nf,
          tipo_insumo: v.tipo_insumo,
          presente: true,
        });
      });
    });

    const linhasArr: LinhaInsumo[] = [];
    map.forEach((linha) => {
      let min = Infinity;
      let max = -Infinity;
      let cenarioMin: string | null = null;
      let cenarioMax: string | null = null;
      let presencaCount = 0;
      const fornecedoresSet = new Set<string>();

      custosArr.forEach(({ produto }) => {
        const cel = linha.porCenario.get(produto.id);
        if (cel) {
          presencaCount++;
          if (cel.custo < min) { min = cel.custo; cenarioMin = produto.id; }
          if (cel.custo > max) { max = cel.custo; cenarioMax = produto.id; }
          if (cel.fornecedor) fornecedoresSet.add(cel.fornecedor.trim());
        } else {
          linha.porCenario.set(produto.id, { custo: 0, fornecedor: null, nf: null, tipo_insumo: null, presente: false });
        }
      });

      if (!Number.isFinite(min)) min = 0;
      if (!Number.isFinite(max)) max = 0;
      linha.min = min;
      linha.max = max;
      linha.delta = max - min;
      linha.deltaPct = min > 0 ? (linha.delta / min) * 100 : 0;
      linha.fornecedoresDistintos = Array.from(fornecedoresSet);
      linha.cenarioMin = cenarioMin;
      linha.cenarioMax = cenarioMax;
      linha.presencaCount = presencaCount;
      linhasArr.push(linha);
    });

    linhasArr.sort((a, b) => b.delta - a.delta);
    return linhasArr;
  }, [custosArr]);

  // MPs presentes em apenas 1 cenário (exclusivas) — agrupadas por cenário
  const exclusivasPorCenario = useMemo(() => {
    const map = new Map<string, LinhaInsumo[]>();
    linhas.forEach((l) => {
      if (l.presencaCount === 1) {
        // achar qual cenário tem
        for (const { produto } of custosArr) {
          const cel = l.porCenario.get(produto.id);
          if (cel?.presente) {
            const arr = map.get(produto.id) ?? [];
            arr.push(l);
            map.set(produto.id, arr);
            break;
          }
        }
      }
    });
    return map;
  }, [linhas, custosArr]);

  const somaDeltas = useMemo(() => linhas.reduce((s, l) => s + l.delta, 0), [linhas]);
  const topOfensores = useMemo(() => linhas.filter((l) => l.delta > 0).slice(0, 3), [linhas]);
  const fornecedoresDivergentes = useMemo(
    () => linhas.filter((l) => l.fornecedoresDistintos.length > 1),
    [linhas],
  );

  const labelCenario = (produto: CenarioProduto) => produto.cenario_label || produto.codigo || produto.nome;

  if (custosArr.length < 2) return null;

  return (
    <Card className="p-4 space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">Análise comparativa de insumos</h2>
        <span className="text-xs text-muted-foreground">
          · {linhas.length} insumo(s) cruzado(s) · diferença total acumulada {formatCurrency(somaDeltas)}
        </span>
      </div>

      {/* Top ofensores */}
      {topOfensores.length > 0 && (
        <div className="grid gap-2 md:grid-cols-3">
          {topOfensores.map((l) => {
            const cMax = custosArr.find((c) => c.produto.id === l.cenarioMax)?.produto;
            const cMin = custosArr.find((c) => c.produto.id === l.cenarioMin)?.produto;
            const celMax = l.cenarioMax ? l.porCenario.get(l.cenarioMax) : null;
            const celMin = l.cenarioMin ? l.porCenario.get(l.cenarioMin) : null;
            const impacto = somaDeltas > 0 ? (l.delta / somaDeltas) * 100 : 0;
            return (
              <Card key={l.chave} className="p-3 border-destructive/30 bg-destructive/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm leading-tight flex-1" title={l.nome}>
                    {l.nome}
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    +{formatCurrency(l.delta)}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {impacto.toFixed(0)}% da diferença total · {l.deltaPct > 0 ? `+${l.deltaPct.toFixed(0)}%` : "—"}
                </div>
                <div className="mt-2 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3 w-3 text-emerald-700 shrink-0" />
                    <span className="text-muted-foreground shrink-0">{cMin ? labelCenario(cMin) : "—"}:</span>
                    <span className="font-medium tabular-nums">{formatCurrency(celMin?.custo || 0)}</span>
                    {celMin?.fornecedor && (
                      <span className="text-muted-foreground truncate" title={celMin.fornecedor}>· {celMin.fornecedor}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-destructive shrink-0" />
                    <span className="text-muted-foreground shrink-0">{cMax ? labelCenario(cMax) : "—"}:</span>
                    <span className="font-medium tabular-nums">{formatCurrency(celMax?.custo || 0)}</span>
                    {celMax?.fornecedor && (
                      <span className="text-muted-foreground truncate" title={celMax.fornecedor}>· {celMax.fornecedor}</span>
                    )}
                  </div>
                </div>
                {l.fornecedoresDistintos.length > 1 && (
                  <Badge variant="outline" className="mt-2 text-[10px] border-amber-500/50 text-amber-700">
                    <AlertTriangle className="h-3 w-3 mr-1" /> fornecedor divergente
                  </Badge>
                )}
                {cMax && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 h-7 text-xs"
                    onClick={() => navigate(`/dashboard/fabrica/produtos/${cMax.id}/custos`)}
                  >
                    Abrir ficha do mais caro <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabela pivot */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-2 py-2 font-medium sticky left-0 bg-muted/40 z-10">Insumo</th>
              {custosArr.map(({ produto }) => (
                <th key={produto.id} className="text-right px-2 py-2 font-medium whitespace-nowrap">
                  {labelCenario(produto)}
                </th>
              ))}
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap">Δ máx</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap">% impacto</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={custosArr.length + 3} className="px-2 py-4 text-center text-muted-foreground">
                  Nenhum insumo lançado nos cenários ainda.
                </td>
              </tr>
            )}
            {linhas.map((l) => {
              const impacto = somaDeltas > 0 ? (l.delta / somaDeltas) * 100 : 0;
              return (
                <tr key={l.chave} className="border-t hover:bg-accent/20">
                  <td className="px-2 py-1.5 sticky left-0 bg-background z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate max-w-[200px]" title={l.nome}>{l.nome}</span>
                      {l.fornecedoresDistintos.length > 1 && (
                        <span title={`Fornecedores: ${l.fornecedoresDistintos.join(" / ")}`}>
                          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                        </span>
                      )}
                    </div>
                    {l.fornecedoresDistintos.length > 0 && (
                      <div className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                        {l.fornecedoresDistintos.join(" / ")}
                      </div>
                    )}
                  </td>
                  {custosArr.map(({ produto }) => {
                    const cel = l.porCenario.get(produto.id);
                    const isMax = l.delta > 0 && cel?.custo === l.max;
                    const isMin = l.delta > 0 && cel?.presente && cel.custo === l.min;
                    return (
                      <td
                        key={produto.id}
                        className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${
                          isMax ? "bg-destructive/10 text-destructive font-semibold" :
                          isMin ? "bg-emerald-500/10 text-emerald-700 font-medium" : ""
                        }`}
                        title={cel?.fornecedor ? `${cel.fornecedor}${cel.nf ? ` · NF ${cel.nf}` : ""}` : (cel?.presente ? "" : "Não consta neste cenário")}
                      >
                        {cel?.presente ? formatCurrency(cel.custo) : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap font-medium">
                    {l.delta > 0 ? `+${formatCurrency(l.delta)}` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                    {l.delta > 0 ? `${impacto.toFixed(0)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fornecedores divergentes */}
      {fornecedoresDivergentes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600" />
            <h3 className="font-medium text-sm">Insumos com fornecedores diferentes entre cenários</h3>
            <span className="text-xs text-muted-foreground">· {fornecedoresDivergentes.length} caso(s)</span>
          </div>
          <div className="grid gap-1.5 md:grid-cols-2">
            {fornecedoresDivergentes.map((l) => (
              <div key={l.chave} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                <div className="font-medium truncate" title={l.nome}>{l.nome}</div>
                <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                  {custosArr.map(({ produto }) => {
                    const cel = l.porCenario.get(produto.id);
                    if (!cel?.presente) return null;
                    return (
                      <div key={produto.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          <span className="text-foreground">{labelCenario(produto)}:</span>{" "}
                          {cel.fornecedor || <span className="italic">sem fornecedor</span>}
                        </span>
                        <span className="tabular-nums shrink-0">{formatCurrency(cel.custo)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
