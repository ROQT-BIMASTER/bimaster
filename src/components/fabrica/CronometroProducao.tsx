import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, PauseCircle, StopCircle, Clock } from "lucide-react";

interface CronometroProducaoProps {
  opId: string;
  onIniciar: () => void;
  onPausar: () => void;
  onRetomar: () => void;
  onFinalizar: (tempoTotal: number) => void;
  loading?: boolean;
}

export function CronometroProducao({
  opId,
  onIniciar,
  onPausar,
  onRetomar,
  onFinalizar,
  loading = false,
}: CronometroProducaoProps) {
  const [status, setStatus] = useState<"parado" | "rodando" | "pausado">("parado");
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [tempoInicio, setTempoInicio] = useState<number | null>(null);
  const [tempoPausas, setTempoPausas] = useState(0);
  const [ultimaPausa, setUltimaPausa] = useState<number | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (status === "rodando" && tempoInicio) {
      interval = setInterval(() => {
        const agora = Date.now();
        const decorrido = Math.floor((agora - tempoInicio - tempoPausas) / 1000);
        setTempoDecorrido(decorrido);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, tempoInicio, tempoPausas]);

  const formatarTempo = (segundos: number) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segs).padStart(2, "0")}`;
  };

  const handleIniciar = useCallback(() => {
    setStatus("rodando");
    setTempoInicio(Date.now());
    setTempoDecorrido(0);
    setTempoPausas(0);
    onIniciar();
  }, [onIniciar]);

  const handlePausar = useCallback(() => {
    setStatus("pausado");
    setUltimaPausa(Date.now());
    onPausar();
  }, [onPausar]);

  const handleRetomar = useCallback(() => {
    if (ultimaPausa) {
      const duracaoPausa = Date.now() - ultimaPausa;
      setTempoPausas((prev) => prev + duracaoPausa);
    }
    setStatus("rodando");
    setUltimaPausa(null);
    onRetomar();
  }, [ultimaPausa, onRetomar]);

  const handleFinalizar = useCallback(() => {
    const tempoTotalMinutos = Math.floor(tempoDecorrido / 60);
    setStatus("parado");
    onFinalizar(tempoTotalMinutos);
  }, [tempoDecorrido, onFinalizar]);

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cronômetro de Produção
          </div>
          <Badge
            variant={
              status === "rodando"
                ? "default"
                : status === "pausado"
                ? "secondary"
                : "outline"
            }
          >
            {status === "rodando" ? "Em Produção" : status === "pausado" ? "Pausado" : "Parado"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-5xl font-mono font-bold text-primary">
            {formatarTempo(tempoDecorrido)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {tempoDecorrido >= 60
              ? `${Math.floor(tempoDecorrido / 60)} minutos`
              : `${tempoDecorrido} segundos`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {status === "parado" && (
            <Button
              size="lg"
              onClick={handleIniciar}
              disabled={loading}
              className="col-span-2 h-16"
            >
              <PlayCircle className="h-6 w-6 mr-2" />
              Iniciar Produção
            </Button>
          )}

          {status === "rodando" && (
            <>
              <Button
                size="lg"
                variant="secondary"
                onClick={handlePausar}
                disabled={loading}
                className="h-16"
              >
                <PauseCircle className="h-6 w-6 mr-2" />
                Pausar
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleFinalizar}
                disabled={loading}
                className="h-16"
              >
                <StopCircle className="h-6 w-6 mr-2" />
                Finalizar
              </Button>
            </>
          )}

          {status === "pausado" && (
            <Button
              size="lg"
              onClick={handleRetomar}
              disabled={loading}
              className="col-span-2 h-16"
            >
              <PlayCircle className="h-6 w-6 mr-2" />
              Retomar Produção
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
