import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Building, Shield, Lock, Loader2 } from "lucide-react";
import { profileSchema } from "@/lib/validations/profile";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  nome: string;
  email: string;
  tipo_usuario?: string;
  status?: string;
  telefone?: string;
  cargo?: string;
  departamento?: string;
}

interface EditarPerfilProps {
  profile: Profile;
  onUpdate: (updatedProfile: Profile) => void;
}

export const EditarPerfil = ({ profile, onUpdate }: EditarPerfilProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [departamentoNome, setDepartamentoNome] = useState<string>("");
  const { toast } = useToast();

  // Fetch departamento name from departamento_id
  useEffect(() => {
    const fetchDepartamento = async () => {
      if (!profile.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", profile.id)
        .single();
      
      if (data?.departamento_id) {
        const { data: dept } = await supabase
          .from("departamentos")
          .select("nome")
          .eq("id", data.departamento_id)
          .single();
        setDepartamentoNome(dept?.nome || "Não definido");
      } else {
        setDepartamentoNome(profile.departamento || "Não definido");
      }
    };
    fetchDepartamento();
  }, [profile.id, profile.departamento]);

  const getTipoUsuarioLabel = () => {
    switch (profile?.tipo_usuario) {
      case 'admin': return 'Administrador';
      case 'gerente': return 'Gerente';
      case 'supervisor': return 'Supervisor';
      case 'vendedor': return 'Vendedor';
      case 'promotor': return 'Promotor';
      case 'cliente': return 'Cliente';
      default: return 'Usuário';
    }
  };

  const getTipoUsuarioVariant = () => {
    switch (profile?.tipo_usuario) {
      case 'admin': return 'default';
      case 'gerente': case 'supervisor': return 'secondary';
      default: return 'outline';
    }
  };

  const handleSave = async () => {
    setErrors({});
    
    try {
      // Validate with email kept from original (not editable)
      const dataToValidate = { ...formData, email: profile.email };
      profileSchema.parse(dataToValidate);

      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          nome: formData.nome.trim(),
          telefone: formData.telefone?.trim() || null,
          cargo: formData.cargo?.trim() || null,
          departamento: formData.departamento?.trim() || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      const updatedProfile = { ...profile, ...formData, email: profile.email };
      onUpdate(updatedProfile);
      setIsEditing(false);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso",
      });
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
        console.error("Erro ao salvar perfil:", error);
        toast({
          title: "Erro",
          description: "Não foi possível salvar as alterações",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile);
    setErrors({});
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Meus Dados
        </CardTitle>
        <CardDescription>
          Visualize e atualize suas informações pessoais. O e-mail não pode ser alterado por questões de segurança (LGPD).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>
            <Shield className="inline-block w-4 h-4 mr-2" />
            Tipo de Usuário
          </Label>
          <div className="flex items-center gap-2">
            <Badge variant={getTipoUsuarioVariant() as any} className="text-sm px-3 py-1">
              {getTipoUsuarioLabel()}
            </Badge>
            <span className="text-xs text-muted-foreground">
              (Definido pelo administrador)
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-1">
            <Mail className="w-4 h-4" />
            Email
            <Lock className="w-3 h-3 text-muted-foreground ml-1" />
          </Label>
          <Input
            id="email"
            type="email"
            value={profile.email}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            O e-mail é utilizado como identificador único e não pode ser alterado (Art. 18 LGPD)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nome">
            <User className="inline-block w-4 h-4 mr-2" />
            Nome Completo
          </Label>
          <Input
            id="nome"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            disabled={!isEditing || saving}
            maxLength={100}
          />
          {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">
            <Phone className="inline-block w-4 h-4 mr-2" />
            Telefone
          </Label>
          <Input
            id="telefone"
            value={formData.telefone || ""}
            onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
            disabled={!isEditing || saving}
            placeholder="(00) 00000-0000"
            maxLength={15}
          />
          {errors.telefone && <p className="text-sm text-destructive">{errors.telefone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cargo">
            <Building className="inline-block w-4 h-4 mr-2" />
            Cargo
          </Label>
          <Input
            id="cargo"
            value={formData.cargo || ""}
            onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
            disabled={!isEditing || saving}
            placeholder="Ex: Vendedor Sênior"
            maxLength={100}
          />
          {errors.cargo && <p className="text-sm text-destructive">{errors.cargo}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="departamento">Departamento</Label>
          <Input
            id="departamento"
            value={departamentoNome}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Departamento é definido pelo administrador
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>Editar Meus Dados</Button>
          ) : (
            <>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                Cancelar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
