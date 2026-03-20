import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Plus, Search, Pencil, Power } from "lucide-react";
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

type Empresa = {
  id: number;
  nome: string;
  cnpj: string | null;
  uf: string | null;
  ativa: boolean | null;
  created_at: string | null;
};

/* ── CNPJ helpers ── */
function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function unmaskCnpj(v: string) {
  return v.replace(/\D/g, "");
}

function validateCnpj(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (size: number) => {
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += Number(d[size - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

function formatCnpjDisplay(cnpj: string | null) {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return maskCnpj(d);
}

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export default function Empresas() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Empresa | null>(null);
  const [upsertTarget, setUpsertTarget] = useState<Empresa | null>(null);

  // form state
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [uf, setUf] = useState("");
  const [ativa, setAtiva] = useState(true);

  /* ── queries ── */
  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  /* ── mutations ── */
  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: number; nome: string; cnpj: string | null; uf: string | null; ativa: boolean }) => {
      if (payload.id) {
        const { error } = await supabase.from("empresas").update({
          nome: payload.nome, cnpj: payload.cnpj, uf: payload.uf, ativa: payload.ativa,
        }).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empresas").insert({
          nome: payload.nome, cnpj: payload.cnpj, uf: payload.uf, ativa: payload.ativa,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success(editing ? "Empresa atualizada" : "Empresa criada");
      closeModal();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (emp: Empresa) => {
      const { error } = await supabase.from("empresas").update({ ativa: !emp.ativa }).eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Status atualizado");
      setToggleTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  /* ── helpers ── */
  function openCreate() {
    setEditing(null);
    setNome(""); setCnpj(""); setUf(""); setAtiva(true);
    setModalOpen(true);
  }

  function openEdit(emp: Empresa) {
    setEditing(emp);
    setNome(emp.nome);
    setCnpj(emp.cnpj ? maskCnpj(emp.cnpj.replace(/\D/g, "")) : "");
    setUf(emp.uf || "");
    setAtiva(emp.ativa ?? true);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setUpsertTarget(null);
  }

  async function handleSave() {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const rawCnpj = unmaskCnpj(cnpj);
    const cnpjVal = rawCnpj.length > 0 ? rawCnpj : null;

    if (cnpjVal && !validateCnpj(cnpjVal)) {
      toast.error("CNPJ inválido"); return;
    }

    // Dedup check on create
    if (!editing && cnpjVal) {
      const { data: existing } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("cnpj", cnpjVal)
        .maybeSingle();
      if (existing) {
        setUpsertTarget(existing as Empresa);
        return;
      }
    }

    saveMutation.mutate({
      id: editing?.id,
      nome: nome.trim(),
      cnpj: cnpjVal,
      uf: uf || null,
      ativa,
    });
  }

  function confirmUpsert() {
    if (!upsertTarget) return;
    saveMutation.mutate({
      id: upsertTarget.id,
      nome: nome.trim(),
      cnpj: unmaskCnpj(cnpj) || null,
      uf: uf || null,
      ativa,
    });
    setUpsertTarget(null);
  }

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return empresas.filter((e) => {
      const matchText = !q || e.nome.toLowerCase().includes(q) || (e.cnpj || "").includes(q);
      const matchStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativo" && e.ativa) ||
        (statusFilter === "inativo" && !e.ativa);
      return matchText && matchStatus;
    });
  }, [empresas, search, statusFilter]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Empresas</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Empresa
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CNPJ…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
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
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.nome}</TableCell>
                    <TableCell className="tabular-nums">{formatCnpjDisplay(emp.cnpj)}</TableCell>
                    <TableCell>{emp.uf || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={emp.ativa ? "success" : "ghost"}>
                        {emp.ativa ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setToggleTarget(emp)} title={emp.ativa ? "Inativar" : "Ativar"}>
                          <Power className="h-4 w-4" />
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

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            <DialogDescription>
              {editing ? "Altere os dados e salve." : "Preencha os dados da nova empresa."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="emp-nome">Nome *</Label>
              <Input id="emp-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-cnpj">CNPJ</Label>
              <Input
                id="emp-cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                placeholder="XX.XXX.XXX/XXXX-XX"
                maxLength={18}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-uf">UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger id="emp-uf">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toggle status confirmation ── */}
      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.ativa ? "Inativar" : "Ativar"} empresa?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.ativa
                ? `A empresa "${toggleTarget?.nome}" será inativada.`
                : `A empresa "${toggleTarget?.nome}" será reativada.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleTarget && toggleMutation.mutate(toggleTarget)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Upsert confirmation ── */}
      <AlertDialog open={!!upsertTarget} onOpenChange={(o) => !o && setUpsertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>CNPJ já cadastrado</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe a empresa "{upsertTarget?.nome}" com este CNPJ. Deseja atualizar o cadastro existente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpsert}>Atualizar existente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
