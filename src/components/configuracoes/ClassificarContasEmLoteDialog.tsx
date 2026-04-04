import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle, Search, Check, BookOpen, Brain, ChevronsUpDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  fonte?: "dicionario" | "manual" | "ia" | "erro";
}

function ContaSearchSelect({ value, label, contas, onChange }: { value: string; label: string; contas: any[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-8 w-full justify-between text-xs font-normal">
          <span className="truncate">{value ? label : "Selecionar conta..."}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar conta..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
            <CommandGroup>
              {contas.map(c => (
                <CommandItem key={c.id} value={`${c.code} ${c.name}`} onSelect={() => { onChange(c.id); setOpen(false); }} className="text-xs">
                  <Check className={`mr-2 h-3 w-3 ${value === c.id ? "opacity-100" : "opacity-0"}`} />
                  {c.code} - {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
  const [stats, setStats] = useState<{ dicionario: number; manual: number; ia: number; erro: number } | null>(null);

  useEffect(() => {
    if (open) {
      loadCategorias();
      loadContas();
    } else {
      setPhase("loading");
      setCategorias([]);
      setMapeamentos([]);
      setProgress(0);
      setStats(null);
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
      const { data, error } = await supabase.functions.invoke("classificar-contas-lote", {
        body: { action: "load-categories" },
      });
      if (error) throw error;
      const result: Categoria[] = (data?.categorias || []) as Categoria[];
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
    const aggregatedStats = { dicionario: 0, manual: 0, ia: 0, erro: 0 };
    let processed = 0;

    for (const batch of batches) {
      setCurrentBatch(batch.map(c => c.categoria_nome).slice(0, 3).join(", ") + "...");

      try {
        const { data, error } = await supabase.functions.invoke("classificar-contas-lote", {
          body: { action: "classify", categorias: batch },
        });
        if (error) throw error;

        if (data?.mapeamentos) {
          for (const m of data.mapeamentos) {
            const cat = batch.find(c => c.categoria_nome === m.categoria_nome);
            allMapeamentos.push({
              ...m,
              qtd_titulos: m.qtd_titulos || cat?.qtd_titulos || 0,
              valor_medio: m.valor_medio || cat?.valor_medio || 0,
              top_fornecedores: m.top_fornecedores || cat?.top_fornecedores || [],
            });
          }
        }
        if (data?.stats) {
          aggregatedStats.dicionario += data.stats.dicionario || 0;
          aggregatedStats.manual += data.stats.manual || 0;
          aggregatedStats.ia += data.stats.ia || 0;
          aggregatedStats.erro += data.stats.erro || 0;
        }
      } catch (e: any) {
        console.error("Batch error:", e);
        for (const cat of batch) {
          allMapeamentos.push({
            ...cat,
            plano_contas_id: null,
            plano_contas_codigo: "",
            plano_contas_nome: "Erro na classificação",
            confianca: 0,
            justificativa: e.message || "Erro",
            fonte: "erro",
          });
          aggregatedStats.erro++;
        }
      }

      processed++;
      setProgress((processed / batches.length) * 100);

      if (processed < batches.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    allMapeamentos.sort((a, b) => b.qtd_titulos - a.qtd_titulos);
    setMapeamentos(allMapeamentos);
    setStats(aggregatedStats);
    setPhase("review");
    setCurrentBatch("");
  };

  const handleContaChange = (index: number, contaId: string) => {
    const conta = contasDisponiveis.find(c => c.id === contaId);
    if (!conta) return;
    setMapeamentos(prev => prev.map((m, i) =>
      i === index
        ? { ...m, plano_contas_id: conta.id, plano_contas_codigo: conta.code, plano_contas_nome: conta.name, revisado_manualmente: true, confianca: 1, fonte: "manual" as const }
        : m
    ));
  };

  const handleSaveAndApply = async () => {
    setPhase("applying");
    try {
      const validMappings = mapeamentos.filter(m => m.plano_contas_id);
      const { error: saveError } = await supabase.functions.invoke("classificar-contas-lote", {
        body: { action: "save", categorias: validMappings },
      });
      if (saveError) throw saveError;

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

  const FonteBadge = ({ fonte }: { fonte?: string }) => {
    if (fonte === "dicionario") return <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-700"><BookOpen className="h-3 w-3 mr-0.5" />Dicionário</Badge>;
    if (fonte === "manual") return <Badge variant="default" className="text-[10px] bg-amber-600 hover:bg-amber-700"><Check className="h-3 w-3 mr-0.5" />Manual</Badge>;
    if (fonte === "ia") return <Badge variant="default" className="text-[10px] bg-blue-600 hover:bg-blue-700"><Brain className="h-3 w-3 mr-0.5" />IA</Badge>;
    return <Badge variant="destructive" className="text-[10px]">Erro</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Classificar Contas a Pagar — Dicionário + IA
          </DialogTitle>
          <DialogDescription>
            {categorias.length > 0
              ? `${categorias.length} categorias serão mapeadas via dicionário profissional. Apenas categorias desconhecidas usarão IA.`
              : "Carregando categorias..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase === "loading" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">Carregando categorias...</span>
            </div>
          )}

          {phase === "ready" && (
            <div className="text-center py-8 space-y-4">
              <div className="flex items-center justify-center gap-3">
                <BookOpen className="h-10 w-10 text-emerald-600" />
                <Sparkles className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-semibold">{categorias.length} categorias encontradas</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Dicionário profissional mapeia a maioria • IA classifica apenas categorias novas
                </p>
              </div>
              <div className="flex gap-4 justify-center text-xs text-muted-foreground">
                <span>📊 {categorias.reduce((a, c) => a + c.qtd_titulos, 0).toLocaleString()} títulos totais</span>
                <span>📖 Dicionário com ~200+ mapeamentos</span>
              </div>
              <Button onClick={handleClassify} size="lg">
                <BookOpen className="h-4 w-4 mr-2" />
                Iniciar Classificação
              </Button>
            </div>
          )}

          {phase === "classifying" && (
            <div className="space-y-4 py-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Classificando...</p>
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

          {phase === "review" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{mappedCount}/{mapeamentos.length} mapeadas</Badge>
                  {stats && (
                    <>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                        <BookOpen className="h-3 w-3 mr-1" />{stats.dicionario} dicionário
                      </Badge>
                      {stats.ia > 0 && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          <Brain className="h-3 w-3 mr-1" />{stats.ia} IA
                        </Badge>
                      )}
                      {stats.manual > 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          <Check className="h-3 w-3 mr-1" />{stats.manual} manual
                        </Badge>
                      )}
                    </>
                  )}
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
                      <TableHead className="w-[220px]">Categoria ERP</TableHead>
                      <TableHead className="w-[50px]">Qtd</TableHead>
                      <TableHead>Conta Mapeada</TableHead>
                      <TableHead className="w-[90px]">Fonte</TableHead>
                      <TableHead className="w-[60px]">Conf.</TableHead>
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
                            <ContaSearchSelect
                              value={m.plano_contas_id || ""}
                              label={m.plano_contas_id ? `${m.plano_contas_codigo} - ${m.plano_contas_nome}` : ""}
                              contas={contasDisponiveis}
                              onChange={(v) => handleContaChange(realIdx, v)}
                            />
                          </TableCell>
                          <TableCell>
                            <FonteBadge fonte={m.fonte} />
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

          {phase === "applying" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3">Aplicando classificação em massa...</span>
            </div>
          )}

          {phase === "done" && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-emerald-600" />
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
