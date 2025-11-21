import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";

interface NCM {
  id: string;
  codigo: string;
  descricao: string;
  unidade_padrao: string | null;
  ex: string | null;
  ativo: boolean;
  observacoes: string | null;
}

export function CadastroNCMDialog() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [ncms, setNcms] = useState<NCM[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    codigo: "",
    descricao: "",
    unidade_padrao: "UN",
    ex: "",
    ativo: true,
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      carregarNCMs();
    }
  }, [open]);

  const carregarNCMs = async () => {
    try {
      const { data, error } = await supabase
        .from("fabrica_ncm")
        .select("*")
        .order("codigo");

      if (error) throw error;
      setNcms(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar NCMs:", error);
      toast.error("Erro ao carregar NCMs");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        ...formData,
        created_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from("fabrica_ncm")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("NCM atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("fabrica_ncm")
          .insert([payload]);

        if (error) throw error;
        toast.success("NCM cadastrado com sucesso!");
      }

      setEditOpen(false);
      setEditingId(null);
      resetForm();
      carregarNCMs();
    } catch (error: any) {
      console.error("Erro ao salvar NCM:", error);
      toast.error("Erro ao salvar NCM");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ncm: NCM) => {
    setEditingId(ncm.id);
    setFormData({
      codigo: ncm.codigo,
      descricao: ncm.descricao,
      unidade_padrao: ncm.unidade_padrao || "UN",
      ex: ncm.ex || "",
      ativo: ncm.ativo,
      observacoes: ncm.observacoes || "",
    });
    setEditOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este NCM?")) return;

    try {
      const { error } = await supabase
        .from("fabrica_ncm")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("NCM excluído com sucesso!");
      carregarNCMs();
    } catch (error: any) {
      console.error("Erro ao excluir NCM:", error);
      toast.error("Erro ao excluir NCM");
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: "",
      descricao: "",
      unidade_padrao: "UN",
      ex: "",
      ativo: true,
      observacoes: "",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Cadastro de NCM
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Cadastro de NCM</span>
              <Button onClick={() => { resetForm(); setEditingId(null); setEditOpen(true); }} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo NCM
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código NCM</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>UN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ncms.map((ncm) => (
                  <TableRow key={ncm.id}>
                    <TableCell className="font-mono">{ncm.codigo}</TableCell>
                    <TableCell>{ncm.descricao}</TableCell>
                    <TableCell>{ncm.unidade_padrao}</TableCell>
                    <TableCell>
                      <span className={ncm.ativo ? "text-green-600" : "text-red-600"}>
                        {ncm.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(ncm)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(ncm.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar NCM" : "Novo NCM"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Código NCM *</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="0000.00.00"
                required
              />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                required
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unidade Padrão</Label>
                <Input
                  value={formData.unidade_padrao}
                  onChange={(e) => setFormData({ ...formData, unidade_padrao: e.target.value })}
                  placeholder="UN, KG, L"
                />
              </div>
              <div>
                <Label>EX (Exceção)</Label>
                <Input
                  value={formData.ex}
                  onChange={(e) => setFormData({ ...formData, ex: e.target.value })}
                  placeholder="00, 01"
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked as boolean })}
              />
              <Label htmlFor="ativo">NCM Ativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setEditOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
