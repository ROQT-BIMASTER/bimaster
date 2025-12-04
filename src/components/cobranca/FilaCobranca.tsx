import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Clock,
  AlertTriangle,
  ArrowRight,
  Target,
  TrendingUp,
  Calendar
} from "lucide-react";
import { format, differenceInDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClienteNaFila {
  cliente_codigo: string;
  cliente_nome: string;
  total_aberto: number;
  total_titulos: number;
  maior_atraso: number;
  score: number;
  prioridade: 'critical' | 'high' | 'medium' | 'low';
  ultima_cobranca?: {
    tipo_acao: string;
    data_acao: string;
    data_retorno?: string;
    status: string;
  };
}

interface Props {
  clientes: ClienteNaFila[];
  onSelectCliente: (cliente: ClienteNaFila) => void;
  metaDiaria?: number;
  contatosHoje?: number;
}

export function FilaCobranca({ clientes, onSelectCliente, metaDiaria = 20, contatosHoje = 0 }: Props) {
  // Ordenar por prioridade e score
  const filaOrdenada = useMemo(() => {
    const prioridadeOrdem = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...clientes].sort((a, b) => {
      const prioA = prioridadeOrdem[a.prioridade];
      const prioB = prioridadeOrdem[b.prioridade];
      if (prioA !== prioB) return prioA - prioB;
      return b.score - a.score;
    });
  }, [clientes]);

  // Clientes com retorno agendado para hoje
  const retornosHoje = useMemo(() => {
    return filaOrdenada.filter(c => 
      c.ultima_cobranca?.data_retorno && 
      isToday(new Date(c.ultima_cobranca.data_retorno))
    );
  }, [filaOrdenada]);

  // Clientes com retorno em atraso
  const retornosAtrasados = useMemo(() => {
    return filaOrdenada.filter(c => 
      c.ultima_cobranca?.data_retorno && 
      isPast(new Date(c.ultima_cobranca.data_retorno)) &&
      !isToday(new Date(c.ultima_cobranca.data_retorno))
    );
  }, [filaOrdenada]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const getPrioridadeStyle = (prioridade: string) => {
    switch (prioridade) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-green-500';
    }
  };

  const getTipoAcaoIcon = (tipo?: string) => {
    switch (tipo) {
      case 'telefone': return Phone;
      case 'email': return Mail;
      case 'whatsapp': return MessageCircle;
      default: return Clock;
    }
  };

  const progressoDiario = Math.min(100, (contatosHoje / metaDiaria) * 100);

  return (
    <div className="space-y-4">
      {/* Progresso do Dia */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">Meta do Dia</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {contatosHoje}/{metaDiaria} contatos
            </span>
          </div>
          <Progress value={progressoDiario} className="h-2" />
          {progressoDiario >= 100 && (
            <div className="flex items-center gap-2 mt-2 text-green-600 text-sm">
              <TrendingUp className="h-4 w-4" />
              Meta atingida! Continue assim!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas de Retorno */}
      {(retornosHoje.length > 0 || retornosAtrasados.length > 0) && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
              <Calendar className="h-4 w-4" />
              Retornos Agendados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {retornosAtrasados.length > 0 && (
              <div className="p-2 bg-destructive/10 rounded-md">
                <span className="text-sm text-destructive font-medium">
                  {retornosAtrasados.length} retorno(s) em atraso
                </span>
              </div>
            )}
            {retornosHoje.length > 0 && (
              <div className="p-2 bg-orange-500/10 rounded-md">
                <span className="text-sm text-orange-600 font-medium">
                  {retornosHoje.length} retorno(s) para hoje
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fila Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Fila de Cobrança
            </span>
            <Badge variant="outline">{filaOrdenada.length} clientes</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="space-y-1 p-4">
              {filaOrdenada.map((cliente, index) => {
                const Icon = getTipoAcaoIcon(cliente.ultima_cobranca?.tipo_acao);
                const temRetornoHoje = cliente.ultima_cobranca?.data_retorno && 
                  isToday(new Date(cliente.ultima_cobranca.data_retorno));
                const temRetornoAtrasado = cliente.ultima_cobranca?.data_retorno && 
                  isPast(new Date(cliente.ultima_cobranca.data_retorno)) &&
                  !isToday(new Date(cliente.ultima_cobranca.data_retorno));

                return (
                  <div
                    key={cliente.cliente_codigo}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                      temRetornoAtrasado ? 'border-destructive/50 bg-destructive/5' :
                      temRetornoHoje ? 'border-orange-500/50 bg-orange-500/5' : ''
                    }`}
                    onClick={() => onSelectCliente(cliente)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Posição e Prioridade */}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        <div className={`w-2 h-2 rounded-full ${getPrioridadeStyle(cliente.prioridade)}`} />
                      </div>

                      {/* Info Principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{cliente.cliente_nome}</span>
                          {cliente.prioridade === 'critical' && (
                            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{cliente.total_titulos} título(s)</span>
                          <span>•</span>
                          <span>{cliente.maior_atraso} dias</span>
                          {cliente.ultima_cobranca && (
                            <>
                              <span>•</span>
                              <Icon className="h-3 w-3" />
                              <span>
                                {format(new Date(cliente.ultima_cobranca.data_acao), 'dd/MM', { locale: ptBR })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Valor e Ação */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-destructive">
                          {formatCurrency(cliente.total_aberto)}
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 px-2 mt-1">
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Indicador de retorno */}
                    {(temRetornoHoje || temRetornoAtrasado) && (
                      <div className={`mt-2 text-xs flex items-center gap-1 ${
                        temRetornoAtrasado ? 'text-destructive' : 'text-orange-600'
                      }`}>
                        <Calendar className="h-3 w-3" />
                        {temRetornoAtrasado ? 'Retorno atrasado!' : 'Retorno agendado para hoje'}
                      </div>
                    )}
                  </div>
                );
              })}

              {filaOrdenada.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum cliente na fila</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
