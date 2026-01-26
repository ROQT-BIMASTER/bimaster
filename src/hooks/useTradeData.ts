import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Hook otimizado para buscar budgets do Trade
export function useTradeBudgets(options?: { status?: string }) {
  return useQuery({
    queryKey: ['trade-budgets', options?.status],
    queryFn: async () => {
      let query = supabase
        .from("trade_budgets")
        .select("*")
        .order("period_start", { ascending: false });
      
      if (options?.status) {
        query = query.eq("status", options.status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Hook otimizado para buscar contas do Trade
export function useTradeAccounts(options?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: ['trade-accounts', options?.activeOnly],
    queryFn: async () => {
      let query = supabase
        .from("trade_chart_of_accounts")
        .select("*")
        .order("code");
      
      if (options?.activeOnly !== false) {
        query = query.eq("is_active", true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook otimizado para buscar investimentos do Trade
export function useTradeInvestments() {
  return useQuery({
    queryKey: ['trade-investments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_investments")
        .select(`
          *,
          store:stores(name, code, city)
        `)
        .order("investment_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000, // 3 minutos
  });
}

// Hook otimizado para buscar lojas ativas
export function useActiveStores() {
  return useQuery({
    queryKey: ['active-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, code, city")
        .eq("status", "active")
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook otimizado para buscar campanhas do Trade
export function useTradeCampaigns() {
  return useQuery({
    queryKey: ['trade-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaigns")
        .select(`
          *,
          budget:trade_budgets(name, code, available_amount)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });
}

// Hook otimizado para buscar perfis/usuários
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutos - dados de usuários mudam pouco
  });
}

// Hook para lançamentos financeiros pendentes de aprovação
export function usePendingFinancialEntries() {
  return useQuery<any[]>({
    queryKey: ['trade-pending-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_financial_entries")
        .select(`
          *,
          account:trade_chart_of_accounts(name, code),
          store:stores(name, code, address, city, state, zip_code),
          budget:trade_budgets(name, code, total_amount, spent_amount, reserved_amount)
        `)
        .eq("approval_status", "pending")
        .order("entry_date", { ascending: false });

      if (error) throw error;

      // Enriquecer com informações do criador
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(entry => entry.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        return data.map(entry => ({
          ...entry,
          created_by_profile: profileMap.get(entry.created_by)
        }));
      }

      return data || [];
    },
    staleTime: 60 * 1000, // 1 minuto - aprovações precisam ser mais atualizadas
  });
}

// Hook para investimentos pendentes de aprovação
export function usePendingInvestments() {
  return useQuery<any[]>({
    queryKey: ['trade-pending-investments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_investments")
        .select(`
          *,
          store:stores(name, code, address, city, state, zip_code)
        `)
        .eq("approval_status", "pending")
        .order("investment_date", { ascending: false });

      if (error) throw error;

      // Enriquecer com informações do criador
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(inv => inv.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        return data.map(inv => ({
          ...inv,
          created_by_profile: profileMap.get(inv.created_by)
        }));
      }

      return data || [];
    },
    staleTime: 60 * 1000,
  });
}
