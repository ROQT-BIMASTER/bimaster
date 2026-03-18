import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Layers, Settings2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDocWorkflowConfigs, useDocWorkflowEtapas } from "@/hooks/useDocWorkflow";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TIPOS_DOCUMENTO = [
  { value: "embalagem", label: "Embalagem" },
  { value: "rotulo", label: "Rótulo" },
  { value: "arte", label: "Arte" },
  { value: "ficha_tecnica", label: "Ficha Técnica" },
  { value: "regulatorio", label: "Regulatório" },
  { value: "outro", label: "Outro" },
];

const TIPOS_ACAO = [
  { value: "criar", label: "Criar" },
  { value: "revisar", label: "Revisar" },
  { value: "aprovar", label: "Aprovar" },
];

export default function ConfigDocWorkflows() {
  const navigate = useNavigate();
  const { configs, isLoading, addConfig, deleteConfig } = useDocWorkflowConfigs();
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState("embalagem");
  const [showNewEtapaDialog, setShowNewEtapaDialog] = useState(false);
  const [etapaNome, setEtapaNome] = useState("");
  const [etapaTipoAcao, setEtapaTipoAcao] = useState("revisar");
  const [etapaDeptId, setEtapaDeptId] = useState("");

  const { etapas, addEtapa, deleteEtapa } = useDocWorkflowEtapas(selectedConfigId);

  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos-list"],
    queryFn: async () => {
      const { data } = await supabase.from("departamentos").select("id, nome").order("nome");
      return data || [];
    },
  });

  const handleAddConfig = () => {
    if (!newNome.trim()) return;
    addConfig.mutate({ tipo_documento: newTipo, nome: newNome.trim() }, {
      onSuccess: () => {
        setShowNewDialog(false);
        setNewNome("");
      },
    });
  };

  const handleAddEtapa = () => {
    if (!etapaNome.trim() || !selectedConfigId) return;
    addEtapa.mutate({
      config_id: selectedConfigId,
      nome: etapaNome.trim(),
      departamento_responsavel_id: etapaDeptId || undefined,
      ordem: etapas.length,
      tipo_acao: etapaTipoAcao,
    }, {
      onSuccess: () => {
        setShowNewEtapaDialog(false);
        setEtapaNome("");
        setEtapaDeptId("");
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Workflows Documentais
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure os subprocessos de aprovação por tipo de documento
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: Config list */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Templates
                </span>
                <Button size="sm" variant="outline" onClick={() => setShowNewDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Novo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {configs.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConfigId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center justify-between transition-all",
                    selectedConfigId === c.id
                      ? "bg-primary/5 border-primary/30"
                      : "bg-background border-border/50 hover:bg-muted/50"
                  )}
                >
                  <div>
                    <span className="font-medium text-foreground">{c.nome}</span>
                    <Badge variant="outline" className="ml-2 text-[9px]">
                      {TIPOS_DOCUMENTO.find(t => t.value === c.tipo_documento)?.label || c.tipo_documento}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={e => {
                      e.stopPropagation();
                      deleteConfig.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </button>
              ))}
              {configs.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum workflow configurado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Right: Etapas */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Etapas do Workflow</span>
                {selectedConfigId && (
                  <Button size="sm" variant="outline" onClick={() => setShowNewEtapaDialog(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Etapa
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedConfigId ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Selecione um template para ver as etapas
                </p>
              ) : etapas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma etapa configurada. Adicione a primeira.
                </p>
              ) : (
                <div className="space-y-2">
                  {etapas.map((et, i) => {
                    const dept = departamentos.find((d: any) => d.id === et.departamento_responsavel_id);
                    return (
                      <div
                        key={et.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/30"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-bold text-muted-foreground w-6">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">{et.nome}</span>
                          {dept && (
                            <Badge variant="outline" className="ml-2 text-[9px]">
                              {(dept as any).nome}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[9px]">
                          {TIPOS_ACAO.find(a => a.value === et.tipo_acao)?.label || et.tipo_acao}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteEtapa.mutate(et.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Config Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Workflow Documental</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Ex: Aprovação de Embalagem" />
            </div>
            <div>
              <Label>Tipo de Documento</Label>
              <Select value={newTipo} onValueChange={setNewTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddConfig} disabled={addConfig.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Etapa Dialog */}
      <Dialog open={showNewEtapaDialog} onOpenChange={setShowNewEtapaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Etapa</Label>
              <Input value={etapaNome} onChange={e => setEtapaNome(e.target.value)} placeholder="Ex: Revisão Regulatório" />
            </div>
            <div>
              <Label>Tipo de Ação</Label>
              <Select value={etapaTipoAcao} onValueChange={setEtapaTipoAcao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_ACAO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento Responsável</Label>
              <Select value={etapaDeptId} onValueChange={setEtapaDeptId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {departamentos.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEtapaDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddEtapa} disabled={addEtapa.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
