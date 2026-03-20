import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LayoutGrid, Plus, Search, Pencil, Power } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

type CentroCusto = {
  id: string;
  empresa_id: number | null;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Empresa = { id: number; nome: string };

export default function CentrosCusto() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CentroCusto | null>(null);
  const [toggleTarget, setToggleTarget] = useState<CentroCusto | null>(null);

  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [empresaId, setEmpresaId] = useState("");

  const { data: centros = [], isLoading } = useQuery({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("centros_custo").select("*").order("nome");
      if (error) throw error;
      return data as CentroCusto[];
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
    mutationFn: async (p: Partial<CentroCusto> & { id?: string }) => {
      const payload = {
        nome: p.nome!,
        codigo: p.codigo || null,
        descricao: p.descricao || null,
        empresa_id: p.empresa_id || null,
      };
      if (p.id) {
        const { error } = await supabase.from("centros_custo").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("centros_custo").insert({ ...payload, status: "ativo" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success(editing ? "Centro de custo atualizado" : "Centro de custo criado");
      closeModal();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (c: CentroCusto) => {
      const next = c.status === "ativo" ? "inativo" : "ativo";
      const { error } = await supabase.from("centros_custo").update({ status: next }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Status atualizado");
      setToggleTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setNome(""); setCodigo(""); setDescricao(""); setEmpresaId("");
    setModalOpen(true);
  }

  function openEdit(c: CentroCusto) {
    setEditing(c);
    setNome(c.nome);
    setCodigo(c.codigo || "");
    setDescricao(c.descricao || "");
    setEmpresaId(c.empresa_id ? String(c.empresa_id) : "");
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSave() {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    saveMutation.mutate({
      id: editing?.id,
      nome: nome.trim(),
      codigo: codigo.trim() || null,
      descricao: descricao.trim() || null,
      empresa_id: empresaId ? Number(empresaId) : null,
    });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return centros.filter((c) => {
      const matchText = !q || c.nome.toLowerCase().includes(q) || (c.codigo || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "todos" || c.status === statusFilter;
      const matchEmpresa = empresaFilter === "todos" || String(c.empresa_id) === empresaFilter;
      return matchText && matchStatus && matchEmpresa;
    });
  }, [centros, search, statusFilter, empresaFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Centros de Custo</h1>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Novo Centro</Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou código…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas empresas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum centro de custo encontrado</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.codigo || "—"}</TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="max-w-[250px] truncate text-muted-foreground">{c.descricao || "—"}</TableCell>
                  <TableCell>{c.empresa_id ? empresaMap.get(c.empresa_id) || "—" : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "ativo" ? "success" : "ghost"}>
                      {c.status === "ativo" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setToggleTarget(c)} title={c.status === "ativo" ? "Inativar" : "Ativar"}><Power className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
            <DialogDescription>{editing ? "Altere os dados e salve." : "Preencha os dados do centro de custo."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
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

      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleTarget?.status === "ativo" ? "Inativar" : "Ativar"} centro de custo?</AlertDialogTitle>
            <AlertDialogDescription>
              O centro "{toggleTarget?.nome}" será {toggleTarget?.status === "ativo" ? "inativado" : "reativado"}.
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