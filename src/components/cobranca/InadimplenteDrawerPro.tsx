// InadimplenteDrawer - Professional Collection Drawer Component
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  FileText, 
  Calendar,
  DollarSign,
  Clock,
  Handshake,
  Plus,
  User,
  Building2,
  History,
  Calculator,
  FileCode,
  Target
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ClienteScoring } from "./ClienteScoring";
import { TemplatesMensagem } from "./TemplatesMensagem";
import { AcordoCalculadora, AcordoCalculado } from "./AcordoCalculadora";

interface ContaVencida {
  id: string;
  cliente_codigo: string;
  cliente_nome: string;
  empresa_nome: string;
  numero_documento: string;
  parcela: number;
  valor_aberto: number;
  valor_original: number;
  data_vencimento: string;
  dias_atraso: number;
  vendedor_nome: string;
}

interface ClienteAgrupado {
  cliente_codigo: string;
  cliente_nome: string;
  total_aberto: number;
  total_titulos: number;
  dias_medio_atraso: number;
  maior_atraso: number;
  contas: ContaVencida[];
  ultima_cobranca?: {
    tipo_acao: string;
    data_acao: string;
    status: string;
  };
}

interface Props {
  cliente: ClienteAgrupado | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpenCliente360?: (clienteCodigo: string) => void;
}

