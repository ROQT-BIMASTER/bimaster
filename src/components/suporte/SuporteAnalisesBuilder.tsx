import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import {
  BarChart3, LineChart as LineIcon, AreaChart, PieChart as PieIcon,
  Table as TableIcon, Save, Trash2, Sparkles, Users, Download, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSuporteAnalise, useAnalisesSalvas, useSalvarAnalise,
  useExcluirAnalise, useToggleCompartilhar,
} from "@/hooks/suporte/useSuporteAnalytics";
import {
  METRICAS_SUPORTE, DIMENSOES_SUPORTE,
  type SuporteMetrica, type SuporteDimensao,
} from "@/lib/suporte/analyticsFormat";
import { PRESETS_SUPORTE, type SuportePreset } from "@/lib/suporte/analisePresets";
import { SuporteAnaliseChart, type AnaliseChartTipo } from "./SuporteAnaliseChart";
import { buildAnaliseCsv, downloadBlob } from "@/lib/suporte/csvExport";
import { exportToExcel } from "@/utils/excelExport";
import type { SuporteFila } from "@/hooks/suporte/types";

interface Props {
  de: string;
  ate: string;
  filaId: string | null;
  filaNome: string;
  filasSelecionaveis: SuporteFila[];
  podeCompartilhar: boolean;
}

const TIPOS: { value: AnaliseChartTipo; label: string; icon: any }[] = [
  { value: "bar", label: "Barras", icon: BarChart3 },
  { value: "line", label: "Linha", icon: LineIcon },
  { value: "area", label: "Área", icon: AreaChart },
  { value: "pie", label: "Pizza", icon: PieIcon },
  { value: "table", label: "Tabela", icon: TableIcon },
];

const CANAIS: { value: string; label: string }[] = [
  { value: "__todos__", label: "Todos os canais" },
  { value: "web", label: "Web" },
  { value: "chat", label: "Chat" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "api", label: "API" },
];

