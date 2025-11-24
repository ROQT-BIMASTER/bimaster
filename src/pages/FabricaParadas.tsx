import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, StopCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { RegistrarParadaDialog } from "@/components/fabrica/RegistrarParadaDialog";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FabricaParadas() {
  const queryClient = useQueryClient();
  const [paradaDialogOpen, setParadaDialogOpen] = useState(false);

  // Buscar paradas ativas
  const { data: paradasAtivas, isLoading: loadingAtivas } = useQuery({
    queryKey: ["fabrica-paradas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_paradas")
        .select(`
          *,
          fabrica_ordens_producao(numero, fabrica_produtos(nome)),
          fabrica_motivos_parada(descricao, impacto_oee)
        `)
        .is("timestamp_fim", null)
        .order("timestamp_inicio", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Buscar histórico de paradas
  const { data: historico, isLoading: loadingHistorico } = useQuery({
    queryKey: ["fabrica-paradas-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_paradas")
        .select(`
          *,
          fabrica_ordens_producao(numero, fabrica_produtos(nome)),
          fabrica_motivos_parada(descricao, impacto_oee)
        `)
        .not("timestamp_fim", "is", null)
        .order("timestamp_fim", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const finalizarParada = useMutation({
    mutationFn: async (paradaId: string) => {
      const { data, error } = await supabase
        .from("fabrica_paradas")
        .update({ timestamp_fim: new Date().toISOString() })
        .eq("id", paradaId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-paradas-ativas"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-paradas-historico"] });
      toast.success("Parada finalizada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao finalizar parada");
    },
  });

  const formatDuracao = (inicio: string, fim?: string | null) => {
    const inicioDate = new Date(inicio);
    const fimDate = fim ? new Date(fim) : new Date();
    const duracaoMs = fimDate.getTime() - inicioDate.getTime();
    const horas = Math.floor(duracaoMs / (1000 * 60 * 60));
    const minutos = Math.floor((duracaoMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${horas}h ${minutos}min`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Paradas</h1>
            <p className="text-muted-foreground">
              Controle e monitore paradas de produção
            </p>
          </div>
          <Button onClick={() => setParadaDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar Parada
          </Button>
        </div>

        {/* Paradas Ativas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-destructive" />
              Paradas Ativas
            </CardTitle>
            <CardDescription>
              Paradas em andamento no momento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAtivas ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : paradasAtivas && paradasAtivas.length > 0 ? (
              <div className="space-y-3">
                {paradasAtivas.map((parada) => (
                  <div
                    key={parada.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-destructive/5"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        OP {parada.fabrica_ordens_producao?.numero} -{" "}
                        {parada.fabrica_ordens_producao?.fabrica_produtos?.nome}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {parada.fabrica_motivos_parada?.descricao}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs text-muted-foreground">
                          Iniciada{" "}
                          {formatDistanceToNow(new Date(parada.timestamp_inicio), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatDuracao(parada.timestamp_inicio)}
                        </div>
                        {parada.fabrica_motivos_parada?.impacto_oee && (
                          <Badge variant="destructive" className="mt-1">
                            Impacta OEE
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => finalizarParada.mutate(parada.id)}
                        disabled={finalizarParada.isPending}
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Retomar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma parada ativa no momento
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Paradas */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Paradas</CardTitle>
            <CardDescription>Últimas 50 paradas finalizadas</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistorico ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : historico && historico.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OP</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>OEE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((parada) => (
                      <TableRow key={parada.id}>
                        <TableCell className="font-medium">
                          {parada.fabrica_ordens_producao?.numero}
                        </TableCell>
                        <TableCell>
                          {parada.fabrica_motivos_parada?.descricao}
                        </TableCell>
                        <TableCell>
                          {format(new Date(parada.timestamp_inicio), "dd/MM/yy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {parada.timestamp_fim &&
                            format(new Date(parada.timestamp_fim), "dd/MM/yy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {formatDuracao(parada.timestamp_inicio, parada.timestamp_fim)}
                        </TableCell>
                        <TableCell>
                          {parada.fabrica_motivos_parada?.impacto_oee ? (
                            <Badge variant="destructive">Sim</Badge>
                          ) : (
                            <Badge variant="secondary">Não</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma parada registrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RegistrarParadaDialog
        open={paradaDialogOpen}
        onOpenChange={setParadaDialogOpen}
      />
    </DashboardLayout>
  );
}
