import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Users, Layers, Gauge, Tag, Webhook, ToggleLeft, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatMinutes } from "@/lib/crm/format";

const SECTIONS = [
  { key: "filas", label: "Filas", icon: Layers },
  { key: "operadores", label: "Operadores", icon: Users },
  { key: "sla", label: "Políticas de SLA", icon: Gauge },
  { key: "tags", label: "Tags", icon: Tag },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "flags", label: "Feature flags", icon: ToggleLeft },
];

export default function CrmConfiguracoes() {
  const [active, setActive] = useState("filas");
  return (
    <div className="min-h-full flex flex-col">
      <CrmPageHeader icon={Settings} title="Configurações" subtitle="Filas · operadores · SLA · integrações" />
      <div className="flex-1 grid grid-cols-[220px_1fr] min-h-0">
        <aside className="border-r bg-card p-2 space-y-0.5">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.key} onClick={() => setActive(s.key)}
                className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted",
                  active === s.key && "bg-primary/10 text-primary font-medium")}>
                <Icon className="h-3.5 w-3.5" /> {s.label}
              </button>
            );
          })}
        </aside>
        <div className="p-4 overflow-auto">
          {active === "filas" && <FilasSection />}
          {active === "operadores" && <OperadoresSection />}
          {active === "sla" && <SlaSection />}
          {active === "tags" && <TagsSection />}
          {active === "webhooks" && <WebhooksSection />}
          {active === "flags" && <FlagsSection />}
        </div>
      </div>
    </div>
  );
}

function useEmpresaId() {
  const { empresaSelecionada, empresaIds } = useEmpresaContext();
  return empresaSelecionada?.id ?? empresaIds[0];
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold text-foreground">{title}</h2>{action}</div>;
}

