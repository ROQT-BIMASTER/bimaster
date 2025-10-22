import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Building2, Eye, ArrowUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { sanitizeText, getSafeErrorMessage } from "@/lib/utils/sanitize";
import { NovaLojaDialog } from "@/components/trade/NovaLojaDialog";

export default function TradeContasCorrentes() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isNovaLojaOpen, setIsNovaLojaOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, storesRes] = await Promise.all([
        supabase
          .from("trade_bank_accounts")
          .select(`
            *,
            store:stores(name, code, city)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("stores")
          .select("id, name, code, city")
          .eq("status", "active")
          .order("name"),
      ]);

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (storesRes.data) setStores(storesRes.data);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const initialBalance = parseFloat(formData.get("initial_balance") as string);
      
      const accountData = {
        store_id: formData.get("store_id") as string,
        account_number: sanitizeText(formData.get("account_number") as string),
        bank_name: sanitizeText(formData.get("bank_name") as string),
        agency: sanitizeText(formData.get("agency") as string || ""),
        account_type: formData.get("account_type") as string,
        initial_balance: initialBalance,
        current_balance: initialBalance,
        notes: sanitizeText(formData.get("notes") as string || ""),
        created_by: user.id,
      };

      const { error } = await supabase
        .from("trade_bank_accounts")
        .insert(accountData);

      if (error) throw error;

      toast.success("Conta corrente criada com sucesso!");
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + parseFloat(acc.current_balance || 0),
    0
  );

  const activeAccounts = accounts.filter((acc) => acc.is_active).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contas Correntes</h1>
            <p className="text-muted-foreground mt-1">
              Gestão de contas correntes por cliente
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Conta Corrente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="store_id">Cliente (Loja)</Label>
                  <div className="flex gap-2">
                    <Select 
                      name="store_id" 
                      required
                      value={selectedStoreId}
                      onValueChange={setSelectedStoreId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.code} - {store.name} ({store.city})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsNovaLojaOpen(true)}
                      title="Cadastrar nova loja"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Banco</Label>
                    <Input
                      id="bank_name"
                      name="bank_name"
                      placeholder="Ex: Banco do Brasil"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_type">Tipo de Conta</Label>
                    <Select name="account_type" defaultValue="checking">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Conta Corrente</SelectItem>
                        <SelectItem value="savings">Poupança</SelectItem>
                        <SelectItem value="investment">Investimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agency">Agência</Label>
                    <Input
                      id="agency"
                      name="agency"
                      placeholder="0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_number">Número da Conta</Label>
                    <Input
                      id="account_number"
                      name="account_number"
                      placeholder="00000-0"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initial_balance">Saldo Inicial</Label>
                  <Input
                    id="initial_balance"
                    name="initial_balance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Informações adicionais..."
                  />
                </div>

                <Button type="submit" className="w-full">
                  Criar Conta Corrente
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Contas Ativas
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAccounts}</div>
              <p className="text-xs text-muted-foreground">
                {accounts.length} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Saldo Total
              </CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R${" "}
                {totalBalance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Todas as contas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Média por Conta
              </CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R${" "}
                {activeAccounts > 0
                  ? (totalBalance / activeAccounts).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })
                  : "0,00"}
              </div>
              <p className="text-xs text-muted-foreground">Por cliente</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Contas Correntes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Agência</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.store?.code} - {account.store?.name}
                    </TableCell>
                    <TableCell>{account.bank_name}</TableCell>
                    <TableCell>{account.agency || "-"}</TableCell>
                    <TableCell className="font-mono">
                      {account.account_number}
                    </TableCell>
                    <TableCell>
                      {account.account_type === "checking"
                        ? "Corrente"
                        : account.account_type === "savings"
                        ? "Poupança"
                        : "Investimento"}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      R${" "}
                      {parseFloat(account.current_balance).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 }
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.is_active ? "default" : "secondary"}
                      >
                        {account.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link to={`/dashboard/trade/financeiro/extrato/${account.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <NovaLojaDialog
        open={isNovaLojaOpen}
        onOpenChange={setIsNovaLojaOpen}
        onSuccess={(newStoreId) => {
          if (newStoreId) {
            setSelectedStoreId(newStoreId);
          }
          fetchData();
        }}
      />
    </DashboardLayout>
  );
}
