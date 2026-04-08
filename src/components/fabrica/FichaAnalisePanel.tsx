import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, AlertTriangle, Plus, Trash2, FileText, Receipt,
  MessageSquare, Download, ShieldAlert, ShieldCheck, MessageCircle,
  ClipboardList, Loader2, X, History, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, Trophy, Link2, Eye,
} from "lucide-react";
import { RevisaoChatPanel } from "@/components/fabrica/RevisaoChatPanel";
import { DocumentosTab } from "@/components/fabrica/DocumentosTab";
import { InsumosOrigemPanel } from "@/components/fabrica/InsumosOrigemPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApontamentoForm {
  insumo_id: string;
  campo: string;
  valor_atual: number;
  valor_sugerido: number;
  comentario: string;
}

interface RequisitoForm {
  tipo: string;
  descricao: string;
  quantidade_minima: number;
  insumo_id: string;
  ativo: boolean;
}

interface Props {
  ficha: any;
  processando: boolean;
  onAprovar: (revisaoId: string, configId: string, parecer: string) => Promise<void>;
  onSolicitarRevisao: (
    revisaoId: string, configId: string, parecer: string,
    itens: any[], requisitos: any[]
  ) => Promise<void>;
  onClose: () => void;
  fichasPendentes?: any[];
  gradeRelMap?: { filhoToPai: Map<string, string>; paiToFilhos: Map<string, string[]> };
  onSelectFicha?: (ficha: any) => void;
  onRefetch?: () => void;
}

