import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Edit, Sparkles, Mail, Phone, MapPin, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NovoProspectDialog } from "@/components/prospects/NovoProspectDialog";
import { ProspectDetailDialog } from "@/components/kanban/ProspectDetailDialog";
import { AIInsightsChat } from "@/components/chat/AIInsightsChat";
import { AtribuirProspectsDialog } from "@/components/admin/AtribuirProspectsDialog";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Prospect {
  id: string;
  nome_empresa: string;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  municipio?: string | null;
  porte_empresa: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  municipio_id: string | null;
  vendedor?: {
    nome: string;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  novo: { 
    label: "Novo", 
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
  },
  em_contato: { 
    label: "Em Contato", 
    color: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700"
  },
  proposta_enviada: { 
    label: "Proposta", 
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700"
  },
  negociacao: { 
    label: "Negociação", 
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700"
  },
  ganho: { 
    label: "Ganho", 
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700"
  },
  perdido: { 
    label: "Perdido", 
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
  },
};

const Prospects = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isSupervisor } = useUserRole();

  useEffect(() => {
    fetchProspects();
  }, []);

  const fetchProspects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Verificar tipo de usuário
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const profile = { tipo_usuario: roleData?.role || 'vendedor' };

      let query = supabase
        .from("prospects")
        .select(`
          *,
          vendedor:profiles!prospects_vendedor_id_fkey(nome)
        `)
        .order("created_at", { ascending: false });

      // Se não for admin ou supervisor, filtrar por municípios vinculados ao vendedor
      if (profile?.tipo_usuario === "vendedor") {
        // Buscar municípios vinculados ao vendedor
        const { data: vinculos } = await supabase
          .from("municipios_usuarios")
          .select("municipio_id")
          .eq("usuario_id", user.id);

        const municipiosIds = vinculos?.map(v => v.municipio_id) || [];
        
        if (municipiosIds.length > 0) {
          query = query.in("municipio_id", municipiosIds);
        } else {
          // Se não tem municípios vinculados, não mostrar nenhum prospect
          query = query.eq("vendedor_id", user.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setProspects(data || []);
    } catch (error) {
      console.error("Erro ao carregar prospects:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os prospects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProspects = prospects.filter((prospect) =>
    prospect.nome_empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prospect.contato_principal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prospect.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditProspect = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Prospects</h2>
            <p className="text-muted-foreground">Gerencie seus prospects e oportunidades</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => setChatOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              Insights de IA
            </Button>
            {(isAdmin || isSupervisor) && (
              <AtribuirProspectsDialog onSuccess={fetchProspects} />
            )}
            <NovoProspectDialog onSuccess={fetchProspects} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por empresa, contato ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-8">Carregando prospects...</div>
            ) : filteredProspects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum prospect encontrado
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Empresa</TableHead>
                      <TableHead className="font-semibold">Contato</TableHead>
                      <TableHead className="font-semibold">Informações</TableHead>
                      <TableHead className="font-semibold">Localização</TableHead>
                      <TableHead className="font-semibold">Responsável</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Categoria</TableHead>
                      <TableHead className="font-semibold">Último Contato</TableHead>
                      <TableHead className="font-semibold">Próxima Ação</TableHead>
                      <TableHead className="font-semibold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProspects.map((prospect) => {
                      const statusInfo = statusConfig[prospect.status] || statusConfig.novo;
                      return (
                        <TableRow 
                          key={prospect.id}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleEditProspect(prospect)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{prospect.nome_empresa}</span>
                            </div>
                            {prospect.porte_empresa && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {prospect.porte_empresa}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-sm">
                                {prospect.contato_principal || "-"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              {prospect.email && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate max-w-[200px]">{prospect.email}</span>
                                </div>
                              )}
                              {prospect.telefone && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  <span>{prospect.telefone}</span>
                                </div>
                              )}
                              {!prospect.email && !prospect.telefone && (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {prospect.municipio && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span>{prospect.municipio}</span>
                              </div>
                            )}
                            {!prospect.municipio && (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {prospect.vendedor ? (
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="font-normal">
                                  {prospect.vendedor.nome}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`${statusInfo.bgColor} ${statusInfo.color} border font-medium`}
                            >
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {prospect.categoria ? (
                              <Badge variant="secondary" className="font-normal">
                                {prospect.categoria}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {prospect.ultimo_contato ? (
                              <span className="text-muted-foreground">
                                {new Date(prospect.ultimo_contato).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {prospect.proxima_acao ? (
                              <span className="font-medium">
                                {new Date(prospect.proxima_acao).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProspect(prospect);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProspectDetailDialog
        prospect={selectedProspect}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={fetchProspects}
      />

      <AIInsightsChat 
        open={chatOpen}
        onOpenChange={setChatOpen}
      />
    </DashboardLayout>
  );
};

export default Prospects;
