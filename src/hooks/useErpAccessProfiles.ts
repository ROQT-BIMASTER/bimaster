import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AccessProfile {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  modules: AccessModule[];
}

export interface AccessModule {
  id: string;
  profile_id: string;
  module_id: string;
  api_id: string | null;
  visivel: boolean;
}

export function useErpAccessProfiles() {
  return useQuery({
    queryKey: ["erp-access-profiles"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("erp_portal_access_profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (pErr) throw pErr;

      const { data: modules, error: mErr } = await supabase
        .from("erp_portal_access_modules")
        .select("*");
      if (mErr) throw mErr;

      return (profiles || []).map((p: any) => ({
        ...p,
        modules: (modules || []).filter((m: any) => m.profile_id === p.id),
      })) as AccessProfile[];
    },
  });
}

export function useAccessProfileForKey(profileId: string | null) {
  return useQuery({
    queryKey: ["erp-access-profile-modules", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("erp_portal_access_modules")
        .select("*")
        .eq("profile_id", profileId);
      if (error) throw error;
      return data as AccessModule[];
    },
    enabled: !!profileId,
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, descricao, modules }: { nome: string; descricao: string; modules: { module_id: string; api_id: string | null }[] }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data: profile, error } = await supabase
        .from("erp_portal_access_profiles")
        .insert({ nome, descricao, created_by: user.user?.id })
        .select()
        .single();
      if (error) throw error;

      if (modules.length > 0) {
        const rows = modules.map(m => ({
          profile_id: profile.id,
          module_id: m.module_id,
          api_id: m.api_id,
          visivel: true,
        }));
        const { error: mErr } = await supabase.from("erp_portal_access_modules").insert(rows);
        if (mErr) throw mErr;
      }
      return profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp-access-profiles"] });
      toast.success("Perfil criado com sucesso");
    },
    onError: (e: any) => toast.error("Erro ao criar perfil: " + e.message),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome, descricao, modules }: { id: string; nome: string; descricao: string; modules: { module_id: string; api_id: string | null }[] }) => {
      const { error } = await supabase
        .from("erp_portal_access_profiles")
        .update({ nome, descricao, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Replace all modules
      const { error: delErr } = await supabase
        .from("erp_portal_access_modules")
        .delete()
        .eq("profile_id", id);
      if (delErr) throw delErr;

      if (modules.length > 0) {
        const rows = modules.map(m => ({
          profile_id: id,
          module_id: m.module_id,
          api_id: m.api_id,
          visivel: true,
        }));
        const { error: mErr } = await supabase.from("erp_portal_access_modules").insert(rows);
        if (mErr) throw mErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp-access-profiles"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: any) => toast.error("Erro ao atualizar: " + e.message),
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("erp_portal_access_profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp-access-profiles"] });
      toast.success("Perfil removido");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });
}

export function useAssignProfileToKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ keyId, profileId }: { keyId: string; profileId: string | null }) => {
      const { error } = await supabase
        .from("erp_api_keys")
        .update({ access_profile_id: profileId } as any)
        .eq("id", keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp-api-keys"] });
      toast.success("Perfil vinculado à chave");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}
