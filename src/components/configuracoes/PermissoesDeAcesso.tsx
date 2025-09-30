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
  ShieldCheck
} from "lucide-react";

interface RoutePermission {
  route: string;
  name: string;
  icon: any;
  admin: boolean;
  supervisor: boolean;
  vendedor: boolean;
}

const defaultRoutes: RoutePermission[] = [
  { route: '/dashboard', name: 'Dashboard', icon: LayoutDashboard, admin: true, supervisor: true, vendedor: true },
  { route: '/prospects', name: 'Prospects', icon: Users, admin: true, supervisor: true, vendedor: true },
  { route: '/kanban', name: 'Kanban', icon: CheckSquare, admin: true, supervisor: true, vendedor: true },
  { route: '/mapa', name: 'Mapa', icon: MapPin, admin: true, supervisor: true, vendedor: true },
  { route: '/atividades', name: 'Atividades', icon: Calendar, admin: true, supervisor: true, vendedor: true },
  { route: '/tarefas', name: 'Tarefas', icon: CheckSquare, admin: true, supervisor: true, vendedor: true },
  { route: '/chat', name: 'Chat', icon: MessageSquare, admin: true, supervisor: true, vendedor: true },
  { route: '/municipios', name: 'Municípios', icon: MapPin, admin: true, supervisor: true, vendedor: false },
  { route: '/auditoria', name: 'Auditoria', icon: ShieldCheck, admin: true, supervisor: true, vendedor: false },
  { route: '/importar-clientes', name: 'Importar Clientes', icon: Upload, admin: true, supervisor: false, vendedor: false },
];

export function PermissoesDeAcesso() {
  const [permissions, setPermissions] = useState<RoutePermission[]>(defaultRoutes);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = () => {
    const saved = localStorage.getItem('route-permissions');
    if (saved) {
      try {
        setPermissions(JSON.parse(saved));
      } catch (error) {
        console.error('Erro ao carregar permissões:', error);
      }
    }
  };

  const handlePermissionChange = (routeIndex: number, userType: 'admin' | 'supervisor' | 'vendedor', value: boolean) => {
    const newPermissions = [...permissions];
    newPermissions[routeIndex][userType] = value;
    setPermissions(newPermissions);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      localStorage.setItem('route-permissions', JSON.stringify(permissions));
      
      toast({
        title: "Permissões salvas",
        description: "As permissões de acesso foram atualizadas com sucesso",
      });
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as permissões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPermissions(defaultRoutes);
    localStorage.removeItem('route-permissions');
    toast({
      title: "Permissões restauradas",
      description: "As permissões foram restauradas para o padrão",
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
                  <tr key={permission.route} className="border-b hover:bg-muted/50">
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
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Permissões"}
          </Button>
          <Button onClick={handleReset} variant="outline" disabled={loading}>
            Restaurar Padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}