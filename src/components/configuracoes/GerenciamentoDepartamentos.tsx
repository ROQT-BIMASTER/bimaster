import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAllEmpresas } from "@/hooks/useUserEmpresas";

interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  empresa_id: number | null;
  codigo_integracao: string | null;
}

export function GerenciamentoDepartamentos() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Departamento | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { data: empresas } = useAllEmpresas();

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    ativo: true,
    empresa_id: "",
    codigo_integracao: "",
  });

  useEffect(() => {
    fetchDepartamentos();
  }, []);

  const fetchDepartamentos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("departamentos")
      .select("*")
      .order("nome");

    if (error) {
      toast({ title: "Erro ao carregar departamentos", variant: "destructive" });
    } else {
      setDepartamentos(data || []);
    }
    setLoading(false);
  };

  const handleOpenDialog = (departamento?: Departamento) => {
    if (departamento) {
      setEditando(departamento);
      setFormData({
        nome: departamento.nome,
        descricao: departamento.descricao || "",
        ativo: departamento.ativo,
        empresa_id: departamento.empresa_id ? String(departamento.empresa_id) : "",
        codigo_integracao: departamento.codigo_integracao || "",
      });
    } else {
      setEditando(null);
      setFormData({ nome: "", descricao: "", ativo: true, empresa_id: "", codigo_integracao: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);

    const payload = {
      nome: formData.nome,
      descricao: formData.descricao || null,
      ativo: formData.ativo,
      empresa_id: formData.empresa_id ? parseInt(formData.empresa_id, 10) : null,
      codigo_integracao: formData.codigo_integracao.trim() || null,
    };

    if (editando) {
      const { error } = await supabase
        .from("departamentos")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editando.id);

      if (error) {
        toast({ title: "Erro ao atualizar departamento", variant: "destructive" });
      } else {
        toast({ title: "Departamento atualizado com sucesso" });
        setDialogOpen(false);
        fetchDepartamentos();
      }
    } else {
      const { error } = await supabase
        .from("departamentos")
        .insert(payload);

      if (error) {
        toast({ title: "Erro ao criar departamento", variant: "destructive" });
      } else {
        toast({ title: "Departamento criado com sucesso" });
        setDialogOpen(false);
        fetchDepartamentos();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este departamento?")) return;

    const { error } = await supabase
      .from("departamentos")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao excluir departamento", description: "Pode haver usuários vinculados", variant: "destructive" });
    } else {
      toast({ title: "Departamento excluído com sucesso" });
      fetchDepartamentos();
    }
  };

  const getEmpresaNome = (empresaId: number | null) => {
    if (!empresaId || !empresas) return null;
    return empresas.find(e => e.id === empresaId)?.nome || null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Gerenciamento de Departamentos
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Departamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editando ? "Editar Departamento" : "Novo Departamento"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Trade Marketing"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select
                    value={formData.empresa_id}
                    onValueChange={(val) => setFormData({ ...formData, empresa_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas (sem vínculo)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas (sem vínculo)</SelectItem>
                      {empresas?.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_integracao">Cód. Integração</Label>
                  <Input
                    id="codigo_integracao"
                    value={formData.codigo_integracao}
                    onChange={(e) => setFormData({ ...formData, codigo_integracao: e.target.value })}
                    placeholder="Ex: DEP-001"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição do departamento..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editando ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cód. Integração</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum departamento cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                departamentos.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {getEmpresaNome(dept.empresa_id) || (
                        <span className="text-xs italic">Todas</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {dept.codigo_integracao || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dept.descricao || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dept.ativo ? "success" : "destructive"} className="text-xs">
                        {dept.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(dept)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(dept.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
