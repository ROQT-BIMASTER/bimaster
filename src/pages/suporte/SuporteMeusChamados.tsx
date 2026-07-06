import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LifeBuoy, Plus, Search, Loader2, MessageSquare, Repeat, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { isSuporteV2Enabled } from "@/lib/featureFlags";
import { useMeusChamados } from "@/hooks/suporte/useSuporteChamados";
import { useSuporteIaTrigger } from "@/hooks/suporte/useSuporteIaTrigger";
import { useAuth } from "@/contexts/AuthContext";
import { NovoChamadoDialog } from "@/components/suporte/NovoChamadoDialog";
import { ChamadoListItem } from "@/components/suporte/ChamadoListItem";
import { ChatThread } from "@/components/chat/v2/ChatThread";
import { CsatPrompt } from "@/components/suporte/CsatPrompt";
import { SUPORTE_STATUS_LABEL, type SuporteTicketStatus } from "@/hooks/suporte/types";
import { MinhasRotinasHojeWidget } from "@/components/suporte/MinhasRotinasHojeWidget";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PareceresTab } from "@/components/suporte/pareceres/PareceresTab";

export default function SuporteMeusChamados() {
  const { data: chamados = [], isLoading } = useMeusChamados();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [pareceresOpen, setPareceresOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("abertos");

  const filtrados = useMemo(() => {
    let lista = chamados;
    if (filtroStatus === "abertos") lista = lista.filter((c) => c.status !== "resolvido");
    else if (filtroStatus !== "todos") lista = lista.filter((c) => c.status === filtroStatus);
    const q = busca.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (c) =>
          (c.titulo ?? "").toLowerCase().includes(q) ||
          (c.protocolo ?? "").toLowerCase().includes(q),
      );
    }
    return lista;
  }, [chamados, filtroStatus, busca]);

  const selecionado = chamados.find((c) => c.id === selecionadoId) ?? null;
  const { user } = useAuth();
  useSuporteIaTrigger(selecionado?.conversa_id, user?.id);

  if (!isSuporteV2Enabled()) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <LifeBuoy className="h-8 w-8 mx-auto mb-2" />
              O módulo de Suporte está em piloto interno e ainda não foi liberado para o seu usuário.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-primary" />
              Suporte — Meus chamados
            </h2>
            <p className="text-sm text-muted-foreground">
              Abra chamados para os departamentos e acompanhe cada um em uma conversa dedicada.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/dashboard/suporte/rotinas-fixas"><Repeat className="h-4 w-4" /> Rotinas fixas</Link>
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo chamado
            </Button>
          </div>
        </div>
        <MinhasRotinasHojeWidget />

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 flex-1 min-h-0">
          {/* Lista */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por assunto ou protocolo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abertos">Abertos</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(Object.keys(SUPORTE_STATUS_LABEL) as SuporteTicketStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUPORTE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filtrados.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhum chamado encontrado.
                </p>
              ) : (
                filtrados.map((c) => (
                  <ChamadoListItem
                    key={c.id}
                    chamado={c}
                    selecionado={c.id === selecionadoId}
                    onClick={() => setSelecionadoId(c.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Thread do chamado selecionado */}
          <Card className="min-h-0 overflow-hidden hidden lg:flex lg:flex-col">
            {selecionado?.conversa_id ? (
              <>
                {selecionado.status === "resolvido" && (
                  <div className="p-2.5 border-b">
                    <CsatPrompt ticketId={selecionado.id} />
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <ChatThread
                    conversaId={selecionado.conversa_id}
                    onShowInfo={() => {}}
                    onBack={() => setSelecionadoId(null)}
                  />
                </div>
              </>
            ) : (
              <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <MessageSquare className="h-8 w-8" />
                <p className="text-sm">Selecione um chamado para ver a conversa.</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <NovoChamadoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCriado={(ticketId) => setSelecionadoId(ticketId)}
      />
    </DashboardLayout>
  );
}
