import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Clock, Upload, Palette, Send, Eye, Camera, Video, FileText, RotateCcw
} from "lucide-react";
import {
  useAllAnalises, useAllSolicitacoes, useEmbalagemCores, useSolicitacoesByAnalise,
  useCreateAnalise, useUpdateAnalise, useAprovarAnalise, useDevolverAnalise,
  useAddCor, useDeleteCor,
  useCreateSolicitacao, useUpdateSolicitacao, useAvaliarSolicitacao,
  uploadEmbalagemFile, getSlaStatus,
  AVALIACAO_ITEMS,
  type AnaliseEmbalagem as AnaliseEmbalagemType, type SolicitacaoAmostra, type AvaliacaoItem,
} from "@/hooks/useAnaliseEmbalagem";
import { DevolucaoEtapaDialog, type DevolucaoResult } from "@/components/shared/DevolucaoEtapaDialog";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  approved_with_changes: { label: "Approved With Changes", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertTriangle },
  not_approved: { label: "Not Approved", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const SLA_COLORS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  vencido: "bg-destructive/10 text-destructive",
};

export default function AnaliseEmbalagem() {
  const [activeTab, setActiveTab] = useState("analises");
  const [search, setSearch] = useState("");
  const [selectedAnalise, setSelectedAnalise] = useState<any | null>(null);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<any | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showSolicitacaoDialog, setShowSolicitacaoDialog] = useState(false);
  const [showAvaliacaoDialog, setShowAvaliacaoDialog] = useState(false);
  const [showChinaUploadDialog, setShowChinaUploadDialog] = useState(false);

  const { data: analises = [], isLoading: loadingAnalises } = useAllAnalises();
  const { data: solicitacoes = [], isLoading: loadingSolicitacoes } = useAllSolicitacoes();

  const filteredAnalises = useMemo(() =>
    analises.filter((a: any) =>
      a.sku?.toLowerCase().includes(search.toLowerCase()) ||
      a.produto_nome?.toLowerCase().includes(search.toLowerCase())
    ), [analises, search]);

  const filteredSolicitacoes = useMemo(() =>
    solicitacoes.filter((s: any) =>
      s.numero_solicitacao?.toLowerCase().includes(search.toLowerCase()) ||
      s.sku?.toLowerCase().includes(search.toLowerCase())
    ), [solicitacoes, search]);

  // KPIs
  const kpis = useMemo(() => ({
    total: analises.length,
    approved: analises.filter((a: any) => a.status_aprovacao === "approved").length,
    withChanges: analises.filter((a: any) => a.status_aprovacao === "approved_with_changes").length,
    pending: analises.filter((a: any) => a.status_aprovacao === "pendente").length,
    solicitacoesAbertas: solicitacoes.filter((s: any) => !["conforme"].includes(s.avaliacao_status)).length,
    slaVencido: solicitacoes.filter((s: any) => getSlaStatus(s.sla_prazo) === "vencido" && s.avaliacao_status !== "conforme").length,
  }), [analises, solicitacoes]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb moduleName="Análise de Embalagem" moduleHref="/dashboard/analise-embalagem" currentPage="Painel" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Análise de Embalagem — Criação</h1>
            <p className="text-muted-foreground mt-1">
              Primary Package, grade de cores e solicitação formal de amostras à China
            </p>
          </div>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Análise
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total", value: kpis.total, icon: Package, color: "text-foreground" },
            { label: "Approved", value: kpis.approved, icon: CheckCircle2, color: "text-emerald-600" },
            { label: "With Changes", value: kpis.withChanges, icon: AlertTriangle, color: "text-amber-600" },
            { label: "Pendentes", value: kpis.pending, icon: Clock, color: "text-muted-foreground" },
            { label: "Solicitações Abertas", value: kpis.solicitacoesAbertas, icon: Send, color: "text-blue-600" },
            { label: "SLA Vencido", value: kpis.slaVencido, icon: XCircle, color: "text-destructive" },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <k.icon className={`h-5 w-5 ${k.color}`} />
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
          <Input placeholder="Buscar por SKU ou produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="analises" className="gap-2"><Package className="h-4 w-4" />Análises</TabsTrigger>
            <TabsTrigger value="solicitacoes" className="gap-2"><Send className="h-4 w-4" />Solicitações China</TabsTrigger>
          </TabsList>

          <TabsContent value="analises" className="mt-4">
            <AnalisesList analises={filteredAnalises} loading={loadingAnalises}
              onSelect={(a) => setSelectedAnalise(a)}
              onApprove={(a) => { setSelectedAnalise(a); setShowApprovalDialog(true); }}
              onSolicitar={(a) => { setSelectedAnalise(a); setShowSolicitacaoDialog(true); }}
            />
          </TabsContent>

          <TabsContent value="solicitacoes" className="mt-4">
            <SolicitacoesList solicitacoes={filteredSolicitacoes} loading={loadingSolicitacoes}
              onChinaUpload={(s) => { setSelectedSolicitacao(s); setShowChinaUploadDialog(true); }}
              onAvaliar={(s) => { setSelectedSolicitacao(s); setShowAvaliacaoDialog(true); }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <NewAnaliseDialog open={showNewDialog} onClose={() => setShowNewDialog(false)} />
      {selectedAnalise && (
        <>
          <ApprovalDialog open={showApprovalDialog} onClose={() => setShowApprovalDialog(false)} analise={selectedAnalise} />
          <SolicitacaoDialog open={showSolicitacaoDialog} onClose={() => setShowSolicitacaoDialog(false)} analise={selectedAnalise} />
        </>
      )}
      {selectedSolicitacao && (
        <>
          <ChinaUploadDialog open={showChinaUploadDialog} onClose={() => setShowChinaUploadDialog(false)} solicitacao={selectedSolicitacao} />
          <AvaliacaoDialog open={showAvaliacaoDialog} onClose={() => setShowAvaliacaoDialog(false)} solicitacao={selectedSolicitacao} />
        </>
      )}
    </DashboardLayout>
  );
}

