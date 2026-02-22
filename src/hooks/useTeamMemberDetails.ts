import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { toast } from "sonner";
import type { TeamMemberFormData } from "@/lib/validations/teamMember";

export interface TeamMemberDetail {
  id: string;
  user_id: string;
  nome_completo: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  email_pessoal: string | null;
  whatsapp: string | null;
  tamanho_camiseta: string | null;
  equipe_comercial: string | null;
  supervisor_nome: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TeamMemberWithProfile {
  user_id: string;
  profile_nome: string;
  profile_email: string;
  profile_role: string | null;
  profile_avatar_url: string | null;
  profile_supervisor_id: string | null;
  details: TeamMemberDetail | null;
  cadastro_completo: boolean;
}

const REQUIRED_FIELDS: (keyof TeamMemberDetail)[] = [
  "nome_completo",
  "cpf",
  "whatsapp",
  "tamanho_camiseta",
  "equipe_comercial",
  "supervisor_nome",
];

function isCadastroCompleto(details: TeamMemberDetail | null): boolean {
  if (!details) return false;
  return REQUIRED_FIELDS.every((field) => {
    const val = details[field];
    return val !== null && val !== undefined && String(val).trim() !== "";
  });
}

export function useTeamMemberDetails(teamMemberIds: string[]) {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const effectiveUserId = isImpersonating && impersonatedUser ? impersonatedUser.id : user?.id;
  const queryClient = useQueryClient();

  // Buscar perfis dos membros da equipe
  const profilesQuery = useQuery({
    queryKey: ["team-member-profiles", teamMemberIds],
    queryFn: async () => {
      if (!teamMemberIds.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url, supervisor_id")
        .in("id", teamMemberIds);
      if (error) throw error;
      return data || [];
    },
    enabled: teamMemberIds.length > 0,
  });

  // Buscar detalhes cadastrais
  const detailsQuery = useQuery({
    queryKey: ["team-member-details", teamMemberIds],
    queryFn: async () => {
      if (!teamMemberIds.length) return [];
      const { data, error } = await supabase
        .from("team_member_details")
        .select("*")
        .in("user_id", teamMemberIds);
      if (error) throw error;
      return (data || []) as TeamMemberDetail[];
    },
    enabled: teamMemberIds.length > 0,
  });

  // Buscar roles dos membros
  const rolesQuery = useQuery({
    queryKey: ["team-member-roles", teamMemberIds],
    queryFn: async () => {
      if (!teamMemberIds.length) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", teamMemberIds);
      if (error) throw error;
      return data || [];
    },
    enabled: teamMemberIds.length > 0,
  });

  // Combinar perfis + detalhes + roles
  const members: TeamMemberWithProfile[] = (profilesQuery.data || []).map((profile) => {
    const details = (detailsQuery.data || []).find((d) => d.user_id === profile.id) || null;
    const roleEntry = (rolesQuery.data || []).find((r) => r.user_id === profile.id);
    return {
      user_id: profile.id,
      profile_nome: profile.nome || profile.email || "Sem nome",
      profile_email: profile.email || "",
      profile_role: roleEntry?.role || null,
      profile_avatar_url: profile.avatar_url,
      profile_supervisor_id: (profile as any).supervisor_id || null,
      details,
      cadastro_completo: isCadastroCompleto(details),
    };
  });

  // Upsert (criar ou atualizar) dados do membro
  const upsertMutation = useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: TeamMemberFormData;
    }) => {
      // Limpar CPF e WhatsApp (armazenar apenas dígitos)
      const cleanedData = {
        user_id: userId,
        nome_completo: data.nome_completo,
        cpf: data.cpf.replace(/\D/g, ""),
        rg: data.rg || null,
        data_nascimento: data.data_nascimento || null,
        email_pessoal: data.email_pessoal || null,
        whatsapp: data.whatsapp.replace(/\D/g, ""),
        tamanho_camiseta: data.tamanho_camiseta,
        equipe_comercial: data.equipe_comercial,
        supervisor_nome: data.supervisor_nome,
        observacoes: data.observacoes || null,
        created_by: effectiveUserId,
      };

      const { data: result, error } = await supabase
        .from("team_member_details")
        .upsert(cleanedData, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Cadastro salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["team-member-details"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar cadastro:", error);
      toast.error("Erro ao salvar cadastro: " + error.message);
    },
  });

  return {
    members,
    isLoading: profilesQuery.isLoading || detailsQuery.isLoading || rolesQuery.isLoading,
    isError: profilesQuery.isError || detailsQuery.isError || rolesQuery.isError,
    upsertMember: upsertMutation.mutate,
    isUpserting: upsertMutation.isPending,
    refetch: () => {
      profilesQuery.refetch();
      detailsQuery.refetch();
    },
  };
}
