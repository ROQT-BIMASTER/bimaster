import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, RotateCw } from "lucide-react";
import { format } from "date-fns";
import { useShipsgoIntegration } from "@/hooks/useShipsgoIntegration";

export function ShipsgoLogsTable() {
  const { listLogs, replayWebhook } = useShipsgoIntegration();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    setLogs(await listLogs(100));
    setLoading(false);
  }
  useEffect(() => { reload(); }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Webhooks recentes</h3>
          <p className="text-xs text-muted-foreground">URL para registrar no painel ShipsGo: <code className="text-xs">{`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipsgo-webhook`}</code></p>
        </div>
        <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </Button>
      </div>
      <ScrollArea className="h-[520px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recebido em</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>ShipsGo ID</TableHead>
              <TableHead>HMAC</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum webhook recebido ainda.</TableCell></TableRow>
            ) : logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{l.received_at ? format(new Date(l.received_at), "dd/MM/yyyy HH:mm:ss") : "—"}</TableCell>
                <TableCell className="text-xs font-mono">{l.event_type ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono">{l.shipsgo_id ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={l.signature_valid ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}>
                    {l.signature_valid ? "válido" : "inválido"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {l.error_message
                    ? <span className="text-destructive">{l.error_message}</span>
                    : l.processed_at ? "ok" : "pendente"}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={async () => { await replayWebhook(l.id); reload(); }}>
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