// ── Analises List ──
function AnalisesList({ analises, loading, onSelect, onApprove, onSolicitar }: any) {
  if (loading) return <div className="flex justify-center p-8"><Clock className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!analises.length) return <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma análise encontrada.</CardContent></Card>;

  return (
    <>
      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {analises.map((a: any) => {
          const st = STATUS_LABELS[a.status_aprovacao] || STATUS_LABELS.pendente;
          return (
            <Card key={a.id} className="border-l-4 border-l-primary cursor-pointer active:scale-[0.99] transition-all" onClick={() => onSelect(a)}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{a.produto_nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">SKU: {a.sku}</p>
                  </div>
                  <Badge className={cn("text-[10px] shrink-0", st.color)}>{st.label}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
        <div className="grid grid-cols-[1fr_140px_1fr_160px_120px] gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <span>Produto</span>
          <span>Aprovação</span>
          <span>Specs</span>
          <span>Ações</span>
          <span>Criado em</span>
        </div>
        {analises.map((a: any) => {
          const st = STATUS_LABELS[a.status_aprovacao] || STATUS_LABELS.pendente;
          const Icon = st.icon;
          const initial = (a.produto_nome || "P")[0].toUpperCase();
          const specs = [
            a.tube_translucent && "Tube Translucent",
            a.tube_shiny && "Tube Shiny",
            a.cap_matte && "Cap Matte",
            a.finishing_embossed && "Embossed",
            a.colors_product_color && "Product Color",
          ].filter(Boolean);
          return (
            <div
              key={a.id}
              className="grid grid-cols-[1fr_140px_1fr_160px_120px] gap-4 px-5 py-3 items-center border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onSelect(a)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-xs">{initial}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.produto_nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">SKU: {a.sku}</p>
                </div>
              </div>
              <Badge className={cn("w-fit text-[10px]", st.color)}>
                <Icon className="h-3 w-3 mr-1" />{st.label}
              </Badge>
              <div className="flex flex-wrap gap-1">
                {specs.slice(0, 3).map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                ))}
                {specs.length > 3 && <Badge variant="outline" className="text-[10px]">+{specs.length - 3}</Badge>}
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {a.status_aprovacao === "pendente" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onApprove(a)}>Avaliar</Button>
                )}
                {["approved", "approved_with_changes"].includes(a.status_aprovacao) && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => onSolicitar(a)}>Solicitar</Button>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {a.created_at ? new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Solicitações List ──
function SolicitacoesList({ solicitacoes, loading, onChinaUpload, onAvaliar }: any) {
  if (loading) return <div className="flex justify-center p-8"><Clock className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!solicitacoes.length) return <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma solicitação encontrada.</CardContent></Card>;

  return (
    <>
      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {solicitacoes.map((s: any) => {
          const sla = getSlaStatus(s.sla_prazo);
          const slaLabel = sla === "vencido" ? "SLA Vencido" : sla === "warning" ? "SLA Próximo" : "SLA OK";
          return (
            <Card key={s.id} className={cn("border-l-4 active:scale-[0.99] transition-all", sla === "vencido" ? "border-l-destructive" : sla === "warning" ? "border-l-warning" : "border-l-primary")}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.numero_solicitacao}</p>
                    <p className="text-[11px] text-muted-foreground truncate">SKU: {s.sku} · R{s.numero_rodada}</p>
                  </div>
                  <Badge className={cn("text-[10px] shrink-0", SLA_COLORS[sla])}>{slaLabel}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
        <div className="grid grid-cols-[1fr_120px_100px_120px_160px_120px] gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <span>Solicitação</span>
          <span>SLA</span>
          <span>Evidências</span>
          <span>Avaliação</span>
          <span>Ações</span>
          <span>Prazo</span>
        </div>
        {solicitacoes.map((s: any) => {
          const sla = getSlaStatus(s.sla_prazo);
          const slaLabel = sla === "vencido" ? "SLA Vencido" : sla === "warning" ? "SLA Próximo" : "SLA OK";
          return (
            <div
              key={s.id}
              className="grid grid-cols-[1fr_120px_100px_120px_160px_120px] gap-4 px-5 py-3 items-center border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{s.numero_solicitacao}</p>
                  <p className="text-[11px] text-muted-foreground truncate">SKU: {s.sku} · R{s.numero_rodada}</p>
                </div>
              </div>
              <Badge className={cn("w-fit text-[10px]", SLA_COLORS[sla])}>{slaLabel}</Badge>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5"><Camera className="h-3 w-3" />{(s.fotos_china || []).length}</span>
                <span className="flex items-center gap-0.5"><Video className="h-3 w-3" />{s.video_url ? "1" : "0"}</span>
              </div>
              <Badge variant="outline" className="w-fit text-[10px]">{s.avaliacao_status?.replace(/_/g, " ")}</Badge>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {s.avaliacao_status === "aguardando_china" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChinaUpload(s)}>Enviar</Button>
                )}
                {s.avaliacao_status === "evidencias_enviadas" && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => onAvaliar(s)}>Avaliar</Button>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {s.sla_prazo ? new Date(s.sla_prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── New Analise Dialog ──
function NewAnaliseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAnalise();
  const [form, setForm] = useState({ submissao_id: "", sku: "", produto_nome: "", linha_marca: "" });

  const handleSubmit = () => {
    if (!form.sku || !form.produto_nome) { toast.error("SKU e nome do produto são obrigatórios"); return; }
    create.mutate(form, { onSuccess: () => { onClose(); setForm({ submissao_id: "", sku: "", produto_nome: "", linha_marca: "" }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Análise de Embalagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>SKU *</Label>
            <Input value={form.sku} onChange={(e) => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="HB-L6526" />
          </div>
          <div>
            <Label>Produto *</Label>
            <Input value={form.produto_nome} onChange={(e) => setForm(p => ({ ...p, produto_nome: e.target.value }))} placeholder="Lip Oil - Fresh Lips" />
          </div>
          <div>
            <Label>Linha / Marca</Label>
            <Input value={form.linha_marca} onChange={(e) => setForm(p => ({ ...p, linha_marca: e.target.value }))} placeholder="Ruby Rose" />
          </div>
          <div>
            <Label>Submissão ID (opcional)</Label>
            <Input value={form.submissao_id} onChange={(e) => setForm(p => ({ ...p, submissao_id: e.target.value }))} placeholder="UUID da submissão China" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Criando..." : "Criar Análise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Approval Dialog ──
function ApprovalDialog({ open, onClose, analise }: { open: boolean; onClose: () => void; analise: any }) {
  const aprovar = useAprovarAnalise();
  const updateAnalise = useUpdateAnalise();
  const addCor = useAddCor();
  const [status, setStatus] = useState<string>("approved");
  const [descricao, setDescricao] = useState("");
  const [newCorCodigo, setNewCorCodigo] = useState("");
  const [newCorPantone, setNewCorPantone] = useState("");
  const [newCorHex, setNewCorHex] = useState("");
  const { data: cores = [] } = useEmbalagemCores(analise?.id);

  // Technical specs
  const [specs, setSpecs] = useState({
    tube_translucent: analise?.tube_translucent || false,
    tube_shiny: analise?.tube_shiny || false,
    cap_matte: analise?.cap_matte || false,
    finishing_embossed: analise?.finishing_embossed || false,
    finishing_translucent: analise?.finishing_translucent || false,
    colors_product_color: analise?.colors_product_color || false,
    colors_white: analise?.colors_white || false,
  });

  const [uploading, setUploading] = useState(false);

  const handleSaveSpecs = () => {
    updateAnalise.mutate({ id: analise.id, ...specs } as any);
    toast.success("Especificações salvas");
  };

  const handleAddCor = () => {
    if (!newCorCodigo) { toast.error("Código da cor é obrigatório"); return; }
    addCor.mutate({ analise_id: analise.id, codigo_cor: newCorCodigo, pantone_ref: newCorPantone || undefined, cor_hex: newCorHex || undefined, ordem: cores.length });
    setNewCorCodigo(""); setNewCorPantone(""); setNewCorHex("");
  };

  const handleUploadRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(e.target.files)) {
        const url = await uploadEmbalagemFile(`ref/${analise.id}`, f);
        urls.push(url);
      }
      const existing = analise.fotos_referencia || [];
      updateAnalise.mutate({ id: analise.id, fotos_referencia: [...existing, ...urls] } as any);
      toast.success("Fotos de referência enviadas");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    }
    setUploading(false);
  };

  const handleApprove = () => {
    if ((status === "approved_with_changes" || status === "not_approved") && !descricao.trim()) {
      toast.error("Descrição das alterações é obrigatória para este status");
      return;
    }
    aprovar.mutate({ id: analise.id, status: status as any, descricao }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Análise — {analise.sku}: {analise.produto_nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Primary Package Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Primary Package
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs text-muted-foreground">SKU</Label><p className="font-mono text-sm">{analise.sku}</p></div>
                <div><Label className="text-xs text-muted-foreground">Linha</Label><p className="text-sm">{analise.linha_marca || "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Produto</Label><p className="text-sm">{analise.produto_nome}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Cores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" /> Grade de Cores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cores.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  {c.cor_hex && <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: c.cor_hex }} />}
                  <span className="font-mono text-sm font-semibold">{c.codigo_cor}</span>
                  {c.pantone_ref && <Badge variant="outline" className="text-xs">{c.pantone_ref}</Badge>}
                </div>
              ))}
              <Separator />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Código (GL01)" value={newCorCodigo} onChange={(e) => setNewCorCodigo(e.target.value)} />
                <Input placeholder="Pantone (201 C)" value={newCorPantone} onChange={(e) => setNewCorPantone(e.target.value)} />
                <div className="flex gap-2">
                  <Input placeholder="#hex" value={newCorHex} onChange={(e) => setNewCorHex(e.target.value)} />
                  <Button size="sm" onClick={handleAddCor}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Specs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">🔧 Especificações Técnicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">TUBE</Label>
                  <div className="flex items-center gap-2"><Checkbox checked={specs.tube_translucent} onCheckedChange={(v) => setSpecs(p => ({ ...p, tube_translucent: !!v }))} /><span className="text-sm">Translucent</span></div>
                  <div className="flex items-center gap-2"><Checkbox checked={specs.tube_shiny} onCheckedChange={(v) => setSpecs(p => ({ ...p, tube_shiny: !!v }))} /><span className="text-sm">Shiny</span></div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">CAP</Label>
                  <div className="flex items-center gap-2"><Checkbox checked={specs.cap_matte} onCheckedChange={(v) => setSpecs(p => ({ ...p, cap_matte: !!v }))} /><span className="text-sm">Matte</span></div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">SPECIAL FINISHING</Label>
                  <div className="flex items-center gap-2"><Checkbox checked={specs.finishing_embossed} onCheckedChange={(v) => setSpecs(p => ({ ...p, finishing_embossed: !!v }))} /><span className="text-sm">Embossed</span></div>
                  <div className="flex items-center gap-2"><Checkbox checked={specs.finishing_translucent} onCheckedChange={(v) => setSpecs(p => ({ ...p, finishing_translucent: !!v }))} /><span className="text-sm">Translucent</span></div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">COLORS</Label>
                  <div className="flex items-center gap-2"><Checkbox checked={specs.colors_product_color} onCheckedChange={(v) => setSpecs(p => ({ ...p, colors_product_color: !!v }))} /><span className="text-sm">Product Color</span></div>
                  <div className="flex items-center gap-2"><Checkbox checked={specs.colors_white} onCheckedChange={(v) => setSpecs(p => ({ ...p, colors_white: !!v }))} /><span className="text-sm">White</span></div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleSaveSpecs}>Salvar Especificações</Button>
            </CardContent>
          </Card>

          {/* Reference Photos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">📸 Fotos de Referência</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {(analise.fotos_referencia || []).map((url: string, i: number) => (
                  <img key={i} src={url} alt={`ref-${i}`} className="w-20 h-20 object-cover rounded-lg border" />
                ))}
              </div>
              <Label htmlFor="ref-upload" className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary transition-colors text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Upload de referências"}
              </Label>
              <input id="ref-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleUploadRef} />
            </CardContent>
          </Card>

          {/* Approval Decision */}
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">✅ Status de Aprovação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">☑ Approved</SelectItem>
                  <SelectItem value="approved_with_changes">☑ Approved With Changes</SelectItem>
                  <SelectItem value="not_approved">☑ Not Approved</SelectItem>
                </SelectContent>
              </Select>

              {(status === "approved_with_changes" || status === "not_approved") && (
                <div>
                  <Label>Descrição das alterações *</Label>
                  <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva as alterações necessárias..." rows={3} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleApprove} disabled={aprovar.isPending}>
            {aprovar.isPending ? "Salvando..." : "Confirmar Aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Solicitação Dialog ──
function SolicitacaoDialog({ open, onClose, analise }: { open: boolean; onClose: () => void; analise: any }) {
  const create = useCreateSolicitacao();
  const { data: cores = [] } = useEmbalagemCores(analise?.id);
  const [form, setForm] = useState({
    sla_prazo: "",
    instrucao_ajuste: "",
    cores_solicitadas: [] as string[],
    qtd_amostras: 1,
  });

  const toggleCor = (cod: string) => {
    setForm(p => ({
      ...p,
      cores_solicitadas: p.cores_solicitadas.includes(cod)
        ? p.cores_solicitadas.filter(c => c !== cod)
        : [...p.cores_solicitadas, cod],
    }));
  };

  const handleSubmit = () => {
    if (!form.sla_prazo) { toast.error("Prazo SLA é obrigatório"); return; }
    if (analise.status_aprovacao === "approved_with_changes" && !form.instrucao_ajuste.trim()) {
      toast.error("Instrução de ajuste é obrigatória para 'Approved With Changes'");
      return;
    }
    create.mutate({
      analise_id: analise.id,
      submissao_id: analise.submissao_id || analise.id,
      sku: analise.sku,
      ...form,
    }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Amostra à China</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm"><strong>SKU:</strong> {analise.sku}</p>
            <p className="text-sm"><strong>Produto:</strong> {analise.produto_nome}</p>
          </div>

          <div>
            <Label>Prazo SLA (Data limite) *</Label>
            <Input type="date" value={form.sla_prazo} onChange={(e) => setForm(p => ({ ...p, sla_prazo: e.target.value }))} />
          </div>

          <div>
            <Label>Quantidade de amostras</Label>
            <Input type="number" min={1} value={form.qtd_amostras} onChange={(e) => setForm(p => ({ ...p, qtd_amostras: parseInt(e.target.value) || 1 }))} />
          </div>

          {cores.length > 0 && (
            <div>
              <Label>Cores solicitadas</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {cores.map((c: any) => (
                  <Button key={c.id} size="sm" variant={form.cores_solicitadas.includes(c.codigo_cor) ? "default" : "outline"}
                    onClick={() => toggleCor(c.codigo_cor)} className="gap-2">
                    {c.cor_hex && <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.cor_hex }} />}
                    {c.codigo_cor}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Instrução de ajuste {analise.status_aprovacao === "approved_with_changes" ? "*" : ""}</Label>
            <Textarea value={form.instrucao_ajuste} onChange={(e) => setForm(p => ({ ...p, instrucao_ajuste: e.target.value }))} placeholder="Instruções para a fábrica na China..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            <Send className="h-4 w-4 mr-2" />{create.isPending ? "Enviando..." : "Enviar Solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── China Upload Dialog ──
function ChinaUploadDialog({ open, onClose, solicitacao }: { open: boolean; onClose: () => void; solicitacao: any }) {
  const update = useUpdateSolicitacao();
  const [uploading, setUploading] = useState(false);
  const [fotos, setFotos] = useState<string[]>(solicitacao?.fotos_china || []);
  const [videoUrl, setVideoUrl] = useState(solicitacao?.video_url || "");

  const handleUploadFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(e.target.files)) {
        const url = await uploadEmbalagemFile(`china/${solicitacao.id}`, f);
        urls.push(url);
      }
      setFotos(prev => [...prev, ...urls]);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setUploading(false);
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadEmbalagemFile(`china-video/${solicitacao.id}`, e.target.files[0]);
      setVideoUrl(url);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setUploading(false);
  };

  const handleSubmit = () => {
    if (fotos.length < 3) { toast.error("Mínimo 3 fotos obrigatórias (frente, verso, detalhe)"); return; }
    if (!videoUrl) { toast.error("Vídeo de demonstração é obrigatório"); return; }
    update.mutate({
      id: solicitacao.id,
      fotos_china: fotos,
      video_url: videoUrl,
      avaliacao_status: "evidencias_enviadas",
    } as any, { onSuccess: () => { onClose(); toast.success("Evidências enviadas para avaliação"); } });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Evidências — {solicitacao.numero_solicitacao}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Fotos (mín. 3: frente, verso, detalhe)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {fotos.map((url, i) => (
                <img key={i} src={url} alt={`foto-${i}`} className="w-20 h-20 object-cover rounded-lg border" />
              ))}
            </div>
            <Label htmlFor="china-fotos" className="cursor-pointer mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Upload fotos"}
            </Label>
            <input id="china-fotos" type="file" multiple accept="image/*" className="hidden" onChange={handleUploadFotos} />
            <p className="text-xs text-muted-foreground mt-1">{fotos.length}/3 fotos enviadas {fotos.length >= 3 ? "✅" : "❌"}</p>
          </div>

          <div>
            <Label className="flex items-center gap-2"><Video className="h-4 w-4" /> Vídeo de demonstração (obrigatório)</Label>
            {videoUrl && <p className="text-xs text-emerald-600 mt-1">✅ Vídeo enviado</p>}
            <Label htmlFor="china-video" className="cursor-pointer mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Upload vídeo"}
            </Label>
            <input id="china-video" type="file" accept="video/*" className="hidden" onChange={handleUploadVideo} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={update.isPending || uploading}>
            {update.isPending ? "Enviando..." : "Submeter Evidências"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Avaliação Dialog ──
function AvaliacaoDialog({ open, onClose, solicitacao }: { open: boolean; onClose: () => void; solicitacao: any }) {
  const avaliar = useAvaliarSolicitacao();
  const [items, setItems] = useState<AvaliacaoItem[]>(
    (solicitacao?.avaliacao_resultado?.length
      ? solicitacao.avaliacao_resultado
      : AVALIACAO_ITEMS.map(i => ({ key: i.key, label: i.label, resultado: null, observacao: "" }))
    ) as AvaliacaoItem[]
  );

  const updateItem = (key: string, field: string, value: any) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const allEvaluated = items.every(i => i.resultado !== null);
  const allConformes = items.every(i => i.resultado === "conforme");

  const handleSubmit = () => {
    if (!allEvaluated) { toast.error("Avalie todos os critérios antes de concluir"); return; }
    const hasNaoConformeSemObs = items.some(i => i.resultado === "nao_conforme" && !i.observacao?.trim());
    if (hasNaoConformeSemObs) { toast.error("Itens 'Não Conforme' exigem observação"); return; }

    avaliar.mutate({
      id: solicitacao.id,
      status: allConformes ? "conforme" : "nao_conforme",
      avaliacao_resultado: items,
    }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avaliar Amostra — {solicitacao.numero_solicitacao} (R{solicitacao.numero_rodada})</DialogTitle>
        </DialogHeader>

        {/* Evidence gallery */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Evidências recebidas da China</Label>
          <div className="flex flex-wrap gap-2">
            {(solicitacao.fotos_china || []).map((url: string, i: number) => (
              <img key={i} src={url} alt={`china-${i}`} className="w-24 h-24 object-cover rounded-lg border cursor-pointer hover:ring-2 ring-primary" />
            ))}
          </div>
          {solicitacao.video_url && (
            <video src={solicitacao.video_url} controls className="w-full max-h-48 rounded-lg border" />
          )}
        </div>

        <Separator />

        {/* Evaluation checklist */}
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.key} className={item.resultado === "nao_conforme" ? "border-destructive/50" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{item.label}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant={item.resultado === "conforme" ? "default" : "outline"}
                      className={item.resultado === "conforme" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      onClick={() => updateItem(item.key, "resultado", "conforme")}>
                      ✅ Conforme
                    </Button>
                    <Button size="sm" variant={item.resultado === "nao_conforme" ? "destructive" : "outline"}
                      onClick={() => updateItem(item.key, "resultado", "nao_conforme")}>
                      ❌ Não Conforme
                    </Button>
                  </div>
                </div>
                {item.resultado === "nao_conforme" && (
                  <Textarea placeholder="Observação obrigatória..." value={item.observacao || ""}
                    onChange={(e) => updateItem(item.key, "observacao", e.target.value)} rows={2} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={avaliar.isPending || !allEvaluated}>
            {avaliar.isPending ? "Salvando..." : allConformes ? "✅ Aprovar — Avança no Pipeline" : "❌ Reprovar — Nova Rodada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
