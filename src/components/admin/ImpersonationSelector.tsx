import { useState, useEffect } from "react";
import { Eye, Search, Loader2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  nome: string;
  email: string;
  role?: string;
  departamento_nome?: string;
  status?: string;
}

export const ImpersonationSelector = () => {
  const { isAdmin } = usePermissions();
  const { isImpersonating, startImpersonation, stopImpersonation, loading } = useImpersonation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id,
          nome,
          email,
          status,
          departamentos:departamento_id (
            nome
          )
        `)
        .eq("aprovado", true)
        .order("nome");

      if (error) throw error;

      // Fetch roles for each user
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const usersWithRoles: UserProfile[] = (profiles || []).map(p => ({
        id: p.id,
        nome: p.nome || p.email,
        email: p.email,
        role: rolesMap.get(p.id) || "vendedor",
        departamento_nome: (p.departamentos as any)?.nome || null,
        status: p.status,
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast.error("Erro ao carregar lista de usuários");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSelectUser = async (userId: string, userName: string) => {
    const success = await startImpersonation(userId);
    if (success) {
      toast.success(`Visualizando sistema como ${userName}`);
      setOpen(false);
    } else {
      toast.error("Erro ao iniciar visualização como usuário");
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = search.toLowerCase();
    return (
      user.nome?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower) ||
      user.departamento_nome?.toLowerCase().includes(searchLower)
    );
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive" className="text-xs">Admin</Badge>;
      case "supervisor":
        return <Badge className="bg-purple-500 text-xs">Supervisor</Badge>;
      case "vendedor":
        return <Badge className="bg-blue-500 text-xs">Vendedor</Badge>;
      case "promotor":
        return <Badge className="bg-green-500 text-xs">Promotor</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{role}</Badge>;
    }
  };

  // Only show to admins
  if (!isAdmin) {
    return null;
  }

  if (isImpersonating) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={stopImpersonation}
        className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
      >
        <X className="h-4 w-4" />
        Sair da Visualização
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          Visualizar como Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visualizar Sistema como Outro Usuário
          </DialogTitle>
          <DialogDescription>
            Selecione um usuário para ver como ele visualiza o sistema. 
            Suas permissões serão temporariamente substituídas pelas do usuário selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, role ou departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user.id, user.nome)}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent hover:border-primary/50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {user.nome}
                        {user.status === "inativo" && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.departamento_nome && (
                      <Badge variant="outline" className="text-xs">
                        {user.departamento_nome}
                      </Badge>
                    )}
                    {getRoleBadge(user.role || "vendedor")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
          <strong>Nota:</strong> Esta funcionalidade é apenas para visualização. 
          Nenhuma ação será executada como o usuário selecionado - você continuará logado como admin.
        </div>
      </DialogContent>
    </Dialog>
  );
};
