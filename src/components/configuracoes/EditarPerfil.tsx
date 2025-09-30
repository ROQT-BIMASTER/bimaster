import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Building } from "lucide-react";
import { profileSchema, ProfileFormData } from "@/lib/validations/profile";

interface Profile {
  id: string;
  nome: string;
  email: string;
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
  const [formData, setFormData] = useState(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleSave = () => {
    setErrors({});
    
    try {
      const validatedData = profileSchema.parse(formData);
      onUpdate({ ...profile, ...validatedData });
      setIsEditing(false);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram validadas e atualizadas com sucesso",
      });
    } catch (error: any) {
      const fieldErrors: Record<string, string> = {};
      error.errors?.forEach((err: any) => {
        fieldErrors[err.path[0]] = err.message;
      });
      setErrors(fieldErrors);
      toast({
        title: "Erro de validação",
        description: "Verifique os campos destacados",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setFormData(profile);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações do Perfil</CardTitle>
        <CardDescription>Atualize suas informações pessoais</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">
            <User className="inline-block w-4 h-4 mr-2" />
            Nome Completo
          </Label>
          <Input
            id="nome"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            disabled={!isEditing}
            maxLength={100}
          />
          {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            <Mail className="inline-block w-4 h-4 mr-2" />
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={!isEditing}
            maxLength={255}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
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
            disabled={!isEditing}
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
            disabled={!isEditing}
            placeholder="Ex: Vendedor Sênior"
            maxLength={100}
          />
          {errors.cargo && <p className="text-sm text-destructive">{errors.cargo}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="departamento">Departamento</Label>
          <Input
            id="departamento"
            value={formData.departamento || ""}
            onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
            disabled={!isEditing}
            placeholder="Ex: Vendas"
            maxLength={100}
          />
          {errors.departamento && <p className="text-sm text-destructive">{errors.departamento}</p>}
        </div>

        <div className="flex gap-2 pt-4">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>Editar Perfil</Button>
          ) : (
            <>
              <Button onClick={handleSave}>Salvar Alterações</Button>
              <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
