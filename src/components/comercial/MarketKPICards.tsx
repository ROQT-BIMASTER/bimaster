import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MarketKPIs, MarketCoverageRow } from "@/hooks/useMarketCoverage";
import {
  Globe,
  MapPin,
  Users,
  Target,
  TrendingUp,
  Building2,
  Pickaxe,
  BarChart3,
} from "lucide-react";

interface MarketKPICardsProps {
  kpis: MarketKPIs;
  isLoading: boolean;
  coverageData?: MarketCoverageRow[];
}

const formatNumber = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n);

const formatPopulation = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} mil`;
  return formatNumber(n);
};

type CardKey = "penetracao" | "ufs" | "clientes" | "prospects" | "leads" | "populacao";

export function MarketKPICards({ kpis, isLoading, coverageData = [] }: MarketKPICardsProps) {
  const [openCard, setOpenCard] = useState<CardKey | null>(null);

  const cards: Array<{
    key: CardKey;
    title: string;
    value: string;
    subtitle: string;
    icon: typeof Target;
    color: string;
    bg: string;
    border: string;
  }> = [
    {
      key: "penetracao",
      title: "Penetração Nacional",
      value: `${kpis.penetracaoNacional}%`,
      subtitle: `${formatNumber(kpis.municipiosAtendidos)} de ${formatNumber(kpis.totalMunicipios)} municípios`,
      icon: Target,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/50",
      border: "border-l-blue-500",
    },
    {
      key: "ufs",
      title: "UFs Atendidas",
      value: `${kpis.ufsAtendidas}/${kpis.totalUFs}`,
      subtitle: `Estados com clientes ativos`,
      icon: Globe,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/50",
      border: "border-l-emerald-500",
    },
    {
      key: "clientes",
      title: "Clientes ERP",
      value: formatNumber(kpis.totalClientesERP),
      subtitle: `Em ${formatNumber(kpis.municipiosAtendidos)} cidades`,
      icon: Building2,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-900/50",
      border: "border-l-violet-500",
    },
    {
      key: "prospects",
      title: "Prospects Ativos",
      value: formatNumber(kpis.totalProspects),
      subtitle: `Em ${formatNumber(kpis.municipiosProspectados)} municípios`,
      icon: Users,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/50",
      border: "border-l-amber-500",
    },
    {
      key: "leads",
      title: "Leads Minerados",
      value: formatNumber(kpis.totalLeads),
      subtitle: `Em ${formatNumber(kpis.municipiosMinerados)} cidades`,
      icon: Pickaxe,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/50",
      border: "border-l-orange-500",
    },
    {
      key: "populacao",
      title: "População Alcançada",
      value: formatPopulation(kpis.populacaoAtendida),
      subtitle: `de ${formatPopulation(kpis.populacaoTotal)} total`,
      icon: BarChart3,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-900/50",
      border: "border-l-rose-500",
    },
  ];

  const sortedByPenetracao = [...coverageData].sort((a, b) => b.penetracao_percentual - a.penetracao_percentual);
  const sortedByClientes = [...coverageData].sort((a, b) => b.total_clientes_erp - a.total_clientes_erp);
  const sortedByProspects = [...coverageData].sort((a, b) => b.total_prospects - a.total_prospects);
  const sortedByLeads = [...coverageData].sort((a, b) => b.total_leads_minerados - a.total_leads_minerados);
  const sortedByPopulacao = [...coverageData].sort((a, b) => b.populacao_total - a.populacao_total);

  const renderDialogContent = () => {
    if (!openCard || coverageData.length === 0) return null;

    switch (openCard) {
      case "penetracao":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Penetração por UF
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-right">Municípios Atendidos</TableHead>
                    <TableHead className="text-right">Total Municípios</TableHead>
                    <TableHead className="text-right">Penetração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByPenetracao.map((r) => (
                    <TableRow key={r.uf}>
                      <TableCell className="font-medium">{r.uf}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.municipios_com_clientes)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.total_municipios)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={r.penetracao_percentual >= 70 ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400" : r.penetracao_percentual >= 40 ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400"}>
                          {r.penetracao_percentual.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );

      case "ufs":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-600" />
                Detalhamento por UF
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UF</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Prospects</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByPenetracao.map((r) => (
                    <TableRow key={r.uf}>
                      <TableCell className="font-medium">{r.uf}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.regiao_nome || "—"}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.total_clientes_erp)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.total_prospects)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.total_leads_minerados)}</TableCell>
                      <TableCell className="text-center">
                        {r.municipios_com_clientes > 0 ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300">Ativa</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Sem presença</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );

      case "clientes":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-violet-600" />
                Clientes ERP por UF
              </DialogTitle>
            </DialogHeader>
            <div className="mb-3 p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              <p className="font-medium">Resumo Geral</p>
              <p>Total de clientes (CNPJ válido): <strong>{formatNumber(kpis.totalClientesERP)}</strong></p>
              <p>Em <strong>{formatNumber(kpis.municipiosAtendidos)}</strong> municípios e <strong>{kpis.ufsAtendidas}</strong> UFs</p>
            </div>
            <ScrollArea className="max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-right">Clientes ERP</TableHead>
                    <TableHead className="text-right">Municípios</TableHead>
                    <TableHead className="text-right">Clientes/Município</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByClientes.map((r) => (
                    <TableRow key={r.uf}>
                      <TableCell className="font-medium">{r.uf}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(r.total_clientes_erp)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.municipios_com_clientes)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.municipios_com_clientes > 0 ? (r.total_clientes_erp / r.municipios_com_clientes).toFixed(1) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );

      case "prospects":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-600" />
                Prospects por UF
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-right">Prospects</TableHead>
                    <TableHead className="text-right">Municípios c/ Prospect</TableHead>
                    <TableHead className="text-right">Total Municípios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByProspects.filter(r => r.total_prospects > 0).map((r) => (
                    <TableRow key={r.uf}>
                      <TableCell className="font-medium">{r.uf}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(r.total_prospects)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.municipios_com_prospects)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatNumber(r.total_municipios)}</TableCell>
                    </TableRow>
                  ))}
                  {sortedByProspects.filter(r => r.total_prospects > 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum prospect cadastrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );

      case "leads":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pickaxe className="h-5 w-5 text-orange-600" />
                Leads Minerados por UF
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Municípios c/ Leads</TableHead>
                    <TableHead className="text-right">Total Municípios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByLeads.filter(r => r.total_leads_minerados > 0).map((r) => (
                    <TableRow key={r.uf}>
                      <TableCell className="font-medium">{r.uf}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(r.total_leads_minerados)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.municipios_com_leads)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatNumber(r.total_municipios)}</TableCell>
                    </TableRow>
                  ))}
                  {sortedByLeads.filter(r => r.total_leads_minerados > 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum lead minerado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );

      case "populacao":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-rose-600" />
                População por UF
              </DialogTitle>
            </DialogHeader>
            <div className="mb-3 p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              <p>População alcançada: <strong>{formatPopulation(kpis.populacaoAtendida)}</strong> ({kpis.populacaoTotal > 0 ? ((kpis.populacaoAtendida / kpis.populacaoTotal) * 100).toFixed(1) : 0}%)</p>
              <p>População total: <strong>{formatPopulation(kpis.populacaoTotal)}</strong></p>
            </div>
            <ScrollArea className="max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UF</TableHead>
                    <TableHead className="text-right">População</TableHead>
                    <TableHead className="text-right">PIB (R$ mil)</TableHead>
                    <TableHead className="text-center">Presença</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByPopulacao.map((r) => (
                    <TableRow key={r.uf}>
                      <TableCell className="font-medium">{r.uf}</TableCell>
                      <TableCell className="text-right">{formatPopulation(r.populacao_total)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.pib_total_mil_reais)}</TableCell>
                      <TableCell className="text-center">
                        {r.municipios_com_clientes > 0 ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Não</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card
            key={card.title}
            className={`border-l-4 ${card.border} hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]`}
            onClick={() => setOpenCard(card.key)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs font-medium text-foreground mt-1">{card.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openCard} onOpenChange={(open) => !open && setOpenCard(null)}>
        <DialogContent className="max-w-2xl">
          {renderDialogContent()}
        </DialogContent>
      </Dialog>
    </>
  );
}
