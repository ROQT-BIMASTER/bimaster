import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { VendedorMultiSelect } from "./VendedorMultiSelect";
import { ClassificationSelector } from "./ClassificationSelector";

interface EditarLojaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
  onSuccess: () => void;
}

export function EditarLojaDialog({
  open,
  onOpenChange,
  storeId,
  onSuccess,
}: EditarLojaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [supervisores, setSupervisores] = useState<any[]>([]);
  
  // Multi-vendedor state
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([]);
  const [principalVendedorId, setPrincipalVendedorId] = useState<string>("");
  
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    cnpj: "",
    branch_count: 1,
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    chain: "",
    category: "",
    priority: "media",
    classification: "C",
    status: "active",
    monthly_revenue: "",
    notes: "",
    supervisor_id: "",
  });

  useEffect(() => {
    if (open && storeId) {
      loadStoreData();
      fetchSupervisores();
    }
  }, [open, storeId]);

  const fetchSupervisores = async () => {
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

      const supervisoresList = profiles
        .filter(p => {
          const role = roleMap.get(p.id);
          return role === 'supervisor' || role === 'admin';
        })
        .map(p => ({ ...p, role: roleMap.get(p.id) }));

      setSupervisores(supervisoresList);
    } catch (error) {
      console.error("Erro ao carregar supervisores:", error);
    }
  };

  const loadStoreData = async () => {
    setLoadingData(true);
    try {
      // Buscar dados da loja
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Loja não encontrada");

      setFormData({
        code: data.code || "",
        name: data.name || "",
        cnpj: data.cnpj || "",
        branch_count: data.branch_count || 1,
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        zip_code: data.zip_code || "",
        chain: data.chain || "",
        category: data.category || "",
        priority: data.priority || "media",
        classification: data.classification || "C",
        status: data.status || "active",
        monthly_revenue: data.monthly_revenue?.toString() || "",
        notes: data.notes || "",
        supervisor_id: data.supervisor_id || "",
      });
      
      // Buscar vendedores vinculados na tabela store_sellers
      const { data: storeSellers } = await supabase
        .from("store_sellers")
        .select("vendedor_id, is_principal")
        .eq("store_id", storeId);
      
      if (storeSellers && storeSellers.length > 0) {
        const vendedorIds = storeSellers.map(ss => ss.vendedor_id);
        setSelectedVendedores(vendedorIds);
        
        const principal = storeSellers.find(ss => ss.is_principal);
        setPrincipalVendedorId(principal?.vendedor_id || data.vendedor_id || vendedorIds[0]);
      } else if (data.vendedor_id) {
        // Fallback para o vendedor_id da tabela stores
        setSelectedVendedores([data.vendedor_id]);
        setPrincipalVendedorId(data.vendedor_id);
      } else {
        setSelectedVendedores([]);
        setPrincipalVendedorId("");
      }
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      toast.error("Código e nome são obrigatórios");
      return;
    }

    if (!principalVendedorId || selectedVendedores.length === 0) {
      toast.error("Selecione pelo menos um vendedor responsável");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const updateData: any = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        cnpj: formData.cnpj.trim() || null,
        branch_count: formData.branch_count || 1,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        zip_code: formData.zip_code.trim() || null,
        chain: formData.chain.trim() || null,
        category: formData.category.trim() || null,
        priority: formData.priority,
        classification: formData.classification || "C",
        status: formData.status,
        monthly_revenue: formData.monthly_revenue ? parseFloat(formData.monthly_revenue) : null,
        notes: formData.notes.trim() || null,
        vendedor_id: principalVendedorId,
        supervisor_id: formData.supervisor_id || null,
      };

      const { error } = await supabase
        .from("stores")
        .update(updateData)
        .eq("id", storeId);

      if (error) throw error;
      
      // Sincronizar store_sellers
      // 1. Remover vínculos antigos
      await supabase
        .from("store_sellers")
        .delete()
        .eq("store_id", storeId);
      
      // 2. Inserir novos vínculos
      if (selectedVendedores.length > 0) {
        const storeSellersData = selectedVendedores.map(vendedorId => ({
          store_id: storeId,
          vendedor_id: vendedorId,
          is_principal: vendedorId === principalVendedorId,
          created_by: userData.user?.id,
        }));
        
        const { error: sellersError } = await supabase
          .from("store_sellers")
          .insert(storeSellersData);
        
        if (sellersError) {
          console.error("Erro ao sincronizar vendedores:", sellersError);
        }
      }

      toast.success("Loja atualizada com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Loja</DialogTitle>
          <DialogDescription>
            Atualize as informações da loja
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="py-8 text-center text-muted-foreground">
            Carregando dados...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="col-span-2">
              <VendedorMultiSelect
                selectedVendedores={selectedVendedores}
                onChange={setSelectedVendedores}
                principalVendedorId={principalVendedorId}
                onPrincipalChange={setPrincipalVendedorId}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supervisor_id">Supervisor</Label>
                <Select 
                  value={formData.supervisor_id || "none"} 
                  onValueChange={(value) => setFormData({ ...formData, supervisor_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {supervisores.map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.nome} - {supervisor.role === 'supervisor' ? 'Supervisor' : 'Admin'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="branch_count">Nº de Lojas/Filiais</Label>
                <Input
                  id="branch_count"
                  type="number"
                  min={1}
                  value={formData.branch_count}
                  onChange={(e) => setFormData({ ...formData, branch_count: parseInt(e.target.value) || 1 })}
                />
                <p className="text-xs text-muted-foreground">
                  Quantas lojas este CNPJ representa
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="chain">Rede</Label>
                <Input
                  id="chain"
                  value={formData.chain}
                  onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                  placeholder="SP"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supermarket">Supermercado</SelectItem>
                    <SelectItem value="hypermarket">Hipermercado</SelectItem>
                    <SelectItem value="convenience">Conveniência</SelectItem>
                    <SelectItem value="wholesale">Atacado</SelectItem>
                    <SelectItem value="pharmacy">Farmácia</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
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

              <div className="space-y-2">
                <Label htmlFor="monthly_revenue">Faturamento Mensal (R$)</Label>
                <Input
                  id="monthly_revenue"
                  type="number"
                  step="0.01"
                  value={formData.monthly_revenue}
                  onChange={(e) => setFormData({ ...formData, monthly_revenue: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="col-span-2">
              <ClassificationSelector
                value={formData.classification}
                onChange={(value) => setFormData({ ...formData, classification: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="min-h-[80px]"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || loadingData}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}