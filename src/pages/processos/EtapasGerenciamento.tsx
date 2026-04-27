import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, ArrowUp, Layers, Plus, Trash2, Pencil, ShieldCheck, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import {
  useProcessoPerfis,
  useProcessoPerfilEtapas,
  type ProcessoPerfilEtapa,
} from "@/hooks/useProcessoPerfis";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function EtapasGerenciamento() {
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { perfis, isLoading: loadingPerfis } = useProcessoPerfis();
  const [perfilId, setPerfilId] = useState<string>("");
  const { etapas, isLoading, upsert, remove, reorder } = useProcessoPerfilEtapas(perfilId || null);
  const [editing, setEditing] = useState<ProcessoPerfilEtapa | null>(null);
  const [openForm, setOpenForm] = useState(false);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const ordered = useMemo(() => [...etapas].sort((a, b) => a.ordem - b.ordem), [etapas]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...ordered];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    reorder.mutate(next.map((e) => e.id));
  };

  const openNew = () => {
    setEditing(null);
    setOpenForm(true);
  };

  const openEdit = (e: ProcessoPerfilEtapa) => {
    setEditing(e);
    setOpenForm(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Layers className="h-7 w-7 text-primary" />
              Etapas de Processo
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie a sequência de etapas de cada perfil. Ordene, edite e marque etapas que exigem aprovação.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard/processos/perfis")}>
            <Workflow className="h-4 w-4 mr-2" /> Ver perfis
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selecione o perfil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[280px]">
              <Label>Perfil de Processo</Label>
              <Select value={perfilId} onValueChange={setPerfilId} disabled={loadingPerfis}>
                <SelectTrigger><SelectValue placeholder="Selecione um perfil" /></SelectTrigger>
                <SelectContent>
                  {perfis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} <span className="text-muted-foreground">({p.ambiente})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openNew} disabled={!perfilId}>
              <Plus className="h-4 w-4 mr-2" /> Nova etapa
            </Button>
          </CardContent>
        </Card>

        {perfilId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Etapas {ordered.length > 0 && <span className="text-muted-foreground font-normal">({ordered.length})</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : ordered.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada. Clique em "Nova etapa" para começar.</p>
              ) : (
                <div className="space-y-2">
                  {ordered.map((e, idx) => (
                    <div key={e.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30">
                      <div className="flex flex-col">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, -1)} disabled={idx === 0}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, 1)} disabled={idx === ordered.length - 1}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Badge variant="outline" className="font-mono">{idx + 1}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{e.label}</span>
                          <Badge variant="secondary" className="text-xs font-mono">{e.codigo}</Badge>
                          {e.requer_aprovacao && (
                            <Badge variant="outline" className="gap-1 text-warning border-warning/50">
                              <ShieldCheck className="h-3 w-3" /> Requer aprovação
                            </Badge>
                          )}
                          {e.prazo_padrao_dias != null && (
                            <Badge variant="outline" className="text-xs">{e.prazo_padrao_dias}d</Badge>
                          )}
                        </div>
                        {e.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.descricao}</p>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <EtapaFormDialog
          open={openForm}
          onOpenChange={setOpenForm}
          perfilId={perfilId}
          editing={editing}
          proximaOrdem={ordered.length}
          onSaved={() => setOpenForm(false)}
        />
      </div>
    </DashboardLayout>
  );
}

function EtapaFormDialog({
  open, onOpenChange, perfilId, editing, proximaOrdem, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  perfilId: string; editing: ProcessoPerfilEtapa | null; proximaOrdem: number;
  onSaved: () => void;
}) {
  const { upsert } = useProcessoPerfilEtapas(perfilId || null);
  const [form, setForm] = useState({
    codigo: "", label: "", descricao: "", requer_aprovacao: false, prazo_padrao_dias: "" as string | number,
  });

  // Reset on open
  useMemo(() => {
    if (open) {
      setForm({
        codigo: editing?.codigo ?? "",
        label: editing?.label ?? "",
        descricao: editing?.descricao ?? "",
        requer_aprovacao: editing?.requer_aprovacao ?? false,
        prazo_padrao_dias: editing?.prazo_padrao_dias ?? "",
      });
    }
  }, [open, editing]);

  const valid = form.codigo.trim().length > 0 && form.label.trim().length > 0;

  const salvar = async () => {
    if (!valid || !perfilId) return;
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      perfil_id: perfilId,
      codigo: form.codigo.trim().toLowerCase().replace(/\s+/g, "_"),
      label: form.label.trim(),
      descricao: form.descricao.trim() || null,
      requer_aprovacao: form.requer_aprovacao,
      prazo_padrao_dias: form.prazo_padrao_dias === "" ? null : Number(form.prazo_padrao_dias),
      ordem: editing?.ordem ?? proximaOrdem,
    } as any);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar etapa" : "Nova etapa"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="ex: cadastro" disabled={!!editing} />
            </div>
            <div>
              <Label>Rótulo *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex: Cadastro" />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm">Requer aprovação</Label>
              <p className="text-xs text-muted-foreground">Bloqueia avanço até que um responsável aprove.</p>
            </div>
            <Switch checked={form.requer_aprovacao} onCheckedChange={(v) => setForm({ ...form, requer_aprovacao: v })} />
          </div>
          <div>
            <Label>Prazo padrão (dias)</Label>
            <Input
              type="number"
              value={form.prazo_padrao_dias}
              onChange={(e) => setForm({ ...form, prazo_padrao_dias: e.target.value })}
              placeholder="opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!valid || upsert.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
