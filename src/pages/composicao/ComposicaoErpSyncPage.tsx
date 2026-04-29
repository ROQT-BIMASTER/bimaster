import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComposicaoErpSyncPanel } from '@/components/composicao/ComposicaoErpSyncPanel';
import { SyncMonitorPanel } from '@/components/financeiro/SyncMonitorPanel';
import { SyncMetricsDashboard } from '@/components/financeiro/SyncMetricsDashboard';
import { Server, Activity, BarChart3 } from 'lucide-react';

export default function ComposicaoErpSyncPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sincronização com ERP — Composição</h1>
          <p className="text-muted-foreground">
            Composição de Produto — Engine direta SQL Server (ComposicaoProduto)
          </p>
        </div>

        <Tabs defaultValue="engine" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-3">
            <TabsTrigger value="engine" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              ERP Engine
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Métricas
            </TabsTrigger>
            <TabsTrigger value="monitor" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Monitor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="engine" className="mt-6">
            <ComposicaoErpSyncPanel />
          </TabsContent>

          <TabsContent value="metrics" className="mt-6">
            <SyncMetricsDashboard />
          </TabsContent>

          <TabsContent value="monitor" className="mt-6">
            <SyncMonitorPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
