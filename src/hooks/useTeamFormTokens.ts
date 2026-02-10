import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useTeamFormTokens() {
  const queryClient = useQueryClient();

  const tokensQuery = useQuery({
    queryKey: ["team-form-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_form_tokens")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submissionsQuery = useQuery({
    queryKey: ["team-form-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_form_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generateToken = useMutation({
    mutationFn: async (params: {
      label: string;
      equipe_comercial?: string;
      supervisor_nome?: string;
      hours_valid?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Generate readable token
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let tokenValue = "";
      for (let i = 0; i < 8; i++) {
        tokenValue += chars[Math.floor(Math.random() * chars.length)];
      }

      // Hash the token
      const encoder = new TextEncoder();
      const data = encoder.encode(tokenValue);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const hoursValid = params.hours_valid || 24;
      const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from("team_form_tokens").insert({
        token_hash: tokenHash,
        token_plain: tokenValue,
        label: params.label,
        equipe_comercial: params.equipe_comercial || null,
        supervisor_nome: params.supervisor_nome || null,
        expires_at: expiresAt,
        created_by: user.id,
      } as any);

      if (error) throw error;
      return tokenValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-form-tokens"] });
    },
    onError: (err) => {
      toast({
        title: "Erro ao gerar token",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const revokeToken = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("team_form_tokens")
        .update({ status: "revoked" })
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-form-tokens"] });
      toast({ title: "Token revogado com sucesso" });
    },
  });

  return {
    tokens: tokensQuery.data || [],
    submissions: submissionsQuery.data || [],
    isLoadingTokens: tokensQuery.isLoading,
    isLoadingSubmissions: submissionsQuery.isLoading,
    generateToken,
    revokeToken,
  };
}
