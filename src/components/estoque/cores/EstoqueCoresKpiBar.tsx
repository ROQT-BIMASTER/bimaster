import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { EstoqueCoresKpis } from '@/hooks/estoque/useEstoqueCoresKpis';
import { Package, Layers, AlertCircle, ShoppingCart, ShieldCheck } from 'lucide-react';

interface Props {
  kpis: EstoqueCoresKpis | undefined;
  loading: boolean;
  /** Quando true, o card de SKUs mostra "Produtos (consolidado)". */
  consolidado?: boolean;
}

function Item({ label, value, icon: Icon, sub, tone }: { label: string; value: string; icon: any; sub?: string; tone?: 'success' }) {
  return (
    <Card className={tone === 'success' ? 'p-3 border-success/40 bg-success/5' : 'p-3'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className={`text-base font-semibold tabular-nums leading-tight mt-0.5 ${tone === 'success' ? 'text-success' : ''}`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <Icon className={`h-4 w-4 ${tone === 'success' ? 'text-success' : 'text-muted-foreground'}`} />
      </div>
    </Card>
  );
}

export function EstoqueCoresKpiBar({ kpis, loading, consolidado }: Props) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-3"><Skeleton className="h-12 w-full" /></Card>
        ))}
      </div>
    );
  }
  const disponivel = Math.max(0, Math.round(kpis.total_unidades - kpis.total_bloqueado_produto));
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Item
        label={consolidado ? 'Produtos (consolidado)' : 'SKUs (cores)'}
        value={kpis.total_skus.toLocaleString('pt-BR')}
        icon={Package}
      />
      <Item
        label="Unidades totais"
        value={Math.round(kpis.total_unidades).toLocaleString('pt-BR')}
        icon={Layers}
        sub={`Potencial: ${Math.round(kpis.total_unidades_potencial).toLocaleString('pt-BR')}`}
      />
      <Item
        label="Disponível"
        value={disponivel.toLocaleString('pt-BR')}
        icon={ShieldCheck}
        sub={`Bloqueado: ${Math.round(kpis.total_bloqueado_produto).toLocaleString('pt-BR')}`}
        tone="success"
      />
      <Item label="Pedido pendente" value={Math.round(kpis.total_pedido_pendente).toLocaleString('pt-BR')} icon={ShoppingCart} />
      <Item label="Itens sem saldo" value={kpis.itens_sem_saldo.toLocaleString('pt-BR')} icon={AlertCircle} />
    </div>
  );
}
