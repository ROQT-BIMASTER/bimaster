import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Crown, User } from "lucide-react";

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  role: string;
}

interface VendedorMultiSelectProps {
  selectedVendedores: string[];
  onChange: (vendedores: string[]) => void;
  principalVendedorId?: string;
  onPrincipalChange?: (vendedorId: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}

export const VendedorMultiSelect = ({
  selectedVendedores,
  onChange,
  principalVendedorId,
  onPrincipalChange,
  disabled = false,
  required = false,
  label = "Vendedores Responsáveis"
}: VendedorMultiSelectProps) => {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVendedores();
  }, []);

  const fetchVendedores = async () => {
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
        .map(p => ({ ...p, role: roleMap.get(p.id) || 'vendedor' }));

      setVendedores(vendedoresList);
    } catch (error) {
      console.error("Erro ao carregar vendedores:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVendedor = (vendedorId: string) => {
    if (disabled) return;
    
    const isSelected = selectedVendedores.includes(vendedorId);
    let newSelection: string[];
    
    if (isSelected) {
      // Remover da seleção
      newSelection = selectedVendedores.filter(id => id !== vendedorId);
      
      // Se removeu o principal, definir o primeiro da lista como principal
      if (principalVendedorId === vendedorId && newSelection.length > 0 && onPrincipalChange) {
        onPrincipalChange(newSelection[0]);
      }
    } else {
      // Adicionar à seleção
      newSelection = [...selectedVendedores, vendedorId];
      
      // Se é o primeiro selecionado, definir como principal
      if (newSelection.length === 1 && onPrincipalChange) {
        onPrincipalChange(vendedorId);
      }
    }
    
    onChange(newSelection);
  };

  const handleSetPrincipal = (vendedorId: string) => {
    if (disabled) return;
    if (!selectedVendedores.includes(vendedorId)) return;
    if (onPrincipalChange) {
      onPrincipalChange(vendedorId);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'vendedor': return 'Vendedor';
      case 'promotor': return 'Promotor';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{label} {required && '*'}</Label>
        <div className="p-4 border rounded-md text-center text-muted-foreground">
          Carregando vendedores...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="border rounded-md max-h-[200px] overflow-y-auto">
        {vendedores.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            Nenhum vendedor encontrado
          </div>
        ) : (
          <div className="divide-y">
            {vendedores.map((vendedor) => {
              const isSelected = selectedVendedores.includes(vendedor.id);
              const isPrincipal = principalVendedorId === vendedor.id;
              
              return (
                <div 
                  key={vendedor.id}
                  className={`flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-muted/30' : ''
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => handleToggleVendedor(vendedor.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={disabled}
                      onCheckedChange={() => handleToggleVendedor(vendedor.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{vendedor.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {getRoleLabel(vendedor.role)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isPrincipal && isSelected && (
                      <Badge variant="default" className="text-xs flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        Principal
                      </Badge>
                    )}
                    {isSelected && !isPrincipal && onPrincipalChange && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetPrincipal(vendedor.id);
                        }}
                        disabled={disabled}
                      >
                        Definir principal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Selecione um ou mais vendedores responsáveis pelo PDV. O vendedor principal será o responsável primário.
      </p>
    </div>
  );
};
