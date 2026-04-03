import { useState, useEffect, useMemo } from "react";
import { Eye, Search, Loader2, User, X, Filter, Building2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  role: string;
  departamento_nome?: string | null;
  status?: string;
  empresas: string[];
}

const getRoleBadge = (role: string) => {
  switch (role) {
    case "admin":
      return <Badge variant="destructive" className="text-xs">Admin</Badge>;
    case "gerente":
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs">Gerente</Badge>;
    case "supervisor":
      return <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-xs">Supervisor</Badge>;
    case "vendedor":
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-xs">Vendedor</Badge>;
    case "promotor":
      return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">Promotor</Badge>;
    case "cliente":
      return <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs">Cliente</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">{role}</Badge>;
  }
};

export const ImpersonationSelector = () => {
  const { isAdmin } = usePermissions();
  const { isImpersonating, startImpersonation, stopImpersonation, loading } = useImpersonation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ativo");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const [{ data: { user } }, { data: profiles, error: profilesError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select(`id, nome, email, status, departamentos:departamento_id(nome)`)
          .eq("aprovado", true)
          .order("nome"),
      ]);

      if (user) setCurrentUserId(user.id);
      if (profilesError) throw profilesError;

      const [{ data: roles }, { data: userEmpresas }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_empresas").select("user_id, empresa:empresas(nome_fantasia, nome)"),
      ]);

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const empresasMap = new Map<string, string[]>();
      (userEmpresas || []).forEach((ue: any) => {
        const name = ue.empresa?.nome_fantasia || ue.empresa?.nome;
        if (!name) return;
        const list = empresasMap.get(ue.user_id) || [];
        list.push(name);
        empresasMap.set(ue.user_id, list);
      });

      const result: UserProfile[] = (profiles || []).map((p: any) => ({
        id: p.id,
        nome: p.nome || p.email,
        email: p.email,
        role: rolesMap.get(p.id) || "vendedor",
        departamento_nome: p.departamentos?.nome || null,
        status: p.status || "ativo",
        empresas: empresasMap.get(p.id) || [],
      }));

      setUsers(result);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast.error("Erro ao carregar lista de usuários");
    } finally {
      setLoadingUsers(false);
    }
  };

  const availableRoles = useMemo(() => {
    const set = new Set(users.map(u => u.role));
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (currentUserId && u.id === currentUserId) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          u.nome?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s) ||
          u.role?.toLowerCase().includes(s) ||
          u.departamento_nome?.toLowerCase().includes(s) ||
          u.empresas.some(e => e.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [users, search, filterStatus, filterRole, currentUserId]);

  const handleSelectUser = async (userId: string, userName: string) => {
    const success = await startImpersonation(userId);
    if (success) {
      toast.success(`Visualizando sistema como ${userName}`);
      setOpen(false);
    } else {
      toast.error("Erro ao iniciar visualização como usuário");
    }
  };

  if (!isAdmin) return null;

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
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Todas as roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as roles</SelectItem>
                {availableRoles.map(r => (
                  <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredUsers.length} usuário{filteredUsers.length !== 1 ? "s" : ""}
            </span>
          </div>
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
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u.id, u.nome)}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent hover:border-primary/50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {u.nome}
                        {u.status === "inativo" && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{u.email}</div>
                      {(u.departamento_nome || u.empresas.length > 0) && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {u.departamento_nome && (
                            <Badge variant="outline" className="text-[10px] py-0">{u.departamento_nome}</Badge>
                          )}
                          {u.empresas.map((e, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] py-0 gap-1">
                              <Building2 className="h-2.5 w-2.5" />{e}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 ml-2">
                    {getRoleBadge(u.role)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
          <strong>Nota:</strong> Esta funcionalidade é apenas para visualização.
          Nenhuma ação será executada como o usuário selecionado.
        </div>
      </DialogContent>
    </Dialog>
  );
};
