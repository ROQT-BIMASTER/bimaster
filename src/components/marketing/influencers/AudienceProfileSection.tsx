import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Users, ShoppingBag, User, Info } from "lucide-react";
import { toast } from "sonner";

interface AudienceProfileSectionProps {
  influencerId: string;
}

interface AudienceProfile {
  gender_distribution: { label: string; percentage: number }[];
  age_distribution: { range: string; percentage: number }[];
  consumer_profile: {
    purchasing_power: string;
    interests: string[];
    buying_habits: string;
  };
  follower_persona: string;
}

export function AudienceProfileSection({ influencerId }: AudienceProfileSectionProps) {
  const [profile, setProfile] = useState<AudienceProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    loadExisting();
  }, [influencerId]);

  const loadExisting = async () => {
    setLoadingExisting(true);
    try {
      const { data } = await supabase
        .from("influencer_analyses")
        .select("result")
        .eq("influencer_id", influencerId)
        .eq("analysis_type", "audience_profile")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setProfile(data[0].result as unknown as AudienceProfile);
      }
    } catch (err) {
      console.error("Error loading audience profile:", err);
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("influencer-autopilot", {
        body: { action: "analyze_audience", influencer_id: influencerId },
      });
      if (error) throw error;
      if (data?.data) {
        setProfile(data.data);
        toast.success("Perfil de audiência gerado com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("429")) {
        toast.error("Limite de requisições excedido, tente novamente em breve");
      } else if (err?.message?.includes("402")) {
        toast.error("Créditos insuficientes");
      } else {
        toast.error("Erro ao analisar perfil de audiência");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingExisting) return null;

  const genderColors: Record<string, string> = {
    masculino: "bg-blue-500",
    feminino: "bg-pink-500",
    male: "bg-blue-500",
    female: "bg-pink-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Perfil de Consumidor (IA)</h3>
          <Badge variant="outline" className="text-xs gap-1">
            <Info className="h-3 w-3" />
            Estimativa IA
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
          {profile ? "Atualizar" : "Analisar Audiência"}
        </Button>
      </div>

      {!profile ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Clique em "Analisar Audiência" para gerar uma estimativa do perfil demográfico via IA</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gender Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Distribuição por Gênero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.gender_distribution?.map((g, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{g.label}</span>
                    <span className="font-medium">{g.percentage}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${genderColors[g.label.toLowerCase()] || "bg-muted-foreground"}`}
                      style={{ width: `${g.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Age Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Faixa Etária
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.age_distribution?.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">{a.range}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${a.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-10 text-right">{a.percentage}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Follower Persona */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" /> Persona do Seguidor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.follower_persona}</p>
            </CardContent>
          </Card>

          {/* Consumer Profile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Perfil de Consumo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Poder aquisitivo</p>
                <p className="text-sm font-medium">{profile.consumer_profile?.purchasing_power}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interesses</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.consumer_profile?.interests?.map((interest, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{interest}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hábitos de compra</p>
                <p className="text-sm text-muted-foreground">{profile.consumer_profile?.buying_habits}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
