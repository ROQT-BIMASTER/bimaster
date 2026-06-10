import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Boxes, Package, PackageOpen, Copy, Info, AlertTriangle, AlertCircle } from 'lucide-react';

import { toast } from 'sonner';
import {
  useEstoqueUnificadoSkus,
  type EstoqueUnificadoRow,
  type EstoqueUnificadoSkuRow,
} from '@/hooks/estoque/useEstoqueUnificado';
import { classificarGaps, temAlgumGap, type GapStatus } from '@/lib/estoque/hierarquiaGaps';

interface Props {
  row: EstoqueUnificadoRow;
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : Math.round(Number(n)).toLocaleString('pt-BR');

const fmtFator = (n: number | null | undefined) =>
  n == null || n === 0
    ? '—'
    : Number(n) % 1 === 0
      ? Number(n).toLocaleString('pt-BR')
      : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 4 });

function nivelInfo(nivel: number | null) {
  if (nivel === 1) return { sigla: 'CX', label: 'Caixa', Icon: Boxes };
  if (nivel === 2) return { sigla: 'BX', label: 'Display', Icon: Package };
  if (nivel === 3) return { sigla: 'UN', label: 'Unidade', Icon: PackageOpen };
  return { sigla: '—', label: 'Sem classificação', Icon: Package };
}

