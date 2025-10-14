import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Loader2 } from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  supervisor_id: string | null;
}

interface Supervisor {
  id: string;
  nome: string;
  email: string;
}

export function AtribuirVendedorSupervisor() {
  const [vendedores, setVendedores] = useState<Usuario[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar todos os profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email, supervisor_id, status")
        .eq("status", "ativo")
        .order("nome");

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setVendedores([]);
        setSupervisores([]);
        return;
      }

      const userIds = profiles.map(p => p.id);

      // Buscar roles de todos os usuários
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Mapear roles por user_id
      const roleMap = new Map<string, string>();
      (roles || []).forEach(r => {
        roleMap.set(r.user_id, r.role);
      });

      // Separar vendedores e supervisores
      const vendedoresList: Usuario[] = [];
      const supervisoresList: Supervisor[] = [];

      profiles.forEach(profile => {
        const role = roleMap.get(profile.id);
        
        if (role === "vendedor") {
          vendedoresList.push({
            id: profile.id,
            nome: profile.nome,
            email: profile.email,
            supervisor_id: profile.supervisor_id,
          });
        } else if (role === "supervisor") {
          supervisoresList.push({
            id: profile.id,
            nome: profile.nome,
            email: profile.email,
          });
        }
      });

      setVendedores(vendedoresList);
      setSupervisores(supervisoresList);

    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAtribuirSupervisor = async (vendedorId: string, supervisorId: string | null) => {
    try {
      setSaving(vendedorId);

      const { error } = await supabase
        .from("profiles")
        .update({ supervisor_id: supervisorId })
        .eq("id", vendedorId);

      if (error) throw error;

      // Atualizar estado local
      setVendedores(prev =>
        prev.map(v =>
          v.id === vendedorId ? { ...v, supervisor_id: supervisorId } : v
        )
      );

      toast({
        title: "Sucesso",
        description: supervisorId 
          ? "Supervisor atribuído com sucesso" 
          : "Supervisor removido com sucesso",
      });

    } catch (error) {
      console.error("Erro ao atribuir supervisor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atribuir o supervisor",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const getSupervisorNome = (supervisorId: string | null) => {
    if (!supervisorId) return "Sem supervisor";
    const supervisor = supervisores.find(s => s.id === supervisorId);
    return supervisor ? supervisor.nome : "Supervisor não encontrado";
  };

  const getVendedoresPorSupervisor = (supervisorId: string) => {
    return vendedores.filter(v => v.supervisor_id === supervisorId).length;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando dados...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Atribuir Vendedores a Supervisores
          </CardTitle>
          <CardDescription>
            Gerencie a hierarquia de vendedores e seus supervisores responsáveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vendedores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum vendedor cadastrado no sistema
            </div>
          ) : (
            <div className="space-y-4">
              {vendedores.map((vendedor) => (
                <div
                  key={vendedor.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold">{vendedor.nome}</h4>
                    <p className="text-sm text-muted-foreground">{vendedor.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supervisor atual: <span className="font-medium">{getSupervisorNome(vendedor.supervisor_id)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={vendedor.supervisor_id || "none"}
                      onValueChange={(value) =>
                        handleAtribuirSupervisor(
                          vendedor.id,
                          value === "none" ? null : value
                        )
                      }
                      disabled={saving === vendedor.id}
                    >
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Selecione um supervisor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">Sem supervisor</span>
                        </SelectItem>
                        {supervisores.map((supervisor) => (
                          <SelectItem key={supervisor.id} value={supervisor.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{supervisor.nome}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({getVendedoresPorSupervisor(supervisor.id)} vendedores)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {saving === vendedor.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {supervisores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Resumo por Supervisor
            </CardTitle>
            <CardDescription>
              Visualização da distribuição de vendedores por supervisor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {supervisores.map((supervisor) => {
                const vendedoresCount = getVendedoresPorSupervisor(supervisor.id);
                const vendedoresSupervisor = vendedores.filter(
                  v => v.supervisor_id === supervisor.id
                );

                return (
                  <div
                    key={supervisor.id}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{supervisor.nome}</h4>
                        <p className="text-sm text-muted-foreground">{supervisor.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{vendedoresCount}</p>
                        <p className="text-xs text-muted-foreground">vendedores</p>
                      </div>
                    </div>
                    
                    {vendedoresCount > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Vendedores supervisionados:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {vendedoresSupervisor.map(v => (
                            <span
                              key={v.id}
                              className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full"
                            >
                              {v.nome}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Vendedores sem supervisor */}
              {vendedores.filter(v => !v.supervisor_id).length > 0 && (
                <div className="p-4 border border-dashed rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-muted-foreground">Sem Supervisor</h4>
                      <p className="text-sm text-muted-foreground">
                        Vendedores que ainda não foram atribuídos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-muted-foreground">
                        {vendedores.filter(v => !v.supervisor_id).length}
                      </p>
                      <p className="text-xs text-muted-foreground">vendedores</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-dashed">
                    <div className="flex flex-wrap gap-2">
                      {vendedores
                        .filter(v => !v.supervisor_id)
                        .map(v => (
                          <span
                            key={v.id}
                            className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full"
                          >
                            {v.nome}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
