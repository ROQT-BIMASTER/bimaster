import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCheck,
  ArrowRightLeft,
  AlertCircle,
  Flag,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSuporteBulkUpdate } from "@/hooks/suporte/useSuporteBulk";
import {
  SUPORTE_PRIORIDADE_LABEL,
  SUPORTE_STATUS_LABEL,
  type SuporteChamado,
  type SuporteFila,
  type SuportePrioridade,
  type SuporteTicketStatus,
} from "@/hooks/suporte/types";
import {
  exportTicketsCsv,
  exportTicketsXlsx,
  triggerDownload,
  type TicketColuna,
} from "@/lib/suporte/exportTickets";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  selecionados: Set<string>;
  onClear: () => void;
  filasSelecionaveis: SuporteFila[];
  tickets: SuporteChamado[];
  nomes: Map<string, string>;
  colunas: TicketColuna[];
}

type Modo = null | "assignee" | "fila" | "status" | "prioridade";

function useAgentes(filaIds: string[]) {
  return useQuery({
    queryKey: ["suporte", "fila-agentes-select", filaIds.sort().join(",")],
    enabled: filaIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: vinculos } = await (supabase.from("suporte_fila_agentes" as any)
        .select("user_id, ativo, fila_id")
        .in("fila_id", filaIds)
        .eq("ativo", true));
      const ids = [...new Set(((vinculos ?? []) as any[]).map((v) => v.user_id))];
      if (ids.length === 0) return [] as { id: string; nome: string }[];
      const { data: dir } = await (supabase.rpc as any)("get_chat_directory");
      const map = new Map<string, string>((dir ?? []).map((p: any) => [p.id, p.nome ?? "—"]));
      return ids.map((id) => ({ id, nome: map.get(id) ?? "—" }));
    },
  });
}

export function SuporteTicketsBulkBar({
  selecionados,
  onClear,
  filasSelecionaveis,
  tickets,
  nomes,
  colunas,
}: Props) {
  const bulk = useSuporteBulkUpdate();
  const [modo, setModo] = useState<Modo>(null);
  const [valor, setValor] = useState<string>("");
  const filaIds = filasSelecionaveis.map((f) => f.id);
  const { data: agentes = [] } = useAgentes(filaIds);

  const count = selecionados.size;
  if (count === 0) return null;

  const aplicar = () => {
    if (!modo || !valor) return;
    const patch: any = {};
    if (modo === "assignee") patch.assignee_id = valor === "__nenhum__" ? null : valor;
    if (modo === "fila") patch.fila_id = valor;
    if (modo === "status") patch.status = valor;
    if (modo === "prioridade") patch.prioridade = valor;
    bulk.mutate(
      { ticketIds: Array.from(selecionados), patch },
      {
        onSuccess: () => {
          setModo(null);
          setValor("");
          onClear();
        },
      },
    );
  };

  const exportar = async (formato: "csv" | "xlsx") => {
    const selTickets = tickets.filter((t) => selecionados.has(t.id));
    if (selTickets.length === 0) {
      toast.error("Nada para exportar nesta página. Selecione tickets visíveis.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (formato === "csv") {
      triggerDownload(exportTicketsCsv(selTickets, colunas, nomes), `tickets-${stamp}.csv`);
    } else {
      triggerDownload(await exportTicketsXlsx(selTickets, colunas, nomes), `tickets-${stamp}.xlsx`);
    }
    toast.success(`${selTickets.length} ticket(s) exportado(s)`);
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-full shadow-lg px-3 py-1.5 flex items-center gap-1 text-xs animate-in slide-in-from-bottom-4">
        <span className="font-medium px-2">{count} selecionado(s)</span>
        <div className="h-4 w-px bg-border mx-1" />
        <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => { setModo("assignee"); setValor(""); }}>
          <UserCheck className="h-3.5 w-3.5" /> Atribuir
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => { setModo("fila"); setValor(""); }}>
          <ArrowRightLeft className="h-3.5 w-3.5" /> Transferir
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => { setModo("status"); setValor(""); }}>
          <AlertCircle className="h-3.5 w-3.5" /> Status
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => { setModo("prioridade"); setValor(""); }}>
          <Flag className="h-3.5 w-3.5" /> Prioridade
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => exportar("csv")}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => exportar("xlsx")}>
          <Download className="h-3.5 w-3.5" /> Excel
        </Button>
        <div className="h-4 w-px bg-border mx-1" />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={modo !== null} onOpenChange={(o) => !o && setModo(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {modo === "assignee" && `Atribuir ${count} ticket(s) a…`}
              {modo === "fila" && `Transferir ${count} ticket(s) para…`}
              {modo === "status" && `Mudar status de ${count} ticket(s)`}
              {modo === "prioridade" && `Mudar prioridade de ${count} ticket(s)`}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <Select value={valor} onValueChange={setValor}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {modo === "assignee" && (
                  <>
                    <SelectItem value="__nenhum__">Remover responsável</SelectItem>
                    {agentes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </>
                )}
                {modo === "fila" && filasSelecionaveis.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
                {modo === "status" && (Object.keys(SUPORTE_STATUS_LABEL) as SuporteTicketStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{SUPORTE_STATUS_LABEL[s]}</SelectItem>
                ))}
                {modo === "prioridade" && (Object.keys(SUPORTE_PRIORIDADE_LABEL) as SuportePrioridade[]).map((p) => (
                  <SelectItem key={p} value={p}>{SUPORTE_PRIORIDADE_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModo(null)}>Cancelar</Button>
            <Button onClick={aplicar} disabled={!valor || bulk.isPending}>
              {bulk.isPending ? "Aplicando…" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
