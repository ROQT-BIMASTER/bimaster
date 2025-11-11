import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { WhatsAppMonitoringPanel } from "@/components/whatsapp/WhatsAppMonitoringPanel";
import { WhatsAppMessagesPanel } from "@/components/whatsapp/WhatsAppMessagesPanel";
import { WhatsAppFilters } from "@/components/whatsapp/WhatsAppFilters";
import { WhatsAppCharts } from "@/components/whatsapp/WhatsAppCharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRange } from "react-day-picker";

export default function WhatsAppMonitoring() {
  const [filters, setFilters] = useState<{
    status?: string;
    userId?: string;
    dateRange?: DateRange;
  }>({});

  const dateRangeForPanel = filters.dateRange?.from ? {
    start: filters.dateRange.from,
    end: filters.dateRange.to || filters.dateRange.from
  } : undefined;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoramento WhatsApp</h1>
          <p className="text-muted-foreground">
            Acompanhe em tempo real todas as conversas e mensagens do WhatsApp
          </p>
        </div>

        <WhatsAppFilters onFilterChange={setFilters} />

        <WhatsAppMonitoringPanel
          userId={filters.userId}
          dateRange={dateRangeForPanel}
        />

        <WhatsAppMessagesPanel
          filters={{
            status: filters.status,
            userId: filters.userId,
            dateRange: dateRangeForPanel,
          }}
        />

        <WhatsAppCharts
          userId={filters.userId}
          dateRange={dateRangeForPanel}
        />

        <Card>
          <CardHeader>
            <CardTitle>Sobre o Painel</CardTitle>
            <CardDescription>
              Informações sobre as métricas exibidas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-medium mb-1">Taxa de Resposta</h4>
              <p className="text-sm text-muted-foreground">
                Percentual de conversas que receberam pelo menos uma resposta do bot
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Tempo Médio de Resposta</h4>
              <p className="text-sm text-muted-foreground">
                Tempo médio entre uma mensagem do usuário e a resposta do bot
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Status das Conversas</h4>
              <p className="text-sm text-muted-foreground">
                • <strong>Ativa:</strong> Conversa em andamento<br />
                • <strong>Completa:</strong> Lançamento criado com sucesso<br />
                • <strong>Cancelada:</strong> Usuário cancelou o fluxo
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
