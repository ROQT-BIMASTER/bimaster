import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { prospectSchema } from "@/lib/validations/prospect";

interface NovoProspectDialogProps {
  onSuccess: () => void;
}

export const NovoProspectDialog = ({ onSuccess }: NovoProspectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nome_empresa: "",
    cnpj: "",
    contato_principal: "",
    email: "",
    telefone: "",
    status: "novo",
    categoria: "",
    observacoes: "",
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validatedData = prospectSchema.parse(formData);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("prospects").insert([
        {
          nome_empresa: validatedData.nome_empresa,
          vendedor_id: user.id,
          status: validatedData.status as "novo" | "em_contato" | "proposta_enviada" | "negociacao" | "ganho" | "perdido",
          cnpj: validatedData.cnpj || null,
          contato_principal: validatedData.contato_principal || null,
          email: validatedData.email || null,
          telefone: validatedData.telefone || null,
          categoria: (validatedData.categoria || null) as "A" | "B" | "C" | "D" | null,
          observacoes: validatedData.observacoes || null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Prospect validado e criado com sucesso",
      });

      setFormData({
        nome_empresa: "",
        cnpj: "",
        contato_principal: "",
        email: "",
        telefone: "",
        status: "novo",
        categoria: "",
        observacoes: "",
      });
      
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      if (error.errors) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
        toast({
          title: "Erro de validação",
          description: "Verifique os campos destacados",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error.message || "Não foi possível criar o prospect",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Prospect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Prospect</DialogTitle>
          <DialogDescription>
            Cadastre um novo prospect no sistema
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
              <Input
                id="nome_empresa"
                value={formData.nome_empresa}
                onChange={(e) => setFormData({ ...formData, nome_empresa: e.target.value })}
                required
                placeholder="Ex: Empresa XYZ Ltda"
                maxLength={200}
              />
              {errors.nome_empresa && <p className="text-sm text-destructive">{errors.nome_empresa}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
              {errors.cnpj && <p className="text-sm text-destructive">{errors.cnpj}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contato_principal">Contato Principal</Label>
              <Input
                id="contato_principal"
                value={formData.contato_principal}
                onChange={(e) => setFormData({ ...formData, contato_principal: e.target.value })}
                placeholder="Nome do contato"
                maxLength={100}
              />
              {errors.contato_principal && <p className="text-sm text-destructive">{errors.contato_principal}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@empresa.com"
                maxLength={255}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
              {errors.telefone && <p className="text-sm text-destructive">{errors.telefone}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_contato">Em Contato</SelectItem>
                  <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                  <SelectItem value="negociacao">Negociação</SelectItem>
                  <SelectItem value="ganho">Ganho</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                </SelectContent>
            </Select>
            {errors.categoria && <p className="text-sm text-destructive">{errors.categoria}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre o prospect"
              rows={3}
              maxLength={1000}
            />
            {errors.observacoes && <p className="text-sm text-destructive">{errors.observacoes}</p>}
            <p className="text-xs text-muted-foreground">{formData.observacoes.length}/1000 caracteres</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Prospect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
