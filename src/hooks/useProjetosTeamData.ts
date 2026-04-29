import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export interface EquipeProjeto {
  id: string;
  nome: string;
  cor: string;
}

export interface ProjetoTeamMember {
  id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
  role: string;
  supervisor_id: string | null;
  departamento_id: string | null;
  projetos_ativos: number;
  tarefas_atribuidas: number;
  tarefas_concluidas: number;
  tarefas_atrasadas: number;
  taxa_conclusao: number;
  score: number;
  equipes: EquipeProjeto[];
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

      const DEPT_PROJETOS_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";
      const DEPT_COMPRAS_ID = "c2bafe92-2e57-4146-86bb-aca33d8fc02e";
      const DEPTS_INCLUIDOS = [DEPT_PROJETOS_ID, DEPT_COMPRAS_ID];

      // Verifica perfil do usuário (depto e supervisor) para decidir escopo
      const { data: meuPerfil } = await supabase
        .from("profiles")
        .select("supervisor_id, departamento_id")
        .eq("id", user.id)
        .maybeSingle();

      // "Gerente Geral": gerente sem supervisor em um dos deptos abrangidos
      // → enxerga o departamento inteiro (mesmo escopo do admin)
      const isGerenteGeral =
        isGerente &&
        !!meuPerfil &&
        meuPerfil.supervisor_id == null &&
        DEPTS_INCLUIDOS.includes(meuPerfil.departamento_id ?? "");

      // "Coordenador de área": supervisor sem supervisor acima em depto abrangido
      // (ex.: Rubens em Compras) → enxerga todos do próprio departamento
      const isCoordenadorArea =
        isSupervisor &&
        !!meuPerfil &&
        meuPerfil.supervisor_id == null &&
        DEPTS_INCLUIDOS.includes(meuPerfil.departamento_id ?? "");

      if (isAdmin || isGerenteGeral) {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("aprovado", true)
          .in("departamento_id", DEPTS_INCLUIDOS);
        memberIds = allProfiles?.map((p) => p.id) || [];
      } else if (isCoordenadorArea && meuPerfil?.departamento_id) {
        const { data: deptProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("aprovado", true)
          .eq("departamento_id", meuPerfil.departamento_id);
        memberIds = deptProfiles?.map((p) => p.id) || [];
        if (!memberIds.includes(user.id)) memberIds.push(user.id);
      } else if (isGerente || isSupervisor) {
        const { data: subordinados } = await supabase.rpc("get_subordinados", {
          _user_id: user.id,
        });
        memberIds = subordinados?.map((s: any) => s.subordinado_id) || [];
        // Inclui o próprio gerente/supervisor como raiz da árvore
        if (!memberIds.includes(user.id)) memberIds.push(user.id);
      }

      if (memberIds.length === 0) return [];

      // 2. Get profiles + roles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url, supervisor_id, departamento_id")
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

      // 5. Get equipe memberships
      const { data: equipeMembros } = await supabase
        .from("equipe_membros")
        .select("user_id, equipe_id, equipes_projetos(id, nome, cor)")
        .in("user_id", memberIds);

      const equipeMap = new Map<string, EquipeProjeto[]>();
      equipeMembros?.forEach((em: any) => {
        const list = equipeMap.get(em.user_id) || [];
        if (em.equipes_projetos) {
          list.push({ id: em.equipes_projetos.id, nome: em.equipes_projetos.nome, cor: em.equipes_projetos.cor });
        }
        equipeMap.set(em.user_id, list);
      });

      // 6. Build flat list with metrics
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
          departamento_id: (p as any).departamento_id ?? null,
          projetos_ativos: projetos,
          tarefas_atribuidas: stats.total,
          tarefas_concluidas: stats.done,
          tarefas_atrasadas: stats.overdue,
          taxa_conclusao: taxa,
          score,
          equipes: equipeMap.get(p.id) || [],
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
