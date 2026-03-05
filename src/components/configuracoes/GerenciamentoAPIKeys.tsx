import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Key, RotateCw, Shield, Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function GerenciamentoAPIKeys() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rotateKey, setRotateKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys_management")
        .select("*")
        .order("key_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["api-security-logs-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_security_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("api_keys_management")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys-management"] });
      toast({ title: "Status atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const handleRotate = async () => {
    if (!rotateKey) return;
    setRotating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("api_keys_management")
        .update({
          last_rotated_at: new Date().toISOString(),
          rotated_by: user?.id,
        })
        .eq("id", rotateKey);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["api-keys-management"] });
      toast({ title: "Rotação registrada com sucesso" });
      setRotateKey(null);
    } catch {
      toast({ title: "Erro ao registrar rotação", variant: "destructive" });
    } finally {
      setRotating(false);
    }
  };

  const activeCount = keys.filter((k) => k.is_active).length;
  const lastRotation = keys
    .filter((k) => k.last_rotated_at)
    .sort((a, b) => new Date(b.last_rotated_at!).getTime() - new Date(a.last_rotated_at!).getTime())[0];
  const neverRotated = keys.filter((k) => !k.last_rotated_at).length;

  const rotateKeyData = keys.find((k) => k.id === rotateKey);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{keys.length}</p>
                <p className="text-xs text-muted-foreground">Total de chaves</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{neverRotated}</p>
                <p className="text-xs text-muted-foreground">Nunca rotacionadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Clock className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  {lastRotation?.last_rotated_at
                    ? formatDistanceToNow(new Date(lastRotation.last_rotated_at), { addSuffix: true, locale: ptBR })
                    : "Nenhuma"}
                </p>
                <p className="text-xs text-muted-foreground">Última rotação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Chaves de API do Sistema
          </CardTitle>
          <CardDescription>
            Gerencie o status e rotação das chaves de API. Valores são criptografados e não podem ser visualizados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Chave</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Rotação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-mono text-sm font-medium">{key.key_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {key.description || "—"}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{key.masked_value}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={key.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: key.id, is_active: checked })
                          }
                        />
                        <Badge variant={key.is_active ? "success" : "secondary"}>
                          {key.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.last_rotated_at
                        ? format(new Date(key.last_rotated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRotateKey(key.id)}
                        className="gap-1"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Rotacionar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Security Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Logs de Segurança Recentes
          </CardTitle>
          <CardDescription>Últimas 10 requisições registradas no log de segurança da API</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum log registrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo (ms)</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">{log.endpoint}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.method}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.success ? "success" : "destructive"}>
                        {log.success ? "OK" : "Erro"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.response_time_ms ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.created_at
                        ? format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rotate Confirmation Dialog */}
      <Dialog open={!!rotateKey} onOpenChange={() => setRotateKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Rotação de Chave</DialogTitle>
            <DialogDescription>
              Você está prestes a registrar a rotação da chave{" "}
              <strong className="font-mono">{rotateKeyData?.key_name}</strong>.
              Isso atualiza a data de última rotação. A chave em si deve ser atualizada manualmente nos secrets do backend.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateKey(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRotate} disabled={rotating}>
              {rotating ? "Registrando..." : "Confirmar Rotação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
