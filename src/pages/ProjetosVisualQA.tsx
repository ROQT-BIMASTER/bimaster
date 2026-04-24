/**
 * Visual QA Sandbox — Projetos
 *
 * Página interna para validar rapidamente como cores de fundo customizadas
 * (via `getBgPaletteVars`) afetam Cards, Tabelas, Inputs, Badges, KPIs,
 * estados (loading/empty/error) e contraste de texto/borda.
 *
 * Não tem dados reais: tudo é mock determinístico para inspeção visual.
 * Inclui medidor ao vivo de contraste WCAG AA contra a superfície atual.
 */
import { useMemo, useState } from "react";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KpiCard } from "@/components/ui/kpi-card";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { getBgPaletteVars, isDarkHex } from "@/lib/colorUtils";
import { Activity, AlertTriangle, CheckCircle2, Clock, Inbox, TrendingUp } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// ---- Contraste ao vivo (espelha a lógica de colorUtils) ----------------
function hexToLum(hex: string): number {
  const c = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function hslStrToLum(hsl: string): number {
  const [h, s, l] = hsl.split(" ").map((v) => parseFloat(v));
  const sn = s / 100;
  const ln = l / 100;
  const cc = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = cc * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [cc, x, 0];
  else if (hp < 2) [r, g, b] = [x, cc, 0];
  else if (hp < 3) [r, g, b] = [0, cc, x];
  else if (hp < 4) [r, g, b] = [0, x, cc];
  else if (hp < 5) [r, g, b] = [x, 0, cc];
  else [r, g, b] = [cc, 0, x];
  const m = ln - cc / 2;
  const t = (v: number) => {
    const u = v + m;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * t(r) + 0.7152 * t(g) + 0.0722 * t(b);
}
function ratio(a: number, b: number): number {
  const x = Math.max(a, b);
  const y = Math.min(a, b);
  return (x + 0.05) / (y + 0.05);
}

const QUICK_COLORS: { hex: string; label: string }[] = [
  { hex: "#FFFFFF", label: "Branco" },
  { hex: "#F5E6C8", label: "Areia" },
  { hex: "#7DD3FC", label: "Céu" },
  { hex: "#4A9988", label: "Teal médio" },
  { hex: "#8C7755", label: "Oliva" },
  { hex: "#808080", label: "Cinza 50%" },
  { hex: "#E91E78", label: "Magenta" },
  { hex: "#1E293B", label: "Slate dark" },
  { hex: "#0F1623", label: "Quase preto" },
];

const MOCK_TABLE = [
  { id: "T-1042", titulo: "Validar etiqueta SKU 451", responsavel: "Ana Lima", status: "Em andamento", prioridade: "Alta", prazo: "2026-04-28" },
  { id: "T-1043", titulo: "Aprovar arte embalagem", responsavel: "Bruno Reis", status: "Concluído", prioridade: "Média", prazo: "2026-04-22" },
  { id: "T-1044", titulo: "Revisar composição INCI", responsavel: "Camila Souza", status: "Pendente", prioridade: "Baixa", prazo: "2026-05-02" },
  { id: "T-1045", titulo: "Conferir cotação fornecedor", responsavel: "Diego Alves", status: "Atrasado", prioridade: "Alta", prazo: "2026-04-18" },
];

export default function ProjetosVisualQA() {
  const { bgColor, setBgColor } = usePageBgColor("visual_qa");
  const [showLoading, setShowLoading] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  const paletteVars = useMemo(() => getBgPaletteVars(bgColor) as React.CSSProperties, [bgColor]);

  // Métricas de contraste ao vivo
  const contrastReport = useMemo(() => {
    if (!bgColor) return null;
    const vars = getBgPaletteVars(bgColor);
    const bgLum = hexToLum(bgColor);
    const fgLum = hslStrToLum(vars["--foreground"]);
    const cardLum = hslStrToLum(vars["--card"]);
    const cardFgLum = hslStrToLum(vars["--card-foreground"]);
    const mutedFgLum = hslStrToLum(vars["--muted-foreground"]);
    const borderLum = hslStrToLum(vars["--border"]);
    return {
      fgOnBg: ratio(fgLum, bgLum),
      cardFgOnCard: ratio(cardFgLum, cardLum),
      mutedOnBg: ratio(mutedFgLum, bgLum),
      borderOnBg: ratio(borderLum, bgLum),
      isDark: isDarkHex(bgColor),
    };
  }, [bgColor]);

  const ratioBadge = (r: number, min: number) => {
    const ok = r >= min;
    return (
      <Badge
        variant={ok ? "secondary" : "destructive"}
        className="font-mono text-[10px]"
        title={`mínimo ${min}:1`}
      >
        {r.toFixed(2)}:1 {ok ? "✓" : "✗"}
      </Badge>
    );
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={paletteVars}
    >
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        {/* Breadcrumb + título */}
        <Breadcrumb className="min-h-[28px] flex items-center">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/projetos">Projetos</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Visual QA</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-2xl">Visual QA — Projetos</CardTitle>
                <CardDescription>
                  Sandbox para validar contraste, alinhamento e estados de UI sob fundos custom.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />
                <Button
                  size="sm"
                  variant={showLoading ? "default" : "outline"}
                  onClick={() => setShowLoading((v) => !v)}
                >
                  Loading
                </Button>
                <Button
                  size="sm"
                  variant={showEmpty ? "default" : "outline"}
                  onClick={() => setShowEmpty((v) => !v)}
                >
                  Empty
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Atalhos rápidos de cor */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {QUICK_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setBgColor(c.hex)}
                  className={`h-7 px-2 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                    bgColor === c.hex
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : "border-border hover:border-foreground/40"
                  }`}
                  style={{
                    backgroundColor: c.hex,
                    color: isDarkHex(c.hex) ? "#fff" : "#111",
                  }}
                  title={c.hex}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: isDarkHex(c.hex) ? "#fff" : "#111" }}
                  />
                  {c.label}
                </button>
              ))}
            </div>

            {/* Painel de contraste WCAG */}
            {contrastReport && (
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contraste WCAG ({contrastReport.isDark ? "tema escuro" : "tema claro"})
                  </p>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {bgColor}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">texto/fundo</span>
                    {ratioBadge(contrastReport.fgOnBg, 4.5)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">texto/card</span>
                    {ratioBadge(contrastReport.cardFgOnCard, 4.5)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">muted/fundo</span>
                    {ratioBadge(contrastReport.mutedOnBg, 4.5)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">borda/fundo</span>
                    {ratioBadge(contrastReport.borderOnBg, 3)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground/80 px-1">KPIs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Tarefas ativas" value="128" icon={Activity} variant="info" loading={showLoading} />
            <KpiCard title="Concluídas (7d)" value="42" icon={CheckCircle2} variant="success" loading={showLoading} />
            <KpiCard title="Atrasadas" value="7" icon={AlertTriangle} variant="default" loading={showLoading} />
            <KpiCard title="Produtividade" value="+12%" icon={TrendingUp} variant="accent" loading={showLoading} />
          </div>
        </section>

        {/* Tabs + Tabela */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground/80 px-1">Tabela & Tabs</h2>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Tabs defaultValue="lista">
                <TabsList className="h-10">
                  <TabsTrigger value="lista" className="h-8 px-3">Lista</TabsTrigger>
                  <TabsTrigger value="quadro" className="h-8 px-3">Quadro</TabsTrigger>
                  <TabsTrigger value="dashboard" className="h-8 px-3">Dashboard</TabsTrigger>
                </TabsList>
                <TabsContent value="lista" className="mt-4">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Input placeholder="Buscar tarefas..." className="h-9 max-w-xs" />
                    <Button size="sm" variant="outline" className="h-9">Filtrar</Button>
                    <Button size="sm" className="h-9 ml-auto">Nova tarefa</Button>
                  </div>

                  {showLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : showEmpty ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Inbox className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Sem tarefas no momento</p>
                      <p className="text-xs text-muted-foreground">
                        Quando houver atividade, ela aparecerá aqui.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Tarefa</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Prazo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MOCK_TABLE.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell>{row.titulo}</TableCell>
                            <TableCell>{row.responsavel}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.status === "Concluído"
                                    ? "secondary"
                                    : row.status === "Atrasado"
                                    ? "destructive"
                                    : "outline"
                                }
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={row.prioridade === "Alta" ? "destructive" : "outline"}
                                className="font-medium"
                              >
                                {row.prioridade}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <Clock className="inline h-3 w-3 mr-1 text-muted-foreground" />
                              {row.prazo}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
                <TabsContent value="quadro" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {["A fazer", "Em andamento", "Concluído"].map((col) => (
                      <Card key={col} className="bg-muted/40">
                        <CardHeader className="p-3">
                          <CardTitle className="text-sm">{col}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-2">
                          {[0, 1].map((i) => (
                            <Card key={i}>
                              <CardContent className="p-3">
                                <p className="text-sm font-medium">Cartão exemplo {i + 1}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Descrição curta do item.
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="dashboard" className="mt-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Visualização de exemplo</AlertTitle>
                    <AlertDescription>
                      Esta aba serve apenas para validar Alert + Card aninhados sobre o fundo escolhido.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>

        {/* Botões e estados */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground/80 px-1">Botões & Inputs</h2>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="success">Success</Button>
                <Button variant="link">Link</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="Input padrão" />
                <Input placeholder="Input com valor" defaultValue="texto exemplo" />
                <Input placeholder="Input desabilitado" disabled />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
