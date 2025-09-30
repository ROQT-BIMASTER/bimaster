import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { NovaAtividadeDialog } from "@/components/atividades/NovaAtividadeDialog";

interface Atividade {
  id: string;
  descricao: string;
  tipo: string;
  resultado: string | null;
  data_atividade: string;
  proximo_followup: string | null;
  prospect_id: string;
}

const tipoColors: Record<string, string> = {
  ligacao: "bg-blue-500",
  email: "bg-purple-500",
  reuniao: "bg-green-500",
  visita: "bg-orange-500",
};

const resultadoColors: Record<string, string> = {
  positivo: "bg-green-500",
  neutro: "bg-yellow-500",
  negativo: "bg-red-500",
};

const Atividades = () => {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAtividades();
  }, []);

  const fetchAtividades = async () => {
    try {
      const { data, error } = await supabase
        .from("atividades")
        .select("*")
        .order("data_atividade", { ascending: false })
        .limit(50);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Atividades</h2>
            <p className="text-muted-foreground">Histórico de atividades e interações</p>
          </div>
          <NovaAtividadeDialog onSuccess={fetchAtividades} />
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8">Carregando atividades...</div>
            ) : atividades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma atividade registrada
              </div>
            ) : (
              <div className="space-y-4">
                {atividades.map((atividade) => (
                  <Card key={atividade.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={tipoColors[atividade.tipo]}>
                              {atividade.tipo}
                            </Badge>
                            {atividade.resultado && (
                              <Badge className={resultadoColors[atividade.resultado]}>
                                {atividade.resultado}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{atividade.descricao}</p>
                          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                            <span>
                              📅 {new Date(atividade.data_atividade).toLocaleDateString()}
                            </span>
                            {atividade.proximo_followup && (
                              <span>
                                🔔 Próximo follow-up: {new Date(atividade.proximo_followup).toLocaleDateString()}
                              </span>
                            )}
                          </div>
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
    </DashboardLayout>
  );
};

export default Atividades;
