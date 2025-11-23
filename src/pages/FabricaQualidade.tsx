import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, XCircle, AlertTriangle, FileCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NovaInspecaoDialog from "@/components/fabrica/NovaInspecaoDialog";
import NovoPlanoInspecaoDialog from "@/components/fabrica/NovoPlanoInspecaoDialog";

export default function FabricaQualidade() {
  const [inspecaoDialogOpen, setInspecaoDialogOpen] = useState(false);
  const [planoDialogOpen, setPlanoDialogOpen] = useState(false);

  // Buscar planos de inspeção
  const { data: planos, isLoading: loadingPlanos } = useQuery({
    queryKey: ["planos-inspecao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_planos_inspecao")
        .select(`
          *,
          fabrica_produtos(nome, codigo)
        `)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Buscar inspeções recentes
  const { data: inspecoes, isLoading: loadingInspecoes } = useQuery({
    queryKey: ["inspecoes-qualidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_inspecoes_qualidade")
        .select(`
          *,
          fabrica_lotes(codigo_lote),
          fabrica_planos_inspecao(nome),
          profiles!fabrica_inspecoes_qualidade_inspetor_id_fkey(nome)
        `)
        .order("data_inspecao", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Buscar não conformidades abertas
  const { data: naoConformidades, isLoading: loadingNC } = useQuery({
    queryKey: ["nao-conformidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_nao_conformidades")
        .select(`
          *,
          fabrica_inspecoes_qualidade(resultado),
          profiles!fabrica_nao_conformidades_detectado_por_fkey(nome)
        `)
        .in("status", ["aberta", "em_analise"])
        .order("detectado_em", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getResultadoBadge = (resultado: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline", icon: any }> = {
      aprovado: { variant: "default", icon: CheckCircle2 },
      reprovado: { variant: "destructive", icon: XCircle },
      quarentena: { variant: "secondary", icon: AlertTriangle },
      condicional: { variant: "outline", icon: AlertTriangle },
    };

    const config = variants[resultado] || variants.condicional;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {resultado}
      </Badge>
    );
  };

  const getGravidadeBadge = (gravidade: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      critica: "destructive",
      maior: "default",
      menor: "secondary",
    };

    return <Badge variant={variants[gravidade] || "secondary"}>{gravidade}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Controle de Qualidade</h1>
            <p className="text-muted-foreground">
              Gestão de inspeções, planos e não conformidades
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inspeções Hoje</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inspecoes?.filter(
                  (i) =>
                    format(new Date(i.data_inspecao), "yyyy-MM-dd") ===
                    format(new Date(), "yyyy-MM-dd")
                ).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa Aprovação</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inspecoes && inspecoes.length > 0
                  ? (
                      (inspecoes.filter((i) => i.resultado === "aprovado").length /
                        inspecoes.length) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">NCs Abertas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{naoConformidades?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{planos?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inspecoes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inspecoes">Inspeções</TabsTrigger>
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="ncs">Não Conformidades</TabsTrigger>
          </TabsList>

          <TabsContent value="inspecoes" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setInspecaoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Inspeção
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Inspeções Recentes</CardTitle>
                <CardDescription>Últimas 50 inspeções realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingInspecoes ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Inspetor</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead className="text-right">Conformidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inspecoes?.map((inspecao) => (
                        <TableRow key={inspecao.id}>
                          <TableCell>
                            {format(new Date(inspecao.data_inspecao), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>{inspecao.fabrica_lotes?.codigo_lote || "N/A"}</TableCell>
                          <TableCell>{inspecao.fabrica_planos_inspecao?.nome}</TableCell>
                          <TableCell>{inspecao.profiles?.nome}</TableCell>
                          <TableCell>{getResultadoBadge(inspecao.resultado)}</TableCell>
                          <TableCell className="text-right">
                            {inspecao.indice_conformidade
                              ? `${inspecao.indice_conformidade.toFixed(1)}%`
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!inspecoes || inspecoes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhuma inspeção registrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="planos" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setPlanoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loadingPlanos && <div className="col-span-full text-center py-8">Carregando...</div>}
              {planos?.map((plano) => (
                <Card key={plano.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{plano.nome}</CardTitle>
                    <CardDescription>{plano.fabrica_produtos?.nome}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tipo:</span>
                      <Badge variant="outline">{plano.tipo_inspecao}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frequência:</span>
                      <span>{plano.frequencia || "N/A"}</span>
                    </div>
                    {plano.tamanho_amostra && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Amostra:</span>
                        <span>{plano.tamanho_amostra} un</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {!loadingPlanos && (!planos || planos.length === 0) && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum plano de inspeção cadastrado
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ncs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Não Conformidades Abertas</CardTitle>
                <CardDescription>
                  NCs pendentes de análise ou resolução
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingNC ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Gravidade</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Detectado por</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {naoConformidades?.map((nc) => (
                        <TableRow key={nc.id}>
                          <TableCell>
                            {format(new Date(nc.detectado_em), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{nc.tipo}</Badge>
                          </TableCell>
                          <TableCell>{getGravidadeBadge(nc.gravidade)}</TableCell>
                          <TableCell className="max-w-md truncate">
                            {nc.descricao}
                          </TableCell>
                          <TableCell>{nc.profiles?.nome}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{nc.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!naoConformidades || naoConformidades.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhuma não conformidade aberta
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <NovaInspecaoDialog open={inspecaoDialogOpen} onClose={() => setInspecaoDialogOpen(false)} />
      <NovoPlanoInspecaoDialog open={planoDialogOpen} onClose={() => setPlanoDialogOpen(false)} />
    </DashboardLayout>
  );
}