export function FichaAnalisePanel({ ficha, processando, onAprovar, onSolicitarRevisao, onClose, fichasPendentes, gradeRelMap, onSelectFicha, onRefetch }: Props) {
  const [parecer, setParecer] = useState("");
  const [apontamentos, setApontamentos] = useState<ApontamentoForm[]>([]);
  const [modoRevisao, setModoRevisao] = useState(false);
  const [requisitos, setRequisitos] = useState<RequisitoForm[]>([
    { tipo: "orcamentos", descricao: "Subir orçamentos", quantidade_minima: 3, insumo_id: "", ativo: false },
    { tipo: "evidencia", descricao: "Anexar evidência/NF", quantidade_minima: 1, insumo_id: "", ativo: false },
    { tipo: "justificativa", descricao: "Justificar manutenção de valores", quantidade_minima: 1, insumo_id: "", ativo: false },
  ]);
  const [requisitoCustom, setRequisitoCustom] = useState("");
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [requisitosStatus, setRequisitosStatus] = useState<any[]>([]);
  const [loadingEvidencias, setLoadingEvidencias] = useState(false);
  const [historicoVersoes, setHistoricoVersoes] = useState<any[]>([]);
  const [cotacoesByInsumo, setCotacoesByInsumo] = useState<Record<string, any[]>>({});
  const [expandedInsumo, setExpandedInsumo] = useState<string | null>(null);
  const [expandedKitInsumo, setExpandedKitInsumo] = useState<string | null>(null);
  const [expandedVinculado, setExpandedVinculado] = useState<string | null>(null);
  const [submittingFilho, setSubmittingFilho] = useState<string | null>(null);

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 });

  useEffect(() => {
    const loadExtras = async () => {
      setLoadingEvidencias(true);
      try {
        const [evRes, reqRes, histRes, cotRes] = await Promise.all([
          supabase.from("fabrica_custo_evidencias" as any).select("*").eq("produto_id", ficha.produto_id),
          supabase.from("fabrica_revisao_requisitos" as any).select("*").eq("revisao_id", ficha.id),
          supabase.from("fabrica_ficha_custo_revisoes").select("*").eq("config_id", ficha.config_id).order("versao", { ascending: false }),
          supabase.from("fabrica_mp_cotacoes" as any).select("*").eq("produto_id", ficha.produto_id),
        ]);
        setEvidencias((evRes.data as any[]) || []);
        setRequisitosStatus((reqRes.data as any[]) || []);
        setHistoricoVersoes((histRes.data as any[]) || []);

        // Group cotações by produto_custo_id (insumo id)
        const cotMap: Record<string, any[]> = {};
        ((cotRes.data as any[]) || []).forEach((c: any) => {
          const key = c.produto_custo_id;
          if (!cotMap[key]) cotMap[key] = [];
          cotMap[key].push(c);
        });
        setCotacoesByInsumo(cotMap);
      } catch (e) { console.error(e); }
      finally { setLoadingEvidencias(false); }
    };
    loadExtras();
  }, [ficha.id, ficha.produto_id, ficha.config_id]);

  const handleDownloadEvidencia = async (filePath: string) => {
    const { data } = await supabase.storage.from("fabrica-custo-evidencias").createSignedUrl(filePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleAprovar = async () => {
    const filhosSemRev = vinculadosDinamicos.filter((v: any) => v.relacao === "filho" && v._dinamico);
    if (filhosSemRev.length > 0) {
      toast.error(`Produto(s) vinculado(s) sem revisão: ${filhosSemRev.map((f: any) => f.produto?.nome || f.produto?.codigo).join(", ")}. É obrigatório revisar todos os produtos da grade antes de aprovar o Kit.`);
      return;
    }
    await onAprovar(ficha.id, ficha.config_id, parecer);
  };

  const handleSubmeterFilho = useCallback(async (childProdutoId: string) => {
    setSubmittingFilho(childProdutoId);
    try {
      // Buscar config
      let { data: cfg } = await supabase
        .from("fabrica_produto_custos_config")
        .select("*")
        .eq("produto_id", childProdutoId)
        .maybeSingle();

      if (!cfg) {
        const { data: novoCfg, error: errCfg } = await supabase
          .from("fabrica_produto_custos_config")
          .insert({ produto_id: childProdutoId, margem_lucro: 0, impostos_percentual: 0, frete_percentual: 0, comissao_percentual: 0, markup_desejado: 0, status_aprovacao: "rascunho" })
          .select().single();
        if (errCfg || !novoCfg) throw new Error("Erro ao criar config do produto");
        cfg = novoCfg;
      }

      // Buscar insumos
      const { data: insumos } = await supabase
        .from("fabrica_produto_custos")
        .select("*")
        .eq("produto_id", childProdutoId)
        .order("ordem");
      const insumosArr = (insumos || []) as any[];

      // Calcular totais
      let totalNF = 0, totalServico = 0, totalCondicao = 0;
      insumosArr.forEach((i: any) => {
        totalNF += Number(i.custo_nf) || 0;
        totalServico += Number(i.custo_servico) || 0;
        totalCondicao += Number(i.custo_condicao) || 0;
      });
      totalNF += Number(cfg.custo_mao_obra_nf) || 0;
      totalServico += Number(cfg.custo_mao_obra_servico) || 0;
      const perc = Number(cfg.percentual_markup) || 0;
      const base = cfg.base_calculo_markup || "nf_servico";
      let baseMarkup = 0;
      if (base === "total") baseMarkup = totalNF + totalServico + totalCondicao;
      else if (base === "nf") baseMarkup = totalNF;
      else if (base === "servico") baseMarkup = totalServico;
      else baseMarkup = totalNF + totalServico;
      const markupValor = baseMarkup * (perc / 100);
      const custoTotal = totalNF + totalServico + totalCondicao + markupValor;

      // Buscar última versão
      const { data: ultimaRev } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select("versao")
        .eq("config_id", cfg.id)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      const novaVersao = (ultimaRev?.versao || 0) + 1;

      // Criar revisão
      const { data: user } = await supabase.auth.getUser();
      const { error: errRev } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .insert({
          config_id: cfg.id,
          produto_id: childProdutoId,
          status: "pendente",
          snapshot_insumos: insumosArr as any,
          snapshot_config: cfg as any,
          snapshot_totais: { totalNF, totalServico, totalCondicao, markupNF: 0, markupServico: 0, markupCondicao: 0, custoTotal } as any,
          submetido_por: user?.user?.id || null,
          versao: novaVersao,
        });
      if (errRev) throw errRev;

      // Atualizar status
      await supabase
        .from("fabrica_produto_custos_config")
        .update({ status_aprovacao: "em_revisao" })
        .eq("id", cfg.id);

      toast.success("Produto submetido para revisão com sucesso!");
      onRefetch?.();
    } catch (err: any) {
      console.error("Erro ao submeter filho:", err);
      toast.error("Erro ao submeter: " + (err.message || err));
    } finally {
      setSubmittingFilho(null);
    }
  }, [onRefetch]);

  const handleSolicitarRevisao = async () => {
    const requisitosAtivos = requisitos
      .filter(r => r.ativo)
      .map(r => ({ tipo: r.tipo, descricao: r.descricao, quantidade_minima: r.quantidade_minima, insumo_id: r.insumo_id || null }));
    if (requisitoCustom.trim()) {
      requisitosAtivos.push({ tipo: "outro", descricao: requisitoCustom.trim(), quantidade_minima: 1, insumo_id: null });
    }
    await onSolicitarRevisao(ficha.id, ficha.config_id, parecer, apontamentos, requisitosAtivos);
  };

  const adicionarApontamento = () => {
    setApontamentos(prev => [...prev, { insumo_id: "", campo: "custo_nf", valor_atual: 0, valor_sugerido: 0, comentario: "" }]);
  };

  const removerApontamento = (index: number) => {
    setApontamentos(prev => prev.filter((_, i) => i !== index));
  };

  const atualizarApontamento = (index: number, field: keyof ApontamentoForm, value: any) => {
    setApontamentos(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const snapshotInsumos = (ficha.snapshot_insumos || []) as any[];
  const snapshotConfig = (ficha.snapshot_config || {}) as any;
  const snapshotTotais = (ficha.snapshot_totais || {}) as any;

  // Produtos vinculados (Kit ↔ Unidade) - inclui dados dinâmicos do DB
  const [vinculadosDinamicos, setVinculadosDinamicos] = useState<any[]>([]);

  useEffect(() => {
    const loadVinculados = async () => {
      if (!gradeRelMap) return;

      const vinculados: any[] = [];

      // Se este produto é pai, buscar filhos
      const childIds = gradeRelMap.paiToFilhos.get(ficha.produto_id);
      if (childIds) {
        for (const childId of childIds) {
          // Primeiro tentar encontrar na lista de pendentes
          const childFicha = fichasPendentes?.find((f: any) => f.produto_id === childId);
          if (childFicha) {
            vinculados.push({ ...childFicha, relacao: "filho" });
          } else {
            // Buscar dados dinâmicos do DB
            const [prodRes, configRes, insumosRes] = await Promise.all([
              supabase.from("fabrica_produtos").select("id, codigo, nome, marca, linha, tipo").eq("id", childId).maybeSingle(),
              supabase.from("fabrica_produto_custos_config").select("*").eq("produto_id", childId).maybeSingle(),
              supabase.from("fabrica_produto_custos").select("*").eq("produto_id", childId).order("ordem"),
            ]);

            if (prodRes.data) {
              const insumos = (insumosRes.data || []) as any[];
              const cfg: any = configRes.data || {};
              const sumNF = insumos.reduce((s: number, i: any) => s + (Number(i.custo_nf) || 0), 0);
              const sumServico = insumos.reduce((s: number, i: any) => s + (Number(i.custo_servico) || 0), 0);
              const sumCondicao = insumos.reduce((s: number, i: any) => s + (Number(i.custo_condicao) || 0), 0);
              const moNF = Number(cfg.custo_mao_obra_nf) || 0;
              const moServico = Number(cfg.custo_mao_obra_servico) || 0;
              const totalNF = sumNF + moNF;
              const totalServico = sumServico + moServico;
              const totalCondicao = sumCondicao;
              const subtotal = totalNF + totalServico + totalCondicao;
              const pctMarkup = Number(cfg.percentual_markup) || 0;
              const baseMarkup = cfg.base_calculo_markup || "total";
              const mkNF = (baseMarkup === "total" || baseMarkup === "nf" || baseMarkup === "nf_servico") ? totalNF * (pctMarkup / 100) : 0;
              const mkServico = (baseMarkup === "total" || baseMarkup === "servico" || baseMarkup === "nf_servico") ? totalServico * (pctMarkup / 100) : 0;
              const mkCondicao = baseMarkup === "total" ? totalCondicao * (pctMarkup / 100) : 0;
              const custoTotal = subtotal + mkNF + mkServico + mkCondicao;

              vinculados.push({
                id: `dynamic-${childId}`,
                produto_id: childId,
                produto: prodRes.data,
                relacao: "filho",
                versao: 0,
                snapshot_insumos: insumos,
                snapshot_config: cfg,
                snapshot_totais: {
                  totalNF, totalServico, totalCondicao,
                  markupNF: mkNF, markupServico: mkServico, markupCondicao: mkCondicao,
                  custoTotal,
                },
                _dinamico: true,
              });
            }
          }
        }
      }

      // Se este produto é filho, buscar pai
      const paiId = gradeRelMap.filhoToPai.get(ficha.produto_id);
      if (paiId) {
        const paiFicha = fichasPendentes?.find((f: any) => f.produto_id === paiId);
        if (paiFicha) vinculados.push({ ...paiFicha, relacao: "pai" });
      }

      setVinculadosDinamicos(vinculados);
    };
    loadVinculados();
  }, [ficha.produto_id, gradeRelMap, fichasPendentes]);

  const produtosVinculados = vinculadosDinamicos;

  // Comparar com versão anterior
  const versaoAnterior = historicoVersoes.find((v: any) => v.versao === ficha.versao - 1);
  const insumosPrevMap = new Map<string, any>();
  if (versaoAnterior?.snapshot_insumos) {
    (versaoAnterior.snapshot_insumos as any[]).forEach((i: any) => insumosPrevMap.set(i.id, i));
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {ficha.produto?.nome}
              <Badge variant="outline">v{ficha.versao}</Badge>
              <Badge variant="secondary">{ficha.produto?.codigo}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Submetido em {new Date(ficha.submetido_em).toLocaleDateString("pt-BR")}
              {ficha.termo_ciencia_assinado && (
                <Badge variant="warning" className="ml-2 text-[10px]">Termo de Ciência</Badge>
              )}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Data */}
          <div className="lg:col-span-2 space-y-4">
            {/* KPIs do snapshot */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-muted rounded text-center">
                <p className="text-xs text-muted-foreground">NF</p>
                <p className="font-bold text-sm">{formatarMoeda((snapshotTotais.totalNF || 0) + (snapshotTotais.markupNF || 0))}</p>
              </div>
              <div className="p-3 bg-muted rounded text-center">
                <p className="text-xs text-muted-foreground">Serviço</p>
                <p className="font-bold text-sm">{formatarMoeda((snapshotTotais.totalServico || 0) + (snapshotTotais.markupServico || 0))}</p>
              </div>
              <div className="p-3 bg-muted rounded text-center">
                <p className="text-xs text-muted-foreground">Condição</p>
                <p className="font-bold text-sm">{formatarMoeda((snapshotTotais.totalCondicao || 0) + (snapshotTotais.markupCondicao || 0))}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded text-center border-2 border-primary">
                <p className="text-xs text-muted-foreground">Custo Total</p>
                <p className="text-lg font-bold text-primary">{formatarMoeda(snapshotTotais.custoTotal ?? snapshotTotais.custoFinalTotal ?? 0)}</p>
              </div>
            </div>

            {/* Produtos Vinculados (Kit ↔ Unidade) com insumos expandíveis */}
            {produtosVinculados.length > 0 && (
              <Card className="border-blue-400/50 bg-blue-50/20 dark:bg-blue-950/10">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" /> Produtos Vinculados
                  </p>
                  {produtosVinculados.map((v: any) => {
                    const custoVinc = v.snapshot_totais?.custoTotal ?? v.snapshot_totais?.custoFinalTotal ?? 0;
                    const vincInsumos = (v.snapshot_insumos || []) as any[];
                    const isVincExpanded = expandedVinculado === v.id;
                    return (
                      <div key={v.id} className="bg-background rounded border overflow-hidden">
                        <div
                          className="flex items-center justify-between p-2 text-sm cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedVinculado(isVincExpanded ? null : v.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isVincExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {v.relacao === "pai" ? "Kit (Display)" : "Unidade"}
                            </Badge>
                            <span className="font-medium truncate">{v.produto?.nome}</span>
                            {v.versao > 0 && <Badge variant="secondary" className="text-[10px]">v{v.versao}</Badge>}
                            {v._dinamico && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Dados atuais</Badge>}
                            <Badge variant="outline" className="text-[10px]">{vincInsumos.length} insumos</Badge>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-semibold">{formatarMoeda(custoVinc)}</span>
                            {onSelectFicha && !v._dinamico && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onSelectFicha(v); }}>
                                <Eye className="h-3 w-3 mr-1" /> Ver ficha
                              </Button>
                            )}
                          </div>
                        </div>
                        {isVincExpanded && vincInsumos.length > 0 && (
                          <div className="border-t px-2 pb-2">
                            <ScrollArea className="max-h-[250px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Código</TableHead>
                                    <TableHead className="text-xs">Insumo</TableHead>
                                    <TableHead className="text-xs">Fornecedor</TableHead>
                                    <TableHead className="text-xs">NF Ref.</TableHead>
                                    <TableHead className="text-xs text-right">NF (R$)</TableHead>
                                    <TableHead className="text-xs text-right">Serviço (R$)</TableHead>
                                    <TableHead className="text-xs text-right">Condição (R$)</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {vincInsumos.map((ins: any, idx: number) => (
                                    <TableRow key={idx}>
                                      <TableCell className="font-mono text-xs py-1.5">{ins.codigo}</TableCell>
                                      <TableCell className="text-xs py-1.5">{ins.nome}</TableCell>
                                      <TableCell className="text-xs py-1.5">{ins.fornecedor || "-"}</TableCell>
                                      <TableCell className="text-xs py-1.5 font-mono">{ins.nf_referencia || "-"}</TableCell>
                                      <TableCell className="text-right text-xs py-1.5">{formatarMoeda(Number(ins.custo_nf) || 0)}</TableCell>
                                      <TableCell className="text-right text-xs py-1.5">{formatarMoeda(Number(ins.custo_servico) || 0)}</TableCell>
                                      <TableCell className="text-right text-xs py-1.5">{formatarMoeda(Number(ins.custo_condicao) || 0)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-[10px] text-muted-foreground">NF</p>
                                <p className="font-bold text-xs">{formatarMoeda((v.snapshot_totais?.totalNF || 0) + (v.snapshot_totais?.markupNF || 0))}</p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-[10px] text-muted-foreground">Serviço</p>
                                <p className="font-bold text-xs">{formatarMoeda((v.snapshot_totais?.totalServico || 0) + (v.snapshot_totais?.markupServico || 0))}</p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-[10px] text-muted-foreground">Condição</p>
                                <p className="font-bold text-xs">{formatarMoeda((v.snapshot_totais?.totalCondicao || 0) + (v.snapshot_totais?.markupCondicao || 0))}</p>
                              </div>
                              <div className="p-2 bg-primary/10 rounded text-center border border-primary/30">
                                <p className="text-[10px] text-muted-foreground">Custo Total</p>
                                <p className="font-bold text-xs text-primary">{formatarMoeda(custoVinc)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Tabs de conteúdo */}
            <Tabs defaultValue="insumos" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="insumos" className="text-xs">Insumos</TabsTrigger>
                <TabsTrigger value="config" className="text-xs">Config & M.O.</TabsTrigger>
                <TabsTrigger value="evidencias" className="text-xs">Evidências ({evidencias.length})</TabsTrigger>
                <TabsTrigger value="requisitos" className="text-xs">Requisitos ({requisitosStatus.length})</TabsTrigger>
                <TabsTrigger value="historico" className="text-xs gap-1"><History className="h-3 w-3" /> Histórico</TabsTrigger>
                <TabsTrigger value="documentos" className="text-xs gap-1"><FileText className="h-3 w-3" /> Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="insumos" className="mt-3">
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Insumo</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">NF (R$)</TableHead>
                        <TableHead className="text-right">Serviço (R$)</TableHead>
                        <TableHead className="text-right">Condição (R$)</TableHead>
                        {versaoAnterior && <TableHead className="text-right">Δ%</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshotInsumos.map((insumo: any, idx: number) => {
                        const prev = insumosPrevMap.get(insumo.id);
                        const custoAtual = (Number(insumo.custo_nf) || 0) + (Number(insumo.custo_servico) || 0) + (Number(insumo.custo_condicao) || 0);
                        const custoPrev = prev ? (Number(prev.custo_nf) || 0) + (Number(prev.custo_servico) || 0) + (Number(prev.custo_condicao) || 0) : null;
                        const variacao = custoPrev ? ((custoAtual - custoPrev) / custoPrev * 100) : null;
                        const changed = variacao !== null && Math.abs(variacao) > 0.01;
                        const cotacoes = cotacoesByInsumo[insumo.id] || [];
                        const isExpanded = expandedInsumo === insumo.id;
                        const hasCotacoes = cotacoes.length > 0;
                        const isImportadoKit = insumo.tipo_insumo === "importado_kit";
                        const isKitExpanded = expandedKitInsumo === insumo.id;

                        // Find lowest total cost among cotações
                        const cotacoesComTotal = cotacoes.map(c => ({
                          ...c,
                          total: (Number(c.custo_nf) || 0) + (Number(c.custo_servico) || 0) + (Number(c.custo_condicao) || 0),
                        }));
                        const menorTotal = cotacoesComTotal.length > 0 ? Math.min(...cotacoesComTotal.map(c => c.total)) : null;

                        const canExpand = hasCotacoes;

                        return (
                          <React.Fragment key={idx}>
                            <TableRow
                              className={`${changed ? "bg-warning/5" : ""} ${isImportadoKit ? "bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-l-blue-500" : ""} ${canExpand ? "cursor-pointer hover:bg-muted/50" : ""}`}
                              onClick={() => {
                                if (hasCotacoes) {
                                  setExpandedInsumo(isExpanded ? null : insumo.id);
                                }
                              }}
                            >
                              <TableCell className="w-8 px-2">
                                {hasCotacoes ? (
                                  isExpanded
                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                ) : null}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{insumo.codigo}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {insumo.nome}
                                  {isImportadoKit && (
                                    <>
                                      <Link2 className="h-3 w-3 text-blue-500" />
                                      <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">Kit</Badge>
                                    </>
                                  )}
                                  {hasCotacoes && (
                                    <Badge variant="outline" className="ml-1 text-[10px]">{cotacoes.length} cotações</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{insumo.fornecedor || "-"}</TableCell>
                              <TableCell className="text-right">{formatarMoeda(Number(insumo.custo_nf) || 0)}</TableCell>
                              <TableCell className="text-right">{formatarMoeda(Number(insumo.custo_servico) || 0)}</TableCell>
                              <TableCell className="text-right">{formatarMoeda(Number(insumo.custo_condicao) || 0)}</TableCell>
                              {versaoAnterior && (
                                <TableCell className="text-right">
                                  {variacao !== null ? (
                                    <span className={`flex items-center justify-end gap-1 text-xs font-medium ${variacao > 0 ? "text-destructive" : variacao < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                                      {variacao > 0 ? <TrendingUp className="h-3 w-3" /> : variacao < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                      {variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%
                                    </span>
                                  ) : <span className="text-xs text-muted-foreground">Novo</span>}
                                </TableCell>
                              )}
                            </TableRow>


                            {/* Expanded supplier comparison */}
                            {isExpanded && hasCotacoes && (
                              <TableRow>
                                <TableCell colSpan={versaoAnterior ? 8 : 7} className="p-0 bg-muted/30">
                                  <div className="px-6 py-3 space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comparativo de Fornecedores</p>
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                          <TableHead className="text-xs h-8">Fornecedor</TableHead>
                                          <TableHead className="text-xs text-right h-8">NF</TableHead>
                                          <TableHead className="text-xs text-right h-8">Serviço</TableHead>
                                          <TableHead className="text-xs text-right h-8">Condição</TableHead>
                                          <TableHead className="text-xs text-right h-8">Total</TableHead>
                                          <TableHead className="text-xs text-right h-8">Pgto</TableHead>
                                          <TableHead className="text-xs text-center h-8">Status</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {cotacoesComTotal
                                          .sort((a, b) => a.total - b.total)
                                          .map((cot, ci) => {
                                            const isMenor = cot.total === menorTotal;
                                            return (
                                              <TableRow key={ci} className={`hover:bg-muted/50 ${isMenor ? "bg-green-50 dark:bg-green-950/20" : ""}`}>
                                                <TableCell className="text-sm py-1.5">
                                                  <span className="flex items-center gap-1.5">
                                                    {isMenor && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                                                    {cot.fornecedor_nome}
                                                  </span>
                                                </TableCell>
                                                <TableCell className="text-right text-sm py-1.5">{formatarMoeda(Number(cot.custo_nf) || 0)}</TableCell>
                                                <TableCell className="text-right text-sm py-1.5">{formatarMoeda(Number(cot.custo_servico) || 0)}</TableCell>
                                                <TableCell className="text-right text-sm py-1.5">{formatarMoeda(Number(cot.custo_condicao) || 0)}</TableCell>
                                                <TableCell className={`text-right text-sm font-semibold py-1.5 ${isMenor ? "text-green-700 dark:text-green-400" : ""}`}>
                                                  {formatarMoeda(cot.total)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground py-1.5">
                                                  {cot.condicao_pagamento || "-"}
                                                </TableCell>
                                                <TableCell className="text-center py-1.5">
                                                  {cot.selecionada ? (
                                                    <Badge variant="default" className="text-[10px]">Selecionada</Badge>
                                                  ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="config" className="mt-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-muted rounded">
                    <span className="text-muted-foreground text-xs block">Fornecedor M.O.</span>
                    <span className="font-medium">{snapshotConfig.fornecedor_mao_obra || "-"}</span>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <span className="text-muted-foreground text-xs block">M.O. NF</span>
                    <span className="font-medium">{formatarMoeda(snapshotConfig.custo_mao_obra_nf || 0)}</span>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <span className="text-muted-foreground text-xs block">M.O. Serviço</span>
                    <span className="font-medium">{formatarMoeda(snapshotConfig.custo_mao_obra_servico || 0)}</span>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <span className="text-muted-foreground text-xs block">Markup ({snapshotConfig.base_calculo_markup || "nf_servico"})</span>
                    <span className="font-medium">{snapshotConfig.percentual_markup || 0}%</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="evidencias" className="mt-3">
                {loadingEvidencias ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : evidencias.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Nenhuma evidência enviada.</div>
                ) : (
                  <ScrollArea className="max-h-60">
                    <div className="space-y-2">
                      {evidencias.map((ev: any) => (
                        <div key={ev.id} className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2 min-w-0">
                            {ev.tipo === "orcamento" ? <Receipt className="h-4 w-4 text-primary shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{ev.nome_arquivo || "Arquivo"}</p>
                              <p className="text-xs text-muted-foreground">{ev.tipo === "orcamento" ? "Orçamento" : "Evidência"} • {new Date(ev.created_at).toLocaleDateString("pt-BR")}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleDownloadEvidencia(ev.arquivo_path)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="requisitos" className="mt-3">
                {requisitosStatus.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Nenhum requisito registrado.</div>
                ) : (
                  <ScrollArea className="max-h-60">
                    <div className="space-y-2">
                      {requisitosStatus.map((req: any) => (
                        <div key={req.id} className="p-3 border rounded-lg space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {req.cumprido ? <ShieldCheck className="h-4 w-4 text-green-600" /> :
                               req.contestado ? <MessageCircle className="h-4 w-4 text-orange-500" /> :
                               req.resolvido_manualmente ? <ShieldAlert className="h-4 w-4 text-blue-500" /> :
                               <AlertTriangle className="h-4 w-4 text-destructive" />}
                              <span className="text-sm font-medium">{req.descricao}</span>
                            </div>
                            <Badge variant={req.cumprido ? "success" : req.contestado ? "warning" : req.resolvido_manualmente ? "secondary" : "destructive"} className="text-[10px]">
                              {req.cumprido ? "Cumprido" : req.contestado ? "Contestado" : req.resolvido_manualmente ? "Resolvido Manual" : "Pendente"}
                            </Badge>
                          </div>
                          {req.contestado && req.contestacao_motivo && (
                            <div className="ml-6 p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-xs">
                              <span className="font-medium">Contestação:</span> {req.contestacao_motivo}
                            </div>
                          )}
                          {req.resolvido_manualmente && req.resolucao_descricao && (
                            <div className="ml-6 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs">
                              <span className="font-medium">Resolução:</span> {req.resolucao_descricao}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="historico" className="mt-3">
                {historicoVersoes.length <= 1 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Primeira versão — sem histórico anterior.</div>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {historicoVersoes.map((v: any) => {
                        const totais = v.snapshot_totais || {};
                        const isCurrent = v.id === ficha.id;
                        const prevVersion = historicoVersoes.find((h: any) => h.versao === v.versao - 1);
                        const prevTotal = prevVersion?.snapshot_totais?.custoTotal ?? prevVersion?.snapshot_totais?.custoFinalTotal;
                        const curTotal = totais.custoTotal ?? totais.custoFinalTotal ?? 0;
                        const variacaoTotal = prevTotal ? ((curTotal - prevTotal) / prevTotal * 100) : null;
                        return (
                          <div key={v.id} className={`p-3 border rounded-lg flex items-center justify-between ${isCurrent ? "border-primary bg-primary/5" : ""}`}>
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant={isCurrent ? "default" : v.status === "aprovada" ? "success" : v.status === "revisao_solicitada" ? "warning" : "outline"} className="text-xs">
                                  v{v.versao}
                                </Badge>
                                <span className="text-xs text-muted-foreground capitalize">{v.status?.replace("_", " ")}</span>
                                {isCurrent && <Badge variant="secondary" className="text-[10px]">Atual</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(v.submetido_em).toLocaleDateString("pt-BR")}
                                {v.parecer && ` — ${v.parecer.substring(0, 60)}...`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">{formatarMoeda(totais.custoTotal ?? totais.custoFinalTotal ?? 0)}</p>
                              {variacaoTotal !== null && (
                                <span className={`text-xs font-medium ${variacaoTotal > 0 ? "text-destructive" : "text-green-600"}`}>
                                  {variacaoTotal > 0 ? "+" : ""}{variacaoTotal.toFixed(1)}% vs v{v.versao - 1}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="documentos" className="mt-3">
                <DocumentosTab produtoId={ficha.produto_id} />
              </TabsContent>
            </Tabs>

            {/* Apontamentos e Requisitos (modo revisão) */}
            {modoRevisao && (
              <div className="space-y-4">
                <Card className="border-orange-500/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Apontamentos por Insumo</CardTitle>
                      <Button size="sm" variant="outline" onClick={adicionarApontamento}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {apontamentos.map((ap, idx) => (
                      <div key={idx} className="p-3 border rounded-lg space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">Insumo</Label>
                            <Select value={ap.insumo_id} onValueChange={(v) => {
                              const insumo = snapshotInsumos.find((i: any) => i.id === v);
                              atualizarApontamento(idx, "insumo_id", v);
                              if (insumo) atualizarApontamento(idx, "valor_atual", Number(insumo[ap.campo]) || 0);
                            }}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                              <SelectContent>
                                {snapshotInsumos.map((i: any) => (
                                  <SelectItem key={i.id} value={i.id}>{i.codigo} - {i.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-36">
                            <Label className="text-xs">Campo</Label>
                            <Select value={ap.campo} onValueChange={(v) => {
                              atualizarApontamento(idx, "campo", v);
                              if (ap.insumo_id) {
                                const insumo = snapshotInsumos.find((i: any) => i.id === ap.insumo_id);
                                if (insumo) atualizarApontamento(idx, "valor_atual", Number(insumo[v]) || 0);
                              }
                            }}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="custo_nf">NF</SelectItem>
                                <SelectItem value="custo_servico">Serviço</SelectItem>
                                <SelectItem value="custo_condicao">Condição</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-28">
                            <Label className="text-xs">Atual</Label>
                            <Input className="h-8" value={ap.valor_atual} readOnly />
                          </div>
                          <div className="w-28">
                            <Label className="text-xs">Sugerido</Label>
                            <Input className="h-8" type="number" step="0.01" value={ap.valor_sugerido}
                              onChange={(e) => atualizarApontamento(idx, "valor_sugerido", parseFloat(e.target.value) || 0)} />
                          </div>
                          <Button variant="ghost" size="icon" className="mt-5 text-destructive" onClick={() => removerApontamento(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input placeholder="Justificativa / comentário" value={ap.comentario}
                          onChange={(e) => atualizarApontamento(idx, "comentario", e.target.value)} className="h-8" />
                      </div>
                    ))}
                    {apontamentos.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">Adicione apontamentos para indicar reduções específicas.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-purple-500/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" /> Requisitos Obrigatórios
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {requisitos.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 border rounded-lg">
                        <Checkbox checked={req.ativo} onCheckedChange={(checked) => {
                          setRequisitos(prev => prev.map((r, i) => i === idx ? { ...r, ativo: !!checked } : r));
                        }} />
                        <div className="flex-1 flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {req.tipo === "orcamentos" && <Receipt className="h-3 w-3 mr-1" />}
                            {req.tipo === "evidencia" && <FileText className="h-3 w-3 mr-1" />}
                            {req.tipo === "justificativa" && <MessageSquare className="h-3 w-3 mr-1" />}
                            {req.descricao}
                          </Badge>
                          {(req.tipo === "orcamentos" || req.tipo === "evidencia") && req.ativo && (
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground">Qtd mín:</Label>
                              <Input type="number" min={1} className="h-7 w-16 text-xs" value={req.quantidade_minima}
                                onChange={(e) => setRequisitos(prev => prev.map((r, i) => i === idx ? { ...r, quantidade_minima: parseInt(e.target.value) || 1 } : r))} />
                            </div>
                          )}
                          {req.ativo && (
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground">Insumo:</Label>
                              <Select value={req.insumo_id || "all"} onValueChange={(v) => setRequisitos(prev => prev.map((r, i) => i === idx ? { ...r, insumo_id: v === "all" ? "" : v } : r))}>
                                <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Todos</SelectItem>
                                  {snapshotInsumos.map((i: any) => (
                                    <SelectItem key={i.id} value={i.id}>{i.codigo} - {i.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <Input placeholder="Outro requisito personalizado..." value={requisitoCustom}
                      onChange={(e) => setRequisitoCustom(e.target.value)} className="h-8 text-sm" />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Parecer + Ações */}
            <div className="space-y-3">
              <div>
                <Label>Parecer Geral</Label>
                <Textarea value={parecer} onChange={(e) => setParecer(e.target.value)}
                  placeholder="Observações sobre a ficha de custos..." rows={3} />
              </div>
              {vinculadosDinamicos.filter((v: any) => v.relacao === "filho" && v._dinamico).length > 0 && (
                <div className="rounded border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    Produto(s) da grade sem revisão — obrigatório revisar antes de aprovar o Kit
                  </div>
                  {vinculadosDinamicos.filter((v: any) => v.relacao === "filho" && v._dinamico).map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between bg-background rounded border p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-[10px]">{v.produto?.codigo}</Badge>
                        <span className="font-medium">{v.produto?.nome}</span>
                        <Badge variant="destructive" className="text-[10px]">Sem revisão</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        disabled={submittingFilho === v.produto_id}
                        onClick={() => handleSubmeterFilho(v.produto_id)}
                      >
                        {submittingFilho === v.produto_id ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Submetendo...</>
                        ) : (
                          <><ClipboardList className="h-3 w-3 mr-1" /> Submeter para Revisão</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                {!modoRevisao ? (
                  <>
                    <Button variant="outline" onClick={() => setModoRevisao(true)}>
                      <AlertTriangle className="h-4 w-4 mr-1" /> Solicitar Revisão
                    </Button>
                    <Button onClick={handleAprovar} disabled={processando}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setModoRevisao(false)}>Cancelar</Button>
                    <Button variant="destructive" onClick={handleSolicitarRevisao} disabled={processando}>
                      <AlertTriangle className="h-4 w-4 mr-1" /> Enviar Revisão ({apontamentos.length} apontamentos)
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Chat */}
          <div className="lg:col-span-1">
            <RevisaoChatPanel
              revisaoId={ficha.id}
              configId={ficha.config_id}
              produtoId={ficha.produto_id}
              insumos={[
                ...snapshotInsumos.map((i: any) => ({ id: i.id, nome: i.nome, codigo: i.codigo, tipo_insumo: i.tipo_insumo })),
                ...produtosVinculados.flatMap((v: any) =>
                  (v.snapshot_insumos || []).map((i: any) => ({
                    id: i.id,
                    nome: `↳ ${v.produto?.codigo || ''} → ${i.nome}`,
                    codigo: i.codigo,
                    tipo_insumo: i.tipo_insumo,
                    _vinculado: true,
                  }))
                ),
              ]}
              tipoRemetente="diretoria"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
