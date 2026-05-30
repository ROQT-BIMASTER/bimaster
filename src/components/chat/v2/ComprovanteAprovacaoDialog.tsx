/**
 * ComprovanteAprovacaoDialog — comprovante de aprovação eletrônica (assinatura
 * simples / trilha de auditoria, Lei 14.063/2020). Renderiza no cliente e
 * imprime via window.print() (sem geração server-side / sem carimbo no PDF).
 *
 * Mostra: título/descrição, solicitante e aprovador (nomes via
 * get_chat_directory), data/hora, IP e user-agent da decisão, e a lista de
 * documentos com seu SHA-256 — base para verificação de integridade.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, ShieldCheck, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAprovacaoDocumentos } from "@/hooks/chat/useAprovacaoDocumentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  aprovacaoId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface AprovacaoFull {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  solicitante_id: string;
  decidido_por: string | null;
  decidido_em: string | null;
  decidido_ip: string | null;
  decidido_user_agent: string | null;
  created_at: string;
}

export function ComprovanteAprovacaoDialog({ aprovacaoId, open, onOpenChange }: Props) {
  const { data: ap } = useQuery({
    queryKey: ["comprovante-aprovacao", aprovacaoId],
    enabled: open && !!aprovacaoId,
    queryFn: async (): Promise<AprovacaoFull | null> => {
      const { data, error } = await supabase
        .from("chat_aprovacoes" as any)
        .select("id, titulo, descricao, status, solicitante_id, decidido_por, decidido_em, decidido_ip, decidido_user_agent, created_at")
        .eq("id", aprovacaoId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AprovacaoFull) ?? null;
    },
  });

  const { data: documentos = [] } = useAprovacaoDocumentos(open ? aprovacaoId : null);

  const { data: nomes = {} } = useQuery({
    queryKey: ["comprovante-nomes", ap?.solicitante_id, ap?.decidido_por],
    enabled: open && !!ap,
    queryFn: async (): Promise<Record<string, string>> => {
      const ids = [ap?.solicitante_id, ap?.decidido_por].filter(Boolean) as string[];
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from("chat_directory" as any)
        .select("id, nome")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data as any[] | null)?.forEach((p) => { map[p.id] = p.nome ?? "—"; });
      return map;
    },
  });

  const fmt = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <style>{`@media print {
          body * { visibility: hidden !important; }
          .comprovante-print, .comprovante-print * { visibility: visible !important; }
          .comprovante-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .comprovante-no-print { display: none !important; }
        }`}</style>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Comprovante de Aprovação Eletrônica
          </DialogTitle>
        </DialogHeader>

        {!ap ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="comprovante-print space-y-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Assunto</p>
              <p className="font-medium">{ap.titulo}</p>
              {ap.descricao && <p className="text-muted-foreground whitespace-pre-wrap mt-0.5">{ap.descricao}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Solicitante</p>
                <p>{nomes[ap.solicitante_id] ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Aprovador</p>
                <p>{ap.decidido_por ? (nomes[ap.decidido_por] ?? "—") : "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Decisão</p>
                <p className="capitalize">{ap.status} em {fmt(ap.decidido_em)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">IP de origem</p>
                <p>{ap.decidido_ip ?? "—"}</p>
              </div>
            </div>

            {ap.decidido_user_agent && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Dispositivo</p>
                <p className="text-xs break-words text-muted-foreground">{ap.decidido_user_agent}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                Documentos ({documentos.length})
              </p>
              <div className="rounded-md border divide-y">
                {documentos.map((d) => (
                  <div key={d.id} className="p-2">
                    <p className="font-medium truncate">{d.titulo}</p>
                    <p className="text-[10px] text-muted-foreground break-all">
                      SHA-256: {d.hash_arquivo ?? "—"}
                    </p>
                  </div>
                ))}
                {documentos.length === 0 && (
                  <p className="p-2 text-xs text-muted-foreground">Nenhum documento.</p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground border-t pt-3">
              Assinatura eletrônica simples (Lei 14.063/2020): registro do ato de
              aprovação com trilha de auditoria. A integridade de cada documento pode
              ser verificada pelo hash SHA-256 acima.
            </p>
          </div>
        )}

        <div className="comprovante-no-print flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => window.print()} disabled={!ap} className="gap-1.5">
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
