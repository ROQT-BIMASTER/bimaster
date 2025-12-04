import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Check,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
}

interface Props {
  cliente: ClienteAgrupado | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function InadimplenteDrawer({ cliente, open, onClose, onRefresh }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("titulos");
  const [novaAcao, setNovaAcao] = useState({
    tipo_acao: "",
    observacoes: "",
    data_retorno: ""
  });
  const [novoAcordo, setNovoAcordo] = useState({
    valor_acordo: "",
    parcelas_acordo: "",
    data_acordo: ""
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
        status: 'pendente'
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
      setNovaAcao({ tipo_acao: "", observacoes: "", data_retorno: "" });
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
    mutationFn: async (data: typeof novoAcordo) => {
      if (!cliente || !user) throw new Error("Dados incompletos");
      
      const { error } = await supabase.from('cobrancas').insert({
        cliente_codigo: cliente.cliente_codigo,
        tipo_acao: 'acordo',
        observacoes: `Acordo de ${data.parcelas_acordo}x de R$ ${(parseFloat(data.valor_acordo) / parseInt(data.parcelas_acordo)).toFixed(2)}`,
        valor_acordo: parseFloat(data.valor_acordo),
        parcelas_acordo: parseInt(data.parcelas_acordo),
        data_acordo: data.data_acordo || null,
        responsavel_id: user.id,
        responsavel_nome: userName,
        status: 'acordo'
      });
      
      if (error) throw error;

      // Registrar no histórico
      await supabase.from('historico_cobrancas').insert({
        cliente_codigo: cliente.cliente_codigo,
        tipo_evento: 'acordo_registrado',
        descricao: `Acordo de R$ ${data.valor_acordo} em ${data.parcelas_acordo}x`,
        usuario_id: user.id,
        usuario_nome: userName
      });
    },
    onSuccess: () => {
      toast.success("Acordo registrado com sucesso!");
      setNovoAcordo({ valor_acordo: "", parcelas_acordo: "", data_acordo: "" });
      queryClient.invalidateQueries({ queryKey: ['historico-cobrancas'] });
      onRefresh();
    },
    onError: (error) => {
      toast.error("Erro ao registrar acordo: " + error.message);
    }
  });

  if (!cliente) return null;

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
      case 'sem_sucesso': return <Badge variant="destructive">Sem sucesso</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${cliente.maior_atraso >= 90 ? 'bg-red-500' : cliente.maior_atraso >= 60 ? 'bg-orange-500' : 'bg-yellow-500'}`} />
            {cliente.cliente_nome}
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            Código: {cliente.cliente_codigo}
          </div>
        </SheetHeader>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total em Aberto</div>
              <div className="text-xl font-bold text-destructive">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.total_aberto)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Títulos Vencidos</div>
              <div className="text-xl font-bold">{cliente.total_titulos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Maior Atraso</div>
              <div className="text-xl font-bold">{cliente.maior_atraso} dias</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="titulos">Títulos</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="acao">Nova Ação</TabsTrigger>
            <TabsTrigger value="acordo">Acordo</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
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
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_aberto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Timeline de Cobranças */}
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
                          {acao.responsavel_nome && (
                            <span>por {acao.responsavel_nome}</span>
                          )}
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
                            Acordo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acao.valor_acordo)}
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
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Registrar Nova Ação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        <SelectItem value="carta">📄 Carta</SelectItem>
                        <SelectItem value="visita">🏢 Visita</SelectItem>
                        <SelectItem value="outro">📝 Outro</SelectItem>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Handshake className="h-5 w-5" />
                    Registrar Acordo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Valor do Acordo</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={novoAcordo.valor_acordo}
                      onChange={(e) => setNovoAcordo(prev => ({ ...prev, valor_acordo: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Dívida total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.total_aberto)}
                    </p>
                  </div>

                  <div>
                    <Label>Número de Parcelas</Label>
                    <Select 
                      value={novoAcordo.parcelas_acordo}
                      onValueChange={(v) => setNovoAcordo(prev => ({ ...prev, parcelas_acordo: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {novoAcordo.valor_acordo && novoAcordo.parcelas_acordo && (
                      <p className="text-sm text-green-600 mt-1">
                        = {parseInt(novoAcordo.parcelas_acordo)}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(novoAcordo.valor_acordo) / parseInt(novoAcordo.parcelas_acordo))}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Primeiro Vencimento</Label>
                    <Input 
                      type="date"
                      value={novoAcordo.data_acordo}
                      onChange={(e) => setNovoAcordo(prev => ({ ...prev, data_acordo: e.target.value }))}
                    />
                  </div>

                  <Button 
                    className="w-full"
                    variant="default"
                    disabled={!novoAcordo.valor_acordo || !novoAcordo.parcelas_acordo || registrarAcordoMutation.isPending}
                    onClick={() => registrarAcordoMutation.mutate(novoAcordo)}
                  >
                    {registrarAcordoMutation.isPending ? "Registrando..." : "Registrar Acordo"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
