import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Search, UserPlus, Trash2, Loader2, ArrowLeft, Shield, Monitor, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { AddUserDialog } from "./AddUserDialog";
import { BulkActionsSection } from "./BulkActionsSection";

interface ModuleInfo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
}

interface ScreenInfo {
  id: string;
  codigo: string;
  nome: string;
}

interface UserWithAccess {
  id: string;
  nome: string;
  email: string;
  role?: string;
  screenIds: string[]; // tela IDs this user has access to
}

interface ModulePermissionsDetailProps {
  moduleCode: string;
}

export function ModulePermissionsDetail({ moduleCode }: ModulePermissionsDetailProps) {
  const { toast } = useToast();
  const [module, setModule] = useState<ModuleInfo | null>(null);
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const [usersWithAccess, setUsersWithAccess] = useState<UserWithAccess[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; nome: string; email: string; role?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch module info
      const { data: modData, error: modErr } = await supabase
        .from("modulos_sistema")
        .select("id, codigo, nome, descricao")
        .eq("codigo", moduleCode)
        .single();

      if (modErr) throw modErr;
      setModule(modData);

      // 2. Fetch screens for this module
      const { data: screenData } = await supabase
        .from("telas_sistema")
        .select("id, codigo, nome")
        .eq("modulo_codigo", moduleCode)
        .eq("ativo", true)
        .order("ordem");

      setScreens(screenData || []);

      // 3. Fetch users with module access
      const { data: modulePerms } = await supabase
        .from("usuario_permissoes_modulos")
        .select("usuario_id")
        .eq("modulo_id", modData.id);

      const userIds = (modulePerms || []).map(p => p.usuario_id);

      // 4. Fetch screen permissions for these users in this module's screens
      const screenIds = (screenData || []).map(s => s.id);
      let screenPermsMap: Record<string, string[]> = {};

      if (userIds.length > 0 && screenIds.length > 0) {
        const { data: screenPerms } = await supabase
          .from("usuario_permissoes_telas")
          .select("usuario_id, tela_id")
          .in("usuario_id", userIds)
          .in("tela_id", screenIds);

        (screenPerms || []).forEach(sp => {
          if (!screenPermsMap[sp.usuario_id]) screenPermsMap[sp.usuario_id] = [];
          screenPermsMap[sp.usuario_id].push(sp.tela_id);
        });
      }

      // 5. Fetch user profiles + roles
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);

        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const roleMap: Record<string, string> = {};
        (roles || []).forEach(r => { roleMap[r.user_id] = r.role; });

        setUsersWithAccess(
          (profiles || []).map(p => ({
            ...p,
            role: roleMap[p.id],
            screenIds: screenPermsMap[p.id] || [],
          }))
        );
      } else {
        setUsersWithAccess([]);
      }

      // 6. Fetch all users for the add dialog
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("aprovado", true);

      const { data: allRoles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const allRoleMap: Record<string, string> = {};
      (allRoles || []).forEach(r => { allRoleMap[r.user_id] = r.role; });

      setAllUsers(
        (allProfiles || []).map(p => ({ ...p, role: allRoleMap[p.id] }))
      );
    } catch (err) {
      console.error("Erro ao carregar dados do módulo:", err);
      toast({ title: "Erro", description: "Não foi possível carregar dados do módulo", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [moduleCode, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dispatchPermissionsUpdated = () => {
    window.dispatchEvent(new Event("permissions-updated"));
  };

  // Available users (not in module yet)
  const availableUsers = useMemo(() => {
    const existingIds = new Set(usersWithAccess.map(u => u.id));
    return allUsers.filter(u => !existingIds.has(u.id));
  }, [allUsers, usersWithAccess]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return usersWithAccess.filter(u =>
      u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [usersWithAccess, search]);

  const getInitials = (nome: string) =>
    nome?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  const getAccessBadge = (user: UserWithAccess) => {
    if (screens.length === 0) return <Badge variant="default">Módulo</Badge>;
    if (user.screenIds.length === screens.length) {
      return <Badge className="bg-green-600 hover:bg-green-700 text-white">Acesso Total</Badge>;
    }
    if (user.screenIds.length > 0) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Parcial ({user.screenIds.length}/{screens.length})</Badge>;
    }
    return <Badge variant="secondary">Apenas Módulo</Badge>;
  };

  // --- Mutations ---

  const handleAddUsers = async (userIds: string[]) => {
    if (!module) return;
    setOperationLoading(true);
    try {
      const inserts = userIds.map(uid => ({ usuario_id: uid, modulo_id: module.id }));
      const { error } = await supabase.from("usuario_permissoes_modulos").insert(inserts);
      if (error) throw error;
      toast({ title: "Sucesso", description: `${userIds.length} usuário(s) adicionado(s) ao módulo` });
      dispatchPermissionsUpdated();
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao adicionar usuários", variant: "destructive" });
    } finally {
      setOperationLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!module) return;
    setOperationLoading(true);
    try {
      // Remove module permission
      const { error: modErr } = await supabase
        .from("usuario_permissoes_modulos")
        .delete()
        .eq("usuario_id", userId)
        .eq("modulo_id", module.id);
      if (modErr) throw modErr;

      // Remove all screen permissions for this module
      if (screens.length > 0) {
        const screenIds = screens.map(s => s.id);
        await supabase
          .from("usuario_permissoes_telas")
          .delete()
          .eq("usuario_id", userId)
          .in("tela_id", screenIds);
      }

      toast({ title: "Sucesso", description: "Acesso removido com sucesso" });
      dispatchPermissionsUpdated();
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao remover acesso", variant: "destructive" });
    } finally {
      setOperationLoading(false);
    }
  };

  const handleToggleScreen = async (userId: string, screenId: string, currentlyEnabled: boolean) => {
    if (!module) return;
    setOperationLoading(true);
    try {
      if (currentlyEnabled) {
        // Remove screen permission
        const { error } = await supabase
          .from("usuario_permissoes_telas")
          .delete()
          .eq("usuario_id", userId)
          .eq("tela_id", screenId);
        if (error) throw error;
      } else {
        // Grant screen permission
        const { error } = await supabase
          .from("usuario_permissoes_telas")
          .insert({ usuario_id: userId, tela_id: screenId });
        if (error) throw error;

        // Auto-grant module if not already granted
        const userHasModule = usersWithAccess.some(u => u.id === userId);
        if (!userHasModule) {
          await supabase
            .from("usuario_permissoes_modulos")
            .insert({ usuario_id: userId, modulo_id: module.id });
        }
      }

      toast({ title: "Sucesso", description: "Permissão atualizada" });
      dispatchPermissionsUpdated();
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao atualizar permissão", variant: "destructive" });
    } finally {
      setOperationLoading(false);
    }
  };

  const handleGrantFullAccess = async (userIds: string[]) => {
    if (!module) return;
    setOperationLoading(true);
    try {
      // Grant module to all
      const moduleInserts = userIds
        .filter(uid => !usersWithAccess.some(u => u.id === uid))
        .map(uid => ({ usuario_id: uid, modulo_id: module.id }));

      if (moduleInserts.length > 0) {
        await supabase.from("usuario_permissoes_modulos").insert(moduleInserts);
      }

      // Grant all screens to all
      if (screens.length > 0) {
        const screenInserts: { usuario_id: string; tela_id: string }[] = [];
        for (const uid of userIds) {
          const user = usersWithAccess.find(u => u.id === uid);
          const existingScreenIds = new Set(user?.screenIds || []);
          for (const screen of screens) {
            if (!existingScreenIds.has(screen.id)) {
              screenInserts.push({ usuario_id: uid, tela_id: screen.id });
            }
          }
        }
        if (screenInserts.length > 0) {
          await supabase.from("usuario_permissoes_telas").insert(screenInserts);
        }
      }

      toast({ title: "Sucesso", description: "Acesso total concedido" });
      setSelectedUserIds([]);
      dispatchPermissionsUpdated();
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao conceder acesso total", variant: "destructive" });
    } finally {
      setOperationLoading(false);
    }
  };

  const handleRevokeFullAccess = async (userIds: string[]) => {
    if (!module) return;
    setOperationLoading(true);
    try {
      // Remove module permissions
      for (const uid of userIds) {
        await supabase
          .from("usuario_permissoes_modulos")
          .delete()
          .eq("usuario_id", uid)
          .eq("modulo_id", module.id);
      }

      // Remove all screen permissions
      if (screens.length > 0) {
        const screenIds = screens.map(s => s.id);
        for (const uid of userIds) {
          await supabase
            .from("usuario_permissoes_telas")
            .delete()
            .eq("usuario_id", uid)
            .in("tela_id", screenIds);
        }
      }

      toast({ title: "Sucesso", description: "Acesso revogado com sucesso" });
      setSelectedUserIds([]);
      dispatchPermissionsUpdated();
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao revogar acesso", variant: "destructive" });
    } finally {
      setOperationLoading(false);
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(x => x !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Módulo não encontrado</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dashboard/configuracoes/permissoes-modulo">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/dashboard/configuracoes/permissoes-modulo">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {module.nome}
          </h2>
          <p className="text-muted-foreground text-sm">
            Gerenciar permissões de acesso ao módulo <span className="font-mono">{module.codigo}</span>
          </p>
        </div>
      </div>

      {/* Section A - Users with access */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Usuários com Acesso ({usersWithAccess.length})
              </CardTitle>
              <CardDescription>Usuários que possuem acesso a este módulo</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum usuário com acesso a este módulo
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleSelectUser(user.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(user.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.nome}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {user.role || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getAccessBadge(user)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUser(user.id)}
                        disabled={operationLoading}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section B - Screen permissions matrix */}
      {screens.length > 0 && usersWithAccess.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Permissões de Telas
            </CardTitle>
            <CardDescription>
              Controle granular de acesso por tela dentro do módulo
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Usuário</TableHead>
                  {screens.map(screen => (
                    <TableHead key={screen.id} className="text-center min-w-[100px]">
                      <div className="text-xs">
                        <p className="font-medium">{screen.nome}</p>
                        <p className="text-muted-foreground font-mono">{screen.codigo}</p>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersWithAccess.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {getInitials(user.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium whitespace-nowrap">{user.nome}</span>
                      </div>
                    </TableCell>
                    {screens.map(screen => {
                      const hasAccess = user.screenIds.includes(screen.id);
                      return (
                        <TableCell key={screen.id} className="text-center">
                          <Switch
                            checked={hasAccess}
                            onCheckedChange={() =>
                              handleToggleScreen(user.id, screen.id, hasAccess)
                            }
                            disabled={operationLoading}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Section C - Bulk actions */}
      <BulkActionsSection
        selectedUserIds={selectedUserIds}
        onGrantFullAccess={handleGrantFullAccess}
        onRevokeFullAccess={handleRevokeFullAccess}
        moduleName={module.nome}
      />

      {/* Add user dialog */}
      <AddUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        availableUsers={availableUsers}
        onAddUsers={handleAddUsers}
        loading={operationLoading}
      />
    </div>
  );
}
