import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  UserCheck, 
  Loader2, 
  Network, 
  ChevronRight, 
  ChevronDown,
  Shield,
  UserCog,
  User,
  UserCircle2,
  Search
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "gerente" | "supervisor" | "vendedor" | "promotor";
  supervisor_id: string | null;
  subordinados?: Usuario[];
  status: string;
}

export function HierarquiaUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [hierarquia, setHierarquia] = useState<Usuario[]>([]);
  const [hierarquiasPorSupervisor, setHierarquiasPorSupervisor] = useState<Map<string, Usuario[]>>(new Map());
  const [supervisores, setSupervisores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (usuarios.length > 0) {
      construirHierarquia();
    }
  }, [usuarios]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar todos os profiles ativos
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email, supervisor_id, status")
        .eq("status", "ativo")
        .order("nome");

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setUsuarios([]);
        return;
      }

      const userIds = profiles.map(p => p.id);

      // Buscar roles de todos os usuários
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Mapear roles por user_id
      const roleMap = new Map<string, string>();
      (roles || []).forEach(r => {
        roleMap.set(r.user_id, r.role);
      });

      // Criar lista de usuários
      const usuariosList: Usuario[] = profiles.map(profile => ({
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
        role: (roleMap.get(profile.id) || 'vendedor') as any,
        supervisor_id: profile.supervisor_id,
        status: profile.status,
        subordinados: []
      }));

      setUsuarios(usuariosList);

    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const construirHierarquia = () => {
    // Criar um mapa de usuários por ID para acesso rápido
    const usuariosMap = new Map<string, Usuario>();
    usuarios.forEach(u => {
      usuariosMap.set(u.id, { ...u, subordinados: [] });
    });

    // Separar supervisores
    const supervisoresList = usuarios.filter(u => u.role === 'supervisor' || u.role === 'gerente');
    setSupervisores(supervisoresList);

    // Construir a árvore de hierarquia
    const raiz: Usuario[] = [];
    const hierarquiasPorSup = new Map<string, Usuario[]>();

    // Inicializar cada supervisor com sua hierarquia
    supervisoresList.forEach(sup => {
      const supervisorNode = usuariosMap.get(sup.id);
      if (supervisorNode) {
        hierarquiasPorSup.set(sup.id, [supervisorNode]);
      }
    });

    // Construir subordinados para cada usuário
    usuarios.forEach(usuario => {
      const user = usuariosMap.get(usuario.id);
      if (!user) return;

      if (!usuario.supervisor_id) {
        // Usuários sem supervisor vão para a raiz (admins geralmente)
        if (usuario.role !== 'supervisor') {
          raiz.push(user);
        }
      } else {
        // Adicionar como subordinado do supervisor
        const supervisor = usuariosMap.get(usuario.supervisor_id);
        if (supervisor) {
          if (!supervisor.subordinados) {
            supervisor.subordinados = [];
          }
          supervisor.subordinados.push(user);
        } else {
          // Se o supervisor não existe, colocar na raiz
          raiz.push(user);
        }
      }
    });

    // Ordenar por role e nome
    const roleOrder: Record<string, number> = { admin: 0, gerente: 1, supervisor: 2, vendedor: 3, promotor: 4 };
    const sortUsuarios = (list: Usuario[]) => {
      list.sort((a, b) => {
        const roleCompare = roleOrder[a.role] - roleOrder[b.role];
        if (roleCompare !== 0) return roleCompare;
        return a.nome.localeCompare(b.nome);
      });
      list.forEach(u => {
        if (u.subordinados && u.subordinados.length > 0) {
          sortUsuarios(u.subordinados);
        }
      });
    };
    
    sortUsuarios(raiz);
    hierarquiasPorSup.forEach(h => sortUsuarios(h));

    setHierarquia(raiz);
    setHierarquiasPorSupervisor(hierarquiasPorSup);
  };

  const handleVincularSupervisor = async (usuarioId: string, supervisorId: string | null) => {
    try {
      setSaving(usuarioId);

      // Validar que não estamos criando um ciclo
      if (supervisorId && criariaciclo(usuarioId, supervisorId)) {
        toast({
          title: "Erro de hierarquia",
          description: "Não é possível criar uma hierarquia circular. O usuário selecionado é subordinado direto ou indireto deste usuário.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ supervisor_id: supervisorId })
        .eq("id", usuarioId);

      if (error) throw error;

      // Atualizar estado local
      setUsuarios(prev =>
        prev.map(u =>
          u.id === usuarioId ? { ...u, supervisor_id: supervisorId } : u
        )
      );

      toast({
        title: "Sucesso",
        description: supervisorId 
          ? "Vínculo hierárquico criado com sucesso" 
          : "Vínculo hierárquico removido com sucesso",
      });

    } catch (error) {
      console.error("Erro ao vincular supervisor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a hierarquia",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const criariaciclo = (usuarioId: string, novoSupervisorId: string): boolean => {
    // Verifica se o novo supervisor é subordinado (direto ou indireto) do usuário
    const verificarSubordinado = (userId: string, targetId: string): boolean => {
      const subordinados = usuarios.filter(u => u.supervisor_id === userId);
      
      for (const sub of subordinados) {
        if (sub.id === targetId) return true;
        if (verificarSubordinado(sub.id, targetId)) return true;
      }
      
      return false;
    };

    return verificarSubordinado(usuarioId, novoSupervisorId);
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleSupervisor = (supervisorId: string) => {
    const newExpanded = new Set(expandedSupervisors);
    if (newExpanded.has(supervisorId)) {
      newExpanded.delete(supervisorId);
    } else {
      newExpanded.add(supervisorId);
    }
    setExpandedSupervisors(newExpanded);
  };

  const expandirTodos = () => {
    const allIds = new Set<string>();
    supervisores.forEach(s => allIds.add(s.id));
    usuarios.forEach(u => allIds.add(u.id));
    setExpandedNodes(allIds);
    setExpandedSupervisors(allIds);
  };

  const recolherTodos = () => {
    setExpandedNodes(new Set());
    setExpandedSupervisors(new Set());
  };

  const getSuperioresPossiveis = (usuario: Usuario): Usuario[] => {
    // Retorna usuários que podem ser superiores deste usuário
    return usuarios.filter(u => {
      // Não pode ser ele mesmo
      if (u.id === usuario.id) return false;
      
      // Não pode ser um subordinado (evita ciclos)
      if (criariaCirculoComUsuario(usuario.id, u.id)) return false;

      // Regras de hierarquia:
      // - Admin pode ser superior de qualquer um
      // - Gerente pode ser superior de supervisor, vendedor e promotor
      // - Supervisor pode ser superior de vendedor e promotor
      // - Vendedor pode ser superior de promotor
      if (u.role === 'admin') return true;
      if (u.role === 'gerente' && (usuario.role === 'supervisor' || usuario.role === 'vendedor' || usuario.role === 'promotor')) return true;
      if (u.role === 'supervisor' && (usuario.role === 'vendedor' || usuario.role === 'promotor')) return true;
      if (u.role === 'vendedor' && usuario.role === 'promotor') return true;

      return false;
    });
  };

  const criariaCirculoComUsuario = (usuarioId: string, possivelSuperiorId: string): boolean => {
    // Verifica se o possível superior é subordinado do usuário
    let current: Usuario | undefined = usuarios.find(u => u.id === possivelSuperiorId);
    
    while (current && current.supervisor_id) {
      if (current.supervisor_id === usuarioId) return true;
      current = usuarios.find(u => u.id === current!.supervisor_id);
    }
    
    return false;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Shield;
      case 'gerente': return UserCog;
      case 'supervisor': return UserCog;
      case 'vendedor': return User;
      case 'promotor': return UserCircle2;
      default: return User;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'gerente': return 'default';
      case 'supervisor': return 'secondary';
      case 'vendedor': return 'outline';
      case 'promotor': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'gerente': return 'Gerente';
      case 'supervisor': return 'Supervisor';
      case 'vendedor': return 'Vendedor';
      case 'promotor': return 'Promotor';
      default: return role;
    }
  };

  const contarSubordinados = (usuario: Usuario): number => {
    let count = usuario.subordinados?.length || 0;
    usuario.subordinados?.forEach(sub => {
      count += contarSubordinados(sub);
    });
    return count;
  };

  const renderUsuario = (usuario: Usuario, nivel: number = 0) => {
    const Icon = getRoleIcon(usuario.role);
    const temSubordinados = usuario.subordinados && usuario.subordinados.length > 0;
    const isExpanded = expandedNodes.has(usuario.id);
    const superioresPossiveis = getSuperioresPossiveis(usuario);
    const totalSubordinados = contarSubordinados(usuario);

    return (
      <div key={usuario.id} className="space-y-2">
        <div 
          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          style={{ marginLeft: `${nivel * 24}px` }}
        >
          {temSubordinados ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleNode(usuario.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-6" />
          )}

          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <Badge variant={getRoleColor(usuario.role)}>
              {getRoleLabel(usuario.role)}
            </Badge>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate">{usuario.nome}</h4>
            <p className="text-sm text-muted-foreground truncate">{usuario.email}</p>
          </div>

          {temSubordinados && (
            <Badge variant="secondary" className="text-xs">
              {totalSubordinados} subordinado{totalSubordinados !== 1 ? 's' : ''}
            </Badge>
          )}

          <div className="flex items-center gap-2">
            <Select
              value={usuario.supervisor_id || "none"}
              onValueChange={(value) =>
                handleVincularSupervisor(
                  usuario.id,
                  value === "none" ? null : value
                )
              }
              disabled={saving === usuario.id || usuario.role === 'admin'}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Superior hierárquico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Sem superior</span>
                </SelectItem>
                {superioresPossiveis.map((superior) => (
                  <SelectItem key={superior.id} value={superior.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getRoleLabel(superior.role)}
                      </Badge>
                      <span>{superior.nome}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {saving === usuario.id && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {temSubordinados && isExpanded && (
          <div>
            {usuario.subordinados!.map(sub => renderUsuario(sub, nivel + 1))}
          </div>
        )}
      </div>
    );
  };

  const calcularEstatisticas = () => {
    const stats = {
      admins: usuarios.filter(u => u.role === 'admin').length,
      gerentes: usuarios.filter(u => u.role === 'gerente').length,
      supervisores: usuarios.filter(u => u.role === 'supervisor').length,
      vendedores: usuarios.filter(u => u.role === 'vendedor').length,
      promotores: usuarios.filter(u => u.role === 'promotor').length,
      semSuperior: usuarios.filter(u => !u.supervisor_id && u.role !== 'admin' && u.role !== 'gerente' && u.role !== 'supervisor').length,
    };
    return stats;
  };

  const calcularEstatisticasSupervisor = (supervisorId: string) => {
    const subordinados = usuarios.filter(u => {
      // Verificar se é subordinado direto ou indireto
      let current: Usuario | undefined = u;
      while (current && current.supervisor_id) {
        if (current.supervisor_id === supervisorId) return true;
        current = usuarios.find(user => user.id === current!.supervisor_id);
      }
      return false;
    });

    return {
      total: subordinados.length,
      vendedores: subordinados.filter(u => u.role === 'vendedor').length,
      promotores: subordinados.filter(u => u.role === 'promotor').length,
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando hierarquia...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = calcularEstatisticas();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Hierarquia em Pirâmide
          </CardTitle>
          <CardDescription>
            Gerencie a estrutura hierárquica da organização vinculando usuários entre si
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>Como funciona:</strong> Vincule usuários criando uma estrutura em pirâmide. 
              Admins ficam no topo, seguidos por gerentes, supervisores, vendedores e promotores. 
              O sistema impede a criação de hierarquias circulares.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{stats.admins}</p>
                  <p className="text-xs text-muted-foreground">Administradores</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <UserCog className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{stats.gerentes}</p>
                  <p className="text-xs text-muted-foreground">Gerentes</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <UserCog className="h-8 w-8 mx-auto mb-2 text-secondary" />
                  <p className="text-2xl font-bold">{stats.supervisores}</p>
                  <p className="text-xs text-muted-foreground">Supervisores</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.vendedores}</p>
                  <p className="text-xs text-muted-foreground">Vendedores</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <UserCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.promotores}</p>
                  <p className="text-xs text-muted-foreground">Promotores</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {stats.semSuperior > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Atenção:</strong> Existem {stats.semSuperior} usuário(s) sem superior hierárquico definido.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Hierarquias por Supervisor
              </CardTitle>
              <CardDescription>
                Visualize cada hierarquia de forma independente. Clique para expandir/recolher.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandirTodos}>
                Expandir Todos
              </Button>
              <Button variant="outline" size="sm" onClick={recolherTodos}>
                Recolher Todos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Admins (sem hierarquia) */}
          {usuarios.filter(u => u.role === 'admin').length > 0 && (
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Administradores</CardTitle>
                      <CardDescription className="text-xs">
                        Acesso total ao sistema
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="default">
                    {usuarios.filter(u => u.role === 'admin').length} admin(s)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {usuarios
                    .filter(u => u.role === 'admin')
                    .map(admin => renderUsuario(admin, 0))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hierarquias por Supervisor */}
          {supervisores.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nenhum supervisor cadastrado. Crie supervisores para começar a organizar hierarquias.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {supervisores.map(supervisor => {
                const hierarquia = hierarquiasPorSupervisor.get(supervisor.id) || [];
                const isExpanded = expandedSupervisors.has(supervisor.id);
                const stats = calcularEstatisticasSupervisor(supervisor.id);
                
                return (
                  <Card key={supervisor.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleSupervisor(supervisor.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </Button>
                          <UserCog className="h-6 w-6 text-secondary" />
                          <div className="flex-1">
                            <CardTitle className="text-lg">{supervisor.nome}</CardTitle>
                            <CardDescription className="text-xs">
                              {supervisor.email}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="secondary">
                            {stats.total} subordinado{stats.total !== 1 ? 's' : ''}
                          </Badge>
                          {stats.vendedores > 0 && (
                            <Badge variant="outline">
                              {stats.vendedores} vendedor{stats.vendedores !== 1 ? 'es' : ''}
                            </Badge>
                          )}
                          {stats.promotores > 0 && (
                            <Badge variant="outline">
                              {stats.promotores} promotor{stats.promotores !== 1 ? 'es' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent>
                        {hierarquia.length === 0 ? (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            Este supervisor ainda não possui subordinados
                          </div>
                        ) : (
                          <div className="space-y-2 pl-8">
                            {hierarquia.map(usuario => renderUsuario(usuario, 0))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Usuários sem supervisor */}
          {usuarios.filter(u => !u.supervisor_id && u.role !== 'admin' && u.role !== 'gerente' && u.role !== 'supervisor').length > 0 && (
            <Card className="border-2 border-dashed border-muted-foreground/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg text-muted-foreground">Sem Supervisor</CardTitle>
                      <CardDescription className="text-xs">
                        Usuários que precisam ser vinculados a um supervisor
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {usuarios.filter(u => !u.supervisor_id && u.role !== 'admin' && u.role !== 'gerente' && u.role !== 'supervisor').length} usuário(s)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {usuarios
                    .filter(u => !u.supervisor_id && u.role !== 'admin' && u.role !== 'gerente' && u.role !== 'supervisor')
                    .map(usuario => renderUsuario(usuario, 0))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
