import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield, Users, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { permissionsCache } from "@/lib/utils/permissions-cache";
import { logScreenPermissionsUpdate, logPermissionSync } from "@/lib/utils/permission-audit";

interface Screen {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  icone: string;
  rota: string;
  ordem: number;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role?: string;
  departamento_id?: string | null;
}

interface ModuloTela {
  modulo_codigo: string;
  modulo_nome: string;
  tela_id: string;
}

export const GerenciamentoPermissoesTelas = () => {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [moduloTelas, setModuloTelas] = useState<ModuloTela[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState<string>("");
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [roleScreenPerms, setRoleScreenPerms] = useState<{ role: string; tela_id: string }[]>([]);
  const [deptScreenPerms, setDeptScreenPerms] = useState<{ departamento_id: string; tela_id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchScreens();
    fetchUsuarios();
    fetchModuloTelas();
    fetchRoleDeptPerms();
  }, []);

  useEffect(() => {
    if (selectedUsuario) {
      fetchUserPermissions(selectedUsuario);
    }
  }, [selectedUsuario]);

  const fetchRoleDeptPerms = async () => {
    const [{ data: roleData }, { data: deptData }] = await Promise.all([
      supabase.from("role_permissoes_telas").select("role, tela_id"),
      supabase.from("departamento_permissoes_telas").select("departamento_id, tela_id"),
    ]);
    setRoleScreenPerms(roleData || []);
    setDeptScreenPerms(deptData || []);
  };

  const fetchScreens = async () => {
    const { data } = await supabase.from("telas_sistema").select("*").eq("ativo", true).order("ordem");
    setScreens(data || []);
  };

  const fetchModuloTelas = async () => {
    try {
      const [{ data: modulosData }, { data: telasModuloData }] = await Promise.all([
        supabase.from("modulos_sistema").select("codigo, nome").eq("ativo", true),
        supabase.from("telas_sistema").select("id, codigo").eq("ativo", true),
      ]);

      const moduloMap = new Map((modulosData || []).map(m => [m.codigo, m.nome]));
      const mappings: ModuloTela[] = [];

      (telasModuloData || []).forEach(tela => {
        const parts = tela.codigo.split("_");
        const prefix = parts[0];
        const moduloNome = moduloMap.get(prefix) || prefix;
        mappings.push({ modulo_codigo: prefix, modulo_nome: moduloNome, tela_id: tela.id });
      });

      setModuloTelas(mappings);
      const codes = new Set(mappings.map(m => m.modulo_codigo));
      codes.add("sem_modulo");
      setOpenGroups(codes);
    } catch (error) {
      console.error("Error fetching modulo telas:", error);
    }
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome, email, departamento_id")
        .eq("aprovado", true);

      if (!profilesData?.length) { setUsuarios([]); setLoading(false); return; }

      const userIds = profilesData.map(p => p.id);
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

      setUsuarios(profilesData.map(p => ({ ...p, role: rolesMap.get(p.id) || 'vendedor' })));
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data } = await supabase.from("usuario_permissoes_telas").select("tela_id").eq("usuario_id", userId);
      setUserPermissions(new Set(data?.map(p => p.tela_id) || []));
    } catch (error) {
      console.error("Error fetching user permissions:", error);
    }
  };

  const handleTogglePermission = (screenId: string) => {
    const newPermissions = new Set(userPermissions);
    if (newPermissions.has(screenId)) newPermissions.delete(screenId);
    else newPermissions.add(screenId);
    setUserPermissions(newPermissions);
  };

  const selectedUser = usuarios.find(u => u.id === selectedUsuario);
  const userHasCustomPerms = selectedUsuario ? userPermissions.size > 0 : false;

  // Determine if a screen is active for this user (considering override logic)
  const getScreenSource = (screenId: string): "individual" | "role" | "departamento" | null => {
    if (!selectedUser) return null;
    
    // Check if user has ANY custom screen permissions (override mode)
    if (userHasCustomPerms) {
      return userPermissions.has(screenId) ? "individual" : null;
    }
    
    // Fallback: role + dept
    if (selectedUser.role && roleScreenPerms.some(r => r.role === selectedUser.role && r.tela_id === screenId)) return "role";
    if (selectedUser.departamento_id && deptScreenPerms.some(d => d.departamento_id === selectedUser.departamento_id && d.tela_id === screenId)) return "departamento";
    return null;
  };

  const handleClearOverrides = async () => {
    if (!selectedUsuario) return;
    setSaving(true);
    try {
      await supabase.from("usuario_permissoes_telas").delete().eq("usuario_id", selectedUsuario);
      setUserPermissions(new Set());
      permissionsCache.invalidate(selectedUsuario);
      window.dispatchEvent(new Event('permissions-updated'));
      toast({ title: "Sucesso", description: "Permissões individuais removidas. Usuário herda do Role/Departamento." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao remover permissões", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUsuario) return;
    setSaving(true);
    try {
      const { data: oldPerms } = await supabase.from("usuario_permissoes_telas").select("tela_id").eq("usuario_id", selectedUsuario);
      const oldPermissionIds = oldPerms?.map(p => p.tela_id) || [];

      await supabase.from("usuario_permissoes_telas").delete().eq("usuario_id", selectedUsuario);

      if (userPermissions.size > 0) {
        const permissionsToInsert = Array.from(userPermissions).map(telaId => ({
          usuario_id: selectedUsuario,
          tela_id: telaId
        }));
        const { error } = await supabase.from("usuario_permissoes_telas").insert(permissionsToInsert);
        if (error) throw error;
      }

      permissionsCache.invalidate(selectedUsuario);
      window.dispatchEvent(new Event('permissions-updated'));

      const newPermissionIds = Array.from(userPermissions);
      const screenNames = screens.map(s => ({ id: s.id, name: s.nome }));
      await logScreenPermissionsUpdate(selectedUsuario, selectedUser?.nome || 'Usuário', oldPermissionIds, newPermissionIds, screenNames);

      toast({ title: "Permissões atualizadas", description: "As permissões individuais foram salvas (sobrescrevem Role/Dept)" });
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast({ title: "Erro ao salvar", description: "Não foi possível atualizar as permissões", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isUserAdmin = selectedUser?.role === 'admin';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissões de Telas por Usuário
        </CardTitle>
        <CardDescription>
          Configure permissões individuais. Quando definidas, elas substituem completamente as permissões do Role/Departamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Lógica de prioridade:</strong> Se o usuário tiver permissões individuais salvas, elas são as únicas consideradas.
            Se não tiver, herda automaticamente do Role e Departamento.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Selecionar Usuário
          </label>
          <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um usuário" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((usuario) => (
                <SelectItem key={usuario.id} value={usuario.id}>
                  <div className="flex items-center gap-2">
                    <span>{usuario.nome}</span>
                    <Badge variant="outline" className="text-xs">{usuario.role || 'vendedor'}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedUsuario && (
          <>
            {isUserAdmin && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-primary">
                  ⚠️ Administradores têm acesso automático a todas as telas do sistema
                </p>
              </div>
            )}

            {!isUserAdmin && (
              <div className="flex items-center justify-between">
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
                {userHasCustomPerms && (
                  <Button variant="outline" size="sm" onClick={handleClearOverrides} disabled={saving}>
                    Restaurar Herança
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Telas Disponíveis</h4>
                <Badge variant="secondary">
                  {screens.filter(s => isUserAdmin || getScreenSource(s.id) !== null).length} / {screens.length} ativas
                </Badge>
              </div>
              <TooltipProvider>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {(() => {
                    const telaModuloMap = new Map<string, string>();
                    moduloTelas.forEach(mt => telaModuloMap.set(mt.tela_id, mt.modulo_codigo));

                    const groups = new Map<string, { nome: string; screens: Screen[] }>();
                    screens.forEach(screen => {
                      const modCode = telaModuloMap.get(screen.id) || "sem_modulo";
                      const modNome = moduloTelas.find(mt => mt.modulo_codigo === modCode)?.modulo_nome || "Sem Módulo";
                      if (!groups.has(modCode)) groups.set(modCode, { nome: modNome, screens: [] });
                      groups.get(modCode)!.screens.push(screen);
                    });

                    return Array.from(groups.entries()).map(([code, group]) => {
                      const activeCount = group.screens.filter(s => isUserAdmin || getScreenSource(s.id) !== null).length;
                      const isOpen = openGroups.has(code);

                      const handleToggleGroup = (checked: boolean) => {
                        const newPerms = new Set(userPermissions);
                        group.screens.forEach(s => {
                          if (checked) newPerms.add(s.id);
                          else newPerms.delete(s.id);
                        });
                        setUserPermissions(newPerms);
                      };

                      return (
                        <Collapsible
                          key={code}
                          open={isOpen}
                          onOpenChange={(open) => {
                            const next = new Set(openGroups);
                            if (open) next.add(code); else next.delete(code);
                            setOpenGroups(next);
                          }}
                        >
                          <CollapsibleTrigger className="flex w-full items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-2">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="font-medium text-sm">{group.nome}</span>
                              <Badge variant="outline" className="text-xs">{activeCount}/{group.screens.length}</Badge>
                            </div>
                            {!isUserAdmin && (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button className="text-xs text-primary hover:underline" onClick={() => handleToggleGroup(true)}>Todas</button>
                                <span className="text-muted-foreground">|</span>
                                <button className="text-xs text-destructive hover:underline" onClick={() => handleToggleGroup(false)}>Nenhuma</button>
                              </div>
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-4 space-y-1 mt-1">
                            {group.screens.map((screen) => {
                              const source = getScreenSource(screen.id);
                              return (
                                <div key={screen.id} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={isUserAdmin || userPermissions.has(screen.id)}
                                      onCheckedChange={() => !isUserAdmin && handleTogglePermission(screen.id)}
                                      disabled={isUserAdmin}
                                    />
                                    <div>
                                      <div className="font-medium text-sm flex items-center gap-2">
                                        {screen.nome}
                                        {source === "role" && (
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <Badge variant="default" className="text-[10px] px-1.5 py-0">Role</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>Herdado da função "{selectedUser?.role}"</TooltipContent>
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
                                      <div className="text-xs text-muted-foreground">{screen.descricao}</div>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-xs">{screen.codigo}</Badge>
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    });
                  })()}
                </div>
              </TooltipProvider>
            </div>

            {!isUserAdmin && (
              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Permissões Individuais
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
