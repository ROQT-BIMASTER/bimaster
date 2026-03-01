import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Timer } from "lucide-react";

interface InactivityModalProps {
  open: boolean;
  secondsLeft: number;
  onContinue: () => void;
}

export function InactivityModal({ open, secondsLeft, onContinue }: InactivityModalProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-destructive" />
            <DialogTitle>Sessão Inativa</DialogTitle>
          </div>
          <DialogDescription>
            Sua sessão será encerrada por inatividade em{" "}
            <span className="font-mono font-bold text-destructive text-lg">
              {timeDisplay}
            </span>
            . Clique abaixo para continuar conectado.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onContinue} className="w-full">
            Continuar Sessão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
