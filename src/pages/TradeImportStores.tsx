import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Sparkles } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import * as XLSX from "xlsx";

const TradeImportStores = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [textoIA, setTextoIA] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);

  if (!permissionsLoading && !hasPermission("trade_import_stores")) {
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
    if (!textoIA.trim()) {
      toast.error("Digite ou cole os dados para análise");
      return;
    }

    setLoadingIA(true);

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "analisar-planilha-ia",
        {
          body: { texto: textoIA, tipo: "stores" },
        }
      );

      if (functionError) {
        throw functionError;
      }

      if (!functionData?.stores || !Array.isArray(functionData.stores)) {
        throw new Error("Formato de resposta inválido da IA");
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
    } catch (error: any) {
      console.error("Erro na importação via IA:", error);
      toast.error("Erro ao processar com IA: " + error.message);
    } finally {
      setLoadingIA(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Lojas</h1>
          <p className="text-muted-foreground">
            Importe lojas e PDVs de planilhas ou com IA
          </p>
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
                  disabled={!file || loading}
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
                <CardTitle>Importação Inteligente com IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="textoIA">
                    Cole os dados das lojas (qualquer formato)
                  </Label>
                  <Textarea
                    id="textoIA"
                    placeholder="Cole aqui os dados das lojas... A IA vai analisar e estruturar automaticamente.

Exemplo:
Loja Carrefour Centro, CNPJ 12.345.678/0001-99, Rua Principal 123, São Paulo-SP
Supermercado Extra Norte, contato@extra.com, (11) 98765-4321
..."
                    value={textoIA}
                    onChange={(e) => setTextoIA(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={handleImportIA}
                  disabled={!textoIA.trim() || loadingIA}
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
                      Importar com IA
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