function FilasSection() {
  const empresaId = useEmpresaId(); const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["crm-cfg-filas", empresaId], enabled: !!empresaId,
    queryFn: async () => { const { data } = await supabase.from("crm_filas").select("*").eq("empresa_id", empresaId!).order("nome"); return data ?? []; },
  });
  const remove = async (id: string) => { const { error } = await supabase.from("crm_filas").delete().eq("id", id); if (error) toast.error(error.message); else { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["crm-cfg-filas", empresaId] }); } };
  const create = async (form: FormData) => {
    const { error } = await supabase.from("crm_filas").insert({
      empresa_id: empresaId!, nome: String(form.get("nome") ?? ""), cor: String(form.get("cor") ?? "") || null,
      regra_roteamento: (form.get("regra") as any) ?? "round_robin",
      capacidade_max_por_op: Number(form.get("cap") ?? 5),
    });
    if (error) toast.error(error.message); else { toast.success("Fila criada"); setOpen(false); qc.invalidateQueries({ queryKey: ["crm-cfg-filas", empresaId] }); }
  };
  return (
    <>
      <SectionHeader title="Filas de atendimento" action={<Button size="sm" className="h-8 gap-1" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Nova fila</Button>} />
      <Card className="p-0">
        <Table>
          <TableHeader><TableRow className="h-8"><TableHead className="text-[11px] uppercase">Nome</TableHead><TableHead className="text-[11px] uppercase">Roteamento</TableHead><TableHead className="text-[11px] uppercase">Cap/op</TableHead><TableHead className="text-[11px] uppercase">Ativo</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Nenhuma fila</TableCell></TableRow>}
            {data.map((f: any) => (
              <TableRow key={f.id} className="h-9">
                <TableCell className="text-xs font-medium">{f.nome}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{f.regra_roteamento}</TableCell>
                <TableCell className="text-xs tabular-nums">{f.capacidade_max_por_op}</TableCell>
                <TableCell className="text-xs">{f.ativo ? "Sim" : "Não"}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(f.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova fila</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }} className="space-y-3">
            <div><Label className="text-xs">Nome</Label><Input name="nome" required className="h-8 text-xs" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Cor</Label><Input name="cor" placeholder="#3B82F6" className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Cap. por operador</Label><Input name="cap" type="number" defaultValue={5} className="h-8 text-xs" /></div>
            </div>
            <div>
              <Label className="text-xs">Roteamento</Label>
              <Select name="regra" defaultValue="round_robin">
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round-robin</SelectItem>
                  <SelectItem value="menos_ocupado">Menos ocupado</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OperadoresSection() {
  const empresaId = useEmpresaId();
  const { data = [] } = useQuery({
    queryKey: ["crm-cfg-operadores", empresaId], enabled: !!empresaId,
    queryFn: async () => { const { data } = await supabase.from("crm_operadores").select("user_id, apelido, status_presenca, capacidade_max, ativo, skills, filas_padrao").eq("empresa_id", empresaId!); return data ?? []; },
  });
  return (
    <>
      <SectionHeader title="Operadores" />
      <Card className="p-0">
        <Table>
          <TableHeader><TableRow className="h-8"><TableHead className="text-[11px] uppercase">Apelido</TableHead><TableHead className="text-[11px] uppercase">Presença</TableHead><TableHead className="text-[11px] uppercase">Capacidade</TableHead><TableHead className="text-[11px] uppercase">Skills</TableHead><TableHead className="text-[11px] uppercase">Ativo</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Nenhum operador cadastrado</TableCell></TableRow>}
            {data.map((o: any) => (
              <TableRow key={o.user_id} className="h-9">
                <TableCell className="text-xs font-medium">{o.apelido ?? o.user_id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{o.status_presenca}</TableCell>
                <TableCell className="text-xs tabular-nums">{o.capacidade_max}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(o.skills ?? []).join(", ") || "—"}</TableCell>
                <TableCell className="text-xs">{o.ativo ? "Sim" : "Não"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function SlaSection() {
  const empresaId = useEmpresaId(); const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["crm-cfg-sla", empresaId], enabled: !!empresaId,
    queryFn: async () => { const { data } = await supabase.from("crm_sla_policies").select("*").eq("empresa_id", empresaId!); return data ?? []; },
  });
  const create = async (form: FormData) => {
    const { error } = await supabase.from("crm_sla_policies").insert({
      empresa_id: empresaId!, nome: String(form.get("nome") ?? ""),
      prioridade: (form.get("prioridade") as any) ?? "normal",
      tempo_primeira_resposta_min: Number(form.get("tpr") ?? 0) || null,
      tempo_resolucao_min: Number(form.get("tr") ?? 0) || null,
    });
    if (error) toast.error(error.message); else { toast.success("Política criada"); setOpen(false); qc.invalidateQueries({ queryKey: ["crm-cfg-sla", empresaId] }); }
  };
  return (
    <>
      <SectionHeader title="Políticas de SLA" action={<Button size="sm" className="h-8 gap-1" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Nova</Button>} />
      <Card className="p-0">
        <Table>
          <TableHeader><TableRow className="h-8"><TableHead className="text-[11px] uppercase">Nome</TableHead><TableHead className="text-[11px] uppercase">Prioridade</TableHead><TableHead className="text-[11px] uppercase">1ª resposta</TableHead><TableHead className="text-[11px] uppercase">Resolução</TableHead><TableHead className="text-[11px] uppercase">Ativo</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Nenhuma política</TableCell></TableRow>}
            {data.map((s: any) => (
              <TableRow key={s.id} className="h-9">
                <TableCell className="text-xs font-medium">{s.nome}</TableCell>
                <TableCell className="text-xs">{s.prioridade}</TableCell>
                <TableCell className="text-xs tabular-nums">{formatMinutes(s.tempo_primeira_resposta_min)}</TableCell>
                <TableCell className="text-xs tabular-nums">{formatMinutes(s.tempo_resolucao_min)}</TableCell>
                <TableCell className="text-xs">{s.ativo ? "Sim" : "Não"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova política de SLA</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }} className="space-y-3">
            <div><Label className="text-xs">Nome</Label><Input name="nome" required className="h-8 text-xs" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select name="prioridade" defaultValue="normal">
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">1ª resposta (min)</Label><Input name="tpr" type="number" className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Resolução (min)</Label><Input name="tr" type="number" className="h-8 text-xs" /></div>
            </div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TagsSection() {
  const empresaId = useEmpresaId(); const qc = useQueryClient();
  const [nome, setNome] = useState(""); const [cor, setCor] = useState("#3B82F6");
  const { data = [] } = useQuery({
    queryKey: ["crm-cfg-tags", empresaId], enabled: !!empresaId,
    queryFn: async () => { const { data } = await supabase.from("crm_tags").select("*").eq("empresa_id", empresaId!).order("nome"); return data ?? []; },
  });
  const create = async () => {
    if (!nome.trim()) return;
    const { error } = await supabase.from("crm_tags").insert({ empresa_id: empresaId!, nome: nome.trim(), cor });
    if (error) toast.error(error.message); else { setNome(""); qc.invalidateQueries({ queryKey: ["crm-cfg-tags", empresaId] }); }
  };
  const remove = async (id: string) => { const { error } = await supabase.from("crm_tags").delete().eq("id", id); if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["crm-cfg-tags", empresaId] }); };
  return (
    <>
      <SectionHeader title="Tags" />
      <Card className="p-3 mb-3">
        <div className="flex items-end gap-2">
          <div className="flex-1"><Label className="text-xs">Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} className="h-8 text-xs" /></div>
          <div className="w-24"><Label className="text-xs">Cor</Label><Input value={cor} onChange={e => setCor(e.target.value)} className="h-8 text-xs" /></div>
          <Button size="sm" className="h-8" onClick={create}>Adicionar</Button>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        {data.map((t: any) => (
          <div key={t.id} className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: t.cor ?? "hsl(var(--muted))" }} />
            <span className="text-foreground">{t.nome}</span>
            <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        {data.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma tag</span>}
      </div>
    </>
  );
}

function WebhooksSection() {
  const empresaId = useEmpresaId(); const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["crm-cfg-wh", empresaId], enabled: !!empresaId,
    queryFn: async () => { const { data } = await supabase.from("crm_webhook_endpoints").select("*").eq("empresa_id", empresaId!); return data ?? []; },
  });
  const toggle = async (id: string, ativo: boolean) => { const { error } = await supabase.from("crm_webhook_endpoints").update({ ativo }).eq("id", id); if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["crm-cfg-wh", empresaId] }); };
  return (
    <>
      <SectionHeader title="Webhooks de saída" />
      <Card className="p-0">
        <Table>
          <TableHeader><TableRow className="h-8"><TableHead className="text-[11px] uppercase">Nome</TableHead><TableHead className="text-[11px] uppercase">URL</TableHead><TableHead className="text-[11px] uppercase">Eventos</TableHead><TableHead className="text-[11px] uppercase">DLQ</TableHead><TableHead className="text-[11px] uppercase">Ativo</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Nenhum endpoint configurado</TableCell></TableRow>}
            {data.map((w: any) => (
              <TableRow key={w.id} className="h-9">
                <TableCell className="text-xs font-medium">{w.nome}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-xs">{w.url}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(w.eventos ?? []).join(", ") || "—"}</TableCell>
                <TableCell className="text-xs tabular-nums">{w.dlq_count}</TableCell>
                <TableCell><Switch checked={w.ativo} onCheckedChange={(v) => toggle(w.id, v)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function FlagsSection() {
  const empresaId = useEmpresaId(); const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["crm-cfg-flags", empresaId], enabled: !!empresaId,
    queryFn: async () => { const { data } = await supabase.from("crm_feature_flags").select("*").eq("empresa_id", empresaId!).eq("escopo", "tenant").order("chave"); return data ?? []; },
  });
  const toggle = async (id: string, atual: any) => {
    const novo = atual === true || atual === "true" ? false : true;
    const { error } = await supabase.from("crm_feature_flags").update({ valor: novo }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["crm-cfg-flags", empresaId] });
  };
  return (
    <>
      <SectionHeader title="Feature flags" />
      <Card className="p-0">
        <Table>
          <TableHeader><TableRow className="h-8"><TableHead className="text-[11px] uppercase">Chave</TableHead><TableHead className="text-[11px] uppercase">Valor</TableHead><TableHead className="text-[11px] uppercase">Estado</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">Nenhuma flag configurada</TableCell></TableRow>}
            {data.map((f: any) => {
              const isBool = typeof f.valor === "boolean" || f.valor === "true" || f.valor === "false";
              const on = f.valor === true || f.valor === "true";
              return (
                <TableRow key={f.id} className="h-9">
                  <TableCell className="text-xs font-mono">{f.chave}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-md">{JSON.stringify(f.valor)}</TableCell>
                  <TableCell>{isBool ? <Switch checked={on} onCheckedChange={() => toggle(f.id, f.valor)} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
