import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ContasPagarSyncPanel } from '@/components/financeiro/ContasPagarSyncPanel';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ContasPagarSyncPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header com navegação */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard/financeiro">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Contas a Pagar - Sincronização</h1>
            <p className="text-muted-foreground">
              Monitore a integração com o ERP via N8N
            </p>
          </div>
        </div>

        {/* Painel de Sincronização */}
        <ContasPagarSyncPanel />
      </div>
    </DashboardLayout>
  );
}
