import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { WhatsAppMonitoringPanel } from "@/components/whatsapp/WhatsAppMonitoringPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

export default function WhatsAppMonitoring() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitoramento WhatsApp</h1>
            <p className="text-muted-foreground">
              Acompanhe em tempo real todas as conversas e mensagens do WhatsApp
            </p>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy")
                  )
                ) : (
                  "Selecionar período"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <WhatsAppMonitoringPanel
          dateRange={dateRange ? {
            start: dateRange.from!,
            end: dateRange.to || dateRange.from!
          } : undefined}
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
