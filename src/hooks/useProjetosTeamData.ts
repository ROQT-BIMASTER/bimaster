import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export interface ProjetoTeamMember {
  id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
  role: string;
  supervisor_id: string | null;
  projetos_ativos: number;
  tarefas_atribuidas: number;
  tarefas_concluidas: number;
  tarefas_atrasadas: number;
  taxa_conclusao: number;
  score: number;
  subordinados?: ProjetoTeamMember[];
}

export function useProjetosTeamData() {
  const { user } = useAuth();
  const { isAdmin, isGerente, isSupervisor, isAdminOrSupervisor } = useUserRole();

  return useQuery({
    queryKey: ["projetos-team-data", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // 1. Get team member IDs based on hierarchy
      let memberIds: string[] = [];

      if (isAdmin) {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("aprovado", true);
        memberIds = allProfiles?.map((p) => p.id) || [];
      } else if (isGerente || isSupervisor) {
        const { data: subordinados } = await supabase.rpc("get_subordinados", {
          _user_id: user.id,
        });
        memberIds = subordinados?.map((s: any) => s.subordinado_id) || [];
      }

      if (memberIds.length === 0) return [];

      // 2. Get profiles + roles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url, supervisor_id")
        .in("id", memberIds);

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", memberIds);

      const rolesMap = new Map(rolesData?.map((r) => [r.user_id, r.role]) || []);

      // 3. Get project membership counts
      const { data: memberships } = await supabase
        .from("projeto_membros")
        .select("user_id, projeto_id")
        .in("user_id", memberIds);

      const projectCountMap = new Map<string, number>();
      memberships?.forEach((m) => {
        projectCountMap.set(m.user_id, (projectCountMap.get(m.user_id) || 0) + 1);
      });

      // 4. Get task stats per member
      const { data: tasks } = await supabase
        .from("projeto_tarefas")
        .select("responsavel_id, status, data_prazo")
        .in("responsavel_id", memberIds);

      const taskStats = new Map<string, { total: number; done: number; overdue: number }>();
      const today = new Date().toISOString().split("T")[0];

      tasks?.forEach((t) => {
        const uid = t.responsavel_id!;
        if (!taskStats.has(uid)) taskStats.set(uid, { total: 0, done: 0, overdue: 0 });
        const s = taskStats.get(uid)!;
        s.total++;
        if (t.status === "concluida") s.done++;
        if (t.status !== "concluida" && t.data_prazo && t.data_prazo < today) s.overdue++;
      });

      // 5. Build flat list with metrics
      const members: ProjetoTeamMember[] = (profiles || []).map((p) => {
        const stats = taskStats.get(p.id) || { total: 0, done: 0, overdue: 0 };
        const projetos = projectCountMap.get(p.id) || 0;
        const taxa = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
        const score = stats.done * 3 + projetos * 2;

        return {
          id: p.id,
          nome: p.nome,
          email: p.email,
          avatar_url: p.avatar_url,
          role: rolesMap.get(p.id) || "vendedor",
          supervisor_id: p.supervisor_id,
          projetos_ativos: projetos,
          tarefas_atribuidas: stats.total,
          tarefas_concluidas: stats.done,
          tarefas_atrasadas: stats.overdue,
          taxa_conclusao: taxa,
          score,
        };
      });

      // 6. Build hierarchy tree
      return buildHierarchy(members);
    },
    enabled: !!user && isAdminOrSupervisor,
  });
}

function buildHierarchy(members: ProjetoTeamMember[]): ProjetoTeamMember[] {
  const map = new Map<string, ProjetoTeamMember>();
  members.forEach((m) => map.set(m.id, { ...m, subordinados: [] }));

  const roots: ProjetoTeamMember[] = [];
  map.forEach((member) => {
    if (member.supervisor_id && map.has(member.supervisor_id)) {
      map.get(member.supervisor_id)!.subordinados!.push(member);
    } else {
      roots.push(member);
    }
  });

  return roots;
}
