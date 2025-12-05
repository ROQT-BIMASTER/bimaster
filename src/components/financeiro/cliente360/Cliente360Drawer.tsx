import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import ClientePerfilCredito from "./ClientePerfilCredito";

interface Cliente360DrawerProps {
  clienteCodigo: string | null;
  open: boolean;
  onClose: () => void;
}

export default function Cliente360Drawer({ clienteCodigo, open, onClose }: Cliente360DrawerProps) {
  if (!clienteCodigo) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Visão 360° do Cliente</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6">
            <ClientePerfilCredito clienteCodigo={clienteCodigo} onClose={onClose} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
