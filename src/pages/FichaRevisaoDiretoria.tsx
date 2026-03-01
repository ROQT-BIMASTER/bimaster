import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, AlertTriangle, Eye, Loader2, ClipboardList, Search,
  BarChart3, ChevronDown, ChevronUp, Clock, Inbox, MessageSquare, FolderOpen, CalendarIcon,
} from "lucide-react";
import { useFichaRevisaoDiretoria } from "@/hooks/useFichaRevisao";
import { FichaAnalisePanel } from "@/components/fabrica/FichaAnalisePanel";
import { RevisaoChatConsolidado } from "@/components/fabrica/RevisaoChatConsolidado";
import { DocumentosCofre } from "@/components/fabrica/DocumentosCofre";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { format, startOfDay, startOfMonth, startOfYear, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function FichaRevisaoDiretoria() {
  const { fichasPendentes, isLoading, processando, aprovarFicha, solicitarRevisao, refetch } = useFichaRevisaoDiretoria();
  const [fichaAberta, setFichaAberta] = useState<any | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("all");
  const [filtroLinha, setFiltroLinha] = useState("all");
  const [filtroProduto, setFiltroProduto] = useState("all");
  const [adminOpen, setAdminOpen] = useState(true);
  const [tabAtiva, setTabAtiva] = useState("fichas");
  const [granularidade, setGranularidade] = useState<"dia" | "mes" | "ano">("dia");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  // Admin dashboard data
  const [allRevisoes, setAllRevisoes] = useState<any[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [msgCount, setMsgCount] = useState(0);

  useEffect(() => {
    const loadAdmin = async () => {
      setLoadingAdmin(true);
      const [revRes, msgRes] = await Promise.all([
        supabase.from("fabrica_ficha_custo_revisoes")
          .select("id, status, submetido_em, revisado_em, versao, config_id")
          .order("submetido_em", { ascending: false })
          .limit(200),
        supabase.from("fabrica_revisao_mensagens" as any)
          .select("id", { count: "exact", head: true }),
      ]);
      setAllRevisoes(revRes.data || []);
      setMsgCount(msgRes.count || 0);
      setLoadingAdmin(false);
    };
    loadAdmin();
  }, [fichaAberta]);

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 });

  // Opções de filtro extraídas das fichas
  const marcas = useMemo(() => {
    const set = new Set<string>();
    fichasPendentes.forEach((f: any) => { if (f.produto?.marca) set.add(f.produto.marca); });
    return [...set].sort();
  }, [fichasPendentes]);

  const linhas = useMemo(() => {
    const set = new Set<string>();
    fichasPendentes.forEach((f: any) => {
      if (f.produto?.linha && (filtroMarca === "all" || f.produto?.marca === filtroMarca))
        set.add(f.produto.linha);
    });
    return [...set].sort();
  }, [fichasPendentes, filtroMarca]);

  const produtos = useMemo(() => {
    const map = new Map<string, string>();
    fichasPendentes.forEach((f: any) => {
      if (!f.produto) return;
      if (filtroMarca !== "all" && f.produto.marca !== filtroMarca) return;
      if (filtroLinha !== "all" && f.produto.linha !== filtroLinha) return;
      map.set(f.produto.id, f.produto.nome);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [fichasPendentes, filtroMarca, filtroLinha]);

  // Filtros
  const fichasFiltradas = useMemo(() => {
    return fichasPendentes.filter((f: any) => {
      if (filtroMarca !== "all" && f.produto?.marca !== filtroMarca) return false;
      if (filtroLinha !== "all" && f.produto?.linha !== filtroLinha) return false;
      if (filtroProduto !== "all" && f.produto?.id !== filtroProduto) return false;
      if (busca) {
        const b = busca.toLowerCase();
        if (!f.produto?.nome?.toLowerCase().includes(b) && !f.produto?.codigo?.toLowerCase().includes(b)) return false;
      }
      return true;
    });
  }, [fichasPendentes, busca, filtroMarca, filtroLinha, filtroProduto]);

  // Admin KPIs
  const kpis = useMemo(() => {
    const pendentes = allRevisoes.filter(r => r.status === "pendente").length;
    const aprovadas = allRevisoes.filter(r => r.status === "aprovada").length;
    const revisaoSolicitada = allRevisoes.filter(r => r.status === "revisao_solicitada").length;

    // Tempo médio de aprovação (em horas)
    const comTempo = allRevisoes.filter(r => r.revisado_em);
    const tempoMedio = comTempo.length > 0
      ? comTempo.reduce((sum, r) => {
          const diff = (new Date(r.revisado_em).getTime() - new Date(r.submetido_em).getTime()) / (1000 * 60 * 60);
          return sum + diff;
        }, 0) / comTempo.length
      : 0;

    // Fichas paradas > 3 dias
    const now = Date.now();
    const paradas = allRevisoes.filter(r => r.status === "pendente" && (now - new Date(r.submetido_em).getTime()) > 3 * 24 * 60 * 60 * 1000).length;

    return { pendentes, aprovadas, revisaoSolicitada, tempoMedio, paradas };
  }, [allRevisoes]);

  // Chart data with granularity and date filter
  const chartData = useMemo(() => {
    const filtered = allRevisoes.filter(r => {
      const d = new Date(r.submetido_em);
      if (dateFrom && d < startOfDay(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59)) return false;
      return true;
    });

    const groups: Record<string, number> = {};
    filtered.forEach(r => {
      const d = new Date(r.submetido_em);
      let key: string;
      if (granularidade === "dia") {
        key = format(d, "dd/MM/yy");
      } else if (granularidade === "mes") {
        key = format(d, "MMM/yy", { locale: ptBR });
      } else {
        key = format(d, "yyyy");
      }
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups).map(([periodo, total]) => ({ periodo, total }));
  }, [allRevisoes, granularidade, dateFrom, dateTo]);

  const handleAprovarEClose = async (revisaoId: string, configId: string, parecer: string) => {
    await aprovarFicha(revisaoId, configId, parecer);
    setFichaAberta(null);
  };

  const handleSolicitarRevisaoEClose = async (
    revisaoId: string, configId: string, parecer: string, itens: any[], requisitos: any[]
  ) => {
    await solicitarRevisao(revisaoId, configId, parecer, itens, requisitos);
    setFichaAberta(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Revisão de Fichas de Custos</h1>
          <p className="text-muted-foreground">Painel administrativo — analise e aprove fichas</p>
        </div>

        {/* Admin Dashboard Collapsible */}
        <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto border rounded-lg">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <BarChart3 className="h-4 w-4" /> Painel Administrativo
              </span>
              {adminOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            {loadingAdmin ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Card className="shadow-none">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                      <p className="text-2xl font-bold text-primary">{kpis.pendentes}</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Aprovadas</p>
                      <p className="text-2xl font-bold text-green-600">{kpis.aprovadas}</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Revisão Solicitada</p>
                      <p className="text-2xl font-bold text-orange-500">{kpis.revisaoSolicitada}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Date filter + single chart */}
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-sm">Revisões por Período</CardTitle>
                      <div className="flex items-center gap-2">
                        {/* Date From */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal text-xs", !dateFrom && "text-muted-foreground")}>
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                          </PopoverContent>
                        </Popover>
                        {/* Date To */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal text-xs", !dateTo && "text-muted-foreground")}>
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                          </PopoverContent>
                        </Popover>
                        {/* Granularity */}
                        <Select value={granularidade} onValueChange={(v) => setGranularidade(v as any)}>
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dia">Dia</SelectItem>
                            <SelectItem value="mes">Mês</SelectItem>
                            <SelectItem value="ano">Ano</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <ChartContainer config={{}} className="h-[220px]">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                          <Bar dataKey="total" name="Revisões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                        Nenhuma revisão no período selecionado
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Main Tabs: Fichas | Comunicação */}
        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList>
            <TabsTrigger value="fichas" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Fichas Pendentes
              {fichasPendentes.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{fichasPendentes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="comunicacao" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Comunicação
            </TabsTrigger>
            <TabsTrigger value="cofre" className="gap-1.5">
              <FolderOpen className="h-4 w-4" /> Cofre de Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fichas" className="mt-4 space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
              </div>
              <Select value={filtroMarca} onValueChange={(v) => { setFiltroMarca(v); setFiltroLinha("all"); setFiltroProduto("all"); }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Marca" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Marcas</SelectItem>
                  {marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroLinha} onValueChange={(v) => { setFiltroLinha(v); setFiltroProduto("all"); }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Linha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Linhas</SelectItem>
                  {linhas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Produtos</SelectItem>
                  {produtos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : fichasFiltradas.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  {busca ? "Nenhuma ficha encontrada com esse filtro" : "Nenhuma ficha pendente de revisão"}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Fichas Pendentes ({fichasFiltradas.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Versão</TableHead>
                        <TableHead>Submetido em</TableHead>
                        <TableHead>Custo Total</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fichasFiltradas.map((ficha: any) => (
                        <TableRow key={ficha.id} className={fichaAberta?.id === ficha.id ? "bg-primary/5" : ""}>
                          <TableCell className="font-medium">{ficha.produto?.nome}</TableCell>
                          <TableCell className="font-mono">{ficha.produto?.codigo}</TableCell>
                          <TableCell><Badge variant="outline">v{ficha.versao}</Badge></TableCell>
                          <TableCell>{new Date(ficha.submetido_em).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="font-semibold">{formatarMoeda(ficha.snapshot_totais?.custoTotal || 0)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant={fichaAberta?.id === ficha.id ? "default" : "outline"} onClick={() => setFichaAberta(fichaAberta?.id === ficha.id ? null : ficha)}>
                              <Eye className="h-4 w-4 mr-1" /> {fichaAberta?.id === ficha.id ? "Fechar" : "Analisar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Painel de Análise Inline */}
            {fichaAberta && (
              <FichaAnalisePanel
                ficha={fichaAberta}
                processando={processando}
                onAprovar={handleAprovarEClose}
                onSolicitarRevisao={handleSolicitarRevisaoEClose}
                onClose={() => setFichaAberta(null)}
              />
            )}
          </TabsContent>

          <TabsContent value="comunicacao" className="mt-4">
            <RevisaoChatConsolidado />
          </TabsContent>

          <TabsContent value="cofre" className="mt-4">
            <DocumentosCofre />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
