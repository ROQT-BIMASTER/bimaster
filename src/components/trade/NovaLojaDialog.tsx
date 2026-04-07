import { useState, useEffect } from "react";
import { useStoreCategories } from "@/hooks/useStoreCategories";
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
import { VendedorMultiSelect } from "./VendedorMultiSelect";
import { ClassificationSelector } from "./ClassificationSelector";
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";
import { z } from "zod";

// Schema de validação para loja
const storeSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(200, "Nome muito longo"),
  cnpj: z.string().regex(/^(\d{14})?$/, "CNPJ deve ter 14 dígitos").optional().or(z.literal('')),
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  phone: z.string().regex(/^(\d{10,15})?$/, "Telefone deve ter 10-15 dígitos").optional().or(z.literal('')),
  state: z.string().max(2, "UF deve ter 2 caracteres").optional().or(z.literal('')),
  vendedor_id: z.string().uuid("Vendedor é obrigatório"),
});

interface NovaLojaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newStoreId?: string) => void;
}

export const NovaLojaDialog = ({ open, onOpenChange, onSuccess }: NovaLojaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { categories: storeCategories, refetch: refetchCategories } = useStoreCategories();
  const [showCategoriaDialog, setShowCategoriaDialog] = useState(false);
  const [showRedeDialog, setShowRedeDialog] = useState(false);
  const [supervisores, setSupervisores] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Multi-vendedor state
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([]);
  const [principalVendedorId, setPrincipalVendedorId] = useState<string>("");
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    chain: "",
    cnpj: "",
    branch_count: 1,
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    category: "",
    priority: "media",
    classification: "C",
    manager_name: "",
    manager_phone: "",
    notes: "",
    supervisor_id: "",
    situacao_cadastral: "",
    porte_empresa: "",
    regime_tributario: "",
    matriz_filial: "",
    capital_social: "",
    cnae_principal: "",
  });

  // Carregar supervisores e configurar usuário atual
  useEffect(() => {
    if (open) {
      fetchSupervisores();
      fetchCurrentUser();
    } else {
      // Limpar estados ao fechar
      setSelectedVendedores([]);
      setPrincipalVendedorId("");
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
        setSelectedVendedores([user.id]);
        setPrincipalVendedorId(user.id);
      }
    } catch (error) {
      console.error("Erro ao buscar usuário atual:", error);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar vendedor principal
    if (!principalVendedorId || selectedVendedores.length === 0) {
      toast.error("Selecione pelo menos um vendedor responsável");
      return;
    }
    
    // Limpar CNPJ e telefone para validação
    const cleanCnpj = formData.cnpj.replace(/\D/g, '');
    const cleanPhone = formData.phone.replace(/\D/g, '');
    
    // Validar com Zod
    const validationResult = storeSchema.safeParse({
      name: formData.name.trim(),
      cnpj: cleanCnpj,
      email: formData.email.trim(),
      phone: cleanPhone,
      state: formData.state.trim(),
      vendedor_id: principalVendedorId,
    });
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Padronizar nome do cliente com IA
      let normalizedName = formData.name;
      try {
        const { data: normData } = await supabase.functions.invoke('padronizar-nome-cliente', {
          body: { name: formData.name }
        });
        if (normData?.normalized) {
          normalizedName = normData.normalized;
          console.log('Nome padronizado:', normalizedName);
        }
      } catch (normError) {
        console.warn('Erro ao padronizar nome, usando original:', normError);
      }

      // Verificar duplicatas por nome normalizado ou CNPJ
      const duplicateQueries = [];
      
      if (normalizedName) {
        duplicateQueries.push(
          supabase
            .from("stores")
            .select("id, name")
            .eq("name", normalizedName)
            .eq("status", "active")
            .limit(1)
        );
      }
      
      if (formData.cnpj) {
        const cleanCNPJ = formData.cnpj.replace(/\D/g, '');
        if (cleanCNPJ) {
          duplicateQueries.push(
            supabase
              .from("stores")
              .select("id, name, cnpj")
              .eq("cnpj", cleanCNPJ)
              .eq("status", "active")
              .limit(1)
          );
        }
      }

      if (duplicateQueries.length > 0) {
        const results = await Promise.all(duplicateQueries);
        const hasDuplicate = results.some(r => r.data && r.data.length > 0);
        
        if (hasDuplicate) {
          const duplicate = results.find(r => r.data && r.data.length > 0)?.data?.[0];
          toast.error(`Cliente já cadastrado: ${duplicate?.name || 'Verificar CNPJ'}`);
          setLoading(false);
          return;
        }
      }
      
      // Buscar supervisor_id do profile do vendedor se não foi informado
      let supervisorId = formData.supervisor_id || null;
      if (!supervisorId && principalVendedorId) {
        const { data: vendedorProfile } = await supabase
          .from("profiles")
          .select("supervisor_id")
          .eq("id", principalVendedorId)
          .single();
        
        supervisorId = vendedorProfile?.supervisor_id || null;
      }
      
      const { data: newStore, error } = await supabase.from("stores").insert({
        ...formData,
        name: normalizedName, // Usar nome padronizado
        cnpj: formData.cnpj ? formData.cnpj.replace(/\D/g, '') : null, // Limpar CNPJ
        code: formData.code || `STORE-${Date.now()}`,
        branch_count: formData.branch_count || 1,
        classification: formData.classification || "C",
        status: "active",
        created_by: userData.user?.id,
        vendedor_id: principalVendedorId,
        supervisor_id: supervisorId,
      }).select().single();

      if (error) throw error;
      
      // Inserir vínculos na tabela store_sellers
      if (newStore && selectedVendedores.length > 0) {
        const storeSellersData = selectedVendedores.map((vendedorId, index) => ({
          store_id: newStore.id,
          vendedor_id: vendedorId,
          is_principal: vendedorId === principalVendedorId,
          created_by: userData.user?.id,
        }));
        
        const { error: sellersError } = await supabase
          .from("store_sellers")
          .insert(storeSellersData);
        
        if (sellersError) {
          console.error("Erro ao vincular vendedores:", sellersError);
          // Não falhar a operação, apenas logar
        }
      }

      toast.success(`Loja cadastrada: ${normalizedName}`);
      onSuccess?.(newStore?.id);
      onOpenChange(false);
      setFormData({
        name: "",
        code: "",
        chain: "",
        cnpj: "",
        branch_count: 1,
        address: "",
        city: "",
        state: "",
        phone: "",
        email: "",
        category: "",
        priority: "media",
        classification: "C",
        manager_name: "",
        manager_phone: "",
        notes: "",
        supervisor_id: "",
        situacao_cadastral: "",
        porte_empresa: "",
        regime_tributario: "",
        matriz_filial: "",
        capital_social: "",
        cnae_principal: "",
      });
      setSelectedVendedores([]);
      setPrincipalVendedorId("");
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

            <div className="col-span-2">
              <VendedorMultiSelect
                selectedVendedores={selectedVendedores}
                onChange={setSelectedVendedores}
                principalVendedorId={principalVendedorId}
                onPrincipalChange={setPrincipalVendedorId}
                disabled={currentUserRole === 'vendedor' || currentUserRole === 'promotor'}
                required
              />
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
              <div className="flex gap-2">
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="flex-1"
                />
                <CnpjSearchButton
                  cnpj={formData.cnpj}
                  onDataFound={(data: CnpjData) => {
                    setFormData(prev => ({
                      ...prev,
                      name: data.razaoSocial || data.nomeFantasia || prev.name,
                      chain: data.nomeFantasia || prev.chain,
                      address: data.endereco || prev.address,
                      city: data.cidade || prev.city,
                      state: data.uf || prev.state,
                      phone: data.telefone || prev.phone,
                      email: data.email || prev.email,
                      situacao_cadastral: data.situacao || prev.situacao_cadastral,
                      porte_empresa: data.porte || prev.porte_empresa,
                      regime_tributario: data.regimeTributario || prev.regime_tributario,
                      matriz_filial: data.matrizFilial || prev.matriz_filial,
                      capital_social: data.capitalSocial?.toString() || prev.capital_social,
                      cnae_principal: data.cnae || prev.cnae_principal,
                    }));
                    // Exibir info adicional via toast
                    const infoParts: string[] = [];
                    if (data.situacao) infoParts.push(`Situação: ${data.situacao}`);
                    if (data.porte) infoParts.push(`Porte: ${data.porte}`);
                    if (data.regimeTributario) infoParts.push(`Regime: ${data.regimeTributario}`);
                    if (data.matrizFilial) infoParts.push(`Tipo: ${data.matrizFilial}`);
                    if (infoParts.length > 0) {
                      toast.info(infoParts.join(' • '), { duration: 8000 });
                    }
                  }}
                />
              </div>
              {/* Dados da Receita Federal */}
              {(formData.situacao_cadastral || formData.porte_empresa || formData.regime_tributario) && (
                <div className="mt-2 p-3 rounded-md bg-muted/50 border text-sm space-y-1">
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Dados da Receita Federal</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {formData.situacao_cadastral && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Situação:</span>
                        <span className={`font-medium ${formData.situacao_cadastral === 'Ativa' ? 'text-green-600' : 'text-destructive'}`}>
                          {formData.situacao_cadastral}
                        </span>
                      </div>
                    )}
                    {formData.matriz_filial && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Tipo:</span>
                        <span className="font-medium">{formData.matriz_filial}</span>
                      </div>
                    )}
                    {formData.porte_empresa && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Porte:</span>
                        <span className="font-medium">{formData.porte_empresa}</span>
                      </div>
                    )}
                    {formData.regime_tributario && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Regime:</span>
                        <span className="font-medium">{formData.regime_tributario}</span>
                      </div>
                    )}
                    {formData.capital_social && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Capital Social:</span>
                        <span className="font-medium">R$ {formData.capital_social}</span>
                      </div>
                    )}
                    {formData.cnae_principal && (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <span className="text-muted-foreground">CNAE:</span>
                        <span className="font-medium">{formData.cnae_principal}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch_count">Nº de Lojas/Filiais</Label>
              <Input
                id="branch_count"
                type="number"
                min={1}
                value={formData.branch_count}
                onChange={(e) => setFormData({ ...formData, branch_count: parseInt(e.target.value) || 1 })}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                Quantas lojas este CNPJ representa (ex: matriz + filiais)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <div className="flex gap-2">
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="outline" onClick={() => setShowCategoriaDialog(true)} aria-label="Adicionar nova categoria">
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

            <div className="col-span-2">
              <ClassificationSelector
                value={formData.classification}
                onChange={(value) => setFormData({ ...formData, classification: value })}
              />
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
