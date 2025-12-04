import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
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
import { Progress } from "@/components/ui/progress";
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
  User,
  Rocket,
  TrendingUp,
} from "lucide-react";
import ProductThumbnail from "./ProductThumbnail";
import CountdownBadge from "./CountdownBadge";
import { cn } from "@/lib/utils";

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
  fabrica_produtos?: { nome: string; codigo: string; foto_url?: string | null } | null;
  profiles?: { nome: string } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento: Lancamento | null;
  onEdit: () => void;
  onRefresh: () => void;
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string; gradient: string }> = {
  planejado: { 
    label: "Planejado", 
    color: "text-blue-700 dark:text-blue-300", 
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    gradient: "from-blue-500 to-cyan-500"
  },
  em_preparacao: { 
    label: "Em Preparação", 
    color: "text-amber-700 dark:text-amber-300", 
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    gradient: "from-amber-500 to-yellow-500"
  },
  aprovado: { 
    label: "Aprovado", 
    color: "text-green-700 dark:text-green-300", 
    bgColor: "bg-green-100 dark:bg-green-900/30",
    gradient: "from-green-500 to-emerald-500"
  },
  lancado: { 
    label: "Lançado", 
    color: "text-purple-700 dark:text-purple-300", 
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    gradient: "from-purple-500 to-violet-500"
  },
  cancelado: { 
    label: "Cancelado", 
    color: "text-red-700 dark:text-red-300", 
    bgColor: "bg-red-100 dark:bg-red-900/30",
    gradient: "from-red-500 to-red-600"
  },
};

const tipoConfig: Record<string, { label: string; emoji: string }> = {
  novo_produto: { label: "Novo Produto", emoji: "✨" },
  reformulacao: { label: "Reformulação", emoji: "🔄" },
  nova_versao: { label: "Nova Versão", emoji: "📦" },
  promocional: { label: "Promocional", emoji: "🎁" },
};

const prioridadeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  alta: { label: "Alta", color: "text-red-700", bgColor: "bg-red-100" },
  media: { label: "Média", color: "text-amber-700", bgColor: "bg-amber-100" },
  baixa: { label: "Baixa", color: "text-green-700", bgColor: "bg-green-100" },
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
  const progressPercent = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;
  const isLaunched = lancamento.status === "lancado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        {/* Hero Section */}
        <div className={cn(
          "relative p-6 bg-gradient-to-br",
          statusConfig[lancamento.status]?.gradient
        )}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative flex items-start gap-4">
            <ProductThumbnail 
              src={lancamento.fabrica_produtos?.foto_url} 
              size="xl" 
              className="ring-4 ring-white/20 shadow-xl"
            />
            <div className="flex-1 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  {statusConfig[lancamento.status]?.label}
                </Badge>
                <Badge className={cn("backdrop-blur-sm", prioridadeConfig[lancamento.prioridade]?.bgColor, prioridadeConfig[lancamento.prioridade]?.color)}>
                  {prioridadeConfig[lancamento.prioridade]?.label}
                </Badge>
              </div>
              <h2 className="text-2xl font-bold mb-1">{lancamento.nome_lancamento}</h2>
              <p className="text-white/80 text-sm">
                {lancamento.fabrica_produtos?.nome || "Sem produto vinculado"}
                {lancamento.fabrica_produtos?.codigo && (
                  <span className="ml-1 opacity-70">({lancamento.fabrica_produtos.codigo})</span>
                )}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <CountdownBadge date={lancamento.data_prevista} isLaunched={isLaunched} />
                {lancamento.profiles?.nome && (
                  <div className="flex items-center gap-1.5 text-sm text-white/80">
                    <User className="h-4 w-4" />
                    {lancamento.profiles.nome}
                  </div>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={onEdit} className="flex-shrink-0">
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </div>

          {/* Progress Bar */}
          {totalTarefas > 0 && (
            <div className="relative mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center justify-between text-sm text-white/80 mb-2">
                <span>Progresso Marketing</span>
                <span className="font-semibold">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2 bg-white/20" />
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6 pt-0">
          <TabsList className="w-full grid grid-cols-3 -mt-5 relative z-10 bg-background shadow-lg">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger value="distribuidores" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Distribuidores
              {(distribuidores?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {distribuidores?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Marketing
              {totalTarefas > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {tarefasConcluidas}/{totalTarefas}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[350px] mt-4">
            {/* Info Tab */}
            <TabsContent value="info" className="space-y-4 pr-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-0 shadow-sm bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm font-medium">Data Prevista</span>
                    </div>
                    <p className="font-semibold text-lg">
                      {format(new Date(lancamento.data_prevista), "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(lancamento.data_prevista), "yyyy")}
                    </p>
                    {lancamento.data_efetiva && (
                      <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Lançado em {format(new Date(lancamento.data_efetiva), "dd/MM/yyyy")}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Rocket className="h-4 w-4" />
                      <span className="text-sm font-medium">Tipo</span>
                    </div>
                    <p className="font-semibold text-lg flex items-center gap-2">
                      <span>{tipoConfig[lancamento.tipo]?.emoji}</span>
                      {tipoConfig[lancamento.tipo]?.label}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Alterar Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={lancamento.status}
                    onValueChange={(v) => updateStatusMutation.mutate(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planejado">
                        <span className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                          Planejado
                        </span>
                      </SelectItem>
                      <SelectItem value="em_preparacao">
                        <span className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-amber-500" />
                          Em Preparação
                        </span>
                      </SelectItem>
                      <SelectItem value="aprovado">
                        <span className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          Aprovado
                        </span>
                      </SelectItem>
                      <SelectItem value="lancado">
                        <span className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-purple-500" />
                          Lançado
                        </span>
                      </SelectItem>
                      <SelectItem value="cancelado">
                        <span className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                          Cancelado
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {lancamento.descricao && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Descrição / Briefing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{lancamento.descricao}</p>
                  </CardContent>
                </Card>
              )}

              {lancamento.observacoes && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{lancamento.observacoes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Distribuidores Tab */}
            <TabsContent value="distribuidores" className="space-y-3 pr-4 mt-0">
              {distribuidores?.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma distribuidora vinculada</p>
                </div>
              ) : (
                distribuidores?.map((d: any) => (
                  <Card key={d.id} className="border-0 shadow-sm overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            <Users className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold">{d.estoque_distribuidoras?.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {d.estoque_distribuidoras?.cidade}/{d.estoque_distribuidoras?.uf}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={d.status_comunicacao}
                            onValueChange={(v) => updateDistribuidorMutation.mutate({ id: d.id, status: v })}
                          >
                            <SelectTrigger className="w-[130px]">
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
            <TabsContent value="marketing" className="space-y-3 pr-4 mt-0">
              {tarefas?.length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma tarefa de marketing</p>
                </div>
              ) : (
                tarefas?.map((t: any) => {
                  const isCompleted = t.status === "concluido";
                  return (
                    <Card key={t.id} className={cn(
                      "border-0 shadow-sm overflow-hidden transition-all",
                      isCompleted && "opacity-60"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={(checked) =>
                              updateTarefaMutation.mutate({
                                id: t.id,
                                status: checked ? "concluido" : "pendente",
                              })
                            }
                            className="h-5 w-5"
                          />
                          <div className="flex-1">
                            <p className={cn(
                              "font-medium",
                              isCompleted && "line-through text-muted-foreground"
                            )}>
                              {t.titulo}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              {t.profiles?.nome && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {t.profiles.nome}
                                </span>
                              )}
                              {t.data_prazo && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(t.data_prazo), "dd/MM")}
                                </span>
                              )}
                            </div>
                          </div>
                          <Select
                            value={t.status}
                            onValueChange={(v) => updateTarefaMutation.mutate({ id: t.id, status: v })}
                          >
                            <SelectTrigger className="w-[130px]">
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
