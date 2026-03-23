import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserProfileAssignment {
  id: string;
  user_id: string;
  profile_id: string;
  assigned_by: string | null;
  created_at: string;
}

export function useErpUserProfiles() {
  return useQuery({
    queryKey: ["erp-user-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_portal_user_profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as UserProfileAssignment[];
    },
  });
}

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ["erp-current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("erp_portal_user_profiles")
        .select("profile_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.profile_id || null;
    },
  });
}

export function useAssignUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, profileId }: { userId: string; profileId: string | null }) => {
      if (!profileId) {
        const { error } = await supabase
          .from("erp_portal_user_profiles")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { data: existing } = await supabase
          .from("erp_portal_user_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        const { data: currentUser } = await supabase.auth.getUser();

        if (existing) {
          const { error } = await supabase
            .from("erp_portal_user_profiles")
            .update({ profile_id: profileId, assigned_by: currentUser.user?.id } as any)
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("erp_portal_user_profiles")
            .insert({ user_id: userId, profile_id: profileId, assigned_by: currentUser.user?.id } as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp-user-profiles"] });
      toast.success("Perfil do usuário atualizado");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}
