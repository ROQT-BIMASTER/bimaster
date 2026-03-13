import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Search, Plus, Loader2, CheckCircle2, XCircle, Clock, ArrowRight,
  Palette, Package, Tag, Layers, LayoutGrid, Shield,
} from "lucide-react";
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

export default function FluxoArtesMotor() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("produtos");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ produto_id: "", sku: "", produto_nome: "", linha_marca: "", tipo_checklist: "etiqueta_bula" as ChecklistTipo });

  const { data: agrupado = [], isLoading: loadingGrupo } = useFluxoArtesAgrupado();
  const { data: allFluxos = [], isLoading: loadingAll } = useAllFluxoArtes();
  const createFluxo = useCreateFluxoArte();

  const filteredGrupo = agrupado.filter(g =>
    !search || g.sku.toLowerCase().includes(search.toLowerCase()) || g.produto_nome.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAll = allFluxos.filter(f =>
    !search || f.sku.toLowerCase().includes(search.toLowerCase()) || f.produto_nome.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const total = allFluxos.length;
  const emAndamento = allFluxos.filter(f => f.status_geral === "em_andamento").length;
  const aprovados = allFluxos.filter(f => f.status_geral === "aprovado" && f.etapa_atual === "af_final").length;
  const reprovados = allFluxos.filter(f => f.status_geral === "reprovado").length;

  // Gate check per product
  const gatePerProduct = (fluxos: FluxoArte[]) => {
    const allComplete = CHECKLIST_TIPOS.every(t => {
      const f = fluxos.find(fl => fl.tipo_checklist === t.key);
      return f?.etapa_atual === "af_final" && f?.status_geral === "aprovado";
    });
    return allComplete;
  };

  const handleCreate = () => {
    if (!newForm.produto_id || !newForm.sku || !newForm.produto_nome) return;
    createFluxo.mutate(newForm, {
      onSuccess: (data) => {
        setShowCreate(false);
        setNewForm({ produto_id: "", sku: "", produto_nome: "", linha_marca: "", tipo_checklist: "etiqueta_bula" });
        navigate(`/dashboard/fluxo-artes/${data.id}`);
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Palette className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Motor de Aprovação de Artes</h1>
            <p className="text-sm text-muted-foreground">Fluxo genérico para todos os tipos de checklist</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Checklist
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: total, icon: Palette, color: "text-primary" },
          { label: "Em Andamento", value: emAndamento, icon: Clock, color: "text-amber-500" },
          { label: "AF Recebida", value: aprovados, icon: CheckCircle2, color: "text-green-500" },
          { label: "Reprovados", value: reprovados, icon: XCircle, color: "text-red-500" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="produtos">Por Produto (Gate)</TabsTrigger>
          <TabsTrigger value="todos">Todos os Checklists</TabsTrigger>
        </TabsList>

        {/* Grouped by product */}
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
                      {/* Product header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold">{group.sku}</span>
                          <span className="text-sm">—</span>
                          <span className="text-sm font-medium">{group.produto_nome}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {gateOk ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <Shield className="h-3 w-3 mr-1" />
                              Gate Liberado ✅
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              <Clock className="h-3 w-3 mr-1" />
                              Gate Pendente
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Type rows */}
                      <div className="divide-y">
                        {CHECKLIST_TIPOS.map(tipo => {
                          const fluxo = group.fluxos.find(f => f.tipo_checklist === tipo.key);
                          const Icon = TIPO_ICONS[tipo.key] || Tag;

                          if (!fluxo) {
                            return (
                              <div key={tipo.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Icon className="h-4 w-4" />
                                  <span>{tipo.short}</span>
                                </div>
                                <span className="text-xs text-muted-foreground italic">Não iniciado</span>
                              </div>
                            );
                          }

                          const info = getFluxoStatusInfo(fluxo);

                          return (
                            <div
                              key={tipo.key}
                              className="flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-muted/20 transition-colors"
                              onClick={() => navigate(`/dashboard/fluxo-artes/${fluxo.id}`)}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{tipo.short}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
                                {fluxo.numero_rodada > 1 && (
                                  <Badge variant="outline" className="text-[10px]">R{fluxo.numero_rodada}</Badge>
                                )}
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

        {/* All checklists flat */}
        <TabsContent value="todos" className="mt-4">
          {loadingAll ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredAll.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <p>Nenhum checklist encontrado</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredAll.map(fluxo => {
                const info = getFluxoStatusInfo(fluxo);
                const Icon = TIPO_ICONS[fluxo.tipo_checklist] || Tag;
                return (
                  <Card
                    key={fluxo.id}
                    className="cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/dashboard/fluxo-artes/${fluxo.id}`)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{fluxo.numero_documento}</span>
                          <span className="font-medium truncate">{fluxo.sku} — {fluxo.produto_nome}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {getChecklistShort(fluxo.tipo_checklist)}
                          </Badge>
                        </div>
                        <p className={`text-xs mt-0.5 ${info.color}`}>{info.label}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Checklist de Arte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Produto ID</Label>
                <Input value={newForm.produto_id} onChange={e => setNewForm(p => ({ ...p, produto_id: e.target.value }))} placeholder="ex: HB-L6526" />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={newForm.sku} onChange={e => setNewForm(p => ({ ...p, sku: e.target.value }))} placeholder="ex: HB-L6526" />
              </div>
            </div>
            <div>
              <Label>Nome do Produto</Label>
              <Input value={newForm.produto_nome} onChange={e => setNewForm(p => ({ ...p, produto_nome: e.target.value }))} placeholder="ex: Lip Oil Fresh Lips" />
            </div>
            <div>
              <Label>Linha / Marca</Label>
              <Input value={newForm.linha_marca} onChange={e => setNewForm(p => ({ ...p, linha_marca: e.target.value }))} placeholder="ex: Ruby Rose" />
            </div>
            <div>
              <Label>Tipo de Checklist</Label>
              <Select value={newForm.tipo_checklist} onValueChange={(v) => setNewForm(p => ({ ...p, tipo_checklist: v as ChecklistTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHECKLIST_TIPOS.map(t => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createFluxo.isPending}>
              {createFluxo.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
