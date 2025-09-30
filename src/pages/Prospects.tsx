import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NovoProspectDialog } from "@/components/prospects/NovoProspectDialog";
import { ProspectDetailDialog } from "@/components/kanban/ProspectDetailDialog";

interface Prospect {
  id: string;
  nome_empresa: string;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  municipio_id: string | null;
}

const statusColors: Record<string, string> = {
  novo: "bg-blue-500",
  em_contato: "bg-yellow-500",
  proposta_enviada: "bg-orange-500",
  negociacao: "bg-purple-500",
  ganho: "bg-green-500",
  perdido: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_contato: "Contato",
  proposta_enviada: "Proposta",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

const Prospects = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProspects();
  }, []);

  const fetchProspects = async () => {
    try {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .order("created_at", { ascending: false });

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
          <NovoProspectDialog onSuccess={fetchProspects} />
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
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando prospects...</div>
            ) : filteredProspects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum prospect encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProspects.map((prospect) => (
                  <Card 
                    key={prospect.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleEditProspect(prospect)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{prospect.nome_empresa}</h3>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProspect(prospect);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {prospect.contato_principal || "Sem contato principal"}
                          </p>
                          <div className="flex gap-4 mt-2 text-sm">
                            {prospect.email && (
                              <span className="text-muted-foreground">📧 {prospect.email}</span>
                            )}
                            {prospect.telefone && (
                              <span className="text-muted-foreground">📱 {prospect.telefone}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={statusColors[prospect.status]}>
                            {statusLabels[prospect.status] || prospect.status}
                          </Badge>
                          {prospect.categoria && (
                            <Badge variant="outline">{prospect.categoria}</Badge>
                          )}
                        </div>
                      </div>
                      {(prospect.ultimo_contato || prospect.proxima_acao) && (
                        <div className="mt-3 pt-3 border-t flex gap-6 text-sm text-muted-foreground">
                          {prospect.ultimo_contato && (
                            <span>Último contato: {new Date(prospect.ultimo_contato).toLocaleDateString()}</span>
                          )}
                          {prospect.proxima_acao && (
                            <span>Próxima ação: {new Date(prospect.proxima_acao).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
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
    </DashboardLayout>
  );
};

export default Prospects;
