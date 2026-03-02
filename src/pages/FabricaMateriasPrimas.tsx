import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Loader2, Receipt, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { NovoMateriaPrimaDialog } from "@/components/fabrica/NovoMateriaPrimaDialog";
import { EditarMateriaPrimaDialog } from "@/components/fabrica/EditarMateriaPrimaDialog";
import { DetalhesMateriaPrimaDialog } from "@/components/fabrica/DetalhesMateriaPrimaDialog";
import { DadosFiscaisProdutoDialog } from "@/components/fabrica/DadosFiscaisProdutoDialog";
import { VincularXmlInsumoDialog } from "@/components/fabrica/VincularXmlInsumoDialog";
import { TourButton } from "@/components/tour/TourButton";
import { FABRICA_MATERIAS_PRIMAS_TOUR_ID, fabricaMateriasPrimasTourSteps } from "@/components/tour/tours/fabricaMateriasPrimasTour";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";

interface MateriaPrima {
  id: string;
  codigo: string;
  nome: string;
  categoria: { nome: string } | null;
  fornecedor: { razao_social: string } | null;
  unidade_medida: { sigla: string } | null;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario: number;
  status: string;
  data_validade: string | null;
  lote: string | null;
  ativo: boolean;
}

const statusColors = {
  disponivel: "default" as const,
  quarentena: "secondary" as const,
  bloqueado: "destructive" as const,
};

const statusLabels = {
  disponivel: "Disponível",
  quarentena: "Quarentena",
  bloqueado: "Bloqueado",
};

