import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronRight, ShieldCheck } from 'lucide-react';
import { useDriftErp } from '@/hooks/estoque/useEstoqueMovimentos';
import { Link } from 'react-router-dom';

interface Props {
  empresaIds: number[];
}

const fmt = (n: number | null | undefined) =>
  Math.round(Number(n ?? 0)).toLocaleString('pt-BR');

export function DriftErpKpi({ empresaIds }: Props) {
  const { data, isLoading } = useDriftErp(empresaIds);

  const total = data?.length ?? 0;
  const driftAbs = (data ?? []).reduce((s, r) => s + Math.abs(Number(r.drift || 0)), 0);
  const piorPct = (data ?? [])[0]?.drift_pct ?? 0;
  const ok = total === 0;

  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`rounded-md p-2 ${ok ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
        {ok
          ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
          : <AlertTriangle className="h-4 w-4 text-amber-600" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Drift vs ERP</p>
          {!ok && (
            <Badge variant="outline" className="text-[10px]">
              pior: {Number(piorPct).toFixed(1)}%
            </Badge>
          )}
        </div>
        <p className="text-lg font-bold leading-tight">
          {isLoading ? '—' : ok ? 'Sincronizado' : `${total} SKUs · ${fmt(driftAbs)} un`}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {ok ? 'saldo interno = ERP' : 'diferença entre estoque lógico interno e ERP'}
        </p>
      </div>
      <Button asChild variant="ghost" size="sm" className="h-8">
        <Link to="/dashboard/estoque/auditoria-drift">
          Auditar <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </Button>
    </Card>
  );
}
