import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ChevronRight, User, X } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TeamMember {
  id: string;
  nome: string;
  email: string;
  role: string;
  supervisor_id: string | null;
  subordinados?: TeamMember[];
}

interface TeamHierarchyFilterProps {
  onUserSelect: (userId: string | null) => void;
  selectedUserId: string | null;
}

export const TeamHierarchyFilter = ({ onUserSelect, selectedUserId }: TeamHierarchyFilterProps) => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTeamHierarchy();
  }, []);

  const fetchTeamHierarchy = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar role do usuário atual
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setCurrentUserRole(roleData?.role || null);

      // Se for admin, busca todos os usuários
      if (roleData?.role === 'admin') {
        const { data: profiles, error } = await (supabase
          .from("profiles")
          .select("id, nome, email, supervisor_id") as any)
          .eq("aprovado", true)
          .neq("departamento_id", "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130")
          .order("nome");

        if (error) throw error;

        // Buscar roles separadamente
        const userIds = profiles?.map(p => p.id) || [];
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

        const profilesWithRole = profiles?.map(p => ({
          id: p.id,
          nome: p.nome,
          email: p.email,
          supervisor_id: p.supervisor_id,
          role: rolesMap.get(p.id) || 'vendedor'
        })) || [];

        const hierarchy = buildHierarchy(profilesWithRole);
        setTeam(hierarchy);
      } else if (roleData?.role === 'supervisor') {
        // Se for supervisor, busca apenas seus subordinados
        const { data: subordinados, error } = await supabase
          .rpc('get_subordinados', { _user_id: user.id });

        if (error) throw error;

        if (subordinados && subordinados.length > 0) {
          const subordinadosIds = subordinados.map((s: any) => s.subordinado_id);
          
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, nome, email, supervisor_id")
            .in("id", subordinadosIds);

          if (profilesError) throw profilesError;

          // Buscar roles separadamente
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", subordinadosIds);

          const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

          const profilesWithRole = profiles?.map(p => ({
            id: p.id,
            nome: p.nome,
            email: p.email,
            supervisor_id: p.supervisor_id,
            role: rolesMap.get(p.id) || 'vendedor'
          })) || [];

          const hierarchy = buildHierarchy(profilesWithRole);
          setTeam(hierarchy);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar hierarquia:", error);
      toast.error("Erro ao carregar equipe");
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = (profiles: TeamMember[]): TeamMember[] => {
    const map = new Map<string, TeamMember>();
    profiles.forEach(p => map.set(p.id, { ...p, subordinados: [] }));

    const roots: TeamMember[] = [];
    map.forEach(member => {
      if (member.supervisor_id && map.has(member.supervisor_id)) {
        const supervisor = map.get(member.supervisor_id);
        if (supervisor) {
          if (!supervisor.subordinados) supervisor.subordinados = [];
          supervisor.subordinados.push(member);
        }
      } else {
        roots.push(member);
      }
    });

    return roots;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return '👑';
      case 'gerente':
        return '🏆';
      case 'supervisor':
        return '👨‍💼';
      case 'vendedor':
        return '💼';
      case 'promotor':
        return '🎯';
      default:
        return '👤';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin',
      gerente: 'Gerente',
      supervisor: 'Supervisor',
      vendedor: 'Vendedor',
      promotor: 'Promotor'
    };
    return labels[role] || role;
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderMember = (member: TeamMember, level: number = 0) => {
    const hasSubordinados = member.subordinados && member.subordinados.length > 0;
    const isExpanded = expandedNodes.has(member.id);
    const isSelected = selectedUserId === member.id;

    return (
      <div key={member.id} className="space-y-1">
        <div 
          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors hover:bg-accent/50 ${
            isSelected ? 'bg-primary/10 border border-primary/20' : ''
          }`}
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
          onClick={() => onUserSelect(isSelected ? null : member.id)}
        >
          {hasSubordinados && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(member.id);
              }}
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </Button>
          )}
          {!hasSubordinados && <div className="w-6" />}
          
          <span className="text-lg">{getRoleIcon(member.role)}</span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{member.nome}</span>
              <Badge variant="outline" className="text-xs">
                {getRoleLabel(member.role)}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground truncate block">{member.email}</span>
          </div>

          {isSelected && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onUserSelect(null);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {hasSubordinados && isExpanded && (
          <div className="space-y-1">
            {member.subordinados!.map(sub => renderMember(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Carregando equipe...
        </CardContent>
      </Card>
    );
  }

  if (!currentUserRole || (currentUserRole !== 'admin' && currentUserRole !== 'gerente' && currentUserRole !== 'supervisor')) {
    return null;
  }

  if (team.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Minha Equipe
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          Nenhum membro da equipe encontrado
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Minha Equipe
          </CardTitle>
          {selectedUserId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUserSelect(null)}
            >
              Limpar Filtro
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Clique em um membro para filtrar suas visitas
        </p>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
        {team.map(member => renderMember(member))}
      </CardContent>
    </Card>
  );
};
