import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2, Search } from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: "admin" | "supervisor" | "vendedor";
  status: "ativo" | "inativo";
}

export const GerenciamentoUsuarios = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  
  // Dados mockados para demonstração
  const [usuarios, setUsuarios] = useState<Usuario[]>([
    { id: "1", nome: "Admin Sistema", email: "admin@empresa.com", tipo_usuario: "admin", status: "ativo" },
    { id: "2", nome: "João Supervisor", email: "joao@empresa.com", tipo_usuario: "supervisor", status: "ativo" },
    { id: "3", nome: "Maria Vendedora", email: "maria@empresa.com", tipo_usuario: "vendedor", status: "ativo" },
    { id: "4", nome: "Pedro Vendedor", email: "pedro@empresa.com", tipo_usuario: "vendedor", status: "inativo" },
  ]);

  const [novoUsuario, setNovoUsuario] = useState({
    nome: "",
    email: "",
    tipo_usuario: "vendedor" as const,
    senha: "",
  });

  const handleAddUser = () => {
    const newUser: Usuario = {
      id: String(usuarios.length + 1),
      nome: novoUsuario.nome,
      email: novoUsuario.email,
      tipo_usuario: novoUsuario.tipo_usuario,
      status: "ativo",
    };
    
    setUsuarios([...usuarios, newUser]);
    setIsDialogOpen(false);
    setNovoUsuario({ nome: "", email: "", tipo_usuario: "vendedor", senha: "" });
    
    toast({
      title: "Usuário adicionado",
      description: `${newUser.nome} foi adicionado com sucesso (interface only)`,
    });
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={novoUsuario.email}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                      placeholder="email@empresa.com"
                    />
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha Inicial</Label>
                    <Input
                      id="senha"
                      type="password"
                      value={novoUsuario.senha}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
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
