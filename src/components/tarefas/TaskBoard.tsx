import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { format, isToday, isFuture, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditarAtividadeDialog } from "@/components/atividades/EditarAtividadeDialog";

interface Atividade {
  id: string;
  descricao: string;
  tipo: string;
  resultado: string | null;
  data_atividade: string;
  proximo_followup: string | null;
  prospect_id: string;
  prospects?: {
    nome_empresa: string;
  };
}

const tipoIcons: Record<string, string> = {
  ligacao: "📞",
  email: "📧",
  reuniao: "👥",
  visita: "🏢",
};

const tipoLabels: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
  visita: "Visita",
};

export const TaskBoard = () => {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoAtividade, setEditandoAtividade] = useState<Atividade | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAtividades();
  }, []);

  const fetchAtividades = async () => {
    try {
      const { data, error } = await supabase
        .from("atividades")
        .select(`
          *,
          prospects (
            nome_empresa
          )
        `)
        .order("data_atividade", { ascending: false });

      if (error) throw error;
      setAtividades(data || []);
    } catch (error) {
      console.error("Erro ao carregar atividades:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as atividades",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirEdicao = (atividade: Atividade) => {
    setEditandoAtividade(atividade);
    setDialogAberto(true);
  };

  const getPriorityColor = (atividade: Atividade) => {
    if (atividade.proximo_followup) {
      const followupDate = new Date(atividade.proximo_followup);
      if (isPast(followupDate) && !isToday(followupDate)) {
        return "border-l-4 border-l-destructive";
      }
      if (isToday(followupDate)) {
        return "border-l-4 border-l-warning";
      }
    }
    return "border-l-4 border-l-muted";
  };

  const getStatusIcon = (resultado: string | null) => {
    switch (resultado) {
      case "positivo":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "negativo":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const agruparPorStatus = () => {
    const pendentes = atividades.filter(a => !a.resultado);
    const concluidas = atividades.filter(a => a.resultado === "positivo");
    const outras = atividades.filter(a => a.resultado && a.resultado !== "positivo");

    return { pendentes, concluidas, outras };
  };

  const { pendentes, concluidas, outras } = agruparPorStatus();

  const TaskColumn = ({ title, tasks, icon }: { title: string; tasks: Atividade[]; icon: React.ReactNode }) => (
    <Card className="flex-1 min-w-[300px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto">
            {tasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
        {tasks.map((atividade) => (
          <Card 
            key={atividade.id} 
            className={`hover:shadow-md transition-all cursor-pointer ${getPriorityColor(atividade)}`}
            onClick={() => handleAbrirEdicao(atividade)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{tipoIcons[atividade.tipo]}</span>
                      <Badge variant="outline" className="text-xs">
                        {tipoLabels[atividade.tipo]}
                      </Badge>
                      {getStatusIcon(atividade.resultado)}
                    </div>
                    <p className="text-sm font-medium line-clamp-2">
                      {atividade.descricao}
                    </p>
                  </div>
                </div>

                {atividade.prospects && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">
                      {atividade.prospects.nome_empresa}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(atividade.data_atividade), "dd MMM", { locale: ptBR })}
                  </div>
                  {atividade.proximo_followup && (
                    <div className="flex items-center gap-1 text-primary">
                      <Clock className="h-3 w-3" />
                      {format(new Date(atividade.proximo_followup), "dd MMM", { locale: ptBR })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma tarefa nesta coluna
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-2 text-sm text-muted-foreground">Carregando tarefas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-4">
        <TaskColumn
          title="Pendentes"
          tasks={pendentes}
          icon={<Circle className="h-5 w-5 text-muted-foreground" />}
        />
        <TaskColumn
          title="Concluídas"
          tasks={concluidas}
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
        />
        <TaskColumn
          title="Outras"
          tasks={outras}
          icon={<AlertCircle className="h-5 w-5 text-warning" />}
        />
      </div>

      <EditarAtividadeDialog
        atividade={editandoAtividade}
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSuccess={fetchAtividades}
      />
    </div>
  );
};
