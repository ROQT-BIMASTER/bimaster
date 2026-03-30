import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, Loader2, CheckCircle2, XCircle, Clock, ArrowRight, ArrowLeft,
  Palette, Package, Tag, Layers, LayoutGrid, Shield, Download, Link2, FileText,
} from "lucide-react";
import { DateRangeFilter, filterByDateRange } from "@/components/shared/DateRangeFilter";
import { exportToExcel } from "@/utils/excelExport";
import {
  useFluxoArtesAgrupado, useAllFluxoArtes, useCreateFluxoArte,
  CHECKLIST_TIPOS, ETAPAS, getFluxoStatusInfo, getChecklistShort,
  type ChecklistTipo, type FluxoArte,
} from "@/hooks/useFluxoArtesMotor";

const TIPO_ICONS: Record<string, any> = {
  etiqueta_bula: Tag,
  etiqueta_fundo: Layers,
  tester: Package,
  etiqueta_teste: Tag,
  display: LayoutGrid,
};

// Hook to fetch linked submissions
function useSubmissoesVinculadas() {
  return useQuery({
    queryKey: ["china-submissoes-vinculadas-artes"],
    queryFn: async () => {
      const { data: vinculos, error: vErr } = await (supabase
        .from("china_submissao_tarefa_vinculos" as any)
        .select("submissao_id") as any);
      if (vErr) throw vErr;
      const ids = [...new Set((vinculos || []).map((v: any) => v.submissao_id))];
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("china_produto_submissoes")
        .select("id, produto_codigo, produto_nome, status, formula_codigo, ean_unidade")
        .in("id", ids as string[])
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useDocsSubmissao(submissaoId: string | null) {
  return useQuery({
    queryKey: ["china-docs-preview-artes", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos")
        .select("id, tipo_documento, label, status_revisao")
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export default function FluxoArtesMotor() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("produtos");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"vinculado" | "manual">("vinculado");
  const [searchSub, setSearchSub] = useState("");
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [newForm, setNewForm] = useState({ produto_id: "", sku: "", produto_nome: "", linha_marca: "", tipo_checklist: "etiqueta_bula" as ChecklistTipo, submissao_id: "" });

  const { data: agrupado = [], isLoading: loadingGrupo } = useFluxoArtesAgrupado();
  const { data: allFluxos = [], isLoading: loadingAll } = useAllFluxoArtes();
  const createFluxo = useCreateFluxoArte();
  const { data: submissoesVinculadas = [], isLoading: loadingSubs } = useSubmissoesVinculadas();
  const { data: docsPreview = [] } = useDocsSubmissao(selectedSub?.id || null);

  // Filter vinculos IDs for list filtering
  const { data: vinculoIds = [] } = useQuery({
    queryKey: ["china-vinculos-ids-artes"],
    queryFn: async () => {
      const { data } = await (supabase.from("china_submissao_tarefa_vinculos" as any).select("submissao_id") as any);
      return (data || []).map((v: any) => v.submissao_id) as string[];
    },
  });
  const vinculadosSet = new Set(vinculoIds);

  const filteredGrupo = agrupado.filter(g =>
    !search || g.sku.toLowerCase().includes(search.toLowerCase()) || g.produto_nome.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAll = filterByDateRange(
    allFluxos.filter(f => {
      const matchSearch = !search || f.sku.toLowerCase().includes(search.toLowerCase()) || f.produto_nome.toLowerCase().includes(search.toLowerCase());
      const matchVinculo = !f.submissao_id || vinculadosSet.has(f.submissao_id);
      return matchSearch && matchVinculo;
    }),
    "created_at", dateFrom, dateTo
  );

  const handleExportExcel = () => {
    exportToExcel(filteredAll.map(f => ({
      Documento: f.numero_documento,
      SKU: f.sku,
      Produto: f.produto_nome,
      Tipo: getChecklistShort(f.tipo_checklist),
      Etapa: getFluxoStatusInfo(f).label,
      Rodada: f.numero_rodada,
      "Criado em": f.created_at ? new Date(f.created_at).toLocaleDateString("pt-BR") : "",
    })), { filename: "motor_artes", sheetName: "Motor Artes", includeTimestamp: true });
  };

  const total = allFluxos.length;
  const emAndamento = allFluxos.filter(f => f.status_geral === "em_andamento").length;
  const aprovados = allFluxos.filter(f => f.status_geral === "aprovado" && f.etapa_atual === "af_final").length;
  const reprovados = allFluxos.filter(f => f.status_geral === "reprovado").length;

  const gatePerProduct = (fluxos: FluxoArte[]) => {
    return CHECKLIST_TIPOS.every(t => {
      const f = fluxos.find(fl => fl.tipo_checklist === t.key);
      return f?.etapa_atual === "af_final" && f?.status_geral === "aprovado";
    });
  };

  const handleSelectSub = (sub: any) => {
    setSelectedSub(sub);
    setNewForm(p => ({
      ...p,
      produto_id: sub.produto_codigo || "",
      sku: sub.produto_codigo || "",
      produto_nome: sub.produto_nome || "",
      linha_marca: sub.formula_codigo || "",
      submissao_id: sub.id,
    }));
  };

  const handleCreate = () => {
    if (!newForm.produto_id || !newForm.sku || !newForm.produto_nome) return;
    createFluxo.mutate({
      ...newForm,
      submissao_id: newForm.submissao_id || undefined,
    }, {
      onSuccess: (data) => {
        setShowCreate(false);
        setNewForm({ produto_id: "", sku: "", produto_nome: "", linha_marca: "", tipo_checklist: "etiqueta_bula", submissao_id: "" });
        setSelectedSub(null);
        setCreateMode("vinculado");
        navigate(`/dashboard/fluxo-artes/${data.id}`);
      },
    });
  };

  const filteredSubs = submissoesVinculadas.filter(s =>
    !searchSub || (s.produto_codigo || "").toLowerCase().includes(searchSub.toLowerCase()) || (s.produto_nome || "").toLowerCase().includes(searchSub.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb moduleName="Motor de Artes" moduleHref="/dashboard/fluxo-artes" currentPage="Painel" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Motor de Aprovação de Artes</h1>
              <p className="text-muted-foreground mt-1">Fluxo genérico para todos os tipos de checklist</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel} disabled={filteredAll.length === 0}>
              <Download className="h-4 w-4 mr-2" />Exportar Excel
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Checklist
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: total, icon: Palette, color: "text-primary" },
            { label: "Em Andamento", value: emAndamento, icon: Clock, color: "text-warning" },
            { label: "AF Recebida", value: aprovados, icon: CheckCircle2, color: "text-success" },
            { label: "Reprovados", value: reprovados, icon: XCircle, color: "text-destructive" },
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por SKU ou produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="produtos">Por Produto (Gate)</TabsTrigger>
            <TabsTrigger value="todos">Todos os Checklists</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-4">
            {loadingGrupo ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredGrupo.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <Palette className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum produto encontrado</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {filteredGrupo.map(group => {
                  const gateOk = gatePerProduct(group.fluxos);
                  return (
                    <Card key={group.produto_id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold">{group.sku}</span>
                            <span className="text-sm">—</span>
                            <span className="text-sm font-medium">{group.produto_nome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {gateOk ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Shield className="h-3 w-3 mr-1" />Gate Liberado ✅
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <Clock className="h-3 w-3 mr-1" />Gate Pendente
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="divide-y">
                          {CHECKLIST_TIPOS.map(tipo => {
                            const fluxo = group.fluxos.find(f => f.tipo_checklist === tipo.key);
                            const Icon = TIPO_ICONS[tipo.key] || Tag;
                            if (!fluxo) {
                              return (
                                <div key={tipo.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                  <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span>{tipo.short}</span></div>
                                  <span className="text-xs text-muted-foreground italic">Não iniciado</span>
                                </div>
                              );
                            }
                            const info = getFluxoStatusInfo(fluxo);
                            return (
                              <div key={tipo.key} className="flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => navigate(`/dashboard/fluxo-artes/${fluxo.id}`)}>
                                <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{tipo.short}</span></div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
                                  {fluxo.numero_rodada > 1 && <Badge variant="outline" className="text-[10px]">R{fluxo.numero_rodada}</Badge>}
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="todos" className="mt-4">
            {loadingAll ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredAll.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><p>Nenhum checklist encontrado</p></CardContent></Card>
            ) : (
              <>
                <div className="md:hidden space-y-2">
                  {filteredAll.map(fluxo => {
                    const info = getFluxoStatusInfo(fluxo);
                    return (
                      <Card key={fluxo.id} className="border-l-4 border-l-primary cursor-pointer active:scale-[0.99] transition-all" onClick={() => navigate(`/dashboard/fluxo-artes/${fluxo.id}`)}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{fluxo.sku} — {fluxo.produto_nome}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{fluxo.numero_documento} · {getChecklistShort(fluxo.tipo_checklist)}</p>
                            </div>
                            <span className={cn("text-[10px] font-medium shrink-0", info.color)}>{info.label}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
                  <div className="grid grid-cols-[120px_1fr_100px_120px_100px_120px] gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <span>Documento</span><span>Produto</span><span>Tipo</span><span>Etapa</span><span>Rodada</span><span>Criado em</span>
                  </div>
                  {filteredAll.map(fluxo => {
                    const info = getFluxoStatusInfo(fluxo);
                    const initial = (fluxo.produto_nome || "P")[0].toUpperCase();
                    return (
                      <div key={fluxo.id} className="grid grid-cols-[120px_1fr_100px_120px_100px_120px] gap-4 px-5 py-3 items-center border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate(`/dashboard/fluxo-artes/${fluxo.id}`)}>
                        <span className="font-mono text-xs text-muted-foreground truncate">{fluxo.numero_documento}</span>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><span className="text-primary font-bold text-xs">{initial}</span></div>
                          <div className="min-w-0"><p className="font-medium text-sm truncate">{fluxo.produto_nome}</p><p className="text-[11px] text-muted-foreground truncate">SKU: {fluxo.sku}</p></div>
                        </div>
                        <Badge variant="secondary" className="w-fit text-[10px]">{getChecklistShort(fluxo.tipo_checklist)}</Badge>
                        <span className={cn("text-xs font-medium", info.color)}>{info.label}</span>
                        <span className="text-xs text-muted-foreground">R{fluxo.numero_rodada}</span>
                        <span className="text-[11px] text-muted-foreground">{fluxo.created_at ? new Date(fluxo.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => {
        setShowCreate(open);
        if (!open) { setSelectedSub(null); setCreateMode("vinculado"); setSearchSub(""); }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Checklist de Arte</DialogTitle>
          </DialogHeader>

          <Tabs value={createMode} onValueChange={v => { setCreateMode(v as any); setSelectedSub(null); setNewForm({ produto_id: "", sku: "", produto_nome: "", linha_marca: "", tipo_checklist: newForm.tipo_checklist, submissao_id: "" }); }}>
            <TabsList className="w-full">
              <TabsTrigger value="vinculado" className="flex-1 text-xs"><Link2 className="h-3 w-3 mr-1" />Importar do Vincular China</TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 text-xs">Preenchimento Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="vinculado" className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar submissão..." value={searchSub} onChange={e => setSearchSub(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-1.5 border rounded-lg p-2">
                {loadingSubs ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : filteredSubs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma submissão vinculada encontrada</p>
                ) : filteredSubs.map(sub => (
                  <div
                    key={sub.id}
                    onClick={() => handleSelectSub(sub)}
                    className={cn(
                      "p-2.5 rounded-lg border cursor-pointer transition-all text-sm",
                      selectedSub?.id === sub.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs">{sub.produto_codigo}</span>
                      <Badge variant="outline" className="text-[10px]">{sub.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{sub.produto_nome}</p>
                    {sub.formula_codigo && <p className="text-[10px] text-muted-foreground">Fórmula: {sub.formula_codigo}</p>}
                  </div>
                ))}
              </div>

              {selectedSub && docsPreview.length > 0 && (
                <div className="border rounded-lg p-2.5 bg-muted/30">
                  <p className="text-xs font-medium mb-1.5 flex items-center gap-1"><FileText className="h-3 w-3" />Documentos vinculados ({docsPreview.length})</p>
                  <div className="space-y-1">
                    {docsPreview.slice(0, 5).map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between text-[11px]">
                        <span className="truncate">{doc.label || doc.tipo_documento}</span>
                        <Badge variant="outline" className="text-[9px]">{doc.status_revisao || "pendente"}</Badge>
                      </div>
                    ))}
                    {docsPreview.length > 5 && <p className="text-[10px] text-muted-foreground">+{docsPreview.length - 5} mais...</p>}
                  </div>
                </div>
              )}

              {selectedSub && (
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 rounded-lg p-2.5">
                  <div><span className="text-muted-foreground">SKU:</span> <span className="font-medium">{newForm.sku}</span></div>
                  <div><span className="text-muted-foreground">Produto:</span> <span className="font-medium">{newForm.produto_nome}</span></div>
                  {newForm.linha_marca && <div className="col-span-2"><span className="text-muted-foreground">Linha:</span> <span className="font-medium">{newForm.linha_marca}</span></div>}
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Produto ID</Label><Input value={newForm.produto_id} onChange={e => setNewForm(p => ({ ...p, produto_id: e.target.value }))} placeholder="ex: HB-L6526" className="h-9" /></div>
                <div><Label className="text-xs">SKU</Label><Input value={newForm.sku} onChange={e => setNewForm(p => ({ ...p, sku: e.target.value }))} placeholder="ex: HB-L6526" className="h-9" /></div>
              </div>
              <div><Label className="text-xs">Nome do Produto</Label><Input value={newForm.produto_nome} onChange={e => setNewForm(p => ({ ...p, produto_nome: e.target.value }))} placeholder="ex: Lip Oil Fresh Lips" className="h-9" /></div>
              <div><Label className="text-xs">Linha / Marca</Label><Input value={newForm.linha_marca} onChange={e => setNewForm(p => ({ ...p, linha_marca: e.target.value }))} placeholder="ex: Ruby Rose" className="h-9" /></div>
            </TabsContent>
          </Tabs>

          <div className="mt-1">
            <Label className="text-xs">Tipo de Checklist</Label>
            <Select value={newForm.tipo_checklist} onValueChange={(v) => setNewForm(p => ({ ...p, tipo_checklist: v as ChecklistTipo }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHECKLIST_TIPOS.map(t => (<SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createFluxo.isPending || !newForm.produto_id || !newForm.sku || !newForm.produto_nome}>
              {createFluxo.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}