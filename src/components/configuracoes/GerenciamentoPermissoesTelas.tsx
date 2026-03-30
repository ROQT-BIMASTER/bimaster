import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield, Users, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchScreens();
    fetchUsuarios();
    fetchModuloTelas();
  }, []);

  useEffect(() => {
    if (selectedUsuario) {
      fetchUserPermissions(selectedUsuario);
    }
  }, [selectedUsuario]);

  const fetchScreens = async () => {
    const { data, error } = await supabase
      .from("telas_sistema")
      .select("*")
      .eq("ativo", true)
      .order("ordem");

    if (error) {
      console.error("Error fetching screens:", error);
      return;
    }

    setScreens(data || []);
  };

  const fetchModuloTelas = async () => {
    try {
      // Use RPC or direct query to get module-screen mapping
      const { data: modulosData } = await supabase
        .from("modulos_sistema")
        .select("codigo, nome")
        .eq("ativo", true);

      const { data: telasModuloData } = await supabase
        .from("telas_sistema")
        .select("id, codigo")
        .eq("ativo", true);

      // Group by module prefix from screen code (e.g. "trade_materiais" → "trade")
      const moduloMap = new Map((modulosData || []).map(m => [m.codigo, m.nome]));
      const mappings: ModuloTela[] = [];

      (telasModuloData || []).forEach(tela => {
        const parts = tela.codigo.split("_");
        const prefix = parts[0];
        const moduloNome = moduloMap.get(prefix) || prefix;
        mappings.push({
          modulo_codigo: prefix,
          modulo_nome: moduloNome,
          tela_id: tela.id,
        });
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
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("aprovado", true);

      if (profilesError) throw profilesError;

      if (!profilesData || profilesData.length === 0) {
        setUsuarios([]);
        setLoading(false);
        return;
      }

      // Buscar roles em query separada
      const userIds = profilesData.map(p => p.id);
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      }

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

      const usuarios = profilesData.map((profile) => ({
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
        role: rolesMap.get(profile.id) || 'vendedor'
      }));

      setUsuarios(usuarios);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("usuario_permissoes_telas")
        .select("tela_id")
        .eq("usuario_id", userId);

      if (error) throw error;

      setUserPermissions(new Set(data?.map(p => p.tela_id) || []));
    } catch (error) {
      console.error("Error fetching user permissions:", error);
    }
  };

  const handleTogglePermission = (screenId: string) => {
    const newPermissions = new Set(userPermissions);
    if (newPermissions.has(screenId)) {
      newPermissions.delete(screenId);
    } else {
      newPermissions.add(screenId);
    }
    setUserPermissions(newPermissions);
  };

  const handleSyncWithRole = async () => {
    if (!selectedUsuario) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc("sincronizar_permissoes_usuario", {
        p_user_id: selectedUsuario,
      });

      if (error) throw error;

      // Recarregar permissões
      await fetchUserPermissions(selectedUsuario);

      toast({
        title: "Permissões sincronizadas",
        description: "As permissões foram restauradas de acordo com o role do usuário",
      });
    } catch (error) {
      console.error("Error syncing permissions:", error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível sincronizar as permissões",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = usuarios.find(u => u.id === selectedUsuario);

  const handleSave = async () => {
    if (!selectedUsuario) return;

    setSaving(true);
    try {
      // Capturar permissões antigas para auditoria
      const { data: oldPerms } = await supabase
        .from("usuario_permissoes_telas")
        .select("tela_id")
        .eq("usuario_id", selectedUsuario);
      
      const oldPermissionIds = oldPerms?.map(p => p.tela_id) || [];

      // Remove all existing permissions
      await supabase
        .from("usuario_permissoes_telas")
        .delete()
        .eq("usuario_id", selectedUsuario);

      // Insert new permissions
      if (userPermissions.size > 0) {
        const permissionsToInsert = Array.from(userPermissions).map(telaId => ({
          usuario_id: selectedUsuario,
          tela_id: telaId
        }));

        const { error } = await supabase
          .from("usuario_permissoes_telas")
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      // Invalidar cache do usuário e notificar PermissionsContext
      permissionsCache.invalidate(selectedUsuario);
      window.dispatchEvent(new Event('permissions-updated'));

      // Log de auditoria
      const newPermissionIds = Array.from(userPermissions);
      const screenNames = screens.map(s => ({ id: s.id, name: s.nome }));
      await logScreenPermissionsUpdate(
        selectedUsuario,
        selectedUser?.nome || 'Usuário',
        oldPermissionIds,
        newPermissionIds,
        screenNames
      );

      toast({
        title: "Permissões atualizadas",
        description: "As permissões do usuário foram salvas com sucesso",
      });
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar as permissões",
        variant: "destructive",
      });
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
          Permissões de Telas
        </CardTitle>
        <CardDescription>
          Gerencie quais telas cada usuário pode acessar no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
                    <Badge variant="outline" className="text-xs">
                      {usuario.role || 'vendedor'}
                    </Badge>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Telas Disponíveis</h4>
                <Badge variant="secondary">{userPermissions.size} / {screens.length} ativas</Badge>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {(() => {
                  // Group screens by module
                  const telaModuloMap = new Map<string, string>();
                  moduloTelas.forEach(mt => telaModuloMap.set(mt.tela_id, mt.modulo_codigo));

                  const groups = new Map<string, { nome: string; screens: Screen[] }>();
                  screens.forEach(screen => {
                    const modCode = telaModuloMap.get(screen.id) || "sem_modulo";
                    const modNome = moduloTelas.find(mt => mt.modulo_codigo === modCode)?.modulo_nome || "Sem Módulo";
                    if (!groups.has(modCode)) {
                      groups.set(modCode, { nome: modNome, screens: [] });
                    }
                    groups.get(modCode)!.screens.push(screen);
                  });

                  return Array.from(groups.entries()).map(([code, group]) => {
                    const activeCount = group.screens.filter(s => isUserAdmin || userPermissions.has(s.id)).length;
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
                          if (open) next.add(code);
                          else next.delete(code);
                          setOpenGroups(next);
                        }}
                      >
                        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="font-medium text-sm">{group.nome}</span>
                            <Badge variant="outline" className="text-xs">
                              {activeCount}/{group.screens.length}
                            </Badge>
                          </div>
                          {!isUserAdmin && (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="text-xs text-primary hover:underline"
                                onClick={() => handleToggleGroup(true)}
                              >
                                Todas
                              </button>
                              <span className="text-muted-foreground">|</span>
                              <button
                                className="text-xs text-destructive hover:underline"
                                onClick={() => handleToggleGroup(false)}
                              >
                                Nenhuma
                              </button>
                            </div>
                          )}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 space-y-1 mt-1">
                          {group.screens.map((screen) => (
                            <div
                              key={screen.id}
                              className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isUserAdmin || userPermissions.has(screen.id)}
                                  onCheckedChange={() => !isUserAdmin && handleTogglePermission(screen.id)}
                                  disabled={isUserAdmin}
                                />
                                <div>
                                  <div className="font-medium text-sm">{screen.nome}</div>
                                  <div className="text-xs text-muted-foreground">{screen.descricao}</div>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">{screen.codigo}</Badge>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  });
                })()}
              </div>
            </div>

            {!isUserAdmin && (
              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Permissões Personalizadas
                </Button>
                <Button
                  onClick={handleSyncWithRole}
                  disabled={saving}
                  variant="outline"
                  className="flex-1"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Restaurar do Role
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
