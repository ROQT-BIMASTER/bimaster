import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Copy,
  Pencil,
  Check,
  Loader2,
  Sparkles,
  Users,
  Building2,
  Lock,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  COLUNA_ORDEM,
  DEFAULT_COLUNAS,
  type ColunaKey,
  type ColunasConfig,
} from "@/hooks/useKanbanPreferencias";
import {
  useKanbanTemplates,
  type KanbanTemplate,
  type EtapaResponsavel,
  type KanbanTemplateEscopo,
} from "@/hooks/useKanbanTemplates";
import type { KanbanPipeline } from "@/hooks/useKanbanAprovacoes";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelinesDisponiveis: KanbanPipeline[];
  onAplicar: (colunas: ColunasConfig) => void;
}

const ESCOPO_LABEL: Record<KanbanTemplateEscopo, string> = {
  pessoal: "Pessoal",
  equipe: "Equipe",
  departamento: "Departamento",
  sistema: "Sistema",
};

const ESCOPO_ICON: Record<KanbanTemplateEscopo, typeof Lock> = {
  pessoal: UserIcon,
  equipe: Users,
  departamento: Building2,
  sistema: Lock,
};

export function TemplatesManagerDialog({
  open,
  onOpenChange,
  pipelinesDisponiveis,
  onAplicar,
}: Props) {
  const { user } = useAuth();
  const { list, save, remove, duplicate } = useKanbanTemplates();
  const [editing, setEditing] = useState<KanbanTemplate | "new" | null>(null);

  const templates = list.data ?? [];
  const grupos = useMemo(() => {
    return {
      meus: templates.filter((t) => t.owner_id === user?.id && t.escopo === "pessoal"),
      equipe: templates.filter((t) => t.escopo === "equipe"),
      departamento: templates.filter((t) => t.escopo === "departamento"),
      sistema: templates.filter((t) => t.escopo === "sistema"),
    };
  }, [templates, user?.id]);

  function handleAplicar(t: KanbanTemplate) {
    onAplicar(t.colunas_config);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Templates de Kanban
            </DialogTitle>
            <DialogDescription className="text-xs">
              Use templates do sistema, da sua equipe ou crie os seus próprios — com
              responsáveis por etapa.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {templates.length} template{templates.length === 1 ? "" : "s"} disponíveis
            </p>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo template
            </Button>
          </div>

          <Tabs defaultValue="meus" className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="meus" className="text-xs">
                Meus ({grupos.meus.length})
              </TabsTrigger>
              <TabsTrigger value="equipe" className="text-xs">
                Equipe ({grupos.equipe.length})
              </TabsTrigger>
              <TabsTrigger value="departamento" className="text-xs">
                Departamento ({grupos.departamento.length})
              </TabsTrigger>
              <TabsTrigger value="sistema" className="text-xs">
                Sistema ({grupos.sistema.length})
              </TabsTrigger>
            </TabsList>

            {(["meus", "equipe", "departamento", "sistema"] as const).map((k) => (
              <TabsContent key={k} value={k} className="flex-1 mt-3 min-h-0">
                <ScrollArea className="h-[420px] pr-3">
                  <TemplateList
                    templates={grupos[k]}
                    canEdit={k !== "sistema"}
                    onAplicar={handleAplicar}
                    onEdit={(t) => setEditing(t)}
                    onDelete={(id) => remove.mutate(id)}
                    onDuplicate={(id) => duplicate.mutate(id)}
                    currentUserId={user?.id}
                  />
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <TemplateEditorDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          pipelinesDisponiveis={pipelinesDisponiveis}
          template={editing === "new" ? null : editing}
          onSaved={() => setEditing(null)}
          saveMutation={save}
        />
      )}
    </>
  );
}

function TemplateList({
  templates,
  canEdit,
  currentUserId,
  onAplicar,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  templates: KanbanTemplate[];
  canEdit: boolean;
  currentUserId?: string;
  onAplicar: (t: KanbanTemplate) => void;
  onEdit: (t: KanbanTemplate) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  if (templates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-10">
        Nenhum template aqui ainda.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {
      {const confirm = useConfirm();templates.map((t) => {
        const Icon = ESCOPO_ICON[t.escopo];
        const isOwner = t.owner_id === currentUserId;
        return (
          <div
            key={t.id}
            className="rounded-md border border-border p-3 hover:border-primary/40 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs font-medium truncate">{t.nome}</p>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    {ESCOPO_LABEL[t.escopo]}
                  </Badge>
                  {t.is_padrao && (
                    <Badge className="text-[9px] px-1 py-0 h-4">padrão</Badge>
                  )}
                </div>
                {t.descricao && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {t.descricao}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t.etapas_responsaveis.length} etapa
                  {t.etapas_responsaveis.length === 1 ? "" : "s"} mapeada
                  {t.etapas_responsaveis.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-[10px]"
                  onClick={() => onAplicar(t)}
                >
                  <Check className="h-3 w-3 mr-1" /> Aplicar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onDuplicate(t.id)}
                  title="Duplicar"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {canEdit && isOwner && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onEdit(t)}
                      title="Editar"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        if ((await confirm({ title: `Remover template "${t.nome}"?`, destructive: true }))) onDelete(t.id);
                      }}
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Editor ----------

function TemplateEditorDialog({
  open,
  onOpenChange,
  pipelinesDisponiveis,
  template,
  onSaved,
  saveMutation,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelinesDisponiveis: KanbanPipeline[];
  template: KanbanTemplate | null;
  onSaved: () => void;
  saveMutation: ReturnType<typeof useKanbanTemplates>["save"];
}) {
  const isEdit = !!template;
  const [nome, setNome] = useState(template?.nome ?? "");
  const [descricao, setDescricao] = useState(template?.descricao ?? "");
  const [escopo, setEscopo] = useState<KanbanTemplateEscopo>(
    template?.escopo === "sistema" ? "pessoal" : (template?.escopo ?? "pessoal"),
  );
  const [departamentoId, setDepartamentoId] = useState<string | null>(
    template?.departamento_id ?? null,
  );
  const [equipeIds, setEquipeIds] = useState<string[]>(template?.equipe_ids ?? []);
  const [isPadrao, setIsPadrao] = useState(template?.is_padrao ?? false);
  const [colunas, setColunas] = useState<ColunasConfig>(
    template?.colunas_config ?? {},
  );
  const [pipelineRef, setPipelineRef] = useState<string | null>(null);
  const [etapas, setEtapas] = useState<EtapaResponsavel[]>(
    template?.etapas_responsaveis ?? [],
  );

  // Carrega etapas a partir do pipeline selecionado quando o usuário pedir
  function importarEtapasDoPipeline() {
    if (!pipelineRef) return;
    const p = pipelinesDisponiveis.find((x) => x.id === pipelineRef);
    if (!p) return;
    const novas: EtapaResponsavel[] = p.etapas.map((e: any) => {
      const existente = etapas.find((x) => x.etapa_label === e.nome);
      return (
        existente ?? {
          etapa_label: e.nome,
          coluna_key: "em_analise",
          responsavel_id: e.responsavel_id ?? null,
          responsavel_tipo: "user",
          sla_horas: e.sla_horas ?? null,
        }
      );
    });
    setEtapas(novas);
  }

  function setColuna(k: ColunaKey, patch: Partial<{ label: string; visivel: boolean }>) {
    setColunas((cur) => ({
      ...cur,
      [k]: { ...(cur[k] ?? DEFAULT_COLUNAS[k]), ...patch },
    }));
  }

  function setEtapa(idx: number, patch: Partial<EtapaResponsavel>) {
    setEtapas((cur) => cur.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function addEtapa() {
    setEtapas((cur) => [
      ...cur,
      {
        etapa_label: "Nova etapa",
        coluna_key: "em_analise",
        responsavel_id: null,
        responsavel_tipo: "user",
        sla_horas: null,
      },
    ]);
  }

  function removeEtapa(idx: number) {
    setEtapas((cur) => cur.filter((_, i) => i !== idx));
  }

  // profiles para selecionar responsável (usuários ativos)
  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true })
        .limit(500);
      return data ?? [];
    },
  });

  const { data: departamentos } = useQuery({
    queryKey: ["departamentos-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("departamentos" as any)
        .select("id, nome")
        .order("nome", { ascending: true });
      return ((data ?? []) as unknown) as Array<{ id: string; nome: string }>;
    },
  });

  async function salvar() {
    if (!nome.trim()) return;
    await saveMutation.mutateAsync({
      id: template?.id,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      escopo,
      departamento_id: escopo === "departamento" ? departamentoId : null,
      equipe_ids: escopo === "equipe" ? equipeIds : [],
      colunas_config: colunas,
      etapas_responsaveis: etapas,
      is_padrao: isPadrao,
    } as any);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEdit ? "Editar template" : "Novo template"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Defina o nome, o escopo de compartilhamento e os responsáveis por cada
            etapa.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Escopo</Label>
                <Select
                  value={escopo}
                  onValueChange={(v) => setEscopo(v as KanbanTemplateEscopo)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pessoal">Pessoal (só eu)</SelectItem>
                    <SelectItem value="equipe">Equipe (lista de pessoas)</SelectItem>
                    <SelectItem value="departamento">Departamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="text-xs min-h-[60px]"
                placeholder="Para que serve este template?"
              />
            </div>

            {escopo === "departamento" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Departamento</Label>
                <Select
                  value={departamentoId ?? ""}
                  onValueChange={(v) => setDepartamentoId(v || null)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departamentos ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {escopo === "equipe" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Pessoas da equipe</Label>
                <ScrollArea className="h-32 rounded-md border border-border p-2">
                  {(profiles ?? []).map((p: any) => {
                    const checked = equipeIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 px-1 py-0.5 text-xs cursor-pointer hover:bg-muted/40 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEquipeIds((cur) =>
                              cur.includes(p.id)
                                ? cur.filter((x) => x !== p.id)
                                : [...cur, p.id],
                            )
                          }
                        />
                        <span className="truncate">{p.full_name || p.email}</span>
                      </label>
                    );
                  })}
                </ScrollArea>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={isPadrao} onCheckedChange={setIsPadrao} />
              <Label className="text-xs">Definir como meu padrão</Label>
            </div>

            <Separator />

            {/* Colunas universais */}
            <div className="space-y-2">
              <Label className="text-xs">Colunas universais</Label>
              <p className="text-[10px] text-muted-foreground">
                Renomeie ou oculte colunas. A jornada específica aparece ao clicar no
                card.
              </p>
              <div className="space-y-1.5">
                {COLUNA_ORDEM.map((k) => {
                  const cfg = colunas[k] ?? DEFAULT_COLUNAS[k];
                  return (
                    <div
                      key={k}
                      className="flex items-center gap-2 rounded-md border border-border p-1.5"
                    >
                      <Switch
                        checked={cfg.visivel}
                        onCheckedChange={(v) => setColuna(k, { visivel: v })}
                      />
                      <Input
                        value={cfg.label}
                        onChange={(e) => setColuna(k, { label: e.target.value })}
                        className="h-7 text-xs flex-1"
                      />
                      <span className="text-[9px] text-muted-foreground/70 font-mono">
                        {k}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Etapas + responsáveis */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Etapas e responsáveis</Label>
                <div className="flex items-center gap-1">
                  <Select
                    value={pipelineRef ?? ""}
                    onValueChange={(v) => setPipelineRef(v || null)}
                  >
                    <SelectTrigger className="h-7 text-[10px] w-[180px]">
                      <SelectValue placeholder="Importar do pipeline…" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelinesDisponiveis.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={importarEtapasDoPipeline}
                    disabled={!pipelineRef}
                  >
                    Importar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={addEtapa}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Etapa
                  </Button>
                </div>
              </div>

              {etapas.length === 0 ? (
                <p className="text-[10px] text-muted-foreground py-2 text-center">
                  Nenhuma etapa mapeada. Importe de um pipeline ou adicione manualmente.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {etapas.map((et, idx) => (
                    <EtapaRow
                      key={idx}
                      etapa={et}
                      profiles={profiles ?? []}
                      departamentos={departamentos ?? []}
                      onChange={(patch) => setEtapa(idx, patch)}
                      onRemove={() => removeEtapa(idx)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={saveMutation.isPending || !nome.trim()}
          >
            {saveMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            )}
            Salvar template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EtapaRow({
  etapa,
  profiles,
  departamentos,
  onChange,
  onRemove,
}: {
  etapa: EtapaResponsavel;
  profiles: any[];
  departamentos: Array<{ id: string; nome: string }>;
  onChange: (patch: Partial<EtapaResponsavel>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-border p-2 space-y-1.5 bg-card/40">
      <div className="flex items-center gap-1.5">
        <Input
          value={etapa.etapa_label}
          onChange={(e) => onChange({ etapa_label: e.target.value })}
          className="h-7 text-xs flex-1"
          placeholder="Nome da etapa"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Select
          value={etapa.coluna_key}
          onValueChange={(v) => onChange({ coluna_key: v })}
        >
          <SelectTrigger className="h-7 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLUNA_ORDEM.map((k) => (
              <SelectItem key={k} value={k}>
                {DEFAULT_COLUNAS[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={etapa.responsavel_tipo}
          onValueChange={(v) =>
            onChange({
              responsavel_tipo: v as EtapaResponsavel["responsavel_tipo"],
              responsavel_id: null,
            })
          }
        >
          <SelectTrigger className="h-7 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="papel">Papel (coordenador)</SelectItem>
            <SelectItem value="departamento">Departamento</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={0}
          value={etapa.sla_horas ?? ""}
          onChange={(e) =>
            onChange({
              sla_horas: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="SLA (h)"
          className="h-7 text-[10px]"
        />
      </div>

      {etapa.responsavel_tipo === "user" && (
        <Select
          value={etapa.responsavel_id ?? ""}
          onValueChange={(v) => onChange({ responsavel_id: v || null })}
        >
          <SelectTrigger className="h-7 text-[10px]">
            <SelectValue placeholder="Selecionar responsável…" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name || p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {etapa.responsavel_tipo === "departamento" && (
        <Select
          value={etapa.responsavel_id ?? ""}
          onValueChange={(v) => onChange({ responsavel_id: v || null })}
        >
          <SelectTrigger className="h-7 text-[10px]">
            <SelectValue placeholder="Selecionar departamento…" />
          </SelectTrigger>
          <SelectContent>
            {departamentos.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {etapa.responsavel_tipo === "papel" && (
        <Select
          value={etapa.responsavel_id ?? ""}
          onValueChange={(v) => onChange({ responsavel_id: v || null })}
        >
          <SelectTrigger className="h-7 text-[10px]">
            <SelectValue placeholder="Selecionar papel…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="coordenador">Coordenador do projeto</SelectItem>
            <SelectItem value="gerente">Gerente</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
