import { useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Package, Plus, Search, CheckCircle2, XCircle, AlertTriangle,
  Clock, Upload, Palette, Send, Eye, FileText, Tag, ArrowRight, RotateCcw,
} from "lucide-react";
import {
  useAllEtiquetas, useEtiquetaCores,
  useCreateEtiqueta, useUpdateEtiqueta, useAvancarEtapa, useConfirmarAF,
  useAddEtiquetaCor, useDevolverEtapaBula,
  uploadEtiquetaFile, getEtapaColor,
  ETAPAS, REGULATORIO_ITEMS,
  type EtiquetaBula, type AprovacaoEntry, type RegulatorioItem,
} from "@/hooks/useEtiquetaBula";
import { DevolucaoEtapaDialog, type DevolucaoResult } from "@/components/shared/DevolucaoEtapaDialog";
import { VinculoProjetoBadges } from "@/components/shared/VinculoProjetoBadges";
import { VincularProjetoDialog } from "@/components/shared/VincularProjetoDialog";

// ── Status helpers ──
const ETAPA_LABELS: Record<string, string> = {
  criacao: "Criação", embalagem: "Embalagem", desenvolvimento: "Desenvolvimento",
  regulatorio: "Regulatório", af_recebida: "Arte Final",
};
const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-500", active: "bg-amber-500", pending: "bg-muted",
};

