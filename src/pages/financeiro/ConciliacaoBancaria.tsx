import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  RefreshCw,
  Plus,
  History,
  Loader2,
  Landmark,
} from "lucide-react";
import { useConciliacaoBancaria } from "@/hooks/useConciliacaoBancaria";
import { DashboardConciliacao } from "@/components/conciliacao/DashboardConciliacao";
import { TabelaPendentes } from "@/components/conciliacao/TabelaPendentes";
import { PluggyConnect } from "react-pluggy-connect";
import { toast } from "sonner";

export default function ConciliacaoBancaria() {
  const {
    connections,
    connectionsLoading,
    history,
    conciliacoes,
    conciliacoesLoading,
    isSyncing,
    getConnectToken,
    saveConnection,
    syncTransactions,
    matchManual,
  } = useConciliacaoBancaria();

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectToken, setConnectToken] = useState("");
  const [showPluggyConnect, setShowPluggyConnect] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filter, setFilter] = useState("all");

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const token = await getConnectToken();
      setConnectToken(token);
      setShowPluggyConnect(true);
    } catch {
      // error handled in hook
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = () => {
    if (!selectedConnection) return;
    syncTransactions(selectedConnection, dateFrom || undefined, dateTo || undefined);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Pluggy Connect Widget */}
        {showPluggyConnect && connectToken && (
          <PluggyConnect
            connectToken={connectToken}
            includeSandbox={true}
            onSuccess={(itemData) => {
              const item = itemData.item;
              saveConnection.mutate({
                itemId: item.id.toString(),
                banco: item.connector?.name || "desconhecido",
                conta: item.accounts?.[0]?.number,
                agencia: item.accounts?.[0]?.bankData?.branchNumber,
              });
              setShowPluggyConnect(false);
              setConnectToken("");
            }}
            onError={(error) => {
              console.error("Pluggy Connect error", error);
              toast.error("Erro na conexão bancária");
              setShowPluggyConnect(false);
              setConnectToken("");
            }}
            onClose={() => {
              setShowPluggyConnect(false);
              setConnectToken("");
            }}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conciliação Bancária</h1>
            <p className="text-muted-foreground">
              Sincronize extratos via Pluggy e concilie automaticamente com contas a pagar
            </p>
          </div>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Conectar Banco
          </Button>
        </div>

        {/* Connected Banks */}
        {connections.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Bancos Conectados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {connections.map((conn: any) => (
                  <Badge
                    key={conn.id}
                    variant={conn.status === "active" ? "default" : "secondary"}
                    className="px-3 py-1.5 text-sm cursor-pointer"
                    onClick={() => setSelectedConnection(conn.id)}
                  >
                    <Building2 className="h-3 w-3 mr-1" />
                    {conn.banco}
                    {conn.conta && ` • ${conn.conta}`}
                    {conn.last_sync && (
                      <span className="ml-2 text-[10px] opacity-70">
                        Sync: {new Date(conn.last_sync).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Conta</Label>
                <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                  <SelectTrigger className="w-[200px]">
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
              <div className="space-y-1.5">
                <Label className="text-xs">Data Início</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <Button
                onClick={handleSync}
                disabled={!selectedConnection || isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar Extrato
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard */}
        <DashboardConciliacao conciliacoes={conciliacoes} history={history} />

        {/* Tabs */}
        <Tabs defaultValue="transacoes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transacoes">Transações</TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-3 w-3 mr-1" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transacoes" className="space-y-4">
            <div className="flex gap-2">
              {["all", "pendente", "conciliado", "divergente"].map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
            <Card>
              <CardContent className="p-0">
                <TabelaPendentes
                  conciliacoes={conciliacoes}
                  onMatch={(conciliacaoId, contaPagarId) =>
                    matchManual.mutate({ conciliacaoId, contaPagarId })
                  }
                  isMatching={matchManual.isPending}
                  filter={filter}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardContent className="pt-6">
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma sincronização realizada
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((h: any) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {h.bank_connections?.banco || "—"}{" "}
                            {h.bank_connections?.conta && `• ${h.bank_connections.conta}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-green-600">
                            ✓ {h.conciliados} conciliados
                          </span>
                          <span className="text-yellow-600">
                            ○ {h.pendentes} pendentes
                          </span>
                          <span className="text-red-600">
                            ✕ {h.divergentes} divergentes
                          </span>
                          <Badge variant="outline">
                            {h.total_transacoes} total
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
