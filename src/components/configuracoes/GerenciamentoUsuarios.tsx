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
import { UserPlus, Pencil, Trash2, Search } from "lucide-react";
import { userSchema } from "@/lib/validations/user";
import { supabase } from "@/integrations/supabase/client";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: "admin" | "supervisor" | "vendedor";
  status: "ativo" | "inativo";
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
  const [loading, setLoading] = useState(false);

  const [novoUsuario, setNovoUsuario] = useState({
    nome: "",
    email: "",
    tipo_usuario: "vendedor" as const,
    senha: "",
  });

  useEffect(() => {
    fetchUsuarios();
    fetchMunicipios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      
      // Converter dados do banco para o formato esperado
      const usuariosFormatados = (data || []).map(profile => ({
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
        tipo_usuario: profile.tipo_usuario as "admin" | "supervisor" | "vendedor",
        status: (profile.status === "ativo" ? "ativo" : "inativo") as "ativo" | "inativo"
      }));
      
      setUsuarios(usuariosFormatados);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
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

  const handleAddUser = () => {
    setErrors({});
    
    try {
      const validatedData = userSchema.parse(novoUsuario);
      
      const newUser: Usuario = {
        id: String(usuarios.length + 1),
        nome: validatedData.nome,
        email: validatedData.email,
        tipo_usuario: validatedData.tipo_usuario,
        status: "ativo",
      };
      
      setUsuarios([...usuarios, newUser]);
      setIsDialogOpen(false);
      setNovoUsuario({ nome: "", email: "", tipo_usuario: "vendedor", senha: "" });
      
      toast({
        title: "Usuário adicionado",
        description: `${newUser.nome} foi validado e adicionado com sucesso`,
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

  const handleEditUser = (user: Usuario) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    setUsuarios(usuarios.filter(u => u.id !== userId));
    toast({
      title: "Usuário removido",
      description: "O usuário foi removido com sucesso (interface only)",
    });
  };

  const handleToggleStatus = (userId: string) => {
    setUsuarios(usuarios.map(u => 
      u.id === userId 
        ? { ...u, status: u.status === "ativo" ? "inativo" : "ativo" }
        : u
    ));
    toast({
      title: "Status atualizado",
      description: "O status do usuário foi alterado (interface only)",
    });
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
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddUser}>
                    {editingUser ? "Salvar Alterações" : "Criar Usuário"}
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
