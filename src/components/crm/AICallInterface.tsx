import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { RealtimeAudioCall, CallMessage } from '@/utils/RealtimeAudioCall';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LiveTranscription from './LiveTranscription';

interface AICallInterfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName: string;
}

const AICallInterface = ({ open, onOpenChange, prospectId, prospectName }: AICallInterfaceProps) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>('idle');
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const callRef = useRef<RealtimeAudioCall | null>(null);

  const handleStartCall = async () => {
    try {
      setStatus('initializing');
      setMessages([]);

      // Criar sessão via Edge Function
      const { data, error } = await supabase.functions.invoke('realtime-call-session', {
        body: { prospectId }
      });

      if (error) throw error;

      console.log('Sessão criada:', data);
      setCallId(data.callId);

      // Iniciar ligação
      callRef.current = new RealtimeAudioCall(
        (message) => {
          setMessages(prev => [...prev, message]);
        },
        (newStatus) => {
          setStatus(newStatus);
        },
        (speaking) => {
          setAiSpeaking(speaking);
        }
      );

      await callRef.current.startCall(data.callId, data.client_secret.value);

      toast({
        title: "Ligação iniciada",
        description: `Conectado com ${prospectName}`,
      });

    } catch (error) {
      console.error('Erro ao iniciar ligação:', error);
      toast({
        title: "Erro ao iniciar ligação",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
      setStatus('error');
    }
  };

  const handleEndCall = async () => {
    if (!callRef.current || !callId) return;

    try {
      setStatus('finalizing');

      const result = callRef.current.endCall();

      // Processar resultado via Edge Function
      const { error } = await supabase.functions.invoke('process-call-result', {
        body: {
          callId,
          duration: result.duration,
          transcript: result.transcript,
          actions: result.actions,
          sentiment: 'neutral', // Poderia ser analisado pela IA
          meetingScheduled: result.actions.some(a => a.type === 'schedule_meeting'),
          meetingDate: result.actions.find(a => a.type === 'schedule_meeting')?.data?.date
        }
      });

      if (error) {
        console.error('Erro ao processar resultado:', error);
      }

      toast({
        title: "Ligação encerrada",
        description: `Duração: ${Math.floor(result.duration / 60)}min ${result.duration % 60}s`,
      });

      onOpenChange(false);
      setStatus('idle');
      setMessages([]);
      setCallId(null);
      callRef.current = null;

    } catch (error) {
      console.error('Erro ao encerrar ligação:', error);
      toast({
        title: "Erro ao encerrar ligação",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Implementar lógica de mute no AudioRecorder se necessário
  };

  useEffect(() => {
    return () => {
      if (callRef.current) {
        callRef.current.endCall();
      }
    };
  }, []);

  const isCallActive = ['connecting', 'connected'].includes(status);
  const isProcessing = ['initializing', 'finalizing'].includes(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Ligação com IA - {prospectName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Status da ligação */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${
                  status === 'connected' ? 'bg-green-500 animate-pulse' :
                  status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  status === 'error' ? 'bg-red-500' :
                  'bg-gray-400'
                }`} />
                <span className="font-medium">
                  {status === 'idle' && 'Pronto para ligar'}
                  {status === 'initializing' && 'Inicializando...'}
                  {status === 'connecting' && 'Conectando...'}
                  {status === 'connected' && 'Ligação ativa'}
                  {status === 'finalizing' && 'Finalizando...'}
                  {status === 'error' && 'Erro na conexão'}
                </span>
              </div>

              {aiSpeaking && (
                <div className="flex items-center gap-2 text-primary">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm">IA falando...</span>
                </div>
              )}
            </div>
          </Card>

          {/* Transcrição ao vivo */}
          <LiveTranscription messages={messages} />

          {/* Controles */}
          <Card className="p-4">
            <div className="flex items-center justify-center gap-4">
              {!isCallActive && !isProcessing && (
                <Button
                  size="lg"
                  onClick={handleStartCall}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Phone className="h-5 w-5" />
                  Iniciar Ligação
                </Button>
              )}

              {isCallActive && (
                <>
                  <Button
                    size="lg"
                    variant={isMuted ? "destructive" : "outline"}
                    onClick={toggleMute}
                    className="gap-2"
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    {isMuted ? 'Desmutar' : 'Mutar'}
                  </Button>

                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleEndCall}
                    className="gap-2"
                  >
                    <PhoneOff className="h-5 w-5" />
                    Encerrar Ligação
                  </Button>
                </>
              )}

              {isProcessing && (
                <Button size="lg" disabled className="gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processando...
                </Button>
              )}
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AICallInterface;
