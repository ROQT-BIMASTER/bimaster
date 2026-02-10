import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Calendar, Activity, TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadResumoIAProps {
  prospect: {
    id: string;
    nome_empresa: string;
    contato_principal: string | null;
    email: string | null;
    telefone: string | null;
    cnpj: string | null;
    porte_empresa: string | null;
    status: string;
    categoria: string | null;
    ultimo_contato: string | null;
    proxima_acao: string | null;
    observacoes: string | null;
  };
}

export const LeadResumoIA = ({ prospect }: LeadResumoIAProps) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [activityCount, setActivityCount] = useState(0);

  useEffect(() => {
    fetchActivityCount();
  }, [prospect.id]);

  const fetchActivityCount = async () => {
    const { count } = await supabase
      .from("atividades")
      .select("*", { count: "exact", head: true })
      .eq("prospect_id", prospect.id);
    setActivityCount(count || 0);
  };

  const generateInsight = async () => {
    setLoadingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-insight", {
        body: { prospect_id: prospect.id },
      });
      if (error) throw error;
      setInsight(data?.insight || "Não foi possível gerar o insight.");
    } catch (err) {
      console.error("Erro ao gerar insight:", err);
      setInsight("Erro ao gerar insight. Tente novamente.");
    } finally {
      setLoadingInsight(false);
    }
  };

  const diasSemContato = prospect.ultimo_contato
    ? differenceInDays(new Date(), new Date(prospect.ultimo_contato))
    : null;

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      novo: "Novo", em_contato: "Em Contato", proposta_enviada: "Proposta Enviada",
      negociacao: "Negociação", ganho: "Ganho", perdido: "Perdido",
    };
    return map[s] || s;
  };

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{diasSemContato !== null ? diasSemContato : "—"}</p>
            <p className="text-xs text-muted-foreground">Dias sem contato</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{activityCount}</p>
            <p className="text-xs text-muted-foreground">Atividades registradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <Badge variant="outline" className="text-lg px-3 py-1">
              {prospect.categoria || "—"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">Categoria</p>
          </CardContent>
        </Card>
      </div>

      {/* Dados de Qualificação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados de Qualificação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Empresa:</span>
              <p className="font-medium">{prospect.nome_empresa}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="font-medium">{getStatusLabel(prospect.status)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">CNPJ:</span>
              <p className="font-medium">{prospect.cnpj || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Porte:</span>
              <p className="font-medium">{prospect.porte_empresa || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Contato:</span>
              <p className="font-medium">{prospect.contato_principal || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              <p className="font-medium">{prospect.email || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Telefone:</span>
              <p className="font-medium">{prospect.telefone || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Próxima Ação:</span>
              <p className="font-medium">
                {prospect.proxima_acao
                  ? format(new Date(prospect.proxima_acao), "dd/MM/yyyy", { locale: ptBR })
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insight da IA */}
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Insight da IA
          </CardTitle>
          <Button size="sm" variant="outline" onClick={generateInsight} disabled={loadingInsight}>
            {loadingInsight ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{insight ? "Atualizar" : "Gerar"}</span>
          </Button>
        </CardHeader>
        <CardContent>
          {insight ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{insight}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Clique em "Gerar" para obter um resumo inteligente do momento deste lead.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
