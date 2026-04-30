import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CustoTec {
  id: string;
  mes: string;
  fornecedor: string;
  valor: number;
  descricao: string | null;
  created_at: string;
}

export function useCustosTecnologia() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["custos-tecnologia"];

  const { data: custos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projeto_custos_tecnologia_mensal")
        .select("*")
        .order("mes", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as CustoTec[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: { mes: string; fornecedor: string; valor: number; descricao?: string }) => {
      if (!user?.id) throw new Error("Sem usuário");
      const mesNorm = input.mes.length === 7 ? `${input.mes}-01` : input.mes; // YYYY-MM -> YYYY-MM-01
      const { error } = await (supabase as any)
        .from("projeto_custos_tecnologia_mensal")
        .upsert({
          mes: mesNorm,
          fornecedor: input.fornecedor,
          valor: input.valor,
          descricao: input.descricao ?? null,
          criado_por: user.id,
        }, { onConflict: "mes,fornecedor" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Custo registrado");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("projeto_custos_tecnologia_mensal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return { custos, isLoading, upsert, remover };
}
