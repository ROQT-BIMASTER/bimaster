import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Atividade {
  id: string;
  tipo: string;
  descricao: string;
  data_atividade: string;
  resultado: string | null;
  proximo_followup: string | null;
}

const Atividades = () => {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  const getTipoBadge = (tipo: string) => {
    const tipoMap: { [key: string]: { label: string; variant: "default" | "secondary" | "outline" } } = {
      ligacao: { label: "Ligação", variant: "default" },
      email: { label: "Email", variant: "secondary" },
      reuniao: { label: "Reunião", variant: "outline" },
      visita: { label: "Visita", variant: "default" },
      proposta: { label: "Proposta", variant: "secondary" },
    };

    const tipoInfo = tipoMap[tipo] || { label: tipo, variant: "outline" as const };
    return <Badge variant={tipoInfo.variant}>{tipoInfo.label}</Badge>;
  };

  const getResultadoBadge = (resultado: string | null) => {
    if (!resultado) return <Badge variant="outline">Sem resultado</Badge>;
    
    const resultadoMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" } } = {
      positivo: { label: "Positivo", variant: "default" },
      neutro: { label: "Neutro", variant: "secondary" },
      negativo: { label: "Negativo", variant: "destructive" },
    };

    const resultadoInfo = resultadoMap[resultado] || { label: resultado, variant: "secondary" as const };
    return <Badge variant={resultadoInfo.variant}>{resultadoInfo.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Atividades</h2>
            <p className="text-muted-foreground">Histórico de interações e follow-ups</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Atividade
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Últimas Atividades</CardTitle>
            <CardDescription>Histórico das últimas 50 atividades registradas</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando atividades...</div>
            ) : atividades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma atividade registrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Próximo Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atividades.map((atividade) => (
                    <TableRow key={atividade.id}>
                      <TableCell>
                        {new Date(atividade.data_atividade).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>{getTipoBadge(atividade.tipo)}</TableCell>
                      <TableCell className="max-w-xs truncate">{atividade.descricao}</TableCell>
                      <TableCell>{getResultadoBadge(atividade.resultado)}</TableCell>
                      <TableCell>
                        {atividade.proximo_followup
                          ? new Date(atividade.proximo_followup).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Atividades;