const PRIORIDADES: { value: string; label: string }[] = [
  { value: "__todos__", label: "Todas prioridades" },
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

const CATEGORIAS: { value: string; label: string }[] = [
  { value: "__todas__", label: "Todas categorias" },
  { value: "bug", label: "Bug" },
  { value: "duvida_uso", label: "Dúvida de uso" },
  { value: "solicitacao_acesso", label: "Acesso" },
  { value: "solicitacao_funcionalidade", label: "Nova feature" },
  { value: "integracao", label: "Integração" },
  { value: "financeiro", label: "Financeiro" },
  { value: "performance", label: "Performance" },
  { value: "dados_inconsistentes", label: "Dados" },
  { value: "outro", label: "Outro" },
];

const TODOS_CANAL = "__todos__";
const TODAS_CAT = "__todas__";

export function SuporteAnalisesBuilder({ de, ate, filaId, filaNome, filasSelecionaveis, podeCompartilhar }: Props) {
  const { user } = useAuth();
  const [metrica, setMetrica] = useState<SuporteMetrica>("chamados");
  const [dimensao, setDimensao] = useState<SuporteDimensao>("dia");
  const [tipo, setTipo] = useState<AnaliseChartTipo>("area");
  const [canal, setCanal] = useState<string>(TODOS_CANAL);
  const [prioridade, setPrioridade] = useState<string>(TODOS_CANAL);
  const [categoria, setCategoria] = useState<string>(TODAS_CAT);
  const [tituloSalvar, setTituloSalvar] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);

  const query = useSuporteAnalise({
    metrica, dimensao, de, ate,
    fila_id: filaId,
    canal: canal === TODOS_CANAL ? null : canal,
    prioridade: prioridade === TODOS_CANAL ? null : prioridade,
    categoria: categoria === TODAS_CAT ? null : categoria,
    limit: 50,
  });

  const { data: salvas = [] } = useAnalisesSalvas();
  const salvarMut = useSalvarAnalise();
  const excluirMut = useExcluirAnalise();
  const compartilharMut = useToggleCompartilhar();

  useEffect(() => {
    if (dimensao === "dia" || dimensao === "semana" || dimensao === "mes") {
      if (tipo === "pie") setTipo("line");
    }
    if (dimensao === "sla" || dimensao === "status" || dimensao === "canal") {
      if (tipo === "line" || tipo === "area") setTipo("pie");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensao]);

  const aplicarPreset = (p: SuportePreset) => {
    setMetrica(p.metrica);
    setDimensao(p.dimensao);
    setTipo(p.tipo as AnaliseChartTipo);
    setTituloSalvar(p.titulo);
    toast.success(`Preset aplicado: ${p.titulo}`);
  };

  const aplicarSalva = (s: any) => {
    setMetrica(s.config.metrica);
    setDimensao(s.config.dimensao);
    setTipo(s.config.tipo);
    setCanal(s.config.canal ?? TODOS_CANAL);
    setPrioridade(s.config.prioridade ?? TODOS_CANAL);
    setCategoria(s.config.categoria ?? TODAS_CAT);
    setTituloSalvar(s.nome);
    setCompartilhar(!!s.compartilhada);
  };

  const tituloAtual = useMemo(() => {
    const mLabel = METRICAS_SUPORTE.find((x) => x.value === metrica)?.label ?? metrica;
    const dLabel = DIMENSOES_SUPORTE.find((x) => x.value === dimensao)?.label ?? dimensao;
    return `${mLabel} por ${dLabel}`;
  }, [metrica, dimensao]);

  const handleSalvar = () => {
    const nome = tituloSalvar.trim() || tituloAtual;
    if (compartilhar && !filaId) {
      toast.error("Selecione um departamento específico para compartilhar (não pode ser 'Todos').");
      return;
    }
    salvarMut.mutate(
      {
        nome,
        config: {
          metrica, dimensao, tipo,
          canal: canal === TODOS_CANAL ? null : canal,
          prioridade: prioridade === TODOS_CANAL ? null : prioridade,
          categoria: categoria === TODAS_CAT ? null : categoria,
        },
        fila_id: filaId ?? null,
        compartilhada: compartilhar,
      },
      {
        onSuccess: () => toast.success("Análise salva"),
        onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
      },
    );
  };

  const handleCsv = () => {
    const rows = query.data ?? [];
    const filtros: Record<string, string> = {
      Departamento: filaNome,
      Métrica: METRICAS_SUPORTE.find((x) => x.value === metrica)?.label ?? metrica,
      Dimensão: DIMENSOES_SUPORTE.find((x) => x.value === dimensao)?.label ?? dimensao,
    };
    const blob = buildAnaliseCsv(rows, {
      titulo: tituloAtual,
      periodo: `${format(new Date(de), "dd/MM/yyyy")} a ${format(new Date(ate), "dd/MM/yyyy")}`,
      filtros,
    });
    const nome = `${tituloAtual.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${format(new Date(), "yyyyMMdd")}.csv`;
    downloadBlob(blob, nome);
    toast.success("CSV exportado");
  };

  const handleXlsx = async () => {
    const rows = query.data ?? [];
    // Usa helper centralizado (integra auditExport para trilha de auditoria).
    await exportToExcel(
      rows.map((r) => ({ label: r.label, valor: r.valor ?? 0 })),
      {
        filename: `${tituloAtual.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        sheetName: "Análise Suporte",
        columns: [
          { header: "Label", key: "label", width: 40 },
          { header: "Valor", key: "valor", width: 16 },
        ],
        includeTimestamp: true,
      },
    );
    toast.success("Excel exportado");
  };

  const presetGroups = useMemo(() => {
    const m = new Map<string, SuportePreset[]>();
    PRESETS_SUPORTE.forEach((p) => {
      const arr = m.get(p.grupo) ?? [];
      arr.push(p);
      m.set(p.grupo, arr);
    });
    return Array.from(m.entries());
  }, []);

  const nomeFilaSalva = (s: any) => {
    const id = s.fila_id;
    if (!id) return "—";
    return filasSelecionaveis.find((f) => f.id === id)?.nome ?? "outro depto";
  };

  const minhas = useMemo(
    () => salvas.filter((a) => a.user_id === user?.id),
    [salvas, user?.id],
  );
  const doDepto = useMemo(
    () => salvas.filter((a) => a.user_id !== user?.id && a.compartilhada),
    [salvas, user?.id],
  );

  const renderLinhaSalva = (a: any, dono: boolean) => (
    <div key={a.id} className="flex items-center justify-between gap-2 group rounded-md px-2 py-1.5 hover:bg-muted/50">
      <button className="flex-1 text-left min-w-0" onClick={() => aplicarSalva(a)}>
        <div className="text-xs truncate font-medium">{a.nome}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {a.compartilhada ? <><Users className="inline h-2.5 w-2.5 mr-0.5" />{nomeFilaSalva(a)}</> : "pessoal"}
        </div>
      </button>
      {dono && (
        <>
          {podeCompartilhar && a.fila_id && (
            <Switch
              checked={!!a.compartilhada}
              onCheckedChange={(v) =>
                compartilharMut.mutate({ id: a.id, compartilhada: v, fila_id: a.fila_id })
              }
              className="scale-75 opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100"
              aria-label="Compartilhar com o departamento"
            />
          )}
          <Button
            variant="ghost" size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={() => excluirMut.mutate(a.id)}
            title="Excluir">
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      {/* Painel construtor */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Construtor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Métrica</Label>
              <Select value={metrica} onValueChange={(v) => setMetrica(v as SuporteMetrica)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METRICAS_SUPORTE.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dimensão</Label>
              <Select value={dimensao} onValueChange={(v) => setDimensao(v as SuporteDimensao)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIMENSOES_SUPORTE.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</Label>
              <ToggleGroup type="single" value={tipo} onValueChange={(v) => v && setTipo(v as AnaliseChartTipo)} className="mt-1 flex-wrap justify-start">
                {TIPOS.map((t) => (
                  <ToggleGroupItem key={t.value} value={t.value} title={t.label} className="h-8 w-8 p-0">
                    <t.icon className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="pt-2 border-t border-border space-y-2">
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Canal</Label>
                <Select value={canal} onValueChange={setCanal}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prioridade</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2 border-t border-border space-y-2">
              <Input
                value={tituloSalvar}
                onChange={(e) => setTituloSalvar(e.target.value)}
                placeholder={tituloAtual}
                className="h-9 text-sm"
              />
              {podeCompartilhar && (
                <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                  <span className="text-muted-foreground">Compartilhar com o departamento</span>
                  <Switch checked={compartilhar} onCheckedChange={setCompartilhar} />
                </label>
              )}
              <Button onClick={handleSalvar} size="sm" className="w-full gap-1.5" disabled={salvarMut.isPending}>
                <Save className="h-3.5 w-3.5" /> Salvar análise
              </Button>
            </div>
          </CardContent>
        </Card>

        {minhas.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Minhas análises</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {minhas.map((a) => renderLinhaSalva(a, true))}
            </CardContent>
          </Card>
        )}

        {doDepto.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" /> Do departamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {doDepto.map((a) => renderLinhaSalva(a, false))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gráfico + galeria */}
      <div className="space-y-3 min-w-0">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <CardTitle className="text-base truncate">{tituloAtual}</CardTitle>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {filaNome}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {format(new Date(de), "dd/MM")} – {format(new Date(ate), "dd/MM/yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={handleCsv} disabled={!query.data || query.data.length === 0}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={handleXlsx} disabled={!query.data || query.data.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            {query.isLoading ? (
              <Skeleton className="h-[440px] w-full" />
            ) : query.error ? (
              <div className="h-[440px] flex items-center justify-center text-sm text-destructive">
                Erro ao carregar análise.
              </div>
            ) : (query.data || []).length === 0 ? (
              <div className="h-[440px] flex items-center justify-center text-sm text-muted-foreground">
                Sem dados no período.
              </div>
            ) : (
              <SuporteAnaliseChart
                tipo={tipo}
                data={query.data || []}
                metrica={metrica}
                dimensao={dimensao}
                titulo={tituloAtual}
                height={440}
              />
            )}
          </CardContent>
        </Card>


        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Galeria de análises ({PRESETS_SUPORTE.length} presets)</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["SLA", "Volume", "Tempos"]}>
              {presetGroups.map(([grupo, lista]) => (
                <AccordionItem key={grupo} value={grupo}>
                  <AccordionTrigger className="text-sm font-medium">
                    {grupo} <span className="text-xs text-muted-foreground ml-2">({lista.length})</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
                      {lista.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => aplicarPreset(p)}
                          className="text-left rounded-md border border-border bg-card hover:bg-muted/40 hover:border-primary/40 transition-all p-2.5 group"
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
  );
}
