import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ParecerForm } from "./ParecerForm";
import { ParecerList } from "./ParecerList";
import { TrilhaDepartamentos } from "./TrilhaDepartamentos";
import { EvidenciasTab } from "./EvidenciasTab";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  ticketId: string;
  filaAtualId?: string | null;
  canWrite: boolean;
  onlyExterno?: boolean;
}

export function PareceresTab({
  ticketId,
  filaAtualId,
  canWrite,
  onlyExterno,
}: Props) {
  const { isAdmin } = useUserRole();
  return (
    <Tabs defaultValue="pareceres" className="h-full flex flex-col">
      <TabsList className="mx-3 mt-2 self-start">
        <TabsTrigger value="pareceres" className="text-xs">
          Pareceres
        </TabsTrigger>
        <TabsTrigger value="evidencias" className="text-xs">
          Provas & Documentos
        </TabsTrigger>
        <TabsTrigger value="trilha" className="text-xs">
          Trilha de departamentos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pareceres" className="flex-1 min-h-0 overflow-y-auto mt-0">
        <div className="p-3 space-y-3">
          {canWrite && !onlyExterno && (
            <ParecerForm ticketId={ticketId} filaAtualId={filaAtualId} />
          )}
          <ParecerList ticketId={ticketId} onlyExterno={onlyExterno} />
        </div>
      </TabsContent>

      <TabsContent value="evidencias" className="flex-1 min-h-0 overflow-y-auto mt-0">
        <EvidenciasTab
          ticketId={ticketId}
          canWrite={canWrite && !onlyExterno}
          isAdmin={isAdmin}
        />
      </TabsContent>

      <TabsContent value="trilha" className="flex-1 min-h-0 overflow-y-auto mt-0">
        <div className="p-3">
          <TrilhaDepartamentos ticketId={ticketId} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
