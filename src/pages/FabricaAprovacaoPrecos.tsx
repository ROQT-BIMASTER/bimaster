import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Eye, FileText } from "lucide-react";
import { formatarMoeda } from "@/lib/formatters";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function FabricaAprovacaoPrecos() {
  const queryClient = useQueryClient();
  const [tabelaSelecionada, setTabelaSelecionada] = useState<any>(null);
  const [versaoSelecionada, setVersaoSelecionada] = useState<any>(null);
  const [showPrecos, setShowPrecos] = useState(false);
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [showAprovar, setShowAprovar] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  // Buscar tabelas pendentes de aprovação
  const { data: tabelasPendentes, isLoading } = useQuery({
    queryKey: ["tabelas-pendentes-aprovacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select(`
          *,
          tabela_base:tabela_base_id(nome)
        `)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Buscar histórico de versões de uma tabela
  const { data: versoes } = useQuery({
    queryKey: ["versoes-tabela", tabelaSelecionada?.id],
    queryFn: async () => {
      if (!tabelaSelecionada) return [];

      const { data, error } = await supabase
        .from("fabrica_tabelas_preco_versoes")
        .select(`
          *,
          aprovador:aprovado_por(nome)
        `)
        .eq("tabela_id", tabelaSelecionada.id)
        .order("versao", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!tabelaSelecionada,
  });

  // Buscar preços da versão selecionada
  const { data: precosVersao } = useQuery({
    queryKey: ["precos-versao", versaoSelecionada?.id],
    queryFn: async () => {
      if (!versaoSelecionada?.precos_snapshot) return [];
      return versaoSelecionada.precos_snapshot;
    },
    enabled: !!versaoSelecionada && showPrecos,
  });

  // Aprovar tabela
  const aprovarMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();

      // Atualizar status da tabela
      const { error: updateError } = await supabase
        .from("fabrica_tabelas_preco")
        .update({
          status: "approved",
          aprovado_por: user.user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", tabelaSelecionada.id);

      if (updateError) throw updateError;

      // Atualizar versão como aprovada
      const { error: versaoError } = await supabase
        .from("fabrica_tabelas_preco_versoes")
        .update({
          aprovado_por: user.user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq("tabela_id", tabelaSelecionada.id)
        .is("aprovado_em", null)
        .order("versao", { ascending: false })
        .limit(1);

      if (versaoError) throw versaoError;

      // Registrar na auditoria
      await supabase.from("fabrica_tabelas_preco_auditoria").insert({
        tabela_id: tabelaSelecionada.id,
        user_id: user.user?.id,
        acao: "approved",
        mensagem: "Tabela aprovada",
      });
    },
    onSuccess: () => {
      toast.success("Tabela aprovada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      queryClient.invalidateQueries({ queryKey: ["tabelas-preco"] });
      setShowAprovar(false);
      setTabelaSelecionada(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao aprovar tabela: " + error.message);
    },
  });

  // Rejeitar tabela
  const rejeitarMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();

      // Atualizar status da tabela
      const { error: updateError } = await supabase
        .from("fabrica_tabelas_preco")
        .update({
          status: "draft",
        })
        .eq("id", tabelaSelecionada.id);

      if (updateError) throw updateError;

      // Registrar na auditoria
      await supabase.from("fabrica_tabelas_preco_auditoria").insert({
        tabela_id: tabelaSelecionada.id,
        user_id: user.user?.id,
        acao: "rejected",
        mensagem: `Tabela rejeitada: ${motivoRejeicao}`,
      });
    },
    onSuccess: () => {
      toast.success("Tabela rejeitada. Retornou para rascunho.");
      queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      queryClient.invalidateQueries({ queryKey: ["tabelas-preco"] });
      setShowRejeitar(false);
      setTabelaSelecionada(null);
      setMotivoRejeicao("");
    },
    onError: (error: any) => {
      toast.error("Erro ao rejeitar tabela: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
      case "approved":
        return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Aprovada</Badge>;
      case "draft":
        return <Badge variant="secondary">Rascunho</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Aprovação de Tabelas de Preço</h1>
          <p className="text-muted-foreground">
            Revise e aprove tabelas de preço pendentes
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando...
            </CardContent>
          </Card>
        ) : tabelasPendentes?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma tabela pendente de aprovação
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tabelasPendentes?.map((tabela) => (
              <Card key={tabela.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {tabela.nome}
                        {getStatusBadge(tabela.status)}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {tabela.descricao}
                      </CardDescription>
                      {tabela.tabela_base && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Baseada em: <span className="font-medium">{tabela.tabela_base.nome}</span>
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Markup: {tabela.tipo_markup === "percentual" && `+${tabela.valor_markup}%`}
                        {tabela.tipo_markup === "multiplicador" && `x${tabela.valor_markup}`}
                        {tabela.tipo_markup === "valor_fixo" && `+${formatarMoeda(tabela.valor_markup)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTabelaSelecionada(tabela);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Histórico
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          setTabelaSelecionada(tabela);
                          setShowRejeitar(true);
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setTabelaSelecionada(tabela);
                          setShowAprovar(true);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Aprovar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de Histórico de Versões */}
      <Dialog open={!!tabelaSelecionada && !showRejeitar && !showAprovar} onOpenChange={(open) => !open && setTabelaSelecionada(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Versões - {tabelaSelecionada?.nome}</DialogTitle>
            <DialogDescription>
              Visualize o histórico completo de alterações desta tabela
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {versoes?.map((versao) => (
              <Card key={versao.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Versão {versao.versao}</CardTitle>
                      <CardDescription>
                        Criada em {new Date(versao.created_at).toLocaleString("pt-BR")}
                      </CardDescription>
                      {versao.aprovado_em && (
                        <p className="text-sm text-green-600 mt-1">
                          Aprovada em {new Date(versao.aprovado_em).toLocaleString("pt-BR")}
                          {versao.aprovador && ` por ${versao.aprovador.nome}`}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVersaoSelecionada(versao);
                        setShowPrecos(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Preços
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Preços da Versão */}
      <Dialog open={showPrecos} onOpenChange={setShowPrecos}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Preços - Versão {versaoSelecionada?.versao}
            </DialogTitle>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-right">Custo Base</th>
                  <th className="p-3 text-right">Preço Final</th>
                  <th className="p-3 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {precosVersao?.map((preco: any) => (
                  <tr key={preco.produto_id} className="border-t">
                    <td className="p-3">{preco.produto_nome || preco.produto_id}</td>
                    <td className="p-3 text-right">{formatarMoeda(preco.custo_base)}</td>
                    <td className="p-3 text-right font-semibold">{formatarMoeda(preco.preco_final)}</td>
                    <td className="p-3 text-right text-green-600">
                      {preco.margem_lucro?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Aprovação */}
      <AlertDialog open={showAprovar} onOpenChange={setShowAprovar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Tabela de Preços</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja aprovar a tabela "{tabelaSelecionada?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => aprovarMutation.mutate()}
              className="bg-green-600 hover:bg-green-700"
            >
              {aprovarMutation.isPending ? "Aprovando..." : "Aprovar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Rejeição */}
      <AlertDialog open={showRejeitar} onOpenChange={setShowRejeitar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Tabela de Preços</AlertDialogTitle>
            <AlertDialogDescription>
              A tabela "{tabelaSelecionada?.nome}" retornará para status de rascunho.
              Por favor, informe o motivo da rejeição:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="motivo">Motivo da Rejeição</Label>
            <Textarea
              id="motivo"
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              placeholder="Ex: Preços muito altos, revisar margem do produto X..."
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejeitarMutation.mutate()}
              disabled={!motivoRejeicao.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejeitarMutation.isPending ? "Rejeitando..." : "Rejeitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
