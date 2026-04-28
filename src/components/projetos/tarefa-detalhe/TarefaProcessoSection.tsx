import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileBadge, Search, Plus, X, Copy, Settings2, Loader2, Hash } from "lucide-react";
import { useTarefaProcesso, type TarefaProcesso } from "@/hooks/useTarefaProcesso";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";

interface Props {
  tarefaId: string;
  projetoId: string;
  produtoId: string | null;
  onUpdate: (tarefaId: string, patch: Record<string, any>) => void;
}

const ETAPA_LABELS: Record<string, string> = {
  ideia: "Ideia",
  projeto: "Projeto",
  pre_cadastro: "Pré-cadastro",
  desenvolvimento: "Desenvolvimento",
  testes: "Testes",
  embalagem: "Embalagem",
  regulatorio: "Regulatório",
  cadastro_final: "Cadastro Final",
  aprovacao: "Aprovação",
  producao: "Produção",
  lancamento: "Lançamento",
  recebimento: "Recebimento Brasil",
};

async function logAtividadeProcesso(params: {
  tarefaId: string;
  projetoId: string;
  tipo: "processo_vinculado" | "processo_desvinculado";
  numeroProcesso: string | null;
  numeroAnterior?: string | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from("projeto_tarefa_atividades" as any).insert({
      tarefa_id: params.tarefaId,
      projeto_id: params.projetoId,
      user_id: user.id,
      tipo: params.tipo,
      campo: "processo",
      valor_anterior: params.numeroAnterior || null,
      valor_novo: params.numeroProcesso,
      descricao:
        params.tipo === "processo_vinculado"
          ? `Processo ${params.numeroProcesso} vinculado à tarefa`
          : `Processo ${params.numeroAnterior || ""} desvinculado da tarefa`,
    }) as any);
  } catch (err) {
    logger.warn("TarefaProcessoSection: falha ao registrar atividade", { metadata: { err: String(err) } });
  }
}

export function TarefaProcessoSection({ tarefaId, projetoId, produtoId, onUpdate }: Props) {
  const { processo, isLoading, searchProcessos, criarProcesso } = useTarefaProcesso(produtoId);
  const { isAdmin, isGerente, isSupervisor } = useUserRole();
  const podeConfigurar = isAdmin || isGerente || isSupervisor;
  const podeDesvincular = isAdmin || isGerente;
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Array<TarefaProcesso & { produto_codigo?: string; produto_nome?: string }>>([]);
  const [searching, setSearching] = useState(false);

  // Debounce
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(async () => {
      if (term.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const r = await searchProcessos(term);
        setResults(r);
      } catch (err: any) {
        toast.error("Erro na pesquisa: " + (err?.message || "desconhecido"));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [term, open]);

  const handleCopy = () => {
    if (!processo?.numero_processo) return;
    navigator.clipboard.writeText(processo.numero_processo);
    toast.success("Número do processo copiado");
  };

  const handleVincular = async (escolhido: TarefaProcesso) => {
    // Vincular processo = atualizar produto_id da tarefa para apontar ao produto do processo
    onUpdate(tarefaId, { produto_id: escolhido.produto_ref_id });
    await logAtividadeProcesso({
      tarefaId,
      projetoId,
      tipo: "processo_vinculado",
      numeroProcesso: escolhido.numero_processo,
      numeroAnterior: processo?.numero_processo || null,
    });
    queryClient.invalidateQueries({ queryKey: ["tarefa-processo"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefa-atividades", tarefaId] });
    toast.success(`Processo ${escolhido.numero_processo} vinculado`);
    setOpen(false);
    setTerm("");
  };

  const handleDesvincular = async () => {
    if (!processo) return;
    const numero = processo.numero_processo;
    onUpdate(tarefaId, { produto_id: null });
    await logAtividadeProcesso({
      tarefaId,
      projetoId,
      tipo: "processo_desvinculado",
      numeroProcesso: null,
      numeroAnterior: numero,
    });
    queryClient.invalidateQueries({ queryKey: ["tarefa-processo"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefa-atividades", tarefaId] });
    toast.success("Processo desvinculado");
  };

  const handleCriar = async () => {
    if (!produtoId) {
      toast.error("Vincule um produto primeiro");
      return;
    }
    await criarProcesso.mutateAsync({});
    queryClient.invalidateQueries({ queryKey: ["tarefa-processo", produtoId] });
  };

  return (
    <>
      <span className="text-muted-foreground flex items-center gap-1">
        <FileBadge className="h-3.5 w-3.5" /> Processo
      </span>
      <div className="space-y-1.5">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
          </div>
        ) : processo ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="gap-1 font-mono text-[11px] cursor-pointer hover:bg-muted" onClick={handleCopy} title="Clique para copiar">
                <Hash className="h-3 w-3" />
                {processo.numero_processo}
                <Copy className="h-2.5 w-2.5 opacity-60" />
              </Badge>
              {processo.etapa_atual && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {ETAPA_LABELS[processo.etapa_atual] || processo.etapa_atual}
                </Badge>
              )}
              {podeDesvincular && (
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={handleDesvincular} title="Desvincular processo">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {podeConfigurar && (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1">
                    <Settings2 className="h-3 w-3" /> Trocar processo
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start">
                  <SearchPanel term={term} setTerm={setTerm} results={results} searching={searching} onPick={handleVincular} />
                </PopoverContent>
              </Popover>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Nenhum processo vinculado</p>
            {podeConfigurar && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 gap-1">
                      <Search className="h-3 w-3" /> Pesquisar processo
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" align="start">
                    <SearchPanel term={term} setTerm={setTerm} results={results} searching={searching} onPick={handleVincular} />
                  </PopoverContent>
                </Popover>
                {produtoId && (
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 gap-1" onClick={handleCriar} disabled={criarProcesso.isPending}>
                    <Plus className="h-3 w-3" /> Criar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function SearchPanel({
  term,
  setTerm,
  results,
  searching,
  onPick,
}: {
  term: string;
  setTerm: (v: string) => void;
  results: Array<TarefaProcesso & { produto_codigo?: string; produto_nome?: string }>;
  searching: boolean;
  onPick: (p: TarefaProcesso) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por nº de processo..."
          className="h-8 text-xs pl-7"
        />
      </div>
      <div className="max-h-64 overflow-auto -mx-1">
        {searching ? (
          <div className="px-3 py-4 text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Pesquisando...
          </div>
        ) : term.trim().length < 2 ? (
          <div className="px-3 py-4 text-xs text-center text-muted-foreground">
            Digite ao menos 2 caracteres
          </div>
        ) : results.length === 0 ? (
          <div className="px-3 py-4 text-xs text-center text-muted-foreground">
            Nenhum processo encontrado
          </div>
        ) : (
          results.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="w-full text-left px-2 py-2 rounded hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="font-mono text-[10px] gap-1">
                  <Hash className="h-2.5 w-2.5" />
                  {p.numero_processo}
                </Badge>
                <Badge variant="secondary" className="text-[9px] h-4">{p.produto_tipo}</Badge>
                {p.etapa_atual && (
                  <Badge variant="secondary" className="text-[9px] h-4">
                    {ETAPA_LABELS[p.etapa_atual] || p.etapa_atual}
                  </Badge>
                )}
              </div>
              {(p.produto_codigo || p.produto_nome) && (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {p.produto_codigo} · {p.produto_nome}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
