import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Sparkles, Download, ArrowLeft } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import * as XLSX from "xlsx";
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ImportarProdutosAcabados() {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [textoIA, setTextoIA] = useState("");
  const [pdfIA, setPdfIA] = useState<File | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Carregando permissões...</div>
      </DashboardLayout>
    );
  }

  if (!hasPermission("fabrica_produtos_acabados")) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      toast.success("Arquivo selecionado: " + selectedFile.name);
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setPdfIA(selectedFile);
      toast.success("PDF selecionado: " + selectedFile.name);
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
      const codigoIdx = headers.findIndex((h) => h.includes("codigo") || h.includes("código"));
      const nomeIdx = headers.findIndex((h) => h.includes("nome") || h.includes("name"));
      const tipoIdx = headers.findIndex((h) => h.includes("tipo") || h.includes("type"));
      const skuIdx = headers.findIndex((h) => h.includes("sku"));
      const eanIdx = headers.findIndex((h) => h.includes("ean") || h.includes("barras"));
      const categoriaIdx = headers.findIndex((h) => h.includes("categoria") || h.includes("category"));
      const subcategoriaIdx = headers.findIndex((h) => h.includes("subcategoria"));
      const linhaIdx = headers.findIndex((h) => h.includes("linha"));
      const marcaIdx = headers.findIndex((h) => h.includes("marca") || h.includes("brand"));
      const unidadeIdx = headers.findIndex((h) => h.includes("unidade") || h.includes("unit"));
      const descricaoCurtaIdx = headers.findIndex((h) => h.includes("descricao") || h.includes("descrição"));
      const statusIdx = headers.findIndex((h) => h.includes("status"));

      if (nomeIdx === -1) {
        toast.error("Coluna 'Nome' não encontrada no arquivo");
        setLoading(false);
        return;
      }

      const produtos = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const nome = String(row[nomeIdx] || "").trim();
        if (!nome) continue;

        const codigo = codigoIdx !== -1 ? String(row[codigoIdx] || "").trim() : `PROD-${Date.now()}-${i}`;
        const tipo = tipoIdx !== -1 ? String(row[tipoIdx] || "ACABADO").trim().toUpperCase() : "ACABADO";

        produtos.push({
          codigo,
          nome,
          tipo: tipo === "INTER" ? "INTER" : "ACABADO",
          sku: skuIdx !== -1 ? String(row[skuIdx] || "").trim() || null : null,
          codigo_barras_ean: eanIdx !== -1 ? String(row[eanIdx] || "").trim() || null : null,
          categoria: categoriaIdx !== -1 ? String(row[categoriaIdx] || "").trim() || null : null,
          subcategoria: subcategoriaIdx !== -1 ? String(row[subcategoriaIdx] || "").trim() || null : null,
          linha: linhaIdx !== -1 ? String(row[linhaIdx] || "").trim() || null : null,
          marca: marcaIdx !== -1 ? String(row[marcaIdx] || "").trim() || null : null,
          unidade: unidadeIdx !== -1 ? String(row[unidadeIdx] || "UN").trim() : "UN",
          descricao_curta: descricaoCurtaIdx !== -1 ? String(row[descricaoCurtaIdx] || "").trim() || null : null,
          ativo: statusIdx !== -1 ? String(row[statusIdx] || "").toLowerCase() !== "inativo" : true,
        });
      }

      if (produtos.length === 0) {
        toast.error("Nenhum produto válido encontrado no arquivo");
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const produtosWithUser = produtos.map(p => ({
        ...p,
        created_by: userData.user?.id
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("fabrica_produtos")
        .insert(produtosWithUser)
        .select();

      if (insertError) {
        console.error("Erro ao inserir:", insertError);
        toast.error("Erro ao importar produtos: " + insertError.message);
      } else {
        toast.success(`${inserted?.length || 0} produtos importados com sucesso!`);
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

    setLoadingIA(true);

    try {
      let textoParaAnalise = textoIA;

      if (pdfIA) {
        toast.info("Extraindo texto do PDF...");
        
        const arrayBuffer = await pdfIA.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
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
          body: { texto: textoParaAnalise, tipo: "produtos" },
        }
      );

      if (functionError) {
        throw functionError;
      }

      if (!functionData?.produtos || !Array.isArray(functionData.produtos)) {
        throw new Error("Formato de resposta inválido da IA");
      }

      const produtos = functionData.produtos.map((produto: any, idx: number) => ({
        codigo: produto.codigo || `PROD-${Date.now()}-${idx}`,
        nome: produto.nome,
        tipo: produto.tipo === "INTER" ? "INTER" : "ACABADO",
        sku: produto.sku || null,
        codigo_barras_ean: produto.codigo_barras_ean || null,
        categoria: produto.categoria || null,
        subcategoria: produto.subcategoria || null,
        linha: produto.linha || null,
        marca: produto.marca || null,
        fabricante: produto.fabricante || null,
        unidade: produto.unidade || "UN",
        descricao_curta: produto.descricao_curta || null,
        descricao: produto.descricao || null,
        ativo: produto.status !== "inativo",
      }));

      const { data: userData } = await supabase.auth.getUser();
      const produtosWithUser = produtos.map((p: any) => ({
        ...p,
        created_by: userData.user?.id
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("fabrica_produtos")
        .insert(produtosWithUser)
        .select();

      if (insertError) {
        throw insertError;
      }

      toast.success(`${inserted?.length || 0} produtos importados com sucesso via IA!`);
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
    const modeloData = [
      ["Código*", "Nome*", "Tipo", "SKU", "EAN", "Categoria", "Subcategoria", "Linha", "Marca", "Unidade", "Descrição", "Status"],
      ["PROD001", "Body Splash 250ml", "ACABADO", "SKU001", "7891234567890", "Perfumaria", "Corporal", "Premium", "MinhaMarca", "UN", "Fragrância floral", "ativo"],
      ["PROD002", "Creme Hidratante 100g", "ACABADO", "SKU002", "7891234567891", "Corpo", "Hidratação", "Básica", "MinhaMarca", "UN", "Hidratação profunda", "ativo"],
      ["INTER001", "Base Perfumada", "INTER", "SKU-INT001", "", "Intermediário", "Base", "", "MinhaMarca", "L", "Base para perfumes", "ativo"],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(modeloData);

    ws['!cols'] = [
      { wch: 12 }, // Código
      { wch: 25 }, // Nome
      { wch: 12 }, // Tipo
      { wch: 15 }, // SKU
      { wch: 18 }, // EAN
      { wch: 15 }, // Categoria
      { wch: 15 }, // Subcategoria
      { wch: 12 }, // Linha
      { wch: 15 }, // Marca
      { wch: 10 }, // Unidade
      { wch: 25 }, // Descrição
      { wch: 10 }, // Status
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "modelo_importacao_produtos.xlsx");
    toast.success("Modelo baixado com sucesso!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard/fabrica/produtos-acabados">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Importar Produtos</h1>
              <p className="text-muted-foreground">
                Importe produtos acabados de planilhas ou com IA
              </p>
            </div>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Arquivo Excel (.xlsx, .xls)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Campos obrigatórios: Código e Nome. Baixe o modelo para ver todos os campos disponíveis.
                  </p>
                </div>

                {file && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    <FileSpreadsheet className="h-5 w-5" />
                    <span className="flex-1 text-sm">{file.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                      Remover
                    </Button>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleTraditionalImport}
                  disabled={!file || loading}
                >
                  {loading ? (
                    <>Importando...</>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar Produtos
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ia">
            <Card>
              <CardHeader>
                <CardTitle>Análise Inteligente com IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cole os dados dos produtos</label>
                  <Textarea
                    value={textoIA}
                    onChange={(e) => setTextoIA(e.target.value)}
                    placeholder="Cole aqui os dados dos produtos em qualquer formato (lista, tabela, texto...)&#10;&#10;Exemplo:&#10;Body Splash 250ml - SKU001 - Perfumaria&#10;Creme Hidratante 100g - SKU002 - Corpo&#10;Shampoo Nutritivo 300ml - Cabelos"
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    A IA irá analisar o texto e extrair os dados automaticamente
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      ou faça upload de um PDF
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Arquivo PDF</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfChange}
                      className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/90"
                    />
                  </div>
                </div>

                {pdfIA && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    <FileSpreadsheet className="h-5 w-5" />
                    <span className="flex-1 text-sm">{pdfIA.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setPdfIA(null)}>
                      Remover
                    </Button>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleImportIA}
                  disabled={(!textoIA.trim() && !pdfIA) || loadingIA}
                >
                  {loadingIA ? (
                    <>Analisando com IA...</>
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
      </div>
    </DashboardLayout>
  );
}
