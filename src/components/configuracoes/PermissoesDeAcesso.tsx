import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Calendar, 
  CheckSquare, 
  MessageSquare,
  FileText,
  Upload,
  ShieldCheck,
  Store,
  Camera,
  Tag,
  Brain,
  TrendingUp
} from "lucide-react";

interface RoutePermission {
  id: string;
  route: string;
  name: string;
  icon: any;
  admin: boolean;
  supervisor: boolean;
  vendedor: boolean;
}

// Mapeamento de ícones por nome
const iconMap: Record<string, any> = {
  LayoutDashboard,
  Users,
  MapPin,
  Calendar,
  CheckSquare,
  MessageSquare,
  FileText,
  Upload,
  ShieldCheck,
  Store,
  Camera,
  Tag,
  Brain,
  TrendingUp,
};

export function PermissoesDeAcesso() {
  const [permissions, setPermissions] = useState<RoutePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoadingData(true);
    try {
      // Buscar todas as telas do sistema
      const { data: telas, error } = await supabase
        .from("telas_sistema")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      if (error) throw error;

      // SEGURANÇA: Não usar localStorage - sempre usar padrões
      const mappedPermissions: RoutePermission[] = (telas || []).map((tela) => {
        return {
          id: tela.id,
          route: tela.rota,
          name: tela.nome,
          icon: iconMap[tela.icone] || FileText,
          admin: true,
          supervisor: true,
          vendedor: true,
        };
      });

      setPermissions(mappedPermissions);
      
      // Aviso sobre segurança
      toast({
        title: "Aviso de Segurança",
        description: "Esta funcionalidade foi desativada. Use 'Gerenciar Permissões de Telas' para controlar acesso via banco de dados.",
        variant: "default",
      });
    } catch (error) {
      console.error('Erro ao carregar telas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as telas do sistema",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handlePermissionChange = (routeIndex: number, userType: 'admin' | 'supervisor' | 'vendedor', value: boolean) => {
    const newPermissions = [...permissions];
    newPermissions[routeIndex][userType] = value;
    setPermissions(newPermissions);
  };

  const handleSave = async () => {
    toast({
      title: "Funcionalidade Desativada",
      description: "Por segurança, use 'Gerenciar Permissões de Telas' para gerenciar permissões via banco de dados.",
      variant: "destructive",
    });
  };

  const handleReset = () => {
    toast({
      title: "Funcionalidade Desativada",
      description: "Por segurança, use 'Gerenciar Permissões de Telas' para gerenciar permissões via banco de dados.",
      variant: "destructive",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissões de Acesso às Telas</CardTitle>
        <CardDescription>
          Defina quais telas cada tipo de usuário pode acessar no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadingData ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando telas do sistema...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Tela</th>
                    <th className="text-center py-3 px-4 font-semibold">Admin</th>
                    <th className="text-center py-3 px-4 font-semibold">Supervisor</th>
                    <th className="text-center py-3 px-4 font-semibold">Vendedor</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((permission, index) => {
                    const Icon = permission.icon;
                    return (
                      <tr key={permission.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{permission.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Checkbox
                        checked={permission.admin}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(index, 'admin', checked as boolean)
                        }
                      />
                    </td>
                    <td className="text-center py-3 px-4">
                      <Checkbox
                        checked={permission.supervisor}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(index, 'supervisor', checked as boolean)
                        }
                      />
                    </td>
                    <td className="text-center py-3 px-4">
                      <Checkbox
                        checked={permission.vendedor}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(index, 'vendedor', checked as boolean)
                        }
                      />
                    </td>
                  </tr>
                );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={loading || loadingData}>
                {loading ? "Salvando..." : "Salvar Permissões"}
              </Button>
              <Button onClick={handleReset} variant="outline" disabled={loading || loadingData}>
                Restaurar Padrão
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}