// src/pages/admin/CofreTemplates.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, ListChecks, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import {
  CATEGORIA_LABELS, type ChecklistTemplate, type ChecklistItem,
} from "@/hooks/useBriefingCofre";

const TIPOS_BRIEFING = [
  { v: "*", l: "Todos os tipos" },
  { v: "pdv", l: "PDV" },
  { v: "embalagem", l: "Embalagem" },
  { v: "evento", l: "Evento" },
  { v: "campanha", l: "Campanha" },
  { v: "ecommerce", l: "E-commerce" },
  { v: "presskit", l: "Press Kit" },
  { v: "catalogo", l: "Catálogo" },
  { v: "material_interno", l: "Material interno" },
];

export default function CofreTemplates() {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState("*");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-cofre-templates"],
    queryFn: async (): Promise<ChecklistTemplate[]> => {
      const { data, error } = await (supabase as any)
        .from("briefing_doc_checklist_templates")
        .select("*, itens:briefing_doc_checklist_itens(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChecklistTemplate[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("briefing_doc_checklist_templates")
        .insert({ nome: newNome.trim(), tipo_briefing: newTipo, created_by: u.user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template criado");
      setNewNome(""); setNewTipo("*"); setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-cofre-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarTpl = useMutation({
    mutationFn: async (patch: Partial<ChecklistTemplate> & { id: string }) => {
      const { id, itens, ...p } = patch as any;
      const { error } = await (supabase as any)
        .from("briefing_doc_checklist_templates")
        .update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cofre-templates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirTpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("briefing_doc_checklist_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template removido");
      qc.invalidateQueries({ queryKey: ["admin-cofre-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Templates do cofre de documentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Define quais documentos cada tipo de briefing deve coletar.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Input
                      defaultValue={t.nome}
                      onBlur={(e) => {
                        if (e.target.value !== t.nome)
                          atualizarTpl.mutate({ id: t.id, nome: e.target.value });
                      }}
                      className="h-8 max-w-sm"
                    />
                    <Badge variant="outline" className="text-[10px]">
                      {TIPOS_BRIEFING.find((tt) => tt.v === t.tipo_briefing)?.l ?? t.tipo_briefing}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={t.ativo}
                      onCheckedChange={(v) => atualizarTpl.mutate({ id: t.id, ativo: v })}
                    />
                    <span className="text-[11px] text-muted-foreground">ativo</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                    Editar itens ({t.itens?.length ?? 0})
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                    onClick={async () => {
                      if ((await confirm({ title: `Excluir template "${t.nome}"?`, destructive: true }))) excluirTpl.mutate(t.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Criar */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Aplica-se a</Label>
              <Select value={newTipo} onValueChange={setNewTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_BRIEFING.map((t) => (
                    <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button disabled={!newNome.trim() || criar.isPending} onClick={() => criar.mutate()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar itens */}
      {editing && (
        <EditarItensDialog
          template={editing}
          onClose={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin-cofre-templates"] });
          }}
        />
      )}
    </div>
  );
}

function EditarItensDialog({ template, onClose }: {
  template: ChecklistTemplate; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [itens, setItens] = useState<ChecklistItem[]>(
    (template.itens ?? []).slice().sort((a, b) => a.ordem - b.ordem),
  );

  const salvar = useMutation({
    mutationFn: async () => {
      // Apaga todos e reinsere — simples para v1
      await (supabase as any)
        .from("briefing_doc_checklist_itens")
        .delete().eq("template_id", template.id);
      if (itens.length) {
        const rows = itens.map((it, idx) => ({
          template_id: template.id,
          ordem: idx,
          categoria: it.categoria,
          nome: it.nome,
          descricao: it.descricao,
          obrigatorio: it.obrigatorio,
        }));
        const { error } = await (supabase as any)
          .from("briefing_doc_checklist_itens").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Itens salvos");
      qc.invalidateQueries({ queryKey: ["admin-cofre-templates"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adicionar = () => {
    setItens((prev) => [
      ...prev,
      { id: crypto.randomUUID(), template_id: template.id, ordem: prev.length,
        categoria: "geral", nome: "", descricao: null, obrigatorio: false },
    ]);
  };

  const mover = (idx: number, delta: number) => {
    setItens((prev) => {
      const arr = [...prev];
      const j = idx + delta;
      if (j < 0 || j >= arr.length) return arr;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{template.nome} — itens</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {itens.map((it, idx) => (
            <div key={it.id} className="grid grid-cols-[24px_1fr_140px_80px_32px] gap-2 items-center bg-muted/30 rounded p-2">
              <div className="flex flex-col">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => mover(idx, -1)}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => mover(idx, 1)}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Input
                className="h-8" placeholder="Nome do documento" value={it.nome}
                onChange={(e) => setItens((p) => p.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))}
              />
              <Select
                value={it.categoria}
                onValueChange={(v) => setItens((p) => p.map((x, i) => i === idx ? { ...x, categoria: v } : x))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1 text-[11px]">
                <Switch
                  checked={it.obrigatorio}
                  onCheckedChange={(v) => setItens((p) => p.map((x, i) => i === idx ? { ...x, obrigatorio: v } : x))}
                />
                Obrig.
              </label>
              <Button
                size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={adicionar} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
