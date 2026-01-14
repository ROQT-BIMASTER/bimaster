import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Zap, Plus, Search, Play, Pause, Settings, 
  Clock, AlertTriangle, CheckCircle, ArrowRight,
  Trash2, MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Automation {
  id: string;
  nome: string;
  tipo_gatilho: string;
  condicoes: Record<string, unknown> | null;
  acoes: Record<string, unknown>[] | null;
  ativo: boolean;
  prioridade: number;
  created_at: string;
}

interface AutomationLog {
  id: string;
  automacao_id: string;
  executado_em: string;
  sucesso: boolean;
  erro_mensagem: string | null;
  dados_entrada: Record<string, unknown> | null;
  dados_saida: Record<string, unknown> | null;
  automacao: { nome: string } | null;
}

const gatilhoLabels: Record<string, string> = {
  status_change: 'Mudança de Status',
  sla_alert: 'Alerta de SLA',
  task_created: 'Tarefa Criada',
  task_completed: 'Tarefa Concluída',
  approval_needed: 'Aprovação Necessária',
  deadline_near: 'Prazo Próximo',
};

const gatilhoIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  status_change: ArrowRight,
  sla_alert: AlertTriangle,
  task_created: Plus,
  task_completed: CheckCircle,
  approval_needed: Clock,
  deadline_near: Clock,
};

export function AutomationsManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [automationToDelete, setAutomationToDelete] = useState<Automation | null>(null);
  const queryClient = useQueryClient();

  const { data: automations, isLoading } = useQuery({
    queryKey: ['marketing-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_automacoes')
        .select('*')
        .order('prioridade', { ascending: true });

      if (error) throw error;
      return data as Automation[];
    }
  });

  const { data: logs } = useQuery({
    queryKey: ['automation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_automacoes_log')
        .select(`
          *,
          automacao:marketing_automacoes(nome)
        `)
        .order('executado_em', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as AutomationLog[];
    }
  });

  const toggleAutomation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('marketing_automacoes')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-automations'] });
      toast.success('Automação atualizada');
    }
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_automacoes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-automations'] });
      toast.success('Automação excluída');
      setAutomationToDelete(null);
    }
  });

  const filteredAutomations = automations?.filter(a =>
    a.nome.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const activeCount = automations?.filter(a => a.ativo).length || 0;
  const successLogs = logs?.filter(l => l.sucesso).length || 0;
  const errorLogs = logs?.filter(l => !l.sucesso).length || 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{automations?.length || 0}</p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn(activeCount > 0 && "border-green-500/30")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold text-green-500">{activeCount}</p>
              </div>
              <Play className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Execuções OK</p>
                <p className="text-2xl font-bold text-green-500">{successLogs}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn(errorLogs > 0 && "border-red-500/30")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-2xl font-bold text-red-500">{errorLogs}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="automations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="automations">Automações</TabsTrigger>
          <TabsTrigger value="logs">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="automations" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar automações..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Automations List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-24" />
                </Card>
              ))}
            </div>
          ) : filteredAutomations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma automação encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredAutomations.map(automation => {
                const GatilhoIcon = gatilhoIcons[automation.tipo_gatilho] || Zap;
                
                return (
                  <Card 
                    key={automation.id}
                    className={cn(
                      "transition-all",
                      automation.ativo ? "border-green-500/30" : "opacity-60"
                    )}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-2 rounded-lg",
                            automation.ativo ? "bg-green-500/10" : "bg-muted"
                          )}>
                            <GatilhoIcon className={cn(
                              "h-5 w-5",
                              automation.ativo ? "text-green-500" : "text-muted-foreground"
                            )} />
                          </div>
                          
                          <div>
                            <h4 className="font-medium">{automation.nome}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px]">
                                {gatilhoLabels[automation.tipo_gatilho] || automation.tipo_gatilho}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Prioridade: {automation.prioridade}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {automation.ativo ? 'Ativa' : 'Inativa'}
                            </span>
                            <Switch
                              checked={automation.ativo}
                              onCheckedChange={(checked) => 
                                toggleAutomation.mutate({ id: automation.id, ativo: checked })
                              }
                            />
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Settings className="h-4 w-4 mr-2" />
                                Configurar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setAutomationToDelete(automation)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Execuções</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {!logs?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma execução registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map(log => (
                      <div 
                        key={log.id}
                        className={cn(
                          "p-3 rounded-lg border",
                          log.sucesso ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {log.sucesso ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium text-sm">
                              {log.automacao?.nome || 'Automação'}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.executado_em), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        </div>
                        
                        {log.erro_mensagem && (
                          <p className="text-sm text-red-500 mt-2">
                            {log.erro_mensagem}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!automationToDelete} onOpenChange={() => setAutomationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Automação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a automação "{automationToDelete?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground"
              onClick={() => automationToDelete && deleteAutomation.mutate(automationToDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
