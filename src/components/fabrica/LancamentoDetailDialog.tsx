import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Package,
  Users,
  Megaphone,
  Calendar,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
} from "lucide-react";

type Lancamento = {
  id: string;
  nome_lancamento: string;
  descricao: string | null;
  data_prevista: string;
  data_efetiva: string | null;
  status: string;
  tipo: string;
  prioridade: string;
  produto_id: string | null;
  tabela_preco_id: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  fabrica_produtos?: { nome: string; codigo: string } | null;
  profiles?: { nome: string } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento: Lancamento | null;
  onEdit: () => void;
  onRefresh: () => void;
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  planejado: { label: "Planejado", color: "text-blue-600", bgColor: "bg-blue-100" },
  em_preparacao: { label: "Em Preparação", color: "text-yellow-600", bgColor: "bg-yellow-100" },
  aprovado: { label: "Aprovado", color: "text-green-600", bgColor: "bg-green-100" },
  lancado: { label: "Lançado", color: "text-purple-600", bgColor: "bg-purple-100" },
  cancelado: { label: "Cancelado", color: "text-red-600", bgColor: "bg-red-100" },
};

const tipoConfig: Record<string, string> = {
  novo_produto: "Novo Produto",
  reformulacao: "Reformulação",
  nova_versao: "Nova Versão",
  promocional: "Promocional",
};

const tarefaStatusConfig: Record<string, { label: string; icon: any }> = {
  pendente: { label: "Pendente", icon: Clock },
  em_andamento: { label: "Em Andamento", icon: AlertTriangle },
  revisao: { label: "Em Revisão", icon: AlertTriangle },
  concluido: { label: "Concluído", icon: CheckCircle },
};

export default function LancamentoDetailDialog({
  open,
  onOpenChange,
  lancamento,
  onEdit,
  onRefresh,
}: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("info");

  // Fetch distribuidores
  const { data: distribuidores } = useQuery({
    queryKey: ["lancamento-distribuidores", lancamento?.id],
    queryFn: async () => {
      if (!lancamento?.id) return [];
      const { data, error } = await supabase
        .from("lancamentos_distribuidores")
        .select(`
          *,
          estoque_distribuidoras(nome, cidade, uf)
        `)
        .eq("lancamento_id", lancamento.id);
      if (error) throw error;
      return data;
    },
    enabled: !!lancamento?.id,
  });

  // Fetch tarefas marketing
  const { data: tarefas } = useQuery({
    queryKey: ["lancamento-tarefas", lancamento?.id],
    queryFn: async () => {
      if (!lancamento?.id) return [];
      const { data, error } = await supabase
        .from("lancamentos_tarefas_marketing")
        .select(`
          *,
          profiles(nome)
        `)
        .eq("lancamento_id", lancamento.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!lancamento?.id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!lancamento?.id) return;
      const payload: any = { status: newStatus };
      if (newStatus === "lancado") {
        payload.data_efetiva = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase
        .from("lancamentos_produtos")
        .update(payload)
        .eq("id", lancamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["lancamentos-produtos"] });
      onRefresh();
    },
    onError: (error: any) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Update tarefa status
  const updateTarefaMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const payload: any = { status };
      if (status === "concluido") {
        payload.data_conclusao = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase
        .from("lancamentos_tarefas_marketing")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa atualizada!");
      queryClient.invalidateQueries({ queryKey: ["lancamento-tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos-tarefas-pendentes"] });
    },
  });

  // Update distribuidor status
  const updateDistribuidorMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("lancamentos_distribuidores")
        .update({ status_comunicacao: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["lancamento-distribuidores"] });
    },
  });

  if (!lancamento) return null;

  const tarefasConcluidas = tarefas?.filter((t) => t.status === "concluido").length || 0;
  const totalTarefas = tarefas?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{lancamento.nome_lancamento}</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className={`${statusConfig[lancamento.status]?.bgColor} ${statusConfig[lancamento.status]?.color}`}>
                {statusConfig[lancamento.status]?.label}
              </Badge>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="distribuidores" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Distribuidores ({distribuidores?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Marketing ({tarefasConcluidas}/{totalTarefas})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[450px] mt-4">
            {/* Info Tab */}
            <TabsContent value="info" className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">Produto</span>
                    </div>
                    <p className="font-medium">
                      {lancamento.fabrica_produtos?.nome || "Não vinculado"}
                    </p>
                    {lancamento.fabrica_produtos?.codigo && (
                      <p className="text-sm text-muted-foreground">
                        Código: {lancamento.fabrica_produtos.codigo}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Data Prevista</span>
                    </div>
                    <p className="font-medium">
                      {format(new Date(lancamento.data_prevista), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                    {lancamento.data_efetiva && (
                      <p className="text-sm text-green-600">
                        Lançado em: {format(new Date(lancamento.data_efetiva), "dd/MM/yyyy")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Alterar Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={lancamento.status}
                    onValueChange={(v) => updateStatusMutation.mutate(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planejado">Planejado</SelectItem>
                      <SelectItem value="em_preparacao">Em Preparação</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="lancado">Lançado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-medium">{tipoConfig[lancamento.tipo]}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Prioridade</p>
                  <p className="font-medium capitalize">{lancamento.prioridade}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Responsável</p>
                  <p className="font-medium">{lancamento.profiles?.nome || "-"}</p>
                </div>
              </div>

              {lancamento.descricao && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Descrição / Briefing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{lancamento.descricao}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Distribuidores Tab */}
            <TabsContent value="distribuidores" className="space-y-3 pr-4">
              {distribuidores?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma distribuidora vinculada a este lançamento
                </p>
              ) : (
                distribuidores?.map((d: any) => (
                  <Card key={d.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{d.estoque_distribuidoras?.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {d.estoque_distribuidoras?.cidade}/{d.estoque_distribuidoras?.uf}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={d.status_comunicacao}
                            onValueChange={(v) => updateDistribuidorMutation.mutate({ id: d.id, status: v })}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="enviado">Enviado</SelectItem>
                              <SelectItem value="confirmado">Confirmado</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="icon" title="Enviar comunicação">
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Marketing Tab */}
            <TabsContent value="marketing" className="space-y-3 pr-4">
              {tarefas?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma tarefa de marketing vinculada
                </p>
              ) : (
                tarefas?.map((t: any) => {
                  const StatusIcon = tarefaStatusConfig[t.status]?.icon || Clock;
                  return (
                    <Card key={t.id}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={t.status === "concluido"}
                              onCheckedChange={(checked) =>
                                updateTarefaMutation.mutate({
                                  id: t.id,
                                  status: checked ? "concluido" : "pendente",
                                })
                              }
                            />
                            <div>
                              <p className={`font-medium ${t.status === "concluido" ? "line-through text-muted-foreground" : ""}`}>
                                {t.titulo}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {t.profiles?.nome || "Sem responsável"} •{" "}
                                {t.data_prazo && `Prazo: ${format(new Date(t.data_prazo), "dd/MM")}`}
                              </p>
                            </div>
                          </div>
                          <Select
                            value={t.status}
                            onValueChange={(v) => updateTarefaMutation.mutate({ id: t.id, status: v })}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="em_andamento">Em Andamento</SelectItem>
                              <SelectItem value="revisao">Em Revisão</SelectItem>
                              <SelectItem value="concluido">Concluído</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
