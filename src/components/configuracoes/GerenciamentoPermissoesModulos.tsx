import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Store, FileText, Settings, LayoutDashboard, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  departamento_id?: string | null;
}

interface DeptPermission {
  departamentoId: string;
  moduleId: string;
}

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Users,
  Store,
  FileText,
  Settings,
};

type PermissionSource = "role" | "departamento" | "individual" | null;

export function GerenciamentoPermissoesModulos() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [deptPermissions, setDeptPermissions] = useState<DeptPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: modulesData },
        { data: rolePermsData },
        { data: userPermsData },
        { data: deptPermsData },
        { data: profilesData },
        { data: userRolesData },
      ] = await Promise.all([
        supabase.from("modulos_sistema").select("*").eq("ativo", true).order("ordem"),
        supabase.from("role_permissoes_modulos").select("role, modulo_id"),
        supabase.from("usuario_permissoes_modulos").select("usuario_id, modulo_id"),
        supabase.from("departamento_permissoes_modulos").select("departamento_id, modulo_id"),
        supabase.from("profiles").select("id, nome, email, departamento_id").eq("aprovado", true).order("nome"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const usersWithRoles = profilesData?.map((profile) => ({
        ...profile,
        role: userRolesData?.find((ur) => ur.user_id === profile.id)?.role,
      })) || [];

      setModules(modulesData || []);
      setRolePermissions(rolePermsData?.map((rp) => ({ role: rp.role, moduleId: rp.modulo_id })) || []);
      setUserPermissions(userPermsData?.map((up) => ({ userId: up.usuario_id, moduleId: up.modulo_id })) || []);
      setDeptPermissions(deptPermsData?.map((dp) => ({ departamentoId: dp.departamento_id, moduleId: dp.modulo_id })) || []);
      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({ title: "Erro", description: "Falha ao carregar permissões", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleRolePermission = async (role: string, moduleId: string, currentValue: boolean) => {
    setSaving(true);
    try {
      if (currentValue) {
        await supabase.from("role_permissoes_modulos").delete().eq("role", role as any).eq("modulo_id", moduleId);
        setRolePermissions((prev) => prev.filter((rp) => !(rp.role === role && rp.moduleId === moduleId)));
      } else {
        await supabase.from("role_permissoes_modulos").insert([{ role: role as any, modulo_id: moduleId }]);
        setRolePermissions((prev) => [...prev, { role, moduleId }]);
      }
      permissionsCache.clear();
      window.dispatchEvent(new Event('permissions-updated'));
      toast({ title: "Sucesso", description: "Permissão atualizada" });
    } catch (error) {
      console.error("Erro ao atualizar permissão:", error);
      toast({ title: "Erro", description: "Falha ao atualizar permissão", variant: "destructive" });
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
        await supabase.from("usuario_permissoes_modulos").delete().eq("usuario_id", userId).eq("modulo_id", moduleId);
        setUserPermissions((prev) => prev.filter((up) => !(up.userId === userId && up.moduleId === moduleId)));
      } else {
        await supabase.from("usuario_permissoes_modulos").insert({ usuario_id: userId, modulo_id: moduleId });
        setUserPermissions((prev) => [...prev, { userId, moduleId }]);
      }

      permissionsCache.invalidate(userId);
      window.dispatchEvent(new Event('permissions-updated'));
      await logModulePermissionToggle(userId, user?.nome || 'Usuário', moduleId, module?.nome || 'Módulo', !currentValue);
      toast({ title: "Sucesso", description: "Permissão atualizada" });
    } catch (error) {
      console.error("Erro ao atualizar permissão:", error);
      toast({ title: "Erro", description: "Falha ao atualizar permissão", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clearUserOverrides = async (userId: string) => {
    setSaving(true);
    try {
      await supabase.from("usuario_permissoes_modulos").delete().eq("usuario_id", userId);
      setUserPermissions((prev) => prev.filter((up) => up.userId !== userId));
      permissionsCache.invalidate(userId);
      window.dispatchEvent(new Event('permissions-updated'));
      toast({ title: "Sucesso", description: "Permissões individuais removidas. O usuário agora herda do Role/Departamento." });
    } catch (error) {
      console.error("Erro:", error);
      toast({ title: "Erro", description: "Falha ao remover permissões", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasRolePermission = (role: string, moduleId: string): boolean =>
    rolePermissions.some((rp) => rp.role === role && rp.moduleId === moduleId);

  const hasUserPermission = (userId: string, moduleId: string): boolean =>
    userPermissions.some((up) => up.userId === userId && up.moduleId === moduleId);

  const hasDeptPermission = (deptId: string | null | undefined, moduleId: string): boolean =>
    deptId ? deptPermissions.some((dp) => dp.departamentoId === deptId && dp.moduleId === moduleId) : false;

  // Determine permission source for a user+module
  const getPermissionSource = (userId: string, moduleId: string): PermissionSource => {
    const user = users.find(u => u.id === userId);
    const hasCustom = userPermissions.some(up => up.userId === userId);

    if (hasCustom) {
      // Override mode: only individual records matter
      return hasUserPermission(userId, moduleId) ? "individual" : null;
    }
    // Fallback mode
    if (user?.role && hasRolePermission(user.role, moduleId)) return "role";
    if (hasDeptPermission(user?.departamento_id, moduleId)) return "departamento";
    return null;
  };

  const selectedUserObj = users.find(u => u.id === selectedUser);
  const userHasCustomPerms = selectedUser ? userPermissions.some(up => up.userId === selectedUser) : false;

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
                            <Label htmlFor={`${role}-${module.id}`} className="font-medium">{module.nome}</Label>
                            {module.descricao && <p className="text-sm text-muted-foreground">{module.descricao}</p>}
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
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Como funciona:</strong> Se o usuário tiver permissões individuais configuradas, 
                elas <strong>sobrescrevem completamente</strong> as permissões do Role/Departamento. 
                Se não tiver, herda automaticamente do Role e Departamento.
              </AlertDescription>
            </Alert>

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

            {selectedUser && selectedUserObj && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Permissões de {selectedUserObj.nome}
                      </CardTitle>
                      <CardDescription>
                        Função: {selectedUserObj.role || "Não definido"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {userHasCustomPerms ? (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                          Modo: Override Individual
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Modo: Herança (Role + Dept)
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {userHasCustomPerms && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>Este usuário tem permissões individuais. Elas substituem Role/Departamento.</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => clearUserOverrides(selectedUser)}
                          disabled={saving}
                        >
                          Restaurar Herança
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  <TooltipProvider>
                    {modules.map((module) => {
                      const source = getPermissionSource(selectedUser, module.id);
                      const isActive = source !== null;
                      const hasIndividual = hasUserPermission(selectedUser, module.id);
                      const Icon = module.icone && iconMap[module.icone] ? iconMap[module.icone] : LayoutDashboard;

                      return (
                        <div key={module.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`user-${module.id}`} className="font-medium">{module.nome}</Label>
                              {source === "role" && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="default" className="text-[10px] px-1.5 py-0">Role</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Herdado da função "{selectedUserObj.role}"</TooltipContent>
                                </Tooltip>
                              )}
                              {source === "departamento" && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 border-blue-200">Dept</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Herdado do departamento</TooltipContent>
                                </Tooltip>
                              )}
                              {source === "individual" && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-800 border-purple-200">Individual</Badge>
                              )}
                            </div>
                          </div>
                          <Switch
                            id={`user-${module.id}`}
                            checked={isActive}
                            onCheckedChange={() => toggleUserPermission(selectedUser, module.id, hasIndividual)}
                            disabled={saving}
                          />
                        </div>
                      );
                    })}
                  </TooltipProvider>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
