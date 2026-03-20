import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Plus, Search, Pencil, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

interface Fornecedor {
  id: string;
  empresa_id: number | null;
  nome: string;
  cnpj: string;
  razao_social: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  codigo_externo: string | null;
  fonte_erp: string | null;
  status: string;
  created_at: string;
}

interface FornecedorForm {
  nome: string;
  cnpj: string;
  razao_social: string;
  email: string;
  telefone: string;
  endereco: string;
  empresa_id: string;
  codigo_externo: string;
  fonte_erp: string;
  status: string;
}

const emptyForm: FornecedorForm = {
  nome: "", cnpj: "", razao_social: "", email: "", telefone: "",
  endereco: "", empresa_id: "", codigo_externo: "", fonte_erp: "", status: "ativo",
};

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (base: number) => {
    let sum = 0;
    let weight = base;
    for (let i = 0; i < base - 1; i++) {
      sum += parseInt(digits[i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(13) === parseInt(digits[12]) && calc(14) === parseInt(digits[13]);
}

export default function Fornecedores() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FornecedorForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [upsertConfirm, setUpsertConfirm] = useState<{ existingId: string } | null>(null);

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores", search, statusFilter, empresaFilter],
    queryFn: async () => {
      let query = supabase.from("fornecedores").select("*").order("nome");
      if (search) query = query.or(`nome.ilike.%${search}%,cnpj.ilike.%${search}%`);
      if (statusFilter !== "todos") query = query.eq("status", statusFilter);
      if (empresaFilter !== "todas") query = query.eq("empresa_id", parseInt(empresaFilter));
      const { data, error } = await query;
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-select"],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id, nome").order("nome");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Record<string, unknown>; id?: string }) => {
      if (id) {
        const { error } = await supabase.from("fornecedores").update(data as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      toast.success(editingId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("fornecedores").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Status atualizado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleOpenNew = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };

  const handleEdit = (f: Fornecedor) => {
    setForm({
      nome: f.nome, cnpj: f.cnpj, razao_social: f.razao_social || "",
      email: f.email || "", telefone: f.telefone || "", endereco: f.endereco || "",
      empresa_id: f.empresa_id?.toString() || "", codigo_externo: f.codigo_externo || "",
      fonte_erp: f.fonte_erp || "", status: f.status,
    });
    setEditingId(f.id);
    setDialogOpen(true);
  };

  const buildPayload = useCallback(() => {
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    return {
      nome: form.nome.trim(),
      cnpj: cnpjDigits,
      razao_social: form.razao_social.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      empresa_id: form.empresa_id ? parseInt(form.empresa_id) : null,
      codigo_externo: form.codigo_externo.trim() || null,
      fonte_erp: form.fonte_erp.trim() || null,
      status: form.status,
      updated_at: new Date().toISOString(),
    };
  }, [form]);

  const handleSave = async () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!validateCNPJ(form.cnpj)) return toast.error("CNPJ inválido");

    const cnpjDigits = form.cnpj.replace(/\D/g, "");

    if (!editingId) {
      const { data: existing } = await supabase.from("fornecedores").select("id").eq("cnpj", cnpjDigits).maybeSingle();
      if (existing) {
        setUpsertConfirm({ existingId: existing.id });
        return;
      }
    }

    saveMutation.mutate({ data: buildPayload(), id: editingId || undefined });
  };

  const handleUpsertConfirm = () => {
    if (!upsertConfirm) return;
    saveMutation.mutate({ data: buildPayload(), id: upsertConfirm.existingId });
    setUpsertConfirm(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      ativo: { variant: "default", label: "Ativo" },
      inativo: { variant: "secondary", label: "Inativo" },
      bloqueado: { variant: "destructive", label: "Bloqueado" },
    };
    const s = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const empresaNome = (empresaId: number | null) => {
    if (!empresaId) return "—";
    const e = empresas.find((emp: any) => emp.id === empresaId);
    return e ? e.nome : `#${empresaId}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Fornecedores</h1>
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Fornecedor
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Empresas</SelectItem>
                {empresas.map((e: any) => (
                  <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : fornecedores.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum fornecedor encontrado</TableCell></TableRow>
              ) : (
                fornecedores.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="text-sm">{formatCNPJ(f.cnpj)}</TableCell>
                    <TableCell className="text-sm">{f.email || "—"}</TableCell>
                    <TableCell className="text-sm">{f.telefone || "—"}</TableCell>
                    <TableCell className="text-sm">{empresaNome(f.empresa_id)}</TableCell>
                    <TableCell>{statusBadge(f.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(f)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => toggleMutation.mutate({ id: f.id, newStatus: f.status === "ativo" ? "bloqueado" : "ativo" })}
                          title={f.status === "ativo" ? "Bloquear" : "Ativar"}
                        >
                          {f.status === "ativo" ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogDescription>Preencha os dados do fornecedor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="XX.XXX.XXX/XXXX-XX" maxLength={18} />
            </div>
            <div className="grid gap-1.5">
              <Label>Razão Social</Label>
              <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Empresa</Label>
              <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e: any) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Código Externo</Label>
                <Input value={form.codigo_externo} onChange={(e) => setForm({ ...form, codigo_externo: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Fonte ERP</Label>
                <Input value={form.fonte_erp} onChange={(e) => setForm({ ...form, fonte_erp: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upsert Confirmation */}
      <AlertDialog open={!!upsertConfirm} onOpenChange={(o) => !o && setUpsertConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>CNPJ já cadastrado</AlertDialogTitle>
            <AlertDialogDescription>
              Este CNPJ já pertence a um fornecedor existente. Deseja atualizar o cadastro com os novos dados?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpsertConfirm}>Atualizar Existente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
