/**
 * CameraCaptureButton — botão de câmera no MessageInput.
 *
 * Comportamento:
 *  - Mobile: abre input <file capture="environment"> diretamente — usa a
 *    câmera nativa do sistema (mais rápido + suporta foto/vídeo via flag
 *    accept). Não usa Dialog próprio.
 *  - Desktop: abre Dialog próprio que pede `getUserMedia`, mostra preview
 *    ao vivo, e expõe 2 modos (Foto / Vídeo). Foto usa canvas.toBlob;
 *    Vídeo usa MediaRecorder com limite de 30s.
 *
 * Retorna o File via `onCapture(file)`. Caller é responsável por adicionar
 * ao state de anexos e enviar.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Camera, Video, Square, Circle, Loader2, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VIDEO_MAX_SECONDS = 30;

interface Props {
  onCapture: (file: File) => void;
  disabled?: boolean;
}

export function CameraCaptureButton({ onCapture, disabled }: Props) {
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onCapture(f);
    e.currentTarget.value = ""; // permite re-selecionar mesmo arquivo
  };

  if (isMobile) {
    // Mobile: usa câmera nativa via input capture (mais rápido e familiar)
    return (
      <>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInput}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInput}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              disabled={disabled}
              aria-label="Câmera"
              title="Câmera"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setTimeout(() => photoInputRef.current?.click(), 0)}>
              <Camera className="h-4 w-4 mr-2" /> Tirar foto
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTimeout(() => videoInputRef.current?.click(), 0)}>
              <Video className="h-4 w-4 mr-2" /> Gravar vídeo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  // Desktop: dialog próprio com getUserMedia
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-9 w-9 shrink-0"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
        aria-label="Câmera"
        title="Câmera"
      >
        <Camera className="h-4 w-4" />
      </Button>
      <CameraDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCapture={(file) => {
          onCapture(file);
          setDialogOpen(false);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Dialog de câmera (desktop) — getUserMedia + MediaRecorder
// ---------------------------------------------------------------------------

function CameraDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);

  // Inicia / reinicia a câmera quando o dialog abre ou o modo muda.
  // Pra modo vídeo, capturamos áudio também.
  useEffect(() => {
    if (!open) return;
    setErro(null);
    setLoadingStream(true);
    let cancelled = false;

    (async () => {
      try {
        // Para stream anterior se existir
        streamRef.current?.getTracks().forEach((t) => t.stop());

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: mode === "video",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e: any) {
        setErro(
          e?.name === "NotAllowedError"
            ? "Permissão negada. Habilite a câmera nas configurações do navegador."
            : e?.name === "NotFoundError"
              ? "Nenhuma câmera encontrada."
              : "Erro ao acessar a câmera: " + (e?.message ?? ""),
        );
      } finally {
        if (!cancelled) setLoadingStream(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  // Cleanup ao fechar
  useEffect(() => {
    if (open) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setElapsed(0);
  }, [open]);

  const tirarFoto = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Falha ao capturar a foto");
          return;
        }
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  const iniciarGravacao = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    // Preferir webm se o navegador suportar (mais comum em desktop).
    // Em Safari pode cair pra mp4 implicit; o MediaRecorder vai escolher.
    const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";

    try {
      // Bitrate limitado a ~1.5 Mbps de vídeo + 96 kbps de áudio.
      // 30s × ~1.6 Mbps ≈ 6 MB → folgadamente dentro do limite de 20 MB
      // do bucket chat-anexos (utils.ts), mesmo em codecs menos eficientes
      // (vp8). Sem isso, MediaRecorder pode usar default alto e ultrapassar.
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 96_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          toast.error("Vídeo vazio — tente de novo");
          return;
        }
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `video-${Date.now()}.${ext}`, { type: mimeType });
        onCapture(file);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          // Para automaticamente ao atingir VIDEO_MAX_SECONDS
          if (next >= VIDEO_MAX_SECONDS) {
            pararGravacao();
          }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      toast.error("Falha ao iniciar gravação: " + (e?.message ?? ""));
    }
  };

  const pararGravacao = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Câmera
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { if (!recording) setMode(v as "photo" | "video"); }}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="photo" disabled={recording}>
              <Camera className="h-4 w-4 mr-2" /> Foto
            </TabsTrigger>
            <TabsTrigger value="video" disabled={recording}>
              <Video className="h-4 w-4 mr-2" /> Vídeo
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          {erro ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-sm text-destructive-foreground bg-destructive/90 rounded px-3 py-2">{erro}</p>
            </div>
          ) : loadingStream ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          ) : null}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full object-cover transition-opacity",
              (erro || loadingStream) && "opacity-30",
            )}
          />
          {recording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full shadow-md">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              REC {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
              <span className="opacity-70">/ {VIDEO_MAX_SECONDS}s</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={recording}
          >
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          {mode === "photo" && (
            <Button onClick={tirarFoto} disabled={!!erro || loadingStream}>
              <Camera className="h-4 w-4 mr-2" /> Tirar foto
            </Button>
          )}
          {mode === "video" && !recording && (
            <Button onClick={iniciarGravacao} disabled={!!erro || loadingStream}>
              <Circle className="h-4 w-4 mr-2 fill-current" /> Iniciar gravação
            </Button>
          )}
          {mode === "video" && recording && (
            <Button onClick={pararGravacao} variant="destructive">
              <Square className="h-4 w-4 mr-2 fill-current" /> Parar e enviar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
