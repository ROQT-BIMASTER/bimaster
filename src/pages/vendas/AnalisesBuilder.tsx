import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";
import { FiltrosBar } from "@/components/vendas/FiltrosBar";
import { UnidadeToggle, loadUnidade } from "@/components/vendas/UnidadeToggle";
import { AnaliseChart, type AnaliseChartTipo } from "@/components/vendas/AnaliseChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BarChart3, LineChart as LineIcon, AreaChart, PieChart as PieIcon, Grid3X3, Table as TableIcon, Save, Trash2, Sparkles } from "lucide-react";
import { useAnaliseRPC } from "@/hooks/useAnaliseRPC";
import { PRESETS, METRICAS, DIMENSOES, type AnalisePreset, type Dimensao } from "@/lib/vendas/analisePresets";
import { loadAnalisesSalvas, saveAnalise, removeAnalise, type AnaliseSalva } from "@/lib/vendas/analisesSalvas";
import type { Metrica } from "@/lib/charts/corporateTheme";
import type { VendasFilters } from "@/hooks/useVendasAnalise";
import type { Unidade } from "@/lib/vendas/unidade";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

function defaultFilters(): VendasFilters {
  const now = new Date();
  const first = new Date(now.getFullYear(), 0, 1);
  return {
    de: format(first, "yyyy-MM-dd"),
    ate: format(now, "yyyy-MM-dd"),
    empresa: null,
    vendedor: null,
    coordenador: null,
  };
}

const TIPOS: { value: AnaliseChartTipo; label: string; icon: any }[] = [
  { value: "bar", label: "Barras", icon: BarChart3 },
  { value: "line", label: "Linha", icon: LineIcon },
  { value: "area", label: "Área", icon: AreaChart },
  { value: "pie", label: "Pizza", icon: PieIcon },
  { value: "treemap", label: "Treemap", icon: Grid3X3 },
  { value: "table", label: "Tabela", icon: TableIcon },
];

