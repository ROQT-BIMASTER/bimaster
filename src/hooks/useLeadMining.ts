import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LeadMinerado {
  id: string;
  google_place_id: string;
  nome: string;
  telefone: string | null;
  telefone_internacional: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  rating: number | null;
  total_avaliacoes: number;
  tipos: string[];
  status: string;
  busca_query: string | null;
  busca_regiao: string | null;
  convertido_prospect_id: string | null;
  cnpj: string | null;
  observacoes: string | null;
  minerado_por: string | null;
  created_at: string;
  updated_at: string;
}

interface MiningFilters {
  status?: string;
  cidade?: string;
  ratingMinimo?: number;
}

interface MiningSearchParams {
  query: string;
  cidade?: string;
  uf?: string;
  maxResults?: number;
}

export function useLeadMining(filters: MiningFilters = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [miningProgress, setMiningProgress] = useState<string | null>(null);

  // Fetch leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads-minerados", filters],
    queryFn: async () => {
      let query = supabase
        .from("leads_minerados")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "todos") {
        query = query.eq("status", filters.status);
      }
      if (filters.cidade) {
        query = query.ilike("cidade", `%${filters.cidade}%`);
      }
      if (filters.ratingMinimo && filters.ratingMinimo > 0) {
        query = query.gte("rating", filters.ratingMinimo);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as LeadMinerado[];
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["leads-minerados-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_minerados")
        .select("status");

      if (error) throw error;

      const all = data || [];
      return {
        total: all.length,
        novos: all.filter((l) => l.status === "novo").length,
        qualificados: all.filter((l) => l.status === "qualificado").length,
        convertidos: all.filter((l) => l.status === "convertido").length,
        descartados: all.filter((l) => l.status === "descartado").length,
      };
    },
  });

  // Mine leads
  const mineMutation = useMutation({
    mutationFn: async (params: MiningSearchParams) => {
      setMiningProgress("Buscando leads no Google Places...");
      
      const { data, error } = await supabase.functions.invoke("google-places-search", {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      setMiningProgress(null);
      queryClient.invalidateQueries({ queryKey: ["leads-minerados"] });
      queryClient.invalidateQueries({ queryKey: ["leads-minerados-stats"] });
      toast({
        title: "Mineração concluída!",
        description: `${data.totalFetched} leads encontrados, ${data.totalSaved} salvos no banco.`,
      });
    },
    onError: (error: Error) => {
      setMiningProgress(null);
      toast({
        title: "Erro na mineração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update lead status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from("leads_minerados")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-minerados"] });
      queryClient.invalidateQueries({ queryKey: ["leads-minerados-stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Convert lead to prospect
  const convertMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const leadsToConvert = leads.filter((l) => leadIds.includes(l.id));
      const results: string[] = [];

      for (const lead of leadsToConvert) {
        // Create prospect
        const prospectId = crypto.randomUUID();
        const prospectData = {
          id: prospectId,
          nome_empresa: lead.nome,
          nome_fantasia: lead.nome,
          telefone: lead.telefone || lead.telefone_internacional || undefined,
          endereco: lead.endereco || undefined,
          municipio: lead.cidade || undefined,
          uf: lead.uf || undefined,
          cep: lead.cep || undefined,
          url_company_page: lead.website || undefined,
          cnpj: lead.cnpj || undefined,
          segmento: lead.tipos?.[0] || undefined,
          status: "novo" as const,
          observacoes: `Lead minerado do Google Places. Rating: ${lead.rating || "N/A"} (${lead.total_avaliacoes} avaliações)`,
        };

        const { error: prospectError } = await supabase
          .from("prospects")
          .insert([prospectData]);

        if (prospectError) {
          console.error("Error creating prospect:", prospectError);
          continue;
        }

        // Update lead status
        await supabase
          .from("leads_minerados")
          .update({
            status: "convertido",
            convertido_prospect_id: prospectId,
          })
          .eq("id", lead.id);

        results.push(prospectId);
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["leads-minerados"] });
      queryClient.invalidateQueries({ queryKey: ["leads-minerados-stats"] });
      toast({
        title: "Leads convertidos!",
        description: `${results.length} lead(s) convertido(s) em prospect(s).`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao converter",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    leads,
    isLoading,
    stats,
    miningProgress,
    isMining: mineMutation.isPending,
    mine: mineMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    convertToProspect: convertMutation.mutateAsync,
    isConverting: convertMutation.isPending,
  };
}
