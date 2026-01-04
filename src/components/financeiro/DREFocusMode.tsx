import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize2, X, Printer, FileDown } from "lucide-react";

interface DREFocusModeProps {
  children: React.ReactNode;
  title?: string;
  onExport?: () => void;
}

export function DREFocusMode({ children, title = "DRE Gerencial", onExport }: DREFocusModeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Maximize2 className="h-4 w-4" />
        Modo Foco
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
            <div className="flex items-center gap-2">
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
                  <FileDown className="h-4 w-4" />
                  Exportar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6 bg-background">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
