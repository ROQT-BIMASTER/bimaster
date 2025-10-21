import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ExportControls } from "./ExportControls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const RelatorioConcorrentes = () => {
  const [data, setData] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: competitorsData } = await supabase
        .from('competitors')
        .select('*')
        .eq('active', true);

      const { data: photosData } = await supabase
        .from('competitor_comparison_photos')
        .select('competitor_id, store_id');

      const competitorStats = competitorsData?.map(comp => {
        const photoCount = photosData?.filter(p => p.competitor_id === comp.id).length || 0;
        return {
          ...comp,
          photoCount,
          storeCount: new Set(photosData?.filter(p => p.competitor_id === comp.id).map(p => p.store_id)).size
        };
      }) || [];

      setCompetitors(competitorStats);

      const pieData = competitorStats.map(comp => ({
        name: comp.name,
        value: comp.photoCount
      }));

      setData(pieData);
    } catch (error) {
      console.error('Error fetching competitors data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const getThreatBadge = (level: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'baixa': 'secondary',
      'media': 'default',
      'alta': 'destructive'
    };
    return <Badge variant={variants[level] || 'outline'}>{level}</Badge>;
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Relatório de Concorrentes</CardTitle>
              <CardDescription>Análise de inteligência competitiva</CardDescription>
            </div>
            <ExportControls reportType="concorrentes" data={competitors} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium mb-4">Distribuição de Análises</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-4">Detalhamento por Concorrente</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concorrente</TableHead>
                    <TableHead>Ameaça</TableHead>
                    <TableHead className="text-right">PDVs</TableHead>
                    <TableHead className="text-right">Análises</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitors.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.name}</TableCell>
                      <TableCell>{getThreatBadge(comp.threat_level)}</TableCell>
                      <TableCell className="text-right">{comp.storeCount}</TableCell>
                      <TableCell className="text-right">{comp.photoCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
