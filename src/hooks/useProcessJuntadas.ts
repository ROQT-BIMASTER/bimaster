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
  despacho_modulo: string | null;
  despacho_descricao: string | null;
  despacho_data: string | null;
  despacho_por: string | null;
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

  const despacharJuntada = useMutation({
    mutationFn: async (input: {
      juntada_id: string;
      despacho_modulo: string;
      despacho_descricao?: string;
    }) => {
      const { error } = await (supabase
        .from("process_juntadas" as any)
        .update({
          despacho_modulo: input.despacho_modulo,
          despacho_descricao: input.despacho_descricao || null,
          despacho_data: new Date().toISOString(),
          despacho_por: user?.id,
        })
        .eq("id", input.juntada_id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-juntadas", processId] });
      toast.success("Documento despachado com sucesso");
    },
    onError: (err: any) => {
      toast.error("Erro ao despachar documento: " + err.message);
    },
  });

  return { juntadas, isLoading, addJuntada, despacharJuntada };
}
