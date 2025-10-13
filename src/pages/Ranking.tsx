import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, MapPin, Award } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface RankingVendedor {
  id: string;
  nome: string;
  total_prospects: number;
  prospects_ganhos: number;
  prospects_em_negociacao: number;
  taxa_conversao: number;
}

interface RankingMunicipio {
  id: string;
  nome: string;
  uf: string;
  total_prospects: number;
  prospects_ganhos: number;
  vendedor_nome?: string;
}

interface RankingSupervisor {
  id: string;
  nome: string;
  total_vendedores: number;
  total_prospects: number;
  prospects_ganhos: number;
  taxa_conversao: number;
}

const Ranking = () => {
  const [rankingVendedores, setRankingVendedores] = useState<RankingVendedor[]>([]);
  const [rankingMunicipios, setRankingMunicipios] = useState<RankingMunicipio[]>([]);
  const [rankingSupervisores, setRankingSupervisores] = useState<RankingSupervisor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      // Buscar todos os profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome");

      if (!profilesData) {
        setRankingVendedores([]);
        setRankingSupervisores([]);
        setLoading(false);
        return;
      }

      // Buscar roles separadamente
      const profileIds = profilesData.map(p => p.id);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profileIds);

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

      // Buscar prospects para cada vendedor
      const { data: prospectsData } = await supabase
        .from("prospects")
        .select("id, status, vendedor_id")
        .not("vendedor_id", "is", null);

      // Agrupar prospects por vendedor
      const prospectsMap = new Map<string, any[]>();
      prospectsData?.forEach(p => {
        if (!prospectsMap.has(p.vendedor_id!)) {
          prospectsMap.set(p.vendedor_id!, []);
        }
        prospectsMap.get(p.vendedor_id!)!.push(p);
      });

      // Criar ranking de vendedores
      const vendedores = profilesData
        .filter(v => rolesMap.get(v.id) === 'vendedor')
        .map(v => {
          const prospects = prospectsMap.get(v.id) || [];
          const total = prospects.length;
          const ganhos = prospects.filter(p => p.status === 'ganho').length;
          const negociacao = prospects.filter(p => p.status === 'negociacao').length;
          return {
            id: v.id,
            nome: v.nome,
            total_prospects: total,
            prospects_ganhos: ganhos,
            prospects_em_negociacao: negociacao,
            taxa_conversao: total > 0 ? (ganhos / total) * 100 : 0
          };
        })
        .sort((a, b) => b.prospects_ganhos - a.prospects_ganhos);

      setRankingVendedores(vendedores);

      // Ranking de Municípios
      const { data: municipiosData } = await supabase
        .from("municipios")
        .select("id, nome, uf, vendedor_id");

      const { data: allProspects } = await supabase
        .from("prospects")
        .select("id, status, municipio_id")
        .not("municipio_id", "is", null);

      const prospectsByMunicipio = new Map<string, any[]>();
      allProspects?.forEach(p => {
        if (!prospectsByMunicipio.has(p.municipio_id!)) {
          prospectsByMunicipio.set(p.municipio_id!, []);
        }
        prospectsByMunicipio.get(p.municipio_id!)!.push(p);
      });

      const municipios = municipiosData
        ?.map(m => {
          const vendedor = profilesData.find(p => p.id === m.vendedor_id);
          const prospects = prospectsByMunicipio.get(m.id) || [];
          const total = prospects.length;
          const ganhos = prospects.filter(p => p.status === 'ganho').length;
          return {
            id: m.id,
            nome: m.nome,
            uf: m.uf,
            vendedor_nome: vendedor?.nome,
            total_prospects: total,
            prospects_ganhos: ganhos
          };
        })
        .sort((a: any, b: any) => b.total_prospects - a.total_prospects) || [];

      setRankingMunicipios(municipios);

      // Ranking de Supervisores
      const supervisores = profilesData
        .filter(s => rolesMap.get(s.id) === 'supervisor')
        .map(s => {
          // Buscar vendedores supervisionados
          const vendedoresSupervisionados = profilesData.filter(v => 
            rolesMap.get(v.id) === 'vendedor' && 
            prospectsData?.some(p => p.vendedor_id === v.id)
          );

          // Buscar prospects dos vendedores supervisionados  
          const vendedorIds = vendedoresSupervisionados.map(v => v.id);
          const todosProspects = prospectsData?.filter(p => 
            p.vendedor_id && vendedorIds.includes(p.vendedor_id)
          ) || [];
          
          const total = todosProspects.length;
          const ganhos = todosProspects.filter(p => p.status === 'ganho').length;

          return {
            id: s.id,
            nome: s.nome,
            total_vendedores: vendedoresSupervisionados.length,
            total_prospects: total,
            prospects_ganhos: ganhos,
            taxa_conversao: total > 0 ? (ganhos / total) * 100 : 0
          };
        })
        .sort((a, b) => b.prospects_ganhos - a.prospects_ganhos);

      setRankingSupervisores(supervisores);
    } catch (error) {
      console.error("Erro ao carregar rankings:", error);
    } finally {
      setLoading(false);
    }
  };

  const chartDataVendedores = rankingVendedores.slice(0, 10).map(v => ({
    nome: v.nome.split(' ')[0],
    ganhos: v.prospects_ganhos,
    total: v.total_prospects
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Ranking de Desempenho</h2>
            <p className="text-muted-foreground">Acompanhe o desempenho de vendedores, municípios e supervisores</p>
          </div>
        </div>

        <Tabs defaultValue="vendedores" className="space-y-4">
          <TabsList>
            <TabsTrigger value="vendedores" className="gap-2">
              <Users className="h-4 w-4" />
              Vendedores
            </TabsTrigger>
            <TabsTrigger value="municipios" className="gap-2">
              <MapPin className="h-4 w-4" />
              Municípios
            </TabsTrigger>
            <TabsTrigger value="supervisores" className="gap-2">
              <Award className="h-4 w-4" />
              Supervisores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendedores" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Vendedores - Prospects Ganhos</CardTitle>
                  <CardDescription>Comparativo entre total e ganhos</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartDataVendedores}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="ganhos" fill="hsl(var(--primary))" name="Ganhos" />
                      <Bar dataKey="total" fill="hsl(var(--muted))" name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking Completo</CardTitle>
                  <CardDescription>Todos os vendedores ordenados por ganhos</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Ganhos</TableHead>
                        <TableHead className="text-center">Taxa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankingVendedores.map((v, index) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-bold">
                            {index === 0 && "🥇"}
                            {index === 1 && "🥈"}
                            {index === 2 && "🥉"}
                            {index > 2 && `${index + 1}º`}
                          </TableCell>
                          <TableCell className="font-medium">{v.nome}</TableCell>
                          <TableCell className="text-center">{v.total_prospects}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="default">{v.prospects_ganhos}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {v.taxa_conversao.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="municipios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ranking de Municípios</CardTitle>
                <CardDescription>Ordenado por quantidade total de prospects</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Ganhos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingMunicipios.map((m, index) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-bold">{index + 1}º</TableCell>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell>{m.uf}</TableCell>
                        <TableCell>{m.vendedor_nome || "-"}</TableCell>
                        <TableCell className="text-center">{m.total_prospects}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default">{m.prospects_ganhos}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="supervisores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ranking de Supervisores</CardTitle>
                <CardDescription>Desempenho consolidado da equipe</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead className="text-center">Vendedores</TableHead>
                      <TableHead className="text-center">Total Prospects</TableHead>
                      <TableHead className="text-center">Ganhos</TableHead>
                      <TableHead className="text-center">Taxa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingSupervisores.map((s, index) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-bold">
                          {index === 0 && "🥇"}
                          {index === 1 && "🥈"}
                          {index === 2 && "🥉"}
                          {index > 2 && `${index + 1}º`}
                        </TableCell>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell className="text-center">{s.total_vendedores}</TableCell>
                        <TableCell className="text-center">{s.total_prospects}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default">{s.prospects_ganhos}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {s.taxa_conversao.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Ranking;
