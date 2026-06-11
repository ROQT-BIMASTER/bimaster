import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatters';
import type { EstoqueCoresKpis } from '@/hooks/estoque/useEstoqueCoresKpis';
import { Package, Layers, TrendingUp, AlertCircle, Wallet, ShoppingCart } from 'lucide-react';

interface Props {
  kpis: EstoqueCoresKpis | undefined;
  loading: boolean;
}

function Item({ label, value, icon: Icon, sub }: { label: string; value: string; icon: any; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-base font-semibold tabular-nums leading-tight mt-0.5">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </Card>
  );
}

export function EstoqueCoresKpiBar({ kpis, loading }: Props) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-3"><Skeleton className="h-12 w-full" /></Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Item label="SKUs (cores)" value={kpis.total_skus.toLocaleString('pt-BR')} icon={Package} />
      <Item
        label="Unidades totais"
        value={Math.round(kpis.total_unidades).toLocaleString('pt-BR')}
        icon={Layers}
        sub={`Potencial: ${Math.round(kpis.total_unidades_potencial).toLocaleString('pt-BR')}`}
      />
      <Item label="Custo total" value={formatCurrency(kpis.total_custo)} icon={Wallet} />
      <Item label="Valor venda" value={formatCurrency(kpis.total_valor_venda)} icon={TrendingUp} />
      <Item label="Pedido pendente" value={Math.round(kpis.total_pedido_pendente).toLocaleString('pt-BR')} icon={ShoppingCart} />
      <Item label="Itens sem saldo" value={kpis.itens_sem_saldo.toLocaleString('pt-BR')} icon={AlertCircle} />
    </div>
  );
}
