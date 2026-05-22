import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Ticket, Plus, LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { relativeTime, slaPercent, slaColor, formatMinutes } from "@/lib/crm/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tic = {
  id: string; numero: number; titulo: string; status: string; prioridade: string;
  contato_id: string | null; fila_id: string | null; operador_id: string | null;
  sla_due_at: string | null; aberto_em: string;
  contato?: { nome: string | null; telefone: string | null } | null;
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "open", label: "Aberto" },
  { key: "in_progress", label: "Em andamento" },
  { key: "pending", label: "Pendente" },
  { key: "resolved", label: "Resolvido" },
  { key: "closed", label: "Fechado" },
];

export default function CrmTickets() {
  const { empresaSelecionada, empresaIds } = useEmpresaContext();
  const empresaId = empresaSelecionada?.id ?? empresaIds[0];
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [prio, setPrio] = useState("all");
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: tickets = [] } = useQuery({
    queryKey: ["crm-tickets", empresaId, prio, search],
    enabled: !!empresaId,
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase.from("crm_tickets")
        .select("id, numero, titulo, status, prioridade, contato_id, fila_id, operador_id, sla_due_at, aberto_em, contato:crm_contatos(nome, telefone)")
        .eq("empresa_id", empresaId!).order("aberto_em", { ascending: false }).limit(300);
      if (prio !== "all") q = q.eq("prioridade", prio as any);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as any) as Tic[]).filter(t => !search.trim() || t.titulo.toLowerCase().includes(search.toLowerCase()) || String(t.numero).includes(search));
    },
  });

  const byStatus = useMemo(() => {
    const m: Record<string, Tic[]> = {};
    COLUMNS.forEach(c => m[c.key] = []);
    tickets.forEach(t => { (m[t.status] ??= []).push(t); });
    return m;
  }, [tickets]);

  const moveStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "resolved") patch.resolvido_em = new Date().toISOString();
    if (status === "closed") patch.fechado_em = new Date().toISOString();
    const { error } = await supabase.from("crm_tickets").update(patch).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["crm-tickets", empresaId] });
  };

  const createTicket = async (form: FormData) => {
    const { error } = await supabase.from("crm_tickets").insert({
      empresa_id: empresaId!,
      titulo: String(form.get("titulo") ?? "").trim(),
      descricao: String(form.get("descricao") ?? "").trim() || null,
      prioridade: (form.get("prioridade") as any) ?? "normal",
    });
    if (error) toast.error(error.message); else { toast.success("Ticket criado"); setNovoOpen(false); qc.invalidateQueries({ queryKey: ["crm-tickets", empresaId] }); }
  };

  return (
    <div className="min-h-full flex flex-col">
      <CrmPageHeader
        icon={Ticket}
        title="Tickets & SLA"
        count={tickets.length}
        subtitle="Ciclo de vida · prioridade · vínculos"
        actions={
          <>
            <div className="relative w-56">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar #número ou título" value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 text-xs" />
            </div>
            <Select value={prio} onValueChange={setPrio}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas prioridades</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 gap-1" onClick={() => setNovoOpen(true)}><Plus className="h-3.5 w-3.5" /> Novo</Button>
          </>
        }
      />
      <div className="p-4">
        <Tabs defaultValue="kanban">
          <TabsList className="h-8">
            <TabsTrigger value="kanban" className="text-xs gap-1.5 h-7"><LayoutGrid className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
            <TabsTrigger value="list" className="text-xs gap-1.5 h-7"><ListIcon className="h-3.5 w-3.5" /> Lista</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="mt-3">
            <div className="grid grid-cols-5 gap-3">
              {COLUMNS.map(col => (
                <div key={col.key} className="bg-muted/30 rounded-md border min-h-[60vh]">
                  <div className="px-2 py-1.5 border-b flex items-center justify-between sticky top-0 bg-card rounded-t-md">
                    <span className="text-[11px] font-semibold uppercase text-foreground">{col.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{byStatus[col.key].length}</span>
                  </div>
                  <div className="p-1.5 space-y-1.5">
                    {byStatus[col.key].map(t => {
                      const pct = slaPercent(t.sla_due_at, t.aberto_em);
                      return (
                        <Card key={t.id} className="p-2 text-xs hover:border-primary cursor-default">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono text-[10px] text-muted-foreground">#{t.numero}</span>
                            <CrmStatusBadge status={t.prioridade} />
                          </div>
                          <div className="mt-1 font-medium text-foreground line-clamp-2">{t.titulo}</div>
                          <div className="mt-1 text-[10px] text-muted-foreground truncate">{t.contato?.nome ?? t.contato?.telefone ?? "—"}</div>
                          <div className="mt-1.5 flex items-center gap-1">
                            {t.sla_due_at && (
                              <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0 text-[10px]", slaColor(pct))}>
                                SLA {pct === null ? "—" : `${Math.round(pct)}%`}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">{relativeTime(t.aberto_em)}</span>
                          </div>
                          <div className="mt-1.5 flex gap-1">
                            <Select onValueChange={(v) => moveStatus(t.id, v)}>
                              <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Mover…" /></SelectTrigger>
                              <SelectContent>
                                {COLUMNS.filter(c => c.key !== t.status).map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="list" className="mt-3">
            <div className="rounded-md border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="text-[11px] uppercase">#</TableHead>
                    <TableHead className="text-[11px] uppercase">Título</TableHead>
                    <TableHead className="text-[11px] uppercase">Contato</TableHead>
                    <TableHead className="text-[11px] uppercase">Prioridade</TableHead>
                    <TableHead className="text-[11px] uppercase">Status</TableHead>
                    <TableHead className="text-[11px] uppercase">SLA</TableHead>
                    <TableHead className="text-[11px] uppercase">Aberto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">Nenhum ticket</TableCell></TableRow>}
                  {tickets.map(t => {
                    const pct = slaPercent(t.sla_due_at, t.aberto_em);
                    return (
                      <TableRow key={t.id} className="h-9">
                        <TableCell className="font-mono text-xs text-muted-foreground">#{t.numero}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground">{t.titulo}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.contato?.nome ?? t.contato?.telefone ?? "—"}</TableCell>
                        <TableCell><CrmStatusBadge status={t.prioridade} /></TableCell>
                        <TableCell><CrmStatusBadge status={t.status} /></TableCell>
                        <TableCell><span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px]", slaColor(pct))}>{pct === null ? "—" : `${Math.round(pct)}%`}</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{relativeTime(t.aberto_em)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo ticket</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createTicket(new FormData(e.currentTarget)); }} className="space-y-3">
            <div><Label className="text-xs">Título</Label><Input name="titulo" required className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Descrição</Label><Input name="descricao" className="h-8 text-xs" /></div>
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
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNovoOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
