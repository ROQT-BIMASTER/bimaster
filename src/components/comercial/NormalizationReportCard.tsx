import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  Database,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  MapPin,
  Users,
  FileWarning,
} from "lucide-react";
import { useState } from "react";
import type { NormalizacaoResumo, NormalizacaoStats } from "@/hooks/useNormalizacao";
import { Skeleton } from "@/components/ui/skeleton";

interface NormalizationReportCardProps {
  resumo?: NormalizacaoResumo;
  isLoading: boolean;
  onNormalizar: () => void;
  isNormalizando: boolean;
  resultado?: NormalizacaoStats;
  onRecalcular: () => void;
  isRecalculando: boolean;
}

export function NormalizationReportCard({
  resumo,
  isLoading,
  onNormalizar,
  isNormalizando,
  resultado,
  onRecalcular,
  isRecalculando,
}: NormalizationReportCardProps) {
  const [showCidades, setShowCidades] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!resumo) return null;

  const pctNormalizados =
    resumo.comCnpjCompleto > 0
      ? Math.round((resumo.normalizados / resumo.comCnpjCompleto) * 100)
      : 0;

  const cidadesAgrupadas = (resumo.cidadesSemMatch || []).reduce(
    (acc, item) => {
      if (!acc[item.uf]) acc[item.uf] = [];
      acc[item.uf].push(item);
      return acc;
    },
    {} as Record<string, typeof resumo.cidadesSemMatch>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-primary" />
              Normalização de Municípios
            </CardTitle>
            <CardDescription className="mt-1">
              Padronização de nomes de cidades contra base IBGE e filtro de CNPJ
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRecalcular()}
              disabled={isRecalculando}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRecalculando ? "animate-spin" : ""}`}
              />
              Recalcular Cobertura
            </Button>
            <Button
              size="sm"
              onClick={() => onNormalizar()}
              disabled={isNormalizando}
              className="gap-2"
            >
              <MapPin
                className={`h-4 w-4 ${isNormalizando ? "animate-pulse" : ""}`}
              />
              {isNormalizando ? "Normalizando..." : "Executar Normalização"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            label="Total de Clientes"
            value={resumo.totalClientes.toLocaleString("pt-BR")}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            label="CNPJ Completo"
            value={resumo.comCnpjCompleto.toLocaleString("pt-BR")}
            subtitle={`${Math.round((resumo.comCnpjCompleto / Math.max(resumo.totalClientes, 1)) * 100)}% do total`}
          />
          <StatCard
            icon={<FileWarning className="h-4 w-4 text-amber-500" />}
            label="CNPJ Incompleto"
            value={resumo.semCnpjCompleto.toLocaleString("pt-BR")}
            subtitle="Excluídos das análises"
            variant="warning"
          />
          <StatCard
            icon={<MapPin className="h-4 w-4 text-primary" />}
            label="Normalizados IBGE"
            value={resumo.normalizados.toLocaleString("pt-BR")}
            subtitle={`${pctNormalizados}% dos válidos`}
          />
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Taxa de normalização IBGE
            </span>
            <span className="font-medium">{pctNormalizados}%</span>
          </div>
          <Progress value={pctNormalizados} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{resumo.normalizados.toLocaleString("pt-BR")} normalizados</span>
            <span>{resumo.semMatch.toLocaleString("pt-BR")} sem correspondência</span>
          </div>
        </div>

        {/* Resultado da última normalização */}
        {resultado && (
          <>
            <Separator />
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Última normalização executada
              </p>
              <p className="text-xs text-muted-foreground">
                {resultado.normalizados} de {resultado.total_processados}{" "}
                processados ({resultado.pct_sucesso}% de sucesso) —{" "}
                {resultado.sem_match} sem correspondência IBGE
              </p>
            </div>
          </>
        )}

        {/* Unmatched cities */}
        {resumo.cidadesSemMatch && resumo.cidadesSemMatch.length > 0 && (
          <>
            <Separator />
            <Collapsible open={showCidades} onOpenChange={setShowCidades}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between gap-2 text-muted-foreground"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {Object.keys(cidadesAgrupadas).length} UFs com cidades sem
                    correspondência IBGE
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showCidades ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="max-h-64 mt-2">
                  <div className="space-y-3">
                    {Object.entries(cidadesAgrupadas)
                      .sort(([, a], [, b]) => {
                        const totalA = a.reduce((s, i) => s + i.quantidade, 0);
                        const totalB = b.reduce((s, i) => s + i.quantidade, 0);
                        return totalB - totalA;
                      })
                      .map(([uf, cidades]) => (
                        <div key={uf} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {uf}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {cidades.reduce((s, c) => s + c.quantidade, 0)}{" "}
                              clientes
                            </span>
                          </div>
                          <div className="pl-4 space-y-0.5">
                            {cidades.slice(0, 10).map((c, idx) => (
                              <p
                                key={idx}
                                className="text-xs text-muted-foreground"
                              >
                                {c.cidade}{" "}
                                <span className="text-foreground/60">
                                  ({c.quantidade})
                                </span>
                              </p>
                            ))}
                            {cidades.length > 10 && (
                              <p className="text-xs text-muted-foreground italic">
                                +{cidades.length - 10} cidades...
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  variant?: "warning";
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-1 ${variant === "warning" ? "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
