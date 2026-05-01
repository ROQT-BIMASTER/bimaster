import { useState } from "react";
import { Plus, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCriarShipsgoTracking } from "@/hooks/useShipsgoShipments";

interface Props {
  /** Vínculo opcional para criar tracking ligado a uma OC/Embarque. */
  embarque_id?: string;
  ordem_compra_id?: string;
  /** Pré-preenche o container quando aberto a partir de um embarque. */
  initialContainer?: string;
  initialBl?: string;
  trigger?: React.ReactNode;
}

export function NovoTrackingDialog({
  embarque_id,
  ordem_compra_id,
  initialContainer,
  initialBl,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState(initialContainer ?? "");
  const [bl, setBl] = useState(initialBl ?? "");
  const [booking, setBooking] = useState("");
  const [carrier, setCarrier] = useState("");

  const criar = useCriarShipsgoTracking();

  const submit = async () => {
    await criar.mutateAsync({
      embarque_id,
      ordem_compra_id,
      container_number: container.trim() || undefined,
      bl_number: bl.trim() || undefined,
      booking_number: booking.trim() || undefined,
      carrier_code: carrier.trim() || undefined,
    });
    setOpen(false);
    setContainer(""); setBl(""); setBooking(""); setCarrier("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Rastrear container
        </Button>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Iniciar rastreamento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Container Number">
            <Input value={container} onChange={(e) => setContainer(e.target.value.toUpperCase())} placeholder="MSCU1234567" />
          </Field>
          <Field label="BL Number">
            <Input value={bl} onChange={(e) => setBl(e.target.value.toUpperCase())} placeholder="MEDU..." />
          </Field>
          <Field label="Booking Number">
            <Input value={booking} onChange={(e) => setBooking(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Código do armador (SCAC) — opcional">
            <Input value={carrier} onChange={(e) => setCarrier(e.target.value.toUpperCase())} placeholder="MSCU, COSU, MAEU…" />
          </Field>
          <p className="text-xs text-muted-foreground">
            Informe ao menos um identificador. O sistema buscará automaticamente o armador e os eventos do container.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={criar.isPending || (!container && !bl && !booking)}>
            {criar.isPending ? "Iniciando…" : "Iniciar rastreamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
