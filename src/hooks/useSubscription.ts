import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionStatus {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  plano_id: string | null;
}

interface PlanLimits {
  max_prospects: number;
  max_atividades: number;
  relatorios_avancados: boolean;
  chat_ai: boolean;
  api_access: boolean;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
    loadPlanLimits();

    // Check subscription periodically (every 5 minutes)
    const interval = setInterval(() => {
      loadSubscription();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const loadSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) {
        console.error("Erro ao verificar assinatura:", error);
        return;
      }

      setSubscription(data);
    } catch (error) {
      console.error("Erro ao carregar assinatura:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlanLimits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plano_id, planos(limites)")
        .eq("id", user.id)
        .single();

      if (profile?.planos) {
        setPlanLimits(profile.planos.limites as unknown as PlanLimits);
      }
    } catch (error) {
      console.error("Erro ao carregar limites do plano:", error);
    }
  };

  const canCreateProspect = async (): Promise<boolean> => {
    if (!planLimits) return true;
    
    // -1 significa ilimitado
    if (planLimits.max_prospects === -1) return true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { count } = await supabase
      .from("prospects")
      .select("*", { count: "exact", head: true })
      .eq("vendedor_id", user.id);

    return (count || 0) < planLimits.max_prospects;
  };

  const canCreateActivity = async (): Promise<boolean> => {
    if (!planLimits) return true;
    
    // -1 significa ilimitado
    if (planLimits.max_atividades === -1) return true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { count } = await supabase
      .from("atividades")
      .select("*", { count: "exact", head: true })
      .eq("vendedor_id", user.id);

    return (count || 0) < planLimits.max_atividades;
  };

  const hasFeature = (feature: keyof PlanLimits): boolean => {
    if (!planLimits) return false;
    return planLimits[feature] === true;
  };

  const refreshSubscription = () => {
    loadSubscription();
    loadPlanLimits();
  };

  return {
    subscription,
    planLimits,
    loading,
    canCreateProspect,
    canCreateActivity,
    hasFeature,
    refreshSubscription,
  };
}
