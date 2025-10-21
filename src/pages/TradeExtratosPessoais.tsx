import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, FileText, CheckCircle2, Download } from "lucide-react";
import { format } from "date-fns";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { Link } from "react-router-dom";

export default function TradeExtratosPessoais() {
  const [loading, setLoading] = useState(true);
  const [myEntries, setMyEntries] = useState<any[]>([]);
  const [myApprovals, setMyApprovals] = useState<any[]>([]);
  const [myInvestments, setMyInvestments] = useState<any[]>([]);
  const [approvedInvestments, setApprovedInvestments] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Lançamentos criados por mim
      const { data: entriesData } = await supabase
        .from("trade_financial_entries")
        .select(`
          *,
          account:trade_chart_of_accounts(name, code),
          store:stores(name, code),
          budget:trade_budgets(name, code)
        `)
        .eq("created_by", user.id)
        .order("entry_date", { ascending: false });

      // Lançamentos aprovados por mim
      const { data: approvalsData } = await supabase
        .from("trade_financial_entries")
        .select(`
          *,
          account:trade_chart_of_accounts(name, code),
          store:stores(name, code),
          budget:trade_budgets(name, code)
        `)
        .eq("approved_by", user.id)
        .order("approved_at", { ascending: false });

      // Buscar informações dos criadores dos lançamentos aprovados
      if (approvalsData && approvalsData.length > 0) {
        const userIds = [...new Set(approvalsData.map(e => e.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        const enrichedApprovals = approvalsData.map(entry => ({
          ...entry,
          creator: profileMap.get(entry.created_by)
        }));

        setMyApprovals(enrichedApprovals);
      } else {
        setMyApprovals(approvalsData || []);
      }

      // Investimentos criados por mim
      const { data: investmentsData } = await supabase
        .from("trade_investments")
        .select(`
          *,
          store:stores(name, code)
        `)
        .eq("created_by", user.id)
        .order("investment_date", { ascending: false });

      // Investimentos aprovados por mim
      const { data: approvedInvData } = await supabase
        .from("trade_investments")
        .select(`
          *,
          store:stores(name, code)
        `)
        .eq("approved_by", user.id)
        .order("approved_at", { ascending: false });

      // Buscar informações dos criadores dos investimentos aprovados
      if (approvedInvData && approvedInvData.length > 0) {
        const userIds = [...new Set(approvedInvData.map(i => i.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        const enrichedInvestments = approvedInvData.map(inv => ({
          ...inv,
          creator: profileMap.get(inv.created_by)
        }));

        setApprovedInvestments(enrichedInvestments);
      } else {
        setApprovedInvestments(approvedInvData || []);
      }

      setMyEntries(entriesData || []);
      setMyInvestments(investmentsData || []);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, approvalStatus?: string) => {
    if (approvalStatus === "pending") {
      return <Badge variant="secondary">Pendente</Badge>;
    }
    if (approvalStatus === "rejected") {
      return <Badge variant="destructive">Rejeitado</Badge>;
    }
    if (status === "approved" || approvalStatus === "approved") {
      return <Badge variant="default">Aprovado</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getEntryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      budget_allocation: "Alocação de Verba",
      investment: "Investimento",
      expense: "Despesa",
      revenue: "Receita",
      adjustment: "Ajuste",
    };
    return labels[type] || type;
  };

  const totalCreated = myEntries.reduce((sum, e) => sum + parseFloat(e.amount), 0) +
    myInvestments.reduce((sum, i) => sum + parseFloat(i.amount), 0);
  const totalApproved = myApprovals.reduce((sum, e) => sum + parseFloat(e.amount), 0) +
    approvedInvestments.reduce((sum, i) => sum + parseFloat(i.amount), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/trade/financeiro">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Meu Extrato</h1>
            <p className="text-muted-foreground mt-1">
              Histórico de lançamentos criados e aprovados por você
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Criado</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalCreated.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {myEntries.length + myInvestments.length} lançamento(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Aprovado</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalApproved.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {myApprovals.length + approvedInvestments.length} aprovação(ões)
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="created" className="space-y-4">
          <TabsList>
            <TabsTrigger value="created">Criados por Mim</TabsTrigger>
            <TabsTrigger value="approved">Aprovados por Mim</TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="space-y-4">
            {/* Lançamentos Financeiros Criados */}
            {myEntries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Lançamentos Financeiros</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(entry.entry_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {getEntryTypeLabel(entry.entry_type)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {entry.description}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {parseFloat(entry.amount).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(entry.status, entry.approval_status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Investimentos Criados */}
            {myInvestments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Investimentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myInvestments.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(inv.investment_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="capitalize text-sm">
                            {inv.category}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {inv.description}
                          </TableCell>
                          <TableCell className="text-sm">
                            {inv.store?.code || "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {parseFloat(inv.amount).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(inv.status, inv.approval_status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {myEntries.length === 0 && myInvestments.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum lançamento criado ainda
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {/* Lançamentos Aprovados */}
            {myApprovals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Lançamentos Financeiros Aprovados</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Aprovação</TableHead>
                        <TableHead>Criador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myApprovals.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap">
                            {entry.approved_at
                              ? format(new Date(entry.approved_at), "dd/MM/yyyy HH:mm")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.creator?.nome || "N/A"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {getEntryTypeLabel(entry.entry_type)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {entry.description}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {parseFloat(entry.amount).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Investimentos Aprovados */}
            {approvedInvestments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Investimentos Aprovados</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Aprovação</TableHead>
                        <TableHead>Criador</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvedInvestments.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="whitespace-nowrap">
                            {inv.approved_at
                              ? format(new Date(inv.approved_at), "dd/MM/yyyy HH:mm")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {inv.creator?.nome || "N/A"}
                          </TableCell>
                          <TableCell className="capitalize text-sm">
                            {inv.category}
                          </TableCell>
                          <TableCell className="text-sm">
                            {inv.store?.code || "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {parseFloat(inv.amount).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {myApprovals.length === 0 && approvedInvestments.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma aprovação realizada ainda
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
