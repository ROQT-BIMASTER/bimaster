import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Landmark, Plus, Search, Pencil, Power, Building2, CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Switch } from "@/components/ui/switch";
import { ErpBadge } from "@/components/cadastros/ErpBadge";

type Portador = {
  id: string;
  empresa_id: number | null;
  nome: string;
  banco_codigo: string | null;
  banco_nome: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  codigo_erp: string | null;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type Empresa = { id: number; nome: string };

const TIPOS = [
  { value: "cobranca", label: "Cobrança" },
  { value: "carteira", label: "Carteira" },
  { value: "custodia", label: "Custódia" },
  { value: "outros", label: "Outros" },
];

export default function Portadores() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Portador | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Portador | null>(null);

  // form
  const [nome, setNome] = useState("");
  const [bancoNome, setBancoNome] = useState("");
  const [bancoCodigo, setBancoCodigo] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipo, setTipo] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [ativo, setAtivo] = useState(true);

  const { data: portadores = [], isLoading } = useQuery({
    queryKey: ["portadores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("portadores").select("*").order("nome");
      if (error) throw error;
      return data as Portador[];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas").select("id, nome").eq("ativa", true).order("nome");
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
    mutationFn: async (p: Partial<Portador> & { id?: string }) => {
      const payload = {
        nome: p.nome!,
        banco_nome: p.banco_nome || null,
        banco_codigo: p.banco_codigo || null,
        agencia: p.agencia || null,
        conta: p.conta || null,
        tipo: p.tipo || null,
        empresa_id: p.empresa_id ?? null,
        ativo: p.ativo ?? true,
      };
      if (p.id) {
        const { error } = await supabase.from("portadores").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("portadores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portadores"] });
      toast.success(editing ? "Portador atualizado" : "Portador criado");
      closeModal();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (p: Portador) => {
      const { error } = await supabase.from("portadores").update({ ativo: !p.ativo }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portadores"] });
      toast.success("Status atualizado");
      setToggleTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setNome(""); setBancoNome(""); setBancoCodigo("");
    setAgencia(""); setConta(""); setTipo("");
    setEmpresaId(""); setAtivo(true);
    setModalOpen(true);
  }

  function openEdit(p: Portador) {
    setEditing(p);
    setNome(p.nome);
    setBancoNome(p.banco_nome || "");
    setBancoCodigo(p.banco_codigo || "");
    setAgencia(p.agencia || "");
    setConta(p.conta || "");
    setTipo(p.tipo || "");
    setEmpresaId(p.empresa_id ? String(p.empresa_id) : "");
    setAtivo(p.ativo);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSave() {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    saveMutation.mutate({
      id: editing?.id,
      nome: nome.trim(),
      banco_nome: bancoNome.trim() || null,
      banco_codigo: bancoCodigo.trim() || null,
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,
      tipo: tipo || null,
      empresa_id: empresaId ? Number(empresaId) : null,
      ativo,
    });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return portadores
      .filter((p) => {
        const matchText = !q ||
          p.nome.toLowerCase().includes(q) ||
          (p.banco_nome || "").toLowerCase().includes(q) ||
          (p.banco_codigo || "").includes(q) ||
          (p.conta || "").includes(q);
        const matchStatus = statusFilter === "todos" ||
          (statusFilter === "ativos" ? p.ativo : !p.ativo);
        const matchEmpresa = empresaFilter === "todos" || String(p.empresa_id) === empresaFilter;
        return matchText && matchStatus && matchEmpresa;
      })
      .sort((a, b) => {
        if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
        return a.nome.localeCompare(b.nome);
      });
  }, [portadores, search, statusFilter, empresaFilter]);

  const stats = useMemo(() => {
    const ativos = portadores.filter((p) => p.ativo).length;
    const comErp = portadores.filter((p) => !!p.codigo_erp).length;
    return {
      total: portadores.length,
      ativos,
      inativos: portadores.length - ativos,
      comErp,
    };
  }, [portadores]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Portadores"
        description="Cadastro de portadores usados em cobrança e integração com o ERP"
        icon={Landmark}
        breadcrumbs={[
          { label: "Cadastros" },
          { label: "Portadores" },
        ]}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Portador
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total" value={stats.total} icon={Landmark} variant="info" loading={isLoading} />
        <KpiCard title="Ativos" value={stats.ativos} icon={CheckCircle2} variant="success" loading={isLoading} />
        <KpiCard title="Inativos" value={stats.inativos} icon={XCircle} variant="default" loading={isLoading} />
        <KpiCard title="Vindos do Result" value={stats.comErp} icon={Building2} variant="accent" loading={isLoading} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, banco, agência ou conta…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar portadores"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
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

      {!isLoading && portadores.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Landmark}
              title="Nenhum portador cadastrado"
              description="Cadastre o primeiro portador para começar a emitir cobranças e habilitar a integração com o ERP."
              actionLabel="Cadastrar primeiro portador"
              onAction={openCreate}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Agência</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>ERP</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum portador encontrado com os filtros atuais</TableCell></TableRow>
                ) : filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      {p.banco_codigo || p.banco_nome ? (
                        <span>
                          {p.banco_codigo && <span className="font-mono text-muted-foreground mr-1">{p.banco_codigo}</span>}
                          {p.banco_nome || "—"}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{p.agencia || "—"}</TableCell>
                    <TableCell className="tabular-nums">{p.conta || "—"}</TableCell>
                    <TableCell className="capitalize">{p.tipo || "—"}</TableCell>
                    <TableCell>{p.empresa_id ? empresaMap.get(p.empresa_id) || "—" : "—"}</TableCell>
                    <TableCell><ErpBadge code={p.codigo_erp} showCode /></TableCell>
                    <TableCell>
                      <Badge variant={p.ativo ? "success" : "secondary"}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setToggleTarget(p)} title={p.ativo ? "Inativar" : "Ativar"}>
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Portador" : "Novo Portador"}</DialogTitle>
            <DialogDescription>
              {editing ? "Altere os dados e salve." : "Preencha os dados do portador."}
            </DialogDescription>
          </DialogHeader>

          {editing?.codigo_erp && (
            <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <span>Origem ERP:</span>
              <ErpBadge code={editing.codigo_erp} showCode />
              <span className="ml-auto italic">Código do ERP é somente leitura</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={150} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Cód. Banco</Label>
                <Input value={bancoCodigo} onChange={(e) => setBancoCodigo(e.target.value)} maxLength={10} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Banco</Label>
                <Input value={bancoNome} onChange={(e) => setBancoNome(e.target.value)} maxLength={100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input value={conta} onChange={(e) => setConta(e.target.value)} maxLength={30} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label>Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label className="cursor-pointer">Ativo</Label>
                <p className="text-xs text-muted-foreground">Desative para ocultar em novos lançamentos.</p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
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

      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleTarget?.ativo ? "Inativar" : "Ativar"} portador?</AlertDialogTitle>
            <AlertDialogDescription>
              O portador "{toggleTarget?.nome}" será {toggleTarget?.ativo ? "inativado" : "reativado"}.
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
    </div>
  );
}