export default function AnalisesBuilder() {
  const [filters, setFilters] = useState<VendasFilters>(defaultFilters);
  const [unidade, setUnidade] = useState<Unidade>(() => loadUnidade());
  const [metrica, setMetrica] = useState<Metrica>("faturamento");
  const [dimensao, setDimensao] = useState<Dimensao>("mes");
  const [tipo, setTipo] = useState<AnaliseChartTipo>("line");
  const [salvas, setSalvas] = useState<AnaliseSalva[]>(loadAnalisesSalvas);
  const [tituloSalvar, setTituloSalvar] = useState("");

  const query = useAnaliseRPC({
    metrica, dimensao,
    de: filters.de, ate: filters.ate,
    empresa_id: filters.empresa,
    limit: 50,
  });

  // Sugerir tipo coerente ao mudar dimensão
  useEffect(() => {
    if (dimensao === "mes" || dimensao === "trimestre" || dimensao === "ano") {
      if (tipo === "pie" || tipo === "treemap") setTipo("line");
    }
  }, [dimensao]); // eslint-disable-line react-hooks/exhaustive-deps

  const aplicarPreset = (p: AnalisePreset) => {
    setMetrica(p.metrica);
    setDimensao(p.dimensao);
    setTipo(p.tipo);
    setTituloSalvar(p.titulo);
    toast.success(`Preset carregado: ${p.titulo}`);
  };

  const aplicarSalva = (a: AnaliseSalva) => {
    setMetrica(a.metrica);
    setDimensao(a.dimensao);
    setTipo(a.tipo);
    setTituloSalvar(a.titulo);
  };

  const handleSalvar = () => {
    const t = tituloSalvar.trim() || `${METRICAS.find((m) => m.value === metrica)?.label} por ${DIMENSOES.find((d) => d.value === dimensao)?.label}`;
    saveAnalise({ titulo: t, metrica, dimensao, tipo });
    setSalvas(loadAnalisesSalvas());
    toast.success("Análise salva");
  };

  const handleRemover = (id: string) => {
    removeAnalise(id);
    setSalvas(loadAnalisesSalvas());
  };

  const presetGroups = useMemo(() => {
    const m = new Map<string, AnalisePreset[]>();
    PRESETS.forEach((p) => {
      const arr = m.get(p.grupo) ?? [];
      arr.push(p);
      m.set(p.grupo, arr);
    });
    return Array.from(m.entries());
  }, []);

  const periodoLabel = filters.de && filters.ate
    ? `${format(parseLocalDate(filters.de), "dd/MM/yyyy", { locale: ptBR })} – ${format(parseLocalDate(filters.ate), "dd/MM/yyyy", { locale: ptBR })}`
    : "—";

  const titulo = `${METRICAS.find((m) => m.value === metrica)?.label} por ${DIMENSOES.find((d) => d.value === dimensao)?.label}`;
  const showUnidade = metrica === "quantidade";

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="w-full px-4 md:px-6 py-6 space-y-5">
          <FuturaBackButton />

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Análises de vendas</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Construa suas próprias visões: escolha métrica × dimensão × tipo, ou parta de um preset.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {showUnidade && <UnidadeToggle value={unidade} onChange={setUnidade} disableCx />}
              <div className="rounded-full bg-card border border-border px-4 py-2 text-xs text-muted-foreground shadow-sm">
                Período: <span className="font-medium text-foreground">{periodoLabel}</span>
              </div>
            </div>
          </div>

          <FiltrosBar value={filters} onChange={setFilters} />

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
            {/* Painel construtor */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Construtor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Métrica</label>
                    <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {METRICAS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dimensão</label>
                    <Select value={dimensao} onValueChange={(v) => setDimensao(v as Dimensao)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIMENSOES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</label>
                    <ToggleGroup type="single" value={tipo} onValueChange={(v) => v && setTipo(v as AnaliseChartTipo)} className="mt-1 flex-wrap justify-start">
                      {TIPOS.map((t) => (
                        <ToggleGroupItem key={t.value} value={t.value} title={t.label} className="h-8 w-8 p-0">
                          <t.icon className="h-3.5 w-3.5" />
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                  <div className="pt-2 border-t border-border space-y-2">
                    <Input
                      value={tituloSalvar}
                      onChange={(e) => setTituloSalvar(e.target.value)}
                      placeholder="Nome para salvar (opcional)"
                      className="h-9 text-sm"
                    />
                    <Button onClick={handleSalvar} size="sm" className="w-full gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Salvar análise
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {salvas.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Minhas análises</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5">
                    {salvas.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 group rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer" onClick={() => aplicarSalva(a)}>
                        <span className="text-xs truncate">{a.titulo}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleRemover(a.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Gráfico */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{titulo}</CardTitle>
              </CardHeader>
              <CardContent>
                {query.isLoading ? (
                  <Skeleton className="h-[360px] w-full" />
                ) : query.error ? (
                  <div className="h-[360px] flex items-center justify-center text-sm text-destructive">
                    Erro ao carregar análise.
                  </div>
                ) : (query.data || []).length === 0 ? (
                  <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
                    Sem dados no período.
                  </div>
                ) : (
                  <AnaliseChart
                    tipo={tipo}
                    data={query.data || []}
                    metrica={metrica}
                    unidade={unidade}
                    dimensao={dimensao}
                    titulo={titulo}
                    height={400}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Galeria de presets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Galeria de análises ({PRESETS.length} presets)</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={["Faturamento", "Mix & rankings"]}>
                {presetGroups.map(([grupo, lista]) => (
                  <AccordionItem key={grupo} value={grupo}>
                    <AccordionTrigger className="text-sm font-medium">
                      {grupo} <span className="text-xs text-muted-foreground ml-2">({lista.length})</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                        {lista.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => aplicarPreset(p)}
                            className="text-left rounded-md border border-border bg-card hover:bg-muted/40 hover:border-primary/40 transition-all p-3 group"
                          >
                            <div className="text-xs font-medium text-foreground group-hover:text-primary">{p.titulo}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {p.tipo} · {p.metrica} × {p.dimensao}
                            </div>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
