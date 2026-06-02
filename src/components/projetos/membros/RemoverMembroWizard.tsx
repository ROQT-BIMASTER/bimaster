import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertTriangle, ArrowRight, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjetoOffboarding } from "@/hooks/useProjetoOffboarding";
import { MOTIVOS_OFFBOARDING, offboardingPayloadSchema, type MotivoOffboarding } from "@/lib/validations/projetoOffboarding";
import type { ProjetoMembro } from "@/hooks/useProjetoMembros";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  membro: ProjetoMembro | null;
  outrosMembros: ProjetoMembro[];
}

const SEM_RESPONSAVEL = "__none__";

export function RemoverMembroWizard({ open, onOpenChange, projetoId, membro, outrosMembros }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [novoResponsavel, setNovoResponsavel] = useState<string>(SEM_RESPONSAVEL);
  const [novoSeguidor, setNovoSeguidor] = useState<string>(SEM_RESPONSAVEL);
  const [motivo, setMotivo] = useState<MotivoOffboarding>("desligamento");
  const [motivoDetalhe, setMotivoDetalhe] = useState("");
  const { remover } = useProjetoOffboarding(projetoId);

  useEffect(() => {
    if (open) {
      setStep(1);
      setNovoResponsavel(SEM_RESPONSAVEL);
      setNovoSeguidor(SEM_RESPONSAVEL);
      setMotivo("desligamento");
      setMotivoDetalhe("");
    } else {
      // Defensive: Radix Dialog + nested Selects/Portals occasionally leave
      // `pointer-events: none` on <body>, freezing the page until F5.
      const id = requestAnimationFrame(() => {
        if (typeof document !== "undefined" && document.body.style.pointerEvents === "none") {
          document.body.style.pointerEvents = "";
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [open, membro?.id]);

  const impacto = useImpacto(projetoId, membro?.user_id, open);

  const elegiveis = useMemo(
    () => outrosMembros.filter((m) => m.user_id !== membro?.user_id),
    [outrosMembros, membro?.user_id],
  );

  if (!membro) return null;

  const handleConfirmar = async () => {
    const parsed = offboardingPayloadSchema.safeParse({
      membroId: membro.id,
      motivo,
      motivoDetalhe: motivoDetalhe.trim() || null,
      novoResponsavelTarefas: novoResponsavel === SEM_RESPONSAVEL ? null : novoResponsavel,
      novoSeguidor: novoSeguidor === SEM_RESPONSAVEL ? null : novoSeguidor,
    });
    if (!parsed.success) return;
    try {
      await remover.mutateAsync(parsed.data);
      // Close on next tick so React Query invalidations from onSuccess don't
      // race with Radix's modal-stack unmount (causes body pointer-events lock).
      setTimeout(() => onOpenChange(false), 0);
    } catch {
      /* toast já exibido */
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-destructive" />
            Remover membro do projeto
          </DialogTitle>
          <DialogDescription>
            Passo {step} de 3 — reatribua pendências antes de revogar o acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={membro.profile?.avatar_url || undefined} />
            <AvatarFallback>{membro.profile?.nome?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{membro.profile?.nome || "Usuário"}</p>
            <p className="text-[11px] text-muted-foreground">Papel atual: {membro.papel}</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Impacto no projeto. Comentários e arquivos criados pelo membro permanecem com a autoria original.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ImpactoCard label="Tarefas como responsável" value={impacto.tarefas} loading={impacto.loading} />
              <ImpactoCard label="Tarefas que segue" value={impacto.seguidores} loading={impacto.loading} />
            </div>
            {impacto.tarefas === 0 && impacto.seguidores === 0 && !impacto.loading && (
              <p className="text-xs text-muted-foreground italic">
                Nenhuma pendência ativa. Você pode pular direto para a confirmação.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Escolha para quem transferir. Se deixar "Sem responsável", as tarefas/itens ficarão sem responsável até alguém assumir.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Tarefas onde é responsável ({impacto.tarefas})</label>
              <Select value={novoResponsavel} onValueChange={setNovoResponsavel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_RESPONSAVEL}>Deixar sem responsável</SelectItem>
                  {elegiveis.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.nome || "Membro"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Seguidores ({impacto.seguidores})</label>
              <Select value={novoSeguidor} onValueChange={setNovoSeguidor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_RESPONSAVEL}>Apenas remover</SelectItem>
                  {elegiveis.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.nome || "Membro"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {novoResponsavel === SEM_RESPONSAVEL && impacto.tarefas > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5" />
                <span>{impacto.tarefas} tarefa(s) ficarão sem responsável.</span>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Motivo</label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoOffboarding)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_OFFBOARDING.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Observações (opcional)</label>
              <Textarea
                value={motivoDetalhe}
                onChange={(e) => setMotivoDetalhe(e.target.value.slice(0, 500))}
                placeholder="Contexto para auditoria"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground text-right">{motivoDetalhe.length}/500</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-xs">
              <p className="font-medium">Resumo</p>
              <div className="flex items-center gap-1.5">
                <span>Tarefas →</span>
                <Badge variant="secondary" className="text-[10px]">
                  {novoResponsavel === SEM_RESPONSAVEL
                    ? "Sem responsável"
                    : elegiveis.find((m) => m.user_id === novoResponsavel)?.profile?.nome || "—"}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Seguidores →</span>
                <Badge variant="secondary" className="text-[10px]">
                  {novoSeguidor === SEM_RESPONSAVEL
                    ? "Apenas remover"
                    : elegiveis.find((m) => m.user_id === novoSeguidor)?.profile?.nome || "—"}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Disponível para restauração por 15 dias na aba "Ex-membros".
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={remover.isPending}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={remover.isPending}>
            Cancelar
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
              Próximo <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleConfirmar} disabled={remover.isPending}>
              {remover.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Remover do projeto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImpactoCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
      </p>
    </div>
  );
}

function useImpacto(projetoId: string, userId: string | undefined, enabled: boolean) {
  const [state, setState] = useState({ tarefas: 0, seguidores: 0, loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !userId) {
      setState({ tarefas: 0, seguidores: 0, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const [tarefasRes, segRes] = await Promise.all([
        supabase
          .from("projeto_tarefas")
          .select("id", { count: "exact", head: true })
          .eq("projeto_id", projetoId)
          .eq("responsavel_id", userId)
          .is("excluida_em", null),
        supabase
          .from("projeto_tarefa_seguidores")
          .select("tarefa_id, projeto_tarefas!inner(projeto_id)", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("projeto_tarefas.projeto_id", projetoId),
      ]);
      if (cancelled) return;
      setState({
        tarefas: tarefasRes.count ?? 0,
        seguidores: segRes.count ?? 0,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
  }, [projetoId, userId, enabled]);

  return state;
}
