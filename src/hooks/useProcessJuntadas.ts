import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProcessJuntada {
  id: string;
  process_id: string;
  documento_titulo: string;
  documento_path: string | null;
  documento_url: string | null;
  folhas: string | null;
  tipo_documento: string;
  parecer: string | null;
  parecer_status: string;
  juntado_por: string | null;
  juntado_por_nome: string | null;
  departamento_id: string | null;
  created_at: string;
}

export function useProcessJuntadas(processId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: juntadas = [], isLoading } = useQuery({
    queryKey: ["process-juntadas", processId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_juntadas" as any)
        .select("*")
        .eq("process_id", processId!)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as ProcessJuntada[];
    },
    enabled: !!processId,
  });

  const addJuntada = useMutation({
    mutationFn: async (input: {
      process_id: string;
      documento_titulo: string;
      documento_path?: string;
      documento_url?: string;
      folhas?: string;
      tipo_documento: string;
      parecer?: string;
      parecer_status?: string;
      juntado_por_nome?: string;
      departamento_id?: string;
    }) => {
      const { error } = await (supabase
        .from("process_juntadas" as any)
        .insert({
          ...input,
          juntado_por: user?.id,
          juntado_por_nome: input.juntado_por_nome || user?.email,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-juntadas", processId] });
      toast.success("Documento juntado ao processo com sucesso");
    },
    onError: (err: any) => {
      toast.error("Erro ao juntar documento: " + err.message);
    },
  });

  return { juntadas, isLoading, addJuntada };
}