export function InadimplenteDrawer({ cliente, open, onClose, onRefresh, onOpenCliente360 }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("resumo");
  const [novaAcao, setNovaAcao] = useState({
    tipo_acao: "",
    observacoes: "",
    data_retorno: "",
    status_resultado: "pendente"
  });

  // Query histórico de cobranças
  const { data: historico } = useQuery({
    queryKey: ['historico-cobrancas', cliente?.cliente_codigo],
    queryFn: async () => {
      if (!cliente) return [];
      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('cliente_codigo', cliente.cliente_codigo)
        .order('data_acao', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!cliente
  });

  // Query perfil do usuário
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user
  });

  const userName = (profile as any)?.nome_completo || (profile as any)?.full_name || user?.email || 'Usuário';

  // Mutation para registrar ação
  const registrarAcaoMutation = useMutation({
    mutationFn: async (data: typeof novaAcao) => {
      if (!cliente || !user) throw new Error("Dados incompletos");
      
      const { error } = await supabase.from('cobrancas').insert({
        cliente_codigo: cliente.cliente_codigo,
        tipo_acao: data.tipo_acao,
        observacoes: data.observacoes,
        data_retorno: data.data_retorno || null,
        responsavel_id: user.id,
        responsavel_nome: userName,
        status: data.status_resultado
      });
      
      if (error) throw error;

      // Registrar no histórico
      await supabase.from('historico_cobrancas').insert({
        cliente_codigo: cliente.cliente_codigo,
        tipo_evento: 'acao_registrada',
        descricao: `${data.tipo_acao}: ${data.observacoes}`,
        usuario_id: user.id,
        usuario_nome: userName
      });
    },
    onSuccess: () => {
      toast.success("Ação registrada com sucesso!");
      setNovaAcao({ tipo_acao: "", observacoes: "", data_retorno: "", status_resultado: "pendente" });
      queryClient.invalidateQueries({ queryKey: ['historico-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['ultimas-cobrancas'] });
      onRefresh();
    },
    onError: (error) => {
      toast.error("Erro ao registrar ação: " + error.message);
    }
  });

  // Mutation para registrar acordo
  const registrarAcordoMutation = useMutation({
    mutationFn: async (acordo: AcordoCalculado) => {
      if (!cliente || !user) throw new Error("Dados incompletos");
      
      const { error } = await supabase.from('cobrancas').insert({
        cliente_codigo: cliente.cliente_codigo,
        tipo_acao: 'acordo',
        observacoes: `Acordo de ${acordo.numeroParcelas}x de R$ ${acordo.valorParcela.toFixed(2)} (desconto de ${acordo.descontoPercentual}%)`,
        valor_acordo: acordo.valorFinal,
        parcelas_acordo: acordo.numeroParcelas,
        data_acordo: acordo.dataInicio,
        responsavel_id: user.id,
        responsavel_nome: userName,
        status: 'acordo'
      });
      
      if (error) throw error;

      // Registrar no histórico
      await supabase.from('historico_cobrancas').insert({
        cliente_codigo: cliente.cliente_codigo,
        tipo_evento: 'acordo_registrado',
        descricao: `Acordo de R$ ${acordo.valorFinal.toFixed(2)} em ${acordo.numeroParcelas}x (desconto: ${acordo.descontoPercentual}%)`,
        usuario_id: user.id,
        usuario_nome: userName
      });
    },
    onSuccess: () => {
      toast.success("Acordo registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['historico-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['acordos-ativos'] });
      setActiveTab("timeline");
      onRefresh();
    },
    onError: (error) => {
      toast.error("Erro ao registrar acordo: " + error.message);
    }
  });

  if (!cliente) return null;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getTipoAcaoIcon = (tipo: string) => {
    switch (tipo) {
      case 'telefone': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
      case 'acordo': return <Handshake className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'acordo': return <Badge className="bg-green-500">Acordo</Badge>;
      case 'contatado': return <Badge className="bg-blue-500">Contatado</Badge>;
      case 'promessa': return <Badge className="bg-purple-500">Promessa</Badge>;
      case 'sem_sucesso': return <Badge variant="destructive">Sem sucesso</Badge>;
      case 'nao_localizado': return <Badge variant="secondary">Não localizado</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${cliente.maior_atraso >= 90 ? 'bg-red-500' : cliente.maior_atraso >= 60 ? 'bg-orange-500' : 'bg-yellow-500'}`} />
              {cliente.cliente_nome}
            </SheetTitle>
            {onOpenCliente360 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onOpenCliente360(cliente.cliente_codigo)}
              >
                <Target className="h-4 w-4 mr-1" />
                Visão 360°
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {cliente.cliente_codigo}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {cliente.contas[0]?.empresa_nome || 'N/A'}
            </span>
          </div>
        </SheetHeader>

        {/* Resumo Cards */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b bg-muted/30">
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Total em Aberto</div>
              <div className="text-lg font-bold text-destructive">
                {formatCurrency(cliente.total_aberto)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Títulos</div>
              <div className="text-lg font-bold">{cliente.total_titulos}</div>
            </CardContent>
          </Card>
          <Card className="bg-orange-500/10 border-orange-500/30">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Maior Atraso</div>
              <div className="text-lg font-bold text-orange-600">{cliente.maior_atraso} dias</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-6 px-4 pt-2">
            <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
            <TabsTrigger value="titulos" className="text-xs">Títulos</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
            <TabsTrigger value="acao" className="text-xs">Nova Ação</TabsTrigger>
            <TabsTrigger value="acordo" className="text-xs">Acordo</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 p-4">
            {/* Resumo com Scoring */}
            <TabsContent value="resumo" className="mt-0 space-y-4">
              <ClienteScoring cliente={cliente} />
              
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Último Contato
                  </h4>
                  {historico && historico.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{historico[0].tipo_acao}</span>
                        {getStatusBadge(historico[0].status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{historico[0].observacoes}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(historico[0].data_acao), 'dd/MM/yyyy HH:mm', { locale: ptBR })} - {historico[0].responsavel_nome}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum contato registrado</p>
                  )}
                </CardContent>
              </Card>

              {/* Ações Rápidas */}
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("acao")}>
                  <Phone className="h-5 w-5" />
                  <span className="text-xs">Ligar</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("templates")}>
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-xs">WhatsApp</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("acordo")}>
                  <Calculator className="h-5 w-5" />
                  <span className="text-xs">Acordo</span>
                </Button>
              </div>
            </TabsContent>

            {/* Títulos Vencidos */}
            <TabsContent value="titulos" className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cliente.contas.map((conta) => (
                    <TableRow key={conta.id}>
                      <TableCell className="font-medium">
                        {conta.numero_documento}/{conta.parcela}
                      </TableCell>
                      <TableCell>
                        {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={conta.dias_atraso >= 90 ? "destructive" : conta.dias_atraso >= 60 ? "secondary" : "outline"}>
                          {conta.dias_atraso} dias
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(conta.valor_aberto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Timeline */}
            <TabsContent value="timeline" className="mt-0">
              {historico && historico.length > 0 ? (
                <div className="space-y-4">
                  {historico.map((acao) => (
                    <div key={acao.id} className="flex gap-4 border-l-2 border-muted pl-4 pb-4">
                      <div className="flex-shrink-0 mt-1">
                        {getTipoAcaoIcon(acao.tipo_acao)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{acao.tipo_acao}</span>
                          {getStatusBadge(acao.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{acao.observacoes}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(acao.data_acao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                          {acao.responsavel_nome && <span>por {acao.responsavel_nome}</span>}
                          {acao.data_retorno && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Retorno: {format(new Date(acao.data_retorno), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        {acao.valor_acordo && (
                          <div className="mt-2 p-2 bg-green-500/10 rounded text-sm">
                            <DollarSign className="h-4 w-4 inline mr-1" />
                            Acordo: {formatCurrency(acao.valor_acordo)}
                            {acao.parcelas_acordo && ` em ${acao.parcelas_acordo}x`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma ação de cobrança registrada</p>
                </div>
              )}
            </TabsContent>

            {/* Nova Ação */}
            <TabsContent value="acao" className="mt-0">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label>Tipo de Ação</Label>
                    <Select 
                      value={novaAcao.tipo_acao} 
                      onValueChange={(v) => setNovaAcao(prev => ({ ...prev, tipo_acao: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="telefone">📞 Telefone</SelectItem>
                        <SelectItem value="email">📧 E-mail</SelectItem>
                        <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                        <SelectItem value="sms">📱 SMS</SelectItem>
                        <SelectItem value="carta">📄 Carta</SelectItem>
                        <SelectItem value="visita">🏢 Visita</SelectItem>
                        <SelectItem value="outro">📝 Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Resultado</Label>
                    <Select 
                      value={novaAcao.status_resultado} 
                      onValueChange={(v) => setNovaAcao(prev => ({ ...prev, status_resultado: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contatado">✅ Contatado</SelectItem>
                        <SelectItem value="promessa">🤝 Promessa de Pagamento</SelectItem>
                        <SelectItem value="sem_sucesso">❌ Sem Sucesso</SelectItem>
                        <SelectItem value="nao_localizado">❓ Não Localizado</SelectItem>
                        <SelectItem value="recado">📝 Deixou Recado</SelectItem>
                        <SelectItem value="pendente">⏳ Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea 
                      placeholder="Descreva a ação realizada..."
                      value={novaAcao.observacoes}
                      onChange={(e) => setNovaAcao(prev => ({ ...prev, observacoes: e.target.value }))}
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label>Data de Retorno (opcional)</Label>
                    <Input 
                      type="date"
                      value={novaAcao.data_retorno}
                      onChange={(e) => setNovaAcao(prev => ({ ...prev, data_retorno: e.target.value }))}
                    />
                  </div>

                  <Button 
                    className="w-full"
                    disabled={!novaAcao.tipo_acao || !novaAcao.observacoes || registrarAcaoMutation.isPending}
                    onClick={() => registrarAcaoMutation.mutate(novaAcao)}
                  >
                    {registrarAcaoMutation.isPending ? "Registrando..." : "Registrar Ação"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Acordo */}
            <TabsContent value="acordo" className="mt-0">
              <AcordoCalculadora 
                valorOriginal={cliente.total_aberto}
                diasAtraso={cliente.maior_atraso}
                onConfirmarAcordo={(acordo) => registrarAcordoMutation.mutate(acordo)}
              />
            </TabsContent>

            {/* Templates */}
            <TabsContent value="templates" className="mt-0">
              <TemplatesMensagem 
                cliente={{
                  nome: cliente.cliente_nome,
                  codigo: cliente.cliente_codigo,
                  totalAberto: cliente.total_aberto,
                  diasAtraso: cliente.maior_atraso,
                  titulos: cliente.total_titulos
                }}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
