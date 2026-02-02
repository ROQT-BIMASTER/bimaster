import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, UserPlus, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";

interface ApproverManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levelId: string;
  levelName: string;
}

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
}

interface UserApprovalLevel {
  id: string;
  user_id: string;
  level_id: string;
  is_active: boolean;
}

export function ApproverManagementDialog({
  open,
  onOpenChange,
  levelId,
  levelName,
}: ApproverManagementDialogProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["trade-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .order("nome");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: open,
  });

  // Fetch current approvers for this level
  const { data: currentApprovers, isLoading: isLoadingApprovers } = useQuery({
    queryKey: ["trade-level-approvers", levelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_user_approval_levels")
        .select("*")
        .eq("level_id", levelId);
      if (error) throw error;
      return data as UserApprovalLevel[];
    },
    enabled: open && !!levelId,
  });

  const addApproverMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("trade_user_approval_levels")
        .insert({
          user_id: userId,
          level_id: levelId,
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-level-approvers", levelId] });
      queryClient.invalidateQueries({ queryKey: ["trade-approval-levels"] });
      toast.success("Aprovador adicionado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar aprovador: " + error.message);
    },
  });

  const removeApproverMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("trade_user_approval_levels")
        .delete()
        .eq("user_id", userId)
        .eq("level_id", levelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-level-approvers", levelId] });
      queryClient.invalidateQueries({ queryKey: ["trade-approval-levels"] });
      toast.success("Aprovador removido com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao remover aprovador: " + error.message);
    },
  });

  const approverUserIds = new Set(currentApprovers?.map((a) => a.user_id) || []);

  const filteredUsers = users?.filter(
    (user) =>
      user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const isLoading = isLoadingUsers || isLoadingApprovers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Gerenciar Aprovadores
          </DialogTitle>
          <DialogDescription>
            Nível: <strong>{levelName}</strong> — Selecione os usuários que podem aprovar neste nível de alçada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Current Approvers Count */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Aprovadores atuais:</span>
            <Badge variant="secondary">{currentApprovers?.length || 0}</Badge>
          </div>

          {/* Users List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {filteredUsers?.map((user) => {
                  const isApprover = approverUserIds.has(user.id);
                  const isPending =
                    addApproverMutation.isPending || removeApproverMutation.isPending;

                  return (
                    <div
                      key={user.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isApprover
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted/30 border-transparent hover:border-muted"
                      }`}
                    >
                      <Checkbox
                        checked={isApprover}
                        disabled={isPending}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            addApproverMutation.mutate(user.id);
                          } else {
                            removeApproverMutation.mutate(user.id);
                          }
                        }}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(user.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.nome || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email || "-"}
                        </p>
                      </div>
                      {isApprover && (
                        <Badge variant="default" className="shrink-0">
                          Aprovador
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {filteredUsers?.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