export default function FabricaMateriasPrimas() {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [novoDialogOpen, setNovoDialogOpen] = useState(false);
  const [editarDialogOpen, setEditarDialogOpen] = useState(false);
  const [detalhesDialogOpen, setDetalhesDialogOpen] = useState(false);
  const [dadosFiscaisDialogOpen, setDadosFiscaisDialogOpen] = useState(false);
  const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
  const [selectedMP, setSelectedMP] = useState<MateriaPrima | null>(null);

  useEffect(() => {
    if (!permissionsLoading && hasPermission("fabrica_mps")) {
      fetchMateriasPrimas();
    }
  }, [permissionsLoading]);

  if (!permissionsLoading && !hasPermission("fabrica_mps")) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchMateriasPrimas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .select(`
          *,
          categoria:fabrica_categorias_mp(nome),
          fornecedor:fabrica_fornecedores(razao_social),
          unidade_medida:fabrica_unidades_medida(sigla)
        `)
        .order("nome");

      if (error) throw error;
      setMateriasPrimas(data || []);
    } catch (error) {
      console.error("Erro ao buscar matérias-primas:", error);
      toast.error("Erro ao carregar matérias-primas");
    } finally {
      setLoading(false);
    }
  };

  const filteredMPs = materiasPrimas.filter(
    (mp) =>
      mp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mp.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (mp: MateriaPrima) => {
    setSelectedMP(mp);
    setEditarDialogOpen(true);
  };

  const handleDetails = (mp: MateriaPrima) => {
    setSelectedMP(mp);
    setDetalhesDialogOpen(true);
  };

  const handleDadosFiscais = (mp: MateriaPrima) => {
    setSelectedMP(mp);
    setDadosFiscaisDialogOpen(true);
  };

  const handleVincularXml = (mp: MateriaPrima) => {
    setSelectedMP(mp);
    setXmlDialogOpen(true);
  };

  const handleXmlVinculado = async (dados: { fornecedor: string; custo_nf: number; nf_referencia: string; codigo: string; dados_fiscais?: { ncm: string; cfop: string } }) => {
    if (!selectedMP) return;
    try {
      const updates: Record<string, any> = {
        custo_unitario: dados.custo_nf,
      };

      const { error } = await supabase
        .from("fabrica_materias_primas")
        .update(updates)
        .eq("id", selectedMP.id);

      if (error) throw error;
      toast.success(`Custo atualizado para R$ ${dados.custo_nf.toFixed(2)} via ${dados.nf_referencia}`);
      fetchMateriasPrimas();
    } catch (error: any) {
      toast.error("Erro ao atualizar matéria-prima: " + error.message);
    }
  };

  const handleExcluir = async (mp: MateriaPrima) => {
    if (!confirm(`Tem certeza que deseja excluir a matéria-prima "${mp.nome}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("fabrica_materias_primas")
        .delete()
        .eq("id", mp.id);

      if (error) throw error;

      toast.success("Matéria-prima excluída com sucesso!");
      fetchMateriasPrimas();
    } catch (error: any) {
      console.error("Erro ao excluir matéria-prima:", error);
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleToggleAtivo = async (mp: MateriaPrima) => {
    const novoStatus = !mp.ativo;
    const acao = novoStatus ? "ativar" : "inativar";
    
    if (!confirm(`Tem certeza que deseja ${acao} a matéria-prima "${mp.nome}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("fabrica_materias_primas")
        .update({ ativo: novoStatus })
        .eq("id", mp.id);

      if (error) throw error;

      toast.success(`Matéria-prima ${novoStatus ? "ativada" : "inativada"} com sucesso!`);
      fetchMateriasPrimas();
    } catch (error: any) {
      console.error("Erro ao alterar status:", error);
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  if (loading || permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div data-tour="mps-header" className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Matérias-Primas</h1>
            <p className="text-muted-foreground">Gestão de insumos, embalagens e componentes</p>
          </div>
          <div className="flex gap-2">
            <ManualFabricaDrawer screen="materias-primas" />
            <Button data-tour="mps-add-button" className="gap-2" onClick={() => setNovoDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Nova Matéria-Prima
            </Button>
          </div>
        </div>

        <Card data-tour="mps-filters" className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-tour="mps-table">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Custo Unitário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMPs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma matéria-prima encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMPs.map((mp) => (
                    <TableRow
                      key={mp.id}
                      className={`cursor-pointer hover:bg-muted/50 ${!mp.ativo ? "opacity-60" : ""}`}
                      onClick={() => handleDetails(mp)}
                    >
                      <TableCell className={`font-mono font-medium ${!mp.ativo ? "text-destructive line-through" : ""}`}>
                        {mp.codigo}
                      </TableCell>
                      <TableCell className={`font-medium ${!mp.ativo ? "text-destructive line-through" : ""}`}>
                        {mp.nome}
                      </TableCell>
                      <TableCell className={!mp.ativo ? "text-destructive line-through" : ""}>
                        {mp.categoria?.nome || "-"}
                      </TableCell>
                      <TableCell className={`text-muted-foreground ${!mp.ativo ? "text-destructive line-through" : ""}`}>
                        {mp.fornecedor?.razao_social || "-"}
                      </TableCell>
                      <TableCell>
                        <div className={`flex flex-col ${!mp.ativo ? "text-destructive line-through" : ""}`}>
                          <span className="font-medium">
                            {mp.estoque_atual.toFixed(3)} {mp.unidade_medida?.sigla}
                          </span>
                          {mp.estoque_atual < mp.estoque_minimo && (
                            <span className="text-xs text-destructive">
                              Mín: {mp.estoque_minimo.toFixed(3)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={!mp.ativo ? "text-destructive line-through" : ""}>
                        R$ {mp.custo_unitario?.toFixed(2) || "0,00"}/{mp.unidade_medida?.sigla}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[mp.status as keyof typeof statusColors]}>
                          {statusLabels[mp.status as keyof typeof statusLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDadosFiscais(mp);
                            }}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Fiscal
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVincularXml(mp);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            XML
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(mp);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant={mp.ativo ? "outline" : "default"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAtivo(mp);
                            }}
                            className={mp.ativo ? "text-orange-600 hover:text-orange-700 border-orange-300" : "bg-green-600 hover:bg-green-700"}
                          >
                            {mp.ativo ? "Inativar" : "Ativar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExcluir(mp);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <NovoMateriaPrimaDialog
        open={novoDialogOpen}
        onOpenChange={setNovoDialogOpen}
        onSuccess={() => fetchMateriasPrimas()}
      />

      {selectedMP && (
        <>
          <EditarMateriaPrimaDialog
            open={editarDialogOpen}
            onOpenChange={setEditarDialogOpen}
            materiaPrima={selectedMP}
            onSuccess={fetchMateriasPrimas}
          />
          <DetalhesMateriaPrimaDialog
            open={detalhesDialogOpen}
            onOpenChange={setDetalhesDialogOpen}
            materiaPrima={selectedMP}
          />
          <DadosFiscaisProdutoDialog
            open={dadosFiscaisDialogOpen}
            onOpenChange={setDadosFiscaisDialogOpen}
            produtoId={selectedMP.id}
            produtoNome={selectedMP.nome}
          />
          <VincularXmlInsumoDialog
            open={xmlDialogOpen}
            onOpenChange={setXmlDialogOpen}
            insumoNome={selectedMP.nome}
            insumoId={selectedMP.id}
            mpId={selectedMP.id}
            onVincular={handleXmlVinculado}
          />
        </>
      )}
      
      <TourButton 
        tourId={FABRICA_MATERIAS_PRIMAS_TOUR_ID}
        tourSteps={fabricaMateriasPrimasTourSteps}
        title="Tour de Matérias-Primas"
        description="Aprenda a gerenciar matérias-primas e insumos"
      />
    </DashboardLayout>
  );
}
