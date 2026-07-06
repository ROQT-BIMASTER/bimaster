import { ParecerForm } from "./ParecerForm";
import { ParecerList } from "./ParecerList";
import { TrilhaDepartamentos } from "./TrilhaDepartamentos";

interface Props {
  ticketId: string;
  filaAtualId?: string | null;
  canWrite: boolean;
  onlyExterno?: boolean;
}

export function PareceresTab({ ticketId, filaAtualId, canWrite, onlyExterno }: Props) {
  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      <TrilhaDepartamentos ticketId={ticketId} />
      {canWrite && !onlyExterno && (
        <ParecerForm ticketId={ticketId} filaAtualId={filaAtualId} />
      )}
      <ParecerList ticketId={ticketId} onlyExterno={onlyExterno} />
    </div>
  );
}
