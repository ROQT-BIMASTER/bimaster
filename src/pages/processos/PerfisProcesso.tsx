import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Trash2, Pencil, GripVertical, Workflow, Layers, FileText, CheckSquare, Settings2, BookOpen, FolderOpen,
} from "lucide-react";
import {
  useProcessoPerfis, useProcessoPerfilEtapas, useProcessoEtapaVinculos,
  type ProcessoAmbiente, type ProcessoPerfil,
} from "@/hooks/useProcessoPerfis";
import { useModuloCatalogo } from "@/hooks/useModuloCatalogo";
import { ModuloCatalogoCombobox } from "@/components/processos/ModuloCatalogoCombobox";
import { ProjetoRefsPanel } from "@/components/processos/ProjetoRefsPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjetosParaVinculo, useSecoesETarefas } from "@/hooks/useChinaTarefaVinculos";
import { Navigate, Link } from "react-router-dom";

const AMBIENTES: { value: ProcessoAmbiente; label: string }[] = [
  { value: "china", label: "China" },
  { value: "brasil", label: "Brasil" },
  { value: "fabrica", label: "Fábrica" },
  { value: "projeto", label: "Projetos" },
  { value: "tarefa", label: "Tarefas" },
  { value: "universal", label: "Universal" },
];

export default function PerfisProcesso() {
  const { isAdmin } = useUserRole();
  const [ambiente, setAmbiente] = useState<ProcessoAmbiente | "all">("all");
  const { perfis, isLoading, create, update, remove } = useProcessoPerfis(
    ambiente === "all" ? undefined : ambiente
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", ambiente: "china" as ProcessoAmbiente });

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const selected = perfis.find((p) => p.id === selectedId) ?? null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Workflow className="h-7 w-7 text-primary" />
              Perfis de Processo
            </h1>
            <p className="text-muted-foreground mt-1">
              Templates de etapas com vínculos a módulos, documentos e tarefas — aplicáveis a China, Brasil, Fábrica, Projetos e Tarefas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/processos/modulos-catalogo">
                <BookOpen className="h-4 w-4 mr-2" />Catálogo de Módulos
              </Link>
            </Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Novo Perfil</Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Perfil de Processo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div>
                  <Label>Ambiente</Label>
                  <Select value={form.ambiente} onValueChange={(v: ProcessoAmbiente) => setForm({ ...form, ambiente: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AMBIENTES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancelar</Button>
                <Button
                  onClick={async () => {
                    if (!form.nome) return;
                    await create.mutateAsync(form);
                    setOpenNew(false);
                    setForm({ nome: "", descricao: "", ambiente: "china" });
                  }}
                  disabled={create.isPending}
                >Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          {/* Lista lateral */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Perfis</CardTitle>
                <Select value={ambiente} onValueChange={(v: any) => setAmbiente(v)}>
                  <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {AMBIENTES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {!isLoading && perfis.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum perfil cadastrado.</p>
              )}
              {perfis.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedId === p.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{p.nome}</span>
                    <Badge variant="outline" className="text-[10px]">{p.ambiente}</Badge>
                  </div>
                  {p.descricao && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.descricao}</p>}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Detalhe */}
          <div className="space-y-4">
            {!selected ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Selecione um perfil ao lado ou crie um novo para configurar etapas, vínculos e regras.
                </CardContent>
              </Card>
            ) : (
              <PerfilDetalhe
                perfil={selected}
                onUpdate={(patch) => update.mutate({ id: selected.id, ...patch })}
                onRemove={() => {
                  if (confirm(`Remover perfil "${selected.nome}"?`)) {
                    remove.mutate(selected.id, { onSuccess: () => setSelectedId(null) });
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function PerfilDetalhe({
  perfil, onUpdate, onRemove,
}: { perfil: ProcessoPerfil; onUpdate: (p: Partial<ProcessoPerfil>) => void; onRemove: () => void }) {
  const { etapas, upsert, remove, reorder } = useProcessoPerfilEtapas(perfil.id);
  const [etapaSelecionadaId, setEtapaSelecionadaId] = useState<string | null>(null);
  const [novaEtapa, setNovaEtapa] = useState({ codigo: "", label: "", requer_aprovacao: false });

  const etapaSelecionada = etapas.find((e) => e.id === etapaSelecionadaId) ?? etapas[0] ?? null;

  return (
    <>
      {/* Cabeçalho do perfil */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Input
                value={perfil.nome}
                onChange={(e) => onUpdate({ nome: e.target.value })}
                className="text-lg font-semibold"
              />
              <Textarea
                value={perfil.descricao ?? ""}
                onChange={(e) => onUpdate({ descricao: e.target.value })}
                placeholder="Descrição do perfil..."
                rows={2}
              />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={perfil.ativo} onCheckedChange={(v) => onUpdate({ ativo: v })} />
                  <Label className="text-sm">Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={perfil.padrao} onCheckedChange={(v) => onUpdate({ padrao: v })} />
                  <Label className="text-sm">Perfil padrão do ambiente</Label>
                </div>
                <Badge variant="outline">{perfil.ambiente}</Badge>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Etapas + Vínculos */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />Etapas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => setEtapaSelecionadaId(e.id)}
                className={`w-full text-left p-2 rounded-md flex items-center gap-2 transition-colors ${
                  etapaSelecionada?.id === e.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-mono w-5">{e.ordem + 1}</span>
                <span className="flex-1 text-sm">{e.label}</span>
                {e.requer_aprovacao && <Badge variant="secondary" className="text-[9px]">aprov.</Badge>}
              </button>
            ))}
            <div className="border-t pt-2 mt-2 space-y-2">
              <Input
                placeholder="código (ex: ideia)"
                value={novaEtapa.codigo}
                onChange={(e) => setNovaEtapa({ ...novaEtapa, codigo: e.target.value })}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Nome (ex: Ideia)"
                value={novaEtapa.label}
                onChange={(e) => setNovaEtapa({ ...novaEtapa, label: e.target.value })}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="w-full"
                onClick={async () => {
                  if (!novaEtapa.codigo || !novaEtapa.label) return;
                  await upsert.mutateAsync({
                    perfil_id: perfil.id,
                    codigo: novaEtapa.codigo,
                    label: novaEtapa.label,
                    ordem: etapas.length,
                    requer_aprovacao: novaEtapa.requer_aprovacao,
                  });
                  setNovaEtapa({ codigo: "", label: "", requer_aprovacao: false });
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />Adicionar etapa
              </Button>
            </div>
          </CardContent>
        </Card>

        {etapaSelecionada ? (
          <EtapaVinculos
            etapaId={etapaSelecionada.id}
            label={etapaSelecionada.label}
            requerAprovacao={etapaSelecionada.requer_aprovacao}
            onToggleAprovacao={(v) =>
              upsert.mutate({
                perfil_id: perfil.id,
                id: etapaSelecionada.id,
                codigo: etapaSelecionada.codigo,
                label: etapaSelecionada.label,
                ordem: etapaSelecionada.ordem,
                requer_aprovacao: v,
              } as any)
            }
            onRemoveEtapa={() => {
              if (confirm(`Remover etapa "${etapaSelecionada.label}"?`)) {
                remove.mutate(etapaSelecionada.id);
                setEtapaSelecionadaId(null);
              }
            }}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Adicione uma etapa ao lado para configurar os vínculos.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function EtapaVinculos({
  etapaId, label, requerAprovacao, onToggleAprovacao, onRemoveEtapa,
}: {
  etapaId: string;
  label: string;
  requerAprovacao: boolean;
  onToggleAprovacao: (v: boolean) => void;
  onRemoveEtapa: () => void;
}) {
  const v = useProcessoEtapaVinculos(etapaId);
  const [novoModulo, setNovoModulo] = useState({ modulo_codigo: "", auto_criar_registro: false, bloqueia_avanco: true });
  const [novoDoc, setNovoDoc] = useState({ tipo: "", label: "", obrigatorio: true });
  const [novaTarefa, setNovaTarefa] = useState({ titulo: "", prazo_dias: 3, prioridade: "media" as const, modulo_codigo: "", auto_gerar: true });
  const [novaSubtarefa, setNovaSubtarefa] = useState<Record<string, string>>({});
  const { catalogo } = useModuloCatalogo(true);
  const catalogoMap = Object.fromEntries(catalogo.map((c) => [c.codigo, c]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />Etapa: {label}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={requerAprovacao} onCheckedChange={onToggleAprovacao} />
              <Label className="text-xs">Requer aprovação</Label>
            </div>
            <Button variant="ghost" size="sm" onClick={onRemoveEtapa}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="modulos">
          <TabsList>
            <TabsTrigger value="modulos"><Layers className="h-3.5 w-3.5 mr-1" />Módulos</TabsTrigger>
            <TabsTrigger value="docs"><FileText className="h-3.5 w-3.5 mr-1" />Documentos</TabsTrigger>
            <TabsTrigger value="tarefas"><CheckSquare className="h-3.5 w-3.5 mr-1" />Tarefas</TabsTrigger>
            <TabsTrigger value="projetos"><FolderOpen className="h-3.5 w-3.5 mr-1" />Projetos</TabsTrigger>
          </TabsList>

          <TabsContent value="projetos" className="space-y-3 pt-3">
            <ProjetoRefsPanel etapaId={etapaId} v={v} />
          </TabsContent>

          {/* Módulos */}
          <TabsContent value="modulos" className="space-y-3 pt-3">
            <div className="space-y-2">
              {v.modulos.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum módulo vinculado a esta etapa.</p>
              )}
              {v.modulos.map((m) => {
                const cat = catalogoMap[m.modulo_codigo];
                return (
                  <div key={m.id} className="flex items-center gap-2 p-2 border rounded-md">
                    <Badge variant="outline" className="font-mono text-[10px]">{m.modulo_codigo}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{cat?.label || m.label || m.modulo_codigo}</div>
                      {cat?.rota && <div className="text-[10px] text-muted-foreground truncate">{cat.rota}</div>}
                    </div>
                    {m.bloqueia_avanco && <Badge variant="destructive" className="text-[9px]">bloqueia</Badge>}
                    {m.auto_criar_registro && <Badge variant="secondary" className="text-[9px]">auto</Badge>}
                    <Button variant="ghost" size="sm" onClick={() => v.removeModulo.mutate(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs">Adicionar módulo do catálogo</Label>
              <ModuloCatalogoCombobox
                value={novoModulo.modulo_codigo}
                onChange={(c) => setNovoModulo({ ...novoModulo, modulo_codigo: c })}
                excludeCodigos={v.modulos.map((m) => m.modulo_codigo)}
                className="h-9"
              />
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={novoModulo.bloqueia_avanco}
                    onCheckedChange={(b) => setNovoModulo({ ...novoModulo, bloqueia_avanco: b })}
                  />
                  <Label className="text-xs">Bloqueia avanço</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={novoModulo.auto_criar_registro}
                    onCheckedChange={(b) => setNovoModulo({ ...novoModulo, auto_criar_registro: b })}
                  />
                  <Label className="text-xs">Criar registro auto.</Label>
                </div>
                <Button
                  size="sm"
                  disabled={!novoModulo.modulo_codigo || v.addModulo.isPending}
                  onClick={async () => {
                    if (!novoModulo.modulo_codigo) return;
                    const cat = catalogoMap[novoModulo.modulo_codigo];
                    await v.addModulo.mutateAsync({
                      etapa_id: etapaId,
                      ordem: v.modulos.length,
                      modulo_codigo: novoModulo.modulo_codigo,
                      label: cat?.label ?? null,
                      rota: cat?.rota ?? null,
                      auto_criar_registro: novoModulo.auto_criar_registro,
                      bloqueia_avanco: novoModulo.bloqueia_avanco,
                    } as any);
                    setNovoModulo({ modulo_codigo: "", auto_criar_registro: false, bloqueia_avanco: true });
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Documentos */}
          <TabsContent value="docs" className="space-y-3 pt-3">
            {v.documentos.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2 border rounded-md">
                <Badge variant="outline">{d.tipo}</Badge>
                <span className="text-sm flex-1">{d.label}</span>
                {d.obrigatorio && <Badge variant="destructive" className="text-[10px]">obrigatório</Badge>}
                <Button variant="ghost" size="sm" onClick={() => v.removeDocumento.mutate(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
              <Input placeholder="tipo (ex: ficha_tecnica)" value={novoDoc.tipo}
                onChange={(e) => setNovoDoc({ ...novoDoc, tipo: e.target.value })} />
              <Input placeholder="Label" value={novoDoc.label}
                onChange={(e) => setNovoDoc({ ...novoDoc, label: e.target.value })} />
              <div className="flex items-center gap-1">
                <Switch checked={novoDoc.obrigatorio}
                  onCheckedChange={(v2) => setNovoDoc({ ...novoDoc, obrigatorio: v2 })} />
                <Label className="text-xs">Obr.</Label>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  if (!novoDoc.tipo || !novoDoc.label) return;
                  await v.addDocumento.mutateAsync({
                    etapa_id: etapaId, ordem: v.documentos.length, descricao: null, ...novoDoc,
                  });
                  setNovoDoc({ tipo: "", label: "", obrigatorio: true });
                }}
              ><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </TabsContent>

          {/* Tarefas */}
          <TabsContent value="tarefas" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Templates abaixo geram tarefas e subtarefas automaticamente no projeto vinculado quando a etapa for iniciada.
            </p>
            {v.tarefas.map((t: any) => {
              const cat = t.modulo_codigo ? catalogoMap[t.modulo_codigo] : null;
              const subs: any[] = Array.isArray(t.subtarefas) ? t.subtarefas : [];
              const subInputKey = t.id;
              return (
                <div key={t.id} className="p-2 border rounded-md space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{t.prioridade}</Badge>
                    <span className="text-sm flex-1 font-medium">{t.titulo}</span>
                    {cat && <Badge variant="secondary" className="text-[10px]">→ {cat.label}</Badge>}
                    {t.auto_gerar === false && <Badge variant="outline" className="text-[10px]">manual</Badge>}
                    <span className="text-xs text-muted-foreground">{t.prazo_dias}d</span>
                    <Button variant="ghost" size="sm" onClick={() => v.removeTarefa.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {subs.length > 0 && (
                    <ul className="ml-4 space-y-1">
                      {subs.map((s: any, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>•</span>
                          <span className="flex-1">{typeof s === "string" ? s : s.titulo}</span>
                          {typeof s === "object" && s.prazo_dias && <span>{s.prazo_dias}d</span>}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={async () => {
                              const novas = subs.filter((_, idx) => idx !== i);
                              await (v.addTarefa as any).mutateAsync; // placeholder typing
                              await (await import("@/integrations/supabase/client")).supabase
                                .from("processo_etapa_tarefas_template" as any)
                                .update({ subtarefas: novas })
                                .eq("id", t.id);
                              v.refetch?.();
                            }}
                          ><Trash2 className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2 ml-4">
                    <Input
                      placeholder="+ subtarefa"
                      className="h-7 text-xs"
                      value={novaSubtarefa[subInputKey] ?? ""}
                      onChange={(e) => setNovaSubtarefa({ ...novaSubtarefa, [subInputKey]: e.target.value })}
                      onKeyDown={async (e) => {
                        if (e.key !== "Enter") return;
                        const titulo = (novaSubtarefa[subInputKey] ?? "").trim();
                        if (!titulo) return;
                        const novas = [...subs, { titulo }];
                        await (await import("@/integrations/supabase/client")).supabase
                          .from("processo_etapa_tarefas_template" as any)
                          .update({ subtarefas: novas })
                          .eq("id", t.id);
                        setNovaSubtarefa({ ...novaSubtarefa, [subInputKey]: "" });
                        v.refetch?.();
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-[1fr_160px_80px_120px_auto] gap-2 items-center pt-2 border-t">
              <Input placeholder="Título da tarefa" value={novaTarefa.titulo}
                onChange={(e) => setNovaTarefa({ ...novaTarefa, titulo: e.target.value })} />
              <ModuloCatalogoCombobox
                value={novaTarefa.modulo_codigo || undefined}
                onChange={(c) => setNovaTarefa({ ...novaTarefa, modulo_codigo: c })}
                placeholder="Módulo (opcional)"
              />
              <Input type="number" placeholder="dias" value={novaTarefa.prazo_dias}
                onChange={(e) => setNovaTarefa({ ...novaTarefa, prazo_dias: Number(e.target.value) })} />
              <Select value={novaTarefa.prioridade}
                onValueChange={(v2: any) => setNovaTarefa({ ...novaTarefa, prioridade: v2 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={async () => {
                  if (!novaTarefa.titulo) return;
                  await v.addTarefa.mutateAsync({
                    etapa_id: etapaId, ordem: v.tarefas.length,
                    descricao: null, responsavel_role: null, departamento_id: null,
                    titulo: novaTarefa.titulo,
                    prazo_dias: novaTarefa.prazo_dias,
                    prioridade: novaTarefa.prioridade,
                    modulo_codigo: novaTarefa.modulo_codigo || null,
                    auto_gerar: novaTarefa.auto_gerar,
                    subtarefas: [],
                  } as any);
                  setNovaTarefa({ titulo: "", prazo_dias: 3, prioridade: "media", modulo_codigo: "", auto_gerar: true });
                }}
              ><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
