import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Pencil, Trash2, Search, CheckCircle, XCircle, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { userSchema } from "@/lib/validations/user";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useStepUp } from "@/hooks/useStepUp";
import { StepUpDialog } from "@/components/security/StepUpDialog";

import { toast } from "sonner";
interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: "admin" | "gerente" | "supervisor" | "vendedor" | "promotor";
  status: "ativo" | "inativo";
  aprovado: boolean;
}

interface Municipio {
  id: string;
  nome: string;
  uf: string;
}

export const GerenciamentoUsuarios = () => {
  const { request: requestStepUp, dialogProps: stepUpDialogProps } = useStepUp();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [selectedMunicipios, setSelectedMunicipios] = useState<string[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  /** Quando a troca de senha falha por MFA (cancelado/token inválido/MFA não configurado),
   * mantemos aqui o último par {userId,password} para permitir tentar novamente
   * sem refazer o resto do formulário. */
  const [mfaRetry, setMfaRetry] = useState<{ userId: string; userEmail: string; password: string } | null>(null);
  const [mfaRetrying, setMfaRetrying] = useState(false);
  const ITEMS_PER_PAGE = 20;

  const [novoUsuario, setNovoUsuario] = useState<{
    nome: string;
    email: string;
    tipo_usuario: "admin" | "gerente" | "supervisor" | "vendedor" | "promotor";
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
    // Get current user ID
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });
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
      logger.error("Erro ao carregar municípios do usuário:", error);
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
        logger.error("Erro ao carregar roles:", rolesError);
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
      logger.error("Erro ao carregar usuários:", error);
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
      logger.error("Erro ao carregar municípios:", error);
    }
  };

  const handleAddUser = async () => {
    setErrors({});
    setLoading(true);
    
    try {
      const validatedData = userSchema.parse(novoUsuario);
      
      // Step-up MFA obrigatório para criar admin/gerente
      const stepUpToken = await requestStepUp(
        "user.create.admin",
        `Confirme com MFA para criar o usuário ${validatedData.email}.`
      );
      if (!stepUpToken) { setLoading(false); return; }

      // Usar edge function para criar usuário (signUp está desabilitado)
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-admin-users", {
        body: {
          users: [{
            email: validatedData.email,
            password: validatedData.senha,
            nome: validatedData.nome,
            role: validatedData.tipo_usuario,
          }]
        },
        headers: { "x-step-up-token": stepUpToken },
      });

      if (fnError) throw fnError;
      
      const result = fnData?.results?.[0];
      if (!result?.success) {
        throw new Error(result?.error || "Não foi possível criar o usuário");
      }

      const userId = result.userId;

      // Audit admin action (fire-and-forget)
      const { auditAdminAction } = await import("@/lib/utils/sensitive-audit");
      auditAdminAction("create_user", "user", userId, {
        email: validatedData.email,
        role: validatedData.tipo_usuario,
        nome: validatedData.nome,
      });

      // Atualizar supervisor se selecionado
      if (selectedSupervisor && userId) {
        await supabase
          .from("profiles")
          .update({ supervisor_id: selectedSupervisor })
          .eq("id", userId);
      }

      // Vincular municípios se for vendedor
      if (validatedData.tipo_usuario === "vendedor" && selectedMunicipios.length > 0 && userId) {
        await supabase
          .from("municipios_usuarios")
          .insert(
            selectedMunicipios.map(municipioId => ({
              usuario_id: userId,
              municipio_id: municipioId
            }))
          );
      }
      
      setIsDialogOpen(false);
      setNovoUsuario({ nome: "", email: "", tipo_usuario: "vendedor", senha: "" });
      setSelectedMunicipios([]);
      setSelectedSupervisor(null);
      
      toast.success("Usuário criado", { description: `${validatedData.nome} foi criado com sucesso` });
      
      fetchUsuarios();
    } catch (error: any) {
      logger.error("Erro ao criar usuário:", error);
      
      if (error.errors) {
        const fieldErrors: Record<string, string> = {};
        error.errors?.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
      }
      
      toast.error("Erro", { description: error.message || "Não foi possível criar o usuário" });
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

      toast.success("Municípios atualizados", { description: "Os municípios do vendedor foram atualizados com sucesso" });
    } catch (error) {
      logger.error("Erro ao atualizar municípios:", error);
      toast.error("Erro", { description: "Não foi possível atualizar os municípios" });
    }
  };

  const handleEditUser = (user: Usuario) => {
    setErrors({});
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
    const wantsPasswordChange = !!(novoUsuario.senha && novoUsuario.senha.length > 0);

    // Validar senha antes de qualquer escrita
    if (wantsPasswordChange) {
      const senhaRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
      if (novoUsuario.senha.length < 8) {
        toast.error("Senha inválida", { description: "Mínimo de 8 caracteres." });
        setLoading(false);
        return;
      }
      if (!senhaRegex.test(novoUsuario.senha)) {
        toast.error("Senha inválida", { description: "Inclua letras maiúsculas, minúsculas e números." });
        setLoading(false);
        return;
      }

      // Pré-checar MFA TOTP do admin (edge function exige factor verificado).
      // Usa o MFA customizado (mfa-manage), não o nativo do Supabase.
      try {
        const { data: mfaStatus } = await supabase.functions.invoke("mfa-manage", {
          body: { action: "status" },
        });
        const hasTotp = !!(mfaStatus?.enrolled && mfaStatus?.verified);
        if (!hasTotp) {
          toast.error("MFA não configurado", {
            description: "Ative o MFA TOTP em Segurança › MFA antes de alterar senhas de outros usuários.",
            action: { label: "Configurar MFA", onClick: () => { window.location.href = "/dashboard/security/mfa"; } },
          });
          setLoading(false);
          return;
        }
      } catch (e) {
        logger.warn("Falha ao consultar status MFA:", e);
      }
    }

    try {
      // 1) Atualizar perfil (nome e supervisor)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: novoUsuario.nome,
          supervisor_id: selectedSupervisor
        })
        .eq("id", editingUser.id);

      if (profileError) throw profileError;

      // 2) Atualizar role se mudou
      if (novoUsuario.tipo_usuario !== editingUser.tipo_usuario) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert({
            user_id: editingUser.id,
            role: novoUsuario.tipo_usuario
          }, { onConflict: 'user_id' });

        if (roleError) throw roleError;
      }

      // 3) Municípios (vendedor)
      if (novoUsuario.tipo_usuario === "vendedor") {
        await handleUpdateUserMunicipios(editingUser.id);
      }

      // 4) Senha — última etapa para não impedir o salvamento dos demais campos
      if (wantsPasswordChange) {
        let passwordError: string | null = null;
        try {
          const stepUpToken = await requestStepUp(
            "user.password.self",
            `Confirme com MFA para alterar a senha de ${editingUser.email}.`
          );
          if (!stepUpToken) {
            passwordError = "Verificação MFA cancelada.";
          } else {
            const response = await supabase.functions.invoke("update-user-password", {
              body: { user_id: editingUser.id, password: novoUsuario.senha },
              headers: { "x-step-up-token": stepUpToken },
            });
            if (response.error) {
              // Tentar extrair mensagem real do corpo da resposta
              let serverMsg: string | undefined;
              try {
                const resp = (response.error as any)?.context?.response as Response | undefined;
                const body = await resp?.clone().json().catch(() => null);
                serverMsg = body?.error;
              } catch { /* ignore */ }
              passwordError = serverMsg || (response.error as any).message || "Erro ao atualizar senha";
            } else if ((response.data as any)?.error) {
              passwordError = (response.data as any).error;
            }
          }
        } catch (e: any) {
          passwordError = e?.message || "Erro ao atualizar senha";
        }

        if (passwordError) {
          logger.error("Falha ao atualizar senha:", passwordError);
          toast.warning("Dados salvos, mas a senha não foi alterada", { description: passwordError });
          setNovoUsuario((prev) => ({ ...prev, senha: "" }));
          fetchUsuarios();
          setLoading(false);
          return;
        }
      }

      toast.success("Usuário atualizado", {
        description: wantsPasswordChange
          ? "Informações e senha atualizadas com sucesso"
          : "As informações foram atualizadas com sucesso",
      });

      setIsDialogOpen(false);
      setEditingUser(null);
      setNovoUsuario({ nome: "", email: "", tipo_usuario: "vendedor", senha: "" });
      setSelectedMunicipios([]);
      setSelectedSupervisor(null);
      fetchUsuarios();
    } catch (error: any) {
      logger.error("Erro ao atualizar usuário:", error);
      const description = error?.message || "Não foi possível atualizar o usuário";
      toast.error("Erro ao atualizar usuário", { description });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const stepUpToken = await requestStepUp(
        "user.delete",
        `Confirme com MFA para remover ${deleteTarget?.nome ?? "este usuário"}.`
      );
      if (!stepUpToken) return;

      const { data, error: fnError } = await supabase.functions.invoke("delete-admin-user", {
        body: { user_id: userId },
        headers: { "x-step-up-token": stepUpToken },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      toast.success("Usuário removido", { description: `${deleteTarget?.nome || 'O usuário'} foi removido completamente do sistema` });
      
      setDeleteTarget(null);
      fetchUsuarios();
    } catch (error: any) {
      logger.error("Erro ao remover usuário:", error);
      toast.error("Erro", { description: error.message || "Não foi possível remover o usuário" });
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

      toast.success("Status atualizado", { description: "O status do usuário foi alterado" });
      
      fetchUsuarios();
    } catch (error) {
      logger.error("Erro ao atualizar status:", error);
      toast.error("Erro", { description: "Não foi possível atualizar o status" });
    }
  };

  const handleAprovarUsuario = async (userId: string, aprovar: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ aprovado: aprovar })
        .eq("id", userId);

      if (error) throw error;

      toast.success(aprovar ? "Usuário aprovado!" : "Aprovação revogada", { description: aprovar 
          ? "O usuário agora pode acessar o sistema."
          : "O acesso do usuário foi revogado." });

      fetchUsuarios();
    } catch (error) {
      logger.error("Erro ao atualizar aprovação:", error);
      toast.error("Erro", { description: "Não foi possível atualizar a aprovação do usuário" });
    }
  };

  const filteredUsuarios = usuarios.filter(u =>
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsuarios.length / ITEMS_PER_PAGE);
  const paginatedUsuarios = filteredUsuarios.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

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
                <Button onClick={() => { setEditingUser(null); setErrors({}); }}>
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
                    <Label htmlFor="email" className="flex items-center gap-1">
                      Email
                      {editingUser && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Lock className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>O email não pode ser alterado após a criação</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={novoUsuario.email}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                      placeholder="email@empresa.com"
                      maxLength={255}
                      disabled={!!editingUser}
                      className={editingUser ? "bg-muted" : ""}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Usuário</Label>
                    <Select
                      value={novoUsuario.tipo_usuario}
                      onValueChange={(value: any) => setNovoUsuario({ ...novoUsuario, tipo_usuario: value })}
                      disabled={editingUser?.id === currentUserId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="promotor">Promotor</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="gerente">Gerente</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.tipo_usuario && <p className="text-sm text-destructive">{errors.tipo_usuario}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">{editingUser ? "Nova Senha (deixe vazio para manter)" : "Senha Inicial"}</Label>
                    <Input
                      id="senha"
                      type="password"
                      value={novoUsuario.senha}
                      onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                      placeholder={editingUser ? "Deixe vazio para manter a senha atual" : "••••••••"}
                      maxLength={100}
                    />
                    {errors.senha && <p className="text-sm text-destructive">{errors.senha}</p>}
                    <p className="text-xs text-muted-foreground">
                      {editingUser ? "Preencha apenas se deseja alterar. " : ""}Mínimo 8 caracteres, com letras maiúsculas, minúsculas e números
                    </p>
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
                                return u.tipo_usuario === "vendedor" || u.tipo_usuario === "supervisor" || u.tipo_usuario === "gerente" || u.tipo_usuario === "admin";
                              } else if (novoUsuario.tipo_usuario === "vendedor") {
                                return u.tipo_usuario === "supervisor" || u.tipo_usuario === "gerente" || u.tipo_usuario === "admin";
                              } else if (novoUsuario.tipo_usuario === "supervisor") {
                                return u.tipo_usuario === "gerente" || u.tipo_usuario === "admin";
                              } else if (novoUsuario.tipo_usuario === "gerente") {
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
                  {paginatedUsuarios.map((usuario) => (
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
                          {usuario.id !== currentUserId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(usuario)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {filteredUsuarios.length} usuário(s) — Página {currentPage} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AlertDialog for delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.nome}</strong> ({deleteTarget?.email})?
              Esta ação não pode ser desfeita e removerá todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDeleteUser(deleteTarget.id)}
            >
              Remover Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <StepUpDialog {...stepUpDialogProps} />
    </div>
  );
};
