import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  FlaskConical, Plus, Trash2, Save, Send, AlertTriangle,
  CheckCircle2, XCircle, AlertCircle, Search, ArrowLeft, FileText, RotateCcw
} from "lucide-react";
import {
  useComposicaoBySubmissao, useUpsertComposicao, useDeleteComposicaoItem,
  useSubmeterComposicao, useComposicaoVersoes, useDevolverComposicao, validarPercentuais,
  FUNCAO_OPTIONS, STATUS_ANVISA_OPTIONS,
  type Composicao,
} from "@/hooks/useComposicao";
import { DevolucaoEtapaDialog, type DevolucaoResult } from "@/components/shared/DevolucaoEtapaDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { cn } from "@/lib/utils";

// Fetch submissões for listing
function useSubmissoes() {
  return useQuery({
    queryKey: ["submissoes_composicao"],
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
}

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"; label: string }> = {
  rascunho: { variant: "secondary", label: "Rascunho" },
  submetido: { variant: "warning", label: "Submetido" },
  aprovado: { variant: "success", label: "Aprovado" },
  em_revisao: { variant: "default", label: "Em Revisão" },
};

export default function ChecklistComposicao() {
  const navigate = useNavigate();
  const [selectedSubmissao, setSelectedSubmissao] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data: submissoes = [], isLoading: loadingSub } = useSubmissoes();

  const filtered = submissoes.filter(s =>
    !search || s.produto_nome?.toLowerCase().includes(search.toLowerCase()) || s.produto_codigo?.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedSubmissao) {
    return <ComposicaoEditor submissaoId={selectedSubmissao} onBack={() => setSelectedSubmissao(null)} />;
  }

  // KPIs
  const total = submissoes.length;
  const submetidos = submissoes.filter(s => s.status === "submetido").length;
  const aprovados = submissoes.filter(s => s.status === "aprovado").length;
  const rascunhos = submissoes.filter(s => s.status === "rascunho" || !s.status).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb moduleName="Composição INCI" moduleHref="/dashboard/composicao" currentPage="Checklist" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Checklist Composição</h1>
            <p className="text-muted-foreground mt-1">Gerencie composições INCI e peticionamento ANVISA</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: total, icon: FlaskConical, color: "text-primary" },
            { label: "Rascunhos", value: rascunhos, icon: FileText, color: "text-muted-foreground" },
            { label: "Submetidos", value: submetidos, icon: Send, color: "text-warning" },
            { label: "Aprovados", value: aprovados, icon: CheckCircle2, color: "text-success" },
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

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {filtered.map(sub => {
            const badge = STATUS_BADGE[sub.status] || STATUS_BADGE.rascunho;
            return (
              <Card key={sub.id} className="border-l-4 border-l-primary cursor-pointer active:scale-[0.99] transition-all" onClick={() => setSelectedSubmissao(sub.id)}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{sub.produto_nome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{sub.produto_codigo}</p>
                    </div>
                    <Badge variant={badge.variant} className="text-[10px] shrink-0">{badge.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-[1fr_140px_120px_120px] gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <span>Produto</span>
            <span>Status</span>
            <span>SKU</span>
            <span>Criado em</span>
          </div>
          {filtered.map(sub => {
            const badge = STATUS_BADGE[sub.status] || STATUS_BADGE.rascunho;
            const initial = (sub.produto_nome || "P")[0].toUpperCase();
            return (
              <div
                key={sub.id}
                className="grid grid-cols-[1fr_140px_120px_120px] gap-4 px-5 py-3 items-center border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setSelectedSubmissao(sub.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-xs">{initial}</span>
                  </div>
                  <p className="font-medium text-sm truncate">{sub.produto_nome}</p>
                </div>
                <Badge variant={badge.variant} className="w-fit text-[10px]">{badge.label}</Badge>
                <span className="text-xs font-mono text-muted-foreground">{sub.produto_codigo}</span>
                <span className="text-[11px] text-muted-foreground">
                  {sub.created_at ? new Date(sub.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
            );
          })}
          {!loadingSub && filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma submissão encontrada</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ── Editor de Composição ──

function ComposicaoEditor({ submissaoId, onBack }: { submissaoId: string; onBack: () => void }) {
  const [tab, setTab] = useState("composicao");
  const { data: items = [], isLoading } = useComposicaoBySubmissao(submissaoId);
  const { data: versoes = [] } = useComposicaoVersoes(submissaoId);
  const upsert = useUpsertComposicao();
  const deleteItem = useDeleteComposicaoItem();
  const submeter = useSubmeterComposicao();
  const devolver = useDevolverComposicao();
  const [localItems, setLocalItems] = useState<Partial<Composicao>[]>([]);
  const [cores, setCores] = useState<string[]>(["1#"]);
  const [showDevolucao, setShowDevolucao] = useState(false);

  // Sync from DB
  useEffect(() => {
    if (items.length > 0) {
      setLocalItems(items);
      const allCores = new Set<string>();
      items.forEach(i => Object.keys(i.percentual_por_cor || {}).forEach(k => allCores.add(k)));
      if (allCores.size > 0) setCores(Array.from(allCores).sort());
    }
  }, [items]);

  const validacao = validarPercentuais(localItems as Composicao[]);
  const todasCoresValidas = validacao.length > 0 && validacao.every(v => v.valido);
  const currentVersion = versoes.length > 0 ? versoes[0].versao : 1;

  const addIngrediente = () => {
    const percs: Record<string, number> = {};
    cores.forEach(c => { percs[c] = 0; });
    setLocalItems(prev => [...prev, {
      submissao_id: submissaoId,
      versao: currentVersion,
      nome_chines: "",
      inci_name: "",
      cas_no: "",
      funcao: "outros",
      percentual_por_cor: percs,
      status_anvisa: "pendente",
    }]);
  };

  const addCor = () => {
    const nextNum = cores.length + 1;
    const newCor = `${nextNum}#`;
    setCores(prev => [...prev, newCor]);
    setLocalItems(prev => prev.map(item => ({
      ...item,
      percentual_por_cor: { ...(item.percentual_por_cor || {}), [newCor]: 0 },
    })));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setLocalItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const updatePerc = (idx: number, cor: string, value: number) => {
    setLocalItems(prev => prev.map((item, i) => i === idx ? {
      ...item,
      percentual_por_cor: { ...(item.percentual_por_cor || {}), [cor]: value },
    } : item));
  };

  const removeItem = (idx: number) => {
    const item = localItems[idx];
    if (item.id) deleteItem.mutate(item.id);
    setLocalItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const toSave = localItems.map(item => ({
      ...item,
      versao: currentVersion,
    }));
    upsert.mutate(toSave as any);
  };

  const handleSubmit = () => {
    if (!todasCoresValidas) {
      toast.error("Soma dos percentuais deve ser 100% em todas as cores");
      return;
    }
    handleSave();
    submeter.mutate({ submissaoId, versao: currentVersion });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="p-2 rounded-lg bg-primary/10">
          <FlaskConical className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Composição INCI</h1>
          <p className="text-xs text-muted-foreground">Versão {currentVersion}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="composicao">Composição</TabsTrigger>
          <TabsTrigger value="regulatorio">Análise Regulatória</TabsTrigger>
          <TabsTrigger value="peticionamento">Peticionamento</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="composicao" className="mt-4">
          <ComposicaoTable
            items={localItems}
            cores={cores}
            validacao={validacao}
            onUpdateItem={updateItem}
            onUpdatePerc={updatePerc}
            onRemoveItem={removeItem}
            onAddIngrediente={addIngrediente}
            onAddCor={addCor}
          />

          {/* Validation summary */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-2">Validação de Percentuais</h3>
              <div className="flex flex-wrap gap-2">
                {validacao.map(v => (
                  <Badge
                    key={v.corKey}
                    variant={v.valido ? "success" : "destructive"}
                    className="text-xs"
                  >
                    {v.valido ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                    {v.corKey}: {v.soma}%
                  </Badge>
                ))}
                {validacao.length === 0 && <span className="text-xs text-muted-foreground">Adicione ingredientes para validar</span>}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              <Save className="h-4 w-4 mr-2" />Salvar Rascunho
            </Button>
            <Button onClick={handleSubmit} disabled={!todasCoresValidas || submeter.isPending} variant="default">
              <Send className="h-4 w-4 mr-2" />Submeter para Regulatório
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="regulatorio" className="mt-4">
          <RegulatorioReview submissaoId={submissaoId} />
        </TabsContent>

        <TabsContent value="peticionamento" className="mt-4">
          <PeticionamentoPanel submissaoId={submissaoId} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoVersoes versoes={versoes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tabela de composição ──

function ComposicaoTable({
  items, cores, validacao, onUpdateItem, onUpdatePerc, onRemoveItem, onAddIngrediente, onAddCor,
}: {
  items: Partial<Composicao>[];
  cores: string[];
  validacao: { corKey: string; soma: number; valido: boolean }[];
  onUpdateItem: (idx: number, field: string, value: any) => void;
  onUpdatePerc: (idx: number, cor: string, value: number) => void;
  onRemoveItem: (idx: number) => void;
  onAddIngrediente: () => void;
  onAddCor: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Ingredientes</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onAddCor}>
              <Plus className="h-3 w-3 mr-1" />Cor
            </Button>
            <Button size="sm" onClick={onAddIngrediente}>
              <Plus className="h-3 w-3 mr-1" />Ingrediente
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">Nome Chinês</th>
                <th className="p-2 text-left font-medium text-muted-foreground">INCI Name</th>
                <th className="p-2 text-left font-medium text-muted-foreground">CAS NO</th>
                <th className="p-2 text-left font-medium text-muted-foreground">Função</th>
                {cores.map(cor => {
                  const v = validacao.find(x => x.corKey === cor);
                  return (
                    <th key={cor} className="p-2 text-center font-medium text-muted-foreground min-w-[70px]">
                      <span className={v && !v.valido ? "text-destructive font-bold" : ""}>{cor} %</span>
                    </th>
                  );
                })}
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-1">
                    <Input className="h-7 text-xs" value={item.nome_chines || ""} onChange={e => onUpdateItem(idx, "nome_chines", e.target.value)} placeholder="中文名" />
                  </td>
                  <td className="p-1">
                    <Input className="h-7 text-xs" value={item.inci_name || ""} onChange={e => onUpdateItem(idx, "inci_name", e.target.value)} placeholder="INCI Name" />
                  </td>
                  <td className="p-1">
                    <Input className="h-7 text-xs w-28" value={item.cas_no || ""} onChange={e => onUpdateItem(idx, "cas_no", e.target.value)} placeholder="CAS" />
                  </td>
                  <td className="p-1">
                    <Select value={item.funcao || "outros"} onValueChange={v => onUpdateItem(idx, "funcao", v)}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FUNCAO_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  {cores.map(cor => (
                    <td key={cor} className="p-1">
                      <Input
                        className="h-7 text-xs text-center w-16"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.percentual_por_cor?.[cor] ?? 0}
                        onChange={e => onUpdatePerc(idx, cor, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  ))}
                  <td className="p-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveItem(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="bg-muted/50 font-medium">
                <td colSpan={4} className="p-2 text-right text-xs">Total:</td>
                {cores.map(cor => {
                  const v = validacao.find(x => x.corKey === cor);
                  return (
                    <td key={cor} className={`p-2 text-center text-xs ${v && !v.valido ? "text-destructive font-bold" : "text-success"}`}>
                      {v?.soma ?? 0}%
                    </td>
                  );
                })}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Análise Regulatória ──

import { useUpdateComposicaoStatus, useAjustarPercentual } from "@/hooks/useComposicao";

function RegulatorioReview({ submissaoId }: { submissaoId: string }) {
  const { data: items = [] } = useComposicaoBySubmissao(submissaoId);
  const updateStatus = useUpdateComposicaoStatus();
  const ajustar = useAjustarPercentual();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [obs, setObs] = useState("");

  const statusCounts = {
    conforme: items.filter(i => i.status_anvisa === "conforme").length,
    atencao: items.filter(i => i.status_anvisa === "atencao").length,
    restrito: items.filter(i => i.status_anvisa === "restrito").length,
    pendente: items.filter(i => i.status_anvisa === "pendente").length,
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Conforme", value: statusCounts.conforme, icon: CheckCircle2, color: "text-success" },
          { label: "Atenção", value: statusCounts.atencao, icon: AlertCircle, color: "text-warning" },
          { label: "Restrito", value: statusCounts.restrito, icon: XCircle, color: "text-destructive" },
          { label: "Pendente", value: statusCounts.pendente, icon: AlertTriangle, color: "text-muted-foreground" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <div>
                <p className="text-lg font-bold">{k.value}</p>
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Items list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ingredientes para Análise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.map(item => {
              const statusInfo = STATUS_ANVISA_OPTIONS.find(s => s.value === item.status_anvisa);
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <span className="text-lg">{statusInfo?.icon || "⏳"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.inci_name}</p>
                    <p className="text-[10px] text-muted-foreground">CAS: {item.cas_no || "—"} • {FUNCAO_OPTIONS.find(f => f.value === item.funcao)?.label || item.funcao}</p>
                    {item.observacao_anvisa && <p className="text-[10px] text-warning mt-0.5">📝 {item.observacao_anvisa}</p>}
                  </div>
                  <div className="flex gap-1">
                    {STATUS_ANVISA_OPTIONS.filter(s => s.value !== "pendente").map(s => (
                      <Button
                        key={s.value}
                        size="sm"
                        variant={item.status_anvisa === s.value ? "default" : "outline"}
                        className="text-[10px] h-7 px-2"
                        onClick={() => {
                          if (s.value === "restrito" || s.value === "atencao") {
                            setSelectedItem(item.id);
                            setObs(item.observacao_anvisa || "");
                          } else {
                            updateStatus.mutate({ id: item.id, status_anvisa: s.value });
                          }
                        }}
                      >
                        {s.icon} {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Observation dialog inline */}
      {selectedItem && (
        <Card className="border-warning">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Observação ANVISA (obrigatória)</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="Detalhe a restrição ou atenção..." />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={!obs.trim()}
                onClick={() => {
                  updateStatus.mutate({ id: selectedItem, status_anvisa: "restrito", observacao_anvisa: obs });
                  setSelectedItem(null);
                  setObs("");
                }}
              >
                ❌ Marcar Restrito
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!obs.trim()}
                onClick={() => {
                  updateStatus.mutate({ id: selectedItem, status_anvisa: "atencao", observacao_anvisa: obs });
                  setSelectedItem(null);
                  setObs("");
                }}
              >
                ⚠️ Marcar Atenção
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedItem(null); setObs(""); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Peticionamento Panel ──

import { useGateCriacao, usePeticionamento, useCreatePeticionamento, useUpdatePeticionamento } from "@/hooks/useComposicao";

function PeticionamentoPanel({ submissaoId }: { submissaoId: string }) {
  const { data: gate } = useGateCriacao(submissaoId);
  const { data: petic } = usePeticionamento(submissaoId);
  const createPetic = useCreatePeticionamento();
  const updatePetic = useUpdatePeticionamento();

  const [tipoGrau, setTipoGrau] = useState(petic?.tipo_grau || "grau_1");
  const [processo, setProcesso] = useState(petic?.numero_processo || "");
  const [dataEnvio, setDataEnvio] = useState(petic?.data_envio?.split("T")[0] || "");
  const [taxa, setTaxa] = useState(petic?.taxa?.toString() || "");
  const [observacoes, setObservacoes] = useState(petic?.observacoes || "");

  // Sync from DB
  useMemo(() => {
    if (petic) {
      setTipoGrau(petic.tipo_grau);
      setProcesso(petic.numero_processo || "");
      setDataEnvio(petic.data_envio?.split("T")[0] || "");
      setTaxa(petic.taxa?.toString() || "");
      setObservacoes(petic.observacoes || "");
    }
  }, [petic]);

  const composicaoOk = gate?.composicao_ok || false;
  const arteOk = gate?.arte_primaria_ok || false;
  const ambosOk = composicaoOk && arteOk;

  // Auto-create peticionamento when gate is complete
  const shouldCreate = ambosOk && !petic;

  const handleCreate = () => {
    createPetic.mutate({ submissao_id: submissaoId, tipo_grau: tipoGrau });
  };

  const handleSave = () => {
    if (!petic) return;
    updatePetic.mutate({
      id: petic.id,
      tipo_grau: tipoGrau,
      numero_processo: processo || null,
      data_envio: dataEnvio || null,
      taxa: taxa ? parseFloat(taxa) : null,
      observacoes: observacoes || null,
    });
  };

  const handleEnviarAnvisa = () => {
    if (!petic || !ambosOk) return;
    updatePetic.mutate({
      id: petic.id,
      status: tipoGrau === "grau_1" ? "notificado" : "em_analise",
      data_envio: new Date().toISOString(),
      numero_processo: processo,
      tipo_grau: tipoGrau,
      taxa: taxa ? parseFloat(taxa) : null,
      observacoes: observacoes || null,
    });
    toast.success(tipoGrau === "grau_1" ? "Notificação enviada (Grau 1)" : "Registro enviado para análise ANVISA (Grau 2)");
  };

  return (
    <div className="space-y-4">
      {/* Gate checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Gate de Liberação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            {composicaoOk ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
            <div>
              <p className="text-sm font-medium">📄 Composição INCI</p>
              <p className="text-[10px] text-muted-foreground">Ficha validada pelo Regulatório</p>
            </div>
            <Badge variant={composicaoOk ? "success" : "destructive"} className="ml-auto text-[10px]">
              {composicaoOk ? "Aprovado" : "Pendente"}
            </Badge>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            {arteOk ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
            <div>
              <p className="text-sm font-medium">📦 Embalagem</p>
              <p className="text-[10px] text-muted-foreground">Checklist completo + arte + material plástico</p>
            </div>
            <Badge variant={arteOk ? "success" : "destructive"} className="ml-auto text-[10px]">
              {arteOk ? "Aprovado" : "Pendente"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Peticionamento form */}
      {shouldCreate && (
        <Card className="border-primary">
          <CardContent className="p-4 text-center space-y-3">
            <FileText className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm font-medium">Gate completo! Criar tarefa de Peticionamento ANVISA.</p>
            <Button onClick={handleCreate} disabled={createPetic.isPending}>Criar Peticionamento</Button>
          </CardContent>
        </Card>
      )}

      {petic && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Dados do Peticionamento</CardTitle>
              <Badge variant={petic.status === "aguardando_dossie" ? "secondary" : petic.status === "aprovado" ? "success" : "default"}>
                {petic.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Produto ANVISA</Label>
                <Select value={tipoGrau} onValueChange={setTipoGrau}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grau_1">Grau 1 — Notificação</SelectItem>
                    <SelectItem value="grau_2">Grau 2 — Registro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº Processo ANVISA</Label>
                <Input value={processo} onChange={e => setProcesso(e.target.value)} placeholder="25351.xxx/2026" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Envio</Label>
                <Input type="date" value={dataEnvio} onChange={e => setDataEnvio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa ANVISA (R$)</Label>
                <Input type="number" step="0.01" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações Regulatórias</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
            </div>

            {tipoGrau === "grau_2" && petic.status !== "aprovado" && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-xs text-warning">Grau 2: Avanço para Cadastro Final bloqueado até aprovação ANVISA</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={updatePetic.isPending}>
                <Save className="h-4 w-4 mr-2" />Salvar
              </Button>
              <Button
                size="sm"
                onClick={handleEnviarAnvisa}
                disabled={!ambosOk || updatePetic.isPending || petic.status !== "aguardando_dossie"}
              >
                <Send className="h-4 w-4 mr-2" />Enviar para ANVISA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Histórico de versões ──

function HistoricoVersoes({ versoes }: { versoes: any[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Histórico de Versões</CardTitle>
      </CardHeader>
      <CardContent>
        {versoes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma versão registrada</p>
        ) : (
          <div className="space-y-2">
            {versoes.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Badge variant={v.status === "aprovado" ? "success" : v.status === "submetido" ? "default" : "secondary"}>
                  v{v.versao}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{v.status.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {v.submetido_em ? new Date(v.submetido_em).toLocaleDateString("pt-BR") : "Rascunho"}
                  </p>
                </div>
                {v.observacoes && <span className="text-xs text-muted-foreground">📝 {v.observacoes}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
