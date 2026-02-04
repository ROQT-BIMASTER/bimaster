import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2, Search, CheckCircle, XCircle } from "lucide-react";
import { userSchema } from "@/lib/validations/user";
import { supabase } from "@/integrations/supabase/client";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: "admin" | "supervisor" | "vendedor" | "promotor";
  status: "ativo" | "inativo";
  aprovado: boolean;
}

interface Municipio {
  id: string;
  nome: string;
  uf: string;
}

export const GerenciamentoUsuarios = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [selectedMunicipios, setSelectedMunicipios] = useState<string[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [novoUsuario, setNovoUsuario] = useState<{
    nome: string;
    email: string;
    tipo_usuario: "admin" | "supervisor" | "vendedor" | "promotor";
    senha: string;
  }>({
    nome: "",
    email: "",
    tipo_usuario: "vendedor",
    senha: "",
  });

  useEffect(() => {
    fetchUsuarios();
    fetchMunicipios();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (editingUser && isDialogOpen) {
        fetchUserMunicipios(editingUser.id);
        // Buscar supervisor do usuário
        const { data: profileData } = await supabase
          .from("profiles")
          .select("supervisor_id")
          .eq("id", editingUser.id)
          .single();
        setSelectedSupervisor(profileData?.supervisor_id || null);
      } else if (!isDialogOpen) {
        setSelectedMunicipios([]);
        setSelectedSupervisor(null);
      }
    };

    fetchUserData();
  }, [editingUser, isDialogOpen]);

  const fetchUserMunicipios = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("municipios_usuarios")
        .select("municipio_id")
        .eq("usuario_id", userId);
      
      if (error) throw error;
      setSelectedMunicipios(data?.map(m => m.municipio_id) || []);
    } catch (error) {
      console.error("Erro ao carregar municípios do usuário:", error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email, status, aprovado")
        .order("aprovado", { ascending: true })
        .order("nome");
      
      if (profilesError) throw profilesError;
      
      if (!profiles || profiles.length === 0) {
        setUsuarios([]);
        return;
      }
      
      // Buscar roles de todos os usuários em query separada
      const userIds = profiles.map(p => p.id);
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      
      if (rolesError) {
        console.error("Erro ao carregar roles:", rolesError);
      }
      
      // Mapear roles por user_id
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      // Converter dados do banco para o formato esperado
      const usuariosFormatados = profiles.map(profile => ({
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
        tipo_usuario: (rolesMap.get(profile.id) || 'vendedor') as "admin" | "supervisor" | "vendedor",
        status: (profile.status === "ativo" ? "ativo" : "inativo") as "ativo" | "inativo",
        aprovado: profile.aprovado || false
      }));
      
      setUsuarios(usuariosFormatados);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      setUsuarios([]);
    }
  };

  const fetchMunicipios = async () => {
    try {
      const { data, error } = await supabase
        .from("municipios")
        .select("id, nome, uf")
        .order("nome");
      
      if (error) throw error;
      setMunicipios(data || []);
    } catch (error) {
      console.error("Erro ao carregar municípios:", error);
    }
  };

  const handleAddUser = async () => {
    setErrors({});
    setLoading(true);
    
    try {
      const validatedData = userSchema.parse(novoUsuario);
      
      // Criar usuário no auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.senha,
        options: {
          data: {
            nome: validatedData.nome,
            tipo_usuario: validatedData.tipo_usuario
          }
        }
      });

      if (authError) throw authError;
      
      if (authData.user) {
        // Atualizar status para ativo e aprovação para admins
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            status: "ativo",
            aprovado: validatedData.tipo_usuario === "admin" ? true : undefined,
            supervisor_id: selectedSupervisor
          })
          .eq("id", authData.user.id);

        if (updateError) throw updateError;

        // Vincular municípios se for vendedor
        if (validatedData.tipo_usuario === "vendedor" && selectedMunicipios.length > 0) {
          const { error: vinculoError } = await supabase
            .from("municipios_usuarios")
            .insert(
              selectedMunicipios.map(municipioId => ({
                usuario_id: authData.user.id,
                municipio_id: municipioId
              }))
            );

          if (vinculoError) throw vinculoError;
        }
      }
      
      setIsDialogOpen(false);
      setNovoUsuario({ nome: "", email: "", tipo_usuario: "vendedor", senha: "" });
      setSelectedMunicipios([]);
      setSelectedSupervisor(null);
      
      toast({
        title: "Usuário criado",
        description: `${validatedData.nome} foi criado com sucesso`,
      });
      
      fetchUsuarios();
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      
      if (error.errors) {
        const fieldErrors: Record<string, string> = {};
        error.errors?.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
      }
      
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserMunicipios = async (userId: string) => {
    try {
      // Remover vínculos antigos
      await supabase
        .from("municipios_usuarios")
        .delete()
        .eq("usuario_id", userId);

      // Adicionar novos vínculos
      if (selectedMunicipios.length > 0) {
        const { error } = await supabase
          .from("municipios_usuarios")
          .insert(
            selectedMunicipios.map(municipioId => ({
              usuario_id: userId,
              municipio_id: municipioId
            }))
          );

        if (error) throw error;
      }

      toast({
        title: "Municípios atualizados",
        description: "Os municípios do vendedor foram atualizados com sucesso",
      });
    } catch (error) {
      console.error("Erro ao atualizar municípios:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os municípios",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = (user: Usuario) => {
    setEditingUser(user);
    setNovoUsuario({
      nome: user.nome,
      email: user.email,
      tipo_usuario: user.tipo_usuario,
      senha: ""
    });
    setIsDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    setLoading(true);
    try {
      // Atualizar perfil (nome e supervisor)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: novoUsuario.nome,
          supervisor_id: selectedSupervisor
        })
        .eq("id", editingUser.id);

      if (profileError) throw profileError;

      // Só atualizar role se realmente mudou (evita trigger destrutivo)
      if (novoUsuario.tipo_usuario !== editingUser.tipo_usuario) {
        // Usar UPDATE ao invés de DELETE/INSERT para preservar o registro
        // O trigger só dispara sincronização suave quando o role realmente muda
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert({
            user_id: editingUser.id,
            role: novoUsuario.tipo_usuario
          }, { onConflict: 'user_id' });

        if (roleError) throw roleError;
      }
      // Se o role não mudou, não mexe na tabela user_roles - preserva permissões customizadas

      // Atualizar municípios se for vendedor
      if (novoUsuario.tipo_usuario === "vendedor") {
        await handleUpdateUserMunicipios(editingUser.id);
      }

      toast({
        title: "Usuário atualizado",
        description: "As informações foram atualizadas com sucesso",
      });

      setIsDialogOpen(false);
      setEditingUser(null);
      setNovoUsuario({ nome: "", email: "", tipo_usuario: "vendedor", senha: "" });
      setSelectedMunicipios([]);
      setSelectedSupervisor(null);
      fetchUsuarios();
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário?")) return;
    
    try {
      // A deleção em cascata cuidará dos vínculos em municipios_usuarios
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Usuário removido",
        description: "O usuário foi removido com sucesso",
      });
      
      fetchUsuarios();
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o usuário",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      const user = usuarios.find(u => u.id === userId);
      if (!user) return;

      const newStatus = user.status === "ativo" ? "inativo" : "ativo";

      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: "O status do usuário foi alterado",
      });
      
      fetchUsuarios();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const handleAprovarUsuario = async (userId: string, aprovar: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ aprovado: aprovar })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: aprovar ? "Usuário aprovado!" : "Aprovação revogada",
        description: aprovar 
          ? "O usuário agora pode acessar o sistema."
          : "O acesso do usuário foi revogado.",
      });

      fetchUsuarios();
    } catch (error) {
      console.error("Erro ao atualizar aprovação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a aprovação do usuário",
        variant: "destructive",
      });
    }
  };

  const filteredUsuarios = usuarios.filter(u =>
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Usuários</CardTitle>
              <CardDescription>Adicione, edite ou remova usuários do sistema</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingUser(null)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do usuário abaixo
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                      id="nome"
                      value={novoUsuario.nome}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                      placeholder="Digite o nome"
                      maxLength={100}
                    />
                    {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={novoUsuario.email}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                      placeholder="email@empresa.com"
                      maxLength={255}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Usuário</Label>
                    <Select
                      value={novoUsuario.tipo_usuario}
                      onValueChange={(value: any) => setNovoUsuario({ ...novoUsuario, tipo_usuario: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="promotor">Promotor</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.tipo_usuario && <p className="text-sm text-destructive">{errors.tipo_usuario}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha Inicial</Label>
                    <Input
                      id="senha"
                      type="password"
                      value={novoUsuario.senha}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                      placeholder="••••••••"
                      maxLength={100}
                    />
                    {errors.senha && <p className="text-sm text-destructive">{errors.senha}</p>}
                    <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, com letras maiúsculas, minúsculas e números</p>
                  </div>

                  {novoUsuario.tipo_usuario !== "admin" && (
                    <div className="space-y-2">
                      <Label htmlFor="supervisor">Superior Hierárquico (Opcional)</Label>
                      <Select
                        value={selectedSupervisor || "none"}
                        onValueChange={(value) => setSelectedSupervisor(value === "none" ? null : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um superior" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Sem superior hierárquico</span>
                          </SelectItem>
                          {usuarios
                            .filter(u => {
                              // Filtrar superiores possíveis baseado no role
                              if (novoUsuario.tipo_usuario === "promotor") {
                                return u.tipo_usuario === "vendedor" || u.tipo_usuario === "supervisor" || u.tipo_usuario === "admin";
                              } else if (novoUsuario.tipo_usuario === "vendedor") {
                                return u.tipo_usuario === "supervisor" || u.tipo_usuario === "admin";
                              } else if (novoUsuario.tipo_usuario === "supervisor") {
                                return u.tipo_usuario === "admin";
                              }
                              return false;
                            })
                            .map((usuario) => (
                              <SelectItem key={usuario.id} value={usuario.id}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {usuario.tipo_usuario}
                                  </Badge>
                                  <span>{usuario.nome}</span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Vincule este usuário a um superior na hierarquia organizacional
                      </p>
                    </div>
                  )}

                  {novoUsuario.tipo_usuario === "vendedor" && (
                    <div className="space-y-2">
                      <Label>Vincular Municípios</Label>
                      <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                        {municipios.map((municipio) => (
                          <div key={municipio.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={municipio.id}
                              checked={selectedMunicipios.includes(municipio.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedMunicipios([...selectedMunicipios, municipio.id]);
                                } else {
                                  setSelectedMunicipios(selectedMunicipios.filter(id => id !== municipio.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={municipio.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {municipio.nome} - {municipio.uf}
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selecione os municípios que este vendedor irá gerenciar
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    setEditingUser(null);
                    setNovoUsuario({ nome: "", email: "", tipo_usuario: "vendedor", senha: "" });
                    setSelectedMunicipios([]);
                    setSelectedSupervisor(null);
                  }}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={editingUser ? handleSaveEdit : handleAddUser}
                    disabled={loading}
                  >
                    {loading ? "Salvando..." : (editingUser ? "Salvar Alterações" : "Criar Usuário")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aprovação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsuarios.map((usuario) => (
                    <TableRow key={usuario.id} className={!usuario.aprovado ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{usuario.nome}</TableCell>
                      <TableCell>{usuario.email}</TableCell>
                      <TableCell>
                        <Badge variant={usuario.tipo_usuario === "admin" ? "default" : "secondary"}>
                          {usuario.tipo_usuario}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={usuario.status === "ativo" ? "default" : "secondary"}>
                          {usuario.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={usuario.aprovado ? "default" : "outline"}>
                          {usuario.aprovado ? "Aprovado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!usuario.aprovado && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAprovarUsuario(usuario.id, true)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {usuario.aprovado && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAprovarUsuario(usuario.id, false)}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(usuario)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(usuario.id)}
                          >
                            {usuario.status === "ativo" ? "Desativar" : "Ativar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(usuario.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
