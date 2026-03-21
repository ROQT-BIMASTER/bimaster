import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTradeMateriais, useDeleteMaterial, useUpdateMaterial, type TradeMaterial } from "@/hooks/useTradeMateriais";
import { MaterialFormDialog } from "@/components/trade/materiais/MaterialFormDialog";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Package, AlertTriangle, CheckCircle, XCircle, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS = ["Todos", "Banner PDV", "Display de chão", "Wobbler", "Adesivo", "Totem", "Faixa de gôndola", "Stopper", "Outros"];

function estoqueStatus(m: TradeMaterial) {
  if (m.estoque_atual <= 0) return { label: "Esgotado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (m.estoque_atual <= m.estoque_minimo) return { label: "Baixo", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return { label: "Normal", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
}

export default function TradeMateriaisAdmin() {
  const { data: materiais, isLoading } = useTradeMateriais();
  const deleteMaterial = useDeleteMaterial();
  const updateMaterial = useUpdateMaterial();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TradeMaterial | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const filtered = (materiais || []).filter(m => {
    if (search && !m.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "Todos" && m.categoria !== catFilter) return false;
    if (statusFilter === "Ativo" && !m.ativo) return false;
    if (statusFilter === "Inativo" && m.ativo) return false;
    if (statusFilter === "Esgotado" && m.estoque_atual > 0) return false;
    if (statusFilter === "Baixo" && (m.estoque_atual > m.estoque_minimo || m.estoque_atual <= 0)) return false;
    return true;
  });

  const handleEdit = (m: TradeMaterial) => { setEditing(m); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setDialogOpen(true); };

  const handleDuplicate = async (m: TradeMaterial) => {
    const { id, created_at, updated_at, ...rest } = m;
    await updateMaterial.mutateAsync({ id: "", ...rest, nome: m.nome + " (cópia)" } as any);
  };

  const handleDelete = async (m: TradeMaterial) => {
    if (!confirm(`Excluir "${m.nome}"?`)) return;
    await deleteMaterial.mutateAsync(m.id);
  };

  const handleToggle = async (m: TradeMaterial) => {
    await updateMaterial.mutateAsync({ id: m.id, ativo: !m.ativo });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/trade/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Catálogo de Materiais</h1>
            <p className="text-sm text-muted-foreground">Gerencie os materiais de trade disponíveis para solicitação</p>
          </div>
          <Button onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Material
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {["Todos", "Ativo", "Inativo", "Esgotado", "Baixo"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{materiais?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{materiais?.filter(m => m.ativo).length || 0}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
            <p className="text-2xl font-bold">{materiais?.filter(m => m.estoque_atual > 0 && m.estoque_atual <= m.estoque_minimo).length || 0}</p>
            <p className="text-xs text-muted-foreground">Estoque Baixo</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
            <p className="text-2xl font-bold">{materiais?.filter(m => m.estoque_atual <= 0).length || 0}</p>
            <p className="text-xs text-muted-foreground">Esgotados</p>
          </CardContent></Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Nenhum material encontrado</p>
                <Button variant="outline" className="mt-3" onClick={handleNew}>Criar primeiro material</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(m => {
                    const est = estoqueStatus(m);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {m.foto_url ? (
                              <img src={m.foto_url} alt={m.nome} className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium">{m.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{m.categoria}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{m.estoque_atual}/{m.estoque_total}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${est.color}`}>{est.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={m.ativo ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => handleToggle(m)}
                          >
                            {m.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <MaterialFormDialog open={dialogOpen} onOpenChange={setDialogOpen} material={editing} />
    </DashboardLayout>
  );
}
