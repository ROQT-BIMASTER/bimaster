import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ListChecks, Sparkles, Check, X, AlertTriangle } from "lucide-react";

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface MunicipioDb {
  id: string;
  nome: string;
  uf: string;
  regiao: string;
  vendedor_id: string | null;
}

interface MatchResult {
  input: string;
  municipio: MunicipioDb | null;
  confidence: "exact" | "partial" | "not_found";
  selected: boolean;
}

interface Props {
  onSuccess?: () => void;
}

function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function AtribuirMunicipiosMassaDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [textoMunicipios, setTextoMunicipios] = useState("");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [allMunicipios, setAllMunicipios] = useState<MunicipioDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [step, setStep] = useState<"input" | "preview">("input");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchVendedores();
      fetchAllMunicipios();
    }
  }, [open]);

  const fetchVendedores = async () => {
    const { data } = await (supabase
      .from("profiles")
      .select("id, nome, email") as any)
      .eq("role", "vendedor")
      .order("nome");
    if (data) setVendedores(data);
  };

  const fetchAllMunicipios = async () => {
    const { data } = await supabase
      .from("municipios")
      .select("id, nome, uf, regiao, vendedor_id")
      .order("nome");
    if (data) setAllMunicipios(data);
  };

  const processarLista = () => {
    setLoading(true);
    try {
      const linhas = textoMunicipios
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const results: MatchResult[] = linhas.map((linha) => {
        let nomeBusca = linha;
        let ufBusca: string | null = null;

        // Separar "RECIFE - PE" ou "RECIFE (PE)" ou "RECIFE, PE"
        const separators = [" - ", " – ", ", ", " ("];
        for (const sep of separators) {
          if (linha.includes(sep)) {
            const parts = linha.split(sep);
            nomeBusca = parts[0].trim();
            ufBusca = parts[1]?.replace(")", "").trim() || null;
            break;
          }
        }

        const nomeNorm = normalize(nomeBusca);
        const ufNorm = ufBusca ? normalize(ufBusca) : null;

        // Exact match
        let found = allMunicipios.find((m) => {
          const nameMatch = normalize(m.nome) === nomeNorm;
          if (ufNorm) return nameMatch && normalize(m.uf) === ufNorm;
          return nameMatch;
        });

        if (found) {
          return { input: linha, municipio: found, confidence: "exact" as const, selected: true };
        }

        // Partial match (contains)
        found = allMunicipios.find((m) => {
          const contains = normalize(m.nome).includes(nomeNorm) || nomeNorm.includes(normalize(m.nome));
          if (ufNorm) return contains && normalize(m.uf) === ufNorm;
          return contains;
        });

        if (found) {
          return { input: linha, municipio: found, confidence: "partial" as const, selected: true };
        }

        return { input: linha, municipio: null, confidence: "not_found" as const, selected: false };
      });

      setMatches(results);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const toggleMatch = (index: number) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, selected: !m.selected } : m))
    );
  };

  const selectAll = (val: boolean) => {
    setMatches((prev) =>
      prev.map((m) => (m.municipio ? { ...m, selected: val } : m))
    );
  };

  const atribuirSelecionados = async () => {
    const selecionados = matches.filter((m) => m.selected && m.municipio);
    if (selecionados.length === 0) {
      toast({ title: "Nenhum município selecionado", variant: "destructive" });
      return;
    }

    setAssigning(true);
    try {
      const ids = selecionados.map((m) => m.municipio!.id);
      const { error } = await supabase
        .from("municipios")
        .update({ vendedor_id: selectedVendedor })
        .in("id", ids);

      if (error) throw error;

      toast({
        title: "Municípios atribuídos",
        description: `${selecionados.length} municípios atribuídos com sucesso.`,
      });
      setOpen(false);
      resetState();
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao atribuir:", error);
      toast({
        title: "Erro ao atribuir municípios",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const sugerirPorIA = async () => {
    if (!selectedVendedor) {
      toast({ title: "Selecione um vendedor primeiro", variant: "destructive" });
      return;
    }

    setLoadingIA(true);
    try {
      // Get unassigned municipalities
      const semVendedor = allMunicipios.filter((m) => !m.vendedor_id);
      if (semVendedor.length === 0) {
        toast({ title: "Todos os municípios já estão atribuídos" });
        return;
      }

      // Get current distribution for the selected vendedor
      const doVendedor = allMunicipios.filter((m) => m.vendedor_id === selectedVendedor);
      const vendedorInfo = vendedores.find((v) => v.id === selectedVendedor);

      const { data, error } = await supabase.functions.invoke("sugerir-municipios-vendedor", {
        body: {
          vendedor_nome: vendedorInfo?.nome || "",
          municipios_atuais: doVendedor.map((m) => `${m.nome} (${m.uf})`),
          municipios_disponiveis: semVendedor.map((m) => ({
            id: m.id,
            nome: m.nome,
            uf: m.uf,
            regiao: m.regiao,
          })),
        },
      });

      if (error) throw error;

      const sugeridos: string[] = data?.sugestoes || [];
      const results: MatchResult[] = sugeridos
        .map((id: string) => {
          const mun = allMunicipios.find((m) => m.id === id);
          if (!mun) return null;
          return {
            input: `${mun.nome} - ${mun.uf} (IA)`,
            municipio: mun,
            confidence: "exact" as const,
            selected: true,
          };
        })
        .filter(Boolean) as MatchResult[];

      if (results.length === 0) {
        toast({ title: "IA não encontrou sugestões", variant: "destructive" });
        return;
      }

      setMatches(results);
      setStep("preview");
      toast({
        title: "Sugestões da IA",
        description: `${results.length} municípios sugeridos com base na distribuição geográfica.`,
      });
    } catch (error) {
      console.error("Erro na sugestão IA:", error);
      toast({
        title: "Erro ao obter sugestões",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingIA(false);
    }
  };

  const resetState = () => {
    setSelectedVendedor("");
    setTextoMunicipios("");
    setMatches([]);
    setStep("input");
  };

  const totalSelecionados = matches.filter((m) => m.selected && m.municipio).length;
  const totalEncontrados = matches.filter((m) => m.municipio).length;
  const totalNaoEncontrados = matches.filter((m) => !m.municipio).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ListChecks className="h-4 w-4" />
          Atribuir em Massa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Atribuição em Massa de Municípios</DialogTitle>
          <DialogDescription>
            Selecione um vendedor e cole a lista de municípios para atribuição rápida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vendedor Select */}
          <div className="space-y-2">
            <Label>Vendedor *</Label>
            <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o vendedor" />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {step === "input" && (
            <>
              {/* Textarea */}
              <div className="space-y-2">
                <Label>Lista de Municípios (um por linha)</Label>
                <Textarea
                  placeholder={"RECIFE - PE\nOLINDA - PE\nSÃO PAULO - SP\nBELO HORIZONTE"}
                  value={textoMunicipios}
                  onChange={(e) => setTextoMunicipios(e.target.value)}
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: "Município", "Município - UF", "Município (UF)", "Município, UF"
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={processarLista}
                  disabled={!textoMunicipios.trim() || !selectedVendedor || loading}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Processar Lista
                </Button>
                <Button
                  variant="secondary"
                  onClick={sugerirPorIA}
                  disabled={!selectedVendedor || loadingIA}
                  className="gap-2"
                >
                  {loadingIA ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Sugerir por IA
                </Button>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              {/* Stats */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <Check className="h-3 w-3" /> {totalEncontrados} encontrados
                </Badge>
                {totalNaoEncontrados > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <X className="h-3 w-3" /> {totalNaoEncontrados} não encontrados
                  </Badge>
                )}
                <Badge className="gap-1">
                  {totalSelecionados} selecionados
                </Badge>
              </div>

              {/* Select all */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={totalSelecionados === totalEncontrados && totalEncontrados > 0}
                  onCheckedChange={(v) => selectAll(!!v)}
                />
                <span className="text-sm">Selecionar todos</span>
              </div>

              {/* Results table */}
              <ScrollArea className="h-[300px] border rounded-md">
                <div className="p-2 space-y-1">
                  {matches.map((match, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-2 rounded-md text-sm ${
                        match.confidence === "not_found"
                          ? "bg-destructive/10"
                          : match.confidence === "partial"
                          ? "bg-yellow-500/10"
                          : "bg-green-500/10"
                      }`}
                    >
                      {match.municipio && (
                        <Checkbox
                          checked={match.selected}
                          onCheckedChange={() => toggleMatch(i)}
                        />
                      )}
                      {!match.municipio && (
                        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{match.input}</span>
                        {match.municipio && (
                          <span className="text-xs text-muted-foreground">
                            → {match.municipio.nome} ({match.municipio.uf})
                            {match.municipio.vendedor_id && (
                              <span className="text-yellow-600 ml-1">[já atribuído]</span>
                            )}
                          </span>
                        )}
                        {!match.municipio && (
                          <span className="text-xs text-destructive">Município não encontrado</span>
                        )}
                      </div>
                      <Badge
                        variant={
                          match.confidence === "exact"
                            ? "default"
                            : match.confidence === "partial"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-[10px] flex-shrink-0"
                      >
                        {match.confidence === "exact"
                          ? "Exato"
                          : match.confidence === "partial"
                          ? "Parcial"
                          : "N/A"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("input")} className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={atribuirSelecionados}
                  disabled={totalSelecionados === 0 || assigning}
                  className="flex-1"
                >
                  {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Atribuir {totalSelecionados} Municípios
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
