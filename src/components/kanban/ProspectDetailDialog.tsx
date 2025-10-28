import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Trash2, UserCircle } from "lucide-react";

interface Prospect {
  id: string;
  nome_empresa: string;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  municipio?: string | null;
  uf?: string | null;
  tipo_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  cep?: string | null;
  bairro?: string | null;
  porte_empresa: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  municipio_id: string | null;
  vendedor?: {
    nome: string;
  } | null;
}

interface ProspectDetailDialogProps {
  prospect: Prospect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const ProspectDetailDialog = ({ prospect, open, onOpenChange, onUpdate }: ProspectDetailDialogProps) => {
  const [formData, setFormData] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    if (prospect) {
      setFormData(prospect);
    }
  }, [prospect]);

  const handleSave = async () => {
    if (!formData) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("prospects")
        .update({
          nome_empresa: formData.nome_empresa,
          contato_principal: formData.contato_principal,
          email: formData.email,
          telefone: formData.telefone,
          cnpj: formData.cnpj,
          endereco: formData.endereco,
          municipio: formData.municipio,
          uf: formData.uf,
          tipo_logradouro: formData.tipo_logradouro,
          logradouro: formData.logradouro,
          numero: formData.numero,
          cep: formData.cep,
          bairro: formData.bairro,
          porte_empresa: formData.porte_empresa,
          status: formData.status as "novo" | "em_contato" | "proposta_enviada" | "negociacao" | "ganho" | "perdido",
          categoria: formData.categoria as "A" | "B" | "C" | "D" | null,
          ultimo_contato: formData.ultimo_contato,
          proxima_acao: formData.proxima_acao,
          observacoes: formData.observacoes,
        })
        .eq("id", formData.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Prospect atualizado com sucesso",
      });
      
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao atualizar prospect:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o prospect",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!formData) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("prospects")
        .delete()
        .eq("id", formData.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Prospect excluído com sucesso",
      });
      
      onUpdate();
      onOpenChange(false);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Erro ao excluir prospect:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o prospect",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Prospect</DialogTitle>
          {formData.vendedor && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <UserCircle className="h-4 w-4" />
              <span>Responsável:</span>
              <Badge variant="secondary">{formData.vendedor.nome}</Badge>
            </div>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
            <Input
              id="nome_empresa"
              value={formData.nome_empresa}
              onChange={(e) => setFormData({ ...formData, nome_empresa: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
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

            <div className="grid gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria || ""}
                onValueChange={(value) => setFormData({ ...formData, categoria: value || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Alta Prioridade</SelectItem>
                  <SelectItem value="B">B - Média Prioridade</SelectItem>
                  <SelectItem value="C">C - Baixa Prioridade</SelectItem>
                  <SelectItem value="D">D - Mínima Prioridade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contato_principal">Contato Principal</Label>
              <Input
                id="contato_principal"
                value={formData.contato_principal || ""}
                onChange={(e) => setFormData({ ...formData, contato_principal: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj || ""}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone || ""}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="municipio">Município</Label>
              <Input
                id="municipio"
                value={formData.municipio || ""}
                onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                placeholder="Digite o município"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                value={formData.uf || ""}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                placeholder="Ex: PE"
                maxLength={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tipo_logradouro">Tipo de Logradouro</Label>
              <Input
                id="tipo_logradouro"
                value={formData.tipo_logradouro || ""}
                onChange={(e) => setFormData({ ...formData, tipo_logradouro: e.target.value })}
                placeholder="Ex: Rua, Av"
              />
            </div>

            <div className="grid gap-2 col-span-2">
              <Label htmlFor="logradouro">Logradouro</Label>
              <Input
                id="logradouro"
                value={formData.logradouro || ""}
                onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                placeholder="Nome da rua"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={formData.numero || ""}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="Nº"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep || ""}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                placeholder="00000-000"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={formData.bairro || ""}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                placeholder="Nome do bairro"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="endereco">Endereço Completo (legado)</Label>
            <Input
              id="endereco"
              value={formData.endereco || ""}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Rua, número, bairro"
              className="text-muted-foreground"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="porte_empresa">Porte da Empresa</Label>
            <Select
              value={formData.porte_empresa || ""}
              onValueChange={(value) => setFormData({ ...formData, porte_empresa: value || null })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione o porte" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="Micro">Microempresa</SelectItem>
                <SelectItem value="Pequena">Pequena</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Grande">Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ultimo_contato">Último Contato</Label>
              <Input
                id="ultimo_contato"
                type="date"
                value={formData.ultimo_contato || ""}
                onChange={(e) => setFormData({ ...formData, ultimo_contato: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proxima_acao">Próxima Ação</Label>
              <Input
                id="proxima_acao"
                type="date"
                value={formData.proxima_acao || ""}
                onChange={(e) => setFormData({ ...formData, proxima_acao: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              rows={4}
              value={formData.observacoes || ""}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {isAdmin && (
            <Button 
              variant="destructive" 
              onClick={() => setDeleteDialogOpen(true)}
              disabled={loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o prospect "{formData?.nome_empresa}"? 
              Esta ação não pode ser desfeita e todas as atividades relacionadas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
