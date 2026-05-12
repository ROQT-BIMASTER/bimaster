import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Copy, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { invokeChat } from "@/lib/ai/invokeChat";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Idioma = "pt" | "en" | "zh";
type Profundidade = "executivo" | "completo";

type Resultado = {
  markdown: string;
  kpis: {
    etapas_concluidas: number;
    etapas_totais: number;
    atrasos_count: number;
    dias_para_embarque: number | null;
    risco: "alto" | "medio" | "baixo";
  };
  submissao: { id: string; codigo: string; nome: string };
  model: string;
};

const I18N: Record<Idioma, Record<string, string>> = {
  pt: {
    title: "Copiloto de Submissão",
    subtitle: "Relatório de pendências, prazos e linha do tempo gerado por IA",
    searchLabel: "Número da submissão / OC / produto",
    searchPlaceholder: "Ex.: 3777 ou nome do produto",
    language: "Idioma do relatório",
    depth: "Profundidade",
    executive: "Resumo executivo",
    full: "Relatório completo",
    generate: "Gerar relatório",
    regenerate: "Regenerar",
    generating: "Gerando relatório…",
    copy: "Copiar",
    download: "Baixar .md",
    print: "Imprimir / PDF",
    completed: "Etapas concluídas",
    delays: "Atrasos detectados",
    daysShip: "Dias até embarque",
    risk: "Risco",
    riskLow: "baixo",
    riskMed: "médio",
    riskHigh: "alto",
    empty: "Selecione uma submissão e clique em Gerar relatório.",
  },
  en: {
    title: "Submission Copilot",
    subtitle: "AI-generated report on pending items, deadlines and timeline",
    searchLabel: "Submission / PO number / product",
    searchPlaceholder: "e.g. 3777 or product name",
    language: "Report language",
    depth: "Depth",
    executive: "Executive summary",
    full: "Full report",
    generate: "Generate report",
    regenerate: "Regenerate",
    generating: "Generating report…",
    copy: "Copy",
    download: "Download .md",
    print: "Print / PDF",
    completed: "Completed steps",
    delays: "Delays detected",
    daysShip: "Days to shipment",
    risk: "Risk",
    riskLow: "low",
    riskMed: "medium",
    riskHigh: "high",
    empty: "Select a submission and click Generate report.",
  },
  zh: {
    title: "提交副驾驶",
    subtitle: "AI 生成的待办事项、截止日期和时间线报告",
    searchLabel: "提交号 / 采购订单号 / 产品",
    searchPlaceholder: "例如:3777 或产品名称",
    language: "报告语言",
    depth: "详细程度",
    executive: "执行摘要",
    full: "完整报告",
    generate: "生成报告",
    regenerate: "重新生成",
    generating: "正在生成报告…",
    copy: "复制",
    download: "下载 .md",
    print: "打印 / PDF",
    completed: "已完成步骤",
    delays: "检测到的延误",
    daysShip: "距离装运天数",
    risk: "风险",
    riskLow: "低",
    riskMed: "中",
    riskHigh: "高",
    empty: "选择一个提交并点击生成报告。",
  },
};

