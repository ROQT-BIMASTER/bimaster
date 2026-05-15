import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { calcularPrecosProdutos, formatarMoeda, buscarCustoFichaProduto, CustoComposicao, reverseMarkup, calcularMargemLucro, formatarMarkupLabel } from "@/lib/fabrica/pricing-calculator";
import { Loader2, CheckCircle2, Factory, Ship, AlertTriangle, Check, FileText, Lock, LockOpen, DollarSign, ArrowRight } from "lucide-react";
import { useUserPriceTableAccess } from "@/hooks/useUserPriceTableAccess";
import { useVisibilityBlocks } from "@/hooks/useVisibilityBlocks";
import { GeradorPrecosFichaInfo } from "./GeradorPrecosFichaInfo";
import { ProvadorBadge } from "./ProvadorBadge";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FichaStatusInfo {
  status: "aprovada" | "em_revisao" | "revisao_solicitada" | "rascunho" | "sem_ficha";
  dataAprovacao: string | null;
}

interface ProdutoData {
  id: string;
  codigo: string | null;
  nome: string;
  origem: string | null;
  linha: string | null;
  marca: string | null;
  tipo: string | null;
  is_provador?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: any;
  onSuccess: () => void;
}

export function GeradorPrecosDialog({ open, onOpenChange, tabela, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const { filterProductsByAccess, hasFullAccess } = useUserPriceTableAccess();
  const { isProductBlocked, isLineBlocked, getBlockForProduct, getBlockForLine, blockProduct, blockLine, unblock, isBlocking, isUnblocking } = useVisibilityBlocks();
  const [fonteCusto, setFonteCusto] = useState<"ordem_producao" | "custo_medio" | "manual" | "tabela_anterior" | "custo_origem" | "ficha_custo" | "preco_final">("ordem_producao");
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [produtosNaTabelaBase, setProdutosNaTabelaBase] = useState<string[]>([]);
  const [custosManual, setCustosManual] = useState<Record<string, string>>({});
  const [precosManual, setPrecosManual] = useState<Record<string, string>>({});
  const [precosCalculados, setPrecosCalculados] = useState<any[]>([]);
  const [composicoesCache, setComposicoesCache] = useState<Record<string, { composicao: CustoComposicao | null; configId: string | null }>>({});
  const [calculando, setCalculando] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoData[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [origemSelecionada, setOrigemSelecionada] = useState<'nacional' | 'importado' | null>(null);
  const [linhaFiltro, setLinhaFiltro] = useState<string>("todas");
  const [marcaFiltro, setMarcaFiltro] = useState<string>("todas");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "kit" | "unitario">("todos");
  const [usoFiltro, setUsoFiltro] = useState<"todos" | "venda" | "provador">("venda");
  const [dataAprovacaoInicio, setDataAprovacaoInicio] = useState<string>("");
  const [dataAprovacaoFim, setDataAprovacaoFim] = useState<string>("");
  const [fichaStatusMap, setFichaStatusMap] = useState<Record<string, FichaStatusInfo>>({});
  const [produtosComPrecoNaTabela, setProdutosComPrecoNaTabela] = useState<Set<string>>(new Set());
  const [filtroPendentes, setFiltroPendentes] = useState(false);
  const [filtroAprovadas, setFiltroAprovadas] = useState(false);
  const [filtroRecentes, setFiltroRecentes] = useState(false);
  // Último lote aprovado da tabela base (para precificar exatamente o que foi aprovado lá)
  const [ultimoLoteBase, setUltimoLoteBase] = useState<{
    versao: number;
    aprovado_em: string | null;
    produto_ids: string[];
  } | null>(null);
  const [filtroUltimoLoteBase, setFiltroUltimoLoteBase] = useState(false);

  useEffect(() => {
    if (open && tabela) {
      loadProdutos();
      loadProdutosTabela();
      loadFichaStatus();
      loadPrecosTabelaAtual();
      
      // Definir origem baseado na tabela
      if (tabela.origem_aplicavel === 'nacional') {
        setOrigemSelecionada('nacional');
      } else if (tabela.origem_aplicavel === 'importado') {
        setOrigemSelecionada('importado');
      } else {
        setOrigemSelecionada(null);
      }
    } else if (!open) {
      // Reset state quando fechar o dialog
      setProdutosSelecionados([]);
      setProdutosNaTabelaBase([]);
      setPrecosCalculados([]);
      setCustosManual({});
      setPrecosManual({});
      setBuscaProduto("");
      setOrigemSelecionada(null);
      setFichaStatusMap({});
      setProdutosComPrecoNaTabela(new Set());
      setFiltroPendentes(false);
      setFiltroAprovadas(false);
      setFiltroRecentes(false);
      setMarcaFiltro("todas");
      setLinhaFiltro("todas");
      setTipoFiltro("todos");
      setDataAprovacaoInicio("");
      setDataAprovacaoFim("");
    }
  }, [open, tabela]);

  const loadFichaStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("fabrica_produto_custos_config")
        .select("produto_id, status_aprovacao, updated_at");
      if (error) throw error;
      const map: Record<string, FichaStatusInfo> = {};
      (data || []).forEach((row: any) => {
        if (!row.produto_id) return;
        const status = (row.status_aprovacao || "rascunho") as FichaStatusInfo["status"];
        // Mantém o registro mais recente por produto
        const existing = map[row.produto_id];
        const dataAprovacao = status === "aprovada" ? row.updated_at : null;
        if (!existing || (dataAprovacao && (!existing.dataAprovacao || dataAprovacao > existing.dataAprovacao))) {
          map[row.produto_id] = { status, dataAprovacao };
        } else if (existing.status !== "aprovada" && status === "aprovada") {
          map[row.produto_id] = { status, dataAprovacao };
        }
      });
      setFichaStatusMap(map);
    } catch (error) {
      logger.error("Erro ao carregar status das fichas:", error);
    }
  };

  const loadPrecosTabelaAtual = async () => {
    if (!tabela?.id) return;
    try {
      const { data, error } = await supabase
        .from("fabrica_precos_produtos")
        .select("produto_id")
        .eq("tabela_id", tabela.id)
        .eq("ativo", true);
      if (error) throw error;
      setProdutosComPrecoNaTabela(new Set((data || []).map((r: any) => r.produto_id)));
    } catch (error) {
      logger.error("Erro ao carregar preços existentes:", error);
    }
  };


  const loadProdutos = async () => {
    setLoadingProdutos(true);
    try {
      // Buscar apenas produtos acabados finalizados
      let query = supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome, origem, linha, marca, tipo, is_provador")
        .eq("tipo", "ACABADO")
        .eq("ativo", true);

      // Filtrar por origem se a tabela especificar
      if (tabela?.origem_aplicavel && tabela.origem_aplicavel !== 'ambos') {
        query = query.eq("origem", tabela.origem_aplicavel);
      }

      const response = await query.order("nome");

      if (response.error) throw response.error;
      setProdutos(response.data || []);
    } catch (error) {
      logger.error("Erro ao buscar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoadingProdutos(false);
    }
  };

  const loadProdutosTabela = async () => {
    try {
      // Se usar tabela anterior como base, carregar produtos da tabela base
      if (tabela?.tipo_base === "tabela_anterior" && tabela?.tabela_base_id) {
        const { data, error } = await supabase
          .from("fabrica_precos_produtos")
          .select("produto_id")
          .eq("tabela_id", tabela.tabela_base_id)
          .eq("ativo", true);

        if (error) throw error;
        
        // Pré-selecionar produtos que já existem na tabela base
        if (data && data.length > 0) {
          const produtosIds = data.map(p => p.produto_id);
          setProdutosSelecionados(produtosIds);
          setProdutosNaTabelaBase(produtosIds);
        }
      }
    } catch (error) {
      logger.error("Erro ao buscar produtos da tabela:", error);
    }
  };

  useEffect(() => {
    if (tabela?.tipo_base === "tabela_anterior") {
      setFonteCusto("tabela_anterior");
    } else if (origemSelecionada) {
      setFonteCusto("custo_origem");
    }
  }, [tabela, origemSelecionada]);

  const calcularPrecosMutation = useMutation({
    mutationFn: async () => {
      setCalculando(true);
      
      // Modo preço final: calcular com tabela_anterior para obter custo base, depois aplicar preço desejado
      if (fonteCusto === 'preco_final') {
        // Buscar preços da tabela base para obter custos base
        const precos = await calcularPrecosProdutos(
          tabela.id,
          produtosSelecionados,
          {
            fonteCusto: 'tabela_anterior',
            origem: origemSelecionada || undefined,
          }
        );

        // Sobrescrever com preços manuais desejados e calcular markup reverso
        const precosAjustados = precos.map(preco => {
          const precoDesejadoStr = precosManual[preco.produto_id];
          const precoDesejado = precoDesejadoStr ? parseFloat(precoDesejadoStr.replace(',', '.')) : 0;
          
          if (precoDesejado > 0 && preco.custo_base > 0) {
            const margem = calcularMargemLucro(preco.custo_base, precoDesejado);
            return {
              ...preco,
              preco_calculado: precoDesejado,
              preco_final: precoDesejado,
              margem_lucro_percentual: margem,
              _precoManual: true,
            };
          }
          return preco;
        });

        return precosAjustados;
      }

      // Se for ficha_custo, buscar os custos de todas as fichas primeiro
      let custosFichaProduto: Record<string, { custoTotal: number; composicao: CustoComposicao | null; configId: string | null }> = {};
      
      if (fonteCusto === 'ficha_custo') {
        for (const produtoId of produtosSelecionados) {
          const resultado = await buscarCustoFichaProduto(produtoId);
          if (resultado) {
            custosFichaProduto[produtoId] = resultado;
          }
        }
        setComposicoesCache(custosFichaProduto);
      }
      
      const precos = await calcularPrecosProdutos(
        tabela.id,
        produtosSelecionados,
        {
          fonteCusto,
          custosManual: Object.fromEntries(
            Object.entries(custosManual).map(([id, valor]) => [id, parseFloat(valor)])
          ),
          origem: origemSelecionada || undefined,
          custosFichaProduto: fonteCusto === 'ficha_custo' ? custosFichaProduto : undefined,
        }
      );

      return precos;
    },
    onSuccess: (precos) => {
      setPrecosCalculados(precos);
      setCalculando(false);
      toast.success("Preços calculados com sucesso!");
    },
    onError: (error: any) => {
      setCalculando(false);
      toast.error("Erro ao calcular preços: " + error.message);
    },
  });

  const salvarPrecosMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      if (!precosCalculados || precosCalculados.length === 0) {
        throw new Error("Nenhum preço calculado para salvar");
      }
      
      const registros = precosCalculados.map((preco) => {
        // Se fonte for ficha_custo, incluir composição e config_id
        const composicaoFicha = fonteCusto === 'ficha_custo' && composicoesCache[preco.produto_id]
          ? composicoesCache[preco.produto_id]
          : null;
        
        return {
          tabela_id: tabela.id,
          produto_id: preco.produto_id,
          custo_base: preco.custo_base,
          custo_base_origem: fonteCusto === 'preco_final' ? 'tabela_anterior' : fonteCusto,
          preco_calculado: preco.preco_calculado,
          preco_final: preco.preco_final,
          margem_lucro_percentual: preco.margem_lucro_percentual,
          origem: origemSelecionada || 'nacional',
          ativo: true,
          ficha_custo_config_id: composicaoFicha?.configId || null,
          custo_composicao: composicaoFicha?.composicao ? JSON.stringify(composicaoFicha.composicao) : null,
        };
      });

      const { error } = await supabase
        .from("fabrica_precos_produtos")
        .upsert(registros, {
          onConflict: "tabela_id,produto_id",
        });

      if (error) throw error;

      // Se fonteCusto === 'preco_final', criar overrides de markup para produtos com preço manual
      if (fonteCusto === 'preco_final') {
        const { data: user } = await supabase.auth.getUser();
        const tipoMarkup = tabela.tipo_markup as 'percentual' | 'multiplicador' | 'valor_fixo';
        
        for (const preco of precosCalculados) {
          if ((preco as any)._precoManual && preco.custo_base > 0) {
            const markupValue = reverseMarkup(preco.custo_base, preco.preco_final, tipoMarkup);
            
            // Upsert override
            const { error: ovError } = await supabase
              .from("fabrica_markup_overrides")
              .upsert(
                {
                  tabela_id: tabela.id,
                  produto_id: preco.produto_id,
                  tipo_markup: tipoMarkup,
                  valor_markup: markupValue,
                  ativo: true,
                  created_by: user.user?.id || null,
                },
                { onConflict: "tabela_id,produto_id" }
              );
            
            if (ovError) {
              // Fallback: update
              await supabase
                .from("fabrica_markup_overrides")
                .update({
                  tipo_markup: tipoMarkup,
                  valor_markup: markupValue,
                  ativo: true,
                  created_by: user.user?.id || null,
                })
                .eq("tabela_id", tabela.id)
                .eq("produto_id", preco.produto_id);
            }
          }
        }
      }

      // Submissão atômica: registra escopo + dispara trigger de versão na mesma transação.
      const escopoIds = Array.from(
        new Set(precosCalculados.map((p) => p.produto_id).filter(Boolean))
      );
      if (escopoIds.length === 0) {
        throw new Error("Nenhum produto no escopo para submeter à aprovação");
      }
      const { error: submitErr } = await supabase.rpc(
        "rpc_submeter_tabela_para_aprovacao" as any,
        { p_tabela_id: tabela.id, p_produto_ids: escopoIds }
      );
      if (submitErr) {
        logger.error("Erro ao submeter tabela para aprovação:", submitErr);
        throw submitErr;
      }

      // Registrar na auditoria
      const { error: auditoriaError } = await supabase
        .from("fabrica_tabelas_preco_auditoria")
        .insert({
          tabela_id: tabela.id,
          user_id: user.user?.id,
          acao: "price_generation",
          mensagem: `Preços gerados - enviados para aprovação`,
        });

      if (auditoriaError) {
        logger.error("Erro na auditoria:", auditoriaError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-preco"] });
      queryClient.invalidateQueries({ queryKey: ["visualizacao-precos"] });
      queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-tabelas-preco"] });
      toast.success("Preços salvos e enviados para aprovação!");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar preços: " + error.message);
    },
  });

  const handleSelecionarTodos = (checked: boolean) => {
    if (checked) {
      setProdutosSelecionados(produtosFiltrados.map(p => p.id));
    } else {
      setProdutosSelecionados([]);
    }
  };

  const handleToggleProduto = (produtoId: string, checked: boolean) => {
    if (checked) {
      setProdutosSelecionados([...produtosSelecionados, produtoId]);
    } else {
      setProdutosSelecionados(produtosSelecionados.filter(id => id !== produtoId));
    }
  };

  const handleCalcular = () => {
    if (produtosSelecionados.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    if (fonteCusto === "manual") {
      const faltamCustos = produtosSelecionados.some(id => !custosManual[id] || parseFloat(custosManual[id]) <= 0);
      if (faltamCustos) {
        toast.error("Preencha o custo manual de todos os produtos selecionados");
        return;
      }
    }

    if (fonteCusto === "preco_final") {
      const faltamPrecos = produtosSelecionados.some(id => {
        const val = precosManual[id];
        if (!val) return true;
        const num = parseFloat(val.replace(',', '.'));
        return isNaN(num) || num <= 0;
      });
      if (faltamPrecos) {
        toast.error("Preencha o preço desejado de todos os produtos selecionados");
        return;
      }
    }

    calcularPrecosMutation.mutate();
  };

  const getTipoMarkupLabel = () => {
    if (!tabela) return "";
    
    switch (tabela.tipo_markup) {
      case 'percentual':
        return `+${tabela.valor_markup}%`;
      case 'multiplicador':
        return `x${tabela.valor_markup}`;
      case 'valor_fixo':
        return `+${formatarMoeda(tabela.valor_markup)}`;
      default:
        return tabela.valor_markup.toString();
    }
  };

  const marcasDisponiveis = [...new Set(produtos.map(p => p.marca).filter(Boolean) as string[])].sort();
  const linhasDisponiveis = [...new Set(
    produtos
      .filter(p => marcaFiltro === "todas" || p.marca === marcaFiltro)
      .map(p => p.linha)
      .filter(Boolean) as string[]
  )].sort();

  const produtosFiltradosPorBusca = produtos?.filter(produto => {
    const matchBusca = !buscaProduto || 
      produto.nome.toLowerCase().includes(buscaProduto.toLowerCase()) ||
      produto.codigo?.toLowerCase().includes(buscaProduto.toLowerCase());
    
    const matchLinha = linhaFiltro === "todas" || produto.linha === linhaFiltro;
    const matchMarca = marcaFiltro === "todas" || produto.marca === marcaFiltro;
    const isKit = (produto.tipo || "").toUpperCase() === "DISPLAY";
    const matchTipo =
      tipoFiltro === "todos" ||
      (tipoFiltro === "kit" && isKit) ||
      (tipoFiltro === "unitario" && !isKit);
    const isProv = !!(produto as any).is_provador;
    const matchUso =
      usoFiltro === "todos" ||
      (usoFiltro === "provador" && isProv) ||
      (usoFiltro === "venda" && !isProv);

    // Filtro de data de aprovação (somente quando há ficha aprovada)
    let matchData = true;
    if (dataAprovacaoInicio || dataAprovacaoFim) {
      const info = fichaStatusMap[produto.id];
      const dataAprov = info?.dataAprovacao ? info.dataAprovacao.slice(0, 10) : null;
      if (!dataAprov) matchData = false;
      else {
        if (dataAprovacaoInicio && dataAprov < dataAprovacaoInicio) matchData = false;
        if (dataAprovacaoFim && dataAprov > dataAprovacaoFim) matchData = false;
      }
    }

    return matchBusca && matchLinha && matchMarca && matchTipo && matchData;
  }) || [];

  // Apply granular access filtering
  const produtosFiltradosBase = tabela?.id 
    ? filterProductsByAccess(tabela.id, produtosFiltradosPorBusca) 
    : produtosFiltradosPorBusca;

  // Helpers e filtros específicos para Ficha de Custo
  const isFichaMode = fonteCusto === "ficha_custo";
  const getFichaInfo = (produtoId: string): FichaStatusInfo =>
    fichaStatusMap[produtoId] || { status: "sem_ficha", dataAprovacao: null };
  const isAprovadaRecente = (info: FichaStatusInfo) =>
    info.status === "aprovada" &&
    info.dataAprovacao &&
    differenceInDays(new Date(), new Date(info.dataAprovacao)) <= 30;
  const isPendentePrecificacao = (produtoId: string) => {
    const info = getFichaInfo(produtoId);
    return info.status === "aprovada" && !produtosComPrecoNaTabela.has(produtoId);
  };

  const produtosFiltrados = useMemo(() => {
    let lista = [...produtosFiltradosBase];
    if (isFichaMode) {
      if (filtroPendentes) lista = lista.filter((p) => isPendentePrecificacao(p.id));
      if (filtroAprovadas) lista = lista.filter((p) => getFichaInfo(p.id).status === "aprovada");
      if (filtroRecentes) lista = lista.filter((p) => isAprovadaRecente(getFichaInfo(p.id)));
      // Ordena: pendentes primeiro, depois aprovadas mais recentes
      lista.sort((a, b) => {
        const ap = isPendentePrecificacao(a.id) ? 0 : 1;
        const bp = isPendentePrecificacao(b.id) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const da = getFichaInfo(a.id).dataAprovacao || "";
        const db = getFichaInfo(b.id).dataAprovacao || "";
        return db.localeCompare(da);
      });
    }
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtosFiltradosBase, isFichaMode, filtroPendentes, filtroAprovadas, filtroRecentes, fichaStatusMap, produtosComPrecoNaTabela]);

  const totalAprovadas = useMemo(
    () => produtosFiltradosBase.filter((p) => getFichaInfo(p.id).status === "aprovada").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produtosFiltradosBase, fichaStatusMap],
  );
  const totalPendentesPrecificacao = useMemo(
    () => produtosFiltradosBase.filter((p) => isPendentePrecificacao(p.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produtosFiltradosBase, fichaStatusMap, produtosComPrecoNaTabela],
  );

  const handleSelecionarPendentes = () => {
    const ids = produtosFiltradosBase.filter((p) => isPendentePrecificacao(p.id)).map((p) => p.id);
    setProdutosSelecionados(ids);
    setFiltroPendentes(true);
  };


  if (!tabela) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1280px] w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Preços - {tabela.nome}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Markup: {getTipoMarkupLabel()}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Indicador de Origem da Tabela */}
          {tabela.origem_aplicavel && tabela.origem_aplicavel !== 'ambos' && (
            <div className={`p-3 rounded-lg border flex items-center gap-2 ${
              tabela.origem_aplicavel === 'nacional' 
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
            }`}>
              {tabela.origem_aplicavel === 'nacional' ? (
                <Factory className="h-5 w-5 text-green-600" />
              ) : (
                <Ship className="h-5 w-5 text-blue-600" />
              )}
              <span className="text-sm font-medium">
                Esta tabela é exclusiva para produtos de origem <strong>{tabela.origem_aplicavel === 'nacional' ? 'Nacional' : 'Importada'}</strong>
              </span>
            </div>
          )}

          {/* Fonte do Custo */}
          {tabela.tipo_base !== "tabela_anterior" && (
            <div>
              <Label>Fonte do Custo Base</Label>
              <RadioGroup value={fonteCusto} onValueChange={(value: any) => setFonteCusto(value)}>
                {origemSelecionada && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custo_origem" id="fonte_origem" />
                    <Label htmlFor="fonte_origem" className="font-normal cursor-pointer flex items-center gap-2">
                      {origemSelecionada === 'nacional' ? <Factory className="h-4 w-4 text-green-600" /> : <Ship className="h-4 w-4 text-blue-600" />}
                      Custo por Origem ({origemSelecionada === 'nacional' ? 'Nacional' : 'Importado'})
                    </Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ordem_producao" id="fonte_op" />
                  <Label htmlFor="fonte_op" className="font-normal cursor-pointer">
                    Última Ordem de Produção
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custo_medio" id="fonte_medio" />
                  <Label htmlFor="fonte_medio" className="font-normal cursor-pointer">
                    Custo Médio do Produto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="fonte_manual" />
                  <Label htmlFor="fonte_manual" className="font-normal cursor-pointer">
                    Digitar Manualmente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ficha_custo" id="fonte_ficha" />
                  <Label htmlFor="fonte_ficha" className="font-normal cursor-pointer flex items-center gap-2">
                    <FileText className="h-4 w-4 text-orange-600" />
                    Ficha de Custos do Produto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="preco_final" id="fonte_preco_final" />
                  <Label htmlFor="fonte_preco_final" className="font-normal cursor-pointer flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Digitar Preço Final (cálculo reverso)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Opção de preço final para tabelas baseadas em tabela anterior */}
          {tabela.tipo_base === "tabela_anterior" && (
            <div className="flex items-center gap-3">
              <Button
                variant={fonteCusto === "preco_final" ? "default" : "outline"}
                size="sm"
                onClick={() => setFonteCusto(fonteCusto === "preco_final" ? "tabela_anterior" : "preco_final")}
                className="flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Digitar Preço Final
              </Button>
              {fonteCusto === "preco_final" && (
                <span className="text-xs text-muted-foreground">
                  O markup será calculado automaticamente comparado à tabela anterior
                </span>
              )}
            </div>
          )}

          {fonteCusto === "preco_final" && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Modo Preço Final</p>
                <p className="text-muted-foreground">
                  Digite o preço desejado para cada produto. O sistema calculará automaticamente o markup necessário 
                  comparado à tabela anterior e salvará como override individual.
                </p>
              </div>
            </div>
          )}

          {/* Painel de orientação para Ficha de Custo */}
          {isFichaMode && (
            <GeradorPrecosFichaInfo
              totalAprovadas={totalAprovadas}
              totalPendentesPrecificacao={totalPendentesPrecificacao}
              filtroPendentes={filtroPendentes}
              filtroAprovadas={filtroAprovadas}
              filtroRecentes={filtroRecentes}
              onToggleFiltroPendentes={() => setFiltroPendentes((v) => !v)}
              onToggleFiltroAprovadas={() => setFiltroAprovadas((v) => !v)}
              onToggleFiltroRecentes={() => setFiltroRecentes((v) => !v)}
              onSelecionarPendentes={handleSelecionarPendentes}
            />
          )}

          {/* Lista de Produtos */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
              <Label className="shrink-0">Produtos</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <ToggleGroup
                  type="single"
                  value={tipoFiltro}
                  onValueChange={(v) => v && setTipoFiltro(v as "todos" | "kit" | "unitario")}
                  className="border rounded-md"
                >
                  <ToggleGroupItem value="todos" className="text-xs px-3 h-8">
                    Todos
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="unitario"
                    className="text-xs px-3 h-8 data-[state=on]:bg-amber-600 data-[state=on]:text-white"
                  >
                    Unitários
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="kit"
                    className="text-xs px-3 h-8 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                  >
                    Kits
                  </ToggleGroupItem>
                </ToggleGroup>

                <ToggleGroup
                  type="single"
                  value={usoFiltro}
                  onValueChange={(v) => v && setUsoFiltro(v as "todos" | "venda" | "provador")}
                  className="border rounded-md"
                  title="Por padrão, provadores ficam ocultos para evitar precificá-los junto dos produtos de venda."
                >
                  <ToggleGroupItem value="venda" className="text-xs px-3 h-8 data-[state=on]:bg-emerald-600 data-[state=on]:text-white">
                    Apenas venda
                  </ToggleGroupItem>
                  <ToggleGroupItem value="todos" className="text-xs px-3 h-8 data-[state=on]:bg-muted">
                    Mostrar todos
                  </ToggleGroupItem>
                  <ToggleGroupItem value="provador" className="text-xs px-3 h-8 data-[state=on]:bg-amber-600 data-[state=on]:text-white">
                    Só provadores
                  </ToggleGroupItem>
                </ToggleGroup>

                <Input
                  placeholder="Buscar produto..."
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  className="w-44 h-8 text-xs"
                />

                {marcasDisponiveis.length > 0 && (
                  <Select
                    value={marcaFiltro}
                    onValueChange={(v) => {
                      setMarcaFiltro(v);
                      setLinhaFiltro("todas");
                    }}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Marca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as marcas</SelectItem>
                      {marcasDisponiveis.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {linhasDisponiveis.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Select value={linhaFiltro} onValueChange={setLinhaFiltro}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Linha" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as linhas</SelectItem>
                        {linhasDisponiveis.map((linha) => (
                          <SelectItem key={linha} value={linha}>
                            <span className="flex items-center gap-1">
                              {linha}
                              {isLineBlocked(linha) && <Lock className="h-3 w-3 text-red-500" />}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasFullAccess && linhaFiltro !== "todas" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 whitespace-nowrap text-xs"
                        disabled={isBlocking || isUnblocking}
                        onClick={() => {
                          const block = getBlockForLine(linhaFiltro);
                          if (block) unblock(block.id);
                          else blockLine(linhaFiltro);
                        }}
                      >
                        {getBlockForLine(linhaFiltro) ? (
                          <><LockOpen className="h-3.5 w-3.5 mr-1 text-green-600" /> Desbloquear</>
                        ) : (
                          <><Lock className="h-3.5 w-3.5 mr-1 text-red-500" /> Bloquear</>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {isFichaMode && (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">Aprovada:</span>
                    <Input
                      type="date"
                      value={dataAprovacaoInicio}
                      onChange={(e) => setDataAprovacaoInicio(e.target.value)}
                      className="w-36 h-8 text-xs"
                      title="Data inicial"
                    />
                    <span className="text-[11px] text-muted-foreground">até</span>
                    <Input
                      type="date"
                      value={dataAprovacaoFim}
                      onChange={(e) => setDataAprovacaoFim(e.target.value)}
                      className="w-36 h-8 text-xs"
                      title="Data final"
                    />
                  </div>
                )}

                {(marcaFiltro !== "todas" ||
                  linhaFiltro !== "todas" ||
                  tipoFiltro !== "todos" ||
                  dataAprovacaoInicio ||
                  dataAprovacaoFim ||
                  buscaProduto) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setMarcaFiltro("todas");
                      setLinhaFiltro("todas");
                      setTipoFiltro("todos");
                      setDataAprovacaoInicio("");
                      setDataAprovacaoFim("");
                      setBuscaProduto("");
                    }}
                  >
                    Limpar
                  </Button>
                )}

                <div className="flex items-center space-x-2 pl-2 border-l">
                  <Checkbox
                    id="selecionar_todos"
                    checked={produtosSelecionados.length === produtosFiltrados.length && produtosFiltrados.length > 0}
                    onCheckedChange={handleSelecionarTodos}
                  />
                  <Label htmlFor="selecionar_todos" className="font-normal cursor-pointer whitespace-nowrap text-xs">
                    Selecionar todos ({produtosFiltrados.length})
                  </Label>
                </div>
              </div>
            </div>

            {produtosNaTabelaBase.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>{produtosNaTabelaBase.length} produto(s)</strong> já existem na tabela base e foram pré-selecionados. 
                  Você pode adicionar ou remover produtos conforme necessário.
                </p>
              </div>
            )}

            {loadingProdutos ? (
              <div className="text-center py-4 text-muted-foreground">Carregando produtos...</div>
            ) : (
              <div className="border rounded-lg max-h-[55vh] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 sticky top-0 z-10 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left w-10"></th>
                      <th className="px-2 py-2 text-left w-32">Código</th>
                      <th className="px-2 py-2 text-left">Produto</th>
                      <th className="px-2 py-2 text-left w-32">Linha</th>
                      <th className="px-2 py-2 text-center w-16">Origem</th>
                      {isFichaMode && (
                        <>
                          <th className="px-2 py-2 text-left w-36">Status Ficha</th>
                          <th className="px-2 py-2 text-center w-24">Aprovada em</th>
                          <th className="px-2 py-2 text-center w-32">Preço atual</th>
                        </>
                      )}
                      {fonteCusto === "manual" && (
                        <th className="px-2 py-2 text-left w-32">Custo Base (R$)</th>
                      )}
                      {fonteCusto === "preco_final" && (
                        <th className="px-2 py-2 text-left w-36">Preço Desejado (R$)</th>
                      )}
                      <th className="px-2 py-2 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map((produto) => {
                      const blocked = isProductBlocked(produto.linha, produto.id);
                      const productBlock = getBlockForProduct(produto.id);
                      const lineBlock = produto.linha ? getBlockForLine(produto.linha) : undefined;
                      const fichaInfo = getFichaInfo(produto.id);
                      const pendente = isPendentePrecificacao(produto.id);
                      const jaTem = produtosComPrecoNaTabela.has(produto.id);
                      const isSelected = produtosSelecionados.includes(produto.id);

                      return (
                        <tr
                          key={produto.id}
                          className={`border-t transition-colors hover:bg-muted/40 ${
                            blocked ? "bg-red-50 dark:bg-red-950/20" : ""
                          } ${isSelected ? "bg-primary/5" : ""} ${
                            pendente && isFichaMode ? "border-l-2 border-l-orange-500" : ""
                          }`}
                        >
                          <td className="px-2 py-1.5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleToggleProduto(produto.id, checked as boolean)}
                            />
                          </td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {(produto as any).is_provador && (
                              <div className="mb-0.5"><ProvadorBadge /></div>
                            )}
                            {produto.codigo || "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate max-w-[280px]" title={produto.nome}>
                                {produto.nome}
                              </span>
                              {blocked && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  <Lock className="h-3 w-3 mr-0.5" />
                                  {lineBlock ? "Linha" : "Bloq"}
                                </Badge>
                              )}
                              {produtosNaTabelaBase.includes(produto.id) && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                  Base
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[120px]" title={produto.linha || ""}>
                            {produto.linha || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {produto.origem ? (
                              <Badge
                                variant="outline"
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0 ${
                                  produto.origem === "nacional"
                                    ? "border-green-300 text-green-700"
                                    : "border-blue-300 text-blue-700"
                                }`}
                              >
                                {produto.origem === "nacional" ? (
                                  <Factory className="h-3 w-3" />
                                ) : (
                                  <Ship className="h-3 w-3" />
                                )}
                                {produto.origem === "nacional" ? "Nac" : "Imp"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          {isFichaMode && (
                            <>
                              <td className="px-2 py-1.5">
                                {fichaInfo.status === "aprovada" && (
                                  <Badge
                                    variant="outline"
                                    className="border-green-300 text-green-700 dark:text-green-400 text-[10px] px-1.5 py-0"
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                    Aprovada
                                  </Badge>
                                )}
                                {(fichaInfo.status === "em_revisao" ||
                                  fichaInfo.status === "revisao_solicitada") && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300"
                                  >
                                    Em revisão
                                  </Badge>
                                )}
                                {fichaInfo.status === "rascunho" && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 text-muted-foreground"
                                  >
                                    Rascunho
                                  </Badge>
                                )}
                                {fichaInfo.status === "sem_ficha" && (
                                  <span className="text-muted-foreground text-[11px]">Sem ficha</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">
                                {fichaInfo.dataAprovacao
                                  ? format(new Date(fichaInfo.dataAprovacao), "dd/MM/yyyy", { locale: ptBR })
                                  : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                {pendente ? (
                                  <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-[10px] px-1.5 py-0">
                                    Precificar
                                  </Badge>
                                ) : jaTem ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                    Já tem
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </>
                          )}
                          {fonteCusto === "manual" && (
                            <td className="px-2 py-1.5">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={custosManual[produto.id] || ""}
                                onChange={(e) =>
                                  setCustosManual({ ...custosManual, [produto.id]: e.target.value })
                                }
                                disabled={!isSelected}
                                className="h-7 text-xs"
                              />
                            </td>
                          )}
                          {fonteCusto === "preco_final" && (
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">R$</span>
                                <Input
                                  type="text"
                                  placeholder="0,00"
                                  value={precosManual[produto.id] || ""}
                                  onChange={(e) =>
                                    setPrecosManual({ ...precosManual, [produto.id]: e.target.value })
                                  }
                                  disabled={!isSelected}
                                  className="h-7 text-xs w-24"
                                />
                              </div>
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-center">
                            {hasFullAccess && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={isBlocking || isUnblocking}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (productBlock) {
                                    unblock(productBlock.id);
                                  } else if (!lineBlock) {
                                    blockProduct(produto.id);
                                  }
                                }}
                                title={productBlock ? "Desbloquear produto" : "Bloquear produto"}
                              >
                                {productBlock ? (
                                  <LockOpen className="h-3.5 w-3.5 text-green-600" />
                                ) : !lineBlock ? (
                                  <Lock className="h-3.5 w-3.5 text-red-500" />
                                ) : null}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {produtosFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={isFichaMode ? 9 : 6}
                          className="text-center py-8 text-muted-foreground text-xs"
                        >
                          Nenhum produto encontrado com os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Botão Calcular */}
          {precosCalculados.length === 0 && (
            <Button
              onClick={handleCalcular}
              disabled={calculando || produtosSelecionados.length === 0}
              className="w-full"
            >
              {calculando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculando...
                </>
              ) : (
                "Calcular Preços"
              )}
            </Button>
          )}

          {/* Preços Calculados */}
          {precosCalculados.length > 0 && (
            <div>
              <Label className="mb-2 block">Prévia dos Preços</Label>
              {precosCalculados.some(p => p.preco_limitado) && (
                <div className="mb-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span>Alguns preços foram ajustados para respeitar os limites máximos definidos</span>
                </div>
              )}
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-right">Custo Base</th>
                      <th className="p-2 text-right">Preço Calculado</th>
                      <th className="p-2 text-right">Margem</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precosCalculados.map((preco) => {
                      const produto = produtos?.find(p => p.id === preco.produto_id);
                      return (
                        <tr key={preco.produto_id} className={`border-t ${preco.preco_limitado ? 'bg-yellow-500/5' : ''}`}>
                          <td className="p-2">
                            <div className="flex items-center gap-1.5">
                              {produto?.nome}
                              {preco.override_tipo === 'produto' && (
                                <Badge className="bg-purple-500/20 text-purple-700 border-purple-300 text-[10px] px-1 py-0">Individual</Badge>
                              )}
                              {preco.override_tipo === 'linha' && (
                                <Badge className="bg-blue-500/20 text-blue-700 border-blue-300 text-[10px] px-1 py-0">Linha</Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right">{formatarMoeda(preco.custo_base)}</td>
                          <td className="p-2 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-semibold">{formatarMoeda(preco.preco_final)}</span>
                              {preco.preco_limitado && preco.preco_original_calculado && (
                                <span className="text-xs text-muted-foreground line-through">
                                  {formatarMoeda(preco.preco_original_calculado)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right text-green-600">
                            {preco.margem_lucro_percentual.toFixed(2)}%
                          </td>
                          <td className="p-2 text-center">
                            {preco.preco_limitado ? (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Limitado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <Check className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {precosCalculados.length > 0 && (
            <Button
              onClick={() => salvarPrecosMutation.mutate()}
              disabled={salvarPrecosMutation.isPending}
            >
              {salvarPrecosMutation.isPending ? "Salvando..." : "Salvar Preços"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
