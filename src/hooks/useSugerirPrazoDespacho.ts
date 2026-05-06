import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addBusinessHours, diffBusinessDays } from "@/lib/utils/businessDays";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

export interface PrazoSugestao {
  prazo: Date;
  prazoIso: string; // YYYY-MM-DD
  origem: "tarefa" | "tipo_doc" | "default";
  horas_uteis: number | null;
  aviso?: string;
}

function toIsoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function useSugerirPrazoDespacho(params: {
  tipo_documento?: string | null;
  tarefa_id?: string | null;
}) {
  const { tipo_documento, tarefa_id } = params;
  return useQuery({
    queryKey: ["sugerir-prazo-despacho", tipo_documento, tarefa_id],
    queryFn: async (): Promise<PrazoSugestao> => {
      // 1. Tarefa
      if (tarefa_id) {
        const { data } = await supabase
          .from("projeto_tarefas")
          .select("data_prazo")
          .eq("id", tarefa_id)
          .maybeSingle();
        const prazoTar = parseLocalDate(data?.data_prazo);
        if (prazoTar) {
          return {
            prazo: prazoTar,
            prazoIso: toIsoDate(prazoTar),
            origem: "tarefa",
            horas_uteis: null,
          };
        }
      }
      // 2. SLA padrão por tipo
      if (tipo_documento) {
        const { data } = await (supabase
          .from("china_doc_sla_default" as any)
          .select("horas_uteis")
          .eq("tipo_documento", tipo_documento)
          .maybeSingle() as any);
        if (data?.horas_uteis) {
          const prazo = addBusinessHours(new Date(), data.horas_uteis);
          return {
            prazo,
            prazoIso: toIsoDate(prazo),
            origem: "tipo_doc",
            horas_uteis: data.horas_uteis,
          };
        }
      }
      // 3. Default 5 dias úteis
      const prazo = addBusinessHours(new Date(), 5 * 9);
      return {
        prazo,
        prazoIso: toIsoDate(prazo),
        origem: "default",
        horas_uteis: 45,
      };
    },
    staleTime: 60_000,
  });
}

export function avisoPrazoVsTarefa(prazoIso: string, tarefaPrazoIso?: string | null): string | undefined {
  if (!tarefaPrazoIso) return undefined;
  const a = parseLocalDate(prazoIso);
  const b = parseLocalDate(tarefaPrazoIso);
  if (!a || !b) return undefined;
  const diff = diffBusinessDays(b, a);
  if (diff > 0) return `Excede prazo da tarefa em ${diff} dia(s) útil(eis).`;
  return undefined;
}

export { toIsoDate };
