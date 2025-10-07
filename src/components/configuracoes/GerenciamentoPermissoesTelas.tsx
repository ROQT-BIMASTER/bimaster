import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Screen {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  icone: string;
  rota: string;
  ordem: number;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role?: string;
}

export const GerenciamentoPermissoesTelas = () => {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState<string>("");
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchScreens();
    fetchUsuarios();
  }, []);

  useEffect(() => {
    if (selectedUsuario) {
      fetchUserPermissions(selectedUsuario);
    }
  }, [selectedUsuario]);

  const fetchScreens = async () => {
    const { data, error } = await supabase
      .from("telas_sistema")
      .select("*")
      .eq("ativo", true)
      .order("ordem");

    if (error) {
      console.error("Error fetching screens:", error);
      return;
    }

    setScreens(data || []);
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select(`
          id,
          nome,
          email,
          user_roles (role)
        `)
        .eq("aprovado", true);

      if (error) throw error;

      const usuarios = profilesData?.map((profile: any) => ({
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
        role: profile.user_roles?.[0]?.role
      })) || [];

      setUsuarios(usuarios);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("usuario_permissoes_telas")
        .select("tela_id")
        .eq("usuario_id", userId);

      if (error) throw error;

      setUserPermissions(new Set(data?.map(p => p.tela_id) || []));
    } catch (error) {
      console.error("Error fetching user permissions:", error);
    }
  };

  const handleTogglePermission = (screenId: string) => {
    const newPermissions = new Set(userPermissions);
    if (newPermissions.has(screenId)) {
      newPermissions.delete(screenId);
    } else {
      newPermissions.add(screenId);
    }
    setUserPermissions(newPermissions);
  };

  const handleSave = async () => {
    if (!selectedUsuario) return;

    setSaving(true);
    try {
      // Remove all existing permissions
      await supabase
        .from("usuario_permissoes_telas")
        .delete()
        .eq("usuario_id", selectedUsuario);

      // Insert new permissions
      if (userPermissions.size > 0) {
        const permissionsToInsert = Array.from(userPermissions).map(telaId => ({
          usuario_id: selectedUsuario,
          tela_id: telaId
        }));

        const { error } = await supabase
          .from("usuario_permissoes_telas")
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Permissões atualizadas",
        description: "As permissões do usuário foram salvas com sucesso",
      });
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar as permissões",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = usuarios.find(u => u.id === selectedUsuario);
  const isUserAdmin = selectedUser?.role === 'admin';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissões de Telas
        </CardTitle>
        <CardDescription>
          Gerencie quais telas cada usuário pode acessar no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Selecionar Usuário
          </label>
          <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um usuário" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((usuario) => (
                <SelectItem key={usuario.id} value={usuario.id}>
                  <div className="flex items-center gap-2">
                    <span>{usuario.nome}</span>
                    <Badge variant="outline" className="text-xs">
                      {usuario.role || 'vendedor'}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedUsuario && (
          <>
            {isUserAdmin && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-primary">
                  ⚠️ Administradores têm acesso automático a todas as telas do sistema
                </p>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Telas Disponíveis</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {screens.map((screen) => (
                  <div
                    key={screen.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isUserAdmin || userPermissions.has(screen.id)}
                        onCheckedChange={() => !isUserAdmin && handleTogglePermission(screen.id)}
                        disabled={isUserAdmin}
                      />
                      <div>
                        <div className="font-medium">{screen.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {screen.descricao}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Rota: {screen.rota}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">{screen.codigo}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {!isUserAdmin && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Permissões
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
