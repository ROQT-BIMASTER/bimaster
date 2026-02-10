import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, DollarSign, Users, Globe, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WhitespaceKPIs } from "@/hooks/useWhitespaceAnalysis";

interface Props {
  kpis: WhitespaceKPIs | undefined;
  loading: boolean;
  onCardClick?: (metric: string) => void;
  detailData?: DetailData;
}

export interface DetailData {
  topByPib?: { uf: string; pib: number; municipios: number }[];
  topByPop?: { uf: string; populacao: number; municipios: number }[];
  topMicros?: { nome: string; uf: string; score: number; municipios_whitespace: number }[];
  ufBreakdown?: { uf: string; municipios: number; pib: number; populacao: number }[];
}

const formatNumber = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n);

const formatCurrency = (n: number) => {
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(1)} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)} mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)} mil`;
  return `R$ ${n.toFixed(0)}`;
};

const cards = [
  {
    key: "municipios",
    label: "Municípios Whitespace",
    icon: MapPin,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/50",
    border: "border-l-blue-500",
    getValue: (k: WhitespaceKPIs) => formatNumber(k.total_municipios_whitespace),
    sub: "Alvos de expansão",
    dialogTitle: "Detalhamento — Municípios Whitespace",
  },
  {
    key: "pib",
    label: "PIB Inexplorado",
    icon: DollarSign,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    border: "border-l-emerald-500",
    getValue: (k: WhitespaceKPIs) => formatCurrency(k.pib_total_inexplorado),
    sub: "em mil R$",
    dialogTitle: "Detalhamento — PIB Inexplorado por UF",
  },
  {
    key: "pop",
    label: "População Descoberta",
    icon: Users,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/50",
    border: "border-l-violet-500",
    getValue: (k: WhitespaceKPIs) => formatNumber(k.populacao_total_inexplorada),
    sub: "Potenciais consumidores",
    dialogTitle: "Detalhamento — População Descoberta por UF",
  },
  {
    key: "micro",
    label: "Microrregiões",
    icon: Globe,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/50",
    border: "border-l-amber-500",
    getValue: (k: WhitespaceKPIs) => formatNumber(k.microrregioes_com_oportunidade),
    sub: "Com oportunidade",
    dialogTitle: "Detalhamento — Top Microrregiões",
  },
  {
    key: "score",
    label: "Score Médio",
    icon: TrendingUp,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/50",
    border: "border-l-rose-500",
    getValue: (k: WhitespaceKPIs) => formatNumber(Math.round(k.score_medio_expansao)),
    sub: "De expansão",
    dialogTitle: "Detalhamento — Score de Expansão",
  },
];

export function WhitespaceKPICards({ kpis, loading, onCardClick, detailData }: Props) {
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  const handleClick = (key: string) => {
    if (loading || !kpis) return;
    if (onCardClick) {
      onCardClick(key);
    }
    setOpenDialog(key);
  };

  const activeCard = cards.find((c) => c.key === openDialog);

  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card
            key={c.key}
            className={`border-l-4 ${c.border} cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]`}
            onClick={() => handleClick(c.key)}
          >
            <CardContent className="p-4">
              <div className={`p-2 rounded-lg ${c.bg} w-fit mb-3`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              {loading ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <p className={`text-2xl font-bold ${c.color}`}>
                  {kpis ? c.getValue(kpis) : "—"}
                </p>
              )}
              <h3 className="text-xs font-medium text-foreground mt-1">{c.label}</h3>
              <p className="text-[10px] text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openDialog} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeCard && (
                <div className={`p-1.5 rounded-lg ${activeCard.bg}`}>
                  {activeCard && <activeCard.icon className={`h-4 w-4 ${activeCard.color}`} />}
                </div>
              )}
              {activeCard?.dialogTitle}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {openDialog && kpis && (
              <KPIDetailContent
                metric={openDialog}
                kpis={kpis}
                detailData={detailData}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KPIDetailContent({
  metric,
  kpis,
  detailData,
}: {
  metric: string;
  kpis: WhitespaceKPIs;
  detailData?: DetailData;
}) {
  if (metric === "municipios") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Total de municípios alvo" value={formatNumber(kpis.total_municipios_whitespace)} color="text-blue-600" />
          <StatBox label="Microrregiões envolvidas" value={formatNumber(kpis.microrregioes_com_oportunidade)} color="text-amber-600" />
        </div>
        {detailData?.ufBreakdown && detailData.ufBreakdown.length > 0 ? (
          <RankingTable
            title="Municípios por UF"
            rows={detailData.ufBreakdown.map((r) => ({
              label: r.uf,
              value: formatNumber(r.municipios),
              sub: `PIB: ${formatCurrency(r.pib)}`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            São municípios localizados em microrregiões onde já possuímos clientes ativos, mas onde ainda não há presença comercial direta. Representam a rota de expansão mais eficiente por já terem infraestrutura logística próxima.
          </p>
        )}
      </div>
    );
  }

  if (metric === "pib") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="PIB Total Inexplorado" value={formatCurrency(kpis.pib_total_inexplorado)} color="text-emerald-600" />
          <StatBox label="Municípios com dados" value={formatNumber(kpis.total_municipios_whitespace)} color="text-blue-600" />
        </div>
        {detailData?.topByPib && detailData.topByPib.length > 0 ? (
          <RankingTable
            title="Top UFs por PIB Inexplorado"
            rows={detailData.topByPib.map((r) => ({
              label: r.uf,
              value: formatCurrency(r.pib),
              sub: `${formatNumber(r.municipios)} municípios`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Soma do PIB (em mil R$) de todos os municípios whitespace identificados. Este valor representa o potencial econômico total das regiões ainda não cobertas pela operação comercial.
          </p>
        )}
      </div>
    );
  }

  if (metric === "pop") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="População Total" value={formatNumber(kpis.populacao_total_inexplorada)} color="text-violet-600" />
          <StatBox label="Municípios alvo" value={formatNumber(kpis.total_municipios_whitespace)} color="text-blue-600" />
        </div>
        {detailData?.topByPop && detailData.topByPop.length > 0 ? (
          <RankingTable
            title="Top UFs por População"
            rows={detailData.topByPop.map((r) => ({
              label: r.uf,
              value: formatNumber(r.populacao),
              sub: `${formatNumber(r.municipios)} municípios`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Número total de habitantes nos municípios sem presença comercial. Esses são potenciais consumidores que ainda não têm acesso direto aos nossos produtos através de um ponto de venda local.
          </p>
        )}
      </div>
    );
  }

  if (metric === "micro") {
    return (
      <div className="space-y-4">
        <StatBox label="Microrregiões com Oportunidade" value={formatNumber(kpis.microrregioes_com_oportunidade)} color="text-amber-600" />
        {detailData?.topMicros && detailData.topMicros.length > 0 ? (
          <RankingTable
            title="Top Microrregiões por Score"
            rows={detailData.topMicros.map((r) => ({
              label: `${r.nome} (${r.uf})`,
              value: `Score: ${formatNumber(r.score)}`,
              sub: `${formatNumber(r.municipios_whitespace)} municípios livres`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Microrregiões geográficas (IBGE) onde já atuamos com pelo menos um cliente, mas que ainda possuem municípios sem cobertura. Cada microrregião representa um cluster de expansão com logística já parcialmente resolvida.
          </p>
        )}
      </div>
    );
  }

  if (metric === "score") {
    return (
      <div className="space-y-4">
        <StatBox label="Score Médio de Expansão" value={formatNumber(Math.round(kpis.score_medio_expansao))} color="text-rose-600" />
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-semibold">Como o score é calculado?</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O <strong>Score de Expansão</strong> é calculado como: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">PIB per Capita × Taxa de Cobertura da Microrregião</code>.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Municípios com maior PIB per capita em microrregiões com maior penetração recebem scores mais altos, indicando mercados com poder aquisitivo superior e infraestrutura comercial próxima.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center p-2 bg-background rounded border">
              <p className="text-lg font-bold text-rose-600">&gt; 50</p>
              <p className="text-[10px] text-muted-foreground">Alto potencial</p>
            </div>
            <div className="text-center p-2 bg-background rounded border">
              <p className="text-lg font-bold text-amber-600">20–50</p>
              <p className="text-[10px] text-muted-foreground">Médio potencial</p>
            </div>
            <div className="text-center p-2 bg-background rounded border">
              <p className="text-lg font-bold text-muted-foreground">&lt; 20</p>
              <p className="text-[10px] text-muted-foreground">Baixo potencial</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function RankingTable({ title, rows }: { title: string; rows: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="space-y-1">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
              <span className="text-sm font-medium">{row.label}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold">{row.value}</span>
              {row.sub && <p className="text-[10px] text-muted-foreground">{row.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
