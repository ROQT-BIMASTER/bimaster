import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SmartValue } from "@/components/ui/smart-value";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, BellOff, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useConciliacaoBancaria } from "@/hooks/useConciliacaoBancaria";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AlertasSaldo() {
  const { balanceAlerts, balanceAlertsLoading, manageBalanceAlert, connections } = useConciliacaoBancaria();
  const [newConnectionId, setNewConnectionId] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  const handleCreate = () => {
    if (!newConnectionId || !newThreshold) return;
    manageBalanceAlert.mutate({
      connectionId: newConnectionId,
      threshold: parseFloat(newThreshold),
    });
    setNewConnectionId("");
    setNewThreshold("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Alertas de Saldo Baixo
        </h3>
      </div>

      {/* Create new alert */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground">Conta</label>
              <Select value={newConnectionId} onValueChange={setNewConnectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn: any) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.banco} {conn.conta && `• ${conn.conta}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-[160px]">
              <label className="text-xs text-muted-foreground">Limite mínimo (R$)</label>
              <Input
                type="number"
                placeholder="10000"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={!newConnectionId || !newThreshold || manageBalanceAlert.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Criar Alerta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active alerts */}
      <Card>
        <CardContent className="pt-6">
          {balanceAlertsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : balanceAlerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum alerta configurado
            </p>
          ) : (
            <div className="space-y-2">
              {balanceAlerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    {alert.is_active ? (
                      <Bell className="h-4 w-4 text-primary" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {alert.bank_connections?.banco || "—"} {alert.bank_connections?.conta && `• ${alert.bank_connections.conta}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Alertar quando saldo &lt; <SmartValue value={alert.threshold} className="font-medium" />
                      </p>
                      {alert.last_triggered_at && (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          Disparado {formatDistanceToNow(new Date(alert.last_triggered_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.is_active ? "default" : "secondary"} className="text-[10px]">
                      {alert.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => manageBalanceAlert.mutate({ alertId: alert.id, action: "toggle" })}
                    >
                      {alert.is_active ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => manageBalanceAlert.mutate({ alertId: alert.id, action: "delete" })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
