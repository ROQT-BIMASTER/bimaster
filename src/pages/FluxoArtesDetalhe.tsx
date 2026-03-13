import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, Trash2, Loader2, CheckCircle2, XCircle, Clock,
  AlertTriangle, Check, X, Upload, RotateCcw,
} from "lucide-react";
import {
  useFluxoArteDetail, useFluxoCores, useUpdateFluxoArte,
  useAvancarEtapaArte, useConfirmarAFArte, useAddFluxoCor, useDeleteFluxoCor,
  useDevolverEtapaArte,
  ETAPAS, REGULATORIO_ITEMS, CHECKLIST_TIPOS, CAMPOS_ESPECIFICOS_DEFAULT,
  getEtapaStatus, getChecklistLabel, getFluxoStatusInfo,
  type FluxoArte, type EtapaKey, type RegulatorioItem,
} from "@/hooks/useFluxoArtesMotor";
import { DevolucaoEtapaDialog, type DevolucaoResult } from "@/components/shared/DevolucaoEtapaDialog";
import { VinculoProjetoBadges } from "@/components/shared/VinculoProjetoBadges";
import { VincularProjetoDialog } from "@/components/shared/VincularProjetoDialog";

export default function FluxoArtesDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: fluxo, isLoading } = useFluxoArteDetail(id);
  const { data: cores = [] } = useFluxoCores(id);
  const updateFluxo = useUpdateFluxoArte();
  const avancar = useAvancarEtapaArte();
  const confirmarAF = useConfirmarAFArte();
  const addCor = useAddFluxoCor();
  const deleteCor = useDeleteFluxoCor();
  const devolver = useDevolverEtapaArte();

  const [showApproval, setShowApproval] = useState(false);
  const [showDevolucao, setShowDevolucao] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<"approved" | "approved_with_changes" | "not_approved">("approved");
  const [approvalDesc, setApprovalDesc] = useState("");
  const [newCor, setNewCor] = useState({ codigo_cor: "", pantone_ref: "", cor_hex: "#000000" });

  if (isLoading || !fluxo) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const info = getFluxoStatusInfo(fluxo);
  const isAFStage = fluxo.etapa_atual === "af_final";
  const isComplete = fluxo.etapa_atual === "af_final" && fluxo.status_geral === "aprovado";

  const handleApproval = () => {
    if ((approvalStatus === "approved_with_changes" || approvalStatus === "not_approved") && !approvalDesc.trim()) return;
    avancar.mutate({ id: fluxo.id, fluxo, status: approvalStatus, descricao: approvalDesc }, {
      onSuccess: () => { setShowApproval(false); setApprovalDesc(""); },
    });
  };

  const handleConfirmAF = () => {
    confirmarAF.mutate({ id: fluxo.id });
  };

  const handleAddCor = () => {
    if (!newCor.codigo_cor) return;
    addCor.mutate({ fluxo_id: fluxo.id, ...newCor, ordem: cores.length }, {
      onSuccess: () => setNewCor({ codigo_cor: "", pantone_ref: "", cor_hex: "#000000" }),
    });
  };

  const updateCamposEspecificos = (key: string, value: any) => {
    updateFluxo.mutate({
      id: fluxo.id,
      campos_especificos: { ...fluxo.campos_especificos, [key]: value },
    });
  };

  const updateRegulatorio = (key: string, resultado: "conforme" | "nao_conforme") => {
    const updated = (fluxo.regulatorio_checklist || []).map((item: RegulatorioItem) =>
      item.key === key ? { ...item, resultado } : item
    );
    updateFluxo.mutate({ id: fluxo.id, regulatorio_checklist: updated });
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fluxo-artes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{fluxo.sku} — {fluxo.produto_nome}</h1>
            <Badge variant="secondary">{getChecklistLabel(fluxo.tipo_checklist)}</Badge>
            {fluxo.numero_rodada > 1 && <Badge variant="outline">R{fluxo.numero_rodada}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {fluxo.numero_documento} • {fluxo.linha_marca || "—"}
          </p>
        </div>
        <Badge className={info.color.replace("text-", "bg-").replace("600", "100") + " " + info.color}>
          {info.label}
        </Badge>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-1">
            {ETAPAS.map((etapa, idx) => {
              const status = getEtapaStatus(etapa.key as EtapaKey, fluxo);
              const colorClasses = {
                done: "bg-green-500 text-white",
                active: "bg-amber-500 text-white",
                rejected: "bg-red-500 text-white",
                pending: "bg-muted text-muted-foreground",
              };
              return (
                <div key={etapa.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${colorClasses[status]}`}>
                      {status === "done" ? <Check className="h-4 w-4" /> :
                       status === "rejected" ? <X className="h-4 w-4" /> :
                       status === "active" ? <Clock className="h-4 w-4" /> :
                       idx + 1}
                    </div>
                    <span className="text-[10px] mt-1 text-center leading-tight">{etapa.label}</span>
                  </div>
                  {idx < ETAPAS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 ${status === "done" ? "bg-green-400" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Color grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">🎨 Grade de Cores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cores.map(cor => (
                <div key={cor.id} className="flex items-center gap-3 p-2 border rounded-lg">
                  <div className="w-8 h-8 rounded border" style={{ backgroundColor: cor.cor_hex || "#ccc" }} />
                  <div className="flex-1">
                    <span className="font-mono text-sm font-bold">{cor.codigo_cor}</span>
                    {cor.pantone_ref && <span className="text-xs text-muted-foreground ml-2">Pantone: {cor.pantone_ref}</span>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteCor.mutate({ id: cor.id, fluxo_id: fluxo.id })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 items-end">
                <div><Label className="text-xs">Código</Label><Input value={newCor.codigo_cor} onChange={e => setNewCor(p => ({ ...p, codigo_cor: e.target.value }))} placeholder="GL01" className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Pantone</Label><Input value={newCor.pantone_ref} onChange={e => setNewCor(p => ({ ...p, pantone_ref: e.target.value }))} placeholder="2337 C" className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Hex</Label><Input type="color" value={newCor.cor_hex} onChange={e => setNewCor(p => ({ ...p, cor_hex: e.target.value }))} className="h-8 w-14 p-1" /></div>
                <Button size="sm" onClick={handleAddCor} disabled={addCor.isPending}><Plus className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>

          {/* Type-specific fields */}
          <TypeSpecificFields fluxo={fluxo} onUpdate={updateCamposEspecificos} />

          {/* Regulatory checklist (shown for regulatorio stage or etiqueta_bula type) */}
          {(fluxo.etapa_atual === "regulatorio" || fluxo.tipo_checklist === "etiqueta_bula") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📋 Checklist Regulatório</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(fluxo.regulatorio_checklist || []).map((item: RegulatorioItem) => (
                  <div key={item.key} className="flex items-center justify-between p-2 border rounded-lg">
                    <span className="text-sm">{item.label}</span>
                    <div className="flex gap-1">
                      <Button
                        variant={item.resultado === "conforme" ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateRegulatorio(item.key, "conforme")}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant={item.resultado === "nao_conforme" ? "destructive" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateRegulatorio(item.key, "nao_conforme")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">⚡ Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!isComplete && !isAFStage && (
                <>
                  <Button className="w-full" onClick={() => setShowApproval(true)}>
                    Avaliar Etapa
                  </Button>
                  {ETAPAS.findIndex(e => e.key === fluxo.etapa_atual) > 0 && (
                    <Button variant="outline" className="w-full gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20" onClick={() => setShowDevolucao(true)}>
                      <RotateCcw className="h-4 w-4" />
                      Devolver Etapa
                    </Button>
                  )}
                </>
              )}
              {isAFStage && !isComplete && (
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleConfirmAF}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar AF Recebida
                </Button>
              )}
              {isComplete && (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-600">Arte Final Recebida</p>
                  <p className="text-xs text-muted-foreground">{fluxo.data_af_recebida ? new Date(fluxo.data_af_recebida).toLocaleDateString("pt-BR") : ""}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">📜 Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              {(fluxo.historico || []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sem transições registradas</p>
              ) : (
                <div className="space-y-3">
                  {[...(fluxo.historico || [])].reverse().map((h: any, i: number) => {
                    const etapaDe = ETAPAS.find(e => e.key === h.etapa_de)?.label || h.etapa_de;
                    const etapaPara = ETAPAS.find(e => e.key === h.etapa_para)?.label || h.etapa_para;
                    const isReject = h.acao === "not_approved";
                    return (
                      <div key={i} className="text-xs border-l-2 pl-3 pb-2" style={{ borderColor: isReject ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}>
                        <div className="flex items-center gap-1">
                          {isReject ? <XCircle className="h-3 w-3 text-destructive" /> : <CheckCircle2 className="h-3 w-3 text-primary" />}
                          <span className="font-medium">{etapaDe} → {etapaPara}</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">R{h.rodada}</Badge>
                        </div>
                        {h.descricao && <p className="text-muted-foreground mt-0.5">{h.descricao}</p>}
                        <p className="text-muted-foreground">{new Date(h.data).toLocaleDateString("pt-BR")}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approval dialog */}
      <Dialog open={showApproval} onOpenChange={setShowApproval}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar Etapa: {ETAPAS.find(e => e.key === fluxo.etapa_atual)?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={approvalStatus} onValueChange={(v: any) => setApprovalStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">✅ Approved</SelectItem>
                  <SelectItem value="approved_with_changes">⚠️ Approved With Changes</SelectItem>
                  <SelectItem value="not_approved">❌ Not Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(approvalStatus === "approved_with_changes" || approvalStatus === "not_approved") && (
              <div>
                <Label>Observações (obrigatório)</Label>
                <Textarea value={approvalDesc} onChange={e => setApprovalDesc(e.target.value)} placeholder="Descreva as alterações necessárias..." rows={3} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproval(false)}>Cancelar</Button>
            <Button
              onClick={handleApproval}
              disabled={avancar.isPending || ((approvalStatus !== "approved") && !approvalDesc.trim())}
              variant={approvalStatus === "not_approved" ? "destructive" : "default"}
            >
              {avancar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Devolução dialog */}
      {fluxo && (
        <DevolucaoEtapaDialog
          open={showDevolucao}
          onOpenChange={setShowDevolucao}
          entityType="fluxo_artes"
          entityId={fluxo.id}
          etapasAnteriores={
            ETAPAS
              .filter(e => e.order < ETAPAS.findIndex(et => et.key === fluxo.etapa_atual))
              .map(e => ({ key: e.key, label: e.label }))
          }
          onConfirm={async (result: DevolucaoResult) => {
            await devolver.mutateAsync({
              id: fluxo.id,
              fluxo,
              etapaDestino: result.etapaDestino,
              justificativa: result.justificativa,
              userInfo: result.userInfo,
            });
          }}
        />
      )}
    </div>
  );
}

// ── Type-specific fields component ──

function TypeSpecificFields({ fluxo, onUpdate }: { fluxo: FluxoArte; onUpdate: (key: string, value: any) => void }) {
  const campos = fluxo.campos_especificos || {};

  switch (fluxo.tipo_checklist) {
    case "etiqueta_bula":
      return (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">📦 Etiqueta / Bula</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox checked={campos.double_sticker || false} onCheckedChange={v => onUpdate("double_sticker", v)} />
              <Label>Double Sticker</Label>
            </div>
            <div>
              <Label>Finishing</Label>
              <Select value={campos.finishing || "shiny"} onValueChange={v => onUpdate("finishing", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shiny">Shiny</SelectItem>
                  <SelectItem value="matte">Matte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Colors</Label>
              <Select value={campos.colors || "product_color"} onValueChange={v => onUpdate("colors", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product_color">Product Color</SelectItem>
                  <SelectItem value="white">White</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      );

    case "etiqueta_fundo":
      return (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">📄 Etiqueta de Fundo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Largura (mm)</Label><Input value={campos.dimensoes_largura || ""} onChange={e => onUpdate("dimensoes_largura", e.target.value)} /></div>
              <div><Label>Altura (mm)</Label><Input value={campos.dimensoes_altura || ""} onChange={e => onUpdate("dimensoes_altura", e.target.value)} /></div>
            </div>
            <div><Label>Área de Colagem</Label><Input value={campos.area_colagem || ""} onChange={e => onUpdate("area_colagem", e.target.value)} /></div>
            <div><Label>Informações do Verso</Label><Textarea value={campos.informacoes_verso || ""} onChange={e => onUpdate("informacoes_verso", e.target.value)} rows={3} /></div>
          </CardContent>
        </Card>
      );

    case "tester":
      return (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">🧪 Tester</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Tipo de Tester</Label>
              <Select value={campos.tipo_tester || "expositor"} onValueChange={v => onUpdate("tipo_tester", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expositor">Expositor</SelectItem>
                  <SelectItem value="amostra_avulsa">Amostra Avulsa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantidade de Unidades</Label><Input type="number" value={campos.quantidade_unidades || 0} onChange={e => onUpdate("quantidade_unidades", parseInt(e.target.value))} /></div>
            <div><Label>Material do Tester</Label><Input value={campos.material_tester || ""} onChange={e => onUpdate("material_tester", e.target.value)} /></div>
          </CardContent>
        </Card>
      );

    case "etiqueta_teste":
      return (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">🏷️ Etiqueta de Teste</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Finalidade</Label>
              <Select value={campos.finalidade || "qa_interno"} onValueChange={v => onUpdate("finalidade", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qa_interno">QA Interno</SelectItem>
                  <SelectItem value="envio_amostra">Envio de Amostra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Campos Mínimos Obrigatórios</Label><Textarea value={campos.campos_minimos || ""} onChange={e => onUpdate("campos_minimos", e.target.value)} rows={2} /></div>
            <div><Label>Validade Provisória</Label><Input value={campos.validade_provisoria || ""} onChange={e => onUpdate("validade_provisoria", e.target.value)} placeholder="ex: 6 meses" /></div>
          </CardContent>
        </Card>
      );

    case "display":
      return (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">🖥️ Display</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Largura (cm)</Label><Input value={campos.dimensoes_largura || ""} onChange={e => onUpdate("dimensoes_largura", e.target.value)} /></div>
              <div><Label>Altura (cm)</Label><Input value={campos.dimensoes_altura || ""} onChange={e => onUpdate("dimensoes_altura", e.target.value)} /></div>
              <div><Label>Profundidade (cm)</Label><Input value={campos.dimensoes_profundidade || ""} onChange={e => onUpdate("dimensoes_profundidade", e.target.value)} /></div>
            </div>
            <div><Label>Capacidade (nº de produtos)</Label><Input type="number" value={campos.capacidade || 0} onChange={e => onUpdate("capacidade", parseInt(e.target.value))} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={campos.tipo_display || "balcao"} onValueChange={v => onUpdate("tipo_display", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="balcao">Balcão</SelectItem>
                  <SelectItem value="chao">Chão</SelectItem>
                  <SelectItem value="gondola">Gôndola</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Material</Label>
              <Select value={campos.material || "papelao"} onValueChange={v => onUpdate("material", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="papelao">Papelão</SelectItem>
                  <SelectItem value="acrilico">Acrílico</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      );

    default:
      return null;
  }
}
