import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CallMessage } from '@/utils/RealtimeAudioCall';
import { Bot, User } from 'lucide-react';

interface LiveTranscriptionProps {
  messages: CallMessage[];
}

const LiveTranscription = ({ messages }: LiveTranscriptionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTimestamp = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="flex-1 p-4 overflow-hidden flex flex-col">
      <div className="mb-2 pb-2 border-b">
        <h3 className="font-semibold text-sm">Transcrição ao vivo</h3>
      </div>
      
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-3 pr-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aguardando início da conversa...</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === 'ai' ? 'flex-row' : 'flex-row-reverse'
                }`}
              >
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  message.role === 'ai' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-secondary-foreground'
                }`}>
                  {message.role === 'ai' ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                
                <div className={`flex-1 ${
                  message.role === 'ai' ? 'text-left' : 'text-right'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {message.role === 'ai' ? 'Assistente IA' : 'Prospect'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <div className={`inline-block px-3 py-2 rounded-lg text-sm ${
                    message.role === 'ai'
                      ? 'bg-primary/10 text-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {message.content}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default LiveTranscription;
