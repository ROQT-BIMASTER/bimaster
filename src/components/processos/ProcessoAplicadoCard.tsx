import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Workflow, ChevronRight, CheckCircle2, Circle, ShieldCheck, ArrowRight, Plus } from "lucide-react";
import {
  useProcessoInstanciaEntidade,
  useEtapaStatus,
  useProcessoPerfis,
  useProcessoPerfilEtapas,
  aplicarPerfilEntidade,
  type EntidadeTipo,
  type ProcessoAmbiente,
} from "@/hooks/useProcessoPerfis";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AvancarEtapaDialog } from "./AvancarEtapaDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  entidadeTipo: EntidadeTipo;
  entidadeId: string;
  ambientePadrao: ProcessoAmbiente;
  titulo?: string;
}

export function ProcessoAplicadoCard({ entidadeTipo, entidadeId, ambientePadrao, titulo = "Processo aplicado" }: Props) {
  const qc = useQueryClient();
  const { data: instancia, isLoading } = useProcessoInstanciaEntidade(entidadeTipo, entidadeId);
  const { data: statusEtapas } = useEtapaStatus(instancia?.id);
  const { etapas } = useProcessoPerfilEtapas(instancia?.perfil_id ?? null);
  const [avancarOpen, setAvancarOpen] = useState(false);
  const [aplicarOpen, setAplicarOpen] = useState(false);

  // Perfil info
  const { data: perfil } = useQuery({
    queryKey: ["processo-perfil-info", instancia?.perfil_id],
    enabled: !!instancia?.perfil_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_perfis")
        .select("nome, ambiente")
        .eq("id", instancia!.perfil_id)
        .single();
      if (error) throw error;
      return data as { nome: string; ambiente: string };
    },
  });

  const etapaAtual = useMemo(
    () => etapas.find((e) => e.id === instancia?.etapa_atual_id) ?? null,
    [etapas, instancia?.etapa_atual_id]
  );

  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    (statusEtapas ?? []).forEach((s) => m.set(s.etapa_id, s.status));
    return m;
  }, [statusEtapas]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Workflow className="h-4 w-4" />{titulo}</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (!instancia) {
    return (
      <>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Workflow className="h-4 w-4 text-muted-foreground" />
              {titulo}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Nenhum perfil de processo aplicado a este item.</p>
            <Button size="sm" variant="outline" onClick={() => setAplicarOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Aplicar perfil
            </Button>
          </CardContent>
        </Card>
        <AplicarPerfilDialog
          open={aplicarOpen}
          onOpenChange={setAplicarOpen}
          ambientePadrao={ambientePadrao}
          entidadeTipo={entidadeTipo}
          entidadeId={entidadeId}
          onApplied={() => qc.invalidateQueries({ queryKey: ["processo-instancia", entidadeTipo, entidadeId] })}
        />
      </>
    );
  }

  const concluida = instancia.status === "concluida";

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              {titulo}
            </CardTitle>
            <Badge variant={concluida ? "default" : "secondary"} className="capitalize">
              {concluida ? "Concluído" : instancia.status.replace("_", " ")}
            </Badge>
          </div>
          {perfil && (
            <p className="text-xs text-muted-foreground">
              Perfil: <span className="font-medium text-foreground">{perfil.nome}</span> • Ambiente: <span className="capitalize">{perfil.ambiente}</span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pipeline visual */}
          <div className="flex flex-wrap items-center gap-1.5">
            {etapas.map((e, idx) => {
              const status = statusMap.get(e.id);
              const isAtual = e.id === instancia.etapa_atual_id;
              const isConcluida = status === "concluida";
              return (
                <div key={e.id} className="flex items-center gap-1.5">
                  <Badge
                    variant={isConcluida ? "default" : isAtual ? "secondary" : "outline"}
                    className={`gap-1 ${isAtual ? "ring-2 ring-primary/50" : ""}`}
                  >
                    {isConcluida ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    {e.label}
                    {e.requer_aprovacao && <ShieldCheck className="h-3 w-3 text-warning" />}
                  </Badge>
                  {idx < etapas.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              );
            })}
          </div>

          {/* Ação principal */}
          {!concluida && etapaAtual && (
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-xs text-muted-foreground">Etapa atual</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  {etapaAtual.label}
                  {etapaAtual.requer_aprovacao && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <ShieldCheck className="h-3 w-3" /> Requer aprovação
                    </Badge>
                  )}
                </p>
              </div>
              <Button onClick={() => setAvancarOpen(true)} size="sm">
                Avançar etapa <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {concluida && (
            <div className="border-t pt-3 flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Todas as etapas foram concluídas.
            </div>
          )}
        </CardContent>
      </Card>

      {etapaAtual && instancia && (
        <AvancarEtapaDialog
          open={avancarOpen}
          onOpenChange={setAvancarOpen}
          instanciaId={instancia.id}
          etapaId={etapaAtual.id}
          etapaLabel={etapaAtual.label}
          requerAprovacao={etapaAtual.requer_aprovacao}
        />
      )}
    </>
  );
}

function AplicarPerfilDialog({
  open, onOpenChange, ambientePadrao, entidadeTipo, entidadeId, onApplied,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  ambientePadrao: ProcessoAmbiente; entidadeTipo: EntidadeTipo; entidadeId: string;
  onApplied: () => void;
}) {
  const { perfis } = useProcessoPerfis(ambientePadrao);
  const [perfilId, setPerfilId] = useState<string>("");
  const [aplicando, setAplicando] = useState(false);

  const aplicar = async () => {
    if (!perfilId) return;
    setAplicando(true);
    try {
      await aplicarPerfilEntidade(perfilId, entidadeTipo, entidadeId);
      toast.success("Perfil aplicado");
      onApplied();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao aplicar perfil");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Aplicar perfil de processo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Perfil</Label>
          <Select value={perfilId} onValueChange={setPerfilId}>
            <SelectTrigger><SelectValue placeholder="Selecione um perfil" /></SelectTrigger>
            <SelectContent>
              {perfis.filter((p) => p.ativo).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {perfis.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum perfil cadastrado para o ambiente "{ambientePadrao}". Crie um em Processos → Perfis de Processo.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={aplicar} disabled={!perfilId || aplicando}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
