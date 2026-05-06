import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ApontamentoInput {
  ordem_producao_id: string;
  data: string; // YYYY-MM-DD
  quantidade: number;
  turno?: "manha" | "tarde" | "noite";
  nota?: string;
}

export function useRegistrarApontamentoOP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ApontamentoInput) => {
      if (!(p.quantidade > 0)) throw new Error("Quantidade deve ser maior que zero");
      const user = (await supabase.auth.getUser()).data.user;
      // Compor timestamp do evento a partir da data + hora atual local
      const now = new Date();
      const [y, m, d] = p.data.split("-").map(Number);
      const ts = new Date(y, (m || 1) - 1, d || 1, now.getHours(), now.getMinutes(), 0).toISOString();

      const obs = [
        p.turno ? `Turno: ${p.turno}` : null,
        p.nota?.trim() ? p.nota.trim() : null,
      ].filter(Boolean).join(" — ") || null;

      const { error } = await supabase.from("fabrica_apontamentos" as any).insert({
        ordem_producao_id: p.ordem_producao_id,
        tipo: "producao",
        quantidade_apontada: p.quantidade,
        timestamp_evento: ts,
        observacoes: obs,
        operador_id: user?.id || null,
        created_by: user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fabrica-op-da-oc"] });
      qc.invalidateQueries({ queryKey: ["china-oc-recebimento-kpis"] });
      toast.success("Apontamento registrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar apontamento"),
  });
}
