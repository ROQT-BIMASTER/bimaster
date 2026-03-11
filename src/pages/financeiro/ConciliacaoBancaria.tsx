import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  RefreshCw,
  Plus,
  History,
  Loader2,
  Filter,
  CreditCard,
  Landmark,
  Tag,
  Bell,
} from "lucide-react";
import { useConciliacaoBancaria } from "@/hooks/useConciliacaoBancaria";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { DashboardConciliacao } from "@/components/conciliacao/DashboardConciliacao";
import { TabelaPendentes } from "@/components/conciliacao/TabelaPendentes";
import { PluggyConnectWidget } from "@/components/conciliacao/PluggyConnectWidget";
import { PainelSaldos } from "@/components/conciliacao/PainelSaldos";
import { PainelCartoes } from "@/components/conciliacao/PainelCartoes";
import { MonitorEmprestimos } from "@/components/conciliacao/MonitorEmprestimos";
import { GestaoCategoriasPluggy } from "@/components/conciliacao/GestaoCategoriasPluggy";
import { AlertasSaldo } from "@/components/conciliacao/AlertasSaldo";
import { toast } from "sonner";

export default function ConciliacaoBancaria() {
  const { data: userEmpresas, isLoading: empresasLoading } = useUserEmpresas();
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);

  const {
    connections,
    connectionsLoading,
    history,
    conciliacoes,
    conciliacoesLoading,
    isSyncing,
    syncingConnectionId,
    getConnectToken,
    saveConnection,
    syncTransactions,
    matchManual,
    loans,
    loansLoading,
  } = useConciliacaoBancaria(selectedEmpresaId);

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectToken, setConnectToken] = useState("");
  const [showPluggyConnect, setShowPluggyConnect] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filter, setFilter] = useState("all");
  const [showEmpresaDialog, setShowEmpresaDialog] = useState(false);
  const [connectEmpresaId, setConnectEmpresaId] = useState<string>("");
  const pluggyPopupRef = useRef<Window | null>(null);

  const handleConnectClick = () => {
    if (userEmpresas && userEmpresas.length > 1) {
      setShowEmpresaDialog(true);
    } else {
      const empresaId = userEmpresas?.[0]?.empresa_id || null;
      openPluggyConnect(empresaId);
    }
  };

  const handleEmpresaConfirm = () => {
    const empresaId = connectEmpresaId ? parseInt(connectEmpresaId) : null;
    setShowEmpresaDialog(false);
    openPluggyConnect(empresaId);
  };

  const openPluggyConnect = async (empresaId: number | null) => {
    setIsConnecting(true);
    try {
      const popup = window.open("about:blank", "pluggy_connect", "width=450,height=700,left=200,top=100,scrollbars=yes");
      pluggyPopupRef.current = popup;
      const token = await getConnectToken();
      if (popup && !popup.closed) {
        popup.location.href = `https://connect.pluggy.ai/?connect_token=${token}`;
        setConnectToken(token);
        setConnectEmpresaId(empresaId?.toString() || "");
        setShowPluggyConnect(true);
      } else {
        toast.error("Popup bloqueado pelo navegador. Permita popups para este site.");
      }
    } catch {
      pluggyPopupRef.current?.close();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = () => {
    if (!selectedConnection) return;
    syncTransactions(selectedConnection, dateFrom || undefined, dateTo || undefined);
  };

  const handleSyncFromPanel = (connectionId: string) => {
    syncTransactions(connectionId);
  };

  const empresaFilterValue = selectedEmpresaId?.toString() || "all";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Pluggy Connect Widget */}
        {showPluggyConnect && connectToken && (
          <PluggyConnectWidget
            connectToken={connectToken}
            popupRef={pluggyPopupRef}
            onSuccess={(data) => {
              const item = data.item;
              saveConnection.mutate({
                itemId: item.id.toString(),
                banco: item.connector?.name || "desconhecido",
                conta: item.accounts?.[0]?.number,
                agencia: item.accounts?.[0]?.bankData?.branchNumber,
                empresaId: connectEmpresaId ? parseInt(connectEmpresaId) : undefined,
              });
              setShowPluggyConnect(false);
              setConnectToken("");
            }}
            onError={(error) => {
              console.error("Pluggy Connect error:", error);
              toast.error("Erro na conexão bancária: " + (error?.message || "erro desconhecido"));
              setShowPluggyConnect(false);
              setConnectToken("");
            }}
            onClose={() => {
              setShowPluggyConnect(false);
              setConnectToken("");
            }}
          />
        )}

        {/* Branch Selection Dialog */}
        <Dialog open={showEmpresaDialog} onOpenChange={setShowEmpresaDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Selecionar Filial
              </DialogTitle>
              <DialogDescription>
                Escolha a filial para vincular esta conta bancária
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={connectEmpresaId} onValueChange={setConnectEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a filial" />
                </SelectTrigger>
                <SelectContent>
                  {userEmpresas?.map((ue) => (
                    <SelectItem key={ue.empresa_id} value={ue.empresa_id.toString()}>
                      {ue.empresa.nome}
                      {ue.empresa.uf && ` (${ue.empresa.uf})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmpresaDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEmpresaConfirm} disabled={!connectEmpresaId}>
                Continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conciliação Bancária</h1>
            <p className="text-muted-foreground">
              Sincronize extratos via Pluggy e concilie automaticamente com contas a pagar
            </p>
          </div>
          <div className="flex items-center gap-2">
            {userEmpresas && userEmpresas.length > 1 && (
              <Select
                value={empresaFilterValue}
                onValueChange={(v) => setSelectedEmpresaId(v === "all" ? null : parseInt(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Filial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Filiais</SelectItem>
                  {userEmpresas.map((ue) => (
                    <SelectItem key={ue.empresa_id} value={ue.empresa_id.toString()}>
                      {ue.empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleConnectClick} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Conectar Banco
            </Button>
          </div>
        </div>

        {/* Painel de Saldos */}
        <PainelSaldos
          connections={connections}
          conciliacoes={conciliacoes}
          isSyncing={isSyncing}
          syncingConnectionId={syncingConnectionId}
          onSync={handleSyncFromPanel}
        />

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
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data Fim</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
              </div>
              <Button onClick={handleSync} disabled={!selectedConnection || isSyncing}>
                {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sincronizar Extrato
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard */}
        <DashboardConciliacao conciliacoes={conciliacoes} history={history} />

        {/* Tabs */}
        <Tabs defaultValue="transacoes" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="transacoes">Transações</TabsTrigger>
            <TabsTrigger value="cartoes">
              <CreditCard className="h-3 w-3 mr-1" />
              Cartões
            </TabsTrigger>
            <TabsTrigger value="emprestimos">
              <Landmark className="h-3 w-3 mr-1" />
              Empréstimos
            </TabsTrigger>
            <TabsTrigger value="categorias">
              <Tag className="h-3 w-3 mr-1" />
              Categorias
            </TabsTrigger>
            <TabsTrigger value="alertas">
              <Bell className="h-3 w-3 mr-1" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-3 w-3 mr-1" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transacoes" className="space-y-4">
            <div className="flex gap-2">
              {["all", "pendente", "conciliado", "divergente"].map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                  {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
            <Card>
              <CardContent className="p-0">
                <TabelaPendentes
                  conciliacoes={conciliacoes}
                  onMatch={(conciliacaoId, contaPagarId) => matchManual.mutate({ conciliacaoId, contaPagarId })}
                  isMatching={matchManual.isPending}
                  filter={filter}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cartoes">
            <PainelCartoes connections={connections} />
          </TabsContent>

          <TabsContent value="emprestimos">
            <MonitorEmprestimos loans={loans} isLoading={loansLoading} />
          </TabsContent>

          <TabsContent value="categorias">
            <GestaoCategoriasPluggy />
          </TabsContent>

          <TabsContent value="alertas">
            <AlertasSaldo />
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
                      <div key={h.id} className="flex items-center justify-between p-3 border rounded-lg">
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
                          <span className="text-green-600">✓ {h.conciliados} conciliados</span>
                          <span className="text-yellow-600">○ {h.pendentes} pendentes</span>
                          <span className="text-red-600">✕ {h.divergentes} divergentes</span>
                          <Badge variant="outline">{h.total_transacoes} total</Badge>
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
