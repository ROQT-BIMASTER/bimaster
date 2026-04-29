import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ProjetoConviteInput } from "@/lib/validations/projetoConvite";

export interface ProjetoConvite {
  id: string;
  projeto_id: string;
  email: string;
  convidado_user_id: string | null;
  convidado_por: string;
  papel: string;
  secoes_ids: string[];
  mensagem: string | null;
  token: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  convidante_nome?: string | null;
}

export function useProjetoConvites(projetoId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: convites = [], isLoading } = useQuery({
    queryKey: ["projeto_convites", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      const { data, error } = await supabase
        .from("projeto_convites" as any)
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjetoConvite[];
    },
    enabled: !!projetoId && !!user,
  });

  const create = useMutation({
    mutationFn: async (input: ProjetoConviteInput) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("projeto_convites" as any)
        .insert({
          projeto_id: input.projeto_id,
          email: input.email.toLowerCase(),
          papel: input.papel,
          secoes_ids: input.secoes_ids,
          mensagem: input.mensagem || null,
          convidado_por: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjetoConvite;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projeto_convites", projetoId] });
      toast.success("Convite enviado!");
    },
    onError: (e: Error) => {
      const msg = e.message.includes("projeto_convites_unique_pending")
        ? "Já existe um convite pendente para este e-mail."
        : "Erro ao criar convite: " + e.message;
      toast.error(msg);
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("cancel_projeto_convite" as any, { _id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projeto_convites", projetoId] });
      toast.success("Convite cancelado.");
    },
    onError: (e: Error) => toast.error("Erro ao cancelar: " + e.message),
  });

  return { convites, isLoading, create, cancel };
}

export function useMeusConvitesPendentes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["meus_convites_pendentes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("projeto_convites" as any)
        .select("*, projetos(nome)")
        .eq("status", "pending")
        .or(`convidado_user_id.eq.${user.id},email.eq.${user.email?.toLowerCase()}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });
}
