import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportResult {
  total: number;
  distribuidos: number;
  nao_distribuidos: number;
  erros: string[];
  detalhes: Array<{
    linha: number;
    empresa: string;
    status: 'sucesso' | 'erro' | 'sem_vendedor';
    mensagem: string;
  }>;
}

const ImportarClientes = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("tipo_usuario")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.tipo_usuario === 'admin');
    } catch (error) {
      console.error("Erro ao verificar permissões:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
        setFile(selectedFile);
        setResult(null);
      } else {
        toast({
          title: "Formato inválido",
          description: "Apenas arquivos CSV ou Excel são aceitos",
          variant: "destructive",
        });
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error("Arquivo vazio ou sem dados");
        }

        const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());
        const prospects = [];
        const erros: string[] = [];
        const detalhes: ImportResult['detalhes'] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(/[,;]/).map(v => v.trim());
          
          const nomeIdx = headers.findIndex(h => h.includes('empresa') || h.includes('nome'));
          const municipioIdx = headers.findIndex(h => h.includes('municipio') || h.includes('cidade'));
          const ufIdx = headers.findIndex(h => h.includes('uf') || h.includes('estado'));
          const cnpjIdx = headers.findIndex(h => h.includes('cnpj'));
          const emailIdx = headers.findIndex(h => h.includes('email'));
          const telefoneIdx = headers.findIndex(h => h.includes('telefone') || h.includes('fone'));
          const contatoIdx = headers.findIndex(h => h.includes('contato'));

          const nome_empresa = values[nomeIdx] || '';
          const municipio_nome = values[municipioIdx] || '';
          const uf = values[ufIdx] || '';

          if (!nome_empresa || !municipio_nome) {
            erros.push(`Linha ${i + 1}: Nome da empresa ou município não informado`);
            detalhes.push({
              linha: i + 1,
              empresa: nome_empresa || 'N/A',
              status: 'erro',
              mensagem: 'Dados incompletos'
            });
            continue;
          }

          // Buscar município e vendedor
          const { data: municipio } = await supabase
            .from("municipios")
            .select("id, vendedor_id")
            .ilike("nome", municipio_nome)
            .maybeSingle();

          prospects.push({
            nome_empresa,
            municipio_id: municipio?.id,
            vendedor_id: municipio?.vendedor_id,
            cnpj: values[cnpjIdx] || null,
            email: values[emailIdx] || null,
            telefone: values[telefoneIdx] || null,
            contato_principal: values[contatoIdx] || null,
            importado_planilha: true,
            status: 'novo',
            uf: uf || null
          });

          detalhes.push({
            linha: i + 1,
            empresa: nome_empresa,
            status: municipio?.vendedor_id ? 'sucesso' : 'sem_vendedor',
            mensagem: municipio?.vendedor_id 
              ? 'Distribuído automaticamente' 
              : `Município ${municipio_nome} sem vendedor atribuído`
          });
        }

        // Inserir prospects
        const { data: inserted, error: insertError } = await supabase
          .from("prospects")
          .insert(prospects)
          .select();

        if (insertError) throw insertError;

        const distribuidos = prospects.filter(p => p.vendedor_id).length;
        const nao_distribuidos = prospects.length - distribuidos;

        setResult({
          total: prospects.length,
          distribuidos,
          nao_distribuidos,
          erros,
          detalhes
        });

        toast({
          title: "Importação concluída",
          description: `${distribuidos} clientes distribuídos, ${nao_distribuidos} pendentes`,
        });
      };

      reader.readAsText(file);
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = "nome_empresa,cnpj,municipio,uf,contato_principal,email,telefone\n" +
                    "Empresa Exemplo,12.345.678/0001-90,São Paulo,SP,João Silva,joao@exemplo.com,11999999999";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_importacao.csv';
    a.click();
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Apenas administradores podem importar clientes.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Importar Clientes</h2>
          <p className="text-muted-foreground">
            Importe clientes em massa e distribua automaticamente por município
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload de Arquivo</CardTitle>
              <CardDescription>
                Selecione um arquivo CSV ou Excel com os dados dos clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Arquivo selecionado: {file.name}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={!file || loading}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {loading ? "Importando..." : "Importar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modelo de Importação</CardTitle>
              <CardDescription>
                Baixe o modelo CSV com os campos necessários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <p className="font-medium">Campos obrigatórios:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>nome_empresa</li>
                  <li>municipio</li>
                </ul>
                <p className="font-medium mt-4">Campos opcionais:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>cnpj</li>
                  <li>uf</li>
                  <li>contato_principal</li>
                  <li>email</li>
                  <li>telefone</li>
                </ul>
              </div>
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Baixar Modelo CSV
              </Button>
            </CardContent>
          </Card>
        </div>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado da Importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-success">{result.distribuidos}</div>
                  <div className="text-sm text-muted-foreground">Distribuídos</div>
                </div>
                <div className="text-center p-4 bg-warning/10 rounded-lg">
                  <div className="text-2xl font-bold text-warning">{result.nao_distribuidos}</div>
                  <div className="text-sm text-muted-foreground">Sem vendedor</div>
                </div>
              </div>

              {result.detalhes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Detalhes:</h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {result.detalhes.map((detalhe, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {detalhe.status === 'sucesso' ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : detalhe.status === 'sem_vendedor' ? (
                            <AlertCircle className="h-4 w-4 text-warning" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">{detalhe.empresa}</span>
                        </div>
                        <Badge variant={
                          detalhe.status === 'sucesso' ? 'default' : 
                          detalhe.status === 'sem_vendedor' ? 'secondary' : 
                          'destructive'
                        }>
                          {detalhe.mensagem}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.erros.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Erros encontrados:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {result.erros.map((erro, idx) => (
                        <li key={idx}>{erro}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ImportarClientes;
