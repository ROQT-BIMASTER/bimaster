import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Plano {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  limites: any;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  ativo: boolean;
}

interface UserSubscription {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
}

export default function Planos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadPlanos();
    loadUserPlan();
    checkSubscriptionStatus();
  }, []);

  const loadPlanos = async () => {
    try {
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .eq("ativo", true)
        .order("preco", { ascending: true });

      if (error) throw error;
      setPlanos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar planos", {
        description: error.message,
      });
    }
  };

  const loadUserPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("plano_id")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setCurrentPlanId(data?.plano_id);
    } catch (error: any) {
      console.error("Erro ao carregar plano do usuário:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;
      setSubscription(data);
    } catch (error: any) {
      console.error("Erro ao verificar assinatura:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSubscribe = async (priceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Faça login para assinar um plano");
        navigate("/auth");
        return;
      }

      toast.loading("Redirecionando para o pagamento...");
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecionado para o checkout");
      }
    } catch (error: any) {
      toast.error("Erro ao criar sessão de checkout", {
        description: error.message,
      });
    }
  };

  const handleManageSubscription = async () => {
    try {
      toast.loading("Abrindo portal de gerenciamento...");
      
      const { data, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Portal de gerenciamento aberto");
      }
    } catch (error: any) {
      toast.error("Erro ao abrir portal", {
        description: error.message,
      });
    }
  };

  const getPlanIcon = (nome: string) => {
    switch (nome.toLowerCase()) {
      case "básico":
        return <Sparkles className="h-5 w-5" />;
      case "premium":
        return <Crown className="h-5 w-5" />;
      case "enterprise":
        return <Zap className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getFeatures = (limites: any) => {
    const features = [];
    
    if (limites.max_prospects === -1) {
      features.push("Prospects ilimitados");
    } else {
      features.push(`Até ${limites.max_prospects} prospects`);
    }
    
    if (limites.max_atividades === -1) {
      features.push("Atividades ilimitadas");
    } else {
      features.push(`Até ${limites.max_atividades} atividades`);
    }
    
    if (limites.relatorios_avancados) {
      features.push("Relatórios avançados");
    }
    
    if (limites.chat_ai) {
      features.push("Chat com IA");
    }
    
    if (limites.api_access) {
      features.push("Acesso à API");
    }
    
    return features;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>Carregando planos...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Escolha seu plano</h1>
          <p className="text-muted-foreground">
            Selecione o plano ideal para o seu negócio
          </p>
        </div>

        {subscription?.subscribed && (
          <Card className="mb-8 bg-primary/5 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                Assinatura Ativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sua assinatura está ativa até{" "}
                {subscription.subscription_end &&
                  new Date(subscription.subscription_end).toLocaleDateString("pt-BR")}
              </p>
              <Button
                onClick={handleManageSubscription}
                variant="outline"
                className="mt-4"
              >
                Gerenciar Assinatura
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planos.map((plano) => {
            const isCurrentPlan = plano.id === currentPlanId;
            const features = getFeatures(plano.limites);

            return (
              <Card
                key={plano.id}
                className={`relative ${
                  isCurrentPlan ? "border-primary shadow-lg" : ""
                }`}
              >
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Plano Atual
                  </Badge>
                )}
                
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {getPlanIcon(plano.nome)}
                      {plano.nome}
                    </CardTitle>
                  </div>
                  <CardDescription>{plano.descricao}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">
                      {formatPrice(plano.preco)}
                    </span>
                    {plano.preco > 0 && (
                      <span className="text-muted-foreground">/mês</span>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {plano.preco === 0 ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano Gratuito
                    </Button>
                  ) : isCurrentPlan ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano Ativo
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plano.stripe_price_id!)}
                      className="w-full"
                      disabled={!plano.stripe_price_id}
                    >
                      Assinar Agora
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Button
            onClick={checkSubscriptionStatus}
            variant="ghost"
            disabled={checkingSubscription}
          >
            {checkingSubscription ? "Verificando..." : "Atualizar Status da Assinatura"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
