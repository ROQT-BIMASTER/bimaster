import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Eye, FileText, BarChart3 } from "lucide-react";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SimuladorImpactoPrecos } from "@/components/fabrica/SimuladorImpactoPrecos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { AprovacaoCascataDialog } from "@/components/fabrica/AprovacaoCascataDialog";
import { OrigemCustoHistorico } from "@/components/fabrica/OrigemCustoHistorico";
import { Workflow, History as HistoryIcon } from "lucide-react";
import { verifyCurrentUserPassword } from "@/lib/auth/verifyCurrentUserPassword";

export default function FabricaAprovacaoPrecos() {
  const queryClient = useQueryClient();
  const [tabelaSelecionada, setTabelaSelecionada] = useState<any>(null);
  const [versaoSelecionada, setVersaoSelecionada] = useState<any>(null);
  const [showPrecos, setShowPrecos] = useState(false);
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [showAprovar, setShowAprovar] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [senhaAprovar, setSenhaAprovar] = useState("");
  const [senhaRejeitar, setSenhaRejeitar] = useState("");
  const [showImpacto, setShowImpacto] = useState(false);
  const [showCascata, setShowCascata] = useState(false);
  const [cascataEscopo, setCascataEscopo] = useState<Array<{ produto_id: string; produto_nome: string; produto_codigo: string; custo_raiz: number }>>([]);
  const [showOrigem, setShowOrigem] = useState<{ produtoId: string; nome: string; custo: number } | null>(null);
  const [loteAcao, setLoteAcao] = useState<{ tipo: "aprovar" | "rejeitar"; loteId: string; descricao: string } | null>(null);
  const [senhaLote, setSenhaLote] = useState("");
  const [motivoLote, setMotivoLote] = useState("");

  // Realtime: escutar mudanças nas tabelas de preço
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName('tabelas-preco-changes'))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fabrica_tabelas_preco',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Buscar tabelas pendentes de aprovação
  const { data: tabelasPendentes, isLoading, error: queryError } = useQuery({
    queryKey: ["tabelas-pendentes-aprovacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select(`
          *,
          tabela_base:tabela_base_id(nome)
        `)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Erro ao buscar tabelas pendentes:", error);
        throw error;
      }
      
      // Buscar nomes dos criadores separadamente (quando não null)
      if (data && data.length > 0) {
        const criadoresIds = data.filter(t => t.created_by).map(t => t.created_by);
        if (criadoresIds.length > 0) {
          const { data: perfis } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", criadoresIds);
          
          if (perfis) {
            const perfisMap = Object.fromEntries(perfis.map(p => [p.id, p.nome]));
            return data.map(t => ({
              ...t,
              criador: t.created_by ? { nome: perfisMap[t.created_by] || null } : null
            }));
          }
        }
      }
      
      return data;
    },
    refetchInterval: 10000,
  });
  
  // Log error for debugging
  useEffect(() => {
    if (queryError) {
      logger.error("Query error:", queryError);
      toast.error("Erro ao carregar tabelas: " + (queryError as any).message);
    }
  }, [queryError]);

  // Buscar TODOS os lotes (versões) pendentes de cada tabela. Cada submissão = 1 lote.
  const { data: lotesPorTabela } = useQuery({
    queryKey: ["lotes-pendentes-por-tabela", (tabelasPendentes || []).map((t: any) => t.id).join(",")],
    queryFn: async () => {
      const ids = (tabelasPendentes || []).map((t: any) => t.id);
      type Lote = {
        id: string;
        tabela_id: string;
        versao: number;
        created_at: string;
        created_by: string | null;
        criador_nome: string | null;
        produtos: { id: string; nome: string; codigo: string | null; preco_final: number | null; custo_base: number | null }[];
        total: number;
        escopoExplicito: boolean;
      };
      if (ids.length === 0) return {} as Record<string, Lote[]>;

      const { data: versoes } = await supabase
        .from("fabrica_tabelas_preco_versoes")
        .select("id, tabela_id, versao, precos_snapshot, produto_ids_escopo, created_at, created_by, aprovado_em")
        .in("tabela_id", ids)
        .is("aprovado_em", null)
        .order("versao", { ascending: false });

      const todosProdutoIds = new Set<string>();
      const criadorIds = new Set<string>();
      (versoes || []).forEach((v: any) => {
        if (v.created_by) criadorIds.add(v.created_by);
        const escopo = (v.produto_ids_escopo as string[] | null) || null;
        if (escopo && escopo.length > 0) {
          escopo.forEach((id) => id && todosProdutoIds.add(id));
        } else if (Array.isArray(v.precos_snapshot)) {
          v.precos_snapshot.forEach((p: any) => p?.produto_id && todosProdutoIds.add(p.produto_id));
        }
      });

      const [{ data: produtos }, { data: perfis }] = await Promise.all([
        todosProdutoIds.size > 0
          ? supabase.from("fabrica_produtos").select("id, nome, codigo").in("id", Array.from(todosProdutoIds))
          : Promise.resolve({ data: [] as any[] }),
        criadorIds.size > 0
          ? supabase.from("profiles").select("id, nome").in("id", Array.from(criadorIds))
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const prodMap = new Map<string, { id: string; nome: string; codigo: string | null }>(
        (produtos || []).map((p: any) => [p.id, { id: p.id, nome: p.nome, codigo: p.codigo }])
      );
      const perfilMap = new Map<string, string>((perfis || []).map((p: any) => [p.id, p.nome]));

      const result: Record<string, Lote[]> = {};
      (versoes || []).forEach((v: any) => {
        const escopo = (v.produto_ids_escopo as string[] | null) || null;
        const snapshot = (v.precos_snapshot as any[]) || [];
        const idsEscopo = escopo && escopo.length > 0
          ? escopo
          : Array.from(new Set(snapshot.map((p: any) => p?.produto_id).filter(Boolean)));
        const snapshotMap = new Map(snapshot.map((p: any) => [p.produto_id, p]));
        const lote: Lote = {
          id: v.id,
          tabela_id: v.tabela_id,
          versao: v.versao,
          created_at: v.created_at,
          created_by: v.created_by,
          criador_nome: v.created_by ? perfilMap.get(v.created_by) || null : null,
          produtos: idsEscopo.map((id) => {
            const meta = prodMap.get(id) || { id, nome: id, codigo: null };
            const snap = snapshotMap.get(id);
            return {
              ...meta,
              preco_final: snap?.preco_final ?? null,
              custo_base: snap?.custo_base ?? null,
            };
          }),
          total: idsEscopo.length,
          escopoExplicito: !!(escopo && escopo.length > 0),
        };
        if (!result[v.tabela_id]) result[v.tabela_id] = [];
        result[v.tabela_id].push(lote);
      });
      return result;
    },
    enabled: !!tabelasPendentes && tabelasPendentes.length > 0,
  });

  // Buscar histórico de versões de uma tabela
  const { data: versoes } = useQuery({
    queryKey: ["versoes-tabela", tabelaSelecionada?.id],
    queryFn: async () => {
      if (!tabelaSelecionada) return [];

      const { data, error } = await supabase
        .from("fabrica_tabelas_preco_versoes")
        .select(`
          *
        `)
        .eq("tabela_id", tabelaSelecionada.id)
        .order("versao", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!tabelaSelecionada,
  });

  // Auto-selecionar última versão quando abrir análise de impacto
  useEffect(() => {
    if (showImpacto && versoes && versoes.length > 0 && !versaoSelecionada) {
      setVersaoSelecionada(versoes[0]);
    }
  }, [showImpacto, versoes, versaoSelecionada]);

  // Buscar preços da versão selecionada com nomes dos produtos
  const { data: precosVersao } = useQuery({
    queryKey: ["precos-versao", versaoSelecionada?.id, tabelaSelecionada?.tabela_base_id],
    queryFn: async () => {
      if (!versaoSelecionada?.precos_snapshot) return [];

      let snapshot = versaoSelecionada.precos_snapshot as any[];
      if (!snapshot.length) return snapshot;

      // FIX: filtrar pelo escopo real submetido (produto_ids_escopo).
      // Snapshots legados não têm esse campo — fallback para todos.
      const escopo = (versaoSelecionada as any).produto_ids_escopo as string[] | null | undefined;
      if (escopo && escopo.length > 0) {
        const set = new Set(escopo);
        snapshot = snapshot.filter((p: any) => set.has(p.produto_id));
      }

      // Buscar IDs dos produtos do snapshot
      const produtoIds = snapshot.map((p: any) => p.produto_id).filter(Boolean);
      
      if (produtoIds.length === 0) return snapshot;
      
      // Buscar nomes dos produtos
      const { data: produtos } = await supabase
        .from("fabrica_produtos")
        .select("id, nome, codigo")
        .in("id", produtoIds);
      
      // Buscar preços da tabela base se existir
      let precosTabelaBase: Record<string, number> = {};
      if (tabelaSelecionada?.tabela_base_id) {
        const { data: precosBase } = await supabase
          .from("fabrica_precos_produtos")
          .select("produto_id, preco_final")
          .eq("tabela_id", tabelaSelecionada.tabela_base_id)
          .eq("ativo", true);
        
        if (precosBase) {
          precosTabelaBase = Object.fromEntries(
            precosBase.map(p => [p.produto_id, p.preco_final || 0])
          );
        }
      }
      
      // Criar mapa de produtos
      const produtosMap = new Map(
        (produtos || []).map((p: any) => [p.id, { nome: p.nome, codigo: p.codigo }])
      );
      
      // Enriquecer snapshot com nomes e calcular margem
      return snapshot.map((preco: any) => {
        const precoBase = precosTabelaBase[preco.produto_id];
        const referencia = precoBase && precoBase > 0 ? precoBase : (preco.custo_base || 0);
        const precoFinal = preco.preco_final || 0;
        const margemCalculada = precoFinal > 0 && referencia > 0
          ? ((precoFinal - referencia) / precoFinal) * 100
          : (preco.margem_lucro_percentual || 0);

        return {
          ...preco,
          produto_nome: produtosMap.get(preco.produto_id)?.nome || preco.produto_id,
          produto_codigo: produtosMap.get(preco.produto_id)?.codigo || '-',
          preco_tabela_base: precoBase || null,
          margem_calculada: margemCalculada
        };
      });
    },
    enabled: !!versaoSelecionada && (showPrecos || showImpacto),
  });

  // Buscar preços atuais para comparação
  const { data: precosAtuais } = useQuery({
    queryKey: ["precos-atuais-tabela", tabelaSelecionada?.id],
    queryFn: async () => {
      if (!tabelaSelecionada?.id) return [];

      const { data, error } = await supabase
        .from("fabrica_precos_produtos")
        .select("*")
        .eq("tabela_id", tabelaSelecionada.id)
        .eq("ativo", true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tabelaSelecionada && showImpacto,
  });

  // Aprovar tabela
  const aprovarMutation = useMutation({
    mutationFn: async () => {
      const ok = await verifyCurrentUserPassword(senhaAprovar);
      if (!ok) throw new Error("Senha incorreta. Confirme sua identidade para aprovar.");
      const { data: user } = await supabase.auth.getUser();

      // Atualizar status da tabela
      const { error: updateError } = await supabase
        .from("fabrica_tabelas_preco")
        .update({
          status: "approved",
          aprovado_por: user.user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", tabelaSelecionada.id);

      if (updateError) throw updateError;

      // Buscar última versão e atualizar como aprovada
      const { data: ultimaVersao } = await supabase
        .from("fabrica_tabelas_preco_versoes")
        .select("id")
        .eq("tabela_id", tabelaSelecionada.id)
        .is("aprovado_em", null)
        .order("versao", { ascending: false })
        .limit(1)
        .single();

      if (ultimaVersao) {
        await supabase
          .from("fabrica_tabelas_preco_versoes")
          .update({
            aprovado_por: user.user?.id,
            aprovado_em: new Date().toISOString(),
          } as any)
          .eq("id", ultimaVersao.id);
      }

      // Registrar na auditoria
      await supabase.from("fabrica_tabelas_preco_auditoria").insert({
        tabela_id: tabelaSelecionada.id,
        user_id: user.user?.id,
        acao: "approved",
        mensagem: "Tabela aprovada",
      });
    },
    onSuccess: () => {
      toast.success("Tabela aprovada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      queryClient.invalidateQueries({ queryKey: ["tabelas-preco"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-tabelas-preco"] });
      setShowAprovar(false);
      setSenhaAprovar("");
      setTabelaSelecionada(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao aprovar tabela");
    },
  });

  // Rejeitar tabela
  const rejeitarMutation = useMutation({
    mutationFn: async () => {
      const ok = await verifyCurrentUserPassword(senhaRejeitar);
      if (!ok) throw new Error("Senha incorreta. Confirme sua identidade para rejeitar.");
      const { data: user } = await supabase.auth.getUser();

      // Atualizar status da tabela
      const { error: updateError } = await supabase
        .from("fabrica_tabelas_preco")
        .update({
          status: "draft",
        })
        .eq("id", tabelaSelecionada.id);

      if (updateError) throw updateError;

      // Registrar na auditoria
      await supabase.from("fabrica_tabelas_preco_auditoria").insert({
        tabela_id: tabelaSelecionada.id,
        user_id: user.user?.id,
        acao: "rejected",
        mensagem: `Tabela rejeitada: ${motivoRejeicao}`,
      });
    },
    onSuccess: () => {
      toast.success("Tabela rejeitada. Retornou para rascunho.");
      queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      queryClient.invalidateQueries({ queryKey: ["tabelas-preco"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-tabelas-preco"] });
      setShowRejeitar(false);
      setSenhaRejeitar("");
      setTabelaSelecionada(null);
      setMotivoRejeicao("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao rejeitar tabela");
    },
  });

  // Mutation por LOTE (versão): aprovação ou rejeição cirúrgica que age só naquela submissão.
  const loteMutation = useMutation({
    mutationFn: async () => {
      if (!loteAcao) throw new Error("Sem lote selecionado");
      const ok = await verifyCurrentUserPassword(senhaLote);
      if (!ok) throw new Error("Senha incorreta. Confirme sua identidade para prosseguir.");
      if (loteAcao.tipo === "aprovar") {
        const { error } = await supabase.rpc("rpc_aprovar_lote_versao" as any, {
          p_versao_id: loteAcao.loteId,
        });
        if (error) throw error;
      } else {
        if (!motivoLote.trim()) throw new Error("Informe o motivo da rejeição.");
        const { error } = await supabase.rpc("rpc_rejeitar_lote_versao" as any, {
          p_versao_id: loteAcao.loteId,
          p_motivo: motivoLote,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(loteAcao?.tipo === "aprovar" ? "Lote aprovado" : "Lote rejeitado");
      queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-pendentes-por-tabela"] });
      queryClient.invalidateQueries({ queryKey: ["tabelas-preco"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-tabelas-preco"] });
      setLoteAcao(null);
      setSenhaLote("");
      setMotivoLote("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao processar lote");
    },
  });
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
      case "approved":
        return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Aprovada</Badge>;
      case "draft":
        return <Badge variant="secondary">Rascunho</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Aprovação de Tabelas de Preço</h1>
          <p className="text-muted-foreground">
            Revise e aprove tabelas de preço pendentes
          </p>
        </div>

        {/* KPI de Pendentes */}
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Aguardando Aprovação
            </CardTitle>
            <CardDescription>
              {tabelasPendentes?.length || 0} tabela(s) pendente(s)
            </CardDescription>
          </CardHeader>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando...
            </CardContent>
          </Card>
        ) : tabelasPendentes?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma tabela pendente de aprovação
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tabelasPendentes?.map((tabela) => (
              <Card key={tabela.id} className="border-l-4 border-l-yellow-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 mb-2">
                        {tabela.nome}
                        {getStatusBadge(tabela.status)}
                        <Badge variant="outline">{tabela.codigo}</Badge>
                      </CardTitle>
                      <CardDescription className="mb-2">
                        {tabela.descricao}
                      </CardDescription>
                      {tabela.tabela_base && (
                        <p className="text-sm text-muted-foreground">
                          Baseada em: <span className="font-medium">{tabela.tabela_base.nome}</span>
                        </p>
                      )}
                      {(tabela as any).criador && (
                        <p className="text-sm text-muted-foreground">
                          Criada por: <span className="font-medium">{(tabela as any).criador.nome}</span>
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Markup: {tabela.tipo_markup === "percentual" && `+${tabela.valor_markup}%`}
                        {tabela.tipo_markup === "multiplicador" && `x${tabela.valor_markup}`}
                        {tabela.tipo_markup === "valor_fixo" && `+${formatarMoeda(tabela.valor_markup)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setTabelaSelecionada(tabela); setShowImpacto(true); }}
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Ver Impacto
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setTabelaSelecionada(tabela); }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Histórico
                      </Button>
                    </div>
                  </div>

                  {/* Lotes (versões pendentes) — uma submissão = um lote */}
                  <div className="mt-4 space-y-3">
                    {(lotesPorTabela?.[tabela.id] || []).length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Nenhum lote registrado para esta tabela. Pode ser uma submissão antiga — abra "Ver Histórico".
                      </div>
                    ) : (
                      (lotesPorTabela?.[tabela.id] || []).map((lote) => (
                        <div key={lote.id} className="rounded-lg border bg-card p-3">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline">Lote v{lote.versao}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(lote.created_at).toLocaleString("pt-BR")}
                                </span>
                                {lote.criador_nome && (
                                  <span className="text-xs text-muted-foreground">
                                    · Submetido por <span className="font-medium text-foreground">{lote.criador_nome}</span>
                                  </span>
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  {lote.total} produto{lote.total !== 1 ? "s" : ""}
                                </Badge>
                                {!lote.escopoExplicito && (
                                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                    Escopo legado — rejeite e reenvie
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setLoteAcao({ tipo: "rejeitar", loteId: lote.id, descricao: `${tabela.nome} · v${lote.versao} (${lote.total} produto${lote.total !== 1 ? "s" : ""})` })}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rejeitar lote
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary"
                                onClick={() => {
                                  setTabelaSelecionada(tabela);
                                  setCascataEscopo(
                                    lote.produtos.map((p) => ({
                                      produto_id: p.id,
                                      produto_nome: p.nome,
                                      produto_codigo: p.codigo || "",
                                      custo_raiz: Number(p.preco_final ?? p.custo_base ?? 0) || 0,
                                    })),
                                  );
                                  setShowCascata(true);
                                }}
                              >
                                <Workflow className="h-4 w-4 mr-1" />
                                Cascata
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => setLoteAcao({ tipo: "aprovar", loteId: lote.id, descricao: `${tabela.nome} · v${lote.versao} (${lote.total} produto${lote.total !== 1 ? "s" : ""})` })}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Aprovar lote
                              </Button>
                            </div>
                          </div>
                          <div className="rounded border bg-muted/30 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/60">
                                <tr className="text-left">
                                  <th className="p-2">Produto</th>
                                  <th className="p-2 text-right">Custo Base</th>
                                  <th className="p-2 text-right">Preço Final</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lote.produtos.map((p) => (
                                  <tr key={p.id} className="border-t">
                                    <td className="p-2">
                                      <span className="font-medium">{p.nome}</span>
                                      {p.codigo && <span className="ml-1 text-muted-foreground">({p.codigo})</span>}
                                    </td>
                                    <td className="p-2 text-right">
                                      {p.custo_base != null ? formatarMoeda(Number(p.custo_base)) : "—"}
                                    </td>
                                    <td className="p-2 text-right font-semibold">
                                      {p.preco_final != null ? formatarMoeda(Number(p.preco_final)) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de Histórico de Versões */}
      <Dialog open={!!tabelaSelecionada && !showRejeitar && !showAprovar} onOpenChange={(open) => !open && setTabelaSelecionada(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Versões - {tabelaSelecionada?.nome}</DialogTitle>
            <DialogDescription>
              Visualize o histórico completo de alterações desta tabela
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {versoes?.map((versao) => (
              <Card key={versao.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Versão {versao.versao}</CardTitle>
                      <CardDescription>
                        Criada em {new Date(versao.created_at).toLocaleString("pt-BR")}
                      </CardDescription>
                      {(versao as any).aprovado_em && (
                        <p className="text-sm text-green-600 mt-1">
                          Aprovada em {new Date((versao as any).aprovado_em).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVersaoSelecionada(versao);
                        setShowPrecos(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Preços
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Preços da Versão */}
      <Dialog open={showPrecos} onOpenChange={setShowPrecos}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Preços - Versão {versaoSelecionada?.versao}
            </DialogTitle>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-right">
                    {tabelaSelecionada?.tabela_base_id ? "Preço Base" : "Custo Base"}
                  </th>
                  <th className="p-3 text-right">Preço Final</th>
                  <th className="p-3 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {precosVersao?.map((preco: any) => {
                  const referencia = preco.preco_tabela_base && preco.preco_tabela_base > 0
                    ? preco.preco_tabela_base
                    : preco.custo_base;
                  const margem = preco.margem_calculada ?? preco.margem_lucro_percentual ?? 0;
                  
                  return (
                    <tr key={preco.produto_id} className="border-t">
                      <td className="p-3">
                        <div>
                          <span className="font-medium">{preco.produto_nome}</span>
                          {preco.produto_codigo && preco.produto_codigo !== '-' && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({preco.produto_codigo})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">{formatarMoeda(referencia)}</td>
                      <td className="p-3 text-right font-semibold">{formatarMoeda(preco.preco_final)}</td>
                      <td className="p-3 text-right text-green-600">
                        {margem.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Análise de Impacto */}
      <Dialog open={showImpacto} onOpenChange={(open) => {
        setShowImpacto(open);
        if (!open) {
          setVersaoSelecionada(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Análise de Impacto - {tabelaSelecionada?.nome}
            </DialogTitle>
            <DialogDescription>
              Comparação detalhada das variações de preços
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="impacto" className="w-full">
            <TabsList>
              <TabsTrigger value="impacto">Simulador de Impacto</TabsTrigger>
              <TabsTrigger value="detalhes">Detalhes dos Preços</TabsTrigger>
            </TabsList>

            <TabsContent value="impacto" className="mt-4">
              <SimuladorImpactoPrecos
                precosAtuais={precosAtuais || []}
                precosNovos={precosVersao || []}
                tabela={tabelaSelecionada}
              />
            </TabsContent>

            <TabsContent value="detalhes" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Produto</th>
                      <th className="p-3 text-right">Custo Base</th>
                      <th className="p-3 text-right">Preço Final</th>
                      <th className="p-3 text-right">Margem</th>
                      <th className="p-3 text-center">Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precosVersao?.map((preco: any) => (
                      <tr key={preco.produto_id} className="border-t">
                        <td className="p-3">
                          <div>
                            <span className="font-medium">{preco.produto_nome}</span>
                            {preco.produto_codigo && preco.produto_codigo !== '-' && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({preco.produto_codigo})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">{formatarMoeda(preco.custo_base)}</td>
                        <td className="p-3 text-right font-semibold">{formatarMoeda(preco.preco_final)}</td>
                        <td className="p-3 text-right text-green-600">
                          {(preco.margem_lucro_percentual ?? preco.margem_lucro ?? 0).toFixed(2)}%
                        </td>
                        <td className="p-3 text-center">
                          <Button size="sm" variant="ghost" onClick={() =>
                            setShowOrigem({ produtoId: preco.produto_id, nome: preco.produto_nome, custo: Number(preco.custo_base) || 0 })
                          }>
                            <HistoryIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowImpacto(false)}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowImpacto(false);
                setShowRejeitar(true);
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rejeitar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setShowImpacto(false);
                setShowAprovar(true);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aprovar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Aprovação */}
      <AlertDialog open={showAprovar} onOpenChange={(o) => { setShowAprovar(o); if (!o) setSenhaAprovar(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Tabela de Preços</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja aprovar a tabela "{tabelaSelecionada?.nome}"?
              Esta ação não pode ser desfeita. Confirme sua senha para prosseguir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="senha-aprovar">Sua senha</Label>
            <Input
              id="senha-aprovar"
              type="password"
              autoComplete="current-password"
              value={senhaAprovar}
              onChange={(e) => setSenhaAprovar(e.target.value)}
              placeholder="Confirme sua identidade"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); aprovarMutation.mutate(); }}
              disabled={!senhaAprovar.trim() || aprovarMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {aprovarMutation.isPending ? "Aprovando..." : "Aprovar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Rejeição */}
      <AlertDialog open={showRejeitar} onOpenChange={(o) => { setShowRejeitar(o); if (!o) setSenhaRejeitar(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Tabela de Preços</AlertDialogTitle>
            <AlertDialogDescription>
              A tabela "{tabelaSelecionada?.nome}" retornará para status de rascunho.
              Por favor, informe o motivo da rejeição e confirme sua senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <Label htmlFor="motivo">Motivo da Rejeição</Label>
              <Textarea
                id="motivo"
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Ex: Preços muito altos, revisar margem do produto X..."
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="senha-rejeitar">Sua senha</Label>
              <Input
                id="senha-rejeitar"
                type="password"
                autoComplete="current-password"
                value={senhaRejeitar}
                onChange={(e) => setSenhaRejeitar(e.target.value)}
                placeholder="Confirme sua identidade"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); rejeitarMutation.mutate(); }}
              disabled={!motivoRejeicao.trim() || !senhaRejeitar.trim() || rejeitarMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejeitarMutation.isPending ? "Rejeitando..." : "Rejeitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aprovação em cascata */}
      <AprovacaoCascataDialog
        open={showCascata}
        onOpenChange={(v) => { setShowCascata(v); if (!v) setTabelaSelecionada(null); }}
        tabelaRaiz={tabelaSelecionada ? { id: tabelaSelecionada.id, nome: tabelaSelecionada.nome } : null}
        produtosEscopo={(precosVersao || []).map((p: any) => ({
          produto_id: p.produto_id,
          produto_nome: p.produto_nome || "",
          produto_codigo: p.produto_codigo || "",
          custo_raiz: Number(p.preco_final ?? p.custo_base) || 0,
        }))}
      />

      {/* Origem do custo */}
      <Dialog open={!!showOrigem} onOpenChange={(v) => !v && setShowOrigem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Origem do Custo — {showOrigem?.nome}</DialogTitle>
            <DialogDescription>
              Histórico de referências que originaram o custo desse produto.
            </DialogDescription>
          </DialogHeader>
          {showOrigem && (
            <OrigemCustoHistorico
              produtoId={showOrigem.produtoId}
              produtoNome={showOrigem.nome}
              custoPropostoAtual={showOrigem.custo}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Aprovar/Rejeitar LOTE específico */}
      <AlertDialog open={!!loteAcao} onOpenChange={(o) => { if (!o) { setLoteAcao(null); setSenhaLote(""); setMotivoLote(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {loteAcao?.tipo === "aprovar" ? "Aprovar lote" : "Rejeitar lote"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {loteAcao?.descricao}. {loteAcao?.tipo === "aprovar"
                ? "Esta ação aprova apenas os produtos deste lote. Confirme sua senha."
                : "O lote será descartado e os produtos voltam para a fila de submissão. Informe motivo e senha."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-3">
            {loteAcao?.tipo === "rejeitar" && (
              <div>
                <Label htmlFor="motivo-lote">Motivo</Label>
                <Textarea id="motivo-lote" rows={3} value={motivoLote} onChange={(e) => setMotivoLote(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="senha-lote">Sua senha</Label>
              <Input id="senha-lote" type="password" autoComplete="current-password" value={senhaLote} onChange={(e) => setSenhaLote(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); loteMutation.mutate(); }}
              disabled={!senhaLote.trim() || (loteAcao?.tipo === "rejeitar" && !motivoLote.trim()) || loteMutation.isPending}
              className={loteAcao?.tipo === "aprovar" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {loteMutation.isPending ? "Processando..." : loteAcao?.tipo === "aprovar" ? "Aprovar" : "Rejeitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}