export default function ChecklistEtiquetaBula() {
  const [search, setSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedEtiqueta, setSelectedEtiqueta] = useState<EtiquetaBula | null>(null);
  const [showFlowDialog, setShowFlowDialog] = useState(false);

  const { data: etiquetas = [], isLoading } = useAllEtiquetas();

  const filtered = useMemo(() =>
    etiquetas.filter(e =>
      e.sku.toLowerCase().includes(search.toLowerCase()) ||
      e.produto_nome.toLowerCase().includes(search.toLowerCase())
    ), [etiquetas, search]);

  const kpis = useMemo(() => ({
    total: etiquetas.length,
    emAndamento: etiquetas.filter(e => !["concluido"].includes(e.status_atual)).length,
    concluidos: etiquetas.filter(e => e.status_atual === "concluido").length,
    reprovados: etiquetas.filter(e => e.status_atual === "reprovado").length,
  }), [etiquetas]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb moduleName="Etiqueta / Bula" moduleHref="/dashboard/etiqueta-bula" currentPage="Checklist" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Checklist Etiqueta / Bula</h1>
            <p className="text-muted-foreground mt-1">
              Fluxo sequencial: Criação → Embalagem → Desenvolvimento → Regulatório → AF
            </p>
          </div>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />Novo Checklist
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: kpis.total, icon: Tag, color: "text-foreground" },
            { label: "Em andamento", value: kpis.emAndamento, icon: Clock, color: "text-amber-600" },
            { label: "Concluídos", value: kpis.concluidos, icon: CheckCircle2, color: "text-emerald-600" },
            { label: "Devolvidos", value: kpis.reprovados, icon: XCircle, color: "text-destructive" },
          ].map(k => (
            <Card key={k.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <k.icon className={cn("h-5 w-5", k.color)} />
                <div>
                  <p className="text-2xl font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por SKU ou produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center p-8"><Clock className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !filtered.length ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum checklist encontrado.</CardContent></Card>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {filtered.map(et => {
                const etapaIdx = ETAPAS.findIndex(e => e.key === et.etapa_atual);
                const pct = Math.round(((etapaIdx >= 0 ? etapaIdx : 0) / (ETAPAS.length - 1)) * 100);
                return (
                  <Card key={et.id} className="border-l-4 border-l-primary cursor-pointer active:scale-[0.99] transition-all"
                    onClick={() => { setSelectedEtiqueta(et); setShowFlowDialog(true); }}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{et.produto_nome}</p>
                          <p className="text-[11px] text-muted-foreground truncate">SKU: {et.sku} · R{et.numero_rodada}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{ETAPA_LABELS[et.etapa_atual] || et.etapa_atual}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
              <div className="grid grid-cols-[1fr_140px_180px_80px_120px] gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <span>Produto</span>
                <span>Etapa Atual</span>
                <span>Timeline</span>
                <span>Rodada</span>
                <span>Criado em</span>
              </div>
              {filtered.map(et => {
                const initial = (et.produto_nome || "P")[0].toUpperCase();
                const etapaIdx = ETAPAS.findIndex(e => e.key === et.etapa_atual);
                const pct = Math.round(((etapaIdx >= 0 ? etapaIdx : 0) / Math.max(ETAPAS.length - 1, 1)) * 100);
                return (
                  <div
                    key={et.id}
                    className="grid grid-cols-[1fr_140px_180px_80px_120px] gap-4 px-5 py-3 items-center border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => { setSelectedEtiqueta(et); setShowFlowDialog(true); }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-xs">{initial}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{et.produto_nome}</p>
                        <p className="text-[11px] text-muted-foreground truncate">SKU: {et.sku}{et.double_sticker ? " · Double Sticker" : ""}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="w-fit text-[10px]">{ETAPA_LABELS[et.etapa_atual] || et.etapa_atual}</Badge>
                    <div className="flex items-center gap-1">
                      {ETAPAS.map((step, idx) => {
                        const color = getEtapaColor(step.key, et.etapa_atual, et.aprovacoes);
                        return (
                          <div key={step.key} className="flex items-center gap-1">
                            <div className={cn("w-3 h-3 rounded-full", STATUS_COLORS[color])} title={step.label} />
                            {idx < ETAPAS.length - 1 && <div className="w-3 h-0.5 bg-muted" />}
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-xs text-muted-foreground">R{et.numero_rodada}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {et.created_at ? new Date(et.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <NewEtiquetaDialog open={showNewDialog} onClose={() => setShowNewDialog(false)} />
      {selectedEtiqueta && (
        <FlowDialog open={showFlowDialog} onClose={() => setShowFlowDialog(false)} etiqueta={selectedEtiqueta} />
      )}
    </DashboardLayout>
  );
}

// ── New Dialog ──
function NewEtiquetaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateEtiqueta();
  const [form, setForm] = useState({ sku: "", produto_nome: "", linha_marca: "", double_sticker: false });

  const handleSubmit = () => {
    if (!form.sku || !form.produto_nome) { toast.error("SKU e produto são obrigatórios"); return; }
    create.mutate(form, { onSuccess: () => { onClose(); setForm({ sku: "", produto_nome: "", linha_marca: "", double_sticker: false }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo Checklist Etiqueta / Bula</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>SKU *</Label><Input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="HB-L6526" /></div>
          <div><Label>Produto *</Label><Input value={form.produto_nome} onChange={e => setForm(p => ({ ...p, produto_nome: e.target.value }))} placeholder="Lip Oil - Fresh Lips" /></div>
          <div><Label>Linha / Marca</Label><Input value={form.linha_marca} onChange={e => setForm(p => ({ ...p, linha_marca: e.target.value }))} placeholder="Ruby Rose" /></div>
          <div className="flex items-center gap-2">
            <Checkbox checked={form.double_sticker} onCheckedChange={v => setForm(p => ({ ...p, double_sticker: !!v }))} />
            <Label>Double Sticker</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>{create.isPending ? "Criando..." : "Criar Checklist"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Flow Dialog (main panel) ──
function FlowDialog({ open, onClose, etiqueta }: { open: boolean; onClose: () => void; etiqueta: EtiquetaBula }) {
  const avancar = useAvancarEtapa();
  const confirmarAF = useConfirmarAF();
  const updateEtiqueta = useUpdateEtiqueta();
  const addCor = useAddEtiquetaCor();
  const devolver = useDevolverEtapaBula();
  const { data: cores = [] } = useEtiquetaCores(etiqueta.id);

  const [status, setStatus] = useState<string>("approved");
  const [descricao, setDescricao] = useState("");
  const [newCorCodigo, setNewCorCodigo] = useState("");
  const [newCorPantone, setNewCorPantone] = useState("");
  const [newCorHex, setNewCorHex] = useState("");
  const [showDevolucao, setShowDevolucao] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [regChecklist, setRegChecklist] = useState<RegulatorioItem[]>(
    etiqueta.regulatorio_checklist?.length
      ? etiqueta.regulatorio_checklist
      : REGULATORIO_ITEMS.map(i => ({ key: i.key, label: i.label, resultado: null, observacao: "" }))
  );

  const isCompleted = etiqueta.status_atual === "concluido";
  const isAFStage = etiqueta.etapa_atual === "af_recebida" && etiqueta.status_atual === "aguardando_af";

  const handleAddCor = () => {
    if (!newCorCodigo) return;
    addCor.mutate({ etiqueta_id: etiqueta.id, codigo_cor: newCorCodigo, pantone_ref: newCorPantone || undefined, cor_hex: newCorHex || undefined, ordem: cores.length });
    setNewCorCodigo(""); setNewCorPantone(""); setNewCorHex("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "arte_etiqueta_urls" | "fotos_referencia") => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(e.target.files)) {
        const url = await uploadEtiquetaFile(`${field}/${etiqueta.id}`, f);
        urls.push(url);
      }
      const existing = (etiqueta as any)[field] || [];
      updateEtiqueta.mutate({ id: etiqueta.id, [field]: [...existing, ...urls] } as any);
      toast.success("Arquivo(s) enviado(s)");
    } catch (err: any) { toast.error("Erro: " + err.message); }
    setUploading(false);
  };

  const handleAvancar = () => {
    if ((status === "approved_with_changes" || status === "not_approved") && !descricao.trim()) {
      toast.error("Descrição é obrigatória para alterações/reprovação"); return;
    }
    // For regulatorio, save checklist first
    if (etiqueta.etapa_atual === "regulatorio") {
      const allChecked = regChecklist.every(i => i.resultado !== null);
      if (!allChecked) { toast.error("Avalie todos os itens do checklist regulatório"); return; }
      updateEtiqueta.mutate({ id: etiqueta.id, regulatorio_checklist: regChecklist } as any);
    }
    avancar.mutate({ id: etiqueta.id, etiqueta, status: status as any, descricao }, { onSuccess: onClose });
  };

  const handleConfirmarAF = () => {
    confirmarAF.mutate({ id: etiqueta.id }, { onSuccess: onClose });
  };

  const handleEncaminhar = () => {
    // Move from rascunho to aguardando_embalagem
    updateEtiqueta.mutate({
      id: etiqueta.id,
      etapa_atual: "embalagem",
      status_atual: "aguardando_embalagem",
    } as any, { onSuccess: () => { onClose(); toast.success("Encaminhado para Embalagem"); } });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{etiqueta.sku}: {etiqueta.produto_nome}</DialogTitle>
        </DialogHeader>

        {/* Timeline visual */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              {ETAPAS.map((step, idx) => {
                const color = getEtapaColor(step.key, etiqueta.etapa_atual, etiqueta.aprovacoes);
                const isActive = step.key === etiqueta.etapa_atual;
                return (
                  <div key={step.key} className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                        color === "done" ? "bg-emerald-500 text-white" :
                        color === "active" ? "bg-amber-500 text-white ring-2 ring-amber-300" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {color === "done" ? "✓" : idx + 1}
                      </div>
                      <span className={cn("text-[10px] text-center leading-tight",
                        isActive ? "font-bold text-foreground" : "text-muted-foreground"
                      )}>{step.label}</span>
                    </div>
                    {idx < ETAPAS.length - 1 && (
                      <ArrowRight className={cn("h-4 w-4 shrink-0", color === "done" ? "text-emerald-500" : "text-muted-foreground/30")} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline">Rodada R{etiqueta.numero_rodada}</Badge>
              {etiqueta.double_sticker && <Badge variant="outline">Double Sticker</Badge>}
              {isCompleted && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Concluído ✅</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Identification */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">📋 Identificação</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs text-muted-foreground">SKU</Label><p className="font-mono text-sm">{etiqueta.sku}</p></div>
              <div><Label className="text-xs text-muted-foreground">Produto</Label><p className="text-sm">{etiqueta.produto_nome}</p></div>
              <div><Label className="text-xs text-muted-foreground">Linha</Label><p className="text-sm">{etiqueta.linha_marca || "—"}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" />Cores da Etiqueta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cores.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                {c.cor_hex && <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: c.cor_hex }} />}
                <span className="font-mono text-sm font-semibold">{c.codigo_cor}</span>
                {c.pantone_ref && <Badge variant="outline" className="text-xs">{c.pantone_ref}</Badge>}
                {c.arte_url && <a href={c.arte_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Arte</a>}
              </div>
            ))}
            {!isCompleted && (
              <>
                <Separator />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Código (GL01)" value={newCorCodigo} onChange={e => setNewCorCodigo(e.target.value)} />
                  <Input placeholder="Pantone (201 C)" value={newCorPantone} onChange={e => setNewCorPantone(e.target.value)} />
                  <div className="flex gap-2">
                    <Input placeholder="#hex" value={newCorHex} onChange={e => setNewCorHex(e.target.value)} />
                    <Button size="sm" onClick={handleAddCor}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Uploads */}
        {!isCompleted && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">📸 Uploads Obrigatórios</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Arte da etiqueta ({(etiqueta.arte_etiqueta_urls || []).length} arquivo(s))</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(etiqueta.arte_etiqueta_urls || []).map((url: string, i: number) => (
                    <img key={i} src={url} alt={`arte-${i}`} className="w-16 h-16 object-cover rounded border" />
                  ))}
                </div>
                <Label htmlFor="arte-upload" className="cursor-pointer mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Upload artes"}
                </Label>
                <input id="arte-upload" type="file" multiple accept="image/*" className="hidden" onChange={e => handleUpload(e, "arte_etiqueta_urls")} />
              </div>
              <div>
                <Label className="text-sm">Fotos de referência ({(etiqueta.fotos_referencia || []).length})</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(etiqueta.fotos_referencia || []).map((url: string, i: number) => (
                    <img key={i} src={url} alt={`ref-${i}`} className="w-16 h-16 object-cover rounded border" />
                  ))}
                </div>
                <Label htmlFor="ref-upload2" className="cursor-pointer mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Upload referências"}
                </Label>
                <input id="ref-upload2" type="file" multiple accept="image/*" className="hidden" onChange={e => handleUpload(e, "fotos_referencia")} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Regulatory checklist (only visible at regulatorio step) */}
        {etiqueta.etapa_atual === "regulatorio" && !isCompleted && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3"><CardTitle className="text-base">⚖️ Checklist Regulatório</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {regChecklist.map((item, idx) => (
                <div key={item.key} className={cn("p-3 rounded-lg", item.resultado === "nao_conforme" ? "bg-destructive/5 border border-destructive/20" : "bg-muted/50")}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.label}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant={item.resultado === "conforme" ? "default" : "outline"}
                        className={item.resultado === "conforme" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                        onClick={() => { const n = [...regChecklist]; n[idx] = { ...n[idx], resultado: "conforme" }; setRegChecklist(n); }}>
                        ✅
                      </Button>
                      <Button size="sm" variant={item.resultado === "nao_conforme" ? "destructive" : "outline"}
                        onClick={() => { const n = [...regChecklist]; n[idx] = { ...n[idx], resultado: "nao_conforme" }; setRegChecklist(n); }}>
                        ❌
                      </Button>
                    </div>
                  </div>
                  {item.resultado === "nao_conforme" && (
                    <Textarea className="mt-2" placeholder="Observação..." value={item.observacao || ""}
                      onChange={e => { const n = [...regChecklist]; n[idx] = { ...n[idx], observacao: e.target.value }; setRegChecklist(n); }} rows={2} />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Histórico */}
        {(etiqueta.historico_completo || []).length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">📜 Histórico de Aprovações</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(etiqueta.historico_completo || []).map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/50">
                    <Badge variant="outline" className="text-xs">{ETAPA_LABELS[h.etapa_de]}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs">{ETAPA_LABELS[h.etapa_para]}</Badge>
                    <Badge className={cn("text-xs",
                      h.acao === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      h.acao === "approved_with_changes" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                      "bg-destructive/10 text-destructive"
                    )}>
                      {h.acao === "approved" ? "Aprovado" : h.acao === "approved_with_changes" ? "C/ Alterações" : "Reprovado"}
                    </Badge>
                    <span className="text-muted-foreground text-xs ml-auto">R{h.rodada} · {new Date(h.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action area */}
        {!isCompleted && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>

            {/* Criação: encaminhar */}
            {etiqueta.etapa_atual === "criacao" && etiqueta.status_atual === "rascunho" && (
              <Button onClick={handleEncaminhar}>
                <Send className="h-4 w-4 mr-2" />Encaminhar para Embalagem
              </Button>
            )}

            {/* AF stage: confirmar recebimento */}
            {isAFStage && (
              <Button onClick={handleConfirmarAF} disabled={confirmarAF.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" />{confirmarAF.isPending ? "Salvando..." : "Confirmar AF Recebida ✅"}
              </Button>
            )}

            {/* Intermediate steps: approve/reject */}
            {["embalagem", "desenvolvimento", "regulatorio"].includes(etiqueta.etapa_atual) && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {ETAPAS.findIndex(e => e.key === etiqueta.etapa_atual) > 0 && (
                  <Button variant="outline" className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20" onClick={() => setShowDevolucao(true)}>
                    <RotateCcw className="h-4 w-4" />
                    Devolver
                  </Button>
                )}
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">✅ Aprovado</SelectItem>
                    <SelectItem value="approved_with_changes">⚠️ C/ Alterações</SelectItem>
                    <SelectItem value="not_approved">❌ Reprovado</SelectItem>
                  </SelectContent>
                </Select>
                {(status === "approved_with_changes" || status === "not_approved") && (
                  <Input placeholder="Descrição obrigatória..." value={descricao} onChange={e => setDescricao(e.target.value)} className="flex-1" />
                )}
                <Button onClick={handleAvancar} disabled={avancar.isPending}>
                  {avancar.isPending ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    <DevolucaoEtapaDialog
      open={showDevolucao}
      onOpenChange={setShowDevolucao}
      entityType="etiqueta_bula"
      entityId={etiqueta.id}
      etapasAnteriores={
        ETAPAS
          .filter((_, idx) => idx < ETAPAS.findIndex(e => e.key === etiqueta.etapa_atual))
          .map(e => ({ key: e.key, label: e.label }))
      }
      onConfirm={async (result: DevolucaoResult) => {
        await devolver.mutateAsync({
          id: etiqueta.id,
          etiqueta,
          etapaDestino: result.etapaDestino,
          justificativa: result.justificativa,
          userInfo: result.userInfo,
        });
        onClose();
      }}
    />
    </>
  );
}
