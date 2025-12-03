import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Sparkles, Download } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import * as XLSX from "xlsx";
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const TradeImportStores = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [textoIA, setTextoIA] = useState("");
  const [pdfIA, setPdfIA] = useState<File | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [supervisores, setSupervisores] = useState<any[]>([]);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>("");
  const [supervisorSelecionado, setSupervisorSelecionado] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!permissionsLoading && hasPermission("trade_import_stores")) {
      fetchUsuarios();
      fetchCurrentUser();
    }
  }, [permissionsLoading]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setCurrentUserRole(roleData?.role || null);

      // Se for vendedor ou promotor, já seleciona ele mesmo
      if (roleData?.role === 'vendedor' || roleData?.role === 'promotor') {
        setVendedorSelecionado(user.id);
      }
    } catch (error) {
      console.error("Erro ao buscar usuário atual:", error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("status", "ativo")
        .order("nome");

      if (!profiles) return;

      const userIds = profiles.map(p => p.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const vendedoresList = profiles
        .filter(p => {
          const role = roleMap.get(p.id);
          return role === 'vendedor' || role === 'promotor';
        })
        .map(p => ({ ...p, role: roleMap.get(p.id) }));

      const supervisoresList = profiles
        .filter(p => {
          const role = roleMap.get(p.id);
          return role === 'supervisor' || role === 'admin';
        })
        .map(p => ({ ...p, role: roleMap.get(p.id) }));

      setVendedores(vendedoresList);
      setSupervisores(supervisoresList);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Carregando permissões...</div>
      </DashboardLayout>
    );
  }

  if (!hasPermission("trade_import_stores")) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      toast.success("Arquivo selecionado: " + selectedFile.name);
    }
  };

  const handleTraditionalImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo para importar");
      return;
    }

    if (!vendedorSelecionado) {
      toast.error("Selecione um vendedor responsável");
      return;
    }

    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error("Arquivo vazio ou sem dados");
        setLoading(false);
        return;
      }

      const headers = jsonData[0].map((h: any) =>
        String(h || "").toLowerCase().trim()
      );

      // Mapeamento de colunas
      const codeIdx = headers.findIndex((h) => h.includes("codigo") || h.includes("code"));
      const nameIdx = headers.findIndex((h) => h.includes("nome") || h.includes("name") || h.includes("loja"));
      const chainIdx = headers.findIndex((h) => h.includes("rede") || h.includes("chain"));
      const cnpjIdx = headers.findIndex((h) => h.includes("cnpj"));
      const addressIdx = headers.findIndex((h) => h.includes("endereco") || h.includes("address"));
      const cityIdx = headers.findIndex((h) => h.includes("cidade") || h.includes("city"));
      const stateIdx = headers.findIndex((h) => h.includes("estado") || h.includes("uf") || h.includes("state"));
      const phoneIdx = headers.findIndex((h) => h.includes("telefone") || h.includes("phone"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const categoryIdx = headers.findIndex((h) => h.includes("categoria") || h.includes("category") || h.includes("tipo"));
      const priorityIdx = headers.findIndex((h) => h.includes("prioridade") || h.includes("priority"));

      if (nameIdx === -1) {
        toast.error("Coluna 'Nome' não encontrada no arquivo");
        setLoading(false);
        return;
      }

      // Buscar supervisor_id do vendedor se não foi informado
      let supervisorId = supervisorSelecionado || null;
      if (!supervisorId && vendedorSelecionado) {
        const { data: vendedorProfile } = await supabase
          .from("profiles")
          .select("supervisor_id")
          .eq("id", vendedorSelecionado)
          .single();
        
        supervisorId = vendedorProfile?.supervisor_id || null;
      }

      const stores = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const name = String(row[nameIdx] || "").trim();
        if (!name) continue;

        const code = codeIdx !== -1 ? String(row[codeIdx] || "").trim() : `STORE-${Date.now()}-${i}`;

        stores.push({
          code,
          name,
          chain: chainIdx !== -1 ? String(row[chainIdx] || "").trim() || null : null,
          cnpj: cnpjIdx !== -1 ? String(row[cnpjIdx] || "").trim() || null : null,
          address: addressIdx !== -1 ? String(row[addressIdx] || "").trim() || null : null,
          city: cityIdx !== -1 ? String(row[cityIdx] || "").trim() || null : null,
          state: stateIdx !== -1 ? String(row[stateIdx] || "").trim() || null : null,
          phone: phoneIdx !== -1 ? String(row[phoneIdx] || "").trim() || null : null,
          email: emailIdx !== -1 ? String(row[emailIdx] || "").trim() || null : null,
          category: categoryIdx !== -1 ? String(row[categoryIdx] || "").trim() || null : null,
          priority: priorityIdx !== -1 ? String(row[priorityIdx] || "").trim() || null : null,
          status: "active",
          vendedor_id: vendedorSelecionado,
          supervisor_id: supervisorId,
        });
      }

      if (stores.length === 0) {
        toast.error("Nenhuma loja válida encontrada no arquivo");
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const storesWithUser = stores.map(s => ({
        ...s,
        created_by: userData.user?.id
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("stores")
        .insert(storesWithUser)
        .select();

      if (insertError) {
        console.error("Erro ao inserir:", insertError);
        toast.error("Erro ao importar lojas: " + insertError.message);
      } else {
        toast.success(`${inserted?.length || 0} lojas importadas com sucesso!`);
        setFile(null);
      }
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error("Erro ao processar arquivo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportIA = async () => {
    if (!textoIA.trim() && !pdfIA) {
      toast.error("Digite os dados ou faça upload de um PDF para análise");
      return;
    }

    if (!vendedorSelecionado) {
      toast.error("Selecione um vendedor responsável");
      return;
    }

    setLoadingIA(true);

    try {
      let textoParaAnalise = textoIA;

      if (pdfIA) {
        toast.info("Extraindo texto do PDF...");
        
        // Ler o PDF como ArrayBuffer
        const arrayBuffer = await pdfIA.arrayBuffer();
        
        // Usar pdf.js para extrair texto
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Extrair texto de todas as páginas
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        
        if (!fullText.trim()) {
          toast.error("Não foi possível extrair texto do PDF. Tente um PDF com texto selecionável.");
          setLoadingIA(false);
          return;
        }
        
        textoParaAnalise = fullText;
        toast.success("Texto extraído com sucesso! Analisando com IA...");
      }

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "analisar-planilha-ia",
        {
          body: { texto: textoParaAnalise, tipo: "stores" },
        }
      );

      if (functionError) {
        throw functionError;
      }

      if (!functionData?.stores || !Array.isArray(functionData.stores)) {
        throw new Error("Formato de resposta inválido da IA");
      }

      // Buscar supervisor_id do vendedor se não foi informado
      let supervisorId = supervisorSelecionado || null;
      if (!supervisorId && vendedorSelecionado) {
        const { data: vendedorProfile } = await supabase
          .from("profiles")
          .select("supervisor_id")
          .eq("id", vendedorSelecionado)
          .single();
        
        supervisorId = vendedorProfile?.supervisor_id || null;
      }

      const stores = functionData.stores.map((store: any, idx: number) => ({
        code: store.code || `STORE-${Date.now()}-${idx}`,
        name: store.name,
        chain: store.chain || null,
        cnpj: store.cnpj || null,
        address: store.address || null,
        city: store.city || null,
        state: store.state || null,
        phone: store.phone || null,
        email: store.email || null,
        category: store.category || null,
        priority: store.priority || null,
        status: "active",
        vendedor_id: vendedorSelecionado,
        supervisor_id: supervisorId,
      }));

      const { data: userData } = await supabase.auth.getUser();
      const storesWithUser = stores.map(s => ({
        ...s,
        created_by: userData.user?.id
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("stores")
        .insert(storesWithUser)
        .select();

      if (insertError) {
        throw insertError;
      }

      toast.success(`${inserted?.length || 0} lojas importadas com sucesso via IA!`);
      setTextoIA("");
      setPdfIA(null);
    } catch (error: any) {
      console.error("Erro na importação via IA:", error);
      toast.error("Erro ao processar com IA: " + error.message);
    } finally {
      setLoadingIA(false);
    }
  };

  const handleDownloadModelo = () => {
    // Criar dados de exemplo
    const modeloData = [
      ["Código", "Nome", "Rede", "CNPJ", "Endereço", "Cidade", "Estado", "Telefone", "Email", "Categoria", "Prioridade"],
      ["LOJA001", "Supermercado Centro", "Rede Bom Preço", "12.345.678/0001-99", "Rua Principal, 123", "São Paulo", "SP", "(11) 98765-4321", "centro@exemplo.com", "supermercado", "alta"],
      ["LOJA002", "Farmácia Saúde", "Rede Farma+", "98.765.432/0001-11", "Av. Comercial, 456", "Rio de Janeiro", "RJ", "(21) 91234-5678", "contato@farma.com", "farmacia", "media"],
      ["", "Minimercado Bairro", "", "", "Rua das Flores, 789", "Curitiba", "PR", "", "", "conveniencia", "baixa"],
    ];

    // Criar workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(modeloData);

    // Definir larguras das colunas
    ws['!cols'] = [
      { wch: 12 }, // Código
      { wch: 25 }, // Nome
      { wch: 20 }, // Rede
      { wch: 20 }, // CNPJ
      { wch: 30 }, // Endereço
      { wch: 20 }, // Cidade
      { wch: 8 },  // Estado
      { wch: 18 }, // Telefone
      { wch: 25 }, // Email
      { wch: 15 }, // Categoria
      { wch: 12 }, // Prioridade
    ];

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, "Lojas");

    // Gerar arquivo e fazer download
    XLSX.writeFile(wb, "modelo_importacao_lojas.xlsx");
    toast.success("Modelo baixado com sucesso!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Importar Lojas</h1>
            <p className="text-muted-foreground">
              Importe lojas e PDVs de planilhas ou com IA
            </p>
          </div>
          <Button variant="outline" onClick={handleDownloadModelo}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Modelo
          </Button>
        </div>

        <Tabs defaultValue="tradicional" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tradicional">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Importação Tradicional
            </TabsTrigger>
            <TabsTrigger value="ia">
              <Sparkles className="mr-2 h-4 w-4" />
              Importação com IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tradicional">
            <Card>
              <CardHeader>
                <CardTitle>Upload de Planilha</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendedor-trad">Vendedor Responsável *</Label>
                    <Select 
                      value={vendedorSelecionado} 
                      onValueChange={setVendedorSelecionado}
                      disabled={currentUserRole === 'vendedor' || currentUserRole === 'promotor'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map((vendedor) => (
                          <SelectItem key={vendedor.id} value={vendedor.id}>
                            {vendedor.nome} - {vendedor.role === 'vendedor' ? 'Vendedor' : 'Promotor'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {currentUserRole === 'vendedor' || currentUserRole === 'promotor' 
                        ? 'Você foi selecionado automaticamente'
                        : 'Todas as lojas serão vinculadas a este vendedor'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supervisor-trad">Supervisor (Opcional)</Label>
                    <Select 
                      value={supervisorSelecionado || "none"} 
                      onValueChange={(value) => setSupervisorSelecionado(value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Usar supervisor do vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Usar supervisor do vendedor</SelectItem>
                        {supervisores.map((supervisor) => (
                          <SelectItem key={supervisor.id} value={supervisor.id}>
                            {supervisor.nome} - {supervisor.role === 'supervisor' ? 'Supervisor' : 'Admin'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Se não informado, será usado o supervisor vinculado ao vendedor
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Arquivo Excel (.xlsx, .xls)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                  />
                  <p className="text-sm text-muted-foreground">
                    A planilha deve conter as colunas: Nome (obrigatório), Código, Rede, CNPJ,
                    Endereço, Cidade, Estado, Telefone, Email, Categoria, Prioridade
                  </p>
                </div>

                <Button
                  onClick={handleTraditionalImport}
                  disabled={!file || loading || !vendedorSelecionado}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Upload className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar Lojas
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ia">
            <Card>
              <CardHeader>
                <CardTitle>Análise com IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendedor-ia">Vendedor Responsável *</Label>
                    <Select 
                      value={vendedorSelecionado} 
                      onValueChange={setVendedorSelecionado}
                      disabled={currentUserRole === 'vendedor' || currentUserRole === 'promotor'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map((vendedor) => (
                          <SelectItem key={vendedor.id} value={vendedor.id}>
                            {vendedor.nome} - {vendedor.role === 'vendedor' ? 'Vendedor' : 'Promotor'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supervisor-ia">Supervisor (Opcional)</Label>
                    <Select 
                      value={supervisorSelecionado || "none"} 
                      onValueChange={(value) => setSupervisorSelecionado(value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Usar supervisor do vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Usar supervisor do vendedor</SelectItem>
                        {supervisores.map((supervisor) => (
                          <SelectItem key={supervisor.id} value={supervisor.id}>
                            {supervisor.nome} - {supervisor.role === 'supervisor' ? 'Supervisor' : 'Admin'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Escolha o método de entrada</Label>
                  <Tabs defaultValue="texto" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="texto">Texto</TabsTrigger>
                      <TabsTrigger value="pdf">Upload PDF</TabsTrigger>
                    </TabsList>

                    <TabsContent value="texto" className="mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="textoIA">Dados para Análise</Label>
                        <Textarea
                          id="textoIA"
                          value={textoIA}
                          onChange={(e) => {
                            setTextoIA(e.target.value);
                            setPdfIA(null);
                          }}
                          placeholder="Cole aqui os dados das lojas (lista, tabela, texto livre, etc.)"
                          className="min-h-[200px]"
                        />
                        <p className="text-sm text-muted-foreground">
                          A IA irá analisar o texto e extrair automaticamente as informações das lojas
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="pdf" className="mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="pdfIA">Arquivo PDF</Label>
                        <Input
                          id="pdfIA"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const selectedFile = e.target.files?.[0];
                            if (selectedFile) {
                              setPdfIA(selectedFile);
                              setTextoIA("");
                              toast.success("PDF selecionado: " + selectedFile.name);
                            }
                          }}
                        />
                        {pdfIA && (
                          <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                            📄 {pdfIA.name}
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Faça upload de um PDF com dados de CNPJ, comprovantes ou listas de lojas. A IA irá extrair automaticamente todas as informações.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <Button
                  onClick={handleImportIA}
                  disabled={(!textoIA.trim() && !pdfIA) || loadingIA || !vendedorSelecionado}
                  className="w-full"
                >
                  {loadingIA ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                      Analisando com IA...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Analisar e Importar
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Dicas de Importação</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>A coluna "Nome" é obrigatória</li>
              <li>Se não houver coluna "Código", um código será gerado automaticamente</li>
              <li>Categorias sugeridas: supermercado, farmacia, atacado, conveniencia</li>
              <li>Prioridades sugeridas: alta, media, baixa</li>
              <li>Com IA, você pode colar dados de qualquer formato e ela vai estruturar</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TradeImportStores;
