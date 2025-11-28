import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PriceTableDiff } from "@/components/fabrica/PriceTableDiff";

export default function PriceTableApproval() {
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");

  const { data: pendingTables, isLoading, refetch } = useQuery({
    queryKey: ["pending-price-tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select(`
          *,
          precos_count:fabrica_precos_produtos(count)
        `)
        .eq("status", "pending_approval")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (tabelaId: string) => {
      const { data, error } = await supabase.functions.invoke(
        `price-table-approval/${tabelaId}/approve`,
        { method: 'POST' }
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Tabela aprovada com sucesso!");
      refetch();
      setSelectedTable(null);
      setShowDiffDialog(false);
    },
    onError: (error: any) => {
      toast.error("Erro ao aprovar tabela: " + error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ tabelaId, message }: { tabelaId: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke(
        `price-table-approval/${tabelaId}/reject`,
        {
          method: 'POST',
          body: { message },
        }
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Tabela rejeitada!");
      refetch();
      setSelectedTable(null);
      setShowRejectDialog(false);
      setRejectMessage("");
    },
    onError: (error: any) => {
      toast.error("Erro ao rejeitar tabela: " + error.message);
    },
  });

  const handleViewDetails = (table: any) => {
    setSelectedTable(table);
    setShowDiffDialog(true);
  };

  const handleApprove = (table: any) => {
    if (confirm(`Tem certeza que deseja aprovar a tabela "${table.nome}"?`)) {
      approveMutation.mutate(table.id);
    }
  };

  const handleReject = (table: any) => {
    setSelectedTable(table);
    setShowRejectDialog(true);
  };

  const confirmReject = () => {
    if (selectedTable) {
      rejectMutation.mutate({
        tabelaId: selectedTable.id,
        message: rejectMessage,
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Aprovação de Tabelas de Preço</h1>
          <p className="text-muted-foreground">
            Revise e aprove tabelas de preço pendentes
          </p>
        </div>

        {/* KPI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tabelas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTables?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando aprovação
            </p>
          </CardContent>
        </Card>

        {/* Lista de Tabelas Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle>Tabelas Aguardando Aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : pendingTables?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma tabela pendente de aprovação
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTables?.map((table) => (
                  <Card key={table.id} className="border-l-4 border-l-yellow-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{table.nome}</h3>
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                              {table.codigo}
                            </Badge>
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            {table.descricao || "Sem descrição"}
                          </p>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <span>
                              <strong>Data:</strong>{" "}
                              {format(new Date(table.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            <span>
                              <strong>Produtos:</strong>{" "}
                              {table.precos_count?.[0]?.count || 0}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(table)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalhes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApprove(table)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleReject(table)}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalhes e Diff */}
      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Tabela: {selectedTable?.nome}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTable && <PriceTableDiff tabelaId={selectedTable.id} />}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiffDialog(false)}>
              Fechar
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={() => {
                setShowDiffDialog(false);
                handleReject(selectedTable);
              }}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Rejeitar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleApprove(selectedTable)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprovar Tabela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Rejeição */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Tabela</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Por favor, informe o motivo da rejeição para ajudar o criador a corrigir os problemas.
            </p>
            
            <div>
              <Label htmlFor="rejectMessage">Motivo da Rejeição</Label>
              <Textarea
                id="rejectMessage"
                value={rejectMessage}
                onChange={(e) => setRejectMessage(e.target.value)}
                placeholder="Ex: Preços acima do markup permitido, produtos incorretos, etc."
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
