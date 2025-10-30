import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Tela {
  id: string;
  codigo: string;
  nome: string;
  rota: string;
  descricao: string;
  icone: string;
  ordem: number;
  permissoes: {
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
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoadingData(true);
    try {
      // Buscar todas as telas
      const { data: telasData, error: telasError } = await supabase
        .from("telas_sistema")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      if (telasError) throw telasError;

      // Buscar permissões por role
      const { data: rolePermissoes, error: permissoesError } = await supabase
        .from("role_permissoes_telas")
        .select("role, tela_id");

      if (permissoesError) throw permissoesError;

      // Mapear permissões para cada tela
      const telasComPermissoes: Tela[] = (telasData || []).map((tela) => ({
        id: tela.id,
        codigo: tela.codigo,
        nome: tela.nome,
        rota: tela.rota,
        descricao: tela.descricao || "",
        icone: tela.icone,
        ordem: tela.ordem,
        permissoes: {
          supervisor: rolePermissoes?.some(p => p.tela_id === tela.id && p.role === 'supervisor') || false,
          vendedor: rolePermissoes?.some(p => p.tela_id === tela.id && p.role === 'vendedor') || false,
          promotor: rolePermissoes?.some(p => p.tela_id === tela.id && p.role === 'promotor') || false,
        },
      }));

      setTelas(telasComPermissoes);
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as permissões",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handlePermissionChange = (telaId: string, role: "supervisor" | "vendedor" | "promotor") => {
    setTelas(prev => prev.map(tela => 
      tela.id === telaId 
        ? { ...tela, permissoes: { ...tela.permissoes, [role]: !tela.permissoes[role] } }
        : tela
    ));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Para cada role, deletar e recriar as permissões
      for (const role of ['supervisor', 'vendedor', 'promotor'] as const) {
        // Deletar permissões existentes do role
        await supabase
          .from("role_permissoes_telas")
          .delete()
          .eq("role", role);

        // Inserir novas permissões
        const permissoesParaInserir = telas
          .filter(tela => tela.permissoes[role])
          .map(tela => ({
            role,
            tela_id: tela.id,
          }));

        if (permissoesParaInserir.length > 0) {
          const { error } = await supabase
            .from("role_permissoes_telas")
            .insert(permissoesParaInserir);

          if (error) throw error;
        }
      }

      toast({
        title: "Sucesso",
        description: "Permissões por role salvas. Clique em 'Sincronizar' para aplicar aos usuários.",
      });

      await loadPermissions();
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as permissões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Sincronizar permissões de todos os usuários não-admin
      const { data: users } = await supabase
        .from("user_roles")
        .select("user_id")
        .neq("role", "admin");

      if (users && users.length > 0) {
        let syncCount = 0;
        for (const user of users) {
          const { error } = await supabase.rpc("sincronizar_permissoes_usuario", {
            p_user_id: user.user_id,
          });
          if (!error) syncCount++;
        }

        toast({
          title: "Sincronização concluída",
          description: `${syncCount} usuários tiveram suas permissões atualizadas`,
        });
      } else {
        toast({
          title: "Nenhum usuário",
          description: "Não há usuários para sincronizar",
        });
      }
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível sincronizar as permissões",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <CardTitle>Permissões de Acesso por Role</CardTitle>
        </div>
        <CardDescription>
          Defina quais telas cada tipo de usuário (role) pode acessar. Admins têm acesso total automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Como funciona:</strong> Configure aqui as permissões padrão por role (Supervisor/Vendedor/Promotor). Depois salve e clique em "Sincronizar" para aplicar aos usuários existentes.
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
                        <Badge variant="default" className="text-xs">
                          Acesso Total
                        </Badge>
                      </div>
                    </th>
                    <th className="text-center p-4 font-medium w-32">
                      Supervisor
                    </th>
                    <th className="text-center p-4 font-medium w-32">
                      Vendedor
                    </th>
                    <th className="text-center p-4 font-medium w-32">
                      Promotor
                    </th>
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
                          <Checkbox
                            checked={tela.permissoes.supervisor}
                            onCheckedChange={() => handlePermissionChange(tela.id, 'supervisor')}
                            className="mx-auto"
                          />
                        </td>
                        <td className="text-center p-4">
                          <Checkbox
                            checked={tela.permissoes.vendedor}
                            onCheckedChange={() => handlePermissionChange(tela.id, 'vendedor')}
                            className="mx-auto"
                          />
                        </td>
                        <td className="text-center p-4">
                          <Checkbox
                            checked={tela.permissoes.promotor}
                            onCheckedChange={() => handlePermissionChange(tela.id, 'promotor')}
                            className="mx-auto"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={loading || syncing}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Salvar Permissões
              </Button>
              <Button
                onClick={handleSync}
                disabled={loading || syncing}
                variant="secondary"
                className="flex-1"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sincronizar com Usuários
              </Button>
            </div>
            
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Fluxo:</strong> 1️⃣ Ajuste as permissões acima → 2️⃣ Clique em "Salvar" → 3️⃣ Clique em "Sincronizar" para aplicar a todos os usuários com esse role. Você também pode personalizar permissões individuais na aba "Gerenciar Usuários".
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
