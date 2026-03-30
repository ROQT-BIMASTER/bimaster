import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Store, FileText, Settings, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { permissionsCache } from "@/lib/utils/permissions-cache";
import { logModulePermissionToggle } from "@/lib/utils/permission-audit";

interface Module {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ordem: number;
}

interface RolePermission {
  role: string;
  moduleId: string;
}

interface UserPermission {
  userId: string;
  moduleId: string;
}

interface User {
  id: string;
  nome: string;
  email: string;
  role?: string;
}

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Users,
  Store,
  FileText,
  Settings,
};

export function GerenciamentoPermissoesModulos() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar módulos
      const { data: modulesData } = await supabase
        .from("modulos_sistema")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      // Buscar permissões por role
      const { data: rolePermsData } = await supabase
        .from("role_permissoes_modulos")
        .select("role, modulo_id");

      // Buscar permissões por usuário
      const { data: userPermsData } = await supabase
        .from("usuario_permissoes_modulos")
        .select("usuario_id, modulo_id");

      // Buscar usuários
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("aprovado", true)
        .order("nome");

      // Buscar roles dos usuários
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const usersWithRoles = profilesData?.map((profile) => ({
        ...profile,
        role: userRolesData?.find((ur) => ur.user_id === profile.id)?.role,
      })) || [];

      setModules(modulesData || []);
      setRolePermissions(rolePermsData?.map((rp) => ({ role: rp.role, moduleId: rp.modulo_id })) || []);
      setUserPermissions(userPermsData?.map((up) => ({ userId: up.usuario_id, moduleId: up.modulo_id })) || []);
      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar permissões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRolePermission = async (role: string, moduleId: string, currentValue: boolean) => {
    setSaving(true);
    try {
      if (currentValue) {
        // Remover permissão
        await supabase
          .from("role_permissoes_modulos")
          .delete()
          .eq("role", role as any)
          .eq("modulo_id", moduleId);

        setRolePermissions((prev) =>
          prev.filter((rp) => !(rp.role === role && rp.moduleId === moduleId))
        );
      } else {
        // Adicionar permissão
        await supabase
          .from("role_permissoes_modulos")
          .insert([{ role: role as any, modulo_id: moduleId }]);

        setRolePermissions((prev) => [...prev, { role, moduleId }]);
      }

      // Invalidar cache de todos os usuários dessa role e notificar context
      permissionsCache.clear();
      window.dispatchEvent(new Event('permissions-updated'));

      toast({
        title: "Sucesso",
        description: "Permissão atualizada",
      });
    } catch (error) {
      console.error("Erro ao atualizar permissão:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar permissão",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleUserPermission = async (userId: string, moduleId: string, currentValue: boolean) => {
    setSaving(true);
    try {
      const module = modules.find(m => m.id === moduleId);
      const user = users.find(u => u.id === userId);

      if (currentValue) {
        // Remover permissão
        await supabase
          .from("usuario_permissoes_modulos")
          .delete()
          .eq("usuario_id", userId)
          .eq("modulo_id", moduleId);

        setUserPermissions((prev) =>
          prev.filter((up) => !(up.userId === userId && up.moduleId === moduleId))
        );
      } else {
        // Adicionar permissão
        await supabase
          .from("usuario_permissoes_modulos")
          .insert({ usuario_id: userId, modulo_id: moduleId });

        setUserPermissions((prev) => [...prev, { userId, moduleId }]);
      }

      // Invalidar cache do usuário específico
      permissionsCache.invalidate(userId);

      // Log de auditoria
      await logModulePermissionToggle(
        userId,
        user?.nome || 'Usuário',
        moduleId,
        module?.nome || 'Módulo',
        !currentValue
      );

      toast({
        title: "Sucesso",
        description: "Permissão atualizada",
      });
    } catch (error) {
      console.error("Erro ao atualizar permissão:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar permissão",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasRolePermission = (role: string, moduleId: string): boolean => {
    return rolePermissions.some((rp) => rp.role === role && rp.moduleId === moduleId);
  };

  const hasUserPermission = (userId: string, moduleId: string): boolean => {
    return userPermissions.some((up) => up.userId === userId && up.moduleId === moduleId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissões de Módulos</CardTitle>
        <CardDescription>
          Configure quais módulos cada role ou usuário pode acessar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="roles">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="roles">Por Função (Role)</TabsTrigger>
            <TabsTrigger value="users">Por Usuário</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Defina permissões padrão por função. Administradores têm acesso a todos os módulos automaticamente.
            </div>
            
            {["gerente", "supervisor", "vendedor", "promotor"].map((role) => (
              <Card key={role}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant={role === "gerente" || role === "supervisor" ? "default" : "secondary"}>
                      {role === "gerente" ? "Gerente" : role === "supervisor" ? "Supervisor" : role === "vendedor" ? "Vendedor" : "Promotor"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {modules.map((module) => {
                    const hasPermission = hasRolePermission(role, module.id);
                    const Icon = module.icone && iconMap[module.icone] ? iconMap[module.icone] : LayoutDashboard;

                    return (
                      <div key={module.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <Label htmlFor={`${role}-${module.id}`} className="font-medium">
                              {module.nome}
                            </Label>
                            {module.descricao && (
                              <p className="text-sm text-muted-foreground">{module.descricao}</p>
                            )}
                          </div>
                        </div>
                        <Switch
                          id={`${role}-${module.id}`}
                          checked={hasPermission}
                          onCheckedChange={() => toggleRolePermission(role, module.id, hasPermission)}
                          disabled={saving}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Permissões específicas por usuário (sobrescrevem as permissões da função)
            </div>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.nome} ({user.email}) - {user.role || "Sem role"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedUser && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Permissões de {users.find((u) => u.id === selectedUser)?.nome}
                  </CardTitle>
                  <CardDescription>
                    Função: {users.find((u) => u.id === selectedUser)?.role || "Não definido"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {modules.map((module) => {
                    const hasPermission = hasUserPermission(selectedUser, module.id);
                    const Icon = module.icone && iconMap[module.icone] ? iconMap[module.icone] : LayoutDashboard;

                    return (
                      <div key={module.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <Label htmlFor={`user-${module.id}`} className="font-medium">
                              {module.nome}
                            </Label>
                            {module.descricao && (
                              <p className="text-sm text-muted-foreground">{module.descricao}</p>
                            )}
                          </div>
                        </div>
                        <Switch
                          id={`user-${module.id}`}
                          checked={hasPermission}
                          onCheckedChange={() => toggleUserPermission(selectedUser, module.id, hasPermission)}
                          disabled={saving}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
