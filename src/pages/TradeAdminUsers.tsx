import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Users, Loader2, Shield, ShieldCheck, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface User {
  id: string;
  nome: string | null;
  email: string | null;
  status: string | null;
}

interface ApprovalLevel {
  id: string;
  level_number: number;
  role_name: string;
}

interface UserPermission {
  usuario_id: string;
  tela_id: string;
}

interface UserApprovalLevel {
  user_id: string;
  level_id: string;
}

export default function TradeAdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);

  // Fetch all users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["trade-admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, status")
        .order("nome");
      
      if (error) throw error;
      return data as User[];
    },
  });

  // Fetch trade_admin screen ID and permissions
  const { data: tradeAdminData } = useQuery({
    queryKey: ["trade-admin-screen-permissions"],
    queryFn: async () => {
      // Get trade_admin screen
      const { data: screen, error: screenError } = await supabase
        .from("telas_sistema")
        .select("id")
        .eq("codigo", "trade_admin")
        .single();
      
      if (screenError) throw screenError;

      // Get all permissions for this screen
      const { data: permissions, error: permError } = await supabase
        .from("usuario_permissoes_telas")
        .select("usuario_id, tela_id")
        .eq("tela_id", screen.id);

      if (permError) throw permError;

      return {
        screenId: screen.id,
        permissions: permissions as UserPermission[],
      };
    },
  });

  // Fetch approval levels
  const { data: approvalLevels } = useQuery({
    queryKey: ["trade-approval-levels-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_approval_levels")
        .select("id, level_number, role_name")
        .eq("is_active", true)
        .order("level_number");
      
      if (error) throw error;
      return data as ApprovalLevel[];
    },
  });

  // Fetch user approval level assignments
  const { data: userApprovalLevels } = useQuery({
    queryKey: ["trade-user-approval-levels-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_user_approval_levels")
        .select("user_id, level_id")
        .eq("is_active", true);
      
      if (error) throw error;
      return data as UserApprovalLevel[];
    },
  });

  const tradeAdminUserIds = new Set(
    tradeAdminData?.permissions?.map((p) => p.usuario_id) || []
  );

  const userLevelMap = new Map(
    userApprovalLevels?.map((ul) => [ul.user_id, ul.level_id]) || []
  );

  const getLevelForUser = (userId: string) => {
    const levelId = userLevelMap.get(userId);
    if (!levelId) return null;
    return approvalLevels?.find((l) => l.id === levelId) || null;
  };

  // Mutation to toggle trade_admin permission
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, grant }: { userId: string; grant: boolean }) => {
      if (!tradeAdminData?.screenId) throw new Error("Screen ID not found");
      
      if (grant) {
        const { error } = await supabase
          .from("usuario_permissoes_telas")
          .insert({
            usuario_id: userId,
            tela_id: tradeAdminData.screenId,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("usuario_permissoes_telas")
          .delete()
          .eq("usuario_id", userId)
          .eq("tela_id", tradeAdminData.screenId);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["trade-admin-screen-permissions"] });
      toast.success(
        variables.grant 
          ? "Permissão administrativa concedida!" 
          : "Permissão administrativa revogada!"
      );
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Mutation to assign approval level
  const assignLevelMutation = useMutation({
    mutationFn: async ({ userId, levelId }: { userId: string; levelId: string | null }) => {
      // First, remove existing assignment
      await supabase
        .from("trade_user_approval_levels")
        .delete()
        .eq("user_id", userId);

      // Then add new assignment if levelId is provided
      if (levelId) {
        const { error } = await supabase
          .from("trade_user_approval_levels")
          .insert({
            user_id: userId,
            level_id: levelId,
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-user-approval-levels-list"] });
      toast.success("Nível de aprovação atualizado!");
      setLevelDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const filteredUsers = users?.filter(user => 
    user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = isLoadingUsers;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/trade/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Usuários e Perfis
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerenciamento de usuários e permissões do módulo Trade Marketing
            </p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>
              {filteredUsers?.length || 0} usuários encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trade Admin</TableHead>
                    <TableHead>Nível de Aprovação</TableHead>
                    <TableHead className="w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => {
                    const isTradeAdmin = tradeAdminUserIds.has(user.id);
                    const level = getLevelForUser(user.id);
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.nome || "-"}</TableCell>
                        <TableCell>{user.email || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === "ativo" ? "default" : "secondary"}>
                            {user.status || "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isTradeAdmin ? (
                            <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-200">
                              <ShieldCheck className="h-3 w-3" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <Shield className="h-3 w-3 mr-1" />
                              Usuário
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {level ? (
                            <Badge variant="secondary">
                              Nível {level.level_number} - {level.role_name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setLevelDialogOpen(true);
                              }}
                              title="Configurar permissões"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!filteredUsers || filteredUsers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Settings Dialog */}
      <Dialog open={levelDialogOpen} onOpenChange={setLevelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Usuário</DialogTitle>
            <DialogDescription>
              {selectedUser?.nome || "Usuário"} - {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              {/* Trade Admin Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="font-medium">Permissão Trade Admin</p>
                  <p className="text-sm text-muted-foreground">
                    Permite acesso ao módulo administrativo
                  </p>
                </div>
                <Button
                  variant={tradeAdminUserIds.has(selectedUser.id) ? "destructive" : "default"}
                  size="sm"
                  disabled={toggleAdminMutation.isPending}
                  onClick={() => {
                    toggleAdminMutation.mutate({
                      userId: selectedUser.id,
                      grant: !tradeAdminUserIds.has(selectedUser.id),
                    });
                  }}
                >
                  {toggleAdminMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  {tradeAdminUserIds.has(selectedUser.id) ? "Revogar" : "Conceder"}
                </Button>
              </div>

              {/* Approval Level Select */}
              <div className="space-y-3">
                <p className="font-medium">Nível de Aprovação</p>
                <Select
                  value={userLevelMap.get(selectedUser.id) || "none"}
                  onValueChange={(value) => {
                    assignLevelMutation.mutate({
                      userId: selectedUser.id,
                      levelId: value === "none" ? null : value,
                    });
                  }}
                  disabled={assignLevelMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum nível</SelectItem>
                    {approvalLevels?.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        Nível {level.level_number} - {level.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Define a alçada de aprovação deste usuário
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
