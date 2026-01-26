import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isBefore } from "date-fns";

interface Atividade {
  id: string;
  tipo: string;
  resultado: string | null;
  data_atividade: string;
  proximo_followup: string | null;
}

interface Stats {
  total: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  taxaConclusao: number;
}

// Hook otimizado para buscar atividades e calcular estatísticas
export function useAtividadesStats() {
  return useQuery({
    queryKey: ['atividades-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades")
        .select("id, tipo, resultado, data_atividade, proximo_followup")
        .order("data_atividade", { ascending: false });

      if (error) throw error;

      const atividades = (data || []) as Atividade[];
      const hoje = new Date();
      
      const concluidas = atividades.filter(a => a.resultado === "positivo").length;
      const pendentes = atividades.filter(a => !a.resultado).length;
      const atrasadas = atividades.filter(a => 
        a.proximo_followup && 
        isBefore(new Date(a.proximo_followup), hoje) &&
        !a.resultado
      ).length;

      const stats: Stats = {
        total: atividades.length,
        concluidas,
        pendentes,
        atrasadas,
        taxaConclusao: atividades.length > 0 ? Math.round((concluidas / atividades.length) * 100) : 0,
      };

      return { atividades, stats };
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

// Funções de agregação para gráficos
export function getAtividadesPorTipo(atividades: Atividade[]) {
  const tipos = ["ligacao", "email", "reuniao", "visita"];
  const labels: Record<string, string> = {
    ligacao: "Ligações",
    email: "E-mails",
    reuniao: "Reuniões",
    visita: "Visitas",
  };

  return tipos.map(tipo => ({
    name: labels[tipo],
    value: atividades.filter(a => a.tipo === tipo).length,
  }));
}