interface Sugestao {
  id: string;
  produto_codigo: string;
  produto_nome: string;
  numero_ordem: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

export function SubmissionCopilotPanel({ open, onOpenChange, initialQuery = "" }: Props) {
  const [idioma, setIdioma] = useState<Idioma>("pt");
  const [profundidade, setProfundidade] = useState<Profundidade>("completo");
  const [query, setQuery] = useState(initialQuery);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [selecionada, setSelecionada] = useState<Sugestao | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const t = I18N[idioma];

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  // Autocomplete simples
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setSugestoes([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("china_produto_submissoes")
        .select("id, produto_codigo, produto_nome, numero_ordem")
        .or(
          `produto_codigo.ilike.%${q}%,produto_nome.ilike.%${q}%,numero_ordem.ilike.%${q}%,numero_item.ilike.%${q}%`,
        )
        .is("deleted_at", null)
        .limit(8);
      setSugestoes((data ?? []) as Sugestao[]);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleGerar = async () => {
    if (!selecionada) {
      toast.error(idioma === "pt" ? "Selecione uma submissão" : idioma === "en" ? "Select a submission" : "请选择提交");
      return;
    }
    setLoading(true);
    setResultado(null);
    const { data, error } = await invokeChat<Resultado>(
      "china-submission-copilot",
      { submissao_id: selecionada.id, idioma, profundidade },
      { timeoutMs: 150_000 },
    );
    setLoading(false);
    if (error || !data) {
      toast.error(error?.userMessage ?? "Erro ao gerar relatório");
      return;
    }
    setResultado(data);
  };

  const riskBadge = useMemo(() => {
    if (!resultado) return null;
    const r = resultado.kpis.risco;
    const label = r === "alto" ? t.riskHigh : r === "medio" ? t.riskMed : t.riskLow;
    const variant = r === "alto" ? "destructive" : r === "medio" ? "secondary" : "outline";
    return <Badge variant={variant as any}>{t.risk}: {label}</Badge>;
  }, [resultado, t]);

  const handleCopy = () => {
    if (!resultado) return;
    navigator.clipboard.writeText(resultado.markdown);
    toast.success(idioma === "pt" ? "Copiado" : idioma === "en" ? "Copied" : "已复制");
  };

  const handleDownload = () => {
    if (!resultado) return;
    const blob = new Blob([resultado.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${resultado.submissao.codigo}-${idioma}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!resultado) return;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const html = document.getElementById("copilot-report-content")?.innerHTML ?? "";
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${resultado.submissao.codigo}</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;max-width:780px;margin:32px auto;padding:0 16px;color:#111;line-height:1.55}
      h1,h2,h3{margin-top:1.6em}table{border-collapse:collapse;width:100%;margin:12px 0}
      th,td{border:1px solid #ddd;padding:6px 10px;font-size:13px;text-align:left}th{background:#f7f7f7}
      code{background:#f3f3f3;padding:2px 4px;border-radius:3px}</style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[720px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t.title}
          </SheetTitle>
          <SheetDescription>{t.subtitle}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Busca */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.searchLabel}</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelecionada(null);
                }}
                placeholder={t.searchPlaceholder}
                className="pl-7 h-9"
              />
            </div>
            {sugestoes.length > 0 && !selecionada && (
              <div className="rounded-md border border-border bg-popover max-h-56 overflow-y-auto">
                {sugestoes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelecionada(s);
                      setQuery(`${s.produto_codigo} — ${s.produto_nome}`);
                      setSugestoes([]);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent border-b border-border last:border-b-0"
                  >
                    <div className="font-medium">{s.produto_codigo}</div>
                    <div className="text-muted-foreground truncate">{s.produto_nome}</div>
                    {s.numero_ordem && <div className="text-[10px] text-muted-foreground">OC: {s.numero_ordem}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Idioma */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.language}</Label>
            <div className="flex gap-1.5">
              {(["pt", "en", "zh"] as Idioma[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setIdioma(l)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs border transition-colors",
                    idioma === l ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent",
                  )}
                >
                  {l === "pt" ? "PT-BR" : l === "en" ? "EN" : "中文"}
                </button>
              ))}
            </div>
          </div>

          {/* Profundidade */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.depth}</Label>
            <div className="flex gap-1.5">
              {(["executivo", "completo"] as Profundidade[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProfundidade(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs border transition-colors",
                    profundidade === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent",
                  )}
                >
                  {p === "executivo" ? t.executive : t.full}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleGerar} disabled={loading || !selecionada} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? t.generating : resultado ? t.regenerate : t.generate}
          </Button>

          {/* Resultado */}
          {resultado && (
            <div className="space-y-3 pt-2 border-t border-border">
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-2">
                <KpiCard label={t.completed} value={`${resultado.kpis.etapas_concluidas} / ${resultado.kpis.etapas_totais}`} />
                <KpiCard label={t.delays} value={String(resultado.kpis.atrasos_count)} tone={resultado.kpis.atrasos_count > 0 ? "warn" : "ok"} />
                <KpiCard label={t.daysShip} value={resultado.kpis.dias_para_embarque ?? "—"} />
                <div className="rounded-md border border-border bg-card/50 p-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase text-muted-foreground">{t.risk}</span>
                  {riskBadge}
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-3.5 w-3.5 mr-1.5" />{t.copy}</Button>
                <Button variant="outline" size="sm" onClick={handleDownload}><Download className="h-3.5 w-3.5 mr-1.5" />{t.download}</Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>{t.print}</Button>
              </div>

              {/* Markdown */}
              <div
                id="copilot-report-content"
                className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-table:text-xs"
              >
                <ReactMarkdown>{resultado.markdown}</ReactMarkdown>
              </div>
            </div>
          )}

          {!resultado && !loading && (
            <p className="text-xs text-muted-foreground text-center py-8">{t.empty}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" }) {
  return (
    <div
      className={cn(
        "rounded-md border p-2",
        tone === "warn" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card/50",
      )}
    >
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
