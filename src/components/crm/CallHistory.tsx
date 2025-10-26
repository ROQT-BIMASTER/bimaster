import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, Calendar, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Call {
  id: string;
  created_at: string;
  call_duration: number;
  call_status: string;
  sentiment: string;
  meeting_scheduled: boolean;
  meeting_date: string | null;
  transcript: string;
  prospect: {
    nome_empresa: string;
    contato_principal: string;
  };
}

interface CallHistoryProps {
  prospectId?: string;
}

const CallHistory = ({ prospectId }: CallHistoryProps) => {
  const { toast } = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  useEffect(() => {
    fetchCalls();
  }, [prospectId]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('ai_calls')
        .select(`
          *,
          prospect:prospects!ai_calls_prospect_id_fkey(nome_empresa, contato_principal)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (prospectId) {
        query = query.eq('prospect_id', prospectId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setCalls(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      toast({
        title: "Erro ao carregar histórico",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    const variants = {
      positive: 'default',
      negative: 'destructive',
      neutral: 'secondary'
    } as const;
    
    const labels = {
      positive: 'Positivo',
      negative: 'Negativo',
      neutral: 'Neutro'
    };

    return (
      <Badge variant={variants[sentiment as keyof typeof variants] || 'secondary'}>
        {labels[sentiment as keyof typeof labels] || sentiment}
      </Badge>
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}min ${secs}s`;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          Carregando histórico...
        </div>
      </Card>
    );
  }

  if (calls.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhuma ligação registrada ainda</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Phone className="h-5 w-5" />
        Histórico de Ligações com IA
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-medium mb-4">Ligações Recentes</h3>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                    selectedCall?.id === call.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedCall(call)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium">{call.prospect.nome_empresa}</div>
                      <div className="text-sm text-muted-foreground">
                        {call.prospect.contato_principal}
                      </div>
                    </div>
                    {getSentimentIcon(call.sentiment)}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(call.call_duration || 0)}
                    </span>
                    <span>
                      {format(new Date(call.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    {getSentimentBadge(call.sentiment)}
                    {call.meeting_scheduled && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Reunião agendada
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="p-4">
          {selectedCall ? (
            <>
              <h3 className="font-medium mb-4">Detalhes da Ligação</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Prospect
                  </div>
                  <div className="font-medium">{selectedCall.prospect.nome_empresa}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedCall.prospect.contato_principal}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Data e Duração
                  </div>
                  <div className="text-sm">
                    {format(new Date(selectedCall.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  <div className="text-sm">
                    Duração: {formatDuration(selectedCall.call_duration || 0)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Sentimento
                  </div>
                  {getSentimentBadge(selectedCall.sentiment)}
                </div>

                {selectedCall.meeting_scheduled && selectedCall.meeting_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Reunião Agendada
                    </div>
                    <div className="text-sm">
                      {format(new Date(selectedCall.meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                )}

                {selectedCall.transcript && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Transcrição
                    </div>
                    <ScrollArea className="h-[200px] rounded-md border p-3">
                      <div className="text-sm whitespace-pre-wrap">
                        {selectedCall.transcript}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Selecione uma ligação para ver os detalhes
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CallHistory;
