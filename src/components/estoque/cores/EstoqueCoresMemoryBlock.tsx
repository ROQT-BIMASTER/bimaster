import { Badge } from '@/components/ui/badge';
import type { DetalheDesmontagemItem } from '@/hooks/estoque/useEstoqueCoresConsolidadoQuery';

interface Props {
  saldoProprio: number;
  saldoPotencial: number;
  detalhe: DetalheDesmontagemItem[] | null | undefined;
  /** Quando informado, mostra um cabeçalho com a filial. */
  empresa?: { abrev_par: string | null; empresa_par: number } | null;
  unidade?: string | null;
  compact?: boolean;
}

function fmtN(n: number | null | undefined) {
  if (n == null) return '—';
  const v = Number(n);
  if (!isFinite(v)) return '—';
  return Math.round(v).toLocaleString('pt-BR');
}

function fmtFator(n: number) {
  // mantém até 4 casas, sem zeros à direita
  const s = Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  return s;
}

export function EstoqueCoresMemoryBlock({
  saldoProprio,
  saldoPotencial,
  detalhe,
  empresa,
  unidade,
  compact,
}: Props) {
  const lista = (detalhe ?? []) as DetalheDesmontagemItem[];
  const somaContrib = lista.reduce((acc, d) => acc + Number(d.contribuicao ?? 0), 0);
  const total = Number(saldoProprio || 0) + Number(saldoPotencial || 0);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {empresa && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {empresa.abrev_par ?? empresa.empresa_par}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              Filial {empresa.empresa_par}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Total disponível: <span className="font-semibold text-foreground tabular-nums">{fmtN(total)}</span>
            {unidade ? ` ${unidade}` : ''}
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          Sem saldo nos pais para explodir nesta {empresa ? 'filial' : 'visão'}.
        </p>
      ) : (
        <div className="rounded border bg-background">
          <div className="grid grid-cols-12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50">
            <div className="col-span-6">Pai (caixa / box)</div>
            <div className="col-span-2 text-right">Saldo pai</div>
            <div className="col-span-2 text-right">× Fator</div>
            <div className="col-span-2 text-right">= Contribuição</div>
          </div>
          <div className="divide-y">
            {lista.map((d, i) => (
              <div key={i} className="grid grid-cols-12 px-2.5 py-1 text-xs items-center">
                <div className="col-span-6 truncate">
                  <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{d.cod_pai}</span>
                  {d.nome_pai ?? '—'}
                </div>
                <div className="col-span-2 text-right tabular-nums">{fmtN(d.saldo_pai)}</div>
                <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                  × {fmtFator(Number(d.fator))}
                </div>
                <div className="col-span-2 text-right tabular-nums font-medium text-primary">
                  {fmtN(d.contribuicao)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded border bg-muted/40 px-2.5 py-2 text-xs space-y-0.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Soma das contribuições</span>
          <span className="tabular-nums font-medium">{fmtN(somaContrib)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Potencial desm. (RPC)</span>
          <span className={
            'tabular-nums font-medium ' +
            (Math.round(somaContrib) === Math.round(Number(saldoPotencial || 0))
              ? ''
              : 'text-warning')
          }>
            {fmtN(saldoPotencial)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Próprio (folha)</span>
          <span className="tabular-nums font-medium">{fmtN(saldoProprio)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 mt-1">
          <span className="font-semibold">Total disponível</span>
          <span className="tabular-nums font-semibold text-primary">{fmtN(total)}</span>
        </div>
      </div>
    </div>
  );
}
