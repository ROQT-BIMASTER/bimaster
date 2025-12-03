import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Building2, Search, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  departamento_id: string | null;
  aprovado: boolean;
}

interface Departamento {
  id: string;
  nome: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

export function AtribuirDepartamentoUsuario() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [usersRes, deptRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, email, departamento_id, aprovado")
        .order("nome"),
      supabase
        .from("departamentos")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("user_roles")
        .select("user_id, role"),
    ]);

    setUsuarios(usersRes.data || []);
    setDepartamentos(deptRes.data || []);
    
    // Mapear roles por user_id
    const rolesMap: Record<string, string> = {};
    rolesRes.data?.forEach((r: UserRole) => {
      rolesMap[r.user_id] = r.role;
    });
    setUserRoles(rolesMap);
    
    setLoading(false);
  };

  const handleDepartamentoChange = async (userId: string, departamentoId: string | null) => {
    setSaving(userId);

    const { error } = await supabase
      .from("profiles")
      .update({ departamento_id: departamentoId === "none" ? null : departamentoId })
      .eq("id", userId);

    if (error) {
      toast({ title: "Erro ao atualizar departamento", variant: "destructive" });
    } else {
      toast({ title: "Departamento atualizado com sucesso" });
      
      // Atualizar estado local
      setUsuarios(prev => 
        prev.map(u => 
          u.id === userId 
            ? { ...u, departamento_id: departamentoId === "none" ? null : departamentoId }
            : u
        )
      );

      // Disparar evento para atualizar permissões
      window.dispatchEvent(new CustomEvent('permissions-updated'));
    }

    setSaving(null);
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      supervisor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      vendedor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      promotor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      cliente: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  const filteredUsuarios = usuarios.filter(u => 
    u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDepartamentoNome = (id: string | null) => {
    if (!id) return null;
    return departamentos.find(d => d.id === id)?.nome;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Atribuir Departamento aos Usuários
        </CardTitle>
        <CardDescription>
          Vincule cada usuário a um departamento para aplicar as permissões padrão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Departamento Atual</TableHead>
              <TableHead>Novo Departamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredUsuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{usuario.nome || "Sem nome"}</div>
                      <div className="text-sm text-muted-foreground">{usuario.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadge(userRoles[usuario.id] || "")}>
                      {userRoles[usuario.id] || "Sem role"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getDepartamentoNome(usuario.departamento_id) || (
                      <span className="text-muted-foreground">Nenhum</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={usuario.departamento_id || "none"}
                        onValueChange={(value) => handleDepartamentoChange(usuario.id, value)}
                        disabled={saving === usuario.id}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Nenhum</span>
                          </SelectItem>
                          {departamentos.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {dept.nome}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {saving === usuario.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
