import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Landmark, Plus, Search, Pencil, Power } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type ContaBancaria = {
  id: string;
  empresa_id: number | null;
  banco: string;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  pix_key: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Empresa = { id: number; nome: string };

const TIPOS = [
  { value: "corrente", label: "Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "pagamento", label: "Pagamento" },
];

export default function ContasBancarias() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
  const [toggleTarget, setToggleTarget] = useState<ContaBancaria | null>(null);

  // form
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipo, setTipo] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [status, setStatus] = useState("ativa");

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").order("banco");
      if (error) throw error;
      return data as ContaBancaria[];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome").eq("ativa", true).order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const empresaMap = useMemo(() => {
    const m = new Map<number, string>();
    empresas.forEach((e) => m.set(e.id, e.nome));
    return m;
  }, [empresas]);

  const saveMutation = useMutation({
    mutationFn: async (p: Partial<ContaBancaria> & { id?: string }) => {
      const payload = {
        banco: p.banco!,
        agencia: p.agencia || null,
        conta: p.conta || null,
        tipo: p.tipo || null,
        pix_key: p.pix_key || null,
        empresa_id: p.empresa_id || null,
        status: p.status || "ativa",
      };
      if (p.id) {
        const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas_bancarias").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast.success(editing ? "Conta atualizada" : "Conta criada");
      closeModal();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (c: ContaBancaria) => {
      const next = c.status === "ativa" ? "inativa" : "ativa";
      const { error } = await supabase.from("contas_bancarias").update({ status: next }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast.success("Status atualizado");
      setToggleTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setBanco(""); setAgencia(""); setConta(""); setTipo(""); setPixKey(""); setEmpresaId(""); setStatus("ativa");
    setModalOpen(true);
  }

  function openEdit(c: ContaBancaria) {
    setEditing(c);
    setBanco(c.banco);
    setAgencia(c.agencia || "");
    setConta(c.conta || "");
    setTipo(c.tipo || "");
    setPixKey(c.pix_key || "");
    setEmpresaId(c.empresa_id ? String(c.empresa_id) : "");
    setStatus(c.status || "ativa");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSave() {
    if (!banco.trim()) { toast.error("Banco é obrigatório"); return; }
    saveMutation.mutate({
      id: editing?.id,
      banco: banco.trim(),
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,
      tipo: tipo || null,
      pix_key: pixKey.trim() || null,
      empresa_id: empresaId ? Number(empresaId) : null,
      status,
    });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contas.filter((c) => {
      const matchText = !q || c.banco.toLowerCase().includes(q) || (c.agencia || "").includes(q) || (c.conta || "").includes(q);
      const matchStatus = statusFilter === "todos" || c.status === statusFilter;
      const matchEmpresa = empresaFilter === "todos" || String(c.empresa_id) === empresaFilter;
      return matchText && matchStatus && matchEmpresa;
    });
  }, [contas, search, statusFilter, empresaFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Conta
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar banco, agência ou conta…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="inativa">Inativa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Agência</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</TableCell></TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.banco}</TableCell>
                    <TableCell>{c.agencia || "—"}</TableCell>
                    <TableCell className="tabular-nums">{c.conta || "—"}</TableCell>
                    <TableCell className="capitalize">{c.tipo || "—"}</TableCell>
                    <TableCell>{c.empresa_id ? empresaMap.get(c.empresa_id) || "—" : "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{c.pix_key || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "ativa" ? "success" : "ghost"}>
                        {c.status === "ativa" ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setToggleTarget(c)} title={c.status === "ativa" ? "Inativar" : "Ativar"}><Power className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Conta Bancária" : "Nova Conta Bancária"}</DialogTitle>
            <DialogDescription>{editing ? "Altere os dados e salve." : "Preencha os dados da conta."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Banco *</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input value={conta} onChange={(e) => setConta(e.target.value)} maxLength={30} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chave PIX</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle confirmation */}
      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleTarget?.status === "ativa" ? "Inativar" : "Ativar"} conta?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta {toggleTarget?.banco} {toggleTarget?.conta ? `- ${toggleTarget.conta}` : ""} será {toggleTarget?.status === "ativa" ? "inativada" : "reativada"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleTarget && toggleMutation.mutate(toggleTarget)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
