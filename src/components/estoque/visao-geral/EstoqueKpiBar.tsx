import { KpiCard } from '@/components/ui/kpi-card';
import { Boxes, DollarSign, PackageCheck, PackageX, Clock, Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { EstoqueKpis } from '@/hooks/estoque/useEstoqueKpis';

interface Props {
  kpis: EstoqueKpis | undefined;
  loading: boolean;
}

export function EstoqueKpiBar({ kpis, loading }: Props) {
  const cobertura = kpis && kpis.total_registros > 0
    ? (kpis.skus_ativos / kpis.total_registros) * 100
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard
        title="Valor em estoque"
        value={kpis ? formatCurrency(Number(kpis.valor_total) || 0) : '—'}
        subtitle={kpis ? `${kpis.empresas_no_recorte} empresa(s)` : undefined}
        icon={DollarSign}
        variant="info"
        loading={loading}
      />
      <KpiCard
        title="Unidades"
        value={kpis ? Number(kpis.unidades_total).toLocaleString('pt-BR') : '—'}
        subtitle={kpis ? `${kpis.linhas_no_recorte} linha(s)` : undefined}
        icon={Boxes}
        variant="default"
        loading={loading}
      />
      <KpiCard
        title="SKUs ativos"
        value={kpis ? kpis.skus_ativos.toLocaleString('pt-BR') : '—'}
        subtitle={kpis ? `${cobertura.toFixed(1)}% cobertura` : undefined}
        icon={PackageCheck}
        variant="success"
        loading={loading}
      />
      <KpiCard
        title="Sem saldo"
        value={kpis ? kpis.skus_sem_saldo.toLocaleString('pt-BR') : '—'}
        subtitle={kpis && kpis.skus_negativos > 0 ? `${kpis.skus_negativos} negativos` : undefined}
        icon={PackageX}
        variant={kpis && kpis.skus_negativos > 0 ? 'destructive' : 'warning'}
        loading={loading}
      />
      <KpiCard
        title="Pedidos pendentes"
        value={kpis ? Number(kpis.pedidos_pendentes_qtd).toLocaleString('pt-BR') : '—'}
        subtitle={kpis ? `${kpis.skus_com_pendente} SKUs` : undefined}
        icon={Truck}
        variant="accent"
        loading={loading}
      />
      <KpiCard
        title="Última sincronização"
        value={kpis?.ultima_sync ? new Date(kpis.ultima_sync).toLocaleString('pt-BR') : '—'}
        icon={Clock}
        variant="default"
        loading={loading}
      />
    </div>
  );
}
