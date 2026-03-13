import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Package, Search, ArrowLeft, Camera, Video, CheckCircle2,
  XCircle, Upload, AlertTriangle, Send, Eye, Clock, Loader2, Trash2, RotateCcw,
} from "lucide-react";
import {
  useAllAmostras, useAmostrasBySubmissao, useAmostraFotos,
  useCreateAmostra, useUpdateAmostra, useAprovarAmostra, useReprovarAmostra,
  useDevolverAmostra,
  uploadAmostraFile, ANGLE_TYPES, CHECKLIST_ITEMS,
  type Amostra, type ChecklistItem,
} from "@/hooks/useAmostras";
import { DevolucaoEtapaDialog, type DevolucaoResult } from "@/components/shared/DevolucaoEtapaDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"; icon: any }> = {
  aguardando_envio: { label: "Aguardando Envio", variant: "secondary", icon: Clock },
  recebida: { label: "Recebida", variant: "default", icon: Package },
  em_avaliacao: { label: "Em Avaliação", variant: "warning", icon: Eye },
  aprovada: { label: "Aprovada", variant: "success", icon: CheckCircle2 },
  reprovada: { label: "Reprovada", variant: "destructive", icon: XCircle },
};

export default function RecebimentoAmostra() {
  const [selectedSubmissao, setSelectedSubmissao] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data: allAmostras = [], isLoading } = useAllAmostras();

  // List submissões with amostras
  const { data: submissoes = [] } = useQuery({
    queryKey: ["submissoes_amostras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes")
        .select("id, produto_codigo, produto_nome, status, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = submissoes.filter(s =>
    !search || s.produto_nome?.toLowerCase().includes(search.toLowerCase()) ||
    s.produto_codigo?.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const aguardando = allAmostras.filter(a => a.status === "aguardando_envio").length;
  const emAvaliacao = allAmostras.filter(a => a.status === "em_avaliacao" || a.status === "recebida").length;
  const aprovadas = allAmostras.filter(a => a.status === "aprovada").length;
  const reprovadas = allAmostras.filter(a => a.status === "reprovada").length;

  if (selectedSubmissao) {
    return <AmostraDetail submissaoId={selectedSubmissao} onBack={() => setSelectedSubmissao(null)} />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb moduleName="Amostras" moduleHref="/dashboard/amostras" currentPage="Recebimento" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Recebimento de Amostra Física</h1>
            <p className="text-muted-foreground mt-1">Receba, avalie e aprove amostras de produtos</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Aguardando", value: aguardando, icon: Clock, color: "text-muted-foreground" },
            { label: "Em Avaliação", value: emAvaliacao, icon: Eye, color: "text-warning" },
            { label: "Aprovadas", value: aprovadas, icon: CheckCircle2, color: "text-success" },
            { label: "Reprovadas", value: reprovadas, icon: XCircle, color: "text-destructive" },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {filtered.map(sub => {
            const subAmostras = allAmostras.filter((a: any) => a.submissao_id === sub.id);
            const lastAmostra = subAmostras[0];
            const statusInfo = lastAmostra ? STATUS_MAP[lastAmostra.status] || STATUS_MAP.aguardando_envio : null;
            return (
              <Card key={sub.id} className="border-l-4 border-l-primary cursor-pointer active:scale-[0.99] transition-all" onClick={() => setSelectedSubmissao(sub.id)}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{sub.produto_nome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{sub.produto_codigo}</p>
                    </div>
                    {statusInfo ? (
                      <Badge variant={statusInfo.variant} className="text-[10px] shrink-0">
                        {statusInfo.label}
                        {lastAmostra?.numero_rodada > 1 && ` R${lastAmostra.numero_rodada}`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">Sem amostra</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-[1fr_150px_100px_100px_120px] gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <span>Produto</span>
            <span>Status Amostra</span>
            <span>Evidências</span>
            <span>Rodada</span>
            <span>Criado em</span>
          </div>
          {filtered.map(sub => {
            const subAmostras = allAmostras.filter((a: any) => a.submissao_id === sub.id);
            const lastAmostra = subAmostras[0];
            const statusInfo = lastAmostra ? STATUS_MAP[lastAmostra.status] || STATUS_MAP.aguardando_envio : null;
            const initial = (sub.produto_nome || "P")[0].toUpperCase();
            return (
              <div
                key={sub.id}
                className="grid grid-cols-[1fr_150px_100px_100px_120px] gap-4 px-5 py-3 items-center border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setSelectedSubmissao(sub.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-xs">{initial}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{sub.produto_nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{sub.produto_codigo}</p>
                  </div>
                </div>
                {statusInfo ? (
                  <Badge variant={statusInfo.variant} className="w-fit text-[10px]">{statusInfo.label}</Badge>
                ) : (
                  <Badge variant="outline" className="w-fit text-[10px]">Sem amostra</Badge>
                )}
                <span className="text-xs text-muted-foreground">—</span>
                <span className="text-xs text-muted-foreground">
                  {lastAmostra ? `R${lastAmostra.numero_rodada}` : "—"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {sub.created_at ? new Date(sub.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
            );
          })}
          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ── Detail page ──

function AmostraDetail({ submissaoId, onBack }: { submissaoId: string; onBack: () => void }) {
  const { data: amostras = [] } = useAmostrasBySubmissao(submissaoId);
  const createAmostra = useCreateAmostra();
  const [selectedAmostra, setSelectedAmostra] = useState<string | null>(null);

  const current = amostras.find(a => a.id === selectedAmostra) || amostras[0];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="p-2 rounded-lg bg-primary/10">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Amostra Física</h1>
          <p className="text-xs text-muted-foreground">{amostras.length} rodada(s)</p>
        </div>
        <Button onClick={() => createAmostra.mutate({ submissaoId })} disabled={createAmostra.isPending}>
          <Package className="h-4 w-4 mr-2" />Nova Rodada
        </Button>
      </div>

      {/* Round selector */}
      {amostras.length > 1 && (
        <div className="flex gap-2">
          {amostras.map(a => {
            const si = STATUS_MAP[a.status] || STATUS_MAP.aguardando_envio;
            return (
              <Button
                key={a.id}
                variant={a.id === current?.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedAmostra(a.id)}
              >
                {a.numero_rodada}ª Rodada
                <Badge variant={si.variant as any} className="ml-2 text-[10px]">{si.label}</Badge>
              </Button>
            );
          })}
        </div>
      )}

      {!current ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma amostra solicitada ainda</p>
            <Button className="mt-3" onClick={() => createAmostra.mutate({ submissaoId })} disabled={createAmostra.isPending}>
              Solicitar Amostra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AmostraEditor amostra={current} />
      )}

      {/* Image Timeline */}
      {amostras.length > 0 && <ImageTimeline amostras={amostras} />}
    </div>
  );
}

// ── Amostra Editor ──

function AmostraEditor({ amostra }: { amostra: Amostra }) {
  const [tab, setTab] = useState("recebimento");
  const updateAmostra = useUpdateAmostra();
  const aprovar = useAprovarAmostra();
  const reprovar = useReprovarAmostra();
  const devolver = useDevolverAmostra();
  const { data: fotos = [], refetch: refetchFotos } = useAmostraFotos(amostra.id);
  const qc = useQueryClient();
  const [showDevolucao, setShowDevolucao] = useState(false);

  const [dataRecebimento, setDataRecebimento] = useState(amostra.data_recebimento?.split("T")[0] || "");
  const [qtdUnidades, setQtdUnidades] = useState(amostra.qtd_unidades?.toString() || "");
  const [qtdCores, setQtdCores] = useState(amostra.qtd_cores?.toString() || "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    amostra.checklist_resultado?.length > 0
      ? amostra.checklist_resultado
      : CHECKLIST_ITEMS.map(i => ({ key: i.key, label: i.label, resultado: null, observacao: "" }))
  );
  const [instrucao, setInstrucao] = useState(amostra.instrucao_correcao || "");
  const [prazo, setPrazo] = useState(amostra.prazo_reenvio?.split("T")[0] || "");

  // Evidence counts
  const fotoCount = fotos.filter(f => f.tipo === "foto").length;
  const videoCount = fotos.filter(f => f.tipo === "video").length;
  const fotosOk = fotoCount >= 3;
  const videoOk = videoCount >= 1;
  const evidenciasOk = fotosOk && videoOk;

  // Checklist validation
  const allChecked = checklist.every(c => c.resultado !== null);
  const allConformes = checklist.every(c => c.resultado === "conforme");
  const ncItems = checklist.filter(c => c.resultado === "nao_conforme");
  const ncWithObs = ncItems.every(c => c.observacao && c.observacao.trim().length > 0);

  const handleSaveRecebimento = () => {
    updateAmostra.mutate({
      id: amostra.id,
      data_recebimento: dataRecebimento || null,
      qtd_unidades: qtdUnidades ? parseInt(qtdUnidades) : null,
      qtd_cores: qtdCores ? parseInt(qtdCores) : null,
      status: "recebida",
    } as any);
    toast.success("Recebimento registrado");
  };

  const handleSaveChecklist = () => {
    updateAmostra.mutate({
      id: amostra.id,
      checklist_resultado: checklist,
      status: "em_avaliacao",
    } as any);
    toast.success("Checklist salvo");
  };

  const handleAprovar = () => {
    if (!evidenciasOk) { toast.error("Envie pelo menos 3 fotos e 1 vídeo"); return; }
    if (!allConformes) { toast.error("Todos os itens devem estar Conformes para aprovar"); return; }
    aprovar.mutate({ id: amostra.id });
  };

  const handleReprovar = () => {
    if (!instrucao.trim()) { toast.error("Instrução de correção é obrigatória"); return; }
    if (!ncWithObs) { toast.error("Todos os itens Não Conformes precisam de observação"); return; }
    reprovar.mutate({ id: amostra.id, instrucao_correcao: instrucao, prazo_reenvio: prazo || undefined });
  };

  const isReadOnly = amostra.status === "aprovada" || amostra.status === "reprovada";

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="recebimento">Recebimento</TabsTrigger>
        <TabsTrigger value="evidencias">
          Evidências
          {!evidenciasOk && <AlertTriangle className="h-3 w-3 ml-1 text-warning" />}
        </TabsTrigger>
        <TabsTrigger value="checklist">Checklist</TabsTrigger>
        <TabsTrigger value="resultado">Resultado</TabsTrigger>
      </TabsList>

      {/* Tab: Recebimento */}
      <TabsContent value="recebimento" className="mt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Registro de Recebimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data de Recebimento</Label>
                <Input type="date" value={dataRecebimento} onChange={e => setDataRecebimento(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº Unidades Recebidas</Label>
                <Input type="number" value={qtdUnidades} onChange={e => setQtdUnidades(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº Cores/Variações</Label>
                <Input type="number" value={qtdCores} onChange={e => setQtdCores(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
            {!isReadOnly && (
              <Button size="sm" onClick={handleSaveRecebimento} disabled={updateAmostra.isPending || !dataRecebimento}>
                Registrar Recebimento
              </Button>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Evidências */}
      <TabsContent value="evidencias" className="mt-4">
        <EvidenciasPanel amostraId={amostra.id} fotos={fotos} refetch={refetchFotos} readOnly={isReadOnly} />
      </TabsContent>

      {/* Tab: Checklist */}
      <TabsContent value="checklist" className="mt-4">
        {!evidenciasOk && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-warning/10 border border-warning/30">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-xs text-warning">
              Envie pelo menos 3 fotos e 1 vídeo antes de avaliar o checklist
              ({fotoCount}/3 fotos, {videoCount}/1 vídeo)
            </span>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklist de Conferência Física</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item, idx) => (
              <ChecklistRow
                key={item.key}
                item={item}
                disabled={!evidenciasOk || isReadOnly}
                onUpdate={(updates) => {
                  setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c));
                }}
                amostraId={amostra.id}
                refetchFotos={refetchFotos}
              />
            ))}
            {!isReadOnly && (
              <Button size="sm" onClick={handleSaveChecklist} disabled={!evidenciasOk || updateAmostra.isPending}>
                Salvar Checklist
              </Button>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Resultado */}
      <TabsContent value="resultado" className="mt-4">
        <div className="space-y-4">
          {/* Status atual */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              {(() => {
                const si = STATUS_MAP[amostra.status] || STATUS_MAP.aguardando_envio;
                const Icon = si.icon;
                return (
                  <>
                    <Icon className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{si.label}</p>
                      <p className="text-xs text-muted-foreground">{amostra.numero_rodada}ª Rodada</p>
                    </div>
                    <Badge variant={si.variant as any} className="ml-auto">{si.label}</Badge>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {!isReadOnly && allChecked && evidenciasOk && (
            <>
              {allConformes ? (
                <Card className="border-success">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <span className="font-medium text-success">Todos os itens conformes — pronto para aprovar</span>
                    </div>
                    <Button onClick={handleAprovar} disabled={aprovar.isPending} className="bg-success hover:bg-success/90">
                      <CheckCircle2 className="h-4 w-4 mr-2" />Aprovar Amostra
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-destructive">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <span className="font-medium text-destructive">{ncItems.length} item(ns) Não Conforme(s)</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      {ncItems.map(nc => (
                        <div key={nc.key} className="p-2 rounded bg-destructive/5 border border-destructive/20">
                          <p className="font-medium">{nc.label}</p>
                          {nc.observacao && <p className="text-muted-foreground mt-0.5">📝 {nc.observacao}</p>}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Instrução de Correção (obrigatório)</Label>
                      <Textarea value={instrucao} onChange={e => setInstrucao(e.target.value)} rows={3} placeholder="Descreva as correções necessárias..." />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Prazo de Reenvio</Label>
                      <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
                    </div>
                    <Button variant="destructive" onClick={handleReprovar} disabled={reprovar.isPending || !instrucao.trim()}>
                      <Send className="h-4 w-4 mr-2" />Devolver para China
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Devolução info (read-only) */}
          {amostra.status === "reprovada" && amostra.instrucao_correcao && (
            <Card className="border-destructive">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-semibold text-destructive">Devolvido para China</p>
                <p className="text-xs">{amostra.instrucao_correcao}</p>
                {amostra.prazo_reenvio && (
                  <p className="text-[10px] text-muted-foreground">Prazo: {new Date(amostra.prazo_reenvio).toLocaleDateString("pt-BR")}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ── Evidências Panel ──

function EvidenciasPanel({ amostraId, fotos, refetch, readOnly }: { amostraId: string; fotos: any[]; refetch: () => void; readOnly: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [angleType, setAngleType] = useState("frente");
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const fotoItems = fotos.filter(f => f.tipo === "foto");
  const videoItems = fotos.filter(f => f.tipo === "video");

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAmostraFile(amostraId, file, angleType, "foto");
      }
      refetch();
      toast.success("Foto(s) enviada(s)");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
    }
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("Vídeo máx. 50MB"); return; }
    setUploading(true);
    try {
      await uploadAmostraFile(amostraId, file, "demonstracao", "video");
      refetch();
      toast.success("Vídeo enviado");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Camera className={`h-5 w-5 ${fotoItems.length >= 3 ? "text-success" : "text-destructive"}`} />
            <div>
              <p className="text-sm font-medium">{fotoItems.length}/3 Fotos</p>
              <p className="text-[10px] text-muted-foreground">Mínimo 3 obrigatórias</p>
            </div>
            {fotoItems.length >= 3 ? <CheckCircle2 className="h-4 w-4 text-success ml-auto" /> : <AlertTriangle className="h-4 w-4 text-warning ml-auto" />}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Video className={`h-5 w-5 ${videoItems.length >= 1 ? "text-success" : "text-destructive"}`} />
            <div>
              <p className="text-sm font-medium">{videoItems.length}/1 Vídeo</p>
              <p className="text-[10px] text-muted-foreground">Mínimo 1 obrigatório (máx 60s)</p>
            </div>
            {videoItems.length >= 1 ? <CheckCircle2 className="h-4 w-4 text-success ml-auto" /> : <AlertTriangle className="h-4 w-4 text-warning ml-auto" />}
          </CardContent>
        </Card>
      </div>

      {/* Upload controls */}
      {!readOnly && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-end gap-3">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Ângulo da Foto</Label>
                <Select value={angleType} onValueChange={setAngleType}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANGLE_TYPES.filter(a => a.value !== "evidencia_nc").map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => fotoInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
                Enviar Foto
              </Button>
              <Button size="sm" variant="outline" onClick={() => videoInputRef.current?.click()} disabled={uploading}>
                <Video className="h-4 w-4 mr-1" />Enviar Vídeo
              </Button>
            </div>
            <input ref={fotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUploadFoto} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleUploadVideo} />
          </CardContent>
        </Card>
      )}

      {/* Gallery */}
      {fotoItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">📸 Fotos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {fotoItems.map(f => (
                <div key={f.id} className="relative group">
                  <img src={f.arquivo_url} alt={f.angle_type} className="w-full h-32 object-cover rounded-lg border" />
                  <Badge className="absolute bottom-1 left-1 text-[9px]" variant="secondary">
                    {ANGLE_TYPES.find(a => a.value === f.angle_type)?.label || f.angle_type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {videoItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">🎥 Vídeos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {videoItems.map(v => (
                <video key={v.id} src={v.arquivo_url} controls className="w-full rounded-lg border" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Checklist Row ──

function ChecklistRow({ item, disabled, onUpdate, amostraId, refetchFotos }: {
  item: ChecklistItem; disabled: boolean;
  onUpdate: (updates: Partial<ChecklistItem>) => void;
  amostraId: string; refetchFotos: () => void;
}) {
  const fotoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const foto = await uploadAmostraFile(amostraId, file, "evidencia_nc", "foto", item.key);
      onUpdate({ foto_evidencia_id: foto.id });
      refetchFotos();
      toast.success("Evidência anexada");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-3 rounded-lg border bg-card space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">{item.label}</p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={item.resultado === "conforme" ? "default" : "outline"}
            className="text-[10px] h-7 px-2"
            disabled={disabled}
            onClick={() => onUpdate({ resultado: "conforme" })}
          >
            ✅ Conforme
          </Button>
          <Button
            size="sm"
            variant={item.resultado === "nao_conforme" ? "destructive" : "outline"}
            className="text-[10px] h-7 px-2"
            disabled={disabled}
            onClick={() => onUpdate({ resultado: "nao_conforme" })}
          >
            ❌ Não Conforme
          </Button>
        </div>
      </div>

      {item.resultado === "nao_conforme" && (
        <div className="space-y-2 pl-2 border-l-2 border-destructive/30">
          <Textarea
            className="text-xs"
            rows={2}
            placeholder="Observação obrigatória..."
            value={item.observacao || ""}
            onChange={e => onUpdate({ observacao: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => fotoRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Camera className="h-3 w-3 mr-1" />}
              Foto de Evidência
            </Button>
            {item.foto_evidencia_id && <Badge variant="success" className="text-[9px]">✅ Anexada</Badge>}
          </div>
          <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleUploadEvidence} />
        </div>
      )}
    </div>
  );
}

// ── Image Timeline ──

function ImageTimeline({ amostras }: { amostras: Amostra[] }) {
  const stages = [
    { key: "china_source", label: "China Source", color: "bg-destructive" },
    { key: "analise", label: "Análise", color: "bg-warning" },
    { key: "desenvolvimento", label: "Desenvolvimento", color: "bg-primary" },
    { key: "aprovado", label: "Aprovado", color: "bg-success" },
    { key: "marketing", label: "Marketing", color: "bg-accent" },
  ];

  const aprovada = amostras.find(a => a.status === "aprovada");
  const currentStage = aprovada ? "aprovado" : amostras.length > 0 ? "desenvolvimento" : "china_source";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Image Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1">
          {stages.map((stage, idx) => {
            const isActive = stages.findIndex(s => s.key === currentStage) >= idx;
            return (
              <div key={stage.key} className="flex items-center gap-1 flex-1">
                <div className={`flex-1 h-2 rounded-full ${isActive ? stage.color : "bg-muted"} transition-colors`} />
                <span className={`text-[9px] whitespace-nowrap ${isActive ? "font-semibold" : "text-muted-foreground"}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
