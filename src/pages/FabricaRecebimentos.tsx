import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DetalhesNotaFiscalDialog } from "@/components/fabrica/DetalhesNotaFiscalDialog";
import { MapearProdutosDialog } from "@/components/fabrica/MapearProdutosDialog";

interface NotaFiscal {
  id: string;
  chave_acesso: string;
  numero: string;
  serie: string;
  data_emissao: string;
  valor_total: number;
  status: string;
  fornecedor: {
    razao_social: string;
  };
  itens_count?: number;
}

export default function FabricaRecebimentos() {
  const [uploading, setUploading] = useState(false);
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotaId, setSelectedNotaId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mapearNotaId, setMapearNotaId] = useState<string | null>(null);
  const [mapearOpen, setMapearOpen] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      toast.error("Apenas arquivos XML são aceitos");
      return;
    }

    setUploading(true);

    try {
      const xmlText = await file.text();
      
      // Enviar para edge function processar
      const { data, error } = await supabase.functions.invoke('process-nfe-xml', {
        body: { xml: xmlText }
      });

      if (error) throw error;

      toast.success("XML importado com sucesso!");
      
      // Se houver itens não mapeados, abrir dialog de mapeamento
      if (data?.itens_processados?.naoMapeados > 0) {
        setMapearNotaId(data.nota_id);
        setMapearOpen(true);
      }
      
      fetchNotas(); // Recarregar lista
    } catch (error: any) {
      console.error("Erro ao importar XML:", error);
      toast.error(error.message || "Erro ao importar XML");
    } finally {
      setUploading(false);
      event.target.value = ''; // Limpar input
    }
  };

  const fetchNotas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fabrica_notas_fiscais')
        .select(`
          *,
          fornecedor:fabrica_fornecedores(razao_social)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error("Erro ao buscar notas:", error);
        throw error;
      }

      console.log("Notas encontradas:", data?.length || 0);

      // Buscar contagem de itens para cada nota
      const notasComItens = await Promise.all(
        (data || []).map(async (nota) => {
          const { count } = await supabase
            .from('fabrica_itens_nf')
            .select('*', { count: 'exact', head: true })
            .eq('nota_id', nota.id);
          
          return { ...nota, itens_count: count || 0 };
        })
      );

      setNotas(notasComItens as NotaFiscal[]);
    } catch (error: any) {
      console.error("Erro ao buscar notas:", error);
      toast.error(error.message || "Erro ao buscar notas fiscais");
    } finally {
      setLoading(false);
    }
  };

  // Carregar notas ao montar o componente
  useEffect(() => {
    fetchNotas();
  }, []);

  const getStatusBadge = (status: string) => {
    const statusMap = {
      imported: { label: "Importado", variant: "secondary" as const, icon: Clock },
      processing: { label: "Processando", variant: "default" as const, icon: Clock },
      validated: { label: "Validado", variant: "outline" as const, icon: CheckCircle2 },
      confirmed: { label: "Confirmado", variant: "default" as const, icon: CheckCircle2 },
      rejected: { label: "Rejeitado", variant: "destructive" as const, icon: XCircle },
    };

    const config = statusMap[status as keyof typeof statusMap] || statusMap.imported;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recebimento de Matéria-Prima</h1>
          <p className="text-muted-foreground mt-2">
            Importe XML de NF-e e gerencie o recebimento de matérias-primas
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar XML de NF-e
            </CardTitle>
            <CardDescription>
              Envie o arquivo XML da nota fiscal eletrônica para processar automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                type="file"
                accept=".xml"
                onChange={handleFileUpload}
                disabled={uploading}
                className="max-w-md"
              />
              <Button disabled={uploading} variant="outline">
                {uploading ? "Processando..." : "Selecionar Arquivo"}
              </Button>
            </div>
            
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                O sistema irá validar o XML, mapear produtos automaticamente e solicitar conferência para itens não mapeados
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Notas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notas Fiscais Recentes
            </CardTitle>
            <CardDescription>
              Últimas 20 notas fiscais importadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : notas.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhuma nota fiscal importada ainda</p>
            ) : (
              <div className="space-y-2">
                {notas.map((nota) => (
                  <div
                    key={nota.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">NF-e {nota.numero}</span>
                        {nota.serie && <span className="text-sm text-muted-foreground">Série {nota.serie}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {nota.fornecedor?.razao_social || "Fornecedor não identificado"}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{format(new Date(nota.data_emissao), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                        <span>R$ {nota.valor_total.toFixed(2)}</span>
                        <span>{nota.itens_count} {nota.itens_count === 1 ? 'item' : 'itens'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusBadge(nota.status)}
                      {nota.status === 'imported' && (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => {
                            setMapearNotaId(nota.id);
                            setMapearOpen(true);
                          }}
                        >
                          Mapear Produtos
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedNotaId(nota.id);
                          setDetailsOpen(true);
                        }}
                      >
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DetalhesNotaFiscalDialog
        notaId={selectedNotaId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <MapearProdutosDialog
        notaId={mapearNotaId}
        open={mapearOpen}
        onOpenChange={setMapearOpen}
      />
    </DashboardLayout>
  );
}