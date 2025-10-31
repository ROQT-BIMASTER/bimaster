import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Edit2, Save, X } from "lucide-react";

interface PointsConfig {
  id: string;
  config_type: string;
  action_code: string;
  config_key: string | null;
  points_value: number;
  description: string;
  is_active: boolean;
}

export const GerenciamentoPontuacao = () => {
  const [configs, setConfigs] = useState<PointsConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("trade_points_config")
        .select("*")
        .order("config_type")
        .order("action_code");

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: PointsConfig) => {
    setEditingId(config.id);
    setEditValue(config.points_value);
  };

  const handleSave = async (id: string) => {
    try {
      const { error } = await supabase
        .from("trade_points_config")
        .update({ points_value: editValue })
        .eq("id", id);

      if (error) throw error;

      toast.success("Configuração atualizada");
      setEditingId(null);
      fetchConfigs();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao atualizar configuração");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue(0);
  };

  const basePoints = configs.filter(c => c.config_type === 'base_points');
  const multipliers = configs.filter(c => c.config_type === 'multiplier');

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pontos Base por Ação</CardTitle>
          <CardDescription>Configure os pontos básicos ganhos por cada ação</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {basePoints.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>{config.description}</TableCell>
                  <TableCell>
                    {editingId === config.id ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        className="w-24"
                      />
                    ) : (
                      <span className="font-semibold">{config.points_value}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === config.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(config.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancel}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(config)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Multiplicadores de Visita</CardTitle>
          <CardDescription>Configure os bônus percentuais para completude de visitas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requisito</TableHead>
                <TableHead>Bônus (%)</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {multipliers.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>{config.description}</TableCell>
                  <TableCell>
                    {editingId === config.id ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        className="w-24"
                      />
                    ) : (
                      <span className="font-semibold">+{config.points_value}%</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === config.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(config.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancel}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(config)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};