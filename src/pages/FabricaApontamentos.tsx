import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, PauseCircle, StopCircle, AlertCircle, Clock, Settings, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CronometroProducao } from "@/components/fabrica/CronometroProducao";

export default function FabricaApontamentos() {
  const queryClient = useQueryClient();
  const [selectedOP, setSelectedOP] = useState<string>("");
  const [selectedMaquina, setSelectedMaquina] = useState<string>("");
  const [selectedOperador, setSelectedOperador] = useState<string>("");
  const [quantidade, setQuantidade] = useState("");
  const [quantidadeRefugo, setQuantidadeRefugo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [tempoProducao, setTempoProducao] = useState<number>(0);

  // Buscar OPs ativas
  const { data: ops, isLoading: loadingOPs } = useQuery({
    queryKey: ["fabrica-ops-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_ordens_producao")
        .select(`
          *,
          fabrica_produtos(nome, codigo),
          fabrica_maquinas(nome),
          fabrica_operadores(nome)
        `)
        .in("status", ["pendente", "em_producao"])
        .order("data_prevista", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Buscar máquinas ativas
  const { data: maquinas } = useQuery({
    queryKey: ["fabrica-maquinas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_maquinas")
        .select("*")
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  // Buscar operadores ativos
  const { data: operadores } = useQuery({
    queryKey: ["fabrica-operadores-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_operadores")
        .select("*")
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  // Buscar último apontamento da OP selecionada
  const { data: ultimoApontamento } = useQuery({
    queryKey: ["ultimo-apontamento", selectedOP],
    queryFn: async () => {
      if (!selectedOP) return null;
      
      const { data, error } = await supabase
        .from("fabrica_apontamentos")
        .select("*")
        .eq("ordem_producao_id", selectedOP)
        .order("timestamp_evento", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!selectedOP,
  });

  // Mutation para criar apontamento
  const criarApontamento = useMutation({
    mutationFn: async (dados: {
      ordem_producao_id: string;
      tipo: string;
      quantidade_apontada?: number;
      quantidade_refugo?: number;
      observacoes?: string;
      maquina_id?: string;
      duracao_minutos?: number;
    }) => {
      const { data: session } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("fabrica_apontamentos")
        .insert({
          ...dados,
          operador_id: selectedOperador || null,
          created_by: session.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-ops-ativas"] });
      queryClient.invalidateQueries({ queryKey: ["ultimo-apontamento", variables.ordem_producao_id] });
      toast.success("Apontamento registrado com sucesso!");
      setQuantidade("");
      setQuantidadeRefugo("");
      setObservacoes("");
    },
    onError: () => {
      toast.error("Erro ao registrar apontamento");
    },
  });

  const handleIniciar = useCallback(() => {
    if (!selectedOP) {
      toast.error("Selecione uma ordem de produção");
      return;
    }
    if (!selectedMaquina) {
      toast.error("Selecione uma máquina");
      return;
    }
    if (!selectedOperador) {
      toast.error("Selecione um operador");
      return;
    }
    criarApontamento.mutate({
      ordem_producao_id: selectedOP,
      tipo: "inicio",
      maquina_id: selectedMaquina,
    });
  }, [selectedOP, selectedMaquina, selectedOperador]);

  const handlePausar = useCallback(() => {
    if (!selectedOP) {
      toast.error("Selecione uma ordem de produção");
      return;
    }
    criarApontamento.mutate({
      ordem_producao_id: selectedOP,
      tipo: "pausa",
      observacoes: observacoes || undefined,
      maquina_id: selectedMaquina || undefined,
    });
  }, [selectedOP, selectedMaquina, observacoes]);

  const handleRetomar = useCallback(() => {
    if (!selectedOP) {
      toast.error("Selecione uma ordem de produção");
      return;
    }
    criarApontamento.mutate({
      ordem_producao_id: selectedOP,
      tipo: "retomada",
      maquina_id: selectedMaquina || undefined,
    });
  }, [selectedOP, selectedMaquina]);

  const handleFinalizar = useCallback((tempoTotalMinutos: number) => {
    if (!selectedOP) {
      toast.error("Selecione uma ordem de produção");
      return;
    }

    const qtd = parseFloat(quantidade);
    const qtdRefugo = quantidadeRefugo ? parseFloat(quantidadeRefugo) : 0;

    if (!quantidade || isNaN(qtd) || qtd <= 0) {
      toast.error("Informe a quantidade produzida");
      return;
    }

    criarApontamento.mutate({
      ordem_producao_id: selectedOP,
      tipo: "finalizacao",
      quantidade_apontada: qtd,
      quantidade_refugo: qtdRefugo,
      observacoes: observacoes || undefined,
      maquina_id: selectedMaquina || undefined,
      duracao_minutos: tempoTotalMinutos,
    });
    
    setTempoProducao(tempoTotalMinutos);
  }, [selectedOP, selectedMaquina, quantidade, quantidadeRefugo, observacoes]);

  const opSelecionada = ops?.find((op) => op.id === selectedOP);
  const emProducao = ultimoApontamento?.tipo === "inicio" || ultimoApontamento?.tipo === "retomada";
  const emPausa = ultimoApontamento?.tipo === "pausa";

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-3xl font-bold">Apontamento de Produção</h1>
          <p className="text-muted-foreground">
            Registre o andamento da produção em tempo real
          </p>
        </div>

        {/* Seleção de OP, Máquina e Operador */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração de Produção</CardTitle>
            <CardDescription>Selecione OP, máquina e operador</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Ordem de Produção *</Label>
              <Select value={selectedOP} onValueChange={setSelectedOP}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma OP" />
                </SelectTrigger>
                <SelectContent>
                  {loadingOPs && <SelectItem value="loading">Carregando...</SelectItem>}
                  {ops?.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      OP {op.numero} - {op.fabrica_produtos?.nome} (
                      {op.quantidade_planejada} un)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Máquina *
                </Label>
                <Select value={selectedMaquina} onValueChange={setSelectedMaquina}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma máquina" />
                  </SelectTrigger>
                  <SelectContent>
                    {maquinas?.map((maq) => (
                      <SelectItem key={maq.id} value={maq.id}>
                        {maq.codigo} - {maq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Operador *
                </Label>
                <Select value={selectedOperador} onValueChange={setSelectedOperador}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {operadores?.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.matricula} - {op.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {opSelecionada && (
              <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={opSelecionada.status === "em_producao" ? "default" : "secondary"}>
                    {opSelecionada.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Produto:</span>
                  <span className="text-sm">{opSelecionada.fabrica_produtos?.codigo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Quantidade:</span>
                  <span className="text-sm">{opSelecionada.quantidade_planejada} un</span>
                </div>
                {ultimoApontamento && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">
                      Último apontamento:{" "}
                      {formatDistanceToNow(new Date(ultimoApontamento.timestamp_evento), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cronômetro de Produção */}
        {selectedOP && selectedMaquina && selectedOperador && (
          <CronometroProducao
            opId={selectedOP}
            onIniciar={handleIniciar}
            onPausar={handlePausar}
            onRetomar={handleRetomar}
            onFinalizar={handleFinalizar}
            loading={criarApontamento.isPending}
          />
        )}

        {/* Formulário de Finalização */}
        {selectedOP && emProducao && (
          <Card>
            <CardHeader>
              <CardTitle>Registro de Produção</CardTitle>
              <CardDescription>Informe as quantidades ao finalizar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade Produzida *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  step="0.001"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Ex: 100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refugo">Quantidade Refugo</Label>
                <Input
                  id="refugo"
                  type="number"
                  step="0.001"
                  value={quantidadeRefugo}
                  onChange={(e) => setQuantidadeRefugo(e.target.value)}
                  placeholder="Ex: 5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs">Observações</Label>
                <Textarea
                  id="obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações sobre a produção..."
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span>Preencha os dados e clique em "Finalizar" no cronômetro acima.</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
