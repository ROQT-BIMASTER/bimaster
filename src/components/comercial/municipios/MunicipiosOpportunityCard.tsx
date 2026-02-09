import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, MapPin, Users, Crosshair } from "lucide-react";
import { MunicipioIntelligence } from "@/hooks/useMunicipiosIntelligence";
import { ModoFocoDialog } from "./ModoFocoDialog";

interface MunicipiosOpportunityCardProps {
  data: MunicipioIntelligence[];
  loading: boolean;
}

export function MunicipiosOpportunityCard({ data, loading }: MunicipiosOpportunityCardProps) {
  const [modoFocoOpen, setModoFocoOpen] = useState(false);

  // Top 10 municipalities with highest PIB where company has NO clients
  const opportunities = data
    .filter(d => d.total_clientes === 0 && d.pib_mil_reais > 0)
    .sort((a, b) => b.pib_mil_reais - a.pib_mil_reais)
    .slice(0, 10);

  if (loading) {
    return (
      <>
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
      <ModoFocoDialog open={modoFocoOpen} onOpenChange={setModoFocoOpen} />
      </>
    );
  }

  if (opportunities.length === 0) {
    return (
      <>
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Top 10 Oportunidades
          </CardTitle>
          <CardDescription>
            Nenhuma oportunidade inexplorada encontrada com os filtros atuais.
          </CardDescription>
        </CardHeader>
      </Card>
      <ModoFocoDialog open={modoFocoOpen} onOpenChange={setModoFocoOpen} />
      </>
    );
  }

  return (
    <>
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Top 10 Oportunidades Inexploradas
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setModoFocoOpen(true)}
          >
            <Crosshair className="h-3.5 w-3.5" />
            Modo Foco
          </Button>
        </div>
        <CardDescription>
          Municípios com maior PIB onde a empresa ainda não possui clientes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {opportunities.map((opp, idx) => (
            <div
              key={opp.municipio_id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold text-sm shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{opp.municipio_nome}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{opp.uf_sigla}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {opp.populacao.toLocaleString('pt-BR')} hab
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {opp.microrregiao_nome}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  R$ {(opp.pib_per_capita || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-muted-foreground">PIB/Capita</p>
              </div>
              <Badge variant="warning" className="shrink-0 text-[10px]">
                Mercado inexplorado
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
    <ModoFocoDialog open={modoFocoOpen} onOpenChange={setModoFocoOpen} />
    </>
  );
}
