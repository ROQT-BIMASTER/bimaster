import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditoriaRecord {
  id: string;
  tipo: string;
  entidade_id: string;
  entidade_tipo: string;
  vendedor_antigo_id: string | null;
  vendedor_novo_id: string | null;
  usuario_id: string | null;
  detalhes: any;
  created_at: string;
  vendedor_antigo?: { nome: string };
  vendedor_novo?: { nome: string };
  usuario?: { nome: string };
}

const tipoLabels: Record<string, string> = {
  municipio_vendedor: "Atribuição de Município",
  prospect_vendedor: "Atribuição de Prospect",
  importacao: "Importação de Clientes",
};

const Auditoria = () => {
  const [registros, setRegistros] = useState<AuditoriaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const admin = roleData?.role === 'admin' || roleData?.role === 'supervisor';
      setIsAdmin(admin);

      if (admin) {
        fetchAuditoria();
      }
    } catch (error) {
      console.error("Erro ao verificar permissões:", error);
      setLoading(false);
    }
  };

  const fetchAuditoria = async () => {
    try {
      const { data: auditoriaData, error } = await supabase
        .from("auditoria_atribuicoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Buscar nomes dos vendedores e usuários manualmente
      const vendedoresIds = new Set<string>();
      const usuariosIds = new Set<string>();

      auditoriaData?.forEach(record => {
        if (record.vendedor_antigo_id) vendedoresIds.add(record.vendedor_antigo_id);
        if (record.vendedor_novo_id) vendedoresIds.add(record.vendedor_novo_id);
        if (record.usuario_id) usuariosIds.add(record.usuario_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", [...vendedoresIds, ...usuariosIds]);

      const profilesMap = new Map(profiles?.map(p => [p.id, p.nome]));

      const registrosFormatados = auditoriaData?.map(record => ({
        ...record,
        vendedor_antigo: record.vendedor_antigo_id ? { nome: profilesMap.get(record.vendedor_antigo_id) || "Desconhecido" } : undefined,
        vendedor_novo: record.vendedor_novo_id ? { nome: profilesMap.get(record.vendedor_novo_id) || "Desconhecido" } : undefined,
        usuario: record.usuario_id ? { nome: profilesMap.get(record.usuario_id) || "Sistema" } : undefined,
      })) || [];

      setRegistros(registrosFormatados);
    } catch (error) {
      console.error("Erro ao carregar auditoria:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Apenas administradores e supervisores podem acessar os logs de auditoria.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Auditoria</h2>
          <p className="text-muted-foreground">
            Histórico de mudanças e atribuições no sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Logs de Auditoria
            </CardTitle>
            <CardDescription>
              Registros de todas as alterações de atribuição realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando logs...</div>
            ) : registros.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro de auditoria encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {registros.map((registro) => (
                  <Card key={registro.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {tipoLabels[registro.tipo] || registro.tipo}
                            </Badge>
                            <span className="text-sm text-muted-foreground capitalize">
                              {registro.entidade_tipo}
                            </span>
                          </div>
                          {registro.detalhes && (
                            <p className="text-sm font-medium">
                              {registro.detalhes.municipio_nome && (
                                <>
                                  {registro.detalhes.municipio_nome} - {registro.detalhes.municipio_uf}
                                </>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(registro.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm">
                        {registro.vendedor_antigo_id && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Vendedor anterior:</span>
                            <Badge variant="secondary">
                              {(registro.vendedor_antigo as any)?.nome || "Desconhecido"}
                            </Badge>
                          </div>
                        )}
                        {registro.vendedor_novo_id && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Novo vendedor:</span>
                            <Badge variant="default">
                              {(registro.vendedor_novo as any)?.nome || "Desconhecido"}
                            </Badge>
                          </div>
                        )}
                        {!registro.vendedor_novo_id && registro.vendedor_antigo_id && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Ação:</span>
                            <Badge variant="destructive">Removido</Badge>
                          </div>
                        )}
                        {registro.usuario_id && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Realizado por:</span>
                            <span className="font-medium">
                              {(registro.usuario as any)?.nome || "Sistema"}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Auditoria;
