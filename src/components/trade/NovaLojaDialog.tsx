import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { NovaCategoriaDialog } from "./NovaCategoriaDialog";
import { NovaRedeDialog } from "./NovaRedeDialog";

interface NovaLojaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newStoreId?: string) => void;
}

export const NovaLojaDialog = ({ open, onOpenChange, onSuccess }: NovaLojaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [showCategoriaDialog, setShowCategoriaDialog] = useState(false);
  const [showRedeDialog, setShowRedeDialog] = useState(false);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [supervisores, setSupervisores] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    chain: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    category: "",
    priority: "media",
    manager_name: "",
    manager_phone: "",
    notes: "",
    vendedor_id: "",
    supervisor_id: "",
  });

  // Carregar vendedores e supervisores quando o dialog abre
  useEffect(() => {
    if (open) {
      fetchUsuarios();
      fetchCurrentUser();
    }
  }, [open]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setCurrentUserRole(roleData?.role || null);

      // Se for vendedor ou promotor, já seleciona ele mesmo
      if (roleData?.role === 'vendedor' || roleData?.role === 'promotor') {
        setFormData(prev => ({ ...prev, vendedor_id: user.id }));
      }
    } catch (error) {
      console.error("Erro ao buscar usuário atual:", error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("status", "ativo")
        .order("nome");

      if (!profiles) return;

      const userIds = profiles.map(p => p.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const vendedoresList = profiles
        .filter(p => {
          const role = roleMap.get(p.id);
          return role === 'vendedor' || role === 'promotor';
        })
        .map(p => ({ ...p, role: roleMap.get(p.id) }));

      const supervisoresList = profiles
        .filter(p => {
          const role = roleMap.get(p.id);
          return role === 'supervisor' || role === 'admin';
        })
        .map(p => ({ ...p, role: roleMap.get(p.id) }));

      setVendedores(vendedoresList);
      setSupervisores(supervisoresList);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error("Nome da loja é obrigatório");
      return;
    }

    if (!formData.vendedor_id) {
      toast.error("Vendedor responsável é obrigatório");
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Buscar supervisor_id do profile do vendedor se não foi informado
      let supervisorId = formData.supervisor_id || null;
      if (!supervisorId && formData.vendedor_id) {
        const { data: vendedorProfile } = await supabase
          .from("profiles")
          .select("supervisor_id")
          .eq("id", formData.vendedor_id)
          .single();
        
        supervisorId = vendedorProfile?.supervisor_id || null;
      }
      
      const { data: newStore, error } = await supabase.from("stores").insert({
        ...formData,
        code: formData.code || `STORE-${Date.now()}`,
        status: "active",
        created_by: userData.user?.id,
        vendedor_id: formData.vendedor_id,
        supervisor_id: supervisorId,
      }).select().single();

      if (error) throw error;

      toast.success("Loja cadastrada com sucesso!");
      onSuccess?.(newStore?.id);
      onOpenChange(false);
      setFormData({
        name: "",
        code: "",
        chain: "",
        cnpj: "",
        address: "",
        city: "",
        state: "",
        phone: "",
        email: "",
        category: "",
        priority: "media",
        manager_name: "",
        manager_phone: "",
        notes: "",
        vendedor_id: "",
        supervisor_id: "",
      });
    } catch (error: any) {
      toast.error("Erro ao cadastrar loja: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Loja / PDV</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nome da Loja *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Carrefour Centro"
                required
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="vendedor_id">Vendedor Responsável *</Label>
              <Select 
                value={formData.vendedor_id} 
                onValueChange={(value) => setFormData({ ...formData, vendedor_id: value })}
                disabled={currentUserRole === 'vendedor' || currentUserRole === 'promotor'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((vendedor) => (
                    <SelectItem key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome} - {vendedor.role === 'vendedor' ? 'Vendedor' : 'Promotor'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {currentUserRole === 'vendedor' || currentUserRole === 'promotor' 
                  ? 'Você foi selecionado automaticamente'
                  : 'Selecione quem será responsável por esta loja'}
              </p>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="supervisor_id">Supervisor (Opcional)</Label>
              <Select 
                value={formData.supervisor_id || "none"} 
                onValueChange={(value) => setFormData({ ...formData, supervisor_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o supervisor (automático se não informado)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (usar supervisor do vendedor)</SelectItem>
                  {supervisores.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.nome} - {supervisor.role === 'supervisor' ? 'Supervisor' : 'Admin'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se não informado, será usado o supervisor vinculado ao vendedor
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Gerado automaticamente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chain">Rede</Label>
              <Input
                id="chain"
                value={formData.chain}
                onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                placeholder="Ex: Carrefour, Extra"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <div className="flex gap-2">
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supermercado">Supermercado</SelectItem>
                    <SelectItem value="farmacia">Farmácia</SelectItem>
                    <SelectItem value="atacado">Atacado</SelectItem>
                    <SelectItem value="conveniencia">Conveniência</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="outline" onClick={() => setShowCategoriaDialog(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, bairro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Ex: São Paulo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">UF</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                placeholder="SP"
                maxLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@loja.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager_name">Gerente</Label>
              <Input
                id="manager_name"
                value={formData.manager_name}
                onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                placeholder="Nome do gerente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Loja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <NovaCategoriaDialog
        open={showCategoriaDialog}
        onOpenChange={setShowCategoriaDialog}
        onSuccess={(newCategory) => {
          setFormData({ ...formData, category: newCategory });
        }}
      />

      <NovaRedeDialog
        open={showRedeDialog}
        onOpenChange={setShowRedeDialog}
        onSuccess={(newChain) => {
          setFormData({ ...formData, chain: newChain });
        }}
      />
    </Dialog>
  );
};
