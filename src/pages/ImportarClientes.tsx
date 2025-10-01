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
import * as XLSX from 'xlsx';

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

  const validateCNPJ = (cnpj: string): boolean => {
    // Remove caracteres não numéricos
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
    
    // Verifica se tem 14 dígitos
    if (cleanCNPJ.length !== 14) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cleanCNPJ)) return false;
    
    // Validação dos dígitos verificadores
    let tamanho = cleanCNPJ.length - 2;
    let numeros = cleanCNPJ.substring(0, tamanho);
    const digitos = cleanCNPJ.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    
    tamanho = tamanho + 1;
    numeros = cleanCNPJ.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado === parseInt(digitos.charAt(1));
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const data = e.target?.result;
        let rows: any[] = [];
        let headers: string[] = [];

        // Processar Excel
        if (extension === 'xlsx' || extension === 'xls') {
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
          
          if (jsonData.length < 2) {
            throw new Error("Arquivo vazio ou sem dados");
          }
          
          headers = jsonData[0].map((h: any) => String(h || '').trim().toLowerCase());
          rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
        } 
        // Processar CSV
        else {
          const text = new TextDecoder('utf-8').decode(data as ArrayBuffer);
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            throw new Error("Arquivo vazio ou sem dados");
          }

          const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if ((char === ',' || char === ';') && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
          rows = lines.slice(1).map(line => parseCSVLine(line));
        }

        const prospects = [];
        const erros: string[] = [];
        const detalhes: ImportResult['detalhes'] = [];

        console.log("=== DEBUG IMPORTAÇÃO ===");
        console.log("Cabeçalhos encontrados:", headers);
        console.log("Total de linhas:", rows.length);

        for (let i = 0; i < rows.length; i++) {
          const values = rows[i].map((v: any) => String(v || '').trim());
          
          console.log(`\n--- Processando linha ${i + 1} ---`);
          console.log("Valores brutos:", values);
          
          const nomeIdx = headers.findIndex(h => h.includes('empresa') || h.includes('nome') || h.includes('razao') || h.includes('razão'));
          const municipioIdx = headers.findIndex(h => h.includes('municipio') || h.includes('município') || h.includes('cidade'));
          const ufIdx = headers.findIndex(h => h.includes('uf') || h.includes('estado'));
          const cnpjIdx = headers.findIndex(h => h.includes('cnpj'));
          const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
          const telefoneIdx = headers.findIndex(h => h.includes('telefone') || h.includes('fone') || h.includes('celular'));
          const contatoIdx = headers.findIndex(h => h.includes('contato') && !h.includes('telefone'));
          const enderecoIdx = headers.findIndex(h => h.includes('endereco') || h.includes('endereço') || h.includes('rua') || h.includes('logradouro'));
          const porteIdx = headers.findIndex(h => h.includes('porte'));
          const categoriaIdx = headers.findIndex(h => h.includes('categoria'));
          const observacoesIdx = headers.findIndex(h => h.includes('observa') || h.includes('obs'));

          console.log("Índices:", { nomeIdx, municipioIdx, ufIdx });

          const nome_empresa = (values[nomeIdx] || '').trim().replace(/^["']|["']$/g, '');
          const municipio_nome = (values[municipioIdx] || '').trim().replace(/^["']|["']$/g, '');
          const uf = (values[ufIdx] || '').trim().replace(/^["']|["']$/g, '');
          const cnpj = (values[cnpjIdx] || '').trim().replace(/^["']|["']$/g, '');

          console.log("Valores extraídos:", { nome_empresa, municipio_nome, uf, cnpj });

          if (!nome_empresa || !municipio_nome) {
            const mensagemErro = `Linha ${i + 1}: ${!nome_empresa ? 'Nome da empresa' : ''} ${!nome_empresa && !municipio_nome ? 'e' : ''} ${!municipio_nome ? 'Município' : ''} não informado`;
            erros.push(mensagemErro);
            detalhes.push({
              linha: i + 1,
              empresa: nome_empresa || 'N/A',
              status: 'erro',
              mensagem: 'Dados incompletos - verifique nome da empresa e município'
            });
            continue;
          }

          // Validar e limpar CNPJ se fornecido
          let cnpjValidado = cnpj;
          let avisosCNPJ: string[] = [];
          if (cnpj && cnpj.length > 3 && !validateCNPJ(cnpj)) {
            console.warn(`CNPJ inválido na linha ${i + 1}: ${cnpj} - será importado sem CNPJ`);
            avisosCNPJ.push(`CNPJ inválido (${cnpj}) - importado sem CNPJ`);
            cnpjValidado = ''; // Limpa o CNPJ inválido
          }

          // Verificar duplicata por CNPJ (apenas se CNPJ for válido)
          if (cnpjValidado) {
            const { data: existente } = await supabase
              .from("prospects")
              .select("id")
              .eq("cnpj", cnpjValidado)
              .maybeSingle();

            if (existente) {
              erros.push(`Linha ${i + 1}: CNPJ ${cnpjValidado} já cadastrado`);
              detalhes.push({
                linha: i + 1,
                empresa: nome_empresa,
                status: 'erro',
                mensagem: 'CNPJ duplicado'
              });
              continue;
            }
          }

          // Buscar município e vendedor
          const { data: municipio } = await supabase
            .from("municipios")
            .select("id, vendedor_id")
            .ilike("nome", municipio_nome)
            .maybeSingle();

          prospects.push({
            nome_empresa,
            municipio_id: municipio?.id || null,
            vendedor_id: municipio?.vendedor_id || null,
            cnpj: cnpjValidado || null,
            email: (values[emailIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            telefone: (values[telefoneIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            contato_principal: (values[contatoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            endereco: (values[enderecoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            porte_empresa: (values[porteIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            categoria: (values[categoriaIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            observacoes: (values[observacoesIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            importado_planilha: true,
            status: 'novo',
            uf: uf || null
          });

          detalhes.push({
            linha: i + 1,
            empresa: nome_empresa,
            status: municipio?.vendedor_id ? 'sucesso' : 'sem_vendedor',
            mensagem: avisosCNPJ.length > 0 
              ? avisosCNPJ[0] 
              : (municipio?.vendedor_id 
                ? 'Distribuído automaticamente' 
                : `Município ${municipio_nome} sem vendedor atribuído`)
          });
        }

        console.log("=== RESULTADOS DO PROCESSAMENTO ===");
        console.log("Total de prospects processados:", prospects.length);
        console.log("Total de erros:", erros.length);

        // Verificar se há prospects para inserir
        if (prospects.length === 0) {
          throw new Error("Nenhum registro válido encontrado para importar. Verifique os erros acima.");
        }

        // Inserir prospects
        console.log("Iniciando inserção no banco...");
        const { data: inserted, error: insertError } = await supabase
          .from("prospects")
          .insert(prospects)
          .select();

        if (insertError) {
          console.error("Erro ao inserir:", insertError);
          throw insertError;
        }

        console.log("Inserção concluída:", inserted?.length, "registros");

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

      if (extension === 'xlsx' || extension === 'xls') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
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
    const template = "nome_empresa,cnpj,municipio,uf,endereco,contato_principal,email,telefone,porte_empresa,categoria,observacoes\n" +
                    "Empresa Exemplo,11.222.333/0001-81,São Paulo,SP,Rua Exemplo 123,João Silva,joao@exemplo.com,(11) 99999-9999,Médio,A,Cliente em potencial";
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
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
                  <li>uf (estado)</li>
                  <li>endereco</li>
                  <li>contato_principal</li>
                  <li>email</li>
                  <li>telefone</li>
                  <li>porte_empresa (Pequeno, Médio, Grande)</li>
                  <li>categoria (A, B, C, D)</li>
                  <li>observacoes</li>
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
