import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Settings, Trash2, GripVertical, Loader2, ArrowRight,
  CheckCircle2, Users, User, Palette, Copy, Sparkles
} from "lucide-react";
import {
  useFluxoConfigs, useFluxoConfigDetail, useSaveFluxoConfig, useUpdateFluxoConfig,
  useSaveFluxoEtapa, useUpdateFluxoEtapa, useDeleteFluxoEtapa, type FluxoEtapa
} from "@/hooks/useFluxoAprovacaoArtes";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const CHECKLIST_TIPOS = [
  { value: "artes_geral", label: "Artes Geral" },
  { value: "embalagem", label: "Embalagem" },
  { value: "rotulagem", label: "Rotulagem" },
  { value: "produto", label: "Produto" },
  { value: "outro", label: "Outro" },
];

export default function FluxoAprovacaoConfig() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isManager } = useUserRole();
  const canDuplicate = isAdmin || isManager;
  const { data: configs = [], isLoading } = useFluxoConfigs();
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<{ id: string; nome: string } | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [newConfig, setNewConfig] = useState({ nome: "", checklist_tipo: "artes_geral", descricao: "" });
  const [newStage, setNewStage] = useState<Partial<FluxoEtapa>>({
    nome: "", tipo_aprovacao: "simples", ordem: 0,
  });

  const saveConfig = useSaveFluxoConfig();
  const updateConfig = useUpdateFluxoConfig();
  const saveEtapa = useSaveFluxoEtapa();
  const updateEtapa = useUpdateFluxoEtapa();
  const deleteEtapa = useDeleteFluxoEtapa();

  const { data: configDetail } = useFluxoConfigDetail(selectedConfigId || undefined);
  const etapas = configDetail?.etapas || [];

  // Get users for responsavel selection
  const { data: users = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, avatar_url").eq("aprovado", true).order("nome");
      return (data || []) as { id: string; nome: string; avatar_url: string | null }[];
    },
  });

  const handleCreateConfig = () => {
    saveConfig.mutate(newConfig, {
      onSuccess: (data) => {
        setShowNewDialog(false);
        setNewConfig({ nome: "", checklist_tipo: "artes_geral", descricao: "" });
        setSelectedConfigId((data as any).id);
      },
    });
  };

  const openDuplicateDialog = (sourceId: string, sourceName: string) => {
    if (!canDuplicate) {
      toast.error("Você não tem permissão para duplicar fluxos de aprovação.");
      return;
    }
    setDuplicateTarget({ id: sourceId, nome: sourceName });
    setDuplicateName(`${sourceName} — cópia`);
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateTarget) return;
    if (!canDuplicate) {
      toast.error("Você não tem permissão para duplicar fluxos de aprovação.");
      return;
    }
    const novoNome = duplicateName.trim();
    if (!novoNome) {
      toast.error("Informe um nome para o novo fluxo.");
      return;
    }
    setDuplicating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: novo, error: e1 } = await (supabase as any)
        .from("fluxo_aprovacao_config")
        .insert({
          nome: novoNome,
          checklist_tipo: "artes_geral",
          descricao: `Duplicado a partir de "${duplicateTarget.nome}"`,
          ativo: true,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const { data: etapasOrig, error: e2 } = await (supabase as any)
        .from("fluxo_aprovacao_etapas")
        .select("nome, ordem, tipo_aprovacao, prazo_dias, ativo")
        .eq("config_id", duplicateTarget.id)
        .order("ordem");
      if (e2) throw e2;

      if (etapasOrig?.length) {
        const { error: e3 } = await (supabase as any)
          .from("fluxo_aprovacao_etapas")
          .insert(etapasOrig.map((et: any) => ({ ...et, config_id: novo.id })));
        if (e3) throw e3;
      }
      await qc.invalidateQueries({ queryKey: ["fluxo-aprovacao-configs"] });
      setSelectedConfigId(novo.id);
      toast.success(`Fluxo "${novoNome}" criado com sucesso.`);
      setDuplicateTarget(null);
      setDuplicateName("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao duplicar fluxo.");
    } finally {
      setDuplicating(false);
    }
  };

  const handleAddStage = () => {
    if (!selectedConfigId || !newStage.nome) return;
    saveEtapa.mutate(
      {
        config_id: selectedConfigId,
        nome: newStage.nome!,
        ordem: etapas.length,
        tipo_aprovacao: newStage.tipo_aprovacao || "simples",
        responsavel_id: newStage.responsavel_id || null,
        responsavel_secundario_id: newStage.responsavel_secundario_id || null,
        destino_reprovacao_ordem: newStage.destino_reprovacao_ordem ?? null,
      },
      {
        onSuccess: () => {
          setShowStageDialog(false);
          setNewStage({ nome: "", tipo_aprovacao: "simples", ordem: 0 });
        },
      }
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/aprovacao-artes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Configuração de Fluxos</h1>
          <p className="text-sm text-muted-foreground">Defina etapas, responsáveis e regras de aprovação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Config list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Fluxos Configurados</h3>
            <Button size="sm" onClick={() => setShowNewDialog(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Novo
            </Button>
          </div>

          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
          ) : configs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhum fluxo configurado
              </CardContent>
            </Card>
          ) : (
            <>
              {configs.map(config => {
                const isModelo = config.nome === "Aprovação Padrão (Modelo)";
                return (
                  <Card
                    key={config.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedConfigId === config.id ? "border-primary" : "hover:border-primary/30",
                      isModelo && "border-primary/40 bg-primary/5"
                    )}
                    onClick={() => setSelectedConfigId(config.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isModelo && <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />}
                          <span className="font-medium text-sm truncate">{config.nome}</span>
                        </div>
                        <Badge variant={config.ativo ? "success" : "secondary"} className="text-[10px]">
                          {config.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {CHECKLIST_TIPOS.find(t => t.value === config.checklist_tipo)?.label || config.checklist_tipo}
                      </p>
                      {isModelo && canDuplicate && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[9px]">Modelo recomendado</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px]"
                            onClick={(e) => { e.stopPropagation(); openDuplicateDialog(config.id, config.nome); }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Duplicar
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>

        {/* Right: Stage editor */}
        <div className="col-span-2">
          {!selectedConfigId ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Palette className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Selecione um fluxo para editar suas etapas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Etapas do Fluxo: {configDetail?.nome}</h3>
                <Button size="sm" onClick={() => setShowStageDialog(true)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar Etapa
                </Button>
              </div>

              {/* Visual flow */}
              {etapas.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {etapas.map((etapa, i) => (
                    <div key={etapa.id} className="flex items-center gap-2">
                      <div className="rounded-lg border-2 border-primary/20 p-2 bg-primary/5 min-w-[120px] text-center">
                        <p className="text-xs font-medium">{etapa.nome}</p>
                        <Badge variant="outline" className="text-[9px] mt-1">
                          {etapa.tipo_aprovacao === "paralela" ? "Paralela" : "Simples"}
                        </Badge>
                      </div>
                      {i < etapas.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Stage cards */}
              <div className="space-y-3">
                {etapas.map((etapa, i) => (
                  <Card key={etapa.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-1 text-muted-foreground pt-1">
                          <GripVertical className="h-4 w-4" />
                          <span className="text-xs font-mono">{i + 1}</span>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{etapa.nome}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {etapa.tipo_aprovacao === "paralela" ? (
                                <><Users className="h-3 w-3 mr-1" />Paralela</>
                              ) : (
                                <><User className="h-3 w-3 mr-1" />Simples</>
                              )}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Responsável Principal</Label>
                              <Select
                                value={etapa.responsavel_id || ""}
                                onValueChange={v => updateEtapa.mutate({
                                  id: etapa.id,
                                  config_id: selectedConfigId!,
                                  responsavel_id: v || null,
                                })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Selecionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {users.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {etapa.tipo_aprovacao === "paralela" && (
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Responsável Secundário</Label>
                                <Select
                                  value={etapa.responsavel_secundario_id || ""}
                                  onValueChange={v => updateEtapa.mutate({
                                    id: etapa.id,
                                    config_id: selectedConfigId!,
                                    responsavel_secundario_id: v || null,
                                  })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Selecionar..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {users.map(u => (
                                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div>
                              <Label className="text-[10px] text-muted-foreground">Se reprovado, volta para etapa</Label>
                              <Select
                                value={etapa.destino_reprovacao_ordem?.toString() || "auto"}
                                onValueChange={v => updateEtapa.mutate({
                                  id: etapa.id,
                                  config_id: selectedConfigId!,
                                  destino_reprovacao_ordem: v === "auto" ? null : parseInt(v),
                                })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Automático (etapa anterior)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">Automático (anterior)</SelectItem>
                                  {etapas.filter(e => e.ordem < etapa.ordem).map(e => (
                                    <SelectItem key={e.id} value={e.ordem.toString()}>
                                      {e.nome} (etapa {e.ordem + 1})
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="-1">Devolver para China</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover etapa?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteEtapa.mutate({ id: etapa.id, config_id: selectedConfigId! })}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Config Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fluxo de Aprovação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do Fluxo</Label>
              <Input
                value={newConfig.nome}
                onChange={e => setNewConfig(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Aprovação Artes Geral"
              />
            </div>
            <div>
              <Label>Tipo de Checklist</Label>
              <Select
                value={newConfig.checklist_tipo}
                onValueChange={v => setNewConfig(p => ({ ...p, checklist_tipo: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHECKLIST_TIPOS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={newConfig.descricao}
                onChange={e => setNewConfig(p => ({ ...p, descricao: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateConfig} disabled={!newConfig.nome || saveConfig.isPending}>
              {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Fluxo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Stage Dialog */}
      <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da Etapa</Label>
              <Input
                value={newStage.nome || ""}
                onChange={e => setNewStage(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Pré-Cadastro"
              />
            </div>
            <div>
              <Label>Tipo de Aprovação</Label>
              <Select
                value={newStage.tipo_aprovacao || "simples"}
                onValueChange={v => setNewStage(p => ({ ...p, tipo_aprovacao: v as "simples" | "paralela" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Simples (1 aprovador)</SelectItem>
                  <SelectItem value="paralela">Paralela (2 aprovadores simultâneos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável Principal</Label>
              <Select
                value={newStage.responsavel_id || ""}
                onValueChange={v => setNewStage(p => ({ ...p, responsavel_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStage.tipo_aprovacao === "paralela" && (
              <div>
                <Label>Responsável Secundário</Label>
                <Select
                  value={newStage.responsavel_secundario_id || ""}
                  onValueChange={v => setNewStage(p => ({ ...p, responsavel_secundario_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddStage} disabled={!newStage.nome || saveEtapa.isPending}>
              {saveEtapa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate confirmation */}
      <AlertDialog
        open={!!duplicateTarget}
        onOpenChange={(open) => { if (!open && !duplicating) { setDuplicateTarget(null); setDuplicateName(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar fluxo de aprovação</AlertDialogTitle>
            <AlertDialogDescription>
              Será criado um novo fluxo a partir de "{duplicateTarget?.nome}", copiando todas as etapas. Você poderá editá-lo em seguida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Nome do novo fluxo</Label>
            <Input
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="Ex: Aprovação Personalizada"
              disabled={duplicating}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={duplicating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDuplicate(); }}
              disabled={duplicating || !duplicateName.trim()}
            >
              {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Duplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
