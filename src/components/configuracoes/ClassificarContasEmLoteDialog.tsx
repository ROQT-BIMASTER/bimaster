import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle, AlertCircle, Search, ArrowRight, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClassificarContasEmLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accounts: any[];
}

type Phase = "loading" | "ready" | "classifying" | "review" | "applying" | "done";

interface Categoria {
  categoria_nome: string;
  qtd_titulos: number;
  valor_medio: number;
  top_fornecedores: string[];
}

interface Mapeamento extends Categoria {
  plano_contas_id: string | null;
  plano_contas_codigo: string;
  plano_contas_nome: string;
  confianca: number;
  justificativa: string;
  revisado_manualmente?: boolean;
}

export function ClassificarContasEmLoteDialog({
  open,
  onOpenChange,
  onSuccess,
}: ClassificarContasEmLoteDialogProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [mapeamentos, setMapeamentos] = useState<Mapeamento[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [contasDisponiveis, setContasDisponiveis] = useState<any[]>([]);
  const [applyResult, setApplyResult] = useState<any>(null);

  useEffect(() => {
    if (open) {
      loadCategorias();
      loadContas();
    } else {
      setPhase("loading");
      setCategorias([]);
      setMapeamentos([]);
      setProgress(0);
    }
  }, [open]);

  const loadContas = async () => {
    const { data } = await supabase
      .from("trade_chart_of_accounts")
      .select("id, code, name")
      .eq("permite_lancamento", true)
      .order("code");
    if (data) setContasDisponiveis(data);
  };

  const loadCategorias = async () => {
    setPhase("loading");
    try {
      // Get distinct categories with stats directly
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("categoria_nome, fornecedor_nome, valor_documento");

      if (error) throw error;

      const catMap = new Map<string, { qtd: number; valores: number[]; fornecedores: Map<string, number> }>();

      for (const r of data || []) {
        if (!r.categoria_nome) continue;
        const cat = r.categoria_nome;
        if (!catMap.has(cat)) {
          catMap.set(cat, { qtd: 0, valores: [], fornecedores: new Map() });
        }
        const entry = catMap.get(cat)!;
        entry.qtd++;
        if (r.valor_documento) entry.valores.push(Number(r.valor_documento));
        if (r.fornecedor_nome) {
          entry.fornecedores.set(r.fornecedor_nome, (entry.fornecedores.get(r.fornecedor_nome) || 0) + 1);
        }
      }

      const result: Categoria[] = Array.from(catMap.entries()).map(([nome, info]) => ({
        categoria_nome: nome,
        qtd_titulos: info.qtd,
        valor_medio: info.valores.length > 0 ? info.valores.reduce((a, b) => a + b, 0) / info.valores.length : 0,
        top_fornecedores: Array.from(info.fornecedores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([f]) => f),
      }));

      result.sort((a, b) => b.qtd_titulos - a.qtd_titulos);
      setCategorias(result);
      setPhase("ready");
    } catch (e: any) {
      console.error("Error loading categories:", e);
      toast.error("Erro ao carregar categorias");
      setPhase("ready");
    }
  };

  const handleClassify = async () => {
    setPhase("classifying");
    setProgress(0);
    const batchSize = 25;
    const batches: Categoria[][] = [];

    for (let i = 0; i < categorias.length; i += batchSize) {
      batches.push(categorias.slice(i, i + batchSize));
    }

    const allMapeamentos: Mapeamento[] = [];
    let processed = 0;

    for (const batch of batches) {
      setCurrentBatch(batch.map(c => c.categoria_nome).slice(0, 3).join(", ") + "...");

      try {
        const { data, error } = await supabase.functions.invoke("classificar-contas-lote", {
          body: {
            action: "classify",
            categorias: batch,
          },
        });

        if (error) throw error;

        if (data?.mapeamentos) {
          for (const m of data.mapeamentos) {
            const cat = batch.find(c => c.categoria_nome === m.categoria_nome);
            allMapeamentos.push({
              ...m,
              qtd_titulos: cat?.qtd_titulos || 0,
              valor_medio: cat?.valor_medio || 0,
              top_fornecedores: cat?.top_fornecedores || [],
            });
          }
        }
      } catch (e: any) {
        console.error("Batch error:", e);
        // Add failed categories as unmapped
        for (const cat of batch) {
          allMapeamentos.push({
            ...cat,
            plano_contas_id: null,
            plano_contas_codigo: "",
            plano_contas_nome: "Erro na classificação",
            confianca: 0,
            justificativa: e.message || "Erro",
          });
        }
      }

      processed++;
      setProgress((processed / batches.length) * 100);

      // Rate limit delay
      if (processed < batches.length) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    allMapeamentos.sort((a, b) => b.qtd_titulos - a.qtd_titulos);
    setMapeamentos(allMapeamentos);
    setPhase("review");
    setCurrentBatch("");
  };

  const handleContaChange = (index: number, contaId: string) => {
    const conta = contasDisponiveis.find(c => c.id === contaId);
    if (!conta) return;

    setMapeamentos(prev => prev.map((m, i) =>
      i === index
        ? { ...m, plano_contas_id: conta.id, plano_contas_codigo: conta.code, plano_contas_nome: conta.name, revisado_manualmente: true, confianca: 1 }
        : m
    ));
  };

  const handleSaveAndApply = async () => {
    setPhase("applying");
    try {
      // Save mappings
      const validMappings = mapeamentos.filter(m => m.plano_contas_id);
      const { error: saveError } = await supabase.functions.invoke("classificar-contas-lote", {
        body: { action: "save", categorias: validMappings },
      });
      if (saveError) throw saveError;

      // Apply bulk update
      const { data: result, error: applyError } = await supabase.functions.invoke("classificar-contas-lote", {
        body: { action: "apply" },
      });
      if (applyError) throw applyError;

      setApplyResult(result);
      setPhase("done");
      toast.success(`${result?.updated_count || 0} títulos reclassificados com sucesso!`);
      onSuccess();
    } catch (e: any) {
      console.error("Apply error:", e);
      toast.error("Erro ao aplicar classificação: " + (e.message || ""));
      setPhase("review");
    }
  };

  const filteredMapeamentos = mapeamentos.filter(m =>
    m.categoria_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.plano_contas_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mappedCount = mapeamentos.filter(m => m.plano_contas_id).length;
  const highConfCount = mapeamentos.filter(m => m.confianca >= 0.8).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Classificar Contas a Pagar com IA
          </DialogTitle>
          <DialogDescription>
            A IA analisará as {categorias.length || "..."} categorias do ERP e mapeará para o novo plano de contas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phase: Loading */}
          {phase === "loading" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">Carregando categorias...</span>
            </div>
          )}

          {/* Phase: Ready */}
          {phase === "ready" && (
            <div className="text-center py-8 space-y-4">
              <Sparkles className="h-12 w-12 mx-auto text-primary" />
              <div>
                <p className="text-lg font-semibold">{categorias.length} categorias encontradas</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Serão processadas em ~{Math.ceil(categorias.length / 25)} lotes de IA
                </p>
              </div>
              <div className="flex gap-3 justify-center text-xs text-muted-foreground">
                <span>📊 {categorias.reduce((a, c) => a + c.qtd_titulos, 0).toLocaleString()} títulos totais</span>
              </div>
              <Button onClick={handleClassify} size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                Iniciar Classificação com IA
              </Button>
            </div>
          )}

          {/* Phase: Classifying */}
          {phase === "classifying" && (
            <div className="space-y-4 py-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Classificando com IA...</p>
                  <p className="text-sm text-muted-foreground">{Math.round(progress)}%</p>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              {currentBatch && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground truncate">{currentBatch}</span>
                </div>
              )}
            </div>
          )}

          {/* Phase: Review */}
          {phase === "review" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Badge variant="secondary">{mappedCount}/{mapeamentos.length} mapeadas</Badge>
                  <Badge variant="outline" className="text-green-600">{highConfCount} alta confiança</Badge>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar categoria..."
                    className="pl-8 h-9"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Categoria ERP</TableHead>
                      <TableHead className="w-[60px]">Qtd</TableHead>
                      <TableHead>Conta Mapeada</TableHead>
                      <TableHead className="w-[70px]">Conf.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMapeamentos.map((m, idx) => {
                      const realIdx = mapeamentos.indexOf(m);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-xs">{m.categoria_nome}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.qtd_titulos}</TableCell>
                          <TableCell>
                            <Select
                              value={m.plano_contas_id || ""}
                              onValueChange={(v) => handleContaChange(realIdx, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecionar conta...">
                                  {m.plano_contas_id ? `${m.plano_contas_codigo} - ${m.plano_contas_nome}` : "Selecionar..."}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {contasDisponiveis.map(c => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">
                                    {c.code} - {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={m.confianca >= 0.8 ? "default" : m.confianca >= 0.5 ? "secondary" : "destructive"}
                              className="text-[10px]"
                            >
                              {Math.round(m.confianca * 100)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setPhase("ready")}>
                  Reclassificar
                </Button>
                <Button onClick={handleSaveAndApply} disabled={mappedCount === 0}>
                  <Check className="h-4 w-4 mr-2" />
                  Aplicar {mappedCount} Mapeamentos
                </Button>
              </div>
            </div>
          )}

          {/* Phase: Applying */}
          {phase === "applying" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3">Aplicando classificação em massa...</span>
            </div>
          )}

          {/* Phase: Done */}
          {phase === "done" && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
              <div>
                <p className="text-lg font-semibold">Classificação concluída!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {applyResult?.updated_count?.toLocaleString() || 0} títulos atualizados
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
