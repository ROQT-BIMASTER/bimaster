import { useState } from "react";
import { HelpCircle, RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTour } from "./TourProvider";

interface TourButtonProps {
  tourId: string;
  tourSteps: any[];
  title?: string;
  description?: string;
}

export function TourButton({ 
  tourId, 
  tourSteps, 
  title = "Manual Interativo",
  description = "Aprenda a usar esta tela passo a passo"
}: TourButtonProps) {
  const { startTour, hasSeenTour, resetTour, isActive } = useTour();
  const [open, setOpen] = useState(false);
  
  const seenTour = hasSeenTour(tourId);

  const handleStartTour = () => {
    setOpen(false);
    startTour(tourId, tourSteps);
  };

  const handleResetAndStart = () => {
    resetTour(tourId);
    setOpen(false);
    startTour(tourId, tourSteps);
  };

  if (isActive) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
          aria-label="Ajuda interativa"
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72" 
        align="end" 
        side="top"
        sideOffset={8}
      >
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {description}
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleStartTour}
              className="w-full gap-2"
              size="sm"
            >
              <Play className="h-4 w-4" />
              {seenTour ? "Rever Tour" : "Iniciar Tour"}
            </Button>
            
            {seenTour && (
              <Button
                onClick={handleResetAndStart}
                variant="outline"
                className="w-full gap-2"
                size="sm"
              >
                <RotateCcw className="h-4 w-4" />
                Reiniciar do Zero
              </Button>
            )}
          </div>
          
          {seenTour && (
            <p className="text-xs text-muted-foreground text-center">
              ✓ Você já completou este tour
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
