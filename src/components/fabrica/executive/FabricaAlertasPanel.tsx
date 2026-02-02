import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, AlertCircle, Info, Bell } from "lucide-react";
import type { AlertaCusto } from "@/hooks/useFabricaExecutiveDashboard";

interface Props {
  alertas: AlertaCusto[];
}

export function FabricaAlertasPanel({ alertas }: Props) {
  const getAlertIcon = (tipo: AlertaCusto['tipo']) => {
    switch (tipo) {
      case 'critico':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'alerta':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertBadge = (tipo: AlertaCusto['tipo']) => {
    switch (tipo) {
      case 'critico':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'alerta':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Alerta</Badge>;
      case 'info':
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const alertasCriticos = alertas.filter(a => a.tipo === 'critico').length;
  const alertasWarning = alertas.filter(a => a.tipo === 'alerta').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas de Custos
          </div>
          <div className="flex gap-2">
            {alertasCriticos > 0 && (
              <Badge variant="destructive">{alertasCriticos} críticos</Badge>
            )}
            {alertasWarning > 0 && (
              <Badge className="bg-yellow-500">{alertasWarning} alertas</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alertas.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum alerta no momento</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-3">
              {alertas.map((alerta, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border ${
                    alerta.tipo === 'critico' 
                      ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30' 
                      : alerta.tipo === 'alerta'
                      ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30'
                      : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getAlertIcon(alerta.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{alerta.titulo}</span>
                        {getAlertBadge(alerta.tipo)}
                      </div>
                      <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
