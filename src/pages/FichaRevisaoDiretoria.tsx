import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { usePageBgColor } from "@/components/shared/PageBgCustomizer";
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
  Link2, ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFichaRevisaoDiretoria } from "@/hooks/useFichaRevisao";
import { FichaAnalisePanel } from "@/components/fabrica/FichaAnalisePanel";
import { MultiSelectProdutos } from "@/components/fabrica/MultiSelectProdutos";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RevisaoChatConsolidado } from "@/components/fabrica/RevisaoChatConsolidado";
import { DocumentosCofre } from "@/components/fabrica/DocumentosCofre";
import { supabase } from "@/integrations/supabase/client";
import { custoTotalDoSnapshot } from "@/lib/fabrica/ficha-custo-snapshot";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { format, startOfDay, startOfMonth, startOfYear, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function FichaRevisaoDiretoria() {
  const navigate = useNavigate();
  const { fichasPendentes, isLoading, processando, aprovarFicha, solicitarRevisao, cancelarAprovacao, refetch, statusFiltro, setStatusFiltro } = useFichaRevisaoDiretoria();
  const [fichaAberta, setFichaAberta] = useState<any | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("all");
  const [filtroLinha, setFiltroLinha] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "kit" | "unitario">("todos");
  const [filtroProvador, setFiltroProvador] = useState<"todos" | "venda" | "provador">("todos");
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [adminOpen, setAdminOpen] = useState(true);
  const [tabAtiva, setTabAtiva] = useState("fichas");
  const [granularidade, setGranularidade] = useState<"dia" | "mes" | "ano">("dia");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  // Filtro de data da LISTA de fichas (independente do gráfico)
  const [listDateFrom, setListDateFrom] = useState<Date | undefined>(undefined);
  const [listDateTo, setListDateTo] = useState<Date | undefined>(undefined);

  // Admin dashboard data
  const [allRevisoes, setAllRevisoes] = useState<any[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [msgCount, setMsgCount] = useState(0);

  // Mapa user_id -> nome (para colunas Submetido por / Aprovado por)
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

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

  // Carrega nomes dos usuários referenciados nas fichas (submetido_por / revisado_por)
  useEffect(() => {
    const ids = new Set<string>();
    fichasPendentes.forEach((f: any) => {
      if (f.submetido_por) ids.add(f.submetido_por);
      if (f.revisado_por) ids.add(f.revisado_por);
    });
    const missing = [...ids].filter(id => !profilesMap[id]);
    if (missing.length === 0) return;
    supabase.from("profiles").select("id, nome").in("id", missing).then(({ data }) => {
      if (!data) return;
      setProfilesMap(prev => {
        const next = { ...prev };
        data.forEach((p: any) => { next[p.id] = p.nome || p.id; });
        return next;
      });
    });
  }, [fichasPendentes, profilesMap]);

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
    const map = new Map<string, { id: string; nome: string; codigo?: string; tipo?: string }>();
    fichasPendentes.forEach((f: any) => {
      if (!f.produto) return;
      if (filtroMarca !== "all" && f.produto.marca !== filtroMarca) return;
      if (filtroLinha !== "all" && f.produto.linha !== filtroLinha) return;
      const isKit = (f.produto.tipo || "").toUpperCase() === "DISPLAY";
      if (filtroTipo === "kit" && !isKit) return;
      if (filtroTipo === "unitario" && isKit) return;
      map.set(f.produto.id, { id: f.produto.id, nome: f.produto.nome, codigo: f.produto.codigo, tipo: f.produto.tipo });
    });
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [fichasPendentes, filtroMarca, filtroLinha, filtroTipo]);

  // Query grade_itens para mapear Kit → Filhos
  const [gradeRelMap, setGradeRelMap] = useState<{ filhoToPai: Map<string, string>; paiToFilhos: Map<string, string[]> }>({ filhoToPai: new Map(), paiToFilhos: new Map() });

  useEffect(() => {
    const loadGrade = async () => {
      const { data } = await supabase
        .from("fabrica_produto_grade_itens")
        .select("produto_pai_id, produto_filho_id");
      if (!data) return;
      const f2p = new Map<string, string>();
      const p2f = new Map<string, string[]>();
      (data as any[]).forEach((r: any) => {
        f2p.set(r.produto_filho_id, r.produto_pai_id);
        const arr = p2f.get(r.produto_pai_id) || [];
        arr.push(r.produto_filho_id);
        p2f.set(r.produto_pai_id, arr);
      });
      setGradeRelMap({ filhoToPai: f2p, paiToFilhos: p2f });
    };
    loadGrade();
  }, []);

  // Filtros + agrupamento Kit→Filho
  const fichasFiltradas = useMemo(() => {
    const filtered = fichasPendentes.filter((f: any) => {
      if (filtroMarca !== "all" && f.produto?.marca !== filtroMarca) return false;
      if (filtroLinha !== "all" && f.produto?.linha !== filtroLinha) return false;
      if (produtosSelecionados.length > 0 && !produtosSelecionados.includes(f.produto?.id)) return false;
      const isKit = (f.produto?.tipo || "").toUpperCase() === "DISPLAY";
      if (filtroTipo === "kit" && !isKit) return false;
      if (filtroTipo === "unitario" && isKit) return false;
      const isProv = !!f.produto?.is_provador;
      if (filtroProvador === "venda" && isProv) return false;
      if (filtroProvador === "provador" && !isProv) return false;
      if (busca) {
        const b = busca.toLowerCase();
        if (!f.produto?.nome?.toLowerCase().includes(b) && !f.produto?.codigo?.toLowerCase().includes(b)) return false;
      }
      // Filtro de data: usa data de aprovação se aprovada, senão submissão
      const refDateStr = statusFiltro === "aprovada" ? (f.revisado_em || f.submetido_em) : f.submetido_em;
      if (refDateStr) {
        const d = new Date(refDateStr);
        if (listDateFrom && d < startOfDay(listDateFrom)) return false;
        if (listDateTo && d > new Date(listDateTo.getFullYear(), listDateTo.getMonth(), listDateTo.getDate(), 23, 59, 59)) return false;
      }
      return true;
    });

    // Reordenar: filhos logo após seus pais
    const filteredProdutoIds = new Set(filtered.map((f: any) => f.produto_id));
    const result: any[] = [];
    const placed = new Set<string>();

    for (const f of filtered) {
      // Se é filho e o pai está na lista, pular (será inserido após o pai)
      if (gradeRelMap.filhoToPai.has(f.produto_id) && filteredProdutoIds.has(gradeRelMap.filhoToPai.get(f.produto_id)!)) {
        continue;
      }
      if (placed.has(f.id)) continue;
      result.push(f);
      placed.add(f.id);
      // Se é pai, inserir fichas dos filhos logo após
      const childIds = gradeRelMap.paiToFilhos.get(f.produto_id);
      if (childIds) {
        for (const childProdId of childIds) {
          const childFicha = filtered.find((cf: any) => cf.produto_id === childProdId && !placed.has(cf.id));
          if (childFicha) {
            result.push(childFicha);
            placed.add(childFicha.id);
          }
        }
      }
    }
    // Adicionar órfãos
    for (const f of filtered) {
      if (!placed.has(f.id)) result.push(f);
    }
    return result;
  }, [fichasPendentes, busca, filtroMarca, filtroLinha, produtosSelecionados, filtroTipo, filtroProvador, gradeRelMap, listDateFrom, listDateTo, statusFiltro]);

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

  const { bgStyle, BgColorButton } = usePageBgColor("ficha_revisao_diretoria");

  // Modo foco: Esc fecha
  useEffect(() => {
    if (!fichaAberta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFichaAberta(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fichaAberta]);

  // Helpers do modo foco
  const fichaPaiId = fichaAberta ? gradeRelMap.filhoToPai.get(fichaAberta.produto_id) : undefined;
  const fichaPaiNome = fichaPaiId
    ? fichasPendentes.find((f: any) => f.produto_id === fichaPaiId)?.produto?.nome
    : undefined;

  return (
    <DashboardLayout>
      <div className="space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-[calc(100vh-52px)]" style={bgStyle}>
        {fichaAberta ? (
          /* ============= MODO FOCO ============= */
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setFichaAberta(null)}
                title="Voltar para a lista (Esc)"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para a lista
              </Button>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold truncate">
                    {fichaAberta.produto?.nome}
                  </h1>
                  <Badge variant="outline" className="font-mono text-xs">
                    {fichaAberta.produto?.codigo}
                  </Badge>
                  <Badge variant="outline">v{fichaAberta.versao}</Badge>
                  {fichaAberta.status === "aprovada" ? (
                    <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Aprovada
                    </Badge>
                  ) : fichaAberta.status === "revisao_solicitada" ? (
                    <Badge className="bg-orange-500 hover:bg-orange-500 text-white gap-1">
                      <AlertTriangle className="h-3 w-3" /> Revisão Solicitada
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" /> Pendente
                    </Badge>
                  )}
                  {fichaPaiNome && (
                    <Badge variant="outline" className="text-blue-600 border-blue-300 gap-1">
                      <Link2 className="h-3 w-3" /> Parte do Kit: {fichaPaiNome}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pressione <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">Esc</kbd> para voltar à lista
                </p>
              </div>
            </div>
            <FichaAnalisePanel
              ficha={fichaAberta}
              processando={processando}
              onAprovar={handleAprovarEClose}
              onSolicitarRevisao={handleSolicitarRevisaoEClose}
              onClose={() => setFichaAberta(null)}
              fichasPendentes={fichasFiltradas}
              gradeRelMap={gradeRelMap}
              onSelectFicha={setFichaAberta}
              onRefetch={refetch}
              onCancelarAprovacao={async (motivo) => {
                await cancelarAprovacao(fichaAberta.id, fichaAberta.config_id, motivo);
                setFichaAberta(null);
              }}
            />
          </>
        ) : (
          /* ============= MODO LISTA ============= */
          <>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/dashboard/fabrica/produtos-acabados");
            }}
            title="Voltar"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>
          <BgColorButton />
          <div>
            <h1 className="text-3xl font-bold">Revisão de Fichas de Custos</h1>
            <p className="text-muted-foreground">Painel administrativo — analise e aprove fichas</p>
          </div>
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
              <ClipboardList className="h-4 w-4" />
              {statusFiltro === "aprovada" ? "Fichas Aprovadas" : "Fichas Pendentes"}
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
            {/* Status (Pendentes / Aprovadas) */}
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                type="single"
                value={statusFiltro}
                onValueChange={(v) => { if (v) setStatusFiltro(v as "pendente" | "aprovada"); }}
                className="border rounded-md"
              >
                <ToggleGroupItem value="pendente" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  Pendentes
                </ToggleGroupItem>
                <ToggleGroupItem value="aprovada" className="text-xs px-3 h-8 data-[state=on]:bg-green-600 data-[state=on]:text-white">
                  Aprovadas (60 dias)
                </ToggleGroupItem>
              </ToggleGroup>

              <ToggleGroup
                type="single"
                value={filtroTipo}
                onValueChange={(v) => { if (v) setFiltroTipo(v as "todos" | "kit" | "unitario"); }}
                className="border rounded-md"
              >
                <ToggleGroupItem value="todos" className="text-xs px-3 h-8 data-[state=on]:bg-muted">Todos</ToggleGroupItem>
                <ToggleGroupItem value="kit" className="text-xs px-3 h-8 data-[state=on]:bg-blue-600 data-[state=on]:text-white">Kits</ToggleGroupItem>
                <ToggleGroupItem value="unitario" className="text-xs px-3 h-8 data-[state=on]:bg-amber-600 data-[state=on]:text-white">Unitários</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-start">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
              </div>
              <Select value={filtroMarca} onValueChange={(v) => { setFiltroMarca(v); setFiltroLinha("all"); setProdutosSelecionados([]); }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Marca" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Marcas</SelectItem>
                  {marcas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroLinha} onValueChange={(v) => { setFiltroLinha(v); setProdutosSelecionados([]); }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Linha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Linhas</SelectItem>
                  {linhas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="w-[280px]">
                <MultiSelectProdutos
                  produtos={produtos}
                  selected={produtosSelecionados}
                  onChange={setProdutosSelecionados}
                  placeholder="Filtrar produtos (multi)..."
                />
              </div>
              {/* Filtro de data da lista */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5", !listDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {listDateFrom ? format(listDateFrom, "dd/MM/yyyy") : "Data de"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={listDateFrom} onSelect={setListDateFrom} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5", !listDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {listDateTo ? format(listDateTo, "dd/MM/yyyy") : "Data até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={listDateTo} onSelect={setListDateTo} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
              {(listDateFrom || listDateTo) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setListDateFrom(undefined); setListDateTo(undefined); }}>
                  Limpar datas
                </Button>
              )}
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
                  <CardTitle className="text-base">{statusFiltro === "aprovada" ? "Fichas Aprovadas" : "Fichas Pendentes"} ({fichasFiltradas.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Versão</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>{statusFiltro === "aprovada" ? "Aprovada em" : "Submetido em"}</TableHead>
                        <TableHead>Submetido por</TableHead>
                        <TableHead>Aprovado por</TableHead>
                        <TableHead>Custo Total</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fichasFiltradas.map((ficha: any) => {
                        const paiProdutoId = gradeRelMap.filhoToPai.get(ficha.produto_id);
                        const paiNaLista = paiProdutoId && fichasFiltradas.some((f: any) => f.produto_id === paiProdutoId);
                        const isFilho = !!paiNaLista;
                        const paiNome = isFilho ? fichasFiltradas.find((f: any) => f.produto_id === paiProdutoId)?.produto?.nome : null;
                        const statusBadge = ficha.status === "aprovada" ? (
                          <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Aprovada
                          </Badge>
                        ) : ficha.status === "revisao_solicitada" ? (
                          <Badge className="bg-orange-500 hover:bg-orange-500 text-white gap-1">
                            <AlertTriangle className="h-3 w-3" /> Revisão Solicitada
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" /> Pendente
                          </Badge>
                        );
                        const dataExibida = statusFiltro === "aprovada" && ficha.revisado_em
                          ? new Date(ficha.revisado_em).toLocaleDateString("pt-BR")
                          : new Date(ficha.submetido_em).toLocaleDateString("pt-BR");

                        return (
                          <TableRow
                            key={ficha.id}
                            className={cn(
                              fichaAberta?.id === ficha.id ? "bg-primary/5" : "",
                              isFilho && "bg-blue-50/30 dark:bg-blue-950/20 border-l-2 border-l-blue-400"
                            )}
                          >
                            <TableCell className={cn("font-medium", isFilho && "pl-8")}>
                              {isFilho && (
                                <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-0.5">
                                  <Link2 className="h-3 w-3" /> ↳ Kit: {paiNome}
                                </span>
                              )}
                              {ficha.produto?.nome}
                            </TableCell>
                            <TableCell className="font-mono">{ficha.produto?.codigo}</TableCell>
                            <TableCell><Badge variant="outline">v{ficha.versao}</Badge></TableCell>
                            <TableCell>{statusBadge}</TableCell>
                            <TableCell>{dataExibida}</TableCell>
                            <TableCell className="text-xs">
                              {ficha.submetido_por
                                ? <span title={ficha.submetido_em ? new Date(ficha.submetido_em).toLocaleString("pt-BR") : ""}>{profilesMap[ficha.submetido_por] || "—"}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-xs">
                              {ficha.revisado_por && ficha.status === "aprovada"
                                ? <span title={ficha.revisado_em ? new Date(ficha.revisado_em).toLocaleString("pt-BR") : ""}>{profilesMap[ficha.revisado_por] || "—"}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="font-semibold">{formatarMoeda(custoTotalDoSnapshot(ficha.snapshot_totais))}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant={fichaAberta?.id === ficha.id ? "default" : "outline"} onClick={() => setFichaAberta(fichaAberta?.id === ficha.id ? null : ficha)}>
                                <Eye className="h-4 w-4 mr-1" /> {fichaAberta?.id === ficha.id ? "Fechar" : "Analisar"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

          </TabsContent>

          <TabsContent value="comunicacao" className="mt-4">
            <RevisaoChatConsolidado />
          </TabsContent>

          <TabsContent value="cofre" className="mt-4">
            <DocumentosCofre />
          </TabsContent>
        </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
