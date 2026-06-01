/**
 * CentralAprovacoesChat — Central de Aprovações (leve) sobre chat_aprovacoes.
 *
 * Lista, em formato de colunas (Pendente / Aprovado / Rejeitado), as
 * aprovações do chat que foram encaminhadas para a Central
 * (enviado_central = true). Escopo via RLS (participante vê as suas; admin vê
 * todas). Cada card permite abrir o comprovante (assinatura) da aprovação.
 *
 * NÃO substitui a Central de Aprovações de projetos (fluxo_aprovacao); é uma
 * fila separada e leve, alimentada pelo chat.
 */
import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, Inbox, Clock, CheckCircle2, XCircle, FileText, ShieldCheck, Loader2 } from "lucide-react";
import { useCentralAprovacoes, type CentralAprovacao } from "@/hooks/chat/useCentralAprovacoes";
import { ComprovanteAprovacaoDialog } from "@/components/chat/v2/ComprovanteAprovacaoDialog";
import { AprovacaoDetalheDialog } from "@/components/chat/v2/AprovacaoDetalheDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLUNAS: { key: "pendente" | "aprovado" | "rejeitado"; titulo: string; icon: React.ReactNode; cls: string }[] = [
  { key: "pendente", titulo: "Pendentes", icon: <Clock className="h-4 w-4" />, cls: "text-warning" },
  { key: "aprovado", titulo: "Aprovados", icon: <CheckCircle2 className="h-4 w-4" />, cls: "text-success" },
  { key: "rejeitado", titulo: "Rejeitados", icon: <XCircle className="h-4 w-4" />, cls: "text-destructive" },
];

export default function CentralAprovacoesChat() {
  const { porStatus, isLoading } = useCentralAprovacoes();
  const [busca, setBusca] = useState("");
  const [comprovanteId, setComprovanteId] = useState<string | null>(null);

  const filtrar = (lista: CentralAprovacao[]) => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (a) =>
        a.titulo.toLowerCase().includes(q) ||
        a.solicitante_nome.toLowerCase().includes(q) ||
        (a.decidido_nome ?? "").toLowerCase().includes(q),
    );
  };

  const colunas = useMemo(
    () => COLUNAS.map((c) => ({ ...c, itens: filtrar(porStatus[c.key]) })),
    [porStatus, busca],
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-[1600px] space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Inbox className="h-6 w-6" /> Aprovações do Chat
          </h1>
          <p className="text-sm text-muted-foreground">
            Aprovações do chat encaminhadas para revisão. Você vê as aprovações
            das conversas em que participa; administradores veem todas.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, solicitante ou aprovador..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {colunas.map((col) => (
              <div key={col.key} className="flex flex-col">
                <div className={`flex items-center gap-2 mb-2 font-medium ${col.cls}`}>
                  {col.icon} {col.titulo}
                  <Badge variant="secondary" className="ml-auto">{col.itens.length}</Badge>
                </div>
                <ScrollArea className="h-[calc(100vh-260px)]">
                  <div className="space-y-2 pr-2">
                    {col.itens.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        Nenhuma aprovação.
                      </p>
                    ) : (
                      col.itens.map((a) => (
                        <Card key={a.id} className="p-3 space-y-2">
                          <p className="text-sm font-medium leading-snug">{a.titulo}</p>
                          {a.descricao && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{a.descricao}</p>
                          )}
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <FileText className="h-3 w-3" /> {a.docs_count} doc(s)
                            <span className="ml-auto">
                              {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Solicitante: {a.solicitante_nome}
                            {a.decidido_nome ? ` · Decisor: ${a.decidido_nome}` : ""}
                          </p>
                          {a.status === "aprovado" && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-[11px] gap-1"
                              onClick={() => setComprovanteId(a.id)}
                            >
                              <ShieldCheck className="h-3 w-3" /> Ver comprovante
                            </Button>
                          )}
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        )}
      </div>

      {comprovanteId && (
        <ComprovanteAprovacaoDialog
          aprovacaoId={comprovanteId}
          open={!!comprovanteId}
          onOpenChange={(v) => { if (!v) setComprovanteId(null); }}
        />
      )}
    </DashboardLayout>
  );
}
