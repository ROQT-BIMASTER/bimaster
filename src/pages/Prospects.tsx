import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  cnpj: string | null;
  contato_principal: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
}

const Prospects = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
      novo: { label: "Novo", variant: "default" },
      em_contato: { label: "Em Contato", variant: "secondary" },
      proposta_enviada: { label: "Proposta Enviada", variant: "outline" },
      negociacao: { label: "Negociação", variant: "default" },
      ganho: { label: "Ganho", variant: "default" },
      perdido: { label: "Perdido", variant: "destructive" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const filteredProspects = prospects.filter((prospect) =>
    prospect.nome_empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prospect.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prospect.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Prospects</h2>
            <p className="text-muted-foreground">Gerencie seus prospects e oportunidades</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Prospect
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Prospects</CardTitle>
            <CardDescription>
              <div className="flex items-center gap-2 mt-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por empresa, CNPJ ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando prospects...</div>
            ) : filteredProspects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhum prospect encontrado" : "Nenhum prospect cadastrado"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Última Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProspects.map((prospect) => (
                    <TableRow key={prospect.id}>
                      <TableCell className="font-medium">{prospect.nome_empresa}</TableCell>
                      <TableCell>{prospect.cnpj || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{prospect.contato_principal || "-"}</div>
                          <div className="text-muted-foreground">{prospect.email || "-"}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                      <TableCell>
                        {prospect.categoria ? (
                          <Badge variant="outline">{prospect.categoria}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {prospect.ultimo_contato
                          ? new Date(prospect.ultimo_contato).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Prospects;
