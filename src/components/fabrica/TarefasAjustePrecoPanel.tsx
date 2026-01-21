import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { Check, X, Play, Clock, AlertTriangle, Package, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TarefaAjuste {
  id: string;
  produto_id: string;
  tabela_id: string;
  tabela_limite_id: string;
  preco_atual: number;
  preco_sugerido: number;
  diferenca_percentual: number;
  margem_resultante: number;
  custo_base: number;
  status: string;
  ordem_na_cadeia: number;
  created_at: string;
  produto?: { nome: string; codigo: string };
  tabela?: { nome: string; codigo: string };
  tabela_limite?: { nome: string; codigo: string };
}

export function TarefasAjustePrecoPanel() {
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<string>("pendente");
  const [dialogRejeitar, setDialogRejeitar] = useState(false);
  const [tarefaSelecionada, setTarefaSelecionada] = useState<TarefaAjuste | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [dialogAplicarGrupo, setDialogAplicarGrupo] = useState(false);
  const [grupoSelecionado, setGrupoSelecionado] = useState<TarefaAjuste[]>([]);

  // Buscar tarefas de ajuste
  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["fabrica-tarefas-ajuste", filtroStatus],
    queryFn: async () => {
      let query = supabase
        .from("fabrica_tarefas_ajuste_preco")
        .select(`*`)
        .order("created_at", { ascending: false });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Buscar produtos e tabelas separadamente
      const produtoIds = [...new Set(data?.map(t => t.produto_id) || [])];
      const tabelaIds = [...new Set([
        ...(data?.map(t => t.tabela_id) || []),
        ...(data?.map(t => t.tabela_limite_id) || [])
      ])];

      const [produtosRes, tabelasRes] = await Promise.all([
        supabase.from("fabrica_produtos").select("id, nome, codigo").in("id", produtoIds),
        supabase.from("fabrica_tabelas_preco").select("id, nome, codigo").in("id", tabelaIds)
      ]);

      const produtosMap = new Map(produtosRes.data?.map(p => [p.id, p]) || []);
      const tabelasMap = new Map(tabelasRes.data?.map(t => [t.id, t]) || []);

      return (data || []).map(tarefa => ({
        ...tarefa,
        produto: produtosMap.get(tarefa.produto_id),
        tabela: tabelasMap.get(tarefa.tabela_id),
        tabela_limite: tabelasMap.get(tarefa.tabela_limite_id),
      })) as TarefaAjuste[];
    },
  });

  // Agrupar tarefas por produto e tabela_limite
  const tarefasAgrupadas = tarefas?.reduce((acc, tarefa) => {
    const key = `${tarefa.produto_id}-${tarefa.tabela_limite_id}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(tarefa);
    return acc;
  }, {} as Record<string, TarefaAjuste[]>) || {};

  // Mutation para aplicar tarefas
  const aplicarTarefasMutation = useMutation({
    mutationFn: async (tarefaIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      for (const tarefaId of tarefaIds) {
        const tarefa = tarefas?.find(t => t.id === tarefaId);
        if (!tarefa) continue;

        // Atualizar o preço na tabela de preços
        const { error: errorPreco } = await supabase
          .from("fabrica_precos_produtos")
          .update({ 
            preco_final: tarefa.preco_sugerido,
            updated_at: new Date().toISOString()
          })
          .eq("tabela_id", tarefa.tabela_id)
          .eq("produto_id", tarefa.produto_id)
          .eq("ativo", true);

        if (errorPreco) throw errorPreco;

        // Marcar tarefa como aplicada
        const { error: errorTarefa } = await supabase
          .from("fabrica_tarefas_ajuste_preco")
          .update({
            status: "aplicada",
            aplicada_por: user?.id,
            aplicada_em: new Date().toISOString(),
          })
          .eq("id", tarefaId);

        if (errorTarefa) throw errorTarefa;
      }
    },
    onSuccess: () => {
      toast.success("Tarefas aplicadas com sucesso! Preços atualizados.");
      queryClient.invalidateQueries({ queryKey: ["fabrica-tarefas-ajuste"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-precos"] });
      setDialogAplicarGrupo(false);
      setGrupoSelecionado([]);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao aplicar tarefas");
    },
  });

  // Mutation para rejeitar tarefa
  const rejeitarTarefaMutation = useMutation({
    mutationFn: async ({ tarefaId, motivo }: { tarefaId: string; motivo: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("fabrica_tarefas_ajuste_preco")
        .update({
          status: "rejeitada",
          rejeitada_por: user?.id,
          rejeitada_em: new Date().toISOString(),
          motivo_rejeicao: motivo,
        })
        .eq("id", tarefaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa rejeitada");
      queryClient.invalidateQueries({ queryKey: ["fabrica-tarefas-ajuste"] });
      setDialogRejeitar(false);
      setTarefaSelecionada(null);
      setMotivoRejeicao("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao rejeitar tarefa");
    },
  });

  const handleAplicarGrupo = (grupo: TarefaAjuste[]) => {
    setGrupoSelecionado(grupo);
    setDialogAplicarGrupo(true);
  };

  const handleRejeitar = (tarefa: TarefaAjuste) => {
    setTarefaSelecionada(tarefa);
    setDialogRejeitar(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case "aprovada":
        return <Badge className="bg-blue-500 gap-1"><Check className="h-3 w-3" /> Aprovada</Badge>;
      case "aplicada":
        return <Badge className="bg-green-600 gap-1"><Check className="h-3 w-3" /> Aplicada</Badge>;
      case "rejeitada":
        return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Rejeitada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const contadores = {
    pendente: tarefas?.filter(t => t.status === "pendente").length || 0,
    aplicada: tarefas?.filter(t => t.status === "aplicada").length || 0,
    rejeitada: tarefas?.filter(t => t.status === "rejeitada").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={filtroStatus === "pendente" ? "ring-2 ring-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contadores.pendente}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto text-xs"
              onClick={() => setFiltroStatus("pendente")}
            >
              Ver pendentes
            </Button>
          </CardContent>
        </Card>

        <Card className={filtroStatus === "aplicada" ? "ring-2 ring-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              Aplicadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contadores.aplicada}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto text-xs"
              onClick={() => setFiltroStatus("aplicada")}
            >
              Ver aplicadas
            </Button>
          </CardContent>
        </Card>

        <Card className={filtroStatus === "rejeitada" ? "ring-2 ring-primary" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <X className="h-4 w-4 text-destructive" />
              Rejeitadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contadores.rejeitada}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto text-xs"
              onClick={() => setFiltroStatus("rejeitada")}
            >
              Ver rejeitadas
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aplicada">Aplicadas</SelectItem>
            <SelectItem value="rejeitada">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Tarefas Agrupadas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(tarefasAgrupadas).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma tarefa de ajuste encontrada
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(tarefasAgrupadas).map(([key, grupo]) => {
            const primeiroItem = grupo[0];
            const todasPendentes = grupo.every(t => t.status === "pendente");
            
            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base">
                          {primeiroItem.produto?.nome || "Produto"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Código: {primeiroItem.produto?.codigo} • 
                          Limite em: {primeiroItem.tabela_limite?.nome}
                        </p>
                      </div>
                    </div>
                    {todasPendentes && (
                      <Button 
                        size="sm" 
                        onClick={() => handleAplicarGrupo(grupo)}
                        disabled={aplicarTarefasMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Aplicar Todos ({grupo.length})
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tabela</TableHead>
                        <TableHead className="text-right">Preço Atual</TableHead>
                        <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                        <TableHead className="text-right">Preço Sugerido</TableHead>
                        <TableHead className="text-right">Diferença</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo
                        .sort((a, b) => a.ordem_na_cadeia - b.ordem_na_cadeia)
                        .map((tarefa) => (
                          <TableRow key={tarefa.id}>
                            <TableCell className="font-medium">
                              {tarefa.tabela?.nome}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatarMoeda(tarefa.preco_atual)}
                            </TableCell>
                            <TableCell className="text-center">
                              <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                            </TableCell>
                            <TableCell className="text-right font-medium text-primary">
                              {formatarMoeda(tarefa.preco_sugerido)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={tarefa.diferenca_percentual < 0 ? "text-destructive" : "text-green-600"}>
                                {tarefa.diferenca_percentual > 0 ? "+" : ""}{tarefa.diferenca_percentual?.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {tarefa.margem_resultante != null ? (
                                <span className={tarefa.margem_resultante < 0 ? "text-destructive" : ""}>
                                  {tarefa.margem_resultante?.toFixed(1)}%
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(tarefa.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              {tarefa.status === "pendente" && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => aplicarTarefasMutation.mutate([tarefa.id])}
                                    disabled={aplicarTarefasMutation.isPending}
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleRejeitar(tarefa)}
                                  >
                                    <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de Rejeição */}
      <AlertDialog open={dialogRejeitar} onOpenChange={setDialogRejeitar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Tarefa de Ajuste</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da rejeição desta tarefa de ajuste de preço.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo da rejeição..."
            value={motivoRejeicao}
            onChange={(e) => setMotivoRejeicao(e.target.value)}
            className="min-h-24"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setTarefaSelecionada(null);
              setMotivoRejeicao("");
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tarefaSelecionada && rejeitarTarefaMutation.mutate({
                tarefaId: tarefaSelecionada.id,
                motivo: motivoRejeicao
              })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Aplicar Grupo */}
      <AlertDialog open={dialogAplicarGrupo} onOpenChange={setDialogAplicarGrupo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Aplicação de Ajustes
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está prestes a aplicar <strong>{grupoSelecionado.length}</strong> ajustes de preço.
                  Esta ação irá atualizar os preços nas seguintes tabelas:
                </p>
                <ul className="list-disc list-inside text-sm">
                  {grupoSelecionado.map(t => (
                    <li key={t.id}>
                      <strong>{t.tabela?.nome}</strong>: {formatarMoeda(t.preco_atual)} → {formatarMoeda(t.preco_sugerido)}
                    </li>
                  ))}
                </ul>
                <p className="text-amber-600 font-medium">
                  Atenção: Esta ação não pode ser desfeita automaticamente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGrupoSelecionado([])}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => aplicarTarefasMutation.mutate(grupoSelecionado.map(t => t.id))}
              disabled={aplicarTarefasMutation.isPending}
            >
              {aplicarTarefasMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Aplicando...
                </>
              ) : (
                "Aplicar Ajustes"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
