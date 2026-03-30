import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, CheckCircle2, AlertCircle, Info } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { permissionsCache } from "@/lib/utils/permissions-cache";

interface Tela {
  id: string;
  codigo: string;
  nome: string;
  rota: string;
  descricao: string;
  icone: string;
  ordem: number;
  permissoes: {
    gerente: boolean;
    supervisor: boolean;
    vendedor: boolean;
    promotor: boolean;
  };
}

const iconMap: Record<string, any> = {
  LayoutDashboard: LucideIcons.LayoutDashboard,
  Users: LucideIcons.Users,
  KanbanSquare: LucideIcons.KanbanSquare,
  Map: LucideIcons.Map,
  Activity: LucideIcons.Activity,
  CheckSquare: LucideIcons.CheckSquare,
  MessageSquare: LucideIcons.MessageSquare,
  MapPin: LucideIcons.MapPin,
  Upload: LucideIcons.Upload,
  Shield: LucideIcons.Shield,
  Clock: LucideIcons.Clock,
  Settings: LucideIcons.Settings,
  Trophy: LucideIcons.Trophy,
  TrendingUp: LucideIcons.TrendingUp,
  Store: LucideIcons.Store,
  Calendar: LucideIcons.Calendar,
  Camera: LucideIcons.Camera,
  Tag: LucideIcons.Tag,
  Brain: LucideIcons.Brain,
};

export function PermissoesDeAcesso() {
  const [telas, setTelas] = useState<Tela[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoadingData(true);
    try {
      const [{ data: telasData, error: telasError }, { data: rolePermissoes, error: permissoesError }] = await Promise.all([
        supabase.from("telas_sistema").select("*").eq("ativo", true).order("ordem"),
        supabase.from("role_permissoes_telas").select("role, tela_id"),
      ]);

      if (telasError) throw telasError;
      if (permissoesError) throw permissoesError;

      const telasComPermissoes: Tela[] = (telasData || []).map((tela) => ({
        id: tela.id,
        codigo: tela.codigo,
        nome: tela.nome,
        rota: tela.rota,
        descricao: tela.descricao || "",
        icone: tela.icone,
        ordem: tela.ordem,
        permissoes: {
          gerente: rolePermissoes?.some(p => p.tela_id === tela.id && p.role === 'gerente') || false,
          supervisor: rolePermissoes?.some(p => p.tela_id === tela.id && p.role === 'supervisor') || false,
          vendedor: rolePermissoes?.some(p => p.tela_id === tela.id && p.role === 'vendedor') || false,
          promotor: rolePermissoes?.some(p => p.tela_id === tela.id && p.role === 'promotor') || false,
        },
      }));

      setTelas(telasComPermissoes);
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
      toast({ title: "Erro", description: "Não foi possível carregar as permissões", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const handlePermissionChange = (telaId: string, role: "gerente" | "supervisor" | "vendedor" | "promotor") => {
    setTelas(prev => prev.map(tela => 
      tela.id === telaId 
        ? { ...tela, permissoes: { ...tela.permissoes, [role]: !tela.permissoes[role] } }
        : tela
    ));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      for (const role of ['gerente', 'supervisor', 'vendedor', 'promotor'] as const) {
        await supabase.from("role_permissoes_telas").delete().eq("role", role);

        const permissoesParaInserir = telas
          .filter(tela => tela.permissoes[role])
          .map(tela => ({ role, tela_id: tela.id }));

        if (permissoesParaInserir.length > 0) {
          const { error } = await supabase.from("role_permissoes_telas").insert(permissoesParaInserir);
          if (error) throw error;
        }
      }

      permissionsCache.clear();
      window.dispatchEvent(new Event('permissions-updated'));

      toast({ title: "Sucesso", description: "Permissões por role salvas com sucesso." });
      await loadPermissions();
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      toast({ title: "Erro", description: "Não foi possível salvar as permissões", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <CardTitle>Permissões de Telas por Role</CardTitle>
        </div>
        <CardDescription>
          Defina quais telas cada tipo de usuário (role) pode acessar. Admins têm acesso total automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Como funciona:</strong> Estas são as permissões <strong>base</strong> por função. 
            Usuários sem permissões individuais herdam estas configurações automaticamente. 
            Se um usuário tiver permissões individuais configuradas (na aba "Telas por Usuário"), 
            elas <strong>substituem completamente</strong> estas permissões do role.
          </AlertDescription>
        </Alert>

        {loadingData ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Carregando permissões...</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Tela</th>
                    <th className="text-center p-4 font-medium w-32">
                      <div className="flex flex-col items-center gap-1">
                        <span>Admin</span>
                        <Badge variant="default" className="text-xs">Acesso Total</Badge>
                      </div>
                    </th>
                    <th className="text-center p-4 font-medium w-28">Gerente</th>
                    <th className="text-center p-4 font-medium w-28">Supervisor</th>
                    <th className="text-center p-4 font-medium w-28">Vendedor</th>
                    <th className="text-center p-4 font-medium w-28">Promotor</th>
                  </tr>
                </thead>
                <tbody>
                  {telas.map((tela) => {
                    const IconComponent = iconMap[tela.icone] || Shield;
                    return (
                      <tr key={tela.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <IconComponent className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{tela.nome}</p>
                              <p className="text-xs text-muted-foreground">{tela.rota}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-center p-4">
                          <div className="flex justify-center">
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          </div>
                        </td>
                        <td className="text-center p-4">
                          <Checkbox checked={tela.permissoes.gerente} onCheckedChange={() => handlePermissionChange(tela.id, 'gerente')} className="mx-auto" />
                        </td>
                        <td className="text-center p-4">
                          <Checkbox checked={tela.permissoes.supervisor} onCheckedChange={() => handlePermissionChange(tela.id, 'supervisor')} className="mx-auto" />
                        </td>
                        <td className="text-center p-4">
                          <Checkbox checked={tela.permissoes.vendedor} onCheckedChange={() => handlePermissionChange(tela.id, 'vendedor')} className="mx-auto" />
                        </td>
                        <td className="text-center p-4">
                          <Checkbox checked={tela.permissoes.promotor} onCheckedChange={() => handlePermissionChange(tela.id, 'promotor')} className="mx-auto" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Salvar Permissões por Role
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
