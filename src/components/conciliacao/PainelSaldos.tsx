import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SmartValue } from "@/components/ui/smart-value";
import {
  Building2,
  Landmark,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankConnection {
  id: string;
  banco: string;
  conta: string | null;
  agencia: string | null;
  saldo_atual: number;
  saldo_atualizado_em: string | null;
  last_sync: string | null;
  status: string;
  empresa_id: number | null;
  empresas?: { id: number; nome: string; cnpj: string | null; uf: string | null } | null;
}

interface PainelSaldosProps {
  connections: BankConnection[];
  conciliacoes: any[];
  isSyncing: boolean;
  syncingConnectionId: string | null;
  onSync: (connectionId: string) => void;
}

export function PainelSaldos({
  connections,
  conciliacoes,
  isSyncing,
  syncingConnectionId,
  onSync,
}: PainelSaldosProps) {
  const saldoTotal = connections.reduce((sum, c) => sum + (c.saldo_atual || 0), 0);

  // Calculate entries/exits from conciliacoes (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentTx = conciliacoes.filter(
    (c) => new Date(c.data_transacao) >= thirtyDaysAgo
  );
  const entradas = recentTx
    .filter((c) => c.valor > 0)
    .reduce((sum, c) => sum + c.valor, 0);
  const saidas = recentTx
    .filter((c) => c.valor < 0)
    .reduce((sum, c) => sum + Math.abs(c.valor), 0);

  // Group connections by empresa
  const grouped = connections.reduce<Record<string, { empresa: string; uf: string | null; connections: BankConnection[] }>>(
    (acc, conn) => {
      const key = conn.empresa_id?.toString() || "sem-filial";
      const empresaNome = conn.empresas?.nome || "Sem Filial";
      const uf = conn.empresas?.uf || null;
      if (!acc[key]) acc[key] = { empresa: empresaNome, uf, connections: [] };
      acc[key].connections.push(conn);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Total
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              <SmartValue value={saldoTotal} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {connections.length} conta{connections.length !== 1 ? "s" : ""} conectada{connections.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas (30d)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              <SmartValue value={entradas} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saídas (30d)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              <SmartValue value={saidas} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connections grouped by branch */}
      {Object.entries(grouped).map(([key, group]) => (
        <Card key={key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {group.empresa}
              {group.uf && (
                <Badge variant="outline" className="text-[10px] ml-1">
                  {group.uf}
                </Badge>
              )}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Saldo:{" "}
                <SmartValue
                  value={group.connections.reduce((s, c) => s + (c.saldo_atual || 0), 0)}
                  className="font-semibold text-foreground"
                />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {group.connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Landmark className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {conn.banco}
                        {conn.conta && (
                          <span className="text-muted-foreground ml-1">
                            CC {conn.conta}
                          </span>
                        )}
                        {conn.agencia && (
                          <span className="text-muted-foreground text-xs ml-1">
                            Ag {conn.agencia}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conn.saldo_atualizado_em
                          ? `Atualizado ${formatDistanceToNow(new Date(conn.saldo_atualizado_em), { addSuffix: true, locale: ptBR })}`
                          : "Saldo não sincronizado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        <SmartValue value={conn.saldo_atual || 0} />
                      </p>
                      <Badge
                        variant={conn.status === "active" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {conn.status === "active" ? "Ativo" : conn.status}
                      </Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={isSyncing}
                      onClick={() => onSync(conn.id)}
                    >
                      {isSyncing && syncingConnectionId === conn.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {connections.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Landmark className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              Nenhuma conta bancária conectada
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Conectar Banco" para começar
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
