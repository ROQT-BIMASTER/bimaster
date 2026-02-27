import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertTriangle, Eye, Loader2, ClipboardList, Plus, Trash2, FileText, Receipt, MessageSquare, Download, ShieldAlert, ShieldCheck, MessageCircle } from "lucide-react";
import { useFichaRevisaoDiretoria } from "@/hooks/useFichaRevisao";
import { RevisaoChatPanel } from "@/components/fabrica/RevisaoChatPanel";
import { supabase } from "@/integrations/supabase/client";

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

export default function FichaRevisaoDiretoria() {
  const { fichasPendentes, isLoading, processando, aprovarFicha, solicitarRevisao } = useFichaRevisaoDiretoria();
  const [fichaAberta, setFichaAberta] = useState<any | null>(null);
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

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 });

  // Load evidence and requisitos when a ficha is opened
  useEffect(() => {
    if (!fichaAberta) return;
    const loadExtras = async () => {
      setLoadingEvidencias(true);
      try {
        // Load evidências
        const { data: evData } = await supabase
          .from("fabrica_custo_evidencias" as any)
          .select("*")
          .eq("produto_id", fichaAberta.produto_id);
        setEvidencias((evData as any[]) || []);

        // Load requisitos status from the revision
        const { data: reqData } = await supabase
          .from("fabrica_revisao_requisitos" as any)
          .select("*")
          .eq("revisao_id", fichaAberta.id);
        setRequisitosStatus((reqData as any[]) || []);
      } catch (e) {
        console.error("Error loading extras:", e);
      } finally {
        setLoadingEvidencias(false);
      }
    };
    loadExtras();
  }, [fichaAberta]);

  const handleDownloadEvidencia = async (filePath: string, fileName: string) => {
    try {
      const { data } = await supabase.storage
        .from("fabrica-custo-evidencias")
        .createSignedUrl(filePath, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (e) {
      console.error("Error downloading:", e);
    }
  };

  const handleAbrirFicha = (ficha: any) => {
    setFichaAberta(ficha);
    setParecer("");
    setApontamentos([]);
    setModoRevisao(false);
    setRequisitos([
      { tipo: "orcamentos", descricao: "Subir orçamentos", quantidade_minima: 3, insumo_id: "", ativo: false },
      { tipo: "evidencia", descricao: "Anexar evidência/NF", quantidade_minima: 1, insumo_id: "", ativo: false },
      { tipo: "justificativa", descricao: "Justificar manutenção de valores", quantidade_minima: 1, insumo_id: "", ativo: false },
    ]);
    setRequisitoCustom("");
  };

  const handleAprovar = async () => {
    if (!fichaAberta) return;
    await aprovarFicha(fichaAberta.id, fichaAberta.config_id, parecer);
    setFichaAberta(null);
  };

  const handleSolicitarRevisao = async () => {
    if (!fichaAberta) return;
    const requisitosAtivos = requisitos
      .filter(r => r.ativo)
      .map(r => ({ tipo: r.tipo, descricao: r.descricao, quantidade_minima: r.quantidade_minima, insumo_id: r.insumo_id || null }));
    
    if (requisitoCustom.trim()) {
      requisitosAtivos.push({ tipo: "outro", descricao: requisitoCustom.trim(), quantidade_minima: 1, insumo_id: null });
    }

    await solicitarRevisao(fichaAberta.id, fichaAberta.config_id, parecer, apontamentos, requisitosAtivos);
    setFichaAberta(null);
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

  const snapshotInsumos = (fichaAberta?.snapshot_insumos || []) as any[];
  const snapshotConfig = (fichaAberta?.snapshot_config || {}) as any;
  const snapshotTotais = (fichaAberta?.snapshot_totais || {}) as any;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Revisão de Fichas de Custos</h1>
          <p className="text-muted-foreground">Analise e aprove as fichas submetidas pela fábrica</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fichasPendentes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
              Nenhuma ficha pendente de revisão
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fichas Pendentes ({fichasPendentes.length})</CardTitle>
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
                  {fichasPendentes.map((ficha: any) => (
                    <TableRow key={ficha.id}>
                      <TableCell className="font-medium">{ficha.produto?.nome}</TableCell>
                      <TableCell className="font-mono">{ficha.produto?.codigo}</TableCell>
                      <TableCell><Badge variant="outline">v{ficha.versao}</Badge></TableCell>
                      <TableCell>{new Date(ficha.submetido_em).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-semibold">
                        {formatarMoeda(ficha.snapshot_totais?.custoTotal || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleAbrirFicha(ficha)}>
                          <Eye className="h-4 w-4 mr-1" /> Analisar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de análise */}
      <Dialog open={!!fichaAberta} onOpenChange={(open) => !open && setFichaAberta(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Análise - {fichaAberta?.produto?.nome} (v{fichaAberta?.versao})
            </DialogTitle>
            <DialogDescription>
              Código: {fichaAberta?.produto?.codigo} — Submetido em {fichaAberta?.submetido_em && new Date(fichaAberta.submetido_em).toLocaleDateString("pt-BR")}
            </DialogDescription>
          </DialogHeader>

          {/* Config snapshot */}
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="p-2 bg-muted rounded">
              <span className="text-muted-foreground text-xs block">Fornecedor M.O.</span>
              <span className="font-medium">{snapshotConfig.fornecedor_mao_obra || "-"}</span>
            </div>
            <div className="p-2 bg-muted rounded">
              <span className="text-muted-foreground text-xs block">M.O. NF</span>
              <span className="font-medium">{formatarMoeda(snapshotConfig.custo_mao_obra_nf || 0)}</span>
            </div>
            <div className="p-2 bg-muted rounded">
              <span className="text-muted-foreground text-xs block">M.O. Serviço</span>
              <span className="font-medium">{formatarMoeda(snapshotConfig.custo_mao_obra_servico || 0)}</span>
            </div>
            <div className="p-2 bg-muted rounded">
              <span className="text-muted-foreground text-xs block">Markup</span>
              <span className="font-medium">{snapshotConfig.percentual_markup || 0}%</span>
            </div>
          </div>

          {/* Insumos snapshot */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">NF (R$)</TableHead>
                  <TableHead className="text-right">Serviço (R$)</TableHead>
                  <TableHead className="text-right">Condição (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshotInsumos.map((insumo: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">{insumo.codigo}</TableCell>
                    <TableCell>{insumo.nome}</TableCell>
                    <TableCell>{insumo.fornecedor || "-"}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(Number(insumo.custo_nf) || 0)}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(Number(insumo.custo_servico) || 0)}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(Number(insumo.custo_condicao) || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totais snapshot */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-muted rounded text-center">
              <p className="text-xs text-muted-foreground">NF</p>
              <p className="font-bold">{formatarMoeda((snapshotTotais.totalNF || 0) + (snapshotTotais.markupNF || 0))}</p>
            </div>
            <div className="p-3 bg-muted rounded text-center">
              <p className="text-xs text-muted-foreground">Serviço</p>
              <p className="font-bold">{formatarMoeda((snapshotTotais.totalServico || 0) + (snapshotTotais.markupServico || 0))}</p>
            </div>
            <div className="p-3 bg-muted rounded text-center">
              <p className="text-xs text-muted-foreground">Condição</p>
              <p className="font-bold">{formatarMoeda((snapshotTotais.totalCondicao || 0) + (snapshotTotais.markupCondicao || 0))}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded text-center border-2 border-primary">
              <p className="text-xs text-muted-foreground">Custo Total</p>
              <p className="text-lg font-bold text-primary">{formatarMoeda(snapshotTotais.custoTotal || 0)}</p>
            </div>
          </div>

          {/* Evidências, Orçamentos e Requisitos */}
          <Tabs defaultValue="evidencias" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="evidencias" className="gap-1">
                <FileText className="h-3 w-3" />
                Evidências e Orçamentos ({evidencias.length})
              </TabsTrigger>
              <TabsTrigger value="requisitos" className="gap-1">
                <ClipboardList className="h-3 w-3" />
                Requisitos ({requisitosStatus.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="evidencias" className="mt-3">
              {loadingEvidencias ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : evidencias.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Nenhuma evidência ou orçamento enviado ainda.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {evidencias.map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        {ev.tipo === "orcamento" ? (
                          <Receipt className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{ev.nome_arquivo || "Arquivo"}</p>
                          <p className="text-xs text-muted-foreground">
                            {ev.tipo === "orcamento" ? "Orçamento" : "Evidência"} • {new Date(ev.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadEvidencia(ev.arquivo_path, ev.nome_arquivo)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="requisitos" className="mt-3">
              {requisitosStatus.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Nenhum requisito registrado para esta revisão.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {requisitosStatus.map((req: any) => (
                    <div key={req.id} className="p-3 border rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {req.cumprido ? (
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                          ) : req.contestado ? (
                            <MessageCircle className="h-4 w-4 text-orange-500" />
                          ) : req.resolvido_manualmente ? (
                            <ShieldAlert className="h-4 w-4 text-blue-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">{req.descricao}</span>
                        </div>
                        <Badge
                          variant={req.cumprido ? "success" : req.contestado ? "warning" : req.resolvido_manualmente ? "secondary" : "destructive"}
                          className="text-[10px]"
                        >
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
              )}
            </TabsContent>
          </Tabs>


          {modoRevisao && (
            <Card className="border-orange-500/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Apontamentos por Insumo</CardTitle>
                  <Button size="sm" variant="outline" onClick={adicionarApontamento}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
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
                          if (insumo) {
                            atualizarApontamento(idx, "valor_atual", Number(insumo[ap.campo]) || 0);
                          }
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
                        <Label className="text-xs">Valor Atual</Label>
                        <Input className="h-8" value={ap.valor_atual} readOnly />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Valor Sugerido</Label>
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
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Adicione apontamentos para indicar reduções específicas nos insumos.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Requisitos obrigatórios */}
          {modoRevisao && (
            <Card className="border-purple-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Requisitos Obrigatórios para Resubmissão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {requisitos.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 border rounded-lg">
                    <Checkbox
                      checked={req.ativo}
                      onCheckedChange={(checked) => {
                        setRequisitos(prev => prev.map((r, i) => i === idx ? { ...r, ativo: !!checked } : r));
                      }}
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {req.tipo === "orcamentos" && <Receipt className="h-3 w-3 mr-1" />}
                        {req.tipo === "evidencia" && <FileText className="h-3 w-3 mr-1" />}
                        {req.tipo === "justificativa" && <MessageSquare className="h-3 w-3 mr-1" />}
                        {req.descricao}
                      </Badge>
                      {(req.tipo === "orcamentos" || req.tipo === "evidencia") && req.ativo && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Qtd mín:</Label>
                          <Input
                            type="number" min={1} className="h-7 w-16 text-xs"
                            value={req.quantidade_minima}
                            onChange={(e) => setRequisitos(prev => prev.map((r, i) => i === idx ? { ...r, quantidade_minima: parseInt(e.target.value) || 1 } : r))}
                          />
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
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Outro requisito personalizado..."
                    value={requisitoCustom}
                    onChange={(e) => setRequisitoCustom(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat de comunicação */}
          {fichaAberta?.id && (
            <RevisaoChatPanel
              revisaoId={fichaAberta.id}
              configId={fichaAberta.config_id}
              insumos={snapshotInsumos.map((i: any) => ({ id: i.id, nome: i.nome, codigo: i.codigo }))}
              tipoRemetente="diretoria"
            />
          )}

          {/* Parecer */}
          <div className="space-y-2">
            <Label>Parecer Geral</Label>
            <Textarea value={parecer} onChange={(e) => setParecer(e.target.value)}
              placeholder="Observações sobre a ficha de custos..." rows={3} />
          </div>

          <DialogFooter className="flex gap-2">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
