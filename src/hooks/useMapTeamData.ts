import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserRole } from "@/hooks/useUserRole";

export interface MapTeamMember {
  id: string;
  nome: string;
  email: string;
  role: string;
  supervisor_id: string | null;
  // Métricas para ranking
  total_visitas: number;
  total_prospects: number;
  total_clientes_territorio: number;
}

export interface MapTeamGroup {
  supervisor: { id: string; nome: string } | null;
  members: MapTeamMember[];
}

export function useMapTeamData() {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const { isAdmin, isGerente, isSupervisor, isAdminOrSupervisor, loading: roleLoading } = useUserRole();

  const effectiveUserId = isImpersonating && impersonatedUser ? impersonatedUser.id : user?.id;
  const hasFullVisibility = isAdmin || isGerente;

  const teamQuery = useQuery({
    queryKey: ["map-team-hierarchy", effectiveUserId, hasFullVisibility, isSupervisor],
    queryFn: async () => {
      if (!effectiveUserId) return { flat: [], hierarchy: [], hasFullVisibility };

      let allProfiles: any[] = [];

      if (hasFullVisibility) {
        // Admin/Gerente: todos os perfis ativos
        const { data: profiles, error } = await (supabase
          .from("profiles")
          .select("id, nome, email, supervisor_id") as any)
          .eq("status", "ativo");

        if (error) throw error;
        allProfiles = profiles || [];
      } else if (isSupervisor) {
        // Supervisor: subordinados via get_subordinados
        const { data: subordinados, error: subError } = await supabase
          .rpc("get_subordinados", { _user_id: effectiveUserId });

        if (subError) throw subError;
        const subordinadoIds = subordinados?.map((s: any) => s.subordinado_id) || [];

        // Incluir o próprio supervisor
        const allIds = [effectiveUserId, ...subordinadoIds];

        if (allIds.length > 0) {
          const { data: profiles, error } = await (supabase
            .from("profiles")
            .select("id, nome, email, supervisor_id") as any)
            .in("id", allIds)
            .eq("status", "ativo");

          if (error) throw error;
          allProfiles = profiles || [];
        }
      } else {
        // Vendedor/Promotor: só vê a si mesmo
        const { data: profiles, error } = await (supabase
          .from("profiles")
          .select("id, nome, email, supervisor_id") as any)
          .eq("id", effectiveUserId)
          .eq("status", "ativo");

        if (error) throw error;
        allProfiles = profiles || [];
      }

      if (allProfiles.length === 0) return { flat: [], hierarchy: [], hasFullVisibility };

      // Buscar roles
      const memberIds = allProfiles.map((p: any) => p.id);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", memberIds);
      const rolesMap = new Map(rolesData?.map((r: any) => [r.user_id, r.role]) || []);

      // Buscar métricas de ranking: visitas (últimos 90 dias)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const startDateStr = ninetyDaysAgo.toISOString().split("T")[0];

      const { data: visitCounts } = await supabase
        .from("visits")
        .select("user_id")
        .in("user_id", memberIds)
        .gte("scheduled_date", startDateStr);

      const visitCountMap = new Map<string, number>();
      (visitCounts || []).forEach((v: any) => {
        visitCountMap.set(v.user_id, (visitCountMap.get(v.user_id) || 0) + 1);
      });

      // Prospects por vendedor
      const { data: prospectCounts } = await supabase
        .from("prospects")
        .select("vendedor_id")
        .in("vendedor_id", memberIds);

      const prospectCountMap = new Map<string, number>();
      (prospectCounts || []).forEach((p: any) => {
        prospectCountMap.set(p.vendedor_id, (prospectCountMap.get(p.vendedor_id) || 0) + 1);
      });

      // Territórios por vendedor
      const { data: territorioCounts } = await supabase
        .from("vendedor_territorios")
        .select("vendedor_id")
        .in("vendedor_id", memberIds)
        .eq("ativo", true);

      const territorioCountMap = new Map<string, number>();
      (territorioCounts || []).forEach((t: any) => {
        territorioCountMap.set(t.vendedor_id, (territorioCountMap.get(t.vendedor_id) || 0) + 1);
      });

      // Construir lista flat
      const flat: MapTeamMember[] = allProfiles
        .map((p: any) => ({
          id: p.id,
          nome: p.nome,
          email: p.email,
          role: rolesMap.get(p.id) || "vendedor",
          supervisor_id: p.supervisor_id,
          total_visitas: visitCountMap.get(p.id) || 0,
          total_prospects: prospectCountMap.get(p.id) || 0,
          total_clientes_territorio: territorioCountMap.get(p.id) || 0,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

      // Construir hierarquia agrupada
      const hierarchy: MapTeamGroup[] = [];

      // Agrupar por supervisor
      const directReports = flat.filter(m => m.supervisor_id === effectiveUserId);
      const indirectReports = flat.filter(m => m.supervisor_id !== effectiveUserId && m.id !== effectiveUserId);
      const selfProfile = flat.find(m => m.id === effectiveUserId);

      const supervisorGroups = new Map<string, MapTeamMember[]>();
      indirectReports.forEach(member => {
        const supId = member.supervisor_id || "sem-supervisor";
        if (!supervisorGroups.has(supId)) {
          supervisorGroups.set(supId, []);
        }
        supervisorGroups.get(supId)!.push(member);
      });

      // Supervisores diretos com suas equipes
      const directSupervisors = directReports.filter(m => m.role === "supervisor" || m.role === "gerente");
      const directNonSupervisors = directReports.filter(m => m.role !== "supervisor" && m.role !== "gerente");

      directSupervisors.forEach(sup => {
        const subMembers = supervisorGroups.get(sup.id) || [];
        hierarchy.push({
          supervisor: { id: sup.id, nome: sup.nome },
          members: [sup, ...subMembers],
        });
        supervisorGroups.delete(sup.id);
      });

      // Diretos não-supervisores
      if (directNonSupervisors.length > 0) {
        hierarchy.push({
          supervisor: null,
          members: directNonSupervisors,
        });
      }

      // Grupos restantes
      supervisorGroups.forEach((members, supId) => {
        const supProfile = flat.find(m => m.id === supId);
        hierarchy.push({
          supervisor: supProfile ? { id: supProfile.id, nome: supProfile.nome } : { id: supId, nome: "Equipe" },
          members,
        });
      });

      // Ranking: ordenar por visitas (desc), depois por prospects
      const ranking = [...flat]
        .filter(m => m.role === "vendedor" || m.role === "promotor" || m.role === "supervisor")
        .sort((a, b) => {
          const scoreA = a.total_visitas * 3 + a.total_prospects * 2 + a.total_clientes_territorio;
          const scoreB = b.total_visitas * 3 + b.total_prospects * 2 + b.total_clientes_territorio;
          return scoreB - scoreA;
        });

      return { flat, hierarchy, ranking, selfProfile, hasFullVisibility };
    },
    enabled: !!effectiveUserId && !roleLoading,
    staleTime: 10 * 60 * 1000,
  });

  return {
    team: teamQuery.data?.flat || [],
    hierarchy: teamQuery.data?.hierarchy || [],
    ranking: teamQuery.data?.ranking || [],
    selfProfile: teamQuery.data?.selfProfile || null,
    hasFullVisibility: teamQuery.data?.hasFullVisibility || false,
    isLoading: teamQuery.isLoading || roleLoading,
  };
}