function SkuLine({
  sku,
  depth,
  totalUn,
  gapStatus,
}: {
  sku: EstoqueUnificadoSkuRow;
  depth: number;
  totalUn: number;
  gapStatus?: GapStatus;
}) {
  const { sigla, label, Icon } = nivelInfo(sku.nivel);
  const pct = totalUn > 0 ? (Number(sku.contribuicao_un) / totalUn) * 100 : 0;

  return (
    <div
      className="grid gap-2 items-center py-1.5 px-2 rounded hover:bg-muted/40 text-xs"
      style={{ paddingLeft: `${depth * 20 + 8}px`, gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
    >
      <div className="col-span-4 flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="text-[10px] gap-1 shrink-0" title={label}>
          <Icon className="h-2.5 w-2.5" />
          {sigla}
        </Badge>
        <span className="font-mono text-[10px] text-muted-foreground shrink-0">{sku.cod_produto}</span>
        {sku.nome_prod ? (
          <span className="truncate" title={sku.nome_prod}>{sku.nome_prod}</span>
        ) : (
          <span
            className="truncate italic text-muted-foreground"
            title="Sem descrição cadastrada em ERP, Fábrica ou Catálogo RR"
          >
            Produto {sku.cod_produto}
          </span>
        )}
        {gapStatus === 'faltante' && (
          <Badge
            variant="outline"
            className="text-[9px] gap-1 shrink-0 border-warning/40 bg-warning/10 text-warning"
            title="Nível superior tem saldo, mas este SKU está zerado"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            Sem físico
          </Badge>
        )}
        {gapStatus === 'sem_filhos_mapeados' && (
          <Badge
            variant="outline"
            className="text-[9px] gap-1 shrink-0 border-warning/40 bg-warning/10 text-warning"
            title="Este nível tem saldo, mas não há composição (BOM) cadastrada para os filhos"
          >
            <AlertCircle className="h-2.5 w-2.5" />
            BOM incompleta
          </Badge>
        )}
      </div>
      <div className="col-span-1 text-right tabular-nums">{fmt(sku.saldo)}</div>
      <div className="col-span-1 text-right tabular-nums text-muted-foreground" title="Bloqueado">
        {fmt(sku.bloqueado)}
      </div>
      <div className="col-span-1 text-right tabular-nums text-success font-semibold" title="Disponível = Saldo − Bloqueado">
        {fmt(sku.disponivel)}
      </div>
      <div className="col-span-1 text-right tabular-nums text-muted-foreground" title="Pedido pendente">
        {fmt(sku.pendente)}
      </div>
      <div className="col-span-2 text-right tabular-nums text-muted-foreground">
        × {fmtFator(sku.fator_un_acumulado)}
      </div>
      <div className="col-span-2 text-right tabular-nums font-semibold">
        = {fmt(sku.contribuicao_un)} UN
      </div>
      <div className="col-span-1 text-right tabular-nums text-[10px] text-muted-foreground">
        {pct.toFixed(1)}%
      </div>
    </div>
  );
}

interface TreeNode {
  sku: EstoqueUnificadoSkuRow;
  children: TreeNode[];
}

function buildTree(rows: EstoqueUnificadoSkuRow[]): { tree: TreeNode[]; orphans: TreeNode[] } {
  // Chave composta: o mesmo cod_produto pode aparecer sob pais diferentes
  // (ex.: SKU compartilhado por BX e CX em hierarquias paralelas). Usar só
  // cod_produto colidia e duplicava ramos. produto_raiz+pai+cod+nivel é único.
  const keyOf = (r: { produto_raiz: number; pai_cod: number | null; cod_produto: number; nivel: number | null }) =>
    `${Number(r.produto_raiz)}|${r.pai_cod == null ? 'root' : Number(r.pai_cod)}|${Number(r.cod_produto)}|${r.nivel ?? 0}`;

  const byKey = new Map<string, TreeNode>();
  // Para anexar filhos: index por cod_produto -> chaves candidatas a pai
  const codToKeys = new Map<number, string[]>();
  rows.forEach((r) => {
    const k = keyOf(r);
    if (byKey.has(k)) return; // dedup defensivo
    const node: TreeNode = { sku: r, children: [] };
    byKey.set(k, node);
    const arr = codToKeys.get(Number(r.cod_produto)) ?? [];
    arr.push(k);
    codToKeys.set(Number(r.cod_produto), arr);
  });

  const roots: TreeNode[] = [];
  const orphans: TreeNode[] = [];

  for (const node of byKey.values()) {
    const { sku } = node;
    if (sku.pai_cod != null) {
      // Tenta achar o pai exato (mesmo produto_raiz). Se não houver, anexa ao primeiro.
      const candidatos = codToKeys.get(Number(sku.pai_cod)) ?? [];
      const paiKey =
        candidatos.find((ck) => byKey.get(ck)?.sku.produto_raiz === sku.produto_raiz) ?? candidatos[0];
      if (paiKey && byKey.has(paiKey)) {
        byKey.get(paiKey)!.children.push(node);
        continue;
      }
    }
    if (sku.cod_produto === sku.produto_raiz || sku.nivel === 1) {
      roots.push(node);
    } else {
      orphans.push(node);
    }
  }

  const sortNode = (n: TreeNode) => {
    n.children.sort((a, b) => {
      const na = a.sku.nivel ?? 99;
      const nb = b.sku.nivel ?? 99;
      if (na !== nb) return na - nb;
      return a.sku.cod_produto - b.sku.cod_produto;
    });
    n.children.forEach(sortNode);
  };
  roots.forEach(sortNode);
  orphans.forEach(sortNode);

  return { tree: roots, orphans };
}

function renderNode(
  node: TreeNode,
  depth: number,
  totalUn: number,
  statusByCodigo: Map<number, GapStatus>,
  ramosComGap: Set<number>,
  filtrarSoLacunas: boolean,
): JSX.Element[] {
  if (filtrarSoLacunas && !ramosComGap.has(node.sku.cod_produto)) return [];
  const out: JSX.Element[] = [
    <SkuLine
      key={`sku-${node.sku.cod_produto}`}
      sku={node.sku}
      depth={depth}
      totalUn={totalUn}
      gapStatus={statusByCodigo.get(node.sku.cod_produto)}
    />,
  ];
  for (const child of node.children) {
    out.push(...renderNode(child, depth + 1, totalUn, statusByCodigo, ramosComGap, filtrarSoLacunas));
  }
  return out;
}

export function EstoqueUnificadoSkuBreakdown({ row }: Props) {
  const { data, isLoading } = useEstoqueUnificadoSkus(row.empresa, row.produto_raiz);
  const [filtrarSoLacunas, setFiltrarSoLacunas] = useState(false);

  const { tree, orphans, totalUn, somaCX, somaBX, somaUN, somaBloq, somaDisp, somaPend, gaps } = useMemo(() => {
    const rows = data ?? [];
    const { tree, orphans } = buildTree(rows);
    const totalUn = rows.reduce((acc, r) => acc + Number(r.contribuicao_un ?? 0), 0);
    const somaCX = rows.filter((r) => r.nivel === 1).reduce((a, r) => a + Number(r.saldo ?? 0), 0);
    const somaBX = rows.filter((r) => r.nivel === 2).reduce((a, r) => a + Number(r.saldo ?? 0), 0);
    const somaUN = rows.filter((r) => r.nivel === 3).reduce((a, r) => a + Number(r.saldo ?? 0), 0);
    const somaBloq = rows.reduce((a, r) => a + Number(r.contribuicao_bloqueado_un ?? 0), 0);
    const somaDisp = rows.reduce((a, r) => a + Number(r.contribuicao_disponivel_un ?? 0), 0);
    const somaPend = rows.reduce((a, r) => a + Number(r.contribuicao_pendente_un ?? 0), 0);
    const gaps = classificarGaps(tree);
    return { tree, orphans, totalUn, somaCX, somaBX, somaUN, somaBloq, somaDisp, somaPend, gaps };
  }, [data]);

  const haGaps = temAlgumGap(gaps);

  const divergeTotal = Math.abs(totalUn - Number(row.saldo_total_em_unidades ?? 0)) > 0.5;

  const handleCopiarCSV = async () => {
    const rows = data ?? [];
    const header = ['Nivel', 'Codigo', 'Nome', 'Pai', 'Saldo', 'Bloqueado', 'Disponivel', 'Pendente', 'Fator UN', 'Contribuicao UN', 'Contribuicao Disponivel UN', 'Status'];
    const lines = rows.map((r) => [
      nivelInfo(r.nivel).sigla,
      r.cod_produto,
      (r.nome_prod ?? '').replace(/[\r\n;]/g, ' '),
      r.pai_cod ?? '',
      r.saldo,
      r.bloqueado,
      r.disponivel,
      r.pendente,
      r.fator_un_acumulado,
      r.contribuicao_un,
      r.contribuicao_disponivel_un,
      gaps.statusByCodigo.get(r.cod_produto) ?? 'ok',
    ].join(';'));
    const csv = [header.join(';'), ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      toast.success('Memória de cálculo copiada (CSV)');
    } catch {
      toast.error('Não foi possível copiar para a área de transferência');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Sem SKUs no estoque para este produto-raiz.
      </div>
    );
  }

  return (
    <div className="bg-muted/20 border-t border-border p-4 space-y-3">
      {/* Explicação da fórmula */}
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-card/50 border border-border rounded p-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            <strong className="text-foreground">Como o Total em UN é calculado:</strong>{' '}
            <code className="font-mono text-[10px] bg-muted px-1 rounded">
              Σ (saldo do SKU × fator de conversão até a unidade base)
            </code>
            . O fator é o produto das quantidades em <strong>CX → BX → UN</strong> definido na composição (BOM)
            de cada caixa. SKUs intermediários sem composição cadastrada entram com fator <strong>1</strong>.
          </p>
          <p>
            Exemplo: 1 CX contém 48 BX, cada BX contém 12 UN → 1 CX = 576 UN. Logo, o estoque do SKU de unidade
            é multiplicado por 576 para chegar à contribuição em UN.
          </p>
        </div>
      </div>

      {/* Banner de lacunas — só renderiza quando há algum gap */}
      {haGaps && (
        <div className="flex items-start gap-2 text-[11px] bg-warning/10 border border-warning/40 text-warning rounded p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">Hierarquia com lacunas físicas</p>
            <p className="text-foreground/80">
              {gaps.faltantesCX > 0 && <>{gaps.faltantesCX} caixa(s) sem saldo · </>}
              {gaps.faltantesBX > 0 && <>{gaps.faltantesBX} display(s) sem saldo (sob CX com estoque) · </>}
              {gaps.faltantesUN > 0 && <>{gaps.faltantesUN} cor(es) sem unidades físicas (sob BX com estoque) · </>}
              {gaps.semFilhosMapeados > 0 && <>{gaps.semFilhosMapeados} nível(is) sem composição BOM mapeada</>}
            </p>
          </div>
          <label className="flex items-center gap-2 text-[10px] text-foreground/80 shrink-0 cursor-pointer">
            <Switch checked={filtrarSoLacunas} onCheckedChange={setFiltrarSoLacunas} />
            Mostrar só lacunas
          </label>
        </div>
      )}

      {/* Cabeçalho da grade */}
      <div
        className="grid gap-2 items-center px-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border pb-1"
        style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
      >
        <div className="col-span-4">SKU (nível · código · descrição)</div>
        <div className="col-span-1 text-right">Saldo</div>
        <div className="col-span-1 text-right">Bloq</div>
        <div className="col-span-1 text-right text-success">Disp</div>
        <div className="col-span-1 text-right">Pend</div>
        <div className="col-span-2 text-right">× Fator UN</div>
        <div className="col-span-2 text-right">= Contribuição UN</div>
        <div className="col-span-1 text-right">% total</div>
      </div>

      {/* Árvore */}
      <div className="space-y-0.5">
        {tree.flatMap((node) => renderNode(node, 0, totalUn, gaps.statusByCodigo, gaps.ramosComGap, filtrarSoLacunas))}
      </div>

      {/* Avulsos */}
      {orphans.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2 px-2">
            Sem composição BOM mapeada
          </p>
          {orphans.flatMap((node) => renderNode(node, 0, totalUn, gaps.statusByCodigo, gaps.ramosComGap, filtrarSoLacunas))}
        </div>
      )}

      {/* Cores sem físico — detalhamento das UN faltantes */}
      {gaps.coresFaltantes.length > 0 && (
        <details className="bg-warning/5 border border-warning/30 rounded p-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-warning flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Cores sem físico ({gaps.coresFaltantes.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[11px]">
            {gaps.coresFaltantes.map((c) => (
              <li key={c.codigo} className="flex items-center gap-2 px-1">
                <span className="font-mono text-[10px] text-muted-foreground">{c.codigo}</span>
                <span className="flex-1 truncate">{c.nome}</span>
                <span className="text-muted-foreground text-[10px]">em {c.paiBX}</span>
              </li>
            ))}
          </ul>
        </details>
      )}




      {/* Totalizador batendo com a linha-pai */}
      <div className="mt-3 pt-3 border-t border-border space-y-2">
        {/* Linha 1: somas físicas por nível */}
        <div className="grid grid-cols-12 gap-2 text-xs">
          <div className="col-span-5 font-semibold flex items-center gap-2">
            Totais da composição
            {divergeTotal && (
              <Badge variant="outline" className="text-[9px] gap-1 border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-2.5 w-2.5" />
                Verificar
              </Badge>
            )}
          </div>
          <div className="col-span-1 text-right tabular-nums text-muted-foreground">
            <span className="text-[9px] uppercase block">CX</span>
            {fmt(somaCX)}
          </div>
          <div className="col-span-1 text-right tabular-nums text-muted-foreground">
            <span className="text-[9px] uppercase block">BX</span>
            {fmt(somaBX)}
          </div>
          <div className="col-span-1 text-right tabular-nums text-muted-foreground">
            <span className="text-[9px] uppercase block">UN</span>
            {fmt(somaUN)}
          </div>
          <div className="col-span-4 text-right tabular-nums font-bold">
            <span className="text-[9px] uppercase block text-muted-foreground">Σ Total UN</span>
            {fmt(totalUn)}
          </div>
        </div>

        {/* Linha 2: bloqueado / disponível / pendente em UN equivalente */}
        <div className="grid grid-cols-12 gap-2 text-xs items-end">
          <div className="col-span-5 text-[10px] text-muted-foreground">
            Convertido em UN equivalente (saldo bruto vs reservas):
          </div>
          <div className="col-span-2 text-right tabular-nums text-muted-foreground">
            <span className="text-[9px] uppercase block">Bloqueado UN</span>
            {fmt(somaBloq)}
          </div>
          <div className="col-span-2 text-right tabular-nums text-success font-bold">
            <span className="text-[9px] uppercase block">Disponível UN</span>
            {fmt(somaDisp)}
          </div>
          <div className="col-span-2 text-right tabular-nums text-muted-foreground">
            <span className="text-[9px] uppercase block">Pendente UN</span>
            {fmt(somaPend)}
          </div>
          <div className="col-span-1" />
        </div>

        <div className="text-[10px] text-muted-foreground px-1">
          Linha-pai reporta: CX {fmt(row.saldo_em_caixas)} · BX {fmt(row.saldo_em_displays)} · UN{' '}
          {fmt(row.saldo_em_unidades)} · Total UN <strong>{fmt(row.saldo_total_em_unidades)}</strong> ·{' '}
          <span className="text-success">Disp. <strong>{fmt(row.disponivel_total_em_unidades)}</strong></span>{' '}
          · Bloq. <strong>{fmt(row.bloqueado_total_em_unidades)}</strong> · Pend.{' '}
          <strong>{fmt(row.pendente_total_em_unidades)}</strong>
          {divergeTotal && (
            <span className="text-yellow-700 dark:text-yellow-400">
              {' '}
              — diferença de {fmt(Math.abs(totalUn - Number(row.saldo_total_em_unidades ?? 0)))} UN em relação ao cache.
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopiarCSV}>
          <Copy className="h-3 w-3 mr-1.5" />
          Copiar memória de cálculo
        </Button>
      </div>
    </div>
  );
}
