import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Search, Phone, Mail } from "lucide-react";
import { initials, relativeTime } from "@/lib/crm/format";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import { toast } from "sonner";
import { z } from "zod";

const NovoSchema = z.object({
  nome: z.string().min(1).max(200),
  telefone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  origem: z.string().max(60).optional(),
}).strict();

export default function CrmContatos() {
  const { empresaSelecionada, empresaIds } = useEmpresaContext();
  const empresaId = empresaSelecionada?.id ?? empresaIds[0];
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: contatos = [], isLoading } = useQuery({
    queryKey: ["crm-contatos", empresaId, search],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase.from("crm_contatos")
        .select("id, nome, telefone, email, origem, ultimo_contato_em, primeiro_contato_em")
        .eq("empresa_id", empresaId!)
        .order("ultimo_contato_em", { ascending: false, nullsFirst: false })
        .limit(200);
      if (search.trim()) q = q.or(`nome.ilike.%${search}%,telefone.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createContato = async (form: FormData) => {
    const parsed = NovoSchema.safeParse({
      nome: form.get("nome"), telefone: form.get("telefone") || undefined,
      email: form.get("email") || "", origem: form.get("origem") || undefined,
    });
    if (!parsed.success) { toast.error("Dados inválidos"); return; }
    const { error } = await supabase.from("crm_contatos").insert({
      empresa_id: empresaId!, nome: parsed.data.nome,
      telefone: parsed.data.telefone || null, telefone_normalizado: parsed.data.telefone?.replace(/\D/g, "") || null,
      email: parsed.data.email || null, origem: parsed.data.origem || "manual",
    });
    if (error) toast.error(error.message);
    else { toast.success("Contato criado"); setNovoOpen(false); qc.invalidateQueries({ queryKey: ["crm-contatos", empresaId] }); }
  };

  return (
    <div className="min-h-full flex flex-col">
      <CrmPageHeader
        icon={Users}
        title="Contatos 360"
        count={contatos.length}
        subtitle="Ficha completa · histórico cross-canal"
        actions={
          <>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar nome, telefone, email" value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-7 text-xs" />
            </div>
            <Button size="sm" className="h-8 gap-1" onClick={() => setNovoOpen(true)}><Plus className="h-3.5 w-3.5" /> Novo</Button>
          </>
        }
      />
      <div className="p-4">
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="text-[11px] uppercase">Nome</TableHead>
                <TableHead className="text-[11px] uppercase">Telefone</TableHead>
                <TableHead className="text-[11px] uppercase">Email</TableHead>
                <TableHead className="text-[11px] uppercase">Origem</TableHead>
                <TableHead className="text-[11px] uppercase">Último contato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Carregando…</TableCell></TableRow>}
              {!isLoading && contatos.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Nenhum contato</TableCell></TableRow>}
              {contatos.map((c: any) => (
                <TableRow key={c.id} className="h-9 cursor-pointer hover:bg-muted/50" onClick={() => setSelId(c.id)}>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px]">{initials(c.nome ?? c.telefone)}</div>
                      <span className="font-medium text-foreground">{c.nome ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.telefone ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-xs"><span className="text-muted-foreground">{c.origem ?? "—"}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relativeTime(c.ultimo_contato_em)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Contact360 id={selId} onOpenChange={(o) => !o && setSelId(null)} />

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo contato</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createContato(new FormData(e.currentTarget)); }} className="space-y-3">
            <div><Label className="text-xs">Nome</Label><Input name="nome" required className="h-8 text-xs" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Telefone</Label><Input name="telefone" className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Origem</Label><Input name="origem" placeholder="manual" className="h-8 text-xs" /></div>
            </div>
            <div><Label className="text-xs">Email</Label><Input name="email" type="email" className="h-8 text-xs" /></div>
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

function Contact360({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const { data: contato } = useQuery({
    queryKey: ["crm-contato", id], enabled: !!id,
    queryFn: async () => { const { data, error } = await supabase.from("crm_contatos").select("*").eq("id", id!).single(); if (error) throw error; return data; },
  });
  const { data: conversas = [] } = useQuery({
    queryKey: ["crm-contato-conv", id], enabled: !!id,
    queryFn: async () => { const { data } = await supabase.from("crm_conversas").select("id, canal, status, ultima_mensagem_em").eq("contato_id", id!).order("ultima_mensagem_em", { ascending: false }).limit(50); return data ?? []; },
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ["crm-contato-tic", id], enabled: !!id,
    queryFn: async () => { const { data } = await supabase.from("crm_tickets").select("id, numero, titulo, status, prioridade, aberto_em").eq("contato_id", id!).order("aberto_em", { ascending: false }).limit(50); return data ?? []; },
  });

  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[640px] sm:max-w-[640px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">{initials(contato?.nome ?? contato?.telefone)}</div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{contato?.nome ?? "Contato"}</SheetTitle>
              <SheetDescription className="text-xs flex items-center gap-3">
                {contato?.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {contato.telefone}</span>}
                {contato?.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {contato.email}</span>}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 grid grid-cols-4 h-8">
            <TabsTrigger value="overview" className="text-xs">Visão geral</TabsTrigger>
            <TabsTrigger value="conversas" className="text-xs">Conversas</TabsTrigger>
            <TabsTrigger value="tickets" className="text-xs">Tickets</TabsTrigger>
            <TabsTrigger value="atributos" className="text-xs">Atributos</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="px-5 py-3 space-y-2 overflow-y-auto">
            <Row label="Primeiro contato" value={relativeTime(contato?.primeiro_contato_em)} />
            <Row label="Último contato" value={relativeTime(contato?.ultimo_contato_em)} />
            <Row label="Documento" value={contato?.documento ?? "—"} />
            <Row label="Origem" value={contato?.origem ?? "—"} />
            <Row label="ID Cliente ERP" value={contato?.cliente_erp_id ?? "—"} />
            <div className="grid grid-cols-3 gap-2 pt-3">
              <Stat label="Conversas" value={conversas.length} />
              <Stat label="Tickets" value={tickets.length} />
              <Stat label="Abertas" value={conversas.filter((c: any) => c.status !== "closed").length} />
            </div>
          </TabsContent>
          <TabsContent value="conversas" className="px-5 py-3 space-y-1 overflow-y-auto">
            {conversas.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Sem conversas</div>}
            {conversas.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded border bg-card px-2 py-1.5 text-xs">
                <span className="text-foreground">{c.canal}</span>
                <CrmStatusBadge status={c.status} />
                <span className="text-muted-foreground">{relativeTime(c.ultima_mensagem_em)}</span>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="tickets" className="px-5 py-3 space-y-1 overflow-y-auto">
            {tickets.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Sem tickets</div>}
            {tickets.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 rounded border bg-card px-2 py-1.5 text-xs">
                <span className="font-mono text-muted-foreground w-12">#{t.numero}</span>
                <span className="flex-1 truncate text-foreground">{t.titulo}</span>
                <CrmStatusBadge status={t.prioridade} />
                <CrmStatusBadge status={t.status} />
              </div>
            ))}
          </TabsContent>
          <TabsContent value="atributos" className="px-5 py-3 overflow-y-auto">
            <pre className="text-[11px] bg-muted/40 rounded p-3 overflow-auto">{JSON.stringify(contato?.atributos ?? {}, null, 2)}</pre>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between text-xs border-b py-1.5"><span className="text-muted-foreground">{label}</span><span className="text-foreground font-medium">{value}</span></div>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded border bg-card p-2 text-center"><div className="text-lg font-semibold tabular-nums text-foreground">{value}</div><div className="text-[10px] uppercase text-muted-foreground">{label}</div></div>;
}
