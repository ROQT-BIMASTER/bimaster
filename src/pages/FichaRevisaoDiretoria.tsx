import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Eye, Loader2, ClipboardList, Plus, Trash2 } from "lucide-react";
import { useFichaRevisaoDiretoria } from "@/hooks/useFichaRevisao";
import { RevisaoChatPanel } from "@/components/fabrica/RevisaoChatPanel";

interface ApontamentoForm {
  insumo_id: string;
  campo: string;
  valor_atual: number;
  valor_sugerido: number;
  comentario: string;
}

export default function FichaRevisaoDiretoria() {
  const { fichasPendentes, isLoading, processando, aprovarFicha, solicitarRevisao } = useFichaRevisaoDiretoria();
  const [fichaAberta, setFichaAberta] = useState<any | null>(null);
  const [parecer, setParecer] = useState("");
  const [apontamentos, setApontamentos] = useState<ApontamentoForm[]>([]);
  const [modoRevisao, setModoRevisao] = useState(false);

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const handleAbrirFicha = (ficha: any) => {
    setFichaAberta(ficha);
    setParecer("");
    setApontamentos([]);
    setModoRevisao(false);
  };

  const handleAprovar = async () => {
    if (!fichaAberta) return;
    await aprovarFicha(fichaAberta.id, fichaAberta.config_id, parecer);
    setFichaAberta(null);
  };

  const handleSolicitarRevisao = async () => {
    if (!fichaAberta) return;
    await solicitarRevisao(fichaAberta.id, fichaAberta.config_id, parecer, apontamentos);
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

          {/* Modo revisão - apontamentos */}
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

          {/* Chat de comunicação */}
          {fichaAberta?.id && (
            <RevisaoChatPanel
              revisaoId={fichaAberta.id}
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
                <Button variant="destructive" onClick={handleSolicitarRevisao} disabled={processando || apontamentos.length === 0}>
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
